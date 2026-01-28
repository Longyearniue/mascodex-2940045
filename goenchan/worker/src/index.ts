import { handleFounderVisibility } from './handlers/founderVisibility';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/api/founder-visibility' && request.method === 'POST') {
      const response = await handleFounderVisibility(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    if (url.pathname === '/api/outreach/generate' && request.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Not implemented' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
