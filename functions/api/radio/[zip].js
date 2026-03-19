export async function onRequestGet(context) {
  const { zip } = context.params;
  if (!zip || !/^JP\d{7}$/.test(zip)) {
    return new Response(JSON.stringify({ error: 'invalid zip' }), {
      status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
  const result = await context.env.MASCOT_D1.prepare(
    'SELECT zip, date, audio_url, title, script_text FROM radio_episodes WHERE zip = ? ORDER BY date DESC LIMIT 30'
  ).bind(zip).all();
  return new Response(JSON.stringify({ episodes: result.results || [] }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
