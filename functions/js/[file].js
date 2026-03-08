// Serve JS files from R2
// URL: /js/{file}  (e.g., /js/lifecall.js)
export async function onRequestGet(context) {
  const { file } = context.params;

  if (!file || (!file.endsWith('.js') && !file.endsWith('.json'))) {
    return new Response('Not Found', { status: 404 });
  }

  const obj = await context.env.CHAR_R2.get(`js/${file}`);
  if (!obj) {
    // Fall through to static assets
    return context.next();
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
