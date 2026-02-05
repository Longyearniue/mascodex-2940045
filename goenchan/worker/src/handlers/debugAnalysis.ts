import { fetchWithTimeout } from '../utils/fetcher';
import { performDeepAnalysis } from './salesLetter-deep-analysis';

export async function handleDebugAnalysis(request: Request): Promise<Response> {
  try {
    const body = await request.json() as { url: string };
    const { url } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Fetch the HTML
    const result = await fetchWithTimeout(url, 10000);
    if (!result.success || !result.html) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch URL',
        details: result.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Perform deep analysis
    const analysis = performDeepAnalysis(result.html);

    // Return the raw analysis result
    return new Response(JSON.stringify(analysis, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Debug analysis error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
