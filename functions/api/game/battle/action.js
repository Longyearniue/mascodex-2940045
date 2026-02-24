import { jsonResponse, errorResponse, corsResponse, getPlayerId } from '../_lib/helpers.js';
import { getElementMultiplier, getEvolutionStage } from '../_lib/character.js';
import { getLevelFromXp } from '../_lib/districts.js';

// --- Element weakness for display ---
const WEAKNESS_MAP = {
  fire: 'water',
  water: 'thunder',
  thunder: 'earth',
  earth: 'wood',
  wood: 'fire',
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const { action, targetSlot } = await request.json();
    if (!action) return errorResponse('Missing action');

    const validActions = ['attack', 'skill', 'defend', 'switch'];
    if (!validActions.includes(action)) {
      return errorResponse(`Invalid action. Use: ${validActions.join(', ')}`);
    }

    // Load battle state from KV
    const battle = await env.GAME_KV.get(`battle_${playerId}`, { type: 'json' });
    if (!battle || battle.status !== 'active') {
      return errorResponse('No active battle found');
    }

    // Find active team member
    const active = battle.team.find((m) => m.slot === battle.activeSlot);
    if (!active || !active.alive) {
      return errorResponse('No active team member');
    }

    const amoeba = battle.amoeba;
    let defending = false;

    // --- Player Action ---
    if (action === 'attack') {
      const multiplier = getElementMultiplier(active.element, amoeba.element);
      const damage = calcDamage(active.atk, amoeba.def, multiplier);
      amoeba.hp = Math.max(0, amoeba.hp - damage);
      active.spGauge = Math.min(active.spGauge + 1, 10);
      battle.log.push(`${active.postalCode}の攻撃！ ${amoeba.name}に${damage}ダメージ！`);

    } else if (action === 'skill') {
      if (active.spGauge < 3) {
        return jsonResponse({
          success: false,
          error: 'SPゲージが足りない（3必要）',
          battle,
        });
      }

      active.spGauge -= 3;
      const result = applySkill(active, amoeba, battle);
      battle.log.push(result.message);

    } else if (action === 'defend') {
      defending = true;
      active.spGauge = Math.min(active.spGauge + 1, 10);
      battle.log.push(`${active.postalCode}は防御態勢を取った！`);

    } else if (action === 'switch') {
      if (!targetSlot) return errorResponse('Missing targetSlot for switch action');
      const target = battle.team.find((m) => m.slot === targetSlot);
      if (!target) return errorResponse('Invalid target slot');
      if (!target.alive) return errorResponse('Target member is defeated');
      if (target.slot === active.slot) return errorResponse('Already active');

      battle.activeSlot = target.slot;
      battle.log.push(`${target.postalCode}に交代！`);
    }

    // --- Check if amoeba is defeated → WIN ---
    if (amoeba.hp <= 0) {
      return await handleWin(battle, playerId, env);
    }

    // --- Amoeba attacks ---
    // Get the currently active member after potential switch
    const currentActive = battle.team.find((m) => m.slot === battle.activeSlot);
    if (currentActive && currentActive.alive) {
      const multiplier = getElementMultiplier(amoeba.element, currentActive.element);
      const defValue = defending && currentActive.slot === active.slot
        ? currentActive.def * 2
        : currentActive.def;
      const damage = calcDamage(amoeba.atk, defValue, multiplier);
      currentActive.hp = Math.max(0, currentActive.hp - damage);
      battle.log.push(`${amoeba.name}の攻撃！ ${currentActive.postalCode}に${damage}ダメージ！`);

      if (currentActive.hp <= 0) {
        currentActive.alive = false;
        battle.log.push(`${currentActive.postalCode}は倒れた！`);

        // Auto-switch to next alive member
        const nextAlive = battle.team.find((m) => m.alive && m.slot !== currentActive.slot);
        if (nextAlive) {
          battle.activeSlot = nextAlive.slot;
          battle.log.push(`${nextAlive.postalCode}が前に出た！`);
        }
      }
    }

    // --- Check if all team members are dead → LOSE ---
    const anyAlive = battle.team.some((m) => m.alive);
    if (!anyAlive) {
      return await handleLose(battle, playerId, env);
    }

    // --- Advance turn ---
    battle.turn += 1;

    // Save updated state
    await env.GAME_KV.put(`battle_${playerId}`, JSON.stringify(battle), { expirationTtl: 900 });

    return jsonResponse({
      success: true,
      battle,
    });
  } catch (err) {
    console.error('Battle action error:', err);
    return errorResponse('Internal server error', 500);
  }
}

