import { fetchWithTimeout } from '../utils/fetcher';
import { extractLinks, isLargeChain, extractContactPages, calculateContentScore } from '../utils/parser';
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
  top_message_pages: string[];
  chain_signals: string[];
  contact_pages: string[];
  score: number;
  score_signals: string[];
  is_chain: boolean;
  contact_ok: boolean;
  goenchan_pass: boolean;
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
          top_message_pages: [],
          chain_signals: [],
          contact_pages: [],
          score: 0,
          score_signals: [],
          is_chain: false,
          contact_ok: false,
          goenchan_pass: false,
        } as FounderVisibilityResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const checkedUrls: string[] = [];
    const evidence: string[] = [];
    const hitKeywords: string[] = [];
    const topMessagePages: string[] = [];
    const chainSignals: Set<string> = new Set();
    const contactPages: Set<string> = new Set();
    const scoreSignals: Set<string> = new Set();
    let totalScore = 0;
    let hasChainSignal = false;

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
          top_message_pages: [],
          chain_signals: [],
          contact_pages: [],
          score: 0,
          score_signals: [],
          is_chain: false,
          contact_ok: false,
          goenchan_pass: false,
        } as FounderVisibilityResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate score from main page
    const mainScoreResult = calculateContentScore(mainResult.html);
    totalScore += mainScoreResult.score;
    mainScoreResult.signals.forEach(signal => scoreSignals.add(signal));

    // Check for large chain signals
    const chainResult = isLargeChain(body.url, mainResult.html);
    if (chainResult.isChain) {
      hasChainSignal = true;
    }
    chainResult.signals.forEach(signal => chainSignals.add(signal));

    // Extract contact pages from main page
    const mainContactPages = extractContactPages(mainResult.html, body.url);
    mainContactPages.forEach(page => contactPages.add(page));

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
        // Calculate score from this page
        const pageScoreResult = calculateContentScore(result.html);
        totalScore += pageScoreResult.score;
        pageScoreResult.signals.forEach(signal => scoreSignals.add(signal));

        // Check for chain signals
        const chainResult = isLargeChain(url, result.html);
        if (chainResult.isChain) {
          hasChainSignal = true;
        }
        chainResult.signals.forEach(signal => chainSignals.add(signal));

        // Extract contact pages
        const pageContactPages = extractContactPages(result.html, url);
        pageContactPages.forEach(page => contactPages.add(page));
      }
    }

    // New final decision logic: goenchan_pass = (!is_chain) && (score >= 2)
    const contactPagesArray = Array.from(contactPages).slice(0, 10); // Limit to 10
    const isChain = hasChainSignal;
    const contactOk = contactPagesArray.length > 0;
    const goenchanPass = !isChain && totalScore >= 2;

    // Keep legacy founder_visibility for backward compatibility
    const foundVisibility = goenchanPass;

    const response: FounderVisibilityResponse = {
      url: body.url,
      founder_visibility: foundVisibility,
      evidence,
      checked_urls: checkedUrls,
      hit_keywords: foundVisibility ? hitKeywords : [],
      top_message_pages: topMessagePages,
      chain_signals: Array.from(chainSignals),
      contact_pages: contactPagesArray,
      score: totalScore,
      score_signals: Array.from(scoreSignals),
      is_chain: isChain,
      contact_ok: contactOk,
      goenchan_pass: goenchanPass,
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
