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
 * Look up city name from postal code via KV prefix mapping.
 * Returns { prefecture, city } or null.
 */
async function lookupCity(postalCode, env) {
  try {
    const prefix = postalCode.slice(0, 3);
    const data = await env.GAME_KV.get(`postal_${prefix}`, { type: 'json' });
    if (data && data[postalCode]) return data[postalCode];
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Fetch Wikipedia local data for a city from KV.
 * Returns wiki object with summary, landmarks, etc. or null.
 */
async function getWikiData(cityName, env) {
  try {
    const data = await env.GAME_KV.get(`wiki_${cityName}`, { type: 'json' });
    return data;
  } catch (e) { /* ignore */ }
  return null;
}

/**
 * Build wiki context string from wiki data for injection into system prompt.
 */
function buildWikiContext(wiki) {
  if (!wiki) return '';

  const parts = [];

  if (wiki.summary) {
    // Truncate to ~500 chars to save tokens
    const summary = wiki.summary.length > 500 ? wiki.summary.slice(0, 500) + '…' : wiki.summary;
    parts.push(`【地域の概要（Wikipedia）】\n${summary}`);
  }

  if (wiki.landmarks && wiki.landmarks.length > 0) {
    const landmarks = wiki.landmarks.slice(0, 8).join('、');
    parts.push(`【名所・観光スポット】\n${landmarks}`);
  }

  if (wiki.specialties && wiki.specialties.length > 0) {
    const specialties = wiki.specialties.slice(0, 6).join('、');
    parts.push(`【特産品・グルメ】\n${specialties}`);
  }

  if (wiki.events && wiki.events.length > 0) {
    const events = wiki.events.slice(0, 6).join('、');
    parts.push(`【祭り・行事】\n${events}`);
  }

  if (wiki.population) {
    parts.push(`【人口】${wiki.population}`);
  }

  if (wiki.area_km2) {
    parts.push(`【面積】${wiki.area_km2} km²`);
  }

  return parts.join('\n\n');
}

/**
 * Build the system prompt injecting character personality and regional info.
 */
function buildSystemPrompt(postalCode, profile, wikiContext) {
  const { name, area, intro, story } = profile;
  const formatted = postalCode.slice(0, 3) + '-' + postalCode.slice(3);

  const wikiSection = wikiContext ? `\n\n${wikiContext}\n` : '';

  return `あなたは「${name}」という${area}の非公式ゆるキャラです。

【プロフィール】
${intro}

【ストーリー】
${story}

【地域情報】
- 所在地: ${area}
- 郵便番号: 〒${formatted}
${wikiSection}
あなたはこの地域を愛し、地元の魅力を知り尽くしています。
訪問者に地元の名所、グルメ、文化、季節の行事について楽しく教えてください。
地域のWikipediaデータがある場合は、その知識も活用して具体的な情報を交えて話してください。

キャラクターの性格を反映した口調で話してください。
返答は2-3文の短い文章で答えてください。
一人称や語尾にキャラクターらしさを出してください。

【コンシェルジュ機能】
ユーザーが以下のような生活の困りごとを相談した場合は、返答の最後に必ず [CONCIERGE:カテゴリID] タグを付けてください。
カテゴリ:
- hospital_new: 病院初診予約
- hospital_change: 再診予約変更
- dentist: 歯医者予約
- health_check: 健康診断予約
- restaurant: レストラン予約
- karaoke: カラオケ予約
- izakaya_group: 居酒屋団体予約
- birthday: 誕生日サプライズ確認
- moving: 引越し業者比較
- internet: インターネット契約確認
- utility_start: 電気・ガス開栓予約
- move_out: 退去連絡
- aircon_repair: エアコン修理
- junk_removal: 不用品回収見積
- return_exchange: 返品・交換連絡
- plumbing: トイレ水漏れ
- locksmith: 鍵紛失
- gym_cancel: ジム解約
- subscription_cancel: サブスク解約
- newspaper_cancel: 新聞解約

例: ユーザー「水道壊れた」→「えぇ！大変だね！${name}が業者さんに電話してあげるよ！まかせて！ [CONCIERGE:plumbing]」
例: ユーザー「歯が痛い」→「痛いの辛いよね...${name}が歯医者さん予約してあげるよ！ [CONCIERGE:dentist]」

コンシェルジュタグは必ず返答テキストの最後に付け、会話の自然さを保ってください。
通常の会話（天気、観光、雑談など）にはタグを付けないでください。`;
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

    // --- Get character profile + wiki data in parallel (error-resilient) ---
    const [profile, cityInfo] = await Promise.all([
      getCharacterProfile(rawCode, env).catch(() => null),
      lookupCity(rawCode, env),
    ]);

    if (!profile) {
      return jsonResponse({
        success: true,
        response: 'ごめんなさい、キャラクターデータを読み込めませんでした。もう一度お試しください！',
      });
    }

    // Fetch wiki data for the city (non-blocking, error-resilient)
    let wikiContext = '';
    if (cityInfo && cityInfo.city) {
      const wiki = await getWikiData(cityInfo.city, env).catch(() => null);
      wikiContext = buildWikiContext(wiki);
    }

    // --- Build system prompt ---
    const systemPrompt = buildSystemPrompt(rawCode, profile, wikiContext);

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

    // --- Call Claude API with retry + fallback ---
    const MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250514'];
    let claudeData = null;
    let lastError = null;

    for (const model of MODELS) {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          }

          const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': env.ANTHROPIC_API_KEY,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: 300,
              system: systemPrompt,
              messages,
            }),
          });

          if (claudeRes.ok) {
            claudeData = await claudeRes.json();
            break;
          }

          lastError = `${model} attempt ${attempt + 1}: ${claudeRes.status}`;
          console.error('Claude API error:', lastError);

          // Don't retry on 4xx client errors (except 429 rate limit)
          if (claudeRes.status >= 400 && claudeRes.status < 500 && claudeRes.status !== 429) {
            break;
          }
        } catch (e) {
          lastError = `${model} attempt ${attempt + 1}: ${e.message}`;
          console.error('Claude fetch error:', lastError);
        }
      }
      if (claudeData) break;
    }

    if (!claudeData) {
      console.error('All Claude API attempts failed:', lastError);
      return jsonResponse({
        success: true,
        response: `わぁ、ちょっと頭がぼーっとしちゃった…ごめんね！もう一度話しかけてくれる？`,
      });
    }

    // Extract text from Claude response content blocks
    const responseText =
      claudeData.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('') || '';

    // Check for concierge tag
    const conciergeMatch = responseText.match(/\[CONCIERGE:(\w+)\]/);
    const cleanResponse = responseText.replace(/\s*\[CONCIERGE:\w+\]/, '').trim();

    const result = { success: true, response: cleanResponse };
    if (conciergeMatch) {
      result.concierge = {
        category: conciergeMatch[1],
        action: 'start_concierge',
      };
    }

    return jsonResponse(result);
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
