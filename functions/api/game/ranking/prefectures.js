import { jsonResponse, errorResponse, corsResponse, getTodayJST } from '../_lib/helpers.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    // Get the latest period
    const latestPeriod = await env.GAME_DB.prepare(
      'SELECT period FROM prefecture_scores ORDER BY period DESC LIMIT 1'
    ).first();

    if (!latestPeriod) {
      // No rankings yet, return default
      return jsonResponse({ success: true, rankings: [], period: null });
    }

    const period = latestPeriod.period;

    // Get current rankings
    const currentRankings = await env.GAME_DB.prepare(
      'SELECT * FROM prefecture_scores WHERE period = ? ORDER BY rank ASC'
    ).bind(period).all();

    // Get previous day rankings for rank change arrows
    const yesterday = new Date(new Date(period).getTime() - 86400000).toISOString().split('T')[0];
    const prevRankings = await env.GAME_DB.prepare(
      'SELECT prefecture, rank FROM prefecture_scores WHERE period = ?'
    ).bind(yesterday).all();

    const prevRankMap = {};
    for (const r of prevRankings.results) {
      prevRankMap[r.prefecture] = r.rank;
    }

    // Get player counts per prefecture
    const playerCounts = await env.GAME_DB.prepare(
      'SELECT prefecture, COUNT(*) as count FROM players GROUP BY prefecture'
    ).all();
    const playerCountMap = {};
    for (const p of playerCounts.results) {
      playerCountMap[p.prefecture] = p.count;
    }

    const rankings = currentRankings.results.map(r => {
      const prevRank = prevRankMap[r.prefecture];
      const rankChange = prevRank ? prevRank - r.rank : 0; // positive = moved up
      return {
        prefecture: r.prefecture,
        rank: r.rank,
        rankChange,
        totalScore: r.total_score,
        defenseRate: r.defense_rate,
        activeRate: r.active_rate,
        avgHp: r.avg_hp,
        defeatCount: r.defeat_count,
        playerCount: playerCountMap[r.prefecture] || 0,
      };
    });

    return jsonResponse({
      success: true,
      rankings,
      period,
    });
  } catch (err) {
    console.error('Rankings error:', err);
    return errorResponse('Internal server error', 500);
  }
}
