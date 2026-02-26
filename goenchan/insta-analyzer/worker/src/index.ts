import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  REPORTS: KVNamespace;
  UPLOAD_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors({ origin: '*' }));
app.get('/api/health', (c) => c.json({ status: 'ok' }));

export default app;
