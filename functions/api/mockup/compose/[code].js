// Custom image compositing API - no Printful dependency
// GET /api/mockup/compose/{code}?product=tshirt
// Composites character image onto product template using alpha blending
// Caches result in R2 for instant serving
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
import { decode as decodePng } from 'fast-png';
import { encode as encodeJpeg } from 'jpeg-js';

// Positioning calibrated from Printful reference mockups (8920871)
// All coords are fractions of the 1000x1000 template
const PRODUCT_CONFIGS = {
  tshirt: {
    template: 'templates/tshirt.png',
    // Square print centered on chest
    char: { top: 0.21, left: 0.31, width: 0.38, height: 0.38 },
    outputSize: 800,
  },
  mug: {
    template: 'templates/mug.png',
    // Centered on mug body (left of handle)
    char: { top: 0.13, left: 0.12, width: 0.42, height: 0.68 },
    outputSize: 800,
  },
  tote: {
    template: 'templates/tote.png',
    // Fills front face below handles
    char: { top: 0.195, left: 0.075, width: 0.85, height: 0.76 },
    outputSize: 800,
  },
  pillow: {
    template: 'templates/pillow.png',
    // Fills entire pillow face edge-to-edge
    char: { top: 0.065, left: 0.065, width: 0.87, height: 0.87 },
    outputSize: 800,
  },
  poster: {
    template: 'templates/poster.png',
    // Fills the poster rectangle (has drop shadow)
    char: { top: 0.075, left: 0.195, width: 0.62, height: 0.715 },
    outputSize: 800,
  },
};

