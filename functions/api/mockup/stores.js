// GET /api/mockup/stores — List Printful stores to find store_id
export async function onRequestGet(context) {
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'No API token' }), { status: 500 });
  }

  const resp = await fetch('https://api.printful.com/stores', {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const data = await resp.json();
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
