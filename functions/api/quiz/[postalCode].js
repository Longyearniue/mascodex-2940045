/**
 * Pages Function: /api/quiz/:postalCode
 *
 * Returns quiz questions for a given 7-digit Japanese postal code.
 * KV key format: quiz:1000000
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestGet(context) {
  const postalCode = context.params.postalCode;

  // Normalize: strip hyphens, validate 7 digits
  const normalized = postalCode.replace(/-/g, '');
  if (!/^\d{7}$/.test(normalized)) {
    return jsonResponse({ error: 'Invalid postal code' }, 400);
  }

  try {
    const data = await context.env.GAME_KV.get(`quiz:${normalized}`, 'json');

    if (!data) {
      return jsonResponse(
        { error: 'この郵便番号のクイズはまだ準備中です' },
        404
      );
    }

    return jsonResponse(data);
  } catch (err) {
    console.error('Quiz KV error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
