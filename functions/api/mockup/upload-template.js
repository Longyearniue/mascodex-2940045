// Helper: upload template OR purge cached mockups from R2
// Upload: GET /api/mockup/upload-template?key=templates/tote.png&url=https://...
// Purge:  GET /api/mockup/upload-template?purge=CODE  (deletes all cached mockups for a character)
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const purge = url.searchParams.get('purge');

  if (purge) {
    // Delete all cached mockups for this character code
    const products = ['tshirt', 'mug', 'tote', 'pillow', 'poster'];
    const results = {};
    for (const p of products) {
      const key = `mockups/${purge}_${p}.jpg`;
      try {
        await context.env.CHAR_R2.delete(key);
        await context.env.IMG_R2.delete(key);
        results[p] = 'deleted';
      } catch (e) {
        results[p] = e.message;
      }
    }
    return new Response(JSON.stringify({ success: true, purged: purge, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const key = url.searchParams.get('key');
  const sourceUrl = url.searchParams.get('url');

  if (!key || !sourceUrl) {
    return new Response(JSON.stringify({ error: 'key and url required, or use purge=CODE' }), { status: 400 });
  }

  const existing = await context.env.IMG_R2.head(key);
  const resp = await fetch(sourceUrl);
  if (!resp.ok) {
    return new Response(JSON.stringify({ error: `Fetch failed: ${resp.status}` }), { status: 500 });
  }

  const buf = await resp.arrayBuffer();
  await context.env.IMG_R2.put(key, buf, {
    httpMetadata: { contentType: 'image/png' },
  });

  const verify = await context.env.IMG_R2.head(key);
  return new Response(JSON.stringify({
    success: true, key,
    oldSize: existing?.size || null,
    newSize: verify?.size || null,
    sourceSize: buf.byteLength,
  }), { headers: { 'Content-Type': 'application/json' } });
}
