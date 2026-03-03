/**
 * US Image Proxy
 * Serves US mascot images from two R2 buckets:
 *   1. mascodex-us (new images) — key: us/{zipCode}_01.png
 *   2. usa (legacy images) — key: {serial}_{zipCode}_{variant}.png
 *
 * URL: /img/us/{zipCode}_01.png
 */
export async function onRequestGet(context) {
  const { params, env } = context;
  const key = params.key;

  if (!key) return new Response('Not Found', { status: 404 });

  // Try new bucket first (mascodex-us)
  let obj = await env.US_CHAR_R2.get(`us/${key}`);
  if (obj) {
    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Fallback: try legacy usa bucket
  // Key format requested: {zipCode}_01.png → search for {serial}_{zipCode}_01.png
  const match = key.match(/^(\d{5})_0(\d)\.png$/);
  if (match && env.US_LEGACY_R2) {
    const zipCode = match[1];
    const variant = match[2];

    // Look up serial from KV mapping
    const serial = await env.US_KV.get(`usa_serial_${zipCode}`);
    if (serial) {
      const legacyKey = `${serial}_${zipCode}_0${variant}.png`;
      obj = await env.US_LEGACY_R2.get(legacyKey);
      if (obj) {
        return new Response(obj.body, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // If no serial mapping, try listing by prefix to find it
    const listed = await env.US_LEGACY_R2.list({ limit: 5, include: ['httpMetadata'] });
    // Can't efficiently search by ZIP in middle of key without mapping
    // Fall through to 404
  }

  return new Response('Not Found', { status: 404 });
}
