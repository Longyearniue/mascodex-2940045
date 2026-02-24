export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

export function corsResponse() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// Extract and verify player ID from auth token
// Token format from auth.js: btoa(userId + ':' + timestamp)
export async function getPlayerId(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth) return null;
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = atob(token);
    const userId = decoded.split(':')[0];
    // Verify user exists in USER_KV
    const profile = await env.USER_KV.get(`profile_${userId}`, { type: 'json' });
    return profile ? userId : null;
  } catch {
    return null;
  }
}

// Get today's date string in JST (UTC+9)
export function getTodayJST() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split('T')[0];
}
