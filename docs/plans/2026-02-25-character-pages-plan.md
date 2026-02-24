# 12万体キャラクターページ + チャット機能 実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 124,550体のゆるキャラのSEO対応静的ページをR2に生成し、Claude APIチャット機能を付ける

**Architecture:** Node.jsスクリプトで既存キャラページ(jp{xx}.mascodex.com)からデータ取得→HTML生成→R2アップロード。チャットはPages Functions + Claude API。

**Tech Stack:** Node.js, Cloudflare R2 (S3互換API), Pages Functions, Claude API (claude-haiku-4-5), cheerio (HTMLパース)

---

## Task 1: R2バケット作成と設定

**Files:**
- Modify: `wrangler.toml`

**Step 1: R2バケット作成**

Run:
```bash
npx wrangler r2 bucket create mascodex-characters
```
Expected: `Created bucket mascodex-characters`

**Step 2: wrangler.toml にR2バインディング追加**

`wrangler.toml` の末尾に追加:
```toml

[[r2_buckets]]
binding = "CHAR_R2"
bucket_name = "mascodex-characters"
```

**Step 3: ANTHROPIC_API_KEY シークレット追加**

Run:
```bash
npx wrangler pages secret put ANTHROPIC_API_KEY --project-name mascodex-2940045
```
ユーザーにAPIキーの入力を求める。

**Step 4: Commit**

```bash
git add wrangler.toml
git commit -m "feat: add R2 bucket binding for character pages"
```

---

## Task 2: キャラクターデータ取得・HTMLパーサー

**Files:**
- Create: `scripts/generate-character-pages/package.json`
- Create: `scripts/generate-character-pages/parse.js`

**Step 1: プロジェクトセットアップ**

```bash
mkdir -p scripts/generate-character-pages
cd scripts/generate-character-pages
npm init -y
npm install cheerio
```

**Step 2: パーサー作成**

`scripts/generate-character-pages/parse.js`:
```javascript
const cheerio = require('cheerio');

function parseCharacterPage(html) {
  const $ = cheerio.load(html);

  const name = $('h1').first().text().trim();
  const locationLine = $('h1').first().next('p').text().trim();
  // "〒1000001｜東京都 千代田区 千代田"
  const locationMatch = locationLine.match(/〒(\d{7})｜(.+)/);
  const postalCode = locationMatch ? locationMatch[1] : '';
  const area = locationMatch ? locationMatch[2] : '';

  // Get story text (all paragraphs after ストーリー h2)
  let story = '';
  $('div.section').each((i, el) => {
    const heading = $(el).find('h2').text().trim();
    if (heading === 'ストーリー') {
      story = $(el).find('p').map((j, p) => $(p).text().trim()).get().filter(t => t).join('\n');
    }
  });

  // Get intro text
  let intro = '';
  $('div.section').each((i, el) => {
    const heading = $(el).find('h2').text().trim();
    if (heading === '紹介') {
      intro = $(el).find('p').map((j, p) => $(p).text().trim()).get().filter(t => t).join('\n');
    }
  });

  return { name, postalCode, area, intro, story };
}

module.exports = { parseCharacterPage };
```

**Step 3: パーサーのテスト**

```bash
cd scripts/generate-character-pages
node -e "
const { parseCharacterPage } = require('./parse');
const html = \`<html><body>
<h2>東京都 千代田区 の非公式ゆるキャラページ</h2>
<h1>チヨタおりぞん</h1>
<p>〒1000001｜東京都 千代田区 千代田</p>
<div class='section'><h2>紹介</h2><p>帽子が特徴</p></div>
<div class='section'><h2>ストーリー</h2><p>小さな侍</p><p>歴史散策が好き</p></div>
</body></html>\`;
const result = parseCharacterPage(html);
console.log(JSON.stringify(result, null, 2));
if (result.name !== 'チヨタおりぞん') throw new Error('Name mismatch');
if (result.postalCode !== '1000001') throw new Error('PostalCode mismatch');
if (!result.story.includes('小さな侍')) throw new Error('Story mismatch');
console.log('All tests passed!');
"
```
Expected: `All tests passed!`

