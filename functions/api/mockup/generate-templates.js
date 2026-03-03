// Generate blank product template images via Printful API and store in R2.
// POST /api/mockup/generate-templates
// POST /api/mockup/generate-templates?product=tshirt  (single product)
export async function onRequestPost(context) {
  const apiKey = context.env.PRINTFUL_API_TOKEN;
  if (!apiKey) {
    return jsonResp({ error: 'PRINTFUL_API_TOKEN not configured' }, 500);
  }

  const url = new URL(context.request.url);
  const single = url.searchParams.get('product');
  const force = url.searchParams.get('force') === '1';

  // Product configs with print area dimensions from Printful printfiles API
  const PRODUCTS = {
    tshirt: {
      id: 71, variantId: 4012, placement: 'front',
      area: { area_width: 1800, area_height: 2400, width: 1800, height: 1800, top: 300, left: 0 },
    },
    mug: {
      id: 19, variantId: 1320, placement: 'default',
      area: { area_width: 2700, area_height: 1050, width: 900, height: 900, top: 75, left: 200 },
    },
    tote: {
      id: 274, variantId: 9039, placement: 'default',
      area: { area_width: 3150, area_height: 5550, width: 2400, height: 2400, top: 1000, left: 375 },
    },
    poster: {
      id: 1, variantId: 4464, placement: 'default',
      area: { area_width: 3600, area_height: 3600, width: 2800, height: 2800, top: 400, left: 400 },
    },
    pillow: {
      id: 83, variantId: 4532, placement: 'front',
      area: { area_width: 2850, area_height: 2850, width: 2200, height: 2200, top: 325, left: 325 },
    },
  };

  // White placeholder image hosted on our CDN (1px white, Printful scales it)
  const WHITE_IMG = 'https://placehold.co/2000x2000/ffffff/ffffff.png';

  const toGenerate = single ? { [single]: PRODUCTS[single] } : PRODUCTS;
  const results = {};

  for (const [key, config] of Object.entries(toGenerate)) {
    if (!config) { results[key] = { status: 'invalid_product' }; continue; }

    try {
      const r2Key = `templates/${key}.png`;

      // Skip if already exists (unless force)
      if (!force) {
        const existing = await context.env.IMG_R2.head(r2Key);
        if (existing) {
          results[key] = { status: 'exists', r2Key };
          continue;
        }
      }

      // Create Printful mockup task with position data
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
            format: 'png',
            files: [{
              placement: config.placement,
              image_url: WHITE_IMG,
              position: config.area,
            }],
          }),
        }
      );

      const createData = await createResp.json();
      if (createData.code !== 200 || !createData.result?.task_key) {
        results[key] = { status: 'error', detail: createData.error?.message || 'unknown', raw: JSON.stringify(createData).slice(0, 500) };
        continue;
      }

      // Poll for result (max ~50 seconds)
      const taskKey = createData.result.task_key;
      let mockupUrl = null;

      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 2500));
        const statusResp = await fetch(
          `https://api.printful.com/mockup-generator/task?task_key=${taskKey}`,
          { headers: { 'Authorization': `Bearer ${apiKey}`, 'X-PF-Store-Id': '10678445' } }
        );
        const statusData = await statusResp.json();

        if (statusData.result?.status === 'completed') {
          const mockups = statusData.result?.mockups;
          if (mockups?.length > 0) {
            mockupUrl = mockups[0].mockup_url;
            // Also try extra mockups (different angles)
            if (!mockupUrl && mockups[0].extra?.length > 0) {
              mockupUrl = mockups[0].extra[0].url;
            }
          }
          break;
        }
        if (statusData.result?.status === 'failed') {
          results[key] = { status: 'generation_failed' };
          break;
        }
      }

      if (mockupUrl) {
        const imgResp = await fetch(mockupUrl);
        const imgBuffer = await imgResp.arrayBuffer();
        await context.env.IMG_R2.put(r2Key, imgBuffer, {
          httpMetadata: { contentType: 'image/png' },
        });
        results[key] = { status: 'generated', r2Key, size: imgBuffer.byteLength, url: mockupUrl };
      } else if (!results[key]) {
        results[key] = { status: 'timeout' };
      }
    } catch (err) {
      results[key] = { status: 'error', detail: err.message };
    }
  }

  return jsonResp({ success: true, results });
}

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
