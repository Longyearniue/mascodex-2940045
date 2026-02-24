import { jsonResponse, errorResponse, corsResponse, getPlayerId } from './_lib/helpers.js';
import { getCharacterProfile } from './_lib/character.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  if (request.method === 'GET') return getTeam(playerId, env);
  if (request.method === 'POST') return setTeam(playerId, request, env);

  return errorResponse('Method not allowed', 405);
}

async function getTeam(playerId, env) {
  try {
    const { results: members } = await env.GAME_DB.prepare(
      'SELECT postal_code, level, xp, evolved, is_team FROM player_characters WHERE player_id = ? AND is_team > 0 ORDER BY is_team ASC'
    ).bind(playerId).all();

    const team = members.map((row) => ({
      slot: row.is_team,
      ...getCharacterProfile(row.postal_code, row.level, row.evolved),
      xp: row.xp,
    }));

    return jsonResponse({ success: true, team });
  } catch (err) {
    console.error('Team GET error:', err);
    return errorResponse('Internal server error', 500);
  }
}

async function setTeam(playerId, request, env) {
  try {
    const { slots } = await request.json();

    if (!Array.isArray(slots) || slots.length === 0 || slots.length > 3) {
      return errorResponse('Provide 1-3 team slots');
    }

    // Validate each slot entry
    for (const entry of slots) {
      const code = (entry.postalCode || '').replace(/[-\s]/g, '');
      if (!/^\d{7}$/.test(code)) return errorResponse(`Invalid postal code: ${entry.postalCode}`);
      if (!entry.slot || entry.slot < 1 || entry.slot > 3) return errorResponse(`Invalid slot: ${entry.slot}`);
    }

    // Verify all characters are owned by this player
    for (const entry of slots) {
      const code = entry.postalCode.replace(/[-\s]/g, '');
      const owned = await env.GAME_DB.prepare(
        'SELECT postal_code FROM player_characters WHERE player_id = ? AND postal_code = ?'
      ).bind(playerId, code).first();
      if (!owned) return errorResponse(`Character not owned: ${code}`);
    }

    // Clear current team
    await env.GAME_DB.prepare(
      'UPDATE player_characters SET is_team = 0 WHERE player_id = ?'
    ).bind(playerId).run();

    // Set new team slots
    for (const entry of slots) {
      const code = entry.postalCode.replace(/[-\s]/g, '');
      await env.GAME_DB.prepare(
        'UPDATE player_characters SET is_team = ? WHERE player_id = ? AND postal_code = ?'
      ).bind(entry.slot, playerId, code).run();
    }

    // Return the updated team
    return getTeam(playerId, env);
  } catch (err) {
    console.error('Team POST error:', err);
    return errorResponse('Internal server error', 500);
  }
}
