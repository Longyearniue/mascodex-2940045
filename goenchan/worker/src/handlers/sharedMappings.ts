/**
 * Shared Mappings Handler
 * Allows users to share and retrieve form field mappings
 */

export interface SharedMapping {
  url: string;
  pattern: string;
  confidence: number;
  mapping: {
    [key: string]: {
      selector: string;
      confidence: number;
    };
  };
  addedAt?: number;
  addedBy?: string;
}

export interface SharedMappingsResponse {
  success: boolean;
  mappings?: { [url: string]: SharedMapping };
  count?: number;
  error?: string;
}

const SHARED_MAPPINGS_KEY = 'shared_mappings_v1';
const MIN_CONFIDENCE = 50; // Only share high-quality mappings

/**
 * GET /shared-mappings
 * Retrieve all shared mappings
 */
export async function getSharedMappings(env: any): Promise<Response> {
  try {
    const stored = await env.SHARED_MAPPINGS?.get(SHARED_MAPPINGS_KEY, { type: 'json' });
    const mappings = stored || {};

    return new Response(JSON.stringify({
      success: true,
      mappings,
      count: Object.keys(mappings).length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Failed to get shared mappings:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

/**
 * POST /shared-mappings
 * Add new mappings to shared pool
 */
export async function addSharedMappings(request: Request, env: any): Promise<Response> {
  try {
    const body = await request.json() as { mappings: { [url: string]: SharedMapping } };

    if (!body.mappings || typeof body.mappings !== 'object') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request: mappings object required'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Get existing mappings
    const stored = await env.SHARED_MAPPINGS?.get(SHARED_MAPPINGS_KEY, { type: 'json' });
    const existingMappings = stored || {};

    // Filter and merge new mappings
    let addedCount = 0;
    let skippedCount = 0;

    for (const [url, mapping] of Object.entries(body.mappings)) {
      // Quality filter: only accept confidence >= MIN_CONFIDENCE
      if (mapping.confidence >= MIN_CONFIDENCE / 100) {
        // Add timestamp
        const enhancedMapping = {
          ...mapping,
          addedAt: Date.now()
        };

        // Merge (new mappings override existing if higher confidence)
        if (!existingMappings[url] || mapping.confidence > existingMappings[url].confidence) {
          existingMappings[url] = enhancedMapping;
          addedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    // Save merged mappings
    if (addedCount > 0) {
      await env.SHARED_MAPPINGS?.put(SHARED_MAPPINGS_KEY, JSON.stringify(existingMappings));
    }

    return new Response(JSON.stringify({
      success: true,
      added: addedCount,
      skipped: skippedCount,
      total: Object.keys(existingMappings).length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('Failed to add shared mappings:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
