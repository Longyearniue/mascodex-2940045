import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sessions } from './session';
import { payment } from './payment';
import { calling } from './calling';
import { telnyxWebhook } from './webhooks/telnyx';

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

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

app.get('/health', (c) => c.json({ ok: true, service: 'lifecall-worker' }));

app.route('/api/sessions', sessions);
app.route('/api/payment', payment);
app.route('/api/calls', calling);
app.route('/webhooks/telnyx-voice', telnyxWebhook);

export default app;
