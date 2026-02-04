/**
 * Bulk Crawler Handler
 * Crawls multiple websites in parallel and generates form field mappings
 */

import { detectPattern } from '../utils/patternDetector';
import { generateMapping, GeneratedMapping } from '../utils/mappingGenerator';
import { findContactLink, findContactLinks, extractFormFields } from '../utils/htmlParser';

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
 * Try to extract forms from a single page
 * @param pageUrl - URL of the page to check
 * @param controller - AbortController for timeout
 * @returns { html, fields } if forms found, null otherwise
 */
async function tryExtractForms(
  pageUrl: string,
  controller: AbortController
): Promise<{ html: string; fields: any[] } | null> {
  try {
    const response = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GoenchanBot/1.0)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const fields = extractFormFields(html);

    if (fields.length > 0) {
      return { html, fields };
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Crawl a single site with very deep crawling (up to 5 levels)
 * Level 1: Homepage
 * Level 2: Up to 10 contact page candidates from homepage
 * Level 3: Sub-pages from each contact page
 * Level 4: Sub-sub-pages from sub-pages
 * Level 5: Sub-sub-sub-pages (last resort)
 *
 * This aggressive approach maximizes success rate at the cost of speed.
 * Suitable for batch processing where thoroughness matters more than speed.
 *
 * @param url - URL to crawl
 * @param timeoutMs - Timeout in milliseconds (default 45000 for very deep crawling)
 * @returns CrawlResult with success status and mapping if successful
 */
async function crawlSingleSite(
  url: string,
  timeoutMs: number = 45000
): Promise<CrawlResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const visitedUrls = new Set<string>(); // Track visited URLs to avoid loops
  let pagesChecked = 0;

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

    // Helper to check a single URL
    const checkUrl = async (checkUrl: string, depth: number): Promise<CrawlResult | null> => {
      if (visitedUrls.has(checkUrl)) return null;
      visitedUrls.add(checkUrl);
      pagesChecked++;

      // Small delay between requests to be polite
      if (pagesChecked > 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const result = await tryExtractForms(checkUrl, controller);
      if (result) {
        const pattern = detectPattern(result.fields);
        if (pattern) {
          const mapping = generateMapping(url, pattern);
          if (mapping) {
            return {
              url,
              success: true,
              mapping,
              contactPage: checkUrl,
            };
          }
        }
        return result;
      }
      return null;
    };

    // LEVEL 0: Try common contact page paths FIRST (most efficient)
    // These are the most common locations for contact forms
    const baseUrlObj = new URL(url);
    const baseUrl = `${baseUrlObj.protocol}//${baseUrlObj.hostname}`;

    const commonPaths = [
      '/contact',
      '/contact/',
      '/contact.html',
      '/contact.php',
      '/inquiry',
      '/inquiry/',
      '/inquiry.html',
      '/form',
      '/form/',
      '/toiawase',
      '/otoiawase',
      '/お問い合わせ',
      '/お問合せ',
      '/お問合わせ/',
      '/contact/index.html',
      '/inquiry/index.html',
      '/form/index.html',
      '/contactus',
      '/contact-us',
      '/contact_us.html',
      '/support',
      '/support/',
      '/request',
      '/mailform',
      '/mailform/',
    ];

    for (const path of commonPaths) {
      const directUrl = baseUrl + path;
      const directResult = await checkUrl(directUrl, 0);
      if (directResult?.success) {
        return directResult;
      }
    }

    // LEVEL 1: Try homepage
    const homepageResult = await checkUrl(url, 1);
    if (homepageResult?.success) {
      return homepageResult;
    }

    // Get homepage HTML for link extraction
    let homepageHtml = homepageResult?.html;
    if (!homepageHtml) {
      try {
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

        homepageHtml = await response.text();
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
          error: error.message || 'Failed to fetch homepage',
        };
      }
    }

    // LEVEL 2: Try up to 10 contact page candidates from homepage
    const level2Links = findContactLinks(homepageHtml, url, 10);

    for (const link2 of level2Links) {
      if (link2 === url) continue;

      const result2 = await checkUrl(link2, 2);
      if (result2?.success) {
        return result2;
      }

      // LEVEL 3: Try sub-pages from this contact page
      if (result2?.html) {
        const level3Links = findContactLinks(result2.html, link2, 5);

        for (const link3 of level3Links) {
          if (visitedUrls.has(link3)) continue;

          const result3 = await checkUrl(link3, 3);
          if (result3?.success) {
            return result3;
          }

          // LEVEL 4: Try sub-sub-pages
          if (result3?.html) {
            const level4Links = findContactLinks(result3.html, link3, 3);

            for (const link4 of level4Links) {
              if (visitedUrls.has(link4)) continue;

              const result4 = await checkUrl(link4, 4);
              if (result4?.success) {
                return result4;
              }

              // LEVEL 5: Last resort - try one more level
              if (result4?.html) {
                const level5Links = findContactLinks(result4.html, link4, 2);

                for (const link5 of level5Links) {
                  if (visitedUrls.has(link5)) continue;

                  const result5 = await checkUrl(link5, 5);
                  if (result5?.success) {
                    return result5;
                  }
                }
              }
            }
          }
        }
      }
    }

    // No forms found at any level
    return {
      url,
      success: false,
      error: `No form fields found (checked ${pagesChecked} pages across 5 levels)`,
      contactPage: level2Links.length > 0 ? level2Links[0] : undefined,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        url,
        success: false,
        error: `Timeout after ${timeoutMs}ms (checked ${pagesChecked} pages)`,
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
