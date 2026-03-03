// Cron-compatible endpoint for gradual mockup generation
// Called manually or via external cron: POST /api/mockup/cron-generate
// Generates ONE mockup per call (the next missing one)
// Progress tracked via a KV key: mockup_progress = {nextIndex, product}
export async function onRequestPost(context) {
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  if (!apiKey) return jsonResp({ error: 'No API key' }, 500);

  const PRODUCTS = ['tshirt', 'mug', 'tote', 'pillow', 'poster'];
  const PRINTFUL_PRODUCTS = {
    tshirt:  { id: 71,  variantId: 4012, placement: 'front',
      area: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
    mug:     { id: 19,  variantId: 16586, placement: 'default',
      area: { area_width: 2700, area_height: 1050, width: 1050, height: 1050, top: 0, left: 825 } },
    tote:    { id: 274, variantId: 9040, placement: 'default',
      area: { area_width: 3150, area_height: 5550, width: 3150, height: 5550, top: 0, left: 0 } },
    pillow:  { id: 83,  variantId: 4532, placement: 'front',
      area: { area_width: 2850, area_height: 2850, width: 2850, height: 2850, top: 0, left: 0 } },
    poster:  { id: 1,   variantId: 19527, placement: 'default',
      area: { area_width: 3600, area_height: 3600, width: 3600, height: 3600, top: 0, left: 0 } },
  };

  // Get all character codes
  const codes = [];
  let cursor = undefined;
  for (let i = 0; i < 100; i++) {
    const opts = { prefix: '', delimiter: '/', limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const listed = await context.env.CHAR_R2.list(opts);
    for (const prefix of (listed.delimitedPrefixes || [])) {
      const code = prefix.replace('/', '');
      if (/^\d{7}$/.test(code)) codes.push(code);
    }
    if (!listed.truncated) break;
    cursor = listed.cursor;
  }
  codes.sort();

  // Get progress from KV
  let progress = { charIdx: 0, prodIdx: 0 };
  try {
    const saved = await context.env.USER_KV.get('mockup_progress', 'json');
    if (saved) progress = saved;
  } catch {}

  // Find next missing mockup
  const total = codes.length * PRODUCTS.length;
  let scanned = 0;

  for (let ci = progress.charIdx; ci < codes.length; ci++) {
    const startProd = (ci === progress.charIdx) ? progress.prodIdx : 0;
    for (let pi = startProd; pi < PRODUCTS.length; pi++) {
      const code = codes[ci];
      const product = PRODUCTS[pi];
      const cacheKey = `mockups/${code}_${product}.jpg`;

      // Check if already exists
      const existing = await context.env.CHAR_R2.head(cacheKey);
      if (existing) {
        scanned++;
        continue;
      }

      // Also check IMG_R2
      if (context.env.IMG_R2) {
        const existsImg = await context.env.IMG_R2.head(cacheKey);
        if (existsImg) {
          scanned++;
          continue;
        }
      }

      // Found a missing one - generate it
      try {
        const config = PRINTFUL_PRODUCTS[product];
        const imgVariant = product === 'mug' ? '02' : '03';
        const charImgUrl = `https://img.mascodex.com/${code}_${imgVariant}.png?v=3`;

        const imgBuffer = await generateMockup(apiKey, config, charImgUrl);

        const putOpts = { httpMetadata: { contentType: 'image/jpeg' } };
        await context.env.CHAR_R2.put(cacheKey, imgBuffer, putOpts);
        if (context.env.IMG_R2) {
          await context.env.IMG_R2.put(cacheKey, new Uint8Array(imgBuffer), putOpts);
        }

        // Save progress (next item after this one)
        const nextPi = pi + 1;
        const nextCi = nextPi >= PRODUCTS.length ? ci + 1 : ci;
        const nextProd = nextPi >= PRODUCTS.length ? 0 : nextPi;
        await context.env.USER_KV.put('mockup_progress', JSON.stringify({
          charIdx: nextCi, prodIdx: nextProd
        }));

        return jsonResp({
          action: 'generated',
          code, product,
          size: imgBuffer.byteLength,
          progress: `${ci * PRODUCTS.length + pi + 1}/${total}`,
          scanned
        });
      } catch (err) {
        // Save progress to skip this item next time if it consistently fails
        const nextPi = pi + 1;
        const nextCi = nextPi >= PRODUCTS.length ? ci + 1 : ci;
        const nextProd = nextPi >= PRODUCTS.length ? 0 : nextPi;
        await context.env.USER_KV.put('mockup_progress', JSON.stringify({
          charIdx: nextCi, prodIdx: nextProd
        }));

        return jsonResp({
          action: 'error',
          code, product,
          error: err.message,
          progress: `${ci * PRODUCTS.length + pi + 1}/${total}`,
          scanned
        });
      }
    }
  }

  // All done!
  return jsonResp({ action: 'complete', total, scanned, message: 'All mockups generated' });
}

async function generateMockup(apiKey, config, imageUrl) {
  const createResp = await fetch(
    `https://api.printful.com/mockup-generator/create-task/${config.id}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-PF-Store-Id': '10678445',
      },
      body: JSON.stringify({
        variant_ids: [config.variantId],
        format: 'jpg',
        files: [{
          placement: config.placement,
          image_url: imageUrl,
          position: config.area,
        }],
      }),
    }
  );

  const createData = await createResp.json();
  if (createData.code === 429) {
    throw new Error('Rate limited: ' + (createData.error?.message || ''));
  }
  if (createData.code !== 200 || !createData.result?.task_key) {
    throw new Error('create-task failed: ' + JSON.stringify(createData).slice(0, 200));
  }

  const taskKey = createData.result.task_key;

  // Poll with 4-second intervals (fewer API calls)
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 4000));
    const statusResp = await fetch(
      `https://api.printful.com/mockup-generator/task?task_key=${taskKey}`,
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'X-PF-Store-Id': '10678445' } }
    );
    const statusData = await statusResp.json();

    if (statusData.result?.status === 'completed') {
      const mockups = statusData.result?.mockups;
      if (mockups?.length > 0) {
        const mockupUrl = mockups[0].mockup_url || mockups[0].extra?.[0]?.url;
        if (mockupUrl) {
          const imgResp = await fetch(mockupUrl);
          return await imgResp.arrayBuffer();
        }
      }
      throw new Error('No mockup URL in result');
    }
    if (statusData.result?.status === 'failed') {
      throw new Error('Mockup generation failed');
    }
  }
  throw new Error('Timed out');
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
