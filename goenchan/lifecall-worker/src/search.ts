// src/search.ts – Google Places vendor search sub-router
import { Hono } from 'hono';

type Env = {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_SECRET: string;
  PAYPAL_MODE: string;
  TELNYX_API_KEY: string;
  TELNYX_CONNECTION_ID: string;
  TELNYX_FROM_NUMBER: string;
  GOOGLE_PLACES_API_KEY: string;
  CORS_ORIGIN: string;
};

// Category ID -> Japanese search terms for Google Places
const CATEGORY_SEARCH_TYPES: Record<string, string[]> = {
  hospital_new: ['病院', '内科'],
  dentist: ['歯医者', '歯科'],
  health_check: ['健康診断', '人間ドック'],
  karaoke: ['カラオケ'],
  moving: ['引越し業者'],
  aircon_repair: ['エアコン修理'],
  junk_removal: ['不用品回収'],
  plumbing: ['水道修理', '水漏れ修理'],
  locksmith: ['鍵屋', '鍵開け'],
};

// Google Places Text Search response types
interface GooglePlaceResult {
  displayName?: { text: string; languageCode: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
}

interface GooglePlacesResponse {
  places?: GooglePlaceResult[];
}

// Vendor result returned to the frontend
interface VendorResult {
  name: string;
  address: string;
  phone: string;
  rating: number;
  review_count: number;
}

export const search = new Hono<{ Bindings: Env }>();

// ─── POST /find ── Search for vendors near a postal code ─────────────────────
search.post('/find', async (c) => {
  const body = await c.req.json<{
    category_id: string;
    postal_code: string;
    query?: string;
  }>();

  const { category_id, postal_code, query } = body;

  if (!category_id || !postal_code) {
    return c.json({ error: 'category_id and postal_code are required' }, 400);
  }

  // Determine search terms
  const searchTerms = CATEGORY_SEARCH_TYPES[category_id];
  if (!searchTerms) {
    return c.json(
      { error: `category '${category_id}' does not support vendor search` },
      400,
    );
  }

  // Build text query: use custom query if provided, otherwise first search term
  const searchQuery = query || searchTerms[0];
  const textQuery = `${searchQuery} ${postal_code}`;

  // Call Google Places Text Search API
  const placesResponse = await fetch(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': c.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask':
          'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.types',
      },
      body: JSON.stringify({
        textQuery,
        languageCode: 'ja',
        maxResultCount: 5,
      }),
    },
  );

  if (!placesResponse.ok) {
    const errBody = await placesResponse.text();
    console.error(
      'Google Places API error:',
      placesResponse.status,
      errBody,
    );
    return c.json(
      { error: 'Google Places search failed', detail: errBody },
      502,
    );
  }

  const placesData = (await placesResponse.json()) as GooglePlacesResponse;
  const places = placesData.places || [];

  // Filter to only results with a phone number, map to VendorResult
  const results: VendorResult[] = places
    .filter(
      (p) => p.nationalPhoneNumber || p.internationalPhoneNumber,
    )
    .map((p) => ({
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || '',
      rating: p.rating || 0,
      review_count: p.userRatingCount || 0,
    }))
    .sort((a, b) => b.rating - a.rating);

  return c.json({ results });
});

// ─── POST /select ── Create call records from selected targets ───────────────
search.post('/select', async (c) => {
  const body = await c.req.json<{
    session_id: string;
    targets: { name: string; phone: string; address?: string }[];
  }>();

  const { session_id, targets } = body;

  if (!session_id || !targets || targets.length === 0) {
    return c.json(
      { error: 'session_id and at least one target are required' },
      400,
    );
  }

  // Verify session exists
  const session = await c.env.DB.prepare(
    `SELECT id, status FROM lifecall_sessions WHERE id = ?`,
  )
    .bind(session_id)
    .first<{ id: string; status: string }>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  // Insert call records with auto-incrementing call_order
  const now = new Date().toISOString();
  const insertStmt = c.env.DB.prepare(
    `INSERT INTO lifecall_calls
       (id, session_id, target_name, target_phone, target_address, call_order, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  );

  const batch = targets.map((target, idx) =>
    insertStmt.bind(
      crypto.randomUUID(),
      session_id,
      target.name,
      target.phone,
      target.address || null,
      idx + 1,
      now,
    ),
  );

  await c.env.DB.batch(batch);

  return c.json({ action: 'targets_set', count: targets.length });
});
