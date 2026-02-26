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
      const { pinCode, prompt, negative_prompt, variant } = await request.json() as {
        pinCode?: string;
        prompt?: string;
        negative_prompt?: string;
        variant?: number;
      };

      if (!pinCode || !prompt || variant === undefined) {
        return Response.json({ error: 'Missing pinCode, prompt, or variant' }, { status: 400 });
      }

      // Validate 6-digit PIN code format
      if (!/^\d{6}$/.test(pinCode)) {
        return Response.json({ error: 'Invalid PIN code format' }, { status: 400 });
      }

      const key = `in/${pinCode}_0${variant}.png`;

      // Check if already exists (skip)
      const existing = await env.IMAGES.head(key);
      if (existing) {
        return Response.json({ success: true, key, skipped: true });
      }

      // Generate image with SDXL
      const aiInput: Record<string, string> = { prompt };
      if (negative_prompt) {
        aiInput.negative_prompt = negative_prompt;
      }
      const result = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', aiInput) as ReadableStream;

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