**Step 4: 実際のページでテスト**

```bash
node -e "
const { parseCharacterPage } = require('./parse');
fetch('https://jp01.mascodex.com/jp/1000001/').then(r => r.text()).then(html => {
  const result = parseCharacterPage(html);
  console.log(JSON.stringify(result, null, 2));
  if (!result.name) throw new Error('No name found');
  console.log('Live test passed!');
});
"
```

**Step 5: Commit**

```bash
git add scripts/generate-character-pages/
git commit -m "feat: add character page HTML parser"
```

---

## Task 3: HTMLテンプレート作成

**Files:**
- Create: `scripts/generate-character-pages/template.js`

**Step 1: テンプレート関数作成**

`scripts/generate-character-pages/template.js`:
```javascript
function generateCharacterHTML(char) {
  const { name, postalCode, area, intro, story } = char;
  const imgBase = 'https://img.mascodex.com/' + postalCode;
  const desc = (story || intro || name + 'は' + area + 'のゆるキャラです').slice(0, 120);
  const chatApiBase = 'https://mascodex.com/api/chat';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} - ${area}のゆるキャラ | Mascodex</title>
  <meta name="description" content="${desc}">
  <meta property="og:title" content="${name} - ${area}のゆるキャラ">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${imgBase}_01.png">
  <meta property="og:url" content="https://characters.mascodex.com/${postalCode}/">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="https://characters.mascodex.com/${postalCode}/">
  <script type="application/ld+json">
  {
    "@context":"https://schema.org",
    "@type":"Thing",
    "name":"${name}",
    "description":"${desc}",
    "image":"${imgBase}_01.png",
    "url":"https://characters.mascodex.com/${postalCode}/"
  }
  </script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans','Noto Sans JP',sans-serif;background:#0f0c29;color:#fff;min-height:100vh;}
    .container{max-width:680px;margin:0 auto;padding:20px 16px 80px;}

    /* Header */
    .header{display:flex;justify-content:space-between;align-items:center;padding:12px 0;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.08);}
    .header a{color:rgba(255,255,255,0.6);text-decoration:none;font-size:0.85rem;}
    .header a:hover{color:#fff;}
    .logo{font-weight:800;font-size:1.1rem;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}

    /* Character Card */
    .char-card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;margin-bottom:24px;}
    .char-images{display:flex;gap:4px;padding:20px 20px 0;}
    .char-images img{flex:1;aspect-ratio:1;object-fit:cover;border-radius:16px;background:rgba(255,255,255,0.03);cursor:pointer;transition:transform 0.3s;}
    .char-images img:hover{transform:scale(1.05);}
    .char-info{padding:20px;}
    .char-name{font-size:1.8rem;font-weight:800;margin-bottom:4px;}
    .char-area{color:rgba(255,255,255,0.5);font-size:0.9rem;margin-bottom:4px;}
    .char-postal{color:rgba(255,255,255,0.3);font-size:0.8rem;margin-bottom:16px;}
    .char-badge{display:inline-block;background:#ffdd57;color:#000;font-weight:700;font-size:0.75rem;padding:3px 10px;border-radius:20px;margin-bottom:16px;}

    /* Story */
    .section-title{font-size:1.1rem;font-weight:700;margin-bottom:10px;padding-left:12px;border-left:3px solid #667eea;}
    .section-text{color:rgba(255,255,255,0.75);line-height:1.8;font-size:0.95rem;margin-bottom:24px;}

    /* Chat Widget */
    .chat-widget{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;}
    .chat-header{padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);font-weight:700;display:flex;align-items:center;gap:10px;}
    .chat-header img{width:32px;height:32px;border-radius:50%;object-fit:cover;}
    .chat-messages{height:280px;overflow-y:auto;padding:16px 20px;display:flex;flex-direction:column;gap:10px;}
    .chat-msg{max-width:85%;padding:10px 14px;border-radius:16px;font-size:0.9rem;line-height:1.5;animation:fadeIn 0.3s ease;}
    .chat-msg.bot{background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.2);align-self:flex-start;border-bottom-left-radius:4px;}
    .chat-msg.user{background:rgba(233,69,96,0.15);border:1px solid rgba(233,69,96,0.2);align-self:flex-end;border-bottom-right-radius:4px;}
    .chat-msg.typing{opacity:0.5;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
    .chat-input-row{display:flex;gap:8px;padding:12px 16px;border-top:1px solid rgba(255,255,255,0.06);}
    .chat-input{flex:1;padding:10px 16px;border:1px solid rgba(255,255,255,0.1);border-radius:24px;background:rgba(255,255,255,0.05);color:#fff;font-size:0.9rem;outline:none;font-family:inherit;}
    .chat-input:focus{border-color:rgba(102,126,234,0.4);}
    .chat-input::placeholder{color:rgba(255,255,255,0.25);}
    .chat-send{padding:10px 20px;background:linear-gradient(135deg,#667eea,#764ba2);border:none;border-radius:24px;color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;transition:opacity 0.2s;}
    .chat-send:hover{opacity:0.85;}
    .chat-send:disabled{opacity:0.4;cursor:not-allowed;}

    /* Links */
    .links{display:flex;gap:10px;margin-top:24px;flex-wrap:wrap;}
    .link-btn{flex:1;min-width:140px;padding:14px;text-align:center;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:14px;color:#fff;text-decoration:none;font-size:0.85rem;font-weight:600;transition:background 0.2s;}
    .link-btn:hover{background:rgba(255,255,255,0.1);}

    /* Footer */
    .footer{text-align:center;padding:40px 0 20px;color:rgba(255,255,255,0.2);font-size:0.75rem;}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="https://mascodex.com/" class="logo">Mascodex</a>
      <div>
        <a href="https://mascodex.com/game.html">ゲーム</a>
      </div>
    </div>

    <div class="char-card">
      <div class="char-images">
        <img src="${imgBase}_01.png" alt="${name} 1" loading="eager">
        <img src="${imgBase}_02.png" alt="${name} 2" loading="lazy">
        <img src="${imgBase}_03.png" alt="${name} 3" loading="lazy">
      </div>
      <div class="char-info">
        <div class="char-badge">非公式ゆるキャラ</div>
        <h1 class="char-name">${name}</h1>
        <div class="char-area">${area}</div>
        <div class="char-postal">〒${postalCode}</div>
      </div>
    </div>

    ${intro ? '<div class="section-title">紹介</div><p class="section-text">' + escapeHtml(intro) + '</p>' : ''}

    ${story ? '<div class="section-title">ストーリー</div><p class="section-text">' + escapeHtml(story) + '</p>' : ''}

    <div class="chat-widget">
      <div class="chat-header">
        <img src="${imgBase}_01.png" alt="${name}">
        <span>${name} とおはなし</span>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-msg bot">こんにちは！${name}だよ。${area}のことなら何でも聞いてね！</div>
      </div>
      <div class="chat-input-row">
        <input type="text" class="chat-input" id="chatInput" placeholder="${name}に話しかける..." maxlength="200">
        <button class="chat-send" id="chatSend" onclick="sendChat()">送信</button>
      </div>
    </div>

    <div class="links">
      <a href="https://mascodex.com/game.html" class="link-btn">🎮 ゲームで冒険</a>
      <a href="https://mascodex.com/shop.html?char=${postalCode}" class="link-btn">🛍️ グッズを見る</a>
    </div>

    <div class="footer">&copy; 2025 Mascodex. All characters are AI-generated original designs.</div>
  </div>

  <script>
    var CHAR_NAME = ${JSON.stringify(name)};
    var POSTAL = '${postalCode}';
    var API = '${chatApiBase}';
    var history = [];

    document.getElementById('chatInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) sendChat();
    });

    async function sendChat() {
      var input = document.getElementById('chatInput');
      var msg = input.value.trim();
      if (!msg) return;
      input.value = '';

      var msgs = document.getElementById('chatMessages');
      // Add user message
      var userEl = document.createElement('div');
      userEl.className = 'chat-msg user';
      userEl.textContent = msg;
      msgs.appendChild(userEl);

      // Add typing indicator
      var typingEl = document.createElement('div');
      typingEl.className = 'chat-msg bot typing';
      typingEl.textContent = CHAR_NAME + 'が考え中...';
      msgs.appendChild(typingEl);
      msgs.scrollTop = msgs.scrollHeight;

      history.push({ role: 'user', content: msg });
      // Keep last 5 exchanges
      if (history.length > 10) history = history.slice(-10);

      var btn = document.getElementById('chatSend');
      btn.disabled = true;

      try {
        var res = await fetch(API + '/' + POSTAL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: msg, history: history })
        });
        var data = await res.json();
        typingEl.remove();

        var botEl = document.createElement('div');
        botEl.className = 'chat-msg bot';
        botEl.textContent = data.response || 'ごめんね、うまく答えられなかったよ。';
        msgs.appendChild(botEl);
        history.push({ role: 'assistant', content: data.response || '' });
      } catch (e) {
        typingEl.remove();
        var errEl = document.createElement('div');
        errEl.className = 'chat-msg bot';
        errEl.textContent = 'ごめんなさい、今お話しできないみたい。また後で話しかけてね！';
        msgs.appendChild(errEl);
      }
      msgs.scrollTop = msgs.scrollHeight;
      btn.disabled = false;
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

module.exports = { generateCharacterHTML };
```

