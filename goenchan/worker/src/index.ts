import { handleFounderVisibility } from './handlers/founderVisibility';
import { handleOutreachGenerate } from './handlers/outreachGenerate';
import { handleSalesLetter } from './handlers/salesLetter';
import { handleBulkCrawler } from './handlers/bulkCrawler';
import { getSharedMappings, addSharedMappings } from './handlers/sharedMappings';
import { handleDebugAnalysis } from './handlers/debugAnalysis';
import { handleVerifyResults } from './handlers/verifyResults';
import { handleFormVerify } from './handlers/formVerify';
import { getCommunityMappings } from './handlers/communityMappings';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
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
      const response = await handleSalesLetter(request, env);
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
      const response = await handleSalesLetter(request, env);
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

    // Shared mappings endpoints
    if (url.pathname === '/shared-mappings' && request.method === 'GET') {
      return await getSharedMappings(env, request);
    }

    if (url.pathname === '/shared-mappings' && request.method === 'POST') {
      return await addSharedMappings(request, env);
    }

    // Debug analysis endpoint
    if (url.pathname === '/debug-analysis' && request.method === 'POST') {
      const response = await handleDebugAnalysis(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // Verify results endpoints
    if (url.pathname === '/verify-results' && (request.method === 'POST' || request.method === 'GET')) {
      return await handleVerifyResults(request, env);
    }

    // Community mappings endpoint
    if (url.pathname === '/community-mappings' && request.method === 'GET') {
      return await getCommunityMappings(request, env);
    }

    // Form verify (DeepSeek proxy)
    if (url.pathname === '/form-verify' && request.method === 'POST') {
      const response = await handleFormVerify(request, env);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // Proxy fetch endpoint (Chrome extension Service Worker CORS workaround)
    if (url.pathname === '/proxy-fetch' && request.method === 'GET') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      try {
        const resp = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }, redirect: 'follow' });
        const text = await resp.text();
        return new Response(JSON.stringify({ ok: resp.ok, status: resp.status, html: text }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
