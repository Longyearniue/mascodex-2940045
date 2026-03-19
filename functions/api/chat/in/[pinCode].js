// Claude AI chat endpoint for India character conversations
// POST /api/chat/in/{pinCode}
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
 * Get India character profile from IN_KV.
 * Key: in_char_{pinCode}
 */
async function getCharacterProfile(pinCode, env) {
  const cacheKey = `in_char_${pinCode}`;
  const cached = await env.IN_KV.get(cacheKey, { type: 'json' });
  return cached;
}

/**
 * Build English system prompt for India mascot chat.
 */
function buildSystemPrompt(pinCode, profile) {
  const name = profile.name || `PIN ${pinCode} Mascot`;
  const city = profile.city || '';
  const stateName = profile.stateName || profile.state || '';
  const district = profile.district || '';
  const backstory = profile.backstory || '';
  const catchphrase = profile.catchphrase || '';

  // Build location string
  let location = city;
  if (district) location += `, ${district} District`;
  if (stateName) location += `, ${stateName}`;
  location += ', India';

  // Build POI context (may be empty for India initially)
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

  return `You are "${name}", the official mascot character of PIN code ${pinCode} in ${location}.

Backstory: ${backstory}
Catchphrase: "${catchphrase}"

Location: ${location} (PIN ${pinCode})
${poiContext}${wikiContext}

You love your neighborhood and know everything about it. When visitors ask, share local landmarks, restaurants, culture, festivals, and fun facts about India.

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

  const pinCode = (params.pinCode || '').trim();
  if (!/^\d{6}$/.test(pinCode)) {
    return jsonResponse({ success: false, error: 'Invalid PIN code' }, 400);
  }

  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ success: false, error: 'message is required' }, 400);
    }

    // Get character profile from IN_KV
    const profile = await getCharacterProfile(pinCode, env);

    if (!profile) {
      return jsonResponse({
        success: true,
        response: `Hey there! I'm the mascot for PIN ${pinCode}, but I'm still getting set up. Check back soon!`,
      });
    }

    const systemPrompt = buildSystemPrompt(pinCode, profile);

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
    console.error('India Chat API error:', err);
    return jsonResponse({
      success: false,
      error: 'Internal server error',
      response: "Sorry, I can't chat right now. Try again in a moment!",
    }, 500);
  }
}
