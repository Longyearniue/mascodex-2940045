import { jsonResponse, errorResponse, corsResponse } from './_lib/helpers.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const result = await env.GAME_DB.prepare(
      'SELECT * FROM amoebas WHERE is_active = 1 ORDER BY created_at DESC'
    ).all();

    const amoebas = result.results.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      strength: a.strength,
      hp: a.hp,
      maxHp: a.max_hp,
      spreadSpeed: a.spread_speed,
      originDistrict: a.origin_district,
      currentDistricts: JSON.parse(a.current_districts || '[]'),
      newsHeadline: a.news_headline,
      weakness: a.weakness,
      createdAt: a.created_at,
    }));

    return jsonResponse({
      success: true,
      amoebas,
      count: amoebas.length,
    });
  } catch (err) {
    console.error('Amoebas error:', err);
    return errorResponse('Internal server error', 500);
  }
}
