# Bulk Site Crawler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build automated bulk crawler to detect contact forms and generate SITE_MAPPINGS from multiple URLs

**Architecture:** Cloudflare Worker backend handles parallel crawling (10 concurrent), pattern detection using existing 5-pattern system, and SITE_MAPPINGS code generation. Extension UI provides URL input and result download.

**Tech Stack:** TypeScript, Cloudflare Workers, Chrome Extension APIs, existing pattern detection logic

---

## Task 1: Create Pattern Detector Utility Module

**Files:**
- Create: `goenchan/worker/src/utils/patternDetector.ts`

**Step 1: Create interfaces and base structure**

```typescript
// goenchan/worker/src/utils/patternDetector.ts

export interface FormField {
  name: string;
  type: string;
  id?: string;
}

export interface PatternResult {
  name: string;
  score: number;
}

export interface FieldMapping {
  selector: string;
  confidence: number;
  value?: string;
}

export interface SiteMapping {
  company_url: string;
  [key: string]: FieldMapping | string;
  _auto_detected?: boolean;
  _detected_at?: string;
  _pattern?: string;
}
```

**Step 2: Implement WordPress CF7 detector**

```typescript
export function detectWordPressCF7(fields: FormField[]): number {
  if (!fields || fields.length === 0) return 0;

  let count = 0;
  fields.forEach(f => {
    if (f.name && f.name.startsWith('your-')) {
      count++;
    }
  });

  return count >= 3 ? Math.min(100, 50 + count * 10) : 0;
}
```

**Step 3: Implement Japanese Direct detector**

```typescript
export function detectJapaneseDirect(fields: FormField[]): number {
  if (!fields || fields.length === 0) return 0;

  const regex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/;
  let count = fields.filter(f => f.name && regex.test(f.name)).length;

  return count >= 3 ? Math.min(100, 50 + count * 10) : 0;
}
```

**Step 4: Implement Required Marks detector**

```typescript
export function detectRequiredMarks(fields: FormField[]): number {
  if (!fields || fields.length === 0) return 0;

  const requiredRegex = /[（(]必須[)）]/;
  let count = fields.filter(f => f.name && requiredRegex.test(f.name)).length;

  return count >= 2 ? Math.min(100, 50 + count * 15) : 0;
}
```

**Step 5: Implement MailForm CGI detector**

```typescript
export function detectMailFormCGI(fields: FormField[]): number {
  if (!fields || fields.length === 0) return 0;

  const fFieldRegex = /^F\d+$/;
  const emailFieldRegex = /^Email\d+$/i;

  let fCount = fields.filter(f => f.name && fFieldRegex.test(f.name)).length;
  let emailCount = fields.filter(f => f.name && emailFieldRegex.test(f.name)).length;
  let total = fCount + emailCount;

  return total >= 3 ? Math.min(100, 40 + total * 12) : 0;
}
```

**Step 6: Implement Split Fields detector**

```typescript
export function detectSplitFields(fields: FormField[]): number {
  if (!fields || fields.length === 0) return 0;

  const fieldGroups: { [key: string]: number[] } = {};
  const splitRegex = /^(.+?)(\d+)$/;

  fields.forEach(field => {
    if (!field.name) return;
    const match = field.name.match(splitRegex);
    if (match) {
      const baseName = match[1];
      const number = parseInt(match[2]);
      if (!fieldGroups[baseName]) {
        fieldGroups[baseName] = [];
      }
      fieldGroups[baseName].push(number);
    }
  });

  let splitGroupCount = 0;
  for (const [, numbers] of Object.entries(fieldGroups)) {
    if (numbers.length >= 2) {
      splitGroupCount++;
    }
  }

  return splitGroupCount >= 2 ? Math.min(100, 50 + splitGroupCount * 12) : 0;
}
```

**Step 7: Implement main detectPattern function**

