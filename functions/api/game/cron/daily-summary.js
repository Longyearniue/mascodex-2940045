import { jsonResponse, errorResponse, corsResponse, getTodayJST } from '../_lib/helpers.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const secret = request.headers.get('X-Cron-Secret');
  if (!secret || secret !== env.CRON_SECRET) return errorResponse('Unauthorized', 401);

  try {
    const today = getTodayJST();

    // 1. Calculate per-prefecture stats
    const prefStats = await env.GAME_DB.prepare(`
      SELECT
        prefecture,
        COUNT(*) as total_districts,
        AVG(hp) as avg_hp,
        SUM(CASE WHEN hp > 0 THEN 1 ELSE 0 END) as alive_districts
      FROM districts
      GROUP BY prefecture
    `).all();

    const playerStats = await env.GAME_DB.prepare(`
      SELECT
        prefecture,
        COUNT(*) as total_players,
        SUM(CASE WHEN last_login_date = ? THEN 1 ELSE 0 END) as active_players
      FROM players
      GROUP BY prefecture
    `).bind(today).all();

    // Count amoebas defeated today per prefecture
    const defeatStats = await env.GAME_DB.prepare(`
      SELECT
        d.prefecture,
        COUNT(a.id) as defeat_count
      FROM amoebas a
      JOIN districts d ON a.origin_district = d.code
      WHERE date(a.defeated_at) = ?
      GROUP BY d.prefecture
    `).bind(today).all();

    // Build maps for easy lookup
    const playerMap = {};
    for (const p of playerStats.results) {
      playerMap[p.prefecture] = p;
    }
    const defeatMap = {};
    for (const d of defeatStats.results) {
      defeatMap[d.prefecture] = d.defeat_count;
    }

    // 2. Calculate scores and rankings
    const scores = [];
    for (const pref of prefStats.results) {
      const defenseRate = pref.total_districts > 0 ? pref.alive_districts / pref.total_districts : 0;
      const ps = playerMap[pref.prefecture] || { total_players: 0, active_players: 0 };
      const activeRate = ps.total_players > 0 ? ps.active_players / ps.total_players : 0;
      const avgHp = pref.avg_hp || 0;
      const defeatCount = defeatMap[pref.prefecture] || 0;

      // Score formula: defense_rate*40 + active_rate*30 + avg_hp_pct*20 + defeat_count*10
      const totalScore = (defenseRate * 40) + (activeRate * 30) + ((avgHp / 100) * 20) + (Math.min(defeatCount, 5) * 10);

      scores.push({
        prefecture: pref.prefecture,
        defenseRate: Math.round(defenseRate * 1000) / 1000,
        activeRate: Math.round(activeRate * 1000) / 1000,
        avgHp: Math.round(avgHp * 10) / 10,
        defeatCount,
        totalScore: Math.round(totalScore * 100) / 100,
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.totalScore - a.totalScore);

    // 3. Insert/update prefecture_scores
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      const rank = i + 1;
      await env.GAME_DB.prepare(`
        INSERT INTO prefecture_scores (prefecture, period, defense_rate, active_rate, avg_hp, defeat_count, total_score, rank)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(prefecture, period) DO UPDATE SET
          defense_rate = excluded.defense_rate,
          active_rate = excluded.active_rate,
          avg_hp = excluded.avg_hp,
          defeat_count = excluded.defeat_count,
          total_score = excluded.total_score,
          rank = excluded.rank
      `).bind(s.prefecture, today, s.defenseRate, s.activeRate, s.avgHp, s.defeatCount, s.totalScore, rank).run();
    }

    // 4. Auto-expire amoebas older than 72 hours
    await env.GAME_DB.prepare(`
      UPDATE amoebas SET is_active = 0, defeated_at = datetime('now')
      WHERE is_active = 1 AND datetime(created_at, '+72 hours') < datetime('now')
    `).run();

    // 5. Super-evolution check: districts that recovered from 'fallen' to 'healthy'
    // 5% chance to evolve - store in GAME_KV
    const recoveredDistricts = await env.GAME_DB.prepare(
      "SELECT code FROM districts WHERE status = 'healthy' AND hp = max_hp"
    ).all();

    const evolved = [];
    for (const d of recoveredDistricts.results) {
      if (Math.random() < 0.05) {
        evolved.push(d.code);
        await env.GAME_KV.put(`evolved_${d.code}`, JSON.stringify({ evolvedAt: today }), { expirationTtl: 604800 }); // 7 days
      }
    }

    return jsonResponse({
      success: true,
      rankings: scores.slice(0, 10),
      totalPrefectures: scores.length,
      expiredAmoebas: 'checked',
      evolvedDistricts: evolved.length,
    });
  } catch (err) {
    console.error('Daily summary error:', err);
    return errorResponse('Internal server error', 500);
  }
}
