/**
 * Pages Function: /api/quiz/in/:pinCode
 *
 * Returns quiz questions for a given 6-digit India PIN code.
 * KV key format: quiz_in:110001
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
  const pinCode = context.params.pinCode;

  // Normalize: strip spaces, validate 6 digits
  const normalized = pinCode.replace(/[\s-]/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(normalized)) {
    return jsonResponse({ error: 'Invalid PIN code' }, 400);
  }

  try {
    const data = await context.env.IN_KV.get(`quiz_in:${normalized}`, 'json');

    if (!data) {
      return jsonResponse(
        { error: 'Quiz not available for this PIN code yet' },
        404
      );
    }

    return jsonResponse(data);
  } catch (err) {
    console.error('India Quiz KV error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
