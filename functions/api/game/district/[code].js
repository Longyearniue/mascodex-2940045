import { jsonResponse, errorResponse, corsResponse } from '../_lib/helpers.js';
import { getStatusFromHp } from '../_lib/districts.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const code = params.code;
  if (!code || !/^\d{3}$/.test(code)) return errorResponse('Invalid district code');

  try {
    const district = await env.GAME_DB.prepare('SELECT * FROM districts WHERE code = ?').bind(code).first();
    if (!district) return errorResponse('District not found', 404);

    // Get active amoebas affecting this district
    const amoebas = await env.GAME_DB.prepare(
      "SELECT * FROM amoebas WHERE is_active = 1 AND current_districts LIKE ?"
    ).bind(`%"${code}"%`).all();

    // Get top defenders (players who contributed most HP today)
    const defenders = await env.GAME_DB.prepare(`
      SELECT p.id, p.postal_code, p.level, SUM(a.hp_given) as today_hp
      FROM players p
      LEFT JOIN actions a ON a.player_id = p.id AND a.district_code = ? AND date(a.created_at) = date('now')
      WHERE p.district = ?
      GROUP BY p.id
      ORDER BY today_hp DESC
      LIMIT 5
    `).bind(code, code).all();

    const status = getStatusFromHp(district.hp, district.max_hp);

    return jsonResponse({
      success: true,
      district: {
        code: district.code,
        prefecture: district.prefecture,
        name: district.name,
        hp: district.hp,
        maxHp: district.max_hp,
        status,
        playerCount: district.player_count,
        immuneUntil: district.immune_until,
        lastUpdated: district.last_updated,
      },
      amoebas: amoebas.results.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        strength: a.strength,
        hp: a.hp,
        maxHp: a.max_hp,
        weakness: a.weakness,
        createdAt: a.created_at,
      })),
      defenders: defenders.results.map(d => ({
        postalCode: d.postal_code,
        level: d.level,
        todayHp: d.today_hp || 0,
        characterImage: `https://img.mascodex.com/${d.postal_code}_01.png`,
      })),
    });
  } catch (err) {
    console.error('District detail error:', err);
    return errorResponse('Internal server error', 500);
  }
}