export async function onRequestGet(context) {
  const { code } = context.params;
  const url = new URL(context.request.url);
  const product = url.searchParams.get('product') || 'tshirt';

  // JP: 7桁, US: 5桁, India: 6桁
  if (!/^\d{5,7}$/.test(code)) {
    return new Response('Not Found', { status: 404 });
  }

  const config = PRODUCT_CONFIGS[product];
  if (!config) {
    return new Response('Invalid product', { status: 400 });
  }

  const force = url.searchParams.get('force') === '1';

  // Check R2 cache first (skip if force)
  const cacheKey = `mockups/${code}_${product}.jpg`;
  if (!force) {
  const cached = await context.env.CHAR_R2.get(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Also check IMG_R2 (img.mascodex.com)
  if (context.env.IMG_R2) {
    const cachedImg = await context.env.IMG_R2.get(cacheKey);
    if (cachedImg) {
      return new Response(cachedImg.body, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }
  } // end if (!force)

  try {
    // Fetch template and character images in parallel
    const [templateObj, charResp] = await Promise.all([
      context.env.IMG_R2.get(config.template),
      fetch(
        code.length === 7
          ? `https://mascodex.com/img/jp/${parseInt(code)}_01.png`   // JP
          : code.length === 5
            ? `https://mascodex.com/img/us/${code}_01.png`           // US
            : `https://mascodex.com/img/in/${code}_01.png`           // India
      ),
    ]);

    if (!templateObj) {
      return new Response('Template not found', { status: 500 });
    }

    const [templateBuf, charBuf] = await Promise.all([
      templateObj.arrayBuffer(),
      charResp.arrayBuffer(),
    ]);

    // Decode PNGs
    const template = decodePng(new Uint8Array(templateBuf));
    const character = decodePng(new Uint8Array(charBuf));

    // Create output canvas (same size as template), fill with white
    const outW = template.width;
    const outH = template.height;
    const output = new Uint8Array(outW * outH * 4);
    // Initialize canvas to white (prevents black areas from transparent pixels)
    for (let i = 0; i < outW * outH; i++) {
      output[i * 4] = 255;
      output[i * 4 + 1] = 255;
      output[i * 4 + 2] = 255;
      output[i * 4 + 3] = 255;
    }

    // Alpha-composite template onto white canvas
    const tData = template.data;
    const tChannels = template.channels || (tData.length / (outW * outH));
    for (let i = 0; i < outW * outH; i++) {
      if (tChannels >= 4) {
        const sa = tData[i * 4 + 3] / 255;
        if (sa < 0.01) continue; // Skip fully transparent
        if (sa > 0.99) {
          // Fully opaque - direct copy
          output[i * 4] = tData[i * 4];
          output[i * 4 + 1] = tData[i * 4 + 1];
          output[i * 4 + 2] = tData[i * 4 + 2];
          output[i * 4 + 3] = 255;
        } else {
          // Alpha blend over white
          output[i * 4] = Math.round(tData[i * 4] * sa + 255 * (1 - sa));
          output[i * 4 + 1] = Math.round(tData[i * 4 + 1] * sa + 255 * (1 - sa));
          output[i * 4 + 2] = Math.round(tData[i * 4 + 2] * sa + 255 * (1 - sa));
          output[i * 4 + 3] = 255;
        }
      } else if (tChannels === 3) {
        output[i * 4] = tData[i * 3];
        output[i * 4 + 1] = tData[i * 3 + 1];
        output[i * 4 + 2] = tData[i * 3 + 2];
        output[i * 4 + 3] = 255;
      }
    }

    // Calculate character placement
    const cx = Math.round(config.char.left * outW);
    const cy = Math.round(config.char.top * outH);
    const cw = Math.round(config.char.width * outW);
    const ch = Math.round(config.char.height * outH);

    // Resize character image using bilinear interpolation and alpha-composite onto output
    const cData = character.data;
    const cChannels = character.channels || (cData.length / (character.width * character.height));
    const srcW = character.width;
    const srcH = character.height;

    // Maintain aspect ratio
    const charAspect = srcW / srcH;
    const boxAspect = cw / ch;
    let drawW, drawH, drawX, drawY;
    if (charAspect > boxAspect) {
      drawW = cw;
      drawH = Math.round(cw / charAspect);
      drawX = cx;
      drawY = cy + Math.round((ch - drawH) / 2);
    } else {
      drawH = ch;
      drawW = Math.round(ch * charAspect);
      drawX = cx + Math.round((cw - drawW) / 2);
      drawY = cy;
    }

    // Bilinear interpolation + alpha compositing
    for (let dy = 0; dy < drawH; dy++) {
      for (let dx = 0; dx < drawW; dx++) {
        const outX = drawX + dx;
        const outY = drawY + dy;
        if (outX < 0 || outX >= outW || outY < 0 || outY >= outH) continue;

        // Source coordinates (float)
        const sx = (dx / drawW) * srcW;
        const sy = (dy / drawH) * srcH;
        const sx0 = Math.floor(sx);
        const sy0 = Math.floor(sy);
        const sx1 = Math.min(sx0 + 1, srcW - 1);
        const sy1 = Math.min(sy0 + 1, srcH - 1);
        const fx = sx - sx0;
        const fy = sy - sy0;

        // Bilinear sample
        let r = 0, g = 0, b = 0, a = 0;
        for (const [px, py, w] of [
          [sx0, sy0, (1 - fx) * (1 - fy)],
          [sx1, sy0, fx * (1 - fy)],
          [sx0, sy1, (1 - fx) * fy],
          [sx1, sy1, fx * fy],
        ]) {
          const idx = (py * srcW + px) * cChannels;
          r += cData[idx] * w;
          g += cData[idx + 1] * w;
          b += cData[idx + 2] * w;
          a += (cChannels >= 4 ? cData[idx + 3] : 255) * w;
        }

        // Alpha compositing (source over)
        const sa = a / 255;
        if (sa < 0.01) continue;

        const oi = (outY * outW + outX) * 4;
        const da = output[oi + 3] / 255;
        const outAlpha = sa + da * (1 - sa);

        if (outAlpha > 0) {
          output[oi]     = Math.round((r * sa + output[oi]     * da * (1 - sa)) / outAlpha);
          output[oi + 1] = Math.round((g * sa + output[oi + 1] * da * (1 - sa)) / outAlpha);
          output[oi + 2] = Math.round((b * sa + output[oi + 2] * da * (1 - sa)) / outAlpha);
          output[oi + 3] = Math.round(outAlpha * 255);
        }
      }
    }

    // Encode as JPEG
    const jpegData = encodeJpeg({
      data: output,
      width: outW,
      height: outH,
    }, 88);

    const jpegBuffer = jpegData.data.buffer;

    // Cache in both R2 buckets
    const putOpts = { httpMetadata: { contentType: 'image/jpeg' } };
    await Promise.all([
      context.env.CHAR_R2.put(cacheKey, jpegBuffer, putOpts),
      context.env.IMG_R2 ? context.env.IMG_R2.put(cacheKey, new Uint8Array(jpegBuffer), putOpts) : null,
    ]);

    return new Response(jpegBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
