# Multi-Page Crawl + Real Content Extraction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract real company information (philosophy, president message, strengths) by crawling multiple pages and filtering out navigation/menu text

**Architecture:**
- Enhance existing `fetchMultiplePages` to crawl more pages (8-10 pages instead of 4)
- Improve `extractRelevantLinks` to find company info pages more aggressively
- Rewrite `extractMeaningfulContent` and related filters to eliminate navigation/menu/button text
- Add HTML structure analysis to identify main content areas vs. navigation
- Replace template-based narrative generation with real content-based generation

**Tech Stack:** TypeScript, htmlparser2, Cloudflare Workers

---

## Task 1: Enhance Multi-Page Crawling

**Files:**
- Modify: `goenchan/worker/src/handlers/salesLetter.ts:15-50`

**Goal:** Increase page crawling from 4 to 10 pages, prioritize company info pages

**Step 1: Update maxPages parameter**

Change line 15:
```typescript
async function fetchMultiplePages(baseUrl: string, maxPages: number = 4): Promise<PageResult[]> {
```

To:
```typescript
async function fetchMultiplePages(baseUrl: string, maxPages: number = 10): Promise<PageResult[]> {
```

**Step 2: Enhance extractRelevantLinks keyword list**

Change lines 58-65 to add more Japanese keywords:
```typescript
const relevantKeywords = [
  // 会社情報
  '会社概要', 'about', 'company', '企業情報', '概要', '会社案内',
  // 代表メッセージ
  '代表挨拶', '社長挨拶', '代表メッセージ', 'message', 'greeting', 'ceo', 'トップメッセージ',
  '社長メッセージ', '院長挨拶', '代表より', 'オーナーより',
  // 理念・ビジョン
  '理念', 'ビジョン', 'ミッション', 'vision', 'mission', 'philosophy', '経営理念',
  '私たちの想い', '私たちの思い', 'コンセプト',
  // 会社紹介
  '私たちについて', '当社について', '弊社について', 'our story', 'about us',
  // サービス・強み
  'サービス', 'service', 'メニュー', 'menu',
  '特徴', '強み', 'strength', 'feature', 'こだわり', '選ばれる理由',
  // 沿革・歴史
  '沿革', '歴史', 'history', '創業', '設立'
];
```

**Step 3: Test crawling with debug endpoint**

Run:
```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/debug-analysis" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}'
```

Expected: Should see more pages being crawled

**Step 4: Commit**

```bash
git add goenchan/worker/src/handlers/salesLetter.ts
git commit -m "feat: increase multi-page crawling to 10 pages with more keywords"
```

---

## Task 2: Add HTML Structure Analysis

**Files:**
- Modify: `goenchan/worker/src/handlers/salesLetter-deep-analysis.ts:68-96`

**Goal:** Identify main content area vs. navigation/header/footer

**Step 1: Add function to detect navigation elements**

Add new function after line 96:
```typescript
// Detect if an element is likely navigation/menu/header/footer
function isNavigationElement(element: Element): boolean {
  const tagName = element.name.toLowerCase();
  const className = element.attribs?.class?.toLowerCase() || '';
  const id = element.attribs?.id?.toLowerCase() || '';
  const role = element.attribs?.role?.toLowerCase() || '';

  // Check tag names
  if (['nav', 'header', 'footer', 'aside'].includes(tagName)) {
    return true;
  }

  // Check class names
  const navClasses = [
    'nav', 'menu', 'header', 'footer', 'sidebar', 'aside',
    'breadcrumb', 'pagination', 'banner', 'toolbar'
  ];
  if (navClasses.some(nav => className.includes(nav))) {
    return true;
  }

  // Check IDs
  const navIds = ['nav', 'menu', 'header', 'footer', 'sidebar'];
  if (navIds.some(nav => id.includes(nav))) {
    return true;
  }

  // Check ARIA roles
  if (['navigation', 'banner', 'contentinfo', 'complementary'].includes(role)) {
    return true;
  }

  return false;
}
```

**Step 2: Add function to detect button/link elements**

Add after the previous function:
```typescript
// Detect if an element is a button or call-to-action link
function isButtonOrCTA(element: Element): boolean {
  const tagName = element.name.toLowerCase();
  const className = element.attribs?.class?.toLowerCase() || '';
  const role = element.attribs?.role?.toLowerCase() || '';

  // Check tag name
  if (tagName === 'button') {
    return true;
  }

  // Check for button/CTA classes
  const buttonClasses = ['btn', 'button', 'cta', 'call-to-action', 'link-button'];
  if (buttonClasses.some(btn => className.includes(btn))) {
    return true;
  }

  // Check ARIA role
  if (role === 'button') {
    return true;
  }

  return false;
}
```

