/**
 * Bulk Crawler Handler
 * Crawls multiple websites in parallel and generates form field mappings
 */

import { detectPattern } from '../utils/patternDetector';
import { generateMapping, GeneratedMapping } from '../utils/mappingGenerator';
import { findContactLink, extractFormFields } from '../utils/htmlParser';

interface BulkCrawlerRequest {
  urls: string[];
}

interface CrawlResult {
  url: string;
  success: boolean;
  error?: string;
  mapping?: GeneratedMapping;
  contactPage?: string;
}

interface BulkCrawlerResponse {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: CrawlResult[];
  mappings: GeneratedMapping[];
  errors: string[];
}

/**
 * Crawl a single site with timeout
 * @param url - URL to crawl
 * @param timeoutMs - Timeout in milliseconds (default 5000)
 * @returns CrawlResult with success status and mapping if successful
 */
async function crawlSingleSite(
  url: string,
  timeoutMs: number = 5000
): Promise<CrawlResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      return {
        url,
        success: false,
        error: 'Invalid URL format',
      };
    }

    // Fetch the main page
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GoenchanBot/1.0)',
      },
    });

    if (!response.ok) {
      return {
        url,
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();

    // Try to find contact page
    const contactPage = findContactLink(html, url);
    let formHtml = html;

    // If contact page found, fetch it
    if (contactPage && contactPage !== url) {
      try {
        const contactResponse = await fetch(contactPage, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; GoenchanBot/1.0)',
          },
        });

        if (contactResponse.ok) {
          formHtml = await contactResponse.text();
        }
      } catch (e) {
        // If contact page fails, just use main page
        console.warn(`Failed to fetch contact page ${contactPage}:`, e);
      }
    }

    // Extract form fields
    const fields = extractFormFields(formHtml);

    if (fields.length === 0) {
      return {
        url,
        success: false,
        error: 'No form fields found',
        contactPage: contactPage || undefined,
      };
    }

    // Detect pattern
    const pattern = detectPattern(fields);

    if (!pattern) {
      return {
        url,
        success: false,
        error: 'No matching pattern detected',
        contactPage: contactPage || undefined,
      };
    }

    // Generate mapping
    const mapping = generateMapping(url, pattern);

    if (!mapping) {
      return {
        url,
        success: false,
        error: 'Failed to generate mapping',
        contactPage: contactPage || undefined,
      };
    }

    return {
      url,
      success: true,
      mapping,
      contactPage: contactPage || undefined,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        url,
        success: false,
        error: `Timeout after ${timeoutMs}ms`,
      };
    }

    return {
      url,
      success: false,
      error: error.message || 'Unknown error',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Main bulk crawler handler
 * Processes multiple URLs in parallel with limits
 */
export async function handleBulkCrawler(request: Request): Promise<Response> {
  try {
    // Parse request body
    const body = await request.json() as BulkCrawlerRequest;

    // Validate request
    if (!body.urls || !Array.isArray(body.urls)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: urls array required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Limit to 50 URLs max
    if (body.urls.length > 50) {
      return new Response(
        JSON.stringify({ error: 'Maximum 50 URLs allowed per request' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (body.urls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one URL required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Process URLs in parallel with limit of 10 concurrent requests
    const maxConcurrent = 10;
    const results: CrawlResult[] = [];

    for (let i = 0; i < body.urls.length; i += maxConcurrent) {
      const batch = body.urls.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(url => crawlSingleSite(url));
      const batchResults = await Promise.allSettled(batchPromises);

      // Extract results from settled promises
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Handle promise rejection (shouldn't happen as crawlSingleSite catches errors)
          results.push({
            url: 'unknown',
            success: false,
            error: result.reason?.message || 'Promise rejected',
          });
        }
      }
    }

    // Compile response
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    const mappings = successfulResults
      .map(r => r.mapping)
      .filter((m): m is GeneratedMapping => m !== undefined);

    const errors = failedResults.map(r => `${r.url}: ${r.error}`);

    const response: BulkCrawlerResponse = {
      totalProcessed: results.length,
      successCount: successfulResults.length,
      failureCount: failedResults.length,
      results,
      mappings,
      errors,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Bulk crawler error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
