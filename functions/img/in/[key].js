/**
 * India Image Proxy
 * Serves India mascot images from mascodex-in R2 bucket.
 * URL: /img/in/{pinCode}_01.png
 */
export async function onRequestGet(context) {
  const { params, env } = context;
  const key = params.key;

  if (!key) return new Response('Not Found', { status: 404 });

  const obj = await env.IN_CHAR_R2.get(`in/${key}`);
  if (!obj) return new Response('Not Found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