**Step 3: Update extractAllText to skip navigation**

Replace lines 68-96 with:
```typescript
// Extract all text content from element and children (skip navigation)
function extractAllText(node: any): string {
  const textParts: string[] = [];

  function traverse(n: any) {
    // Skip navigation elements
    if (isTag(n)) {
      const element = n as Element;

      // Skip script, style, noscript
      if (element.name === 'script' || element.name === 'style' || element.name === 'noscript') {
        return;
      }

      // Skip navigation/menu/header/footer
      if (isNavigationElement(element)) {
        return;
      }

      // Skip buttons and CTAs
      if (isButtonOrCTA(element)) {
        return;
      }
    }

    if (isText(n)) {
      const text = n.data.trim();
      if (text.length > 0) {
        textParts.push(text);
      }
    }

    if ('children' in n) {
      for (const child of n.children) {
        traverse(child);
      }
    }
  }

  traverse(node);
  return textParts.join(' ');
}
```

**Step 4: Test with debug endpoint**

Run:
```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/debug-analysis" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}' | jq '.philosophy'
```

Expected: Should NOT contain "機能一覧を見る" text

**Step 5: Commit**

```bash
git add goenchan/worker/src/handlers/salesLetter-deep-analysis.ts
git commit -m "feat: add HTML structure analysis to skip navigation elements"
```

---

## Task 3: Enhance Content Filtering

**Files:**
- Modify: `goenchan/worker/src/handlers/salesLetter-deep-analysis.ts:294-334`

**Goal:** Strengthen filters to remove button text, menu items, and promotional content

**Step 1: Add comprehensive navigation text patterns**

Replace the `extractMeaningfulContent` function (lines 294-334) with:
```typescript
// Extract meaningful content (filter out navigation, headers, buttons, etc.)
function extractMeaningfulContent(text: string): string {
  if (!text || text.length < 30) return '';

  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ').trim();

  // Remove CSS patterns
  cleaned = cleaned.replace(/[\w-]+:\s*[^;]+;/g, '');
  cleaned = cleaned.replace(/\{[^}]*:[^}]*\}/g, '');
  cleaned = cleaned.replace(/#[0-9a-fA-F]{3,6}/g, '');
  cleaned = cleaned.replace(/\d+(?:px|em|rem|%|vh|vw)/g, '');
  cleaned = cleaned.replace(/font-family:[^;]+;?/gi, '');
  cleaned = cleaned.replace(/rgba?\([^)]+\)/g, '');

  // Remove JavaScript code patterns
  cleaned = cleaned.replace(/\b(function|var|const|let|return|if|else|for|while)\s*[\(\{]/g, '');
  cleaned = cleaned.replace(/article\(['"#][^)]+\)/g, '');

  // Extract sentences
  const sentences = cleaned.split(/[。．.!！?？]/);
  const meaningful = sentences.filter(s => {
    s = s.trim();

    // Minimum length
    if (s.length < 20) return false;

    // Filter out navigation patterns
    if (s.match(/^(ホーム|メニュー|お問い合わせ|会社概要|サイトマップ|ニュース一覧|詳しく|もっと|こちら|ログイン|新規登録)/)) return false;

    // Filter out button text
    if (s.match(/(を見る|詳細を見る|もっと見る|クリック|お申し込み|資料請求|無料相談|今すぐ|お問い合わせはこちら)/)) return false;

    // Filter out menu/list items
    if (s.match(/^(機能一覧|サービス一覧|製品一覧|事例一覧|対応サービス|主な機能)/)) return false;

    // Filter out code and junk
    if (s.match(/(function|var|const|let|return|article|labelTags|size:|type\d)/)) return false;
    if (s.match(/^[a-zA-Z0-9_\-\s]+$/)) return false;
    if (s.match(/^[\d\s\-\/]+$/)) return false;

    // Must contain Japanese characters
    if (!s.match(/[ぁ-んァ-ヶー一-龠]/)) return false;

    // Must have verb endings (substance)
    return s.match(/(です|ます|ある|いる|おり|られ|こと|もの|よう)/);
  });

  return meaningful.join('。');
}
```

**Step 2: Test filtering**

