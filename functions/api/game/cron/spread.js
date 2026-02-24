import { jsonResponse, errorResponse, corsResponse } from '../_lib/helpers.js';

// Status from HP percentage
function getStatus(hp, maxHp) {
  const pct = (hp / maxHp) * 100;
  if (pct >= 80) return 'healthy';
  if (pct >= 50) return 'anxious';
  if (pct >= 20) return 'pain';
  if (pct > 0) return 'dark';
  return 'fallen';
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const secret = request.headers.get('X-Cron-Secret');
  if (!secret || secret !== env.CRON_SECRET) return errorResponse('Unauthorized', 401);

  try {
    // Get all active amoebas
    const amoebasResult = await env.GAME_DB.prepare(
      'SELECT * FROM amoebas WHERE is_active = 1'
    ).all();
    const amoebas = amoebasResult.results;

    if (amoebas.length === 0) {
      return jsonResponse({ success: true, message: 'No active amoebas', processed: 0 });
    }

    // Load adjacency data from GAME_KV cache or compute
    let adjacency = await env.GAME_KV.get('adjacency_map', { type: 'json' });
    if (!adjacency) {
      // First time: we need to load adjacency. Since we can't import JSON in Pages Functions,
      // we'll compute basic adjacency: sequential codes within same prefecture are adjacent.
      // For full adjacency, the admin should seed GAME_KV with the adjacency.json data.
      // For now, use simple sequential adjacency.
      const allDistricts = await env.GAME_DB.prepare(
        'SELECT code, prefecture FROM districts ORDER BY code'
      ).all();

      adjacency = {};
      const districts = allDistricts.results;
      for (let i = 0; i < districts.length; i++) {
        const code = districts[i].code;
        const neighbors = [];
        // Previous sequential code in same prefecture
        if (i > 0 && districts[i-1].prefecture === districts[i].prefecture) {
          neighbors.push(districts[i-1].code);
        }
        // Next sequential code in same prefecture
        if (i < districts.length - 1 && districts[i+1].prefecture === districts[i].prefecture) {
          neighbors.push(districts[i+1].code);
        }
        // Also add +-1 numeric neighbors regardless of prefecture (border districts)
        const codeNum = parseInt(code);
        const prev = String(codeNum - 1).padStart(3, '0');
        const next = String(codeNum + 1).padStart(3, '0');
        if (!neighbors.includes(prev) && districts.some(d => d.code === prev)) neighbors.push(prev);
        if (!neighbors.includes(next) && districts.some(d => d.code === next)) neighbors.push(next);
        adjacency[code] = neighbors;
      }

      // Cache for 24 hours
      await env.GAME_KV.put('adjacency_map', JSON.stringify(adjacency), { expirationTtl: 86400 });
    }

    let totalSpread = 0;
    let totalDamage = 0;

    for (const amoeba of amoebas) {
      const currentDistricts = JSON.parse(amoeba.current_districts || '[]');
      if (currentDistricts.length === 0) continue;

      // 1. Find adjacent districts not yet infected by this amoeba
      const adjacentCandidates = new Set();
      for (const distCode of currentDistricts) {
        const neighbors = adjacency[distCode] || [];
        for (const n of neighbors) {
          if (!currentDistricts.includes(n)) {
            adjacentCandidates.add(n);
          }
        }
      }

      // 2. Spread to the adjacent district with lowest HP
      if (adjacentCandidates.size > 0) {
        const candidates = Array.from(adjacentCandidates);
        // Get HP for all candidates
        const placeholders = candidates.map(() => '?').join(',');
        const candidateHps = await env.GAME_DB.prepare(
          `SELECT code, hp FROM districts WHERE code IN (${placeholders}) AND status != 'fallen' ORDER BY hp ASC LIMIT 1`
        ).bind(...candidates).first();

        if (candidateHps) {
          currentDistricts.push(candidateHps.code);
          totalSpread++;

          // Apply initial spread damage
          const spreadDamage = amoeba.strength * 5;
          await env.GAME_DB.prepare(
            'UPDATE districts SET hp = MAX(hp - ?, 0), last_updated = datetime("now") WHERE code = ?'
          ).bind(spreadDamage, candidateHps.code).run();
          totalDamage += spreadDamage;
        }
      }

      // 3. Apply continuing damage to all currently infected districts
      for (const distCode of currentDistricts) {
        const continuingDamage = amoeba.strength * 2;
        await env.GAME_DB.prepare(
          'UPDATE districts SET hp = MAX(hp - ?, 0), last_updated = datetime("now") WHERE code = ?'
        ).bind(continuingDamage, distCode).run();
        totalDamage += continuingDamage;
      }

      // 4. Apply pressure damage to all adjacent districts (not infected)
      for (const distCode of currentDistricts) {
        const neighbors = adjacency[distCode] || [];
        for (const n of neighbors) {
          if (!currentDistricts.includes(n)) {
            const pressureDamage = amoeba.strength;
            await env.GAME_DB.prepare(
              'UPDATE districts SET hp = MAX(hp - ?, 0), last_updated = datetime("now") WHERE code = ?'
            ).bind(pressureDamage, n).run();
          }
        }
      }

      // 5. Update amoeba's current districts
      await env.GAME_DB.prepare(
        'UPDATE amoebas SET current_districts = ? WHERE id = ?'
      ).bind(JSON.stringify(currentDistricts), amoeba.id).run();

      // 6. Check if amoeba should be defeated (HP <= 0)
      const updatedAmoeba = await env.GAME_DB.prepare('SELECT hp FROM amoebas WHERE id = ?').bind(amoeba.id).first();
      if (updatedAmoeba && updatedAmoeba.hp <= 0) {
        await env.GAME_DB.prepare(
          "UPDATE amoebas SET is_active = 0, defeated_at = datetime('now') WHERE id = ?"
        ).bind(amoeba.id).run();
      }
    }

    // 7. Natural HP recovery: all districts +1 HP, districts with players +2 extra
    await env.GAME_DB.prepare(
      'UPDATE districts SET hp = MIN(hp + 1, max_hp) WHERE hp < max_hp'
    ).run();
    await env.GAME_DB.prepare(
      'UPDATE districts SET hp = MIN(hp + 2, max_hp) WHERE player_count > 0 AND hp < max_hp'
    ).run();

    // 8. Update all district statuses
    const allDistricts = await env.GAME_DB.prepare('SELECT code, hp, max_hp FROM districts').all();
    for (const d of allDistricts.results) {
      const status = getStatus(d.hp, d.max_hp);
      await env.GAME_DB.prepare('UPDATE districts SET status = ? WHERE code = ?').bind(status, d.code).run();
    }

    return jsonResponse({
      success: true,
      processed: amoebas.length,
      totalSpread,
      totalDamage,
    });
  } catch (err) {
    console.error('Spread error:', err);
    return errorResponse('Internal server error', 500);
  }
}
