// src/payment.ts – PayPal payment sub-router
import { Hono } from 'hono';
import { TIER_PRICES } from './categories';
import { getAccessToken, createOrder, captureOrder, refundCapture } from './paypal';

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

type SessionRow = {
  id: string;
  status: string;
  price_tier: number;
  locale: string;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
};

export const payment = new Hono<{ Bindings: Env }>();

// ─── POST /create-order ── Create a PayPal order ─────────────────────────────
payment.post('/create-order', async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();

  if (!session_id) {
    return c.json({ error: 'session_id is required' }, 400);
  }

  const session = await c.env.DB.prepare(
    `SELECT id, status, price_tier, locale, paypal_order_id
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

  const tier = session.price_tier as keyof typeof TIER_PRICES;
  const priceEntry = TIER_PRICES[tier];
  if (!priceEntry) {
    return c.json({ error: 'invalid price tier on session' }, 500);
  }
  const localeKey = session.locale as 'ja' | 'en';
  const amount = priceEntry[localeKey];

  try {
    const accessToken = await getAccessToken(
      c.env.PAYPAL_CLIENT_ID,
      c.env.PAYPAL_SECRET,
      c.env.PAYPAL_MODE,
    );

    const orderId = await createOrder(
      accessToken,
      amount,
      c.env.PAYPAL_MODE,
      `Life Call Concierge - Session ${session_id}`,
    );

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE lifecall_sessions
          SET paypal_order_id = ?, updated_at = ?
        WHERE id = ?`,
    )
      .bind(orderId, now, session_id)
      .run();

    return c.json({ order_id: orderId, amount });
  } catch (e) {
    console.error('PayPal create-order error:', e);
    return c.json({ error: 'failed to create PayPal order' }, 502);
  }
});

// ─── POST /capture ── Capture payment and advance session ────────────────────
payment.post('/capture', async (c) => {
  const { session_id, order_id } = await c.req.json<{
    session_id: string;
    order_id: string;
  }>();

  if (!session_id || !order_id) {
    return c.json({ error: 'session_id and order_id are required' }, 400);
  }

  const session = await c.env.DB.prepare(
    `SELECT id, status, paypal_order_id
       FROM lifecall_sessions WHERE id = ?`,
  )
    .bind(session_id)
    .first<SessionRow>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  if (session.paypal_order_id !== order_id) {
    return c.json({ error: 'order_id mismatch' }, 400);
  }

  try {
    const accessToken = await getAccessToken(
      c.env.PAYPAL_CLIENT_ID,
      c.env.PAYPAL_SECRET,
      c.env.PAYPAL_MODE,
    );

    const captureResult = await captureOrder(accessToken, order_id, c.env.PAYPAL_MODE);
    const status = (captureResult as { status?: string }).status;

    if (status !== 'COMPLETED') {
      return c.json({ error: `capture status: ${status}` }, 402);
    }

    // Extract capture ID for potential refunds
    const purchaseUnits = (captureResult as { purchase_units?: Array<{ payments?: { captures?: Array<{ id: string }> } }> }).purchase_units;
    const captureId = purchaseUnits?.[0]?.payments?.captures?.[0]?.id || '';

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE lifecall_sessions
          SET status = 'calling', paypal_capture_id = ?, updated_at = ?
        WHERE id = ?`,
    )
      .bind(captureId, now, session_id)
      .run();

    return c.json({ action: 'payment_confirmed', session_id });
  } catch (e) {
    console.error('PayPal capture error:', e);
    return c.json({ error: 'failed to capture payment' }, 502);
  }
});

// ─── POST /refund ── Process a refund via PayPal ─────────────────────────────
payment.post('/refund', async (c) => {
  const { session_id, reason } = await c.req.json<{
    session_id: string;
    reason?: string;
  }>();

  if (!session_id) {
    return c.json({ error: 'session_id is required' }, 400);
  }

  const session = await c.env.DB.prepare(
    `SELECT id, status, paypal_capture_id
       FROM lifecall_sessions WHERE id = ?`,
  )
    .bind(session_id)
    .first<SessionRow>();

  if (!session) {
    return c.json({ error: 'session not found' }, 404);
  }

  if (!session.paypal_capture_id) {
    return c.json({ error: 'no capture found for this session' }, 400);
  }

  try {
    const accessToken = await getAccessToken(
      c.env.PAYPAL_CLIENT_ID,
      c.env.PAYPAL_SECRET,
      c.env.PAYPAL_MODE,
    );

    const refundResult = await refundCapture(
      accessToken,
      session.paypal_capture_id,
      c.env.PAYPAL_MODE,
    );

    const refundId = (refundResult as { id?: string }).id || '';

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE lifecall_sessions
          SET status = 'refunded', updated_at = ?
        WHERE id = ?`,
    )
      .bind(now, session_id)
      .run();

    return c.json({ action: 'refunded', refund_id: refundId });
  } catch (e) {
    console.error('PayPal refund error:', e);
    return c.json({ error: 'failed to process refund' }, 502);
  }
});
