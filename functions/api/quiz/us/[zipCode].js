/**
 * Pages Function: /api/quiz/us/:zipCode
 *
 * Returns quiz questions for a given 5-digit US ZIP code.
 * KV key format: quiz_us:10001
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
  const zipCode = context.params.zipCode;

  // Normalize: strip spaces, validate 5 digits
  const normalized = zipCode.replace(/[\s-]/g, '').padStart(5, '0');
  if (!/^\d{5}$/.test(normalized)) {
    return jsonResponse({ error: 'Invalid ZIP code' }, 400);
  }

  try {
    const data = await context.env.US_KV.get(`quiz_us:${normalized}`, 'json');

    if (!data) {
      return jsonResponse(
        { error: 'Quiz not available for this ZIP code yet' },
        404
      );
    }

    return jsonResponse(data);
  } catch (err) {
    console.error('US Quiz KV error:', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
