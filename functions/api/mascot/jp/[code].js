export async function onRequest(context) {
  const { code } = context.params;
  if (!/^\d{7}$/.test(code)) return new Response('Not Found', { status: 404 });
  const obj = await context.env.CHAR_R2?.get(`${code}/index.html`);
  if (!obj) return new Response('Not Found', { status: 404 });
  const html = await obj.text();
  const nameMatch = html.match(/<h1[^>]*>([^<]+)/);
  const descMatch = html.match(/郵便番号\s*([^\s<]+)\s*の/);
  const name = nameMatch ? nameMatch[1].trim() : `ゆるキャラ${code}`;
  return new Response(JSON.stringify({ code, name, city: '', prefecture: 'Japan' }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' }
  });
}
