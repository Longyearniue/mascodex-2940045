import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sessions } from './session';
import { payment } from './payment';
import { calling } from './calling';
import { search } from './search';
import { telnyxWebhook } from './webhooks/telnyx';
import lifecallJs from './static/lifecall.txt';

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

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

app.get('/health', (c) => c.json({ ok: true, service: 'lifecall-worker' }));

app.get('/js/lifecall.js', (c) => {
  return c.body(lifecallJs, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  });
});

app.route('/api/sessions', sessions);
app.route('/api/payment', payment);
app.route('/api/calls', calling);
app.route('/api/search', search);
app.route('/webhooks/telnyx-voice', telnyxWebhook);

export default app;