```typescript
export function detectPattern(fields: FormField[]): PatternResult | null {
  const patterns = [
    { name: 'wordpress-cf7', score: detectWordPressCF7(fields) },
    { name: 'japanese-direct', score: detectJapaneseDirect(fields) },
    { name: 'required-marks', score: detectRequiredMarks(fields) },
    { name: 'mailform-cgi', score: detectMailFormCGI(fields) },
    { name: 'split-fields', score: detectSplitFields(fields) }
  ];

  patterns.sort((a, b) => b.score - a.score);
  const best = patterns[0];

  return best.score >= 50 ? best : null;
}
```

**Step 8: Commit pattern detectors**

```bash
cd /Users/taiichiwada/mascodex-2940045
git add goenchan/worker/src/utils/patternDetector.ts
git commit -m "feat(worker): add pattern detection utilities

Implement 5 pattern detectors for Worker-side form analysis.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Mapping Generator Module

**Files:**
- Create: `goenchan/worker/src/utils/mappingGenerator.ts`

**Step 1: Create WordPress CF7 mapping generator**

```typescript
// goenchan/worker/src/utils/mappingGenerator.ts

import { FormField, FieldMapping, SiteMapping } from './patternDetector';

export function generateWordPressCF7Mapping(fields: FormField[], baseUrl: string): SiteMapping {
  const mapping: SiteMapping = {
    company_url: baseUrl,
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'wordpress-cf7'
  };

  const cf7FieldMap: { [key: string]: { field: string; confidence: number } } = {
    'your-name': { field: 'name', confidence: 90 },
    'your-email': { field: 'email', confidence: 95 },
    'your-subject': { field: 'subject', confidence: 90 },
    'your-message': { field: 'message', confidence: 90 },
    'your-tel': { field: 'phone', confidence: 85 },
    'your-phone': { field: 'phone', confidence: 85 },
    'your-company': { field: 'company', confidence: 85 },
    'your-zipcode': { field: 'zipcode', confidence: 85 },
    'your-address': { field: 'address', confidence: 85 }
  };

  fields.forEach(field => {
    const fieldInfo = cf7FieldMap[field.name];
    if (fieldInfo) {
      mapping[fieldInfo.field] = {
        selector: `[name="${field.name}"]`,
        confidence: fieldInfo.confidence
      };
    }
  });

  return mapping;
}
```

**Step 2: Create Japanese Direct mapping generator**

```typescript
export function generateJapaneseDirectMapping(fields: FormField[], baseUrl: string): SiteMapping {
  const mapping: SiteMapping = {
    company_url: baseUrl,
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'japanese-direct'
  };

  const japaneseFieldMap: { [key: string]: { field: string; confidence: number } } = {
    'お名前': { field: 'name', confidence: 85 },
    '氏名': { field: 'name', confidence: 85 },
    '会社名': { field: 'company', confidence: 90 },
    '企業名': { field: 'company', confidence: 90 },
    'メール': { field: 'email', confidence: 85 },
    'メールアドレス': { field: 'email', confidence: 90 },
    'Eメール': { field: 'email', confidence: 85 },
    '電話': { field: 'phone', confidence: 80 },
    '電話番号': { field: 'phone', confidence: 85 },
    '件名': { field: 'subject', confidence: 85 },
    'お問い合わせ内容': { field: 'message', confidence: 85 },
    'メッセージ': { field: 'message', confidence: 80 },
    '本文': { field: 'message', confidence: 80 },
    '郵便番号': { field: 'zipcode', confidence: 85 },
    '住所': { field: 'address', confidence: 85 }
  };

  fields.forEach(field => {
    const fieldInfo = japaneseFieldMap[field.name];
    if (fieldInfo) {
      mapping[fieldInfo.field] = {
        selector: `[name="${field.name}"]`,
        confidence: fieldInfo.confidence
      };
    }
  });

  return mapping;
}
```

**Step 3: Create Required Marks, MailForm, Split Fields generators**

```typescript
export function generateRequiredMarksMapping(fields: FormField[], baseUrl: string): SiteMapping {
  const mapping: SiteMapping = {
    company_url: baseUrl,
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'required-marks'
  };

  const requiredRegex = /[（(]必須[)）]/g;
  const keywordMap: { [key: string]: { field: string; confidence: number } } = {
    '会社名': { field: 'company', confidence: 80 },
    '企業名': { field: 'company', confidence: 80 },
    'お名前': { field: 'name', confidence: 75 },
    '氏名': { field: 'name', confidence: 75 },
    '名前': { field: 'name', confidence: 75 },
    'メール': { field: 'email', confidence: 80 },
    'メールアドレス': { field: 'email', confidence: 85 },
    '電話': { field: 'phone', confidence: 75 },
    '電話番号': { field: 'phone', confidence: 80 },
    '件名': { field: 'subject', confidence: 75 },
    'お問い合わせ内容': { field: 'message', confidence: 75 },
    'メッセージ': { field: 'message', confidence: 70 }
  };

  fields.forEach(field => {
    const cleanName = field.name.replace(requiredRegex, '').trim();
    const fieldInfo = keywordMap[cleanName];
    if (fieldInfo) {
      mapping[fieldInfo.field] = {
        selector: `[name="${field.name}"]`,
        confidence: fieldInfo.confidence
      };
    }
  });

  return mapping;
}

