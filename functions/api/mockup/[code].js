// On-demand mockup generation via Printful API with R2 caching
// GET /api/mockup/{code}?product=tshirt
// Returns cached mockup from R2, or generates via Printful API if not cached
export async function onRequestGet(context) {
  const { code } = context.params;
  const url = new URL(context.request.url);
  const product = url.searchParams.get('product') || 'tshirt';

  if (!/^\d{7}$/.test(code)) {
    return new Response('Not Found', { status: 404 });
  }

  const validProducts = ['tshirt', 'mug', 'tote', 'poster', 'pillow'];
  if (!validProducts.includes(product)) {
    return new Response('Invalid product', { status: 400 });
  }

  const debug = url.searchParams.get('debug') === '1';

  // Check R2 cache first (skip in debug mode)
  const cacheKey = `mockups/${code}_${product}.jpg`;
  if (!debug) {
    const cached = await context.env.CHAR_R2.get(cacheKey);
    if (cached) {
      return new Response(cached.body, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=2592000',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  // No cache - check if Printful API key is configured
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  if (!apiKey) {
    return new Response('Not found', { status: 404 });
  }

  // Generate via Printful API
  try {
    // Use _02 (landscape scene) for mug, _03 (studio portrait) for others
    const imgVariant = product === 'mug' ? '02' : '03';
    const charImgUrl = `https://img.mascodex.com/${code}_${imgVariant}.png?v=3`;
    const result = await generateMockup(apiKey, product, charImgUrl, debug);

    // Debug mode returns JSON with all available mockup URLs
    if (debug && typeof result === 'object' && result.mockups) {
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const imgBuffer = result;

    // Cache in R2 (both buckets: CHAR_R2 for API reads, IMG_R2 for img.mascodex.com)
    const putOpts = { httpMetadata: { contentType: 'image/jpeg' } };
    await context.env.CHAR_R2.put(cacheKey, imgBuffer, putOpts);
    if (context.env.IMG_R2) {
      await context.env.IMG_R2.put(cacheKey, new Uint8Array(imgBuffer), putOpts);
    }

    return new Response(imgBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Printful product configs with print area dimensions
// Mug: print area wraps around cylinder (2700px). Mockup camera shows center-right area.
// Position left ~900 to center character in visible zone.
const PRINTFUL_PRODUCTS = {
  tshirt:  { id: 71,  variantId: 4012, placement: 'front',
    area: { area_width: 1800, area_height: 2400, width: 1800, height: 2400, top: 0, left: 0 } },
  mug:     { id: 19,  variantId: 16586, placement: 'default',
    area: { area_width: 2700, area_height: 1050, width: 1050, height: 1050, top: 0, left: 825 } },
  tote:    { id: 274, variantId: 9040, placement: 'default',
    area: { area_width: 3150, area_height: 5550, width: 3150, height: 5550, top: 0, left: 0 } },
  poster:  { id: 1,   variantId: 19527, placement: 'default',
    area: { area_width: 3600, area_height: 3600, width: 3600, height: 3600, top: 0, left: 0 } },
  pillow:  { id: 83,  variantId: 4532, placement: 'front',
    area: { area_width: 2850, area_height: 2850, width: 2850, height: 2850, top: 0, left: 0 } },
};

async function generateMockup(apiKey, product, imageUrl, debug = false) {
  const config = PRINTFUL_PRODUCTS[product];
  if (!config) throw new Error('Unknown product: ' + product);

  // Step 1: Create mockup generation task
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
  if (createData.code !== 200 || !createData.result?.task_key) {
    throw new Error('Printful create-task failed: ' + JSON.stringify(createData));
  }

  const taskKey = createData.result.task_key;

  // Step 2: Poll for result (max ~30 seconds)
  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));

    const statusResp = await fetch(
      `https://api.printful.com/mockup-generator/task?task_key=${taskKey}`,
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'X-PF-Store-Id': '10678445' } }
    );

    const statusData = await statusResp.json();

    if (statusData.result?.status === 'completed') {
      const mockups = statusData.result?.mockups;
      if (mockups && mockups.length > 0) {
        // If debug mode, return all available URLs
        if (debug) {
          return { mockups: mockups.map(m => ({
            mockup_url: m.mockup_url,
            extra: m.extra?.map(e => ({ url: e.url, title: e.title })),
          }))};
        }
        const mockupUrl = mockups[0].mockup_url || mockups[0].extra?.[0]?.url;
        if (mockupUrl) {
          const imgResp = await fetch(mockupUrl);
          return await imgResp.arrayBuffer();
        }
      }
      throw new Error('No mockup URL in completed result');
    }

    if (statusData.result?.status === 'failed') {
      throw new Error('Printful mockup generation failed');
    }
  }

  throw new Error('Mockup generation timed out (30s)');
}