**Step 2: テンプレート出力テスト**

```bash
node -e "
const { generateCharacterHTML } = require('./template');
const html = generateCharacterHTML({
  name: 'テストキャラ',
  postalCode: '1000001',
  area: '東京都 千代田区',
  intro: '帽子が特徴の侍',
  story: '歴史散策が好きなキャラ'
});
if (!html.includes('<title>テストキャラ')) throw new Error('Title missing');
if (!html.includes('og:image')) throw new Error('OGP missing');
if (!html.includes('chatInput')) throw new Error('Chat widget missing');
if (!html.includes('application/ld+json')) throw new Error('JSON-LD missing');
console.log('Template test passed! Length:', html.length);
"
```

**Step 3: Commit**

```bash
git add scripts/generate-character-pages/template.js
git commit -m "feat: add character page HTML template with chat widget"
```

---

## Task 4: チャットAPI (Claude API)

**Files:**
- Create: `functions/api/chat/[postalCode].js`

**Step 1: チャットAPI作成**

`functions/api/chat/[postalCode].js`:
```javascript
export async function onRequest(context) {
  const { request, env, params } = context;
  const postalCode = params.postalCode;

  // CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  if (!/^\d{7}$/.test(postalCode)) {
    return Response.json({ success: false, error: 'Invalid postal code' }, { status: 400, headers: corsHeaders });
  }

  try {
    const { message, history } = await request.json();
    if (!message || typeof message !== 'string') {
      return Response.json({ success: false, error: 'Message required' }, { status: 400, headers: corsHeaders });
    }

    // Get character profile from KV cache or fetch from source
    let profile = await env.GAME_KV.get('char_' + postalCode, { type: 'json' });
    if (!profile) {
      profile = await fetchCharacterProfile(postalCode);
      if (profile) {
        await env.GAME_KV.put('char_' + postalCode, JSON.stringify(profile), { expirationTtl: 86400 * 7 });
      }
    }

    if (!profile || !profile.name) {
      return Response.json({ success: false, error: 'Character not found' }, { status: 404, headers: corsHeaders });
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt(profile);

    // Build messages for Claude
    const messages = [];
    if (Array.isArray(history)) {
      // Include last 5 exchanges from history
      const recent = history.slice(-10);
      for (const h of recent) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: message });

    // Call Claude API
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const claudeData = await claudeRes.json();

    if (claudeData.content && claudeData.content[0]) {
      return Response.json({
        success: true,
        response: claudeData.content[0].text,
      }, { headers: corsHeaders });
    }

    return Response.json({
      success: false,
      response: 'ごめんなさい、今お話しできません。',
    }, { status: 500, headers: corsHeaders });

  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json({
      success: false,
      response: 'ごめんなさい、今お話しできません。少し待ってからもう一度試してくださいね！',
    }, { status: 500, headers: corsHeaders });
  }
}

function buildSystemPrompt(profile) {
  return `あなたは「${profile.name}」という${profile.area}の非公式ゆるキャラです。