export function generateMailFormCGIMapping(fields: FormField[], baseUrl: string): SiteMapping {
  const mapping: SiteMapping = {
    company_url: baseUrl,
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'mailform-cgi'
  };

  const fFields: { num: number; name: string }[] = [];
  const fFieldRegex = /^F(\d+)$/;
  const emailFieldRegex = /^Email\d+$/i;

  fields.forEach(field => {
    const match = field.name.match(fFieldRegex);
    if (match) {
      fFields.push({ num: parseInt(match[1]), name: field.name });
    } else if (emailFieldRegex.test(field.name)) {
      mapping.email = {
        selector: `[name="${field.name}"]`,
        confidence: 85
      };
    }
  });

  fFields.sort((a, b) => a.num - b.num);

  if (fFields.length >= 1) {
    mapping.name = { selector: `[name="${fFields[0].name}"]`, confidence: 65 };
  }
  if (fFields.length >= 2) {
    mapping.company = { selector: `[name="${fFields[1].name}"]`, confidence: 60 };
  }
  if (fFields.length >= 3) {
    mapping.phone = { selector: `[name="${fFields[2].name}"]`, confidence: 55 };
  }

  return mapping;
}

export function generateSplitFieldsMapping(fields: FormField[], baseUrl: string): SiteMapping {
  const mapping: SiteMapping = {
    company_url: baseUrl,
    _auto_detected: true,
    _detected_at: new Date().toISOString(),
    _pattern: 'split-fields'
  };

  const fieldGroups: { [key: string]: { number: number; name: string }[] } = {};
  const splitRegex = /^(.+?)(\d+)$/;

  fields.forEach(field => {
    const match = field.name.match(splitRegex);
    if (match) {
      const baseName = match[1];
      const number = parseInt(match[2]);
      if (!fieldGroups[baseName]) {
        fieldGroups[baseName] = [];
      }
      fieldGroups[baseName].push({ number, name: field.name });
    }
  });

  for (const [baseName, group] of Object.entries(fieldGroups)) {
    if (group.length >= 2) {
      group.sort((a, b) => a.number - b.number);
      const names = group.map(g => g.name);

      if (baseName.match(/name|名前|氏名|sei|mei/i)) {
        mapping.name1 = { selector: `[name="${names[0]}"]`, confidence: 80 };
        if (names[1]) mapping.name2 = { selector: `[name="${names[1]}"]`, confidence: 80 };
      }

      if (baseName.match(/kana|カナ|かな|フリガナ/i)) {
        mapping.name_kana1 = { selector: `[name="${names[0]}"]`, confidence: 80 };
        if (names[1]) mapping.name_kana2 = { selector: `[name="${names[1]}"]`, confidence: 80 };
      }

      if (baseName.match(/tel|phone|電話/i)) {
        mapping.phone1 = { selector: `[name="${names[0]}"]`, confidence: 85 };
        if (names[1]) mapping.phone2 = { selector: `[name="${names[1]}"]`, confidence: 85 };
        if (names[2]) mapping.phone3 = { selector: `[name="${names[2]}"]`, confidence: 85 };
      }

      if (baseName.match(/zip|postal|郵便/i)) {
        mapping.zipcode1 = { selector: `[name="${names[0]}"]`, confidence: 85 };
        if (names[1]) mapping.zipcode2 = { selector: `[name="${names[1]}"]`, confidence: 85 };
      }
    }
  }

  return mapping;
}
```

**Step 4: Create main generateMapping function**

```typescript
export function generateMapping(patternName: string, fields: FormField[], baseUrl: string): SiteMapping | null {
  switch (patternName) {
    case 'wordpress-cf7':
      return generateWordPressCF7Mapping(fields, baseUrl);
    case 'japanese-direct':
      return generateJapaneseDirectMapping(fields, baseUrl);
    case 'required-marks':
      return generateRequiredMarksMapping(fields, baseUrl);
    case 'mailform-cgi':
      return generateMailFormCGIMapping(fields, baseUrl);
    case 'split-fields':
      return generateSplitFieldsMapping(fields, baseUrl);
    default:
      return null;
  }
}
```

**Step 5: Commit mapping generators**

```bash
git add goenchan/worker/src/utils/mappingGenerator.ts
git commit -m "feat(worker): add mapping generators for 5 patterns

