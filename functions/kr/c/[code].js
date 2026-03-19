export async function onRequestGet(context) {
  const { code } = context.params;
  if (!/^\d{5}$/.test(code)) return new Response('Not Found', { status: 404 });

  const obj = await context.env.KR_CHAR_R2.get(`kr/${code}/index.html`);
  if (!obj) return new Response('Not Found', { status: 404 });

  const html = await obj.text();
  return new Response(html, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public,max-age=3600' }
  });
}
