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
    if (!player) return errorResponse('Not registered', 403);

    // Check daily share count (max 3)
    const countResult = await env.GAME_DB.prepare(
      "SELECT COUNT(*) as count FROM actions WHERE player_id = ? AND action_type = 'share' AND date(created_at) = date('now')"
    ).bind(playerId).first();
    const shareCount = countResult?.count || 0;
    if (shareCount >= 3) return jsonResponse({ success: false, error: 'Daily share limit reached', remaining: 0 });

    const hpGiven = 50;
    const xpEarned = 20;

    // Add HP to player's district
    await env.GAME_DB.prepare(
      'UPDATE districts SET hp = MIN(hp + ?, max_hp), last_updated = datetime("now") WHERE code = ?'
    ).bind(hpGiven, player.district).run();

    // Update player
    await env.GAME_DB.prepare(
      'UPDATE players SET xp = xp + ?, total_defense = total_defense + ? WHERE id = ?'
    ).bind(xpEarned, hpGiven, playerId).run();

    // Record action
    await env.GAME_DB.prepare(
      'INSERT INTO actions (player_id, action_type, district_code, hp_given, xp_earned) VALUES (?, ?, ?, ?, ?)'
    ).bind(playerId, 'share', player.district, hpGiven, xpEarned).run();

    const district = await env.GAME_DB.prepare('SELECT * FROM districts WHERE code = ?').bind(player.district).first();

    return jsonResponse({
      success: true,
      hpGiven,
      xpEarned,
      shareCountToday: shareCount + 1,
      remaining: 3 - shareCount - 1,
      district: district ? {
        code: district.code,
        hp: district.hp,
        maxHp: district.max_hp,
        status: getStatusFromHp(district.hp, district.max_hp),
      } : null,
    });
  } catch (err) {
    console.error('Share action error:', err);
    return errorResponse('Internal server error', 500);
  }
}
