import { jsonResponse, errorResponse, corsResponse, getPlayerId } from './_lib/helpers.js';
import { getCharacterProfile } from './_lib/character.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    // Fetch all collected characters
    const { results: characters } = await env.GAME_DB.prepare(
      'SELECT postal_code, level, xp, evolved, is_team, acquired_at FROM player_characters WHERE player_id = ? ORDER BY acquired_at DESC'
    ).bind(playerId).all();

    // Fetch shards with count > 0
    const { results: shards } = await env.GAME_DB.prepare(
      'SELECT postal_code, count FROM character_shards WHERE player_id = ? AND count > 0'
    ).bind(playerId).all();

    // Map each collected character through getCharacterProfile
    const collected = characters.map((row) => ({
      ...getCharacterProfile(row.postal_code, row.level, row.evolved),
      xp: row.xp,
      isTeam: row.is_team,
      acquiredAt: row.acquired_at,
    }));

    return jsonResponse({
      success: true,
      collected,
      totalCollected: collected.length,
      shards: shards.map((s) => ({ postalCode: s.postal_code, count: s.count })),
    });
  } catch (err) {
    console.error('Collection error:', err);
    return errorResponse('Internal server error', 500);
  }
}
