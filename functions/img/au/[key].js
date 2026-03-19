/**
 * AU Image Proxy
 * Serves Australian mascot images from R2 bucket mascodex-au
 * Key format: au/{postcode}_01.png
 *
 * URL: /img/au/{postcode}_01.png
 */
export async function onRequestGet(context) {
  const { params, env } = context;
  const key = params.key;

  if (!key) return new Response('Not Found', { status: 404 });

  const obj = await env.AU_CHAR_R2.get(`au/${key}`);
  if (obj) {
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return new Response('Not Found', { status: 404 });
}
