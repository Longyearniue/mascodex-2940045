export async function onRequest(context) {
  const url = new URL(context.request.url);
  const key = url.pathname.replace(/^\//, '');
  
  const obj = await context.env.JP_R2.get(key === 'sitemap.xml' ? 'sitemap.xml' : key);
  if (!obj) return new Response('Not found', { status: 404 });
  
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    }
  });
}