【プロフィール】
${profile.intro || ''}

【ストーリー】
${profile.story || ''}

【地域情報】
- 所在地: ${profile.area}
- 郵便番号: 〒${profile.postalCode}

あなたはこの地域を愛し、地元の魅力を知り尽くしています。
訪問者に地元の名所、グルメ、文化、季節の行事について楽しく教えてください。

キャラクターの性格を反映した口調で話してください。
返答は2-3文の短い文章で答えてください。
一人称や語尾にキャラクターらしさを出してください。`;
}

async function fetchCharacterProfile(postalCode) {
  const p2 = parseInt(postalCode.slice(0, 2), 10);
  let subdomain;
  if (p2 < 90) subdomain = 'jp' + String(Math.floor(p2 / 10)).padStart(2, '0');
  else if (p2 <= 94) subdomain = 'jp09a';
  else subdomain = 'jp09b';

  try {
    const res = await fetch(`https://${subdomain}.mascodex.com/jp/${postalCode}/`);
    if (!res.ok) return null;
    const html = await res.text();

    // Simple HTML parsing (no cheerio in Workers)
    const nameMatch = html.match(/<h1>([^<]+)<\/h1>/);
    const locMatch = html.match(/〒\d{7}｜([^<]+)/);
    const storyMatch = html.match(/<h2>ストーリー<\/h2>\s*([\s\S]*?)(?:<\/div>|<script)/);

    let story = '';
    if (storyMatch) {
      story = storyMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    let intro = '';
    const introMatch = html.match(/<h2>紹介<\/h2>\s*([\s\S]*?)(?:<\/div>)/);
    if (introMatch) {
      intro = introMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    }

    return {
      name: nameMatch ? nameMatch[1].trim() : '',
      postalCode,
      area: locMatch ? locMatch[1].trim() : '',
      intro,
      story,
    };
  } catch (e) {
    console.error('Fetch character error:', e);
    return null;
  }
}
```

**Step 2: ローカルテスト**

```bash
cd /Users/taiichiwada/mascodex-2940045/.claude/worktrees/amoeba-city-mvp
npx wrangler pages dev . --port 8788
```

別ターミナルで:
```bash
curl -s http://localhost:8788/api/chat/1000001 \
  -X POST -H 'Content-Type: application/json' \
  -d '{"message":"こんにちは！","history":[]}' | python3 -m json.tool
