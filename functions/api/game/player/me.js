import { jsonResponse, errorResponse, corsResponse, getPlayerId } from '../_lib/helpers.js';
import { getElement, getRegion } from '../_lib/elements.js';
import { getStatusFromHp, getLevelFromXp } from '../_lib/districts.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const player = await env.GAME_DB.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();
    if (!player) return jsonResponse({ success: true, registered: false });

    const district = await env.GAME_DB.prepare('SELECT * FROM districts WHERE code = ?').bind(player.district).first();
    const element = getElement(player.prefecture);
    const region = getRegion(player.prefecture);
    const levelInfo = getLevelFromXp(player.xp);
    const status = district ? getStatusFromHp(district.hp, district.max_hp) : 'healthy';

    return jsonResponse({
      success: true,
      registered: true,
      player: {
        id: player.id,
        postalCode: player.postal_code,
        prefecture: player.prefecture,
        district: player.district,
        level: levelInfo.level,
        xp: player.xp,
        currentXp: levelInfo.currentXp,
        nextLevelXp: levelInfo.nextLevelXp,
        totalDefense: player.total_defense,
        consecutiveDays: player.consecutive_days,
        lastLoginDate: player.last_login_date,
      },
      district: district ? {
        code: district.code,
        name: district.name,
        hp: district.hp,
        maxHp: district.max_hp,
        status,
        playerCount: district.player_count,
      } : null,
      element,
      region,
      characterImage: `https://img.mascodex.com/${player.postal_code}_01.png`,
    });
  } catch (err) {
    console.error('Player me error:', err);
    return errorResponse('Internal server error', 500);
  }
}
