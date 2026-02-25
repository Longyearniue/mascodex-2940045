// src/session.ts – Session management sub-router
import { Hono } from 'hono';
import { CATEGORIES, detectCategory, TIER_PRICES } from './categories';

type Env = {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  STRIPE_SECRET_KEY: string;
  TELNYX_API_KEY: string;
  TELNYX_CONNECTION_ID: string;
  TELNYX_FROM_NUMBER: string;
  GOOGLE_PLACES_API_KEY: string;
  CORS_ORIGIN: string;
};

export const sessions = new Hono<{ Bindings: Env }>();

// ─── POST /start ── Create a new concierge session ─────────────────────────
sessions.post('/start', async (c) => {
  const body = await c.req.json<{
    postal_code: string;
    message: string;
    locale?: string;
  }>();

  const { postal_code, message } = body;

  if (!postal_code || !message) {
    return c.json({ error: 'postal_code and message are required' }, 400);
  }

  // Detect category from the user's message
  const categoryId = detectCategory(message);
  if (!categoryId) {
    return c.json({ action: 'not_concierge' });
  }

  const category = CATEGORIES[categoryId];
  if (!category) {
    return c.json({ action: 'not_concierge' });
  }

  // Determine locale: 'ja' if locale param starts with 'ja', otherwise 'en'
  const locale = body.locale?.startsWith('ja') ? 'ja' : 'en';
  const priceKey = locale as keyof (typeof TIER_PRICES)[typeof category.tier];
  const price = TIER_PRICES[category.tier][priceKey];

  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Insert session row
  await c.env.DB.prepare(
    `INSERT INTO lifecall_sessions
       (id, postal_code, category, status, price_tier, locale, created_at, updated_at)
     VALUES (?, ?, ?, 'hearing', ?, ?, ?, ?)`
  )
    .bind(sessionId, postal_code, categoryId, category.tier, locale, now, now)
    .run();

  // Store the initial user message
  await c.env.DB.prepare(
    `INSERT INTO lifecall_messages (session_id, role, content, created_at)
     VALUES (?, 'user', ?, ?)`
  )
    .bind(sessionId, message, now)
    .run();

  // Build localised field list for the front-end
  const labelKey = locale === 'ja' ? 'label_ja' : 'label_en';
  const fields = category.fields.map((f) => ({
    key: f.key,
    label: f[labelKey],
    required: f.required,
    type: f.type,
    options: f.options?.map((o) => ({
      value: o.value,
      label: locale === 'ja' ? o.label_ja : o.label_en,
    })),
  }));

  return c.json({
    action: 'hearing',
    session_id: sessionId,
    category: {
      id: category.id,
      name: locale === 'ja' ? category.name_ja : category.name_en,
      tier: category.tier,
      max_calls: category.max_calls,
      needs_search: category.needs_search,
    },
    fields,
    price,
    locale,
  });
});

// ─── GET /:id ── Get session status + associated calls ─────────────────────
sessions.get('/:id', async (c) => {
  const id = c.req.param('id');

  const session = await c.env.DB.prepare(
    `SELECT * FROM lifecall_sessions WHERE id = ?`
  )
    .bind(id)
    .first();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  const { results: calls } = await c.env.DB.prepare(
    `SELECT * FROM lifecall_calls WHERE session_id = ? ORDER BY call_order`
  )
    .bind(id)
    .all();

  return c.json({ session, calls });
});

// ─── POST /:id/hearing ── Submit hearing data ──────────────────────────────
sessions.post('/:id/hearing', async (c) => {
  const id = c.req.param('id');
  const hearingData = await c.req.json<Record<string, unknown>>();

  // Verify session exists and is in the right state
  const session = await c.env.DB.prepare(
    `SELECT id, category, status, price_tier, locale FROM lifecall_sessions WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: string;
      category: string;
      status: string;
      price_tier: number;
      locale: string;
    }>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  if (session.status !== 'hearing') {
    return c.json({ error: `session status is '${session.status}', expected 'hearing'` }, 409);
  }

  const category = CATEGORIES[session.category];
  if (!category) {
    return c.json({ error: 'invalid category on session' }, 500);
  }

  // Validate required fields
  const missingFields: string[] = [];
  for (const field of category.fields) {
    if (field.required && !hearingData[field.key]) {
      missingFields.push(field.key);
    }
  }
  if (missingFields.length > 0) {
    return c.json({ error: 'missing required fields', fields: missingFields }, 400);
  }

  const now = new Date().toISOString();
  const priceKey = session.locale as keyof (typeof TIER_PRICES)[typeof category.tier];
  const price = TIER_PRICES[category.tier][priceKey];

  // Update session: store hearing data, advance status to 'payment'
  await c.env.DB.prepare(
    `UPDATE lifecall_sessions
        SET hearing_data = ?, status = 'payment', updated_at = ?
      WHERE id = ?`
  )
    .bind(JSON.stringify(hearingData), now, id)
    .run();

  return c.json({
    action: 'ready_for_payment',
    session_id: id,
    price,
  });
});