```

Expected: Claude APIからキャラクターとしてのレスポンス

**Step 3: Commit**

```bash
git add functions/api/chat/
git commit -m "feat: add Claude AI chat API for all 124K characters"
```

---

## Task 5: 一括生成・アップロードスクリプト

**Files:**
- Create: `scripts/generate-character-pages/generate.js`

**Step 1: 生成スクリプト作成**

`scripts/generate-character-pages/generate.js`:
```javascript
const fs = require('fs');
const path = require('path');
const { parseCharacterPage } = require('./parse');
const { generateCharacterHTML } = require('./template');

const ZIP_TREE_PATH = path.join(__dirname, '../../backups/mascodex-top-backup/zip-tree.json');
const OUTPUT_DIR = path.join(__dirname, 'output');

function computeSubdomain(postalCode) {
  const p2 = parseInt(postalCode.slice(0, 2), 10);
  if (p2 < 90) return 'jp' + String(Math.floor(p2 / 10)).padStart(2, '0');
  if (p2 <= 94) return 'jp09a';
  return 'jp09b';
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch (e) {
      if (i === retries - 1) throw e;
    }
    await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

async function processBatch(postalCodes, batchNum, totalBatches) {
  const results = await Promise.allSettled(
    postalCodes.map(async (code) => {
      const subdomain = computeSubdomain(code);
      const url = `https://${subdomain}.mascodex.com/jp/${code}/`;
      const html = await fetchWithRetry(url);
      if (!html) return { code, success: false };

      const charData = parseCharacterPage(html);
      if (!charData.name) return { code, success: false };

      const pageHtml = generateCharacterHTML(charData);
      const dir = path.join(OUTPUT_DIR, code);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), pageHtml);

      return { code, success: true, name: charData.name };
    })
  );

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.filter(r => r.status !== 'fulfilled' || !r.value.success).length;
  console.log(`Batch ${batchNum}/${totalBatches}: ${succeeded} ok, ${failed} failed`);
  return { succeeded, failed };
}