Run:
```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/debug-analysis" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}' | jq '.'
```

Expected: `philosophy` and `presidentMessage` should NOT contain button text or menu items

**Step 3: Commit**

```bash
git add goenchan/worker/src/handlers/salesLetter-deep-analysis.ts
git commit -m "feat: enhance content filtering to remove button and menu text"
```

---

## Task 4: Improve Section Extraction

**Files:**
- Modify: `goenchan/worker/src/handlers/salesLetter-deep-analysis.ts:18-54`

**Goal:** Better identify section boundaries and extract clean content

**Step 1: Update extractSectionText to use main content only**

Replace lines 18-54 with:
```typescript
// Extract text from specific sections
function extractSectionText(html: string, node: any, sectionKeywords: string[]): string[] {
  const results: string[] = [];

  function traverse(n: any, depth: number = 0) {
    if (depth > 10) return;

    if (isTag(n)) {
      const element = n as Element;

      // Skip navigation elements entirely
      if (isNavigationElement(element)) {
        return;
      }

      // Check if this element matches section keywords
      const elementText = getDirectText(element);
      const className = element.attribs?.class || '';
      const id = element.attribs?.id || '';
      const combined = (elementText + className + id).toLowerCase();

      const isRelevantSection = sectionKeywords.some(kw => combined.includes(kw.toLowerCase()));

      if (isRelevantSection) {
        // Extract text from this section (skip navigation within)
        const sectionText = extractMainContentFromSection(element);
        if (sectionText.length > 50) {
          results.push(sectionText);
        }
      }
    }

    if ('children' in n) {
      for (const child of n.children) {
        traverse(child, depth + 1);
      }
    }
  }

  const document = parseDocument(html);
  traverse(document);
  return results;
}

// Extract main content from a section (skip buttons, navigation)
function extractMainContentFromSection(element: Element): string {
  const textParts: string[] = [];

  function traverse(node: any) {
    if (isTag(node)) {
      const el = node as Element;

      // Skip navigation, buttons, CTAs
      if (isNavigationElement(el) || isButtonOrCTA(el)) {
        return;
      }

      // Skip script/style
      if (el.name === 'script' || el.name === 'style' || el.name === 'noscript') {
        return;
      }
    }

    if (isText(node)) {
      const text = node.data.trim();
      if (text.length > 0) {
        textParts.push(text);
      }
    }

    if ('children' in node) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(element);
  return textParts.join(' ');
}
```

**Step 2: Test section extraction**

Run:
```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/debug-analysis" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}' | jq '{philosophy, presidentMessage}'
```

Expected: Clean content without navigation text

**Step 3: Commit**

```bash
git add goenchan/worker/src/handlers/salesLetter-deep-analysis.ts
git commit -m "feat: improve section extraction with main content filtering"
```

---

## Task 5: Replace Template with Real Content Generation

**Files:**
- Modify: `goenchan/worker/src/handlers/salesLetter-context.ts:210-223`
- Modify: `goenchan/worker/src/handlers/salesLetter-context.ts:351-367`

**Goal:** Remove template-based generation, use actual extracted content

**Step 1: Rewrite generateUniqueNarrative to use real content**

Replace lines 210-223 with:
```typescript
function generateUniqueNarrative(
  businessType: string,
  location: string,
  foundedYear: string,
  coreConcept: string,
  philosophy: string,
  presidentMessage: string,
  uniqueStrengths: string[],
  specificInitiatives: string[],
  keywords: string[]
): string {
  // Priority 1: Use philosophy if available
  if (philosophy && philosophy.length > 30) {
    return `「${philosophy.split('。')[0]}」`;
  }

  // Priority 2: Use president message
  if (presidentMessage && presidentMessage.length > 30) {
    return `「${presidentMessage.split('。')[0]}」`;
  }

  // Priority 3: Use unique strengths
  if (uniqueStrengths && uniqueStrengths.length > 0 && uniqueStrengths[0].length > 30) {
    return `「${uniqueStrengths[0]}」`;
  }

  // Priority 4: Use core concept
  if (coreConcept && coreConcept.length > 30) {
    return `「${coreConcept}」`;
  }

  // Last resort: Simple business-based statement (not template)
  const locationStr = location || 'この地';
  return `「${locationStr}で${businessType}として、お客様と真摯に向き合い続けている」`;
}
```

**Step 2: Remove generateMinimalUniqueNarrative function**

Delete lines 351-367 entirely (the template function)