Generate SITE_MAPPINGS from detected form patterns.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create HTML Parser Module

**Files:**
- Create: `goenchan/worker/src/utils/htmlParser.ts`

**Step 1: Implement contact link finder**

```typescript
// goenchan/worker/src/utils/htmlParser.ts

const contactRegex = /お問い?合わせ|contact|問い合わせ|コンタクト|お問合せ/i;

export function findContactLink(html: string, baseUrl: string): string | null {
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, ''); // Remove HTML tags

    if (contactRegex.test(text)) {
      try {
        return new URL(href, baseUrl).toString();
      } catch (e) {
        // Invalid URL, continue
        continue;
      }
    }
  }

  return null;
}
```

**Step 2: Implement form field extractor**

```typescript
import { FormField } from './patternDetector';

export function extractFormFields(html: string): FormField[] {
  const fields: FormField[] = [];
  const inputRegex = /<(input|textarea|select)[^>]*name=["']([^"']+)["'][^>]*>/gi;

  let match;
  while ((match = inputRegex.exec(html)) !== null) {
    const type = match[1].toLowerCase();
    const name = match[2];

    // Extract type attribute for input elements
    let inputType = 'text';
    if (type === 'input') {
      const typeMatch = match[0].match(/type=["']([^"']+)["']/i);
      if (typeMatch) {
        inputType = typeMatch[1].toLowerCase();
      }
    }

    fields.push({
      name: name,
      type: type === 'input' ? inputType : type
    });
  }

  return fields;
}
```

**Step 3: Commit HTML parser**

```bash
git add goenchan/worker/src/utils/htmlParser.ts
git commit -m "feat(worker): add HTML parser utilities

Extract contact links and form fields from HTML.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Implement Bulk Crawler Endpoint

**Files:**
- Modify: `goenchan/worker/src/index.ts`
- Create: `goenchan/worker/src/handlers/bulkCrawler.ts`

**Step 1: Create bulk crawler handler**

```typescript
// goenchan/worker/src/handlers/bulkCrawler.ts

import { findContactLink, extractFormFields } from '../utils/htmlParser';
import { detectPattern } from '../utils/patternDetector';
import { generateMapping } from '../utils/mappingGenerator';
import { SiteMapping } from '../utils/patternDetector';

interface CrawlResult {
  url: string;
  success: boolean;
  contactUrl?: string;
  pattern?: string;
  mapping?: SiteMapping;
  error?: string;
}