async function main() {
  // Load all postal codes
  const zipTree = JSON.parse(fs.readFileSync(ZIP_TREE_PATH, 'utf-8'));
  const allCodes = [];
  for (const pref of Object.values(zipTree)) {
    for (const city of Object.values(pref)) {
      for (const code of Object.values(city)) {
        allCodes.push(code);
      }
    }
  }
  console.log(`Total postal codes: ${allCodes.length}`);

  // Clean output dir
  if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Process in batches of 30
  const BATCH_SIZE = 30;
  const batches = [];
  for (let i = 0; i < allCodes.length; i += BATCH_SIZE) {
    batches.push(allCodes.slice(i, i + BATCH_SIZE));
  }

  let totalOk = 0, totalFail = 0;
  for (let i = 0; i < batches.length; i++) {
    const { succeeded, failed } = await processBatch(batches[i], i + 1, batches.length);
    totalOk += succeeded;
    totalFail += failed;
    // Rate limit: 100ms between batches
    if (i < batches.length - 1) await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nDone! Generated: ${totalOk}, Failed: ${totalFail}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
}

main().catch(console.error);
```

**Step 2: 小規模テスト（10件のみ）**

```bash
cd scripts/generate-character-pages
# テスト用に10件だけ実行
node -e "
const fs = require('fs');
const path = require('path');
const { parseCharacterPage } = require('./parse');
const { generateCharacterHTML } = require('./template');

const codes = ['1000001','2940045','5300001','0640941','8120011'];
const OUTPUT = path.join(__dirname, 'test-output');
if (fs.existsSync(OUTPUT)) fs.rmSync(OUTPUT, {recursive:true});
fs.mkdirSync(OUTPUT, {recursive:true});

function computeSubdomain(c) {
  const p2 = parseInt(c.slice(0,2),10);
  if (p2<90) return 'jp'+String(Math.floor(p2/10)).padStart(2,'00');
  return p2<=94?'jp09a':'jp09b';
}

(async () => {
  for (const code of codes) {
    const sub = computeSubdomain(code);
    const res = await fetch('https://'+sub+'.mascodex.com/jp/'+code+'/');
    const html = await res.text();
    const data = parseCharacterPage(html);
    const page = generateCharacterHTML(data);
    const dir = path.join(OUTPUT, code);
    fs.mkdirSync(dir, {recursive:true});
    fs.writeFileSync(path.join(dir,'index.html'), page);
    console.log(code + ': ' + data.name + ' (' + page.length + ' bytes)');
  }
  console.log('Test complete!');
})();
"
```

**Step 3: Commit**

```bash
git add scripts/generate-character-pages/generate.js
git commit -m "feat: add bulk character page generation script"
```

---

## Task 6: R2アップロードスクリプト

**Files:**
- Create: `scripts/generate-character-pages/upload.js`

**Step 1: アップロードスクリプト作成**

`scripts/generate-character-pages/upload.js`:
```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const BUCKET = 'mascodex-characters';

async function main() {
  const dirs = fs.readdirSync(OUTPUT_DIR).filter(d =>
    fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory()
  );
  console.log(`Uploading ${dirs.length} character pages to R2...`);

  let uploaded = 0, failed = 0;
  // Upload in batches using wrangler
  for (let i = 0; i < dirs.length; i++) {
    const code = dirs[i];
    const filePath = path.join(OUTPUT_DIR, code, 'index.html');
    const key = code + '/index.html';
    try {
      execSync(
        `npx wrangler r2 object put ${BUCKET}/${key} --file=${filePath} --content-type="text/html; charset=utf-8"`,
        { stdio: 'pipe', cwd: path.join(__dirname, '../..') }
      );
      uploaded++;
    } catch (e) {
      failed++;
      console.error(`Failed: ${code}`);
    }

    if ((i + 1) % 100 === 0) {
      console.log(`Progress: ${i + 1}/${dirs.length} (${uploaded} ok, ${failed} failed)`);
    }
  }
  console.log(`\nDone! Uploaded: ${uploaded}, Failed: ${failed}`);
}

main().catch(console.error);
```

Note: wrangler r2 object put は1ファイルずつなので遅い（124K件で数時間かかる可能性）。
高速化が必要なら S3互換APIに切り替え可能だが、まずはこれで動作確認する。

**Step 2: テストアップロード（5件のみ）**

```bash
cd scripts/generate-character-pages
# test-output の5件をアップロード
node -e "
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const OUTPUT = path.join(__dirname, 'test-output');
const BUCKET = 'mascodex-characters';
const dirs = fs.readdirSync(OUTPUT).filter(d => fs.statSync(path.join(OUTPUT,d)).isDirectory());
for (const code of dirs) {
  const file = path.join(OUTPUT, code, 'index.html');
  const key = code + '/index.html';
  execSync('npx wrangler r2 object put ' + BUCKET + '/' + key + ' --file=' + file + ' --content-type=\"text/html; charset=utf-8\"', {
    stdio: 'inherit', cwd: path.join(__dirname, '../..')
  });
  console.log('Uploaded: ' + code);
}
"
```

**Step 3: R2パブリックアクセス確認**

```bash
# R2パブリックアクセスを有効化 (ダッシュボードまたはCLI)
npx wrangler r2 bucket sippy enable mascodex-characters
# カスタムドメイン設定が必要（ダッシュボードから characters.mascodex.com を追加）
```

**Step 4: Commit**

```bash
git add scripts/generate-character-pages/upload.js
git commit -m "feat: add R2 upload script for character pages"
```

---

## Task 7: サイトマップ生成

**Files:**
- Create: `scripts/generate-character-pages/sitemap.js`

**Step 1: サイトマップ生成スクリプト**

`scripts/generate-character-pages/sitemap.js`:
```javascript
const fs = require('fs');
const path = require('path');

const ZIP_TREE_PATH = path.join(__dirname, '../../backups/mascodex-top-backup/zip-tree.json');
const OUTPUT_DIR = path.join(__dirname, 'output');
const BASE_URL = 'https://characters.mascodex.com';

function main() {
  const zipTree = JSON.parse(fs.readFileSync(ZIP_TREE_PATH, 'utf-8'));

  // Group postal codes by first 2 digits
  const groups = {};
  for (const pref of Object.values(zipTree)) {
    for (const city of Object.values(pref)) {
      for (const code of Object.values(city)) {
        const prefix = code.slice(0, 2);
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(code);
      }
    }
  }

  // Generate individual sitemaps
  const sitemapFiles = [];
  for (const [prefix, codes] of Object.entries(groups)) {
    const urls = codes.map(code =>
      `  <url><loc>${BASE_URL}/${code}/</loc><changefreq>monthly</changefreq></url>`
    ).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    const filename = `sitemap-${prefix}.xml`;
    fs.writeFileSync(path.join(OUTPUT_DIR, filename), xml);
    sitemapFiles.push(filename);
  }

  // Generate sitemap index
  const indexEntries = sitemapFiles.map(f =>
    `  <sitemap><loc>${BASE_URL}/${f}</loc></sitemap>`
  ).join('\n');

  const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexEntries}
</sitemapindex>`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'sitemap-index.xml'), indexXml);

  // robots.txt
  fs.writeFileSync(path.join(OUTPUT_DIR, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap-index.xml\n`);

  console.log(`Generated ${sitemapFiles.length} sitemaps + index + robots.txt`);
}