// --- Damage formula ---
function calcDamage(atk, def, elementMultiplier = 1.0) {
  const baseDamage = Math.floor((atk * elementMultiplier) / (def * 0.5));
  const variance = Math.floor(Math.random() * Math.max(1, Math.floor(atk * 0.1)));
  return Math.max(1, baseDamage + variance);
}

// --- Skill effects ---
function applySkill(member, amoeba, battle) {
  const element = member.element;

  switch (element) {
    case 'fire': {
      // High damage attack
      const multiplier = getElementMultiplier('fire', amoeba.element);
      const damage = calcDamage(Math.floor(member.atk * 1.8), amoeba.def, multiplier);
      amoeba.hp = Math.max(0, amoeba.hp - damage);
      return { message: `ファイアストーム！ ${amoeba.name}に${damage}ダメージ！` };
    }
    case 'water': {
      // AOE effect (same damage formula, simulated as strong single hit)
      const multiplier = getElementMultiplier('water', amoeba.element);
      const damage = calcDamage(Math.floor(member.atk * 1.5), amoeba.def, multiplier);
      amoeba.hp = Math.max(0, amoeba.hp - damage);
      return { message: `ブリザード！ ${amoeba.name}に${damage}ダメージ！` };
    }
    case 'earth': {
      // DEF buff: multiply by 1.5
      member.def = Math.floor(member.def * 1.5);
      return { message: `マウンテンウォール！ 防御力が上がった！ (DEF: ${member.def})` };
    }
    case 'wood': {
      // Heal 50% of max HP
      const healAmount = Math.floor(member.maxHp * 0.5);
      member.hp = Math.min(member.maxHp, member.hp + healAmount);
      return { message: `フォレストヒール！ HPが${healAmount}回復！ (HP: ${member.hp}/${member.maxHp})` };
    }
    case 'thunder': {
      // High power attack
      const multiplier = getElementMultiplier('thunder', amoeba.element);
      const damage = calcDamage(Math.floor(member.atk * 2.0), amoeba.def, multiplier);
      amoeba.hp = Math.max(0, amoeba.hp - damage);
      return { message: `サンダーストライク！ ${amoeba.name}に${damage}ダメージ！` };
    }
    default: {
      // Generic attack if element unknown
      const damage = calcDamage(member.atk, amoeba.def);
      amoeba.hp = Math.max(0, amoeba.hp - damage);
      return { message: `スキル攻撃！ ${amoeba.name}に${damage}ダメージ！` };
    }
  }
}