async function crawlSingleSite(url: string): Promise<CrawlResult> {
  try {
    // Normalize URL
    const normalizedUrl = url.replace(/^http:/, 'https:').replace(/\/$/, '');
    const urlObj = new URL(normalizedUrl);

    // Fetch homepage with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const homeResponse = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FormCrawlerBot/1.0)'
      }
    });
    clearTimeout(timeoutId);

    if (!homeResponse.ok) {
      return { url, success: false, error: `HTTP ${homeResponse.status}` };
    }

    const homeHtml = await homeResponse.text();

    // Find contact link
    const contactUrl = findContactLink(homeHtml, normalizedUrl);
    if (!contactUrl) {
      return { url, success: false, error: 'Contact link not found' };
    }

    // Fetch contact page
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 5000);

    const contactResponse = await fetch(contactUrl, {
      signal: controller2.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FormCrawlerBot/1.0)'
      }
    });
    clearTimeout(timeoutId2);

    if (!contactResponse.ok) {
      return { url, success: false, contactUrl, error: `Contact page HTTP ${contactResponse.status}` };
    }

    const contactHtml = await contactResponse.text();

    // Extract form fields
    const fields = extractFormFields(contactHtml);
    if (fields.length === 0) {
      return { url, success: false, contactUrl, error: 'No form fields found' };
    }

    // Detect pattern
    const pattern = detectPattern(fields);
    if (!pattern) {
      return { url, success: false, contactUrl, error: 'Pattern not detected (score < 50)' };
    }

    // Generate mapping
    const mapping = generateMapping(pattern.name, fields, normalizedUrl);
    if (!mapping) {
      return { url, success: false, contactUrl, error: 'Mapping generation failed' };
    }

    // Create mapping key (hostname + contact path)
    const contactUrlObj = new URL(contactUrl);
    const mappingKey = `${contactUrlObj.hostname}${contactUrlObj.pathname}`;

    return {
      url,
      success: true,
      contactUrl,
      pattern: pattern.name,
      mapping: { key: mappingKey, ...mapping }
    };

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { url, success: false, error: 'Timeout (>5s)' };
    }
    return { url, success: false, error: error.message || 'Unknown error' };
  }
}

export async function handleBulkCrawler(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const urls: string[] = body.urls || [];

    if (!Array.isArray(urls) || urls.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid request: urls array required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Limit to 50 URLs
    const limitedUrls = urls.slice(0, 50);

    // Crawl in parallel (max 10 concurrent)
    const results: CrawlResult[] = [];
    for (let i = 0; i < limitedUrls.length; i += 10) {
      const batch = limitedUrls.slice(i, i + 10);
      const batchResults = await Promise.allSettled(
        batch.map(url => crawlSingleSite(url))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            url: batch[index],
            success: false,
            error: result.reason?.message || 'Unknown error'
          });
        }
      });
    }

    // Collect successful mappings
    const mappings: { [key: string]: any } = {};
    const errors: { url: string; error: string }[] = [];

    results.forEach(result => {
      if (result.success && result.mapping) {
        const { key, ...mappingData } = result.mapping as any;
        mappings[key] = mappingData;
      } else if (!result.success) {
        errors.push({ url: result.url, error: result.error || 'Unknown' });
      }
    });

    const found = Object.keys(mappings).length;
    const failed = errors.length;

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      found,
      failed,
      newMappings: found,
      mappings,
      errors
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Step 2: Add endpoint to main router**

Modify `goenchan/worker/src/index.ts`:

```typescript
// Add import
import { handleBulkCrawler } from './handlers/bulkCrawler';

// In the fetch handler, add new route:
if (url.pathname === '/bulk-crawler' && request.method === 'POST') {
  return handleBulkCrawler(request);
}
```

**Step 3: Commit bulk crawler endpoint**

