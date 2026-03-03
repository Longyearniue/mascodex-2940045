export async function onRequest(context) {
  const { zip } = context.params;
  if (!/^\d{5}$/.test(zip)) return new Response('Not Found', { status: 404 });
  const obj = await context.env.US_CHAR_R2.get(`us/${zip}/index.html`);
  if (!obj) return new Response('Not Found', { status: 404 });
  const html = await obj.text();
  const nameMatch = html.match(/<title>([^|<\-]+)/);
  const name = nameMatch ? nameMatch[1].trim() : `Mascot ${zip}`;
  const summaryMatch = html.match(/I'm ([^!]+)! I'm from ([^(]+)\(ZIP/);
  let city = zip, state = 'USA';
  if (summaryMatch) {
    city = summaryMatch[2].trim().replace(/,\s*$/, '');
    const stateMatch = city.match(/,\s*([A-Z]{2})$/);
    if (stateMatch) { state = stateMatch[1]; city = city.replace(/,\s*[A-Z]{2}$/, ''); }
  }
  return new Response(JSON.stringify({ zip, name, city, state }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' }
  });
}
