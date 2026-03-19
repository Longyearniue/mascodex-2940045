// Mockup serve: R2キャッシュ → compose Worker生成
export async function onRequestGet(context) {
  const { code } = context.params;
  const url = new URL(context.request.url);
  const product = url.searchParams.get('product') || 'tshirt';

  // コードの長さで国を判定してバケットを選択
  // JP: CHAR_R2 (yuruchara) — Printful生成モックがここにある
  // US: US_CHAR_R2 (mascodex-us)
  // IN: IN_CHAR_R2 (mascodex-in)
  const isUS = code.length === 5;
  const isIN = code.length === 6;
  const r2 = isUS ? context.env.US_CHAR_R2
            : isIN ? context.env.IN_CHAR_R2
            : context.env.CHAR_R2; // JP (7桁) → yuruchara

  const cacheKey = `mockups/${code}_${product}.jpg`;

  // R2キャッシュ確認
  const cached = await r2.get(cacheKey);
  if (cached) {
    const buf = await cached.arrayBuffer();
    return new Response(buf, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // なければWorkerで合成
  const workerUrl = `https://mockup-compose-worker.taiichifox.workers.dev/api/mockup/compose/${code}?product=${product}`;
  const resp = await fetch(workerUrl);
  if (!resp.ok) {
    return Response.redirect(`https://img.mascodex.com/${code}_01.png`, 302);
  }

  const imgData = await resp.arrayBuffer();

  // R2に保存（非同期）
  context.waitUntil(
    r2.put(cacheKey, imgData, { httpMetadata: { contentType: 'image/jpeg' } })
  );

  return new Response(imgData, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=2592000',
      'Access-Control-Allow-Origin': '*',
    }
  });
}
