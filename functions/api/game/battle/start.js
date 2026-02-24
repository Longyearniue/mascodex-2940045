import { jsonResponse, errorResponse, corsResponse, getPlayerId } from '../_lib/helpers.js';
import { getCharacterProfile, getCharacterStats, getCharacterElement } from '../_lib/character.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const { amoebaId } = await request.json();
    if (!amoebaId) return errorResponse('Missing amoebaId');

    // Check for existing active battle
    const existingBattle = await env.GAME_KV.get(`battle_${playerId}`, { type: 'json' });
    if (existingBattle && existingBattle.status === 'active') {
      return errorResponse('Already in battle. Finish or abandon current battle first.');
    }

    // Get the amoeba (must be active)
    const amoeba = await env.GAME_DB.prepare(
      'SELECT * FROM amoebas WHERE id = ? AND is_active = 1'
    ).bind(amoebaId).first();
    if (!amoeba) return errorResponse('Amoeba not found or already defeated');

    // Get player's team (is_team > 0, ordered by slot)
    const { results: teamRows } = await env.GAME_DB.prepare(
      'SELECT postal_code, level, xp, evolved, is_team FROM player_characters WHERE player_id = ? AND is_team > 0 ORDER BY is_team ASC'
    ).bind(playerId).all();

    if (teamRows.length === 0) {
      return errorResponse('No team members assigned. Set your team first.');
    }

    // Build team with computed stats
    const team = teamRows.map((row) => {
      const stats = getCharacterStats(row.postal_code, row.level, row.evolved);
      const element = getCharacterElement(row.postal_code);
      const profile = getCharacterProfile(row.postal_code, row.level, row.evolved);
      return {
        postalCode: row.postal_code,
        slot: row.is_team,
        level: row.level,
        element,
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        def: stats.def,
        spd: stats.spd,
        sp: stats.sp,
        spGauge: 0,
        alive: true,
        image: profile.image,
      };
    });

    // Build amoeba battle data
    const amoebaElement = amoeba.element || amoeba.type || 'fire';
    const amoebaLevel = amoeba.level || 1;
    const amoebaData = {
      name: amoeba.name,
      element: amoebaElement,
      level: amoebaLevel,
      hp: amoeba.hp,
      maxHp: amoeba.max_hp,
      atk: amoeba.atk || amoebaLevel * 8,
      def: amoeba.def || amoebaLevel * 5,
      spd: amoeba.spd || amoebaLevel * 4,
      bossType: amoeba.boss_type || 'normal',
    };

    const battleState = {
      id: crypto.randomUUID(),
      amoebaId: amoeba.id,
      amoeba: amoebaData,
      team,
      activeSlot: team[0].slot,
      turn: 1,
      log: [`バトル開始！ ${amoeba.name} (Lv.${amoebaLevel}) が現れた！`],
      status: 'active',
    };

    // Store battle state in KV with 15 min TTL
    await env.GAME_KV.put(`battle_${playerId}`, JSON.stringify(battleState), { expirationTtl: 900 });

    return jsonResponse({
      success: true,
      battle: battleState,
    });
  } catch (err) {
    console.error('Battle start error:', err);
    return errorResponse('Internal server error', 500);
  }
}
