// Quick helper to get variants for a product
export async function onRequestGet(context) {
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  const url = new URL(context.request.url);
  const productId = url.searchParams.get('product') || '380';
  
  const resp = await fetch(`https://api.printful.com/products/${productId}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const data = await resp.json();
  
  const variants = (data.result?.variants || []).map(v => ({
    id: v.id, name: v.name, size: v.size, color: v.color
  }));
  
  return new Response(JSON.stringify({ product: data.result?.product?.title, variants }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