```bash
git add goenchan/worker/src/handlers/bulkCrawler.ts goenchan/worker/src/index.ts
git commit -m "feat(worker): add bulk crawler endpoint

Implement /bulk-crawler endpoint with parallel site crawling.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Bulk Crawler UI to Extension

**Files:**
- Modify: `goenchan/chrome-extension-v2/popup.html`
- Modify: `goenchan/chrome-extension-v2/popup.js`
- Modify: `goenchan/chrome-extension-v2/popup.css` (if needed)

**Step 1: Add HTML section**

Add to `popup.html` before the closing `</body>` tag:

```html
<!-- Bulk Site Crawler Section -->
<div class="section">
  <button id="bulkCrawlerToggle" class="toggle-btn">▶ Bulk Site Crawler</button>
  <div id="bulkCrawlerContent" class="collapsible-content">
    <p>複数サイトを一括クロールしてフォームパターンを検出</p>

    <textarea id="bulkUrls" rows="10" placeholder="https://example.com&#10;https://another-site.co.jp&#10;..."></textarea>

    <button id="startCrawl" class="btn-primary">Start Crawl</button>

    <div id="crawlProgress" style="display: none; margin-top: 10px;">
      <p>進捗: <span id="crawlStatus">処理中...</span></p>
    </div>

    <div id="crawlResults" style="display: none; margin-top: 10px;">
      <h4>✅ クロール完了</h4>
      <p>新規追加: <span id="newMappingsCount">0</span> サイト / 失敗: <span id="failedCount">0</span> サイト</p>
      <button id="downloadMappings" class="btn-success">Download Mappings JSON</button>
      <details style="margin-top: 10px;">
        <summary>エラー詳細 (<span id="errorCount">0</span>)</summary>
        <ul id="errorList" style="font-size: 11px; max-height: 200px; overflow-y: auto;"></ul>
      </details>
    </div>
  </div>
</div>
```

**Step 2: Add collapsible functionality**

Add to `popup.js` in setupCollapsibles():

```javascript
document.getElementById('bulkCrawlerToggle').addEventListener('click', () => {
  const content = document.getElementById('bulkCrawlerContent');
  const toggle = document.getElementById('bulkCrawlerToggle');
  content.classList.toggle('show');
  toggle.textContent = content.classList.contains('show') ? '▼ Bulk Site Crawler' : '▶ Bulk Site Crawler';
});
```

**Step 3: Add crawl execution logic**

Add to `popup.js`:

```javascript
document.getElementById('startCrawl').addEventListener('click', async () => {
  const urlsText = document.getElementById('bulkUrls').value;
  const urls = urlsText
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  if (urls.length === 0) {
    showStatus('Please enter at least one URL', 'error');
    return;
  }

  // Show progress
  document.getElementById('crawlProgress').style.display = 'block';
  document.getElementById('crawlResults').style.display = 'none';
  document.getElementById('crawlStatus').textContent = `クロール中... (${urls.length} URLs)`;
  document.getElementById('startCrawl').disabled = true;

  try {
    // Call Worker API
    const response = await fetch('https://crawler-worker.taiichiwada.workers.dev/bulk-crawler', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ urls })
    });

    const result = await response.json();

    // Hide progress
    document.getElementById('crawlProgress').style.display = 'none';

    if (result.success) {
      // Show results
      document.getElementById('crawlResults').style.display = 'block';
      document.getElementById('newMappingsCount').textContent = result.found;
      document.getElementById('failedCount').textContent = result.failed;
      document.getElementById('errorCount').textContent = result.errors.length;

      // Populate error list
      const errorList = document.getElementById('errorList');
      errorList.innerHTML = '';
      result.errors.forEach(err => {
        const li = document.createElement('li');
        li.textContent = `${err.url}: ${err.error}`;
        errorList.appendChild(li);
      });

      // Store mappings for download
      window.crawlMappings = result.mappings;

      showStatus(`✅ Crawl complete: ${result.found} forms detected`, 'success');
    } else {
      showStatus(`Error: ${result.error}`, 'error');
    }

  } catch (error) {
    document.getElementById('crawlProgress').style.display = 'none';
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    document.getElementById('startCrawl').disabled = false;
  }
});

