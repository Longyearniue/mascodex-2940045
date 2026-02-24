import { jsonResponse, errorResponse, corsResponse, getPlayerId } from './_lib/helpers.js';
import { getCharacterProfile } from './_lib/character.js';

const DAILY_EXPLORE_LIMIT = 3;
const ENCOUNTER_RATE = 0.6;
const DUPLICATE_XP_BONUS = 20;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const player = await env.GAME_DB.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();
    if (!player) return errorResponse('Not registered', 403);

    // Check daily exploration limit
    const countResult = await env.GAME_DB.prepare(
      "SELECT COUNT(*) as count FROM explorations WHERE player_id = ? AND date(explored_at) = date('now')"
    ).bind(playerId).first();
    const exploreCount = countResult?.count || 0;

    if (exploreCount >= DAILY_EXPLORE_LIMIT) {
      return jsonResponse({
        success: false,
        error: 'Daily exploration limit reached',
        remaining: 0,
      });
    }

    // Pick a random district in the same prefecture (simulates nearby exploration)
    const targetDistrict = await env.GAME_DB.prepare(
      'SELECT code, prefecture FROM districts WHERE prefecture = ? AND code != ? ORDER BY RANDOM() LIMIT 1'
    ).bind(player.prefecture, player.district).first();

    // Fallback: if only one district in prefecture, pick any random district
    const district = targetDistrict || await env.GAME_DB.prepare(
      'SELECT code, prefecture FROM districts WHERE code != ? ORDER BY RANDOM() LIMIT 1'
    ).bind(player.district).first();

    if (!district) {
      return errorResponse('No districts available for exploration');
    }

    // Generate a random 7-digit postal code in the target district
    const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const foundPostal = district.code + suffix;

    // Determine encounter
    const hasEncounter = Math.random() < ENCOUNTER_RATE;
    let encounter = false;
    let duplicate = false;
    let characterProfile = null;
    let message = '';

    if (hasEncounter) {
      encounter = true;

      // Check if player already has this character
      const existing = await env.GAME_DB.prepare(
        'SELECT * FROM player_characters WHERE player_id = ? AND postal_code = ?'
      ).bind(playerId, foundPostal).first();

      if (existing) {
        // Duplicate encounter: grant XP bonus to existing character
        duplicate = true;
        const newXp = existing.xp + DUPLICATE_XP_BONUS;

        // Recalculate level from new XP
        let level = 1;
        let xpNeeded = 100;
        let remaining = newXp;
        while (remaining >= xpNeeded) {
          remaining -= xpNeeded;
          level++;
          xpNeeded = Math.floor(100 * Math.pow(1.5, level - 1));
        }

        // Determine evolution stage
        let evolved = 0;
        if (level >= 25) evolved = 2;
        else if (level >= 10) evolved = 1;

        await env.GAME_DB.prepare(
          'UPDATE player_characters SET xp = ?, level = ?, evolved = ? WHERE player_id = ? AND postal_code = ?'
        ).bind(newXp, level, evolved, playerId, foundPostal).run();

        characterProfile = getCharacterProfile(foundPostal, level, evolved);
        message = `${foundPostal}のゆるキャラに再会！ XP+${DUPLICATE_XP_BONUS}`;
      } else {
        // New character encountered: add to collection
        await env.GAME_DB.prepare(
          'INSERT INTO player_characters (player_id, postal_code, level, xp, evolved, is_team) VALUES (?, ?, 1, 0, 0, 0)'
        ).bind(playerId, foundPostal).run();

        characterProfile = getCharacterProfile(foundPostal, 1, 0);
        message = `${foundPostal}のゆるキャラを発見！ コレクションに追加`;
      }
    } else {
      message = `${district.code}地区を探索したが、何も見つからなかった...`;
    }

    // Log exploration
    await env.GAME_DB.prepare(
      'INSERT INTO explorations (player_id, district_code, found_postal, explored_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(playerId, district.code, hasEncounter ? foundPostal : null).run();

    const remaining = DAILY_EXPLORE_LIMIT - exploreCount - 1;

    return jsonResponse({
      success: true,
      explored: district.code,
      encounter,
      duplicate,
      character: characterProfile,
      message,
      remaining,
    });
  } catch (err) {
    console.error('Explore error:', err);
    return errorResponse('Internal server error', 500);
  }
}
