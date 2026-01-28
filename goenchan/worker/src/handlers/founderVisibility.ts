import { fetchWithTimeout } from '../utils/fetcher';
import { extractLinks, containsFounderKeywords, hasTopMessagePage, isLargeChain } from '../utils/parser';
import { checkRobotsTxt } from '../utils/robots';

export interface FounderVisibilityRequest {
  url: string;
}

export interface FounderVisibilityResponse {
  url: string;
  founder_visibility: boolean;
  evidence: string[];
  checked_urls: string[];
  hit_keywords: string[];
}

const MAX_PAGES = 5;

// Common Japanese paths to check
const COMMON_PATHS = [
  '/company',
  '/about',
  '/message',
  '/greeting',
  '/profile',
  '/ceo',
  '/company/',
  '/about/',
  '/message/',
  '/greeting/',
  '/profile/',
  '/ceo/',
];

export async function handleFounderVisibility(
  request: Request
): Promise<Response> {
  try {
    const body: FounderVisibilityRequest = await request.json();

    if (!body.url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL
    let baseUrl: URL;
    try {
      baseUrl = new URL(body.url);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check robots.txt
    const canCrawl = await checkRobotsTxt(baseUrl.origin);
    if (!canCrawl) {
      return new Response(
        JSON.stringify({
          url: body.url,
          founder_visibility: false,
          evidence: [],
          checked_urls: [],
          hit_keywords: [],
        } as FounderVisibilityResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const checkedUrls: string[] = [];
    const evidence: string[] = [];
    const hitKeywords: string[] = [];
    let hasTopMessage = false;
    let hasChainSignal = false;
    let keywordsAdded = false;

    // Step 1: Fetch the main page
    const mainResult = await fetchWithTimeout(body.url);
    checkedUrls.push(body.url);

    if (!mainResult.success || !mainResult.html) {
      return new Response(
        JSON.stringify({
          url: body.url,
          founder_visibility: false,
          evidence: [],
          checked_urls: checkedUrls,
          hit_keywords: [],
        } as FounderVisibilityResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check main page
    if (containsFounderKeywords(mainResult.html)) {
      if (hasTopMessagePage(body.url)) {
        hasTopMessage = true;
        evidence.push(body.url);
        if (!keywordsAdded) {
          hitKeywords.push('代表挨拶', '社長挨拶', '代表メッセージ', '代表取締役', 'CEO', 'Founder');
          keywordsAdded = true;
        }
      }
    }

    // Check for large chain signals
    if (isLargeChain(body.url, mainResult.html)) {
      hasChainSignal = true;
    }

    // Step 2: Extract candidate links from main page
    const { candidateLinks } = extractLinks(mainResult.html, body.url);

    // Step 3: Add common paths
    const commonUrls = COMMON_PATHS.map(path =>
      new URL(path, baseUrl.origin).href
    );

    // Combine and deduplicate
    const urlsToCheck = Array.from(
      new Set([...candidateLinks, ...commonUrls])
    ).filter(url => !checkedUrls.includes(url));

    // Step 4: Fetch up to 4 more pages (total 5 with main page)
    const remainingSlots = MAX_PAGES - 1;
    const urlsToFetch = urlsToCheck.slice(0, remainingSlots);

    for (const url of urlsToFetch) {
      if (checkedUrls.length >= MAX_PAGES) break;

      const result = await fetchWithTimeout(url);
      checkedUrls.push(url);

      if (result.success && result.html) {
        // Check for chain signals
        if (isLargeChain(url, result.html)) {
          hasChainSignal = true;
        }

        // Check for founder keywords and top message page
        if (containsFounderKeywords(result.html)) {
          if (hasTopMessagePage(url)) {
            hasTopMessage = true;
            evidence.push(url);
            if (!keywordsAdded) {
              hitKeywords.push('代表挨拶', '社長挨拶', '代表メッセージ', '代表取締役', 'CEO', 'Founder');
              keywordsAdded = true;
            }
          }
        }
      }
    }

    // Final decision: PASS only if has top message AND NOT large chain
    const foundVisibility = hasTopMessage && !hasChainSignal;

    const response: FounderVisibilityResponse = {
      url: body.url,
      founder_visibility: foundVisibility,
      evidence,
      checked_urls: checkedUrls,
      hit_keywords: foundVisibility ? hitKeywords : [],
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
