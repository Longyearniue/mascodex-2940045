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