**Step 3: Test real content generation**

Run:
```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/sales-letter" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}' | jq -r '.text' | head -n 30
```

Expected: Narrative should contain actual content from the website, NOT template text

**Step 4: Commit**

```bash
git add goenchan/worker/src/handlers/salesLetter-context.ts
git commit -m "feat: replace template generation with real content extraction"
```

---

## Task 6: Handle Missing Content Gracefully

**Files:**
- Modify: `goenchan/worker/src/handlers/salesLetter-context.ts:45-84`

**Goal:** When content is missing, state it clearly rather than using generic text

**Step 1: Update generateDeepInsight to handle missing data**

Replace lines 45-84 with:
```typescript
export function generateDeepInsight(
  businessType: string,
  location: string,
  keywords: string[],
  philosophy: string,
  presidentMessage: string,
  uniqueStrengths: string[],
  specificInitiatives: string[],
  foundedYear: string
): { attraction: string; uniqueApproach: string; historicalNarrative: string } {

  const locationStr = location || 'この地';

  // Extract company feature from real content
  const companyFeature = extractCompanyFeature(philosophy, presidentMessage, keywords);

  // Extract core concept from real content
  const coreConcept = extractCoreConcept(companyFeature);

  // Generate narrative from real content (no templates)
  const uniqueNarrative = generateUniqueNarrative(
    businessType,
    locationStr,
    foundedYear,
    coreConcept,
    philosophy,
    presidentMessage,
    uniqueStrengths,
    specificInitiatives,
    keywords
  );

  // Build attraction from real data
  let attraction = '';
  if (companyFeature) {
    attraction = `${locationStr}で、${companyFeature}`;
  } else if (uniqueStrengths.length > 0) {
    attraction = `${locationStr}で、${uniqueStrengths[0]}`;
  } else {
    attraction = `${locationStr}で${businessType}として事業を展開されていること`;
  }

  // Build unique approach from real data
  let uniqueApproach = '';
  if (companyFeature) {
    uniqueApproach = companyFeature;
  } else if (specificInitiatives.length > 0) {
    uniqueApproach = specificInitiatives[0];
  } else if (uniqueStrengths.length > 0) {
    uniqueApproach = uniqueStrengths[0];
  } else {
    uniqueApproach = `お客様との信頼関係を大切にされていること`;
  }

  return {
    attraction,
    uniqueApproach,
    historicalNarrative: uniqueNarrative
  };
}
```

**Step 2: Test with various websites**

Test with kaisyuf.jp:
```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/sales-letter" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}' | jq -r '.text' | grep -A 5 "御社の公式サイトを拝見し"
```

Expected: Should show real content extracted from the website

**Step 3: Commit**

```bash
git add goenchan/worker/src/handlers/salesLetter-context.ts
git commit -m "feat: handle missing content gracefully without generic templates"
```

---

## Task 7: Deploy and Test Full System

**Files:**
- Deploy: `goenchan/worker/wrangler.toml`

**Goal:** Deploy changes and verify real content extraction works

**Step 1: Deploy to crawler-worker-teamb**

```bash
cd goenchan/worker
npx wrangler deploy
```

Expected: Successful deployment

**Step 2: Test with kaisyuf.jp**

```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/debug-analysis" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}' | jq '.'
```

Expected: Clean data without navigation text

**Step 3: Generate full sales letter**

```bash
curl -X POST "https://crawler-worker-teamb.taiichifox.workers.dev/sales-letter" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://kaisyuf.jp/"}' | jq -r '.text'
```

Expected: Sales letter with real company content

**Step 4: Test with multiple companies**

Test 3-5 different company URLs to verify the system works across various site structures

**Step 5: Switch to goenchan-worker and deploy**

```bash
# Edit wrangler.toml: change name to "goenchan-worker"
npx wrangler deploy
# Edit wrangler.toml: change name back to "crawler-worker-teamb"
```

---

## Success Criteria

- ✅ System crawls 8-10 pages per company (up from 4)
- ✅ Navigation, menu, button text completely filtered out
- ✅ Real philosophy, president message, and strengths extracted
- ✅ Narrative generated from actual content (no templates)
- ✅ Missing content handled gracefully
- ✅ Works across multiple company websites

## Notes

- Keep `performDeepAnalysis` signature unchanged for backward compatibility
- All filtering happens inside extraction functions
- Templates completely removed from `salesLetter-context.ts`
- Debug endpoint helps verify extraction quality
