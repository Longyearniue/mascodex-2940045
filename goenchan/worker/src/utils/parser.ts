import { parseDocument } from 'htmlparser2';
import { Element, isTag } from 'domhandler';

export interface ParsedLinks {
  candidateLinks: string[];
  allLinks: string[];
}

const CANDIDATE_PATTERNS = [
  'about', 'company', 'message', 'greeting',
  'profile', 'ceo', 'founder',
  '会社概要', '代表', '挨拶', 'メッセージ'
];

export function extractLinks(html: string, baseUrl: string): ParsedLinks {
  const document = parseDocument(html);
  const candidateLinks: Set<string> = new Set();
  const allLinks: Set<string> = new Set();

  function traverse(node: any) {
    if (isTag(node) && node.name === 'a') {
      const href = (node as Element).attribs?.href;
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          const parsedBase = new URL(baseUrl);
          const parsedLink = new URL(absoluteUrl);

          // Only same domain
          if (parsedLink.hostname === parsedBase.hostname) {
            allLinks.add(absoluteUrl);

            // Check if candidate
            const path = parsedLink.pathname.toLowerCase();
            const isCandidate = CANDIDATE_PATTERNS.some(pattern =>
              path.includes(pattern)
            );

            if (isCandidate) {
              candidateLinks.add(absoluteUrl);
            }
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(document);

  return {
    candidateLinks: Array.from(candidateLinks),
    allLinks: Array.from(allLinks),
  };
}

export function containsFounderKeywords(html: string): boolean {
  const keywords = [
    '代表挨拶', '社長挨拶', '代表メッセージ',
    '代表取締役', 'CEO', 'Founder'
  ];

  const lowerHtml = html.toLowerCase();
  return keywords.some(keyword =>
    lowerHtml.includes(keyword.toLowerCase())
  );
}

/**
 * Check if URL is a "top message" type page
 * Required patterns: message, greeting, president, ceo-message, top-message, founder
 */
export function hasTopMessagePage(url: string): boolean {
  const topMessagePatterns = [
    'message',
    'greeting',
    'president',
    'ceo-message',
    'top-message',
    'founder'
  ];

  const lowerPath = new URL(url).pathname.toLowerCase();
  return topMessagePatterns.some(pattern => lowerPath.includes(pattern));
}

export interface ChainDetectionResult {
  isChain: boolean;
  signals: string[];
}

/**
 * Detect if the site is a large retail/restaurant chain
 * Uses STRONG chain signals only and requires at least TWO signals to reduce false positives
 *
 * Strong URL patterns: store, shoplist, tenpo, franchise, fc
 * Strong content keywords: 店舗検索, 店舗一覧, 店舗案内, 店舗を探す, フランチャイズ, FC加盟, 店舗数
 *
 * Requires count(strongSignalsFound) >= 2 to mark as chain
 * Returns both the result and list of detected signals for debugging
 */
export function isLargeChain(url: string, html: string): ChainDetectionResult {
  const strongUrlPatterns = [
    'store',
    'shoplist',
    'tenpo',
    'franchise',
    'fc'
  ];

  const strongContentKeywords = [
    '店舗検索',
    '店舗一覧',
    '店舗案内',
    '店舗を探す',
    'フランチャイズ',
    'fc加盟',
    '店舗数'
  ];

  const lowerPath = new URL(url).pathname.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const lowerHtml = html.toLowerCase();

  const signals: string[] = [];

  // Count URL pattern signals
  for (const pattern of strongUrlPatterns) {
    if (lowerPath.includes(pattern) || lowerUrl.includes(pattern)) {
      signals.push(`URL:${pattern}`);
    }
  }

  // Count content keyword signals
  for (const keyword of strongContentKeywords) {
    if (lowerHtml.includes(keyword.toLowerCase())) {
      signals.push(`KW:${keyword}`);
    }
  }

  // Require at least TWO strong signals to mark as chain
  return {
    isChain: signals.length >= 2,
    signals
  };
}

/**
 * Extract contact page URLs from HTML
 * Searches for links (href or text) containing contact-related keywords
 * Returns up to 10 unique contact page URLs
 */
/**
 * Extract FAX numbers from HTML content
 */
export function extractFaxNumbers(html: string): string[] {
  const faxNumbers: Set<string> = new Set();

  // Remove HTML tags but keep text
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                   .replace(/<[^>]+>/g, ' ');

  // Pattern 1: FAX followed by number (with various formats)
  // Examples: FAX 03-1234-5678, FAX: 03-1234-5678, FAX：03-1234-5678
  const faxPattern1 = /(?:fax|ファックス|ＦＡＸ)[：:\s]*([0-9０-９\-−ー（）()]+)/gi;

  // Pattern 2: Numbers in parentheses with FAX label nearby
  // Example: FAX (03) 1234-5678
  const faxPattern2 = /(?:fax|ファックス|ＦＡＸ)[：:\s]*\(?([0-9０-９]{2,5})\)?[\s\-−ー]*([0-9０-９]{1,4})[\s\-−ー]*([0-9０-９]{4})/gi;

  let match;

  // Extract using pattern 1
  while ((match = faxPattern1.exec(text)) !== null) {
    let number = match[1].trim();
    // Normalize full-width to half-width
    number = number.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    // Remove invalid characters but keep digits, hyphens, and parentheses
    number = number.replace(/[^\d\-()]/g, '');
    // Only accept if it looks like a valid phone number (at least 9 digits)
    if (number.replace(/[^\d]/g, '').length >= 9) {
      faxNumbers.add(number);
    }
  }

  // Extract using pattern 2
  while ((match = faxPattern2.exec(text)) !== null) {
    let number = `${match[1]}-${match[2]}-${match[3]}`;
    // Normalize full-width to half-width
    number = number.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    faxNumbers.add(number);
  }

  return Array.from(faxNumbers);
}

export function extractContactPages(html: string, baseUrl: string, maxResults: number = 10): string[] {
  const contactKeywords = [
    'contact',
    'inquiry',
    'toiawase',
    'otoiawase',
    'form',
    'お問い合わせ',
    'お問合せ',
    '問い合わせ',
    'ご相談',
    '連絡'
  ];

  const document = parseDocument(html);
  const contactPages: Set<string> = new Set();

  function traverse(node: any) {
    if (isTag(node) && node.name === 'a') {
      const href = (node as Element).attribs?.href;
      const text = getText(node).toLowerCase();

      // Check if href or link text contains contact keywords
      const hrefLower = href ? href.toLowerCase() : '';
      const isContactLink = contactKeywords.some(keyword =>
        hrefLower.includes(keyword) || text.includes(keyword.toLowerCase())
      );

      if (isContactLink && href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          const parsedBase = new URL(baseUrl);
          const parsedLink = new URL(absoluteUrl);

          // Only same domain
          if (parsedLink.hostname === parsedBase.hostname) {
            contactPages.add(absoluteUrl);
          }
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  // Helper to extract text from node
  function getText(node: any): string {
    if (node.type === 'text') {
      return node.data || '';
    }
    if ('children' in node) {
      return node.children.map((child: any) => getText(child)).join('');
    }
    return '';
  }

  traverse(document);

  return Array.from(contactPages).slice(0, maxResults);
}

export interface ScoringResult {
  score: number;
  signals: string[];
}

/**
 * Calculate content score based on keyword presence
 * +3 keywords: 代表挨拶, 社長挨拶, 社長メッセージ, ごあいさつ, CEO, Founder, President message
 * +2 keywords: 会社概要, 沿革, 企業理念, ビジョン, ミッション, Our Story
 * +2 keywords: 役員紹介, メンバー, チーム, leadership, management
 */
export function calculateContentScore(html: string): ScoringResult {
  const tier3Keywords = [
    '代表挨拶',
    '社長挨拶',
    '社長メッセージ',
    'ごあいさつ',
    'ceo',
    'founder',
    'president message'
  ];

  const tier2CompanyKeywords = [
    '会社概要',
    '沿革',
    '企業理念',
    'ビジョン',
    'ミッション',
    'our story'
  ];

  const tier2TeamKeywords = [
    '役員紹介',
    'メンバー',
    'チーム',
    'leadership',
    'management'
  ];

  const lowerHtml = html.toLowerCase();
  let score = 0;
  const signals: string[] = [];

  // Check tier 3 (+3 points)
  for (const keyword of tier3Keywords) {
    if (lowerHtml.includes(keyword.toLowerCase())) {
      score += 3;
      signals.push(`KW:${keyword}(+3)`);
      break; // Only count once per tier
    }
  }

  // Check tier 2 company keywords (+2 points)
  for (const keyword of tier2CompanyKeywords) {
    if (lowerHtml.includes(keyword.toLowerCase())) {
      score += 2;
      signals.push(`KW:${keyword}(+2)`);
      break; // Only count once per tier
    }
  }

  // Check tier 2 team keywords (+2 points)
  for (const keyword of tier2TeamKeywords) {
    if (lowerHtml.includes(keyword.toLowerCase())) {
      score += 2;
      signals.push(`KW:${keyword}(+2)`);
      break; // Only count once per tier
    }
  }

  return { score, signals };
}
