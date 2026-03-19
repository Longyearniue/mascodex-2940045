export async function onRequest(context) {
  const obj = await context.env.CHAR_R2.get('sitemap-us.xml');
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=86400' }
  });
}