// Download mappings
document.getElementById('downloadMappings').addEventListener('click', () => {
  if (!window.crawlMappings) {
    showStatus('No mappings to download', 'error');
    return;
  }

  const jsonStr = JSON.stringify(window.crawlMappings, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `site-mappings-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showStatus('Mappings downloaded!', 'success');
});
```

**Step 4: Commit extension UI**

```bash
git add goenchan/chrome-extension-v2/popup.html goenchan/chrome-extension-v2/popup.js
git commit -m "feat(extension): add bulk crawler UI

Add UI for bulk site crawling with progress and results display.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Deploy and Test Worker

**Files:**
- Test: Worker deployment

**Step 1: Deploy Worker to Cloudflare**

```bash
cd goenchan/worker
npm run deploy
```

Expected: Worker deployed successfully
Note the Worker URL (e.g., `https://crawler-worker.taiichiwada.workers.dev`)

**Step 2: Test with curl**

```bash
curl -X POST https://crawler-worker.taiichiwada.workers.dev/bulk-crawler \
  -H "Content-Type: application/json" \
  -d '{"urls":["https://kandacoffee.jp"]}'
```

Expected: JSON response with success, found, mappings

**Step 3: Update extension with correct Worker URL**

Update the fetch URL in `popup.js` if needed.

---

## Task 7: Manual Integration Test

**Files:**
- Test: Full integration

**Step 1: Load extension in Chrome**

1. Go to `chrome://extensions/`
2. Click "Reload" on the extension

**Step 2: Test bulk crawl**

1. Open extension popup
2. Expand "Bulk Site Crawler"
3. Enter test URLs (3-5 sites):
```
https://kandacoffee.jp
https://e-kenchiku.com
https://www.sazae.co.jp
```

4. Click "Start Crawl"

Expected:
- Progress indicator shows
- Results appear after 10-20 seconds
- X forms detected, Y failed
- Download button appears

**Step 3: Download and verify mappings**

1. Click "Download Mappings JSON"
2. Open downloaded file
3. Verify mappings structure matches SITE_MAPPINGS format

**Step 4: Document any issues**

Create issue list if problems found.

---

## Task 8: Update Version and Documentation

**Files:**
- Modify: `goenchan/chrome-extension-v2/manifest.json`
- Modify: `goenchan/chrome-extension-v2/CHANGELOG.md`

**Step 1: Bump version to 2.12.0**

```json
{
  "version": "2.12.0",
  "description": "Advanced form auto-filler with pattern recognition and bulk crawler"
}
```

**Step 2: Update CHANGELOG**

Add to CHANGELOG.md:

```markdown
## [2.12.0] - 2026-02-04

### Added
- **Bulk Site Crawler**: Automatically crawl multiple URLs to detect contact forms
  - Parallel crawling (10 concurrent sites)
  - Automatic pattern detection and mapping generation
  - Download detected mappings as JSON
  - Error reporting for failed sites
- Worker-side pattern detection and mapping generation
- HTML parser utilities for contact link detection

### Changed
- Extended UI with Bulk Site Crawler section
- Added /bulk-crawler endpoint to Cloudflare Worker

### Improved
- Reduced manual SITE_MAPPINGS configuration effort
- Faster onboarding for new sites
```

**Step 3: Commit version update**

```bash
git add goenchan/chrome-extension-v2/manifest.json goenchan/chrome-extension-v2/CHANGELOG.md
git commit -m "chore: bump version to 2.12.0

Release bulk site crawler feature.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Success Criteria

✅ Worker endpoint `/bulk-crawler` handles bulk URL requests
✅ Pattern detection works on Worker side
✅ Mapping generation produces valid SITE_MAPPINGS format
✅ Extension UI displays progress and results
✅ Mappings can be downloaded as JSON
✅ Error handling for failed sites
✅ Processing completes within timeout (50s for 10 sites)
✅ Version bumped to 2.12.0
✅ Documentation updated

---

## Notes

- Worker URL must be updated in popup.js after deployment
- Mappings JSON must be manually merged into content.js
- Future enhancement: Automatic content.js generation and download
- Timeout: 5 seconds per site, max 10 concurrent
- Maximum 50 URLs per request (Worker timeout: 50s)
