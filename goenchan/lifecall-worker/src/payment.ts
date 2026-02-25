// src/payment.ts – Stripe payment sub-router
import { Hono } from 'hono';
import { TIER_PRICES } from './categories';

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
  status: string;
  price_tier: number;
  locale: string;
  stripe_payment_intent_id: string | null;
};

export const payment = new Hono<{ Bindings: Env }>();

// ─── Helper: call Stripe API ─────────────────────────────────────────────────
async function stripeRequest(
  path: string,
  method: 'GET' | 'POST',
  secretKey: string,
  body?: Record<string, string>,
): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  const url = `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
  };

  const init: RequestInit = { method, headers };

  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(body).toString();
  }

  const res = await fetch(url, init);
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data, status: res.status };
}

// ─── POST /create-intent ── Create a Stripe PaymentIntent ────────────────────
payment.post('/create-intent', async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();

  if (!session_id) {
    return c.json({ error: 'session_id is required' }, 400);
  }

  // Fetch session
  const session = await c.env.DB.prepare(
    `SELECT id, status, price_tier, locale, stripe_payment_intent_id
       FROM lifecall_sessions WHERE id = ?`,
  )
    .bind(session_id)
    .first<SessionRow>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  if (session.status !== 'payment') {
    return c.json(
      { error: `session status is '${session.status}', expected 'payment'` },
      409,
    );
  }

  // Calculate amount based on tier + locale
  const tier = session.price_tier as keyof typeof TIER_PRICES;
  const priceEntry = TIER_PRICES[tier];
  if (!priceEntry) {
    return c.json({ error: 'invalid price tier on session' }, 500);
  }
  const localeKey = session.locale as 'ja' | 'en';
  const amount = priceEntry[localeKey];

  // Create PaymentIntent via Stripe API
  const { ok, data } = await stripeRequest(
    '/payment_intents',
    'POST',
    c.env.STRIPE_SECRET_KEY,
    {
      amount: String(amount),
      currency: 'jpy',
      'metadata[session_id]': session_id,
    },
  );

  if (!ok) {
    console.error('Stripe create-intent error:', JSON.stringify(data));
    return c.json({ error: 'failed to create payment intent', detail: data }, 502);
  }

  const paymentIntentId = data.id as string;
  const clientSecret = data.client_secret as string;

  // Store payment intent ID in session
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE lifecall_sessions
        SET stripe_payment_intent_id = ?, updated_at = ?
      WHERE id = ?`,
  )
    .bind(paymentIntentId, now, session_id)
    .run();

  return c.json({ client_secret: clientSecret, amount });
});

// ─── POST /confirm ── Verify payment succeeded and advance session ───────────
payment.post('/confirm', async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();

  if (!session_id) {
    return c.json({ error: 'session_id is required' }, 400);
  }

  // Fetch session
  const session = await c.env.DB.prepare(
    `SELECT id, status, stripe_payment_intent_id
       FROM lifecall_sessions WHERE id = ?`,
  )
    .bind(session_id)
    .first<SessionRow>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  if (!session.stripe_payment_intent_id) {
    return c.json({ error: 'no payment intent found for this session' }, 400);
  }

  // Retrieve PaymentIntent from Stripe
  const { ok, data } = await stripeRequest(
    `/payment_intents/${session.stripe_payment_intent_id}`,
    'GET',
    c.env.STRIPE_SECRET_KEY,
  );

  if (!ok) {
    console.error('Stripe retrieve PI error:', JSON.stringify(data));
    return c.json({ error: 'failed to verify payment intent', detail: data }, 502);
  }

  const piStatus = data.status as string;

  if (piStatus !== 'succeeded') {
    return c.json(
      { error: `payment not completed, current status: '${piStatus}'` },
      402,
    );
  }

  // Advance session to 'calling'
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE lifecall_sessions
        SET status = 'calling', updated_at = ?
      WHERE id = ?`,
  )
    .bind(now, session_id)
    .run();

  return c.json({ action: 'payment_confirmed', session_id });
});

// ─── POST /refund ── Process a refund via Stripe ─────────────────────────────
payment.post('/refund', async (c) => {
  const { session_id, reason } = await c.req.json<{
    session_id: string;
    reason?: string;
  }>();

  if (!session_id) {
    return c.json({ error: 'session_id is required' }, 400);
  }

  // Fetch session
  const session = await c.env.DB.prepare(
    `SELECT id, status, stripe_payment_intent_id
       FROM lifecall_sessions WHERE id = ?`,
  )
    .bind(session_id)
    .first<SessionRow>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  if (!session.stripe_payment_intent_id) {
    return c.json({ error: 'no payment intent found for this session' }, 400);
  }

  // Create refund via Stripe API
  const refundParams: Record<string, string> = {
    payment_intent: session.stripe_payment_intent_id,
  };
  if (reason) {
    refundParams['metadata[reason]'] = reason;
  }

  const { ok, data } = await stripeRequest(
    '/refunds',
    'POST',
    c.env.STRIPE_SECRET_KEY,
    refundParams,
  );

  if (!ok) {
    console.error('Stripe refund error:', JSON.stringify(data));
    return c.json({ error: 'failed to process refund', detail: data }, 502);
  }

  const refundId = data.id as string;

  // Update session status and store refund ID
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE lifecall_sessions
        SET status = 'refunded', stripe_refund_id = ?, updated_at = ?
      WHERE id = ?`,
  )
    .bind(refundId, now, session_id)
    .run();

  return c.json({ action: 'refunded', refund_id: refundId });
});
