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
      element: a.element || a.type,
      level: a.level || 1,
      hp: a.hp,
      maxHp: a.max_hp,
      atk: a.atk || 30,
      def: a.def || 20,
      spd: a.spd || 15,
      bossType: a.boss_type || 'normal',
      district: a.origin_district,
      weakness: a.weakness,
      dropPostal: a.drop_postal || null,
      currentDistricts: JSON.parse(a.current_districts || '[]'),
      newsHeadline: a.news_headline,
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