main();
```

**Step 2: テスト実行**

```bash
node sitemap.js
ls -la output/sitemap-*.xml | head -5
head -5 output/sitemap-index.xml
cat output/robots.txt
```

**Step 3: Commit**

```bash
git add scripts/generate-character-pages/sitemap.js
git commit -m "feat: add sitemap generation for 124K character pages"
```

---

## Task 8: 全ページ生成・アップロード実行

**Step 1: 全124,550ページ生成**

```bash
cd scripts/generate-character-pages
npm install
node generate.js
```

所要時間: 約10-15分
Expected: `Done! Generated: ~124000, Failed: ~500`（一部404の可能性あり）

**Step 2: サイトマップ生成**

```bash
node sitemap.js
```

**Step 3: R2アップロード**

```bash
node upload.js
```

所要時間: wrangler CLIで1ファイルずつなので数時間かかる可能性あり。
高速化が必要なら S3互換API版に切り替える。

**Step 4: サイトマップ・robots.txtもアップロード**

```bash
# サイトマップファイルを手動アップロード
for f in output/sitemap-*.xml output/robots.txt; do
  npx wrangler r2 object put mascodex-characters/$(basename $f) --file=$f --content-type="application/xml"
done
npx wrangler r2 object put mascodex-characters/robots.txt --file=output/robots.txt --content-type="text/plain"
```

---

## Task 9: R2カスタムドメイン設定とデプロイ確認

**Step 1: R2パブリックアクセス有効化**

Cloudflareダッシュボード → R2 → mascodex-characters → Settings:
- Public access を有効化
- Custom domain: `characters.mascodex.com` を追加

**Step 2: DNS設定確認**

mascodex.com のDNS設定に `characters` CNAMEが追加されていることを確認。
（R2カスタムドメイン設定時に自動追加される場合もある）

**Step 3: ページアクセステスト**

```bash
curl -s -o /dev/null -w "%{http_code}" https://characters.mascodex.com/1000001/
# Expected: 200

curl -s https://characters.mascodex.com/1000001/ | head -5
# Expected: <!DOCTYPE html> ... チヨタおりぞん ...
```

**Step 4: チャットAPIテスト**

```bash
curl -s https://mascodex.com/api/chat/1000001 \
  -X POST -H 'Content-Type: application/json' \
  -d '{"message":"千代田区の名所を教えて！","history":[]}' | python3 -m json.tool
```

Expected: チヨタおりぞんとしてのキャラクター返答

**Step 5: サイトマップ確認**

```bash
curl -s https://characters.mascodex.com/robots.txt
curl -s https://characters.mascodex.com/sitemap-index.xml | head -10
```

**Step 6: Commit & Push**

```bash
git add -A
git commit -m "feat: deploy 124K character pages to R2 with chat"
git push origin main
```
