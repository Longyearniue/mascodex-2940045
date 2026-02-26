import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Env = {
  REPORTS: KVNamespace;
  UPLOAD_SECRET: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*' }));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Upload report
app.post('/api/upload', async (c) => {
  // Verify authorization
  const authHeader = c.req.header('Authorization');
  if (!authHeader || authHeader !== `Bearer ${c.env.UPLOAD_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Parse and validate body
  let body: { secretCode?: string; username?: string; report?: unknown; profile?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { secretCode, username, report, profile } = body;

  if (!secretCode || !username || !report || !profile) {
    return c.json({ error: 'Missing required fields: secretCode, username, report, profile' }, 400);
  }

  // Store in KV with 48-hour TTL
  const value = JSON.stringify({
    username,
    report,
    profile,
    createdAt: new Date().toISOString(),
  });

  await c.env.REPORTS.put(`report:${secretCode}`, value, {
    expirationTtl: 172800,
  });

  return c.json({ success: true, secretCode });
});

// Get report by code
app.get('/api/report/:code', async (c) => {
  const code = c.req.param('code');
  const data = await c.env.REPORTS.get(`report:${code}`);

  if (!data) {
    return c.json({ error: 'Report not found or expired' }, 404);
  }

  return c.json(JSON.parse(data));
});

export default app;