// --- Win handler ---
async function handleWin(battle, playerId, env) {
  const amoeba = battle.amoeba;
  battle.status = 'win';
  battle.log.push(`${amoeba.name}を倒した！ 勝利！`);

  // Calculate XP reward
  let xpGained = (amoeba.level || 1) * 10;
  if (amoeba.bossType === 'weekly') xpGained += 100;
  if (amoeba.bossType === 'monthly') xpGained += 500;

  // Shard drop logic
  let shardDrop = null;
  const dropPostal = await env.GAME_DB.prepare(
    'SELECT drop_postal FROM amoebas WHERE id = ?'
  ).bind(battle.amoebaId).first();
  const dropCode = dropPostal?.drop_postal;

  if (dropCode) {
    let dropChance = 0.3; // normal: 30%
    if (amoeba.bossType === 'weekly') dropChance = 0.7;
    if (amoeba.bossType === 'monthly') dropChance = 1.0;

    if (Math.random() < dropChance) {
      // Add shard
      await env.GAME_DB.prepare(
        'INSERT INTO character_shards (player_id, postal_code, count) VALUES (?, ?, 1) ON CONFLICT(player_id, postal_code) DO UPDATE SET count = count + 1'
      ).bind(playerId, dropCode).run();

      // Check if shard count reached 10 → unlock character
      const shardRow = await env.GAME_DB.prepare(
        'SELECT count FROM character_shards WHERE player_id = ? AND postal_code = ?'
      ).bind(playerId, dropCode).first();

      if (shardRow && shardRow.count >= 10) {
        // Unlock the character
        await env.GAME_DB.prepare(
          'INSERT OR IGNORE INTO player_characters (player_id, postal_code, level, xp, evolved, is_team) VALUES (?, ?, 1, 0, 0, 0)'
        ).bind(playerId, dropCode).run();
        // Remove shards
        await env.GAME_DB.prepare(
          'DELETE FROM character_shards WHERE player_id = ? AND postal_code = ?'
        ).bind(playerId, dropCode).run();
        shardDrop = { postalCode: dropCode, count: 10, unlocked: true };
        battle.log.push(`シャード10個集まった！ ${dropCode}のゆるキャラを獲得！`);
      } else {
        shardDrop = { postalCode: dropCode, count: shardRow?.count || 1, unlocked: false };
        battle.log.push(`${dropCode}のシャードを獲得！ (${shardRow?.count || 1}/10)`);
      }
    }
  }

  // Award XP to all alive team members and update levels
  for (const member of battle.team) {
    if (!member.alive) continue;
    await env.GAME_DB.prepare(
      'UPDATE player_characters SET xp = xp + ? WHERE player_id = ? AND postal_code = ?'
    ).bind(xpGained, playerId, member.postalCode).run();

    // Recalculate level and evolution from new total XP
    const updated = await env.GAME_DB.prepare(
      'SELECT xp FROM player_characters WHERE player_id = ? AND postal_code = ?'
    ).bind(playerId, member.postalCode).first();

    if (updated) {
      const { level } = getLevelFromXp(updated.xp);
      const evolved = getEvolutionStage(level);
      await env.GAME_DB.prepare(
        'UPDATE player_characters SET level = ?, evolved = ? WHERE player_id = ? AND postal_code = ?'
      ).bind(level, evolved, playerId, member.postalCode).run();
    }
  }

  // Log battle
  await env.GAME_DB.prepare(
    'INSERT INTO battles (player_id, amoeba_id, result, xp_gained, drops, fought_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
  ).bind(
    playerId,
    battle.amoebaId,
    'win',
    xpGained,
    JSON.stringify(shardDrop ? [shardDrop] : [])
  ).run();

  // Mark amoeba as defeated
  await env.GAME_DB.prepare(
    'UPDATE amoebas SET is_active = 0, defeated_at = datetime("now") WHERE id = ?'
  ).bind(battle.amoebaId).run();

  // Clean up KV
  await env.GAME_KV.delete(`battle_${playerId}`);

  return jsonResponse({
    success: true,
    battle,
    rewards: {
      xpGained,
      shardDrop,
    },
  });
}

// --- Lose handler ---
async function handleLose(battle, playerId, env) {
  battle.status = 'lose';
  battle.log.push('全員倒された... 敗北...');

  // Log battle
  await env.GAME_DB.prepare(
    'INSERT INTO battles (player_id, amoeba_id, result, xp_gained, drops, fought_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
  ).bind(playerId, battle.amoebaId, 'lose', 0, '[]').run();

  // Clean up KV
  await env.GAME_KV.delete(`battle_${playerId}`);

  return jsonResponse({
    success: true,
    battle,
    rewards: null,
  });
}
