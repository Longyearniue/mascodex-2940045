# Goenchan Founder Visibility Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone system that detects if a company founder/CEO is visibly featured on their website and generates personalized Japanese outreach emails for Goenchan.

**Architecture:** Cloudflare Workers backend with HTML parsing for founder detection (max 5 pages per domain), React frontend with Vite for user interaction, completely independent from existing FastAPI backend.

**Tech Stack:** TypeScript, Cloudflare Workers, Wrangler, React, Vite, htmlparser2, TailwindCSS

---

## Task 1: Initialize Cloudflare Worker Project Structure

**Files:**
- Create: `goenchan/worker/package.json`
- Create: `goenchan/worker/wrangler.toml`
- Create: `goenchan/worker/tsconfig.json`
- Create: `goenchan/worker/src/index.ts`
- Create: `goenchan/worker/.gitignore`

**Step 1: Create worker directory and package.json**

```bash
mkdir -p goenchan/worker/src
cd goenchan/worker
```

Create `goenchan/worker/package.json`:
```json
{
  "name": "goenchan-worker",
  "version": "1.0.0",
  "description": "Founder visibility detection API for Goenchan",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "dependencies": {
    "htmlparser2": "^9.1.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240117.0",
    "wrangler": "^3.22.1",
    "typescript": "^5.3.3"
  }
}
```

**Step 2: Create wrangler configuration**

Create `goenchan/worker/wrangler.toml`:
```toml
name = "goenchan-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
routes = [
  { pattern = "api.goenchan.com/*", zone_name = "goenchan.com" }
]

[env.development]
# Development environment runs locally
```

**Step 3: Create TypeScript configuration**

Create `goenchan/worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "lib": ["ES2021"],
    "module": "ES2022",
    "moduleResolution": "node",
    "types": ["@cloudflare/workers-types"],
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

**Step 4: Create gitignore**

Create `goenchan/worker/.gitignore`:
```
node_modules/
dist/
.wrangler/
.dev.vars
*.log
```

**Step 5: Create basic worker skeleton**

Create `goenchan/worker/src/index.ts`:
```typescript
export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/api/founder-visibility' && request.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Not implemented' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/api/outreach/generate' && request.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Not implemented' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

**Step 6: Install dependencies**

```bash
cd goenchan/worker
npm install
```

Expected: Dependencies installed successfully

**Step 7: Test worker locally**

```bash
npx wrangler dev
```

Expected: Worker starts on localhost:8787

**Step 8: Test endpoints with curl**

```bash
curl -X POST http://localhost:8787/api/founder-visibility \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Expected: `{"message":"Not implemented"}` with status 501

**Step 9: Commit**

```bash
git add goenchan/worker/
git commit -m "feat: initialize Cloudflare Worker project structure

- Add package.json with dependencies
- Add wrangler.toml configuration
- Add TypeScript configuration
- Create basic worker with CORS and routing skeleton"
```

---

## Task 2: Implement URL Fetching and HTML Parsing Utilities

**Files:**
- Create: `goenchan/worker/src/utils/fetcher.ts`
- Create: `goenchan/worker/src/utils/parser.ts`
- Create: `goenchan/worker/src/utils/robots.ts`

**Step 1: Create URL fetcher with timeout**

Create `goenchan/worker/src/utils/fetcher.ts`:
```typescript
export interface FetchResult {
  success: boolean;
  html?: string;
  error?: string;
  statusCode?: number;
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 8000
): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'GoenchanBot/1.0 (Founder Visibility Checker)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    const html = await response.text();
    return { success: true, html, statusCode: response.status };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return { success: false, error: 'Timeout' };
    }

    return { success: false, error: error.message || 'Fetch failed' };
  }
}
```

**Step 2: Create HTML parser for link extraction**

Create `goenchan/worker/src/utils/parser.ts`:
```typescript
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
```

**Step 3: Create robots.txt checker**

Create `goenchan/worker/src/utils/robots.ts`:
```typescript
export async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await fetch(robotsUrl, {
      headers: {
        'User-Agent': 'GoenchanBot/1.0 (Founder Visibility Checker)',
      },
    });

    if (!response.ok) {
      // No robots.txt means we can crawl
      return true;
    }

    const robotsTxt = await response.text();

    // Simple check: if User-agent: * has Disallow: /, block everything
    const lines = robotsTxt.split('\n');
    let blockAll = false;
    let isUniversalAgent = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        isUniversalAgent = trimmed.includes('*');
      }

      if (isUniversalAgent && trimmed === 'disallow: /') {
        blockAll = true;
        break;
      }
    }

    return !blockAll;
  } catch (e) {
    // If robots.txt fetch fails, allow crawling
    return true;
  }
}
```

**Step 4: Test utilities manually**

```bash
npx wrangler dev
```

Expected: Worker compiles without errors

**Step 5: Commit**

```bash
git add goenchan/worker/src/utils/
git commit -m "feat: add URL fetching and HTML parsing utilities

