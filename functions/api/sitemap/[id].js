export async function onRequestGet(context) {
  const { id } = context.params;
  const key = `sitemap-${id}.xml`;
  const obj = await context.env.CHAR_R2.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  let xml = await obj.text();
  // 古いドメインを正しいURLに書き換え
  xml = xml.replace(/https:\/\/characters\.mascodex\.com\/(\d{7})\//g, 'https://mascodex.com/c/$1');
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=86400' }
  });
}
