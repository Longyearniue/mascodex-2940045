// Batch mockup generation for all characters
// POST /api/mockup/batch               - list all character codes
// POST /api/mockup/batch?start=0&limit=5 - generate mockups for a batch of characters
// POST /api/mockup/batch?code=8920871   - generate mockups for a single character
export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const mode = url.searchParams.get('mode') || 'list';
  const singleCode = url.searchParams.get('code');

  // List all character codes from R2
  if (mode === 'list' && !singleCode) {
    const codes = [];
    let cursor = undefined;
    let iterations = 0;
    while (iterations < 100) { // safety limit
      const opts = { prefix: '', delimiter: '/', limit: 1000 };
      if (cursor) opts.cursor = cursor;
      const listed = await context.env.CHAR_R2.list(opts);
      for (const prefix of (listed.delimitedPrefixes || [])) {
        const code = prefix.replace('/', '');
        if (/^\d{7}$/.test(code)) {
          codes.push(code);
        }
      }
      if (!listed.truncated) break;
      cursor = listed.cursor;
      iterations++;
    }
    return jsonResp({ total: codes.length, codes });
  }

  // Generate mockups for one character
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  if (!apiKey) return jsonResp({ error: 'No API key' }, 500);

  const products = ['tshirt', 'mug', 'tote', 'pillow', 'poster'];
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

  if (singleCode) {
    if (!/^\d{7}$/.test(singleCode)) return jsonResp({ error: 'Invalid code' }, 400);
    const results = {};
    for (const product of products) {
      const cacheKey = `mockups/${singleCode}_${product}.jpg`;
      // Skip if already cached
      const existing = await context.env.CHAR_R2.head(cacheKey);
      if (existing) {
        results[product] = { status: 'cached', size: existing.size };
        continue;
      }
      try {
        const config = PRINTFUL_PRODUCTS[product];
        const imgVariant = product === 'mug' ? '02' : '03';
        const charImgUrl = `https://img.mascodex.com/${singleCode}_${imgVariant}.png?v=3`;
        const imgBuffer = await generateMockup(apiKey, product, charImgUrl, config);
        const putOpts = { httpMetadata: { contentType: 'image/jpeg' } };
        await context.env.CHAR_R2.put(cacheKey, imgBuffer, putOpts);
        if (context.env.IMG_R2) {
          await context.env.IMG_R2.put(cacheKey, new Uint8Array(imgBuffer), putOpts);
        }
        results[product] = { status: 'generated', size: imgBuffer.byteLength };
      } catch (err) {
        results[product] = { status: 'error', error: err.message };
        // If rate limited, stop and report
        if (err.message.includes('429') || err.message.includes('too many')) {
          results._stopped = 'rate_limited';
          break;
        }
      }
    }
    return jsonResp({ code: singleCode, results });
  }

  // Batch mode: generate for multiple characters
  const start = parseInt(url.searchParams.get('start') || '0');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '1'), 3);

  // Get character list
  const codes = [];
  let cursor = undefined;
  let iterations = 0;
  while (iterations < 100) {
    const opts = { prefix: '', delimiter: '/', limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const listed = await context.env.CHAR_R2.list(opts);
    for (const prefix of (listed.delimitedPrefixes || [])) {
      const code = prefix.replace('/', '');
      if (/^\d{7}$/.test(code)) codes.push(code);
    }
    if (!listed.truncated) break;
    cursor = listed.cursor;
    iterations++;
  }

  const batch = codes.sort().slice(start, start + limit);
  const batchResults = {};

  for (const code of batch) {
    batchResults[code] = {};
    for (const product of products) {
      const cacheKey = `mockups/${code}_${product}.jpg`;
      const existing = await context.env.CHAR_R2.head(cacheKey);
      if (existing) {
        batchResults[code][product] = { status: 'cached', size: existing.size };
        continue;
      }
      try {
        const config = PRINTFUL_PRODUCTS[product];
        const imgVariant = product === 'mug' ? '02' : '03';
        const charImgUrl = `https://img.mascodex.com/${code}_${imgVariant}.png?v=3`;
        const imgBuffer = await generateMockup(apiKey, product, charImgUrl, config);
        const putOpts = { httpMetadata: { contentType: 'image/jpeg' } };
        await context.env.CHAR_R2.put(cacheKey, imgBuffer, putOpts);
        if (context.env.IMG_R2) {
          await context.env.IMG_R2.put(cacheKey, new Uint8Array(imgBuffer), putOpts);
        }
        batchResults[code][product] = { status: 'generated', size: imgBuffer.byteLength };
      } catch (err) {
        batchResults[code][product] = { status: 'error', error: err.message };
        if (err.message.includes('429') || err.message.includes('too many')) {
          batchResults._stopped = 'rate_limited';
          return jsonResp({ total: codes.length, start, limit, results: batchResults });
        }
      }
    }
  }

  return jsonResp({ total: codes.length, start, limit, batch: batch.length, results: batchResults });
}

async function generateMockup(apiKey, product, imageUrl, config) {
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
    throw new Error('429 rate limited: ' + (createData.error?.message || ''));
  }
  if (createData.code !== 200 || !createData.result?.task_key) {
    throw new Error('create-task failed: ' + JSON.stringify(createData).slice(0, 200));
  }

  const taskKey = createData.result.task_key;

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
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
      throw new Error('No mockup URL in completed result');
    }
    if (statusData.result?.status === 'failed') {
      throw new Error('Mockup generation failed');
    }
  }
  throw new Error('Mockup generation timed out');
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
