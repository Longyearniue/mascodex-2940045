import { handleFounderVisibility } from './handlers/founderVisibility';
import { handleOutreachGenerate } from './handlers/outreachGenerate';
import { handleSalesLetter } from './handlers/salesLetter';
import { handleBulkCrawler } from './handlers/bulkCrawler';

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
      const response = await handleOutreachGenerate(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    if (url.pathname === '/sales-letter' && request.method === 'POST') {
      const response = await handleSalesLetter(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // Add /crawl as alias for /sales-letter (for Lovable compatibility)
    if (url.pathname === '/crawl' && request.method === 'POST') {
      const response = await handleSalesLetter(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // Bulk crawler endpoint
    if (url.pathname === '/bulk-crawler' && request.method === 'POST') {
      const response = await handleBulkCrawler(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
