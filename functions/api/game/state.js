import { jsonResponse, errorResponse, corsResponse } from './_lib/helpers.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const result = await env.GAME_DB.prepare(`
      SELECT
        prefecture,
        COUNT(*) as total_districts,
        AVG(hp) as avg_hp,
        SUM(CASE WHEN status IN ('dark', 'fallen') THEN 1 ELSE 0 END) as infected,
        SUM(player_count) as players
      FROM districts
      GROUP BY prefecture
      ORDER BY prefecture
    `).all();

    const prefectures = result.results.map((row, i) => ({
      prefecture: row.prefecture,
      totalDistricts: row.total_districts,
      avgHp: Math.round(row.avg_hp * 10) / 10,
      infected: row.infected,
      infectionRate: row.total_districts > 0 ? Math.round((row.infected / row.total_districts) * 100) / 100 : 0,
      players: row.players || 0,
    }));

    // Get active amoeba count
    const amoebaCount = await env.GAME_DB.prepare('SELECT COUNT(*) as count FROM amoebas WHERE is_active = 1').first();

    return jsonResponse({
      success: true,
      prefectures,
      activeAmoebas: amoebaCount?.count || 0,
    });
  } catch (err) {
    console.error('State error:', err);
    return errorResponse('Internal server error', 500);
  }
}
