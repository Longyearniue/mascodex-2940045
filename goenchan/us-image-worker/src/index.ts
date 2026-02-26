interface Env {
  AI: Ai;
  IMAGES: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }

    try {
      const { zipCode, prompt, variant } = await request.json() as {
        zipCode?: string;
        prompt?: string;
        variant?: number;
      };

      if (!zipCode || !prompt || variant === undefined) {
        return Response.json({ error: 'Missing zipCode, prompt, or variant' }, { status: 400 });
      }

      // Validate ZIP format
      if (!/^\d{5}$/.test(zipCode)) {
        return Response.json({ error: 'Invalid ZIP code format' }, { status: 400 });
      }

      const key = `us/${zipCode}_0${variant}.png`;

      // Check if already exists (skip)
      const existing = await env.IMAGES.head(key);
      if (existing) {
        return Response.json({ success: true, key, skipped: true });
      }

      // Generate image with SDXL
      const result = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
        prompt,
      }) as ReadableStream;

      // Store in R2
      await env.IMAGES.put(key, result, {
        httpMetadata: { contentType: 'image/png' },
      });

      return Response.json({ success: true, key });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Response.json({ error: message }, { status: 500 });
    }
  },
};