- Add fetchWithTimeout with 8s timeout and abort controller
- Add HTML parser for extracting links with founder-related patterns
- Add containsFounderKeywords function for Japanese and English keywords
- Add simple robots.txt checker to respect crawl restrictions"
```

---

## Task 3: Implement Founder Visibility Detection Endpoint

**Files:**
- Create: `goenchan/worker/src/handlers/founderVisibility.ts`
- Modify: `goenchan/worker/src/index.ts`

**Step 1: Create founder visibility detection handler**

Create `goenchan/worker/src/handlers/founderVisibility.ts`:
```typescript
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
```

**Step 2: Wire up the handler in index.ts**

Modify `goenchan/worker/src/index.ts`:
```typescript
import { handleFounderVisibility } from './handlers/founderVisibility';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/api/founder-visibility' && request.method === 'POST') {
      const response = await handleFounderVisibility(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    if (url.pathname === '/api/outreach/generate' && request.method === 'POST') {
      return new Response(JSON.stringify({ message: 'Not implemented' }), {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

**Step 3: Test the endpoint locally**

```bash
npx wrangler dev
```

**Step 4: Test with curl**

```bash
curl -X POST http://localhost:8787/api/founder-visibility \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

Expected: JSON response with `founder_visibility`, `evidence`, `checked_urls`, `hit_keywords`

**Step 5: Commit**

```bash
git add goenchan/worker/src/handlers/founderVisibility.ts goenchan/worker/src/index.ts
git commit -m "feat: implement founder visibility detection endpoint

- Add POST /api/founder-visibility handler
- Fetch up to 5 pages per domain (1 main + 4 additional)
- Check for Japanese and English founder keywords
- Extract candidate links from href attributes
- Include common Japanese paths (/company, /about, etc.)
- Respect robots.txt disallow rules
- Wire up handler with CORS support in index.ts"
```

---

## Task 4: Implement Outreach Email Generation Endpoint

**Files:**
- Create: `goenchan/worker/src/handlers/outreachGenerate.ts`
- Modify: `goenchan/worker/src/index.ts`

**Step 1: Create outreach email generator**

Create `goenchan/worker/src/handlers/outreachGenerate.ts`:
```typescript
import { handleFounderVisibility } from './founderVisibility';

export interface OutreachGenerateRequest {
  companyName: string;
  url: string;
  questions: string;
}

export interface OutreachGenerateResponse {
  eligible: boolean;
  subject?: string;
  body?: string;
  evidence?: string[];
  reason?: string;
}

export async function handleOutreachGenerate(
  request: Request
): Promise<Response> {
  try {
    const body: OutreachGenerateRequest = await request.json();

    if (!body.companyName || !body.url || !body.questions) {
      return new Response(
        JSON.stringify({
          error: 'companyName, url, and questions are required'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Check founder visibility
    const visibilityRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: body.url }),
    });

    const visibilityResponse = await handleFounderVisibility(visibilityRequest);
    const visibilityData = await visibilityResponse.json();

    // Step 2: If not eligible, return early
    if (!visibilityData.founder_visibility) {
      return new Response(
        JSON.stringify({
          eligible: false,
          reason: 'founder_visibility_false',
        } as OutreachGenerateResponse),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Generate email content
    const subject = 'ライブ配信出演のご相談（Goenchan）';

    const emailBody = `${body.companyName}の皆様

お世話になります。Goenchanの和田と申します。

貴社のウェブサイトを拝見し、創業者様・経営者様のメッセージやビジョンに大変感銘を受けました。

Goenchanでは、革新的な企業のトップの方々をお招きし、創業の背景や今後の展望についてお話しいただくライブ配信を企画しております（https://goenchan.com）。

視聴者からの以下の質問にもお答えいただければと考えております：
${body.questions}

ぜひ貴社の創業ストーリーや${body.companyName}ならではの取り組みについてお聞かせいただけませんでしょうか。

ご興味をお持ちいただけましたら、日程調整などの詳細についてご相談させていただければ幸いです。

何卒よろしくお願いいたします。

Goenchan 和田
https://goenchan.com`;

    const response: OutreachGenerateResponse = {
      eligible: true,
      subject,
      body: emailBody,
      evidence: visibilityData.evidence,
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
```

**Step 2: Wire up the handler in index.ts**

Modify `goenchan/worker/src/index.ts`:
```typescript
import { handleFounderVisibility } from './handlers/founderVisibility';
import { handleOutreachGenerate } from './handlers/outreachGenerate';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === '/api/founder-visibility' && request.method === 'POST') {
      const response = await handleFounderVisibility(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    if (url.pathname === '/api/outreach/generate' && request.method === 'POST') {
      const response = await handleOutreachGenerate(request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

**Step 3: Test the endpoint locally**

```bash
npx wrangler dev
```

**Step 4: Test with curl**

```bash
curl -X POST http://localhost:8787/api/outreach/generate \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "テスト株式会社",
    "url": "https://example.com",
    "questions": "創業のきっかけは？"
  }'
```

Expected: JSON response with `eligible`, `subject`, `body`, `evidence` (if eligible) or `reason` (if not)

**Step 5: Commit**

```bash
git add goenchan/worker/src/handlers/outreachGenerate.ts goenchan/worker/src/index.ts
git commit -m "feat: implement outreach email generation endpoint

- Add POST /api/outreach/generate handler
- Check founder visibility before generating email
- Generate Japanese email with subject and body
- Include Goenchan URL (https://goenchan.com)
- Keep companyName and questions as placeholders
- Return ineligible response if founder not visible"
```

---

## Task 5: Initialize React Frontend Project

**Files:**
- Create: `goenchan/frontend/package.json`
- Create: `goenchan/frontend/vite.config.ts`
- Create: `goenchan/frontend/tsconfig.json`
- Create: `goenchan/frontend/tsconfig.node.json`
- Create: `goenchan/frontend/index.html`
- Create: `goenchan/frontend/tailwind.config.js`
- Create: `goenchan/frontend/postcss.config.js`
- Create: `goenchan/frontend/.gitignore`
- Create: `goenchan/frontend/.env.example`

**Step 1: Create frontend directory and package.json**

```bash
mkdir -p goenchan/frontend/src
cd goenchan/frontend
```

Create `goenchan/frontend/package.json`:
```json
{
  "name": "goenchan-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.47",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.33",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.11"
  }
}
```

**Step 2: Create Vite configuration**

Create `goenchan/frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

**Step 3: Create TypeScript configurations**

Create `goenchan/frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `goenchan/frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 4: Create HTML entry point**

Create `goenchan/frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Goenchan - Founder Visibility Checker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 5: Create Tailwind configuration**

Create `goenchan/frontend/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Create `goenchan/frontend/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 6: Create gitignore and env example**

Create `goenchan/frontend/.gitignore`:
```
node_modules
dist
.env
.env.local
*.log
```

Create `goenchan/frontend/.env.example`:
```
VITE_API_BASE_URL=http://localhost:8787
```

**Step 7: Install dependencies**

```bash
cd goenchan/frontend
npm install
```

Expected: Dependencies installed successfully

**Step 8: Commit**

```bash
git add goenchan/frontend/
git commit -m "feat: initialize React frontend project with Vite

- Add package.json with React, Vite, and TailwindCSS
- Add Vite and TypeScript configurations
- Add TailwindCSS and PostCSS configurations
- Create HTML entry point
- Add gitignore and env example"
```

---

## Task 6: Create React UI Components

**Files:**
- Create: `goenchan/frontend/src/main.tsx`
- Create: `goenchan/frontend/src/App.tsx`
- Create: `goenchan/frontend/src/index.css`
- Create: `goenchan/frontend/src/api.ts`
- Create: `goenchan/frontend/src/types.ts`

**Step 1: Create main entry point**

Create `goenchan/frontend/src/main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

**Step 2: Create CSS with Tailwind**

Create `goenchan/frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Step 3: Create TypeScript types**

Create `goenchan/frontend/src/types.ts`:
```typescript
export interface FounderVisibilityResponse {
  url: string;
  founder_visibility: boolean;
  evidence: string[];
  checked_urls: string[];
  hit_keywords: string[];
}

export interface OutreachGenerateResponse {
  eligible: boolean;
  subject?: string;
  body?: string;
  evidence?: string[];
  reason?: string;
}
```

**Step 4: Create API client**

Create `goenchan/frontend/src/api.ts`:
```typescript
import type { FounderVisibilityResponse, OutreachGenerateResponse } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export async function checkFounderVisibility(url: string): Promise<FounderVisibilityResponse> {
  const response = await fetch(`${API_BASE_URL}/api/founder-visibility`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function generateOutreach(
  companyName: string,
  url: string,
  questions: string
): Promise<OutreachGenerateResponse> {
  const response = await fetch(`${API_BASE_URL}/api/outreach/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ companyName, url, questions }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
```

**Step 5: Create main App component**

Create `goenchan/frontend/src/App.tsx`:
```tsx
import React, { useState } from 'react';
import { checkFounderVisibility, generateOutreach } from './api';
import type { FounderVisibilityResponse, OutreachGenerateResponse } from './types';

function App() {
  const [companyName, setCompanyName] = useState('');
  const [url, setUrl] = useState('');
  const [questions, setQuestions] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibilityResult, setVisibilityResult] = useState<FounderVisibilityResponse | null>(null);
  const [outreachResult, setOutreachResult] = useState<OutreachGenerateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCheckedUrls, setShowCheckedUrls] = useState(false);

  const handleCheck = async () => {
    if (!url) {
      setError('URLを入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setVisibilityResult(null);
    setOutreachResult(null);
    setShowCheckedUrls(false);

    try {
      const result = await checkFounderVisibility(url);
      setVisibilityResult(result);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!companyName || !url || !questions) {
      setError('会社名、URL、質問をすべて入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setOutreachResult(null);

    try {
      const result = await generateOutreach(companyName, url, questions);
      setOutreachResult(result);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('コピーしました');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Goenchan - Founder Visibility Checker
          </h1>
          <p className="text-gray-600">
            企業サイトから創業者・CEOの情報を検出し、アウトリーチメールを生成します
          </p>
        </header>

        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会社名
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="例: 株式会社サンプル"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                会社URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                質問内容
              </label>
              <textarea
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
                placeholder="例: 創業のきっかけは？"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleCheck}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '処理中...' : '判定する'}
              </button>

              <button
                onClick={handleGenerate}
                disabled={loading || !visibilityResult?.founder_visibility}
                className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? '生成中...' : '文面を生成'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Visibility Result */}
        {visibilityResult && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">判定結果</h2>

            <div className="mb-4">
              <span className="text-sm font-medium text-gray-700">Founder Visibility: </span>
              <span className={`font-bold ${visibilityResult.founder_visibility ? 'text-green-600' : 'text-red-600'}`}>
                {visibilityResult.founder_visibility ? 'TRUE' : 'FALSE'}
              </span>
            </div>

            {visibilityResult.evidence.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">証拠URL:</h3>
                <ul className="list-disc list-inside space-y-1">
                  {visibilityResult.evidence.map((evidenceUrl, idx) => (
                    <li key={idx}>
                      <a
                        href={evidenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {evidenceUrl}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {visibilityResult.hit_keywords.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">検出キーワード:</h3>
                <div className="flex flex-wrap gap-2">
                  {visibilityResult.hit_keywords.map((keyword, idx) => (
                    <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <button
                onClick={() => setShowCheckedUrls(!showCheckedUrls)}
                className="text-sm text-gray-600 hover:text-gray-900 underline"
              >
                {showCheckedUrls ? '確認済みURLを隠す' : `確認済みURL (${visibilityResult.checked_urls.length}件) を表示`}
              </button>

              {showCheckedUrls && (
                <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-gray-600">
                  {visibilityResult.checked_urls.map((checkedUrl, idx) => (
                    <li key={idx}>{checkedUrl}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Outreach Result */}
        {outreachResult && (
          <div className="bg-white rounded-lg shadow-md p-6">
            {outreachResult.eligible ? (
              <>
                <h2 className="text-xl font-semibold mb-4">生成された文面</h2>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">件名:</h3>
                    <button
                      onClick={() => copyToClipboard(outreachResult.subject || '')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      コピー
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200">
                    {outreachResult.subject}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-700">本文:</h3>
                    <button
                      onClick={() => copyToClipboard(outreachResult.body || '')}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      コピー
                    </button>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border border-gray-200 whitespace-pre-wrap">
                    {outreachResult.body}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">
                  この企業は対象外です（Founder Visibilityが検出されませんでした）
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
```

**Step 6: Test the frontend locally**

Create `.env` file:
```bash
echo "VITE_API_BASE_URL=http://localhost:8787" > goenchan/frontend/.env
```

Start dev server:
```bash
cd goenchan/frontend
npm run dev
```

Expected: Frontend starts on http://localhost:5173

**Step 7: Manual testing**

1. Start worker in one terminal: `cd goenchan/worker && npx wrangler dev`
2. Start frontend in another: `cd goenchan/frontend && npm run dev`
3. Open browser to http://localhost:5173
4. Test form inputs and button interactions

Expected: UI renders correctly, buttons enable/disable properly

**Step 8: Commit**

```bash
git add goenchan/frontend/src/
git commit -m "feat: create React UI components

- Add main.tsx entry point and index.css with Tailwind
- Add TypeScript types for API responses
- Add API client with environment variable support
- Create App component with form inputs and result displays
- Add copy-to-clipboard functionality for email content
- Show/hide checked URLs with toggle button
- Enable generate button only when founder_visibility is true"
```

---

## Task 7: Create Project Documentation

**Files:**
- Create: `goenchan/README.md`

**Step 1: Create comprehensive README**

Create `goenchan/README.md`:
```markdown
# Goenchan - Founder Visibility Detection System

企業ウェブサイトから創業者・CEOの情報を検出し、アウトリーチメールを自動生成するシステムです。

## プロジェクト構成

```
goenchan/
├── worker/          # Cloudflare Workers バックエンド
│   ├── src/
│   │   ├── index.ts
│   │   ├── handlers/
│   │   └── utils/
│   ├── package.json
│   └── wrangler.toml
└── frontend/        # React フロントエンド
    ├── src/
    │   ├── App.tsx
    │   ├── api.ts
    │   └── types.ts
    ├── package.json
    └── vite.config.ts
```

## 機能

### バックエンド (Cloudflare Workers)

#### POST /api/founder-visibility

企業URLから創業者・CEOの可視性を判定します。

**リクエスト:**
```json
{
  "url": "https://example.com"
}
```

**レスポンス:**
```json
{
  "url": "https://example.com",
  "founder_visibility": true,
  "evidence": ["https://example.com/message"],
  "checked_urls": ["https://example.com", "https://example.com/about", ...],
  "hit_keywords": ["代表挨拶", "CEO", "Founder"]
}
```

**検出ロジック:**
- 最大5ページをチェック（トップページ + 4ページ）
- 候補リンクを自動検出: `/about`, `/company`, `/message`, `/ceo` など
- キーワード検出: `代表挨拶`, `社長挨拶`, `代表メッセージ`, `代表取締役`, `CEO`, `Founder`
- robots.txt を軽くチェック（Disallow: / の場合はスキップ）
- 各ページのタイムアウト: 8秒

#### POST /api/outreach/generate

創業者が検出された企業向けにアウトリーチメールを生成します。

**リクエスト:**
```json
{
  "companyName": "株式会社サンプル",
  "url": "https://example.com",
  "questions": "創業のきっかけは？"
}
```

**レスポンス（eligible=true の場合）:**
```json
{
  "eligible": true,
  "subject": "ライブ配信出演のご相談（Goenchan）",
  "body": "...",
  "evidence": ["https://example.com/message"]
}
```

**レスポンス（eligible=false の場合）:**
```json
{
  "eligible": false,
  "reason": "founder_visibility_false"
}
```

### フロントエンド (React + Vite)

- 会社名、URL、質問内容を入力
- 「判定する」ボタンで創業者可視性をチェック
- 結果表示: TRUE/FALSE、証拠URL、検出キーワード、確認済みURL
- 「文面を生成」ボタン（founder_visibility=true の場合のみ有効）
- 件名・本文の表示とコピー機能

## セットアップ & 起動

### バックエンド (Worker)

```bash
# ディレクトリ移動
cd goenchan/worker

# 依存関係インストール
npm install

# ローカル開発サーバー起動
npx wrangler dev

# デプロイ
npx wrangler deploy
```

### フロントエンド

```bash
# ディレクトリ移動
cd goenchan/frontend

# 依存関係インストール
npm install

# 環境変数設定（必要に応じて編集）
cp .env.example .env

# 開発サーバー起動
npm run dev

# プロダクションビルド
npm run build

# プロダクションプレビュー
npm run preview
```

### 環境変数

フロントエンドの `.env` ファイル:

```
VITE_API_BASE_URL=http://localhost:8787
```

本番環境では、デプロイ先のWorker URLに変更してください。

## APIテスト (curl)

### Founder Visibility チェック

```bash
curl -X POST http://localhost:8787/api/founder-visibility \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Outreach Email 生成

```bash
curl -X POST http://localhost:8787/api/outreach/generate \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "株式会社サンプル",
    "url": "https://example.com",
    "questions": "創業のきっかけは何ですか？"
  }'
```

## 技術スタック

- **バックエンド:** TypeScript, Cloudflare Workers, htmlparser2
- **フロントエンド:** React, TypeScript, Vite, TailwindCSS
- **デプロイ:** Wrangler (Cloudflare Workers)

## 制約事項

- ヘッドレスブラウザ不使用（HTTP fetch + HTMLパースのみ）
- ファイルシステム不使用（Cloudflare Workers環境）
- 最大5ページ/ドメイン
- 各ページ8秒タイムアウト
- 同一ドメインのみクロール

## 開発者向け情報

### ディレクトリ構造

```
goenchan/
├── worker/
│   ├── src/
│   │   ├── index.ts              # メインエントリーポイント
│   │   ├── handlers/
│   │   │   ├── founderVisibility.ts
│   │   │   └── outreachGenerate.ts
│   │   └── utils/
│   │       ├── fetcher.ts        # HTTP fetch with timeout
│   │       ├── parser.ts         # HTML parsing & keyword detection
│   │       └── robots.ts         # robots.txt checker
│   ├── package.json
│   ├── wrangler.toml
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── App.tsx               # メインUIコンポーネント
    │   ├── main.tsx              # エントリーポイント
    │   ├── api.ts                # API クライアント
    │   ├── types.ts              # TypeScript 型定義
    │   └── index.css             # TailwindCSS
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── index.html
```

## ライセンス

Private - Goenchan用カスタム開発
```

**Step 2: Commit**

```bash
git add goenchan/README.md
git commit -m "docs: add comprehensive README for Goenchan project

- Add project structure overview
- Document API endpoints and request/response formats
- Add setup and startup instructions for worker and frontend
- Include curl examples for testing
- Document tech stack and constraints
- Add directory structure reference"
```

---

## Task 8: Final Integration Testing

**Files:**
- No new files, testing only

**Step 1: Start both services**

Terminal 1 (Worker):
```bash
cd goenchan/worker
npx wrangler dev
```

Terminal 2 (Frontend):
```bash
cd goenchan/frontend
npm run dev
```

Expected:
- Worker running on http://localhost:8787
- Frontend running on http://localhost:5173

**Step 2: Test founder visibility endpoint directly**

```bash
curl -X POST http://localhost:8787/api/founder-visibility \
  -H "Content-Type: application/json" \
  -d '{"url": "https://anthropic.com"}'
```

Expected: JSON response with `founder_visibility`, `evidence`, `checked_urls`, `hit_keywords`

**Step 3: Test outreach generation endpoint directly**

```bash
curl -X POST http://localhost:8787/api/outreach/generate \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Anthropic",
    "url": "https://anthropic.com",
    "questions": "AIの未来についてどう考えていますか？"
  }'
```

Expected: JSON response with `eligible`, `subject`, `body`, `evidence`

**Step 4: Test frontend UI manually**

1. Open http://localhost:5173 in browser
2. Enter test data:
   - 会社名: "テスト株式会社"
   - 会社URL: "https://example.com"
   - 質問内容: "創業のきっかけは？"
3. Click "判定する" button
4. Verify result display (TRUE/FALSE, evidence links, checked URLs toggle)
5. If TRUE, click "文面を生成" button
6. Verify email subject and body display
7. Test copy buttons for subject and body

Expected: All UI interactions work correctly, data flows from backend to frontend

**Step 5: Test CORS**

Open browser console on http://localhost:5173 and check for CORS errors in Network tab.

Expected: No CORS errors, all requests succeed with 200 status

**Step 6: Test error handling**

1. Enter invalid URL (e.g., "not-a-url")
2. Click "判定する"
3. Verify error message displays

Expected: User-friendly error message shown in red box

**Step 7: Test edge cases**

1. Empty URL → Error message
2. URL that times out → Returns false with no evidence
3. URL with robots.txt disallow → Returns false with no evidence
4. Generate without checking first → Button disabled

Expected: All edge cases handled gracefully

**Step 8: Document test results**

No commit needed - this is verification only.

---

## Summary

This plan creates a complete standalone Goenchan system with:

1. **Cloudflare Workers backend** with TypeScript
   - Founder visibility detection (max 5 pages)
   - Japanese email generation with placeholders preserved
   - robots.txt checking
   - CORS enabled

2. **React frontend** with Vite + TailwindCSS
   - Form inputs for company name, URL, questions
   - Visibility check with collapsible results
   - Email generation (enabled only when eligible)
   - Copy-to-clipboard functionality

3. **Complete documentation**
   - Setup instructions
   - API documentation
   - curl examples
   - Development guide

The system is completely independent from the existing FastAPI backend and uses modern web technologies suitable for Cloudflare Workers and Lovable integration.
