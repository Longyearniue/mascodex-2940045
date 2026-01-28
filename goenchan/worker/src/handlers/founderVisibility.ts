import { fetchWithTimeout } from '../utils/fetcher';
import { extractLinks, containsFounderKeywords } from '../utils/parser';
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
    let foundVisibility = false;

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

    // Check main page for keywords
    if (containsFounderKeywords(mainResult.html)) {
      foundVisibility = true;
      evidence.push(body.url);
      hitKeywords.push('代表挨拶', 'CEO', 'Founder');
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
        if (containsFounderKeywords(result.html)) {
          foundVisibility = true;
          evidence.push(url);
          if (hitKeywords.length === 0) {
            hitKeywords.push('代表挨拶', 'CEO', 'Founder');
          }
        }
      }
    }

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
