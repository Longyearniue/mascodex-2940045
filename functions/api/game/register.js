import { jsonResponse, errorResponse, corsResponse, getPlayerId, getTodayJST } from './_lib/helpers.js';
import { getElement, getRegion } from './_lib/elements.js';
import { getDistrictCode } from './_lib/districts.js';
import { getCharacterProfile } from './_lib/character.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const { postalCode } = await request.json();
    const clean = (postalCode || '').replace('-', '');
    if (!/^\d{7}$/.test(clean)) return errorResponse('Invalid postal code');

    const districtCode = getDistrictCode(clean);
    const district = await env.GAME_DB.prepare('SELECT * FROM districts WHERE code = ?').bind(districtCode).first();
    if (!district) return errorResponse('District not found');

    const today = getTodayJST();
    const element = getElement(district.prefecture);
    const region = getRegion(district.prefecture);

    // Insert player (ignore if already exists)
    await env.GAME_DB.prepare(
      'INSERT OR IGNORE INTO players (id, postal_code, prefecture, district, last_login_date) VALUES (?, ?, ?, ?, ?)'
    ).bind(playerId, clean, district.prefecture, districtCode, today).run();

    // Create starter character for the player (ignore if already exists)
    await env.GAME_DB.prepare(
      'INSERT OR IGNORE INTO player_characters (player_id, postal_code, level, xp, evolved, is_team) VALUES (?, ?, 1, 0, 0, 1)'
    ).bind(playerId, clean).run();

    // Update player count using accurate count query to prevent double-counting
    await env.GAME_DB.prepare(
      'UPDATE districts SET player_count = (SELECT COUNT(*) FROM players WHERE district = ?) WHERE code = ?'
    ).bind(districtCode, districtCode).run();

    const player = await env.GAME_DB.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();

    // Re-fetch district to get updated player_count
    const updatedDistrict = await env.GAME_DB.prepare('SELECT * FROM districts WHERE code = ?').bind(districtCode).first();

    return jsonResponse({
      success: true,
      player: {
        id: player.id,
        postalCode: player.postal_code,
        prefecture: player.prefecture,
        district: player.district,
        level: player.level,
        xp: player.xp,
        totalDefense: player.total_defense,
        consecutiveDays: player.consecutive_days,
      },
      district: {
        code: updatedDistrict.code,
        name: updatedDistrict.name,
        hp: updatedDistrict.hp,
        maxHp: updatedDistrict.max_hp,
        status: updatedDistrict.status,
        playerCount: updatedDistrict.player_count,
      },
      element,
      region,
      starter: getCharacterProfile(clean),
    });
  } catch (err) {
    console.error('Register error:', err);
    return errorResponse('Internal server error', 500);
  }
}
