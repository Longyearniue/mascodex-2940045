// GET /api/mockup/products?search=case
export async function onRequestGet(context) {
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  if (!apiKey) return new Response('No token', { status: 500 });

  const url = new URL(context.request.url);
  const search = (url.searchParams.get('search') || '').toLowerCase();

  const resp = await fetch('https://api.printful.com/products', {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'X-PF-Store-Id': '10678445' },
  });
  const data = await resp.json();

  let products = data.result || [];
  if (search) {
    products = products.filter(p =>
      (p.title || '').toLowerCase().includes(search) ||
      (p.type || '').toLowerCase().includes(search)
    );
  }

  const summary = products.map(p => ({ id: p.id, title: p.title, type: p.type }));
  return new Response(JSON.stringify(summary, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
