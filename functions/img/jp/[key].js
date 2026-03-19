// Serve JP character images from R2 (yuruchara-clean bucket via IMG_R2 binding)
export async function onRequestGet(context) {
  const { key } = context.params;
  
  if (!key || !/^\d+_\d+\.png$/.test(key)) {
    return new Response('Not Found', { status: 404 });
  }
  
  // yuruchara-clean stores images as: {code}_01.png
  const obj = await context.env.IMG_R2.get(key);
  if (!obj) {
    return new Response('Not Found', { status: 404 });
  }
  
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
