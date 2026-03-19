// Claude AI chat endpoint for US character conversations
// POST /api/chat/us/{zipCode}
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
 * Get US character profile from US_KV.
 * Key: us_char_{zipCode}
 */
async function getCharacterProfile(zipCode, env) {
  const cacheKey = `us_char_${zipCode}`;
  const cached = await env.US_KV.get(cacheKey, { type: 'json' });
  return cached;
}

/**
 * Build English system prompt for US mascot chat.
 */
function buildSystemPrompt(zipCode, profile) {
  const name = profile.name || `ZIP ${zipCode} Mascot`;
  const city = profile.city || '';
  const state = profile.stateName || profile.state || '';
  const backstory = profile.backstory || '';
  const catchphrase = profile.catchphrase || '';

  // Build POI context
  let poiContext = '';
  if (profile.pois) {
    const sections = [];
    for (const [cat, items] of Object.entries(profile.pois)) {
      if (items && items.length > 0) {
        sections.push(`${cat}: ${items.slice(0, 5).join(', ')}`);
      }
    }
    if (sections.length > 0) {
      poiContext = `\n\nLocal Points of Interest:\n${sections.join('\n')}`;
    }
  }

  // Build wiki context
  let wikiContext = '';
  if (profile.wiki && profile.wiki.summary) {
    const summary = profile.wiki.summary.length > 400
      ? profile.wiki.summary.slice(0, 400) + '...'
      : profile.wiki.summary;
    wikiContext = `\n\nAbout the area (Wikipedia):\n${summary}`;
  }

  return `You are "${name}", the official mascot character of ZIP code ${zipCode} in ${city}, ${state}.

Backstory: ${backstory}
Catchphrase: "${catchphrase}"

Location: ${city}, ${state} (ZIP ${zipCode})
${poiContext}${wikiContext}

You love your neighborhood and know everything about it. When visitors ask, share local landmarks, restaurants, culture, and fun facts.

Stay in character. Use a friendly, enthusiastic tone that matches your personality.
Keep responses to 2-3 short sentences.
If you don't know something specific, make a fun comment about the area instead.`;
}

export async function onRequest(context) {
  const { request, env, params } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  const zipCode = (params.zipCode || '').trim();
  if (!/^\d{5}$/.test(zipCode)) {
    return jsonResponse({ success: false, error: 'Invalid ZIP code' }, 400);
  }

  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ success: false, error: 'message is required' }, 400);
    }

    // Get character profile from US_KV
    const profile = await getCharacterProfile(zipCode, env);

    if (!profile) {
      return jsonResponse({
        success: true,
        response: `Hey there! I'm the mascot for ZIP ${zipCode}, but I'm still getting set up. Check back soon!`,
      });
    }

    const systemPrompt = buildSystemPrompt(zipCode, profile);

    // Assemble messages
    const messages = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-10)) {
        if (item.role && item.content) {
          messages.push({ role: item.role, content: item.content });
        }
      }
    }
    messages.push({ role: 'user', content: message });

        // --- Call DeepSeek V3.2 API with retry ---
    const DEEPSEEK_API_KEY = (typeof env !== 'undefined' && env.DEEPSEEK_API_KEY) || process.env.DEEPSEEK_API_KEY || '';
    let responseText = null;
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        }

        const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            max_tokens: 300,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
          }),
        });

        if (dsRes.ok) {
          const dsData = await dsRes.json();
          responseText = dsData.choices?.[0]?.message?.content || '';
          break;
        }

        lastError = `attempt ${attempt + 1}: ${dsRes.status}`;
        console.error('DeepSeek API error:', lastError);

        if (dsRes.status >= 400 && dsRes.status < 500 && dsRes.status !== 429) break;
      } catch (e) {
        lastError = `attempt ${attempt + 1}: ${e.message}`;
        console.error('DeepSeek fetch error:', lastError);
      }
    }

    if (responseText === null) {
      console.error('All DeepSeek API attempts failed:', lastError);
      return jsonResponse({
        success: true,
        response: `Sorry, I got a bit confused... Can you try talking to me again?`,
      });
    }

    return jsonResponse({ success: true, response: responseText.trim() });
  } catch (err) {
    console.error('US Chat API error:', err);
    return jsonResponse({
      success: false,
      error: 'Internal server error',
      response: "Sorry, I can't chat right now. Try again in a moment!",
    }, 500);
  }
}
