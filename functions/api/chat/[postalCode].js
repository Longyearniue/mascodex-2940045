// Claude AI chat endpoint for character conversations
// POST /api/chat/{postalCode}
// Body: { message: string, history?: Array<{role, content}> }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/**
 * Determine the mascodex subdomain for a given postal code.
 * p2 = first two digits as integer:
 *   p2 < 90  -> 'jp' + floor(p2/10) zero-padded to 2 digits
 *   p2 <= 94 -> 'jp09a'
 *   else     -> 'jp09b'
 */
function getSubdomain(postalCode) {
  const p2 = parseInt(postalCode.slice(0, 2), 10);
  if (p2 < 90) {
    return 'jp' + String(Math.floor(p2 / 10)).padStart(2, '0');
  }
  if (p2 <= 94) {
    return 'jp09a';
  }
  return 'jp09b';
}

/**
 * Fetch and parse character profile from mascodex.com HTML page.
 * Uses regex extraction (no cheerio in Workers).
 */
async function fetchCharacterFromSite(postalCode) {
  const subdomain = getSubdomain(postalCode);
  const url = `https://${subdomain}.mascodex.com/jp/${postalCode}/`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'MascodexChat/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch character page: ${res.status} from ${url}`);
  }

  const html = await res.text();

  // Extract name from <h1> tag
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const name = nameMatch ? nameMatch[1].trim() : `キャラ${postalCode}`;

  // Extract area from postal code line: 〒1234567｜Area Name
  const areaMatch = html.match(/〒\d{7}｜([^<\n]+)/);
  const area = areaMatch ? areaMatch[1].trim() : '不明な地域';

  // Extract intro: everything between 紹介 heading and end of its section
  const introSectionMatch = html.match(/<h2>紹介<\/h2>([\s\S]*?)<\/div>/);
  const intro = introSectionMatch
    ? introSectionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  // Extract story: everything between ストーリー heading and end of its section
  const storySectionMatch = html.match(/<h2>ストーリー<\/h2>([\s\S]*?)(?:<\/div>|<script)/);
  const story = storySectionMatch
    ? storySectionMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return { name, area, intro, story };
}

/**
 * Get character profile — from KV cache or fetch from site.
 * Cache key: char_{postalCode}, TTL: 7 days.
 */
async function getCharacterProfile(postalCode, env) {
  const cacheKey = `char_${postalCode}`;

  // Try KV cache first
  const cached = await env.GAME_KV.get(cacheKey, { type: 'json' });
  if (cached) return cached;

  // Fetch from mascodex.com
  const profile = await fetchCharacterFromSite(postalCode);

  // Cache with 7-day TTL (604800 seconds)
  await env.GAME_KV.put(cacheKey, JSON.stringify(profile), {
    expirationTtl: 604800,
  });

  return profile;
}

/**
 * Build the system prompt injecting character personality and regional info.
 */
function buildSystemPrompt(postalCode, profile) {
  const { name, area, intro, story } = profile;
  const formatted = postalCode.slice(0, 3) + '-' + postalCode.slice(3);

  return `あなたは「${name}」という${area}の非公式ゆるキャラです。

【プロフィール】
${intro}

【ストーリー】
${story}

【地域情報】
- 所在地: ${area}
- 郵便番号: 〒${formatted}

あなたはこの地域を愛し、地元の魅力を知り尽くしています。
訪問者に地元の名所、グルメ、文化、季節の行事について楽しく教えてください。

キャラクターの性格を反映した口調で話してください。
返答は2-3文の短い文章で答えてください。
一人称や語尾にキャラクターらしさを出してください。`;
}

export async function onRequest(context) {
  const { request, env, params } = context;

  // --- CORS preflight ---
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // --- POST only ---
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  // --- Validate postal code ---
  const rawCode = (params.postalCode || '').replace(/[-\s]/g, '');
  if (!/^\d{7}$/.test(rawCode)) {
    return jsonResponse(
      { success: false, error: 'Invalid postal code - must be 7 digits' },
      400
    );
  }

  try {
    // --- Parse request body ---
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse(
        { success: false, error: 'message is required and must be a string' },
        400
      );
    }

    // --- Get character profile (cached or fetched) ---
    const profile = await getCharacterProfile(rawCode, env);

    // --- Build system prompt ---
    const systemPrompt = buildSystemPrompt(rawCode, profile);

    // --- Assemble messages: last 10 history items + current message ---
    const messages = [];
    if (Array.isArray(history)) {
      const recent = history.slice(-10);
      for (const item of recent) {
        if (item.role && item.content) {
          messages.push({ role: item.role, content: item.content });
        }
      }
    }
    messages.push({ role: 'user', content: message });

    // --- Call Claude API ---
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
        messages,
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      console.error('Claude API error:', claudeRes.status, errBody);
      return jsonResponse(
        { success: false, error: 'AI service error' },
        502
      );
    }

    const claudeData = await claudeRes.json();

    // Extract text from Claude response content blocks
    const responseText =
      claudeData.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('') || '';

    return jsonResponse({ success: true, response: responseText });
  } catch (err) {
    console.error('Chat API error:', err);
    return jsonResponse(
      {
        success: false,
        error: 'Internal server error',
        response:
          'ごめんなさい、今お話しできません。少し待ってからもう一度試してくださいね！',
      },
      500
    );
  }
}
