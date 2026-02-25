// src/calling.ts – Hono sub-router for call initiation
import { Hono } from 'hono';
import { CATEGORIES } from './categories';
import { buildCallScript } from './callScript';

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

type SessionRow = {
  id: string;
  category: string;
  status: string;
  hearing_data: string | null;
  locale: string;
};

type CallRow = {
  id: string;
  target_name: string;
  target_phone: string;
  status: string;
};

export const calling = new Hono<{ Bindings: Env }>();

// ─── POST /initiate ── Start calls for a session ─────────────────────────────
calling.post('/initiate', async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();

  if (!session_id) {
    return c.json({ error: 'session_id is required' }, 400);
  }

  // Fetch session
  const session = await c.env.DB.prepare(
    `SELECT id, category, status, hearing_data, locale
       FROM lifecall_sessions WHERE id = ?`,
  )
    .bind(session_id)
    .first<SessionRow>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  if (session.status !== 'calling') {
    return c.json(
      { error: `session status is '${session.status}', expected 'calling'` },
      409,
    );
  }

  const category = CATEGORIES[session.category];
  if (!category) {
    return c.json({ error: 'invalid category on session' }, 500);
  }

  // Get first pending call for this session
  const call = await c.env.DB.prepare(
    `SELECT id, target_name, target_phone, status
       FROM lifecall_calls
      WHERE session_id = ? AND status = 'pending'
      ORDER BY call_order ASC
      LIMIT 1`,
  )
    .bind(session_id)
    .first<CallRow>();

  if (!call) {
    return c.json({ error: 'no pending calls found for this session' }, 404);
  }

  // Parse hearing data
  let hearingData: Record<string, string> = {};
  if (session.hearing_data) {
    try {
      hearingData = JSON.parse(session.hearing_data);
    } catch {
      console.error('Failed to parse hearing_data for session', session_id);
    }
  }

  // Build the AI call script
  const script = buildCallScript({
    category,
    hearingData,
    targetName: call.target_name,
    locale: session.locale,
  });

  // Encode client state as base64 JSON for Telnyx webhook correlation
  const clientState = btoa(
    JSON.stringify({
      call_id: call.id,
      session_id: session.id,
      type: 'lifecall',
    }),
  );

  // Initiate call via Telnyx API
  const telnyxResponse = await fetch('https://api.telnyx.com/v2/calls', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      connection_id: c.env.TELNYX_CONNECTION_ID,
      to: call.target_phone,
      from: c.env.TELNYX_FROM_NUMBER,
      client_state: clientState,
      answering_machine_detection: 'detect',
      record: 'record-from-answer',
      answering_machine_detection_config: {
        after_greeting_silence_millis: 800,
        total_analysis_time_millis: 5000,
      },
    }),
  });

  if (!telnyxResponse.ok) {
    const errBody = await telnyxResponse.text();
    console.error('Telnyx call initiation failed:', telnyxResponse.status, errBody);
    return c.json(
      { error: 'failed to initiate call', detail: errBody },
      502,
    );
  }

  const telnyxData = (await telnyxResponse.json()) as {
    data: { call_control_id: string; call_leg_id: string };
  };
  const telnyxCallId = telnyxData.data.call_control_id;

  // Update call status and store telnyx_call_id
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE lifecall_calls
        SET status = 'calling', telnyx_call_id = ?
      WHERE id = ?`,
  )
    .bind(telnyxCallId, call.id)
    .run();

  // Update session timestamp
  await c.env.DB.prepare(
    `UPDATE lifecall_sessions SET updated_at = ? WHERE id = ?`,
  )
    .bind(now, session_id)
    .run();

  return c.json({
    action: 'call_initiated',
    call_id: call.id,
    target: call.target_name,
  });
});
