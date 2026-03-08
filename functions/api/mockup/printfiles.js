// GET /api/mockup/printfiles?product=71
// Get print area dimensions for a product
export async function onRequestGet(context) {
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  if (!apiKey) return new Response('No token', { status: 500 });

  const url = new URL(context.request.url);
  const productId = url.searchParams.get('product') || '71';

  const resp = await fetch(
    `https://api.printful.com/mockup-generator/printfiles/${productId}`,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-PF-Store-Id': '10678445',
      },
    }
  );
  const data = await resp.json();
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
