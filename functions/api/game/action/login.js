import { jsonResponse, errorResponse, corsResponse, getPlayerId, getTodayJST } from '../_lib/helpers.js';
import { getStatusFromHp } from '../_lib/districts.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const player = await env.GAME_DB.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();
    if (!player) return errorResponse('Not registered. Play the game first.', 403);

    const today = getTodayJST();
    if (player.last_login_date === today) {
      return jsonResponse({ success: false, error: 'Already claimed today', alreadyClaimed: true });
    }

    // Calculate consecutive days
    const yesterday = new Date(new Date().getTime() + 9 * 60 * 60 * 1000 - 86400000).toISOString().split('T')[0];
    const consecutiveDays = player.last_login_date === yesterday ? player.consecutive_days + 1 : 1;

    // HP bonus: base 10, +2 per consecutive day (max +10 bonus)
    const hpBonus = 10 + Math.min(consecutiveDays, 5) * 2;
    const xpEarned = 5 + consecutiveDays;

    // Update district HP
    await env.GAME_DB.prepare(
      'UPDATE districts SET hp = MIN(hp + ?, max_hp), last_updated = datetime("now") WHERE code = ?'
    ).bind(hpBonus, player.district).run();

    // Update player
    await env.GAME_DB.prepare(
      'UPDATE players SET last_login_date = ?, consecutive_days = ?, xp = xp + ?, total_defense = total_defense + ? WHERE id = ?'
    ).bind(today, consecutiveDays, xpEarned, hpBonus, playerId).run();

    // Insert action
    await env.GAME_DB.prepare(
      'INSERT INTO actions (player_id, action_type, district_code, hp_given, xp_earned) VALUES (?, ?, ?, ?, ?)'
    ).bind(playerId, 'login', player.district, hpBonus, xpEarned).run();

    // Get updated district
    const district = await env.GAME_DB.prepare('SELECT * FROM districts WHERE code = ?').bind(player.district).first();

    return jsonResponse({
      success: true,
      hpGiven: hpBonus,
      xpEarned,
      consecutiveDays,
      district: {
        code: district.code,
        hp: district.hp,
        maxHp: district.max_hp,
        status: getStatusFromHp(district.hp, district.max_hp),
      },
    });
  } catch (err) {
    console.error('Login action error:', err);
    return errorResponse('Internal server error', 500);
  }
}
