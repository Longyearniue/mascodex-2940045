import { jsonResponse, errorResponse, corsResponse } from '../_lib/helpers.js';

const AMOEBA_NAMES = {
  fire: ['ヒートスライム', '炎の怒り', 'マグマビースト', '灼熱のコア', 'ファイアワーム'],
  ice: ['フロストコア', '氷の嘆き', 'ブリザードワーム', '凍てつく影', 'アイスファング'],
  poison: ['ドクモヤ', '腐敗の影', 'ミアズマ', '毒霧の使者', 'ベノムスライム'],
  water: ['ツナミゲル', '大渦の主', 'アクアファング', '深海の涙', 'タイダルビースト'],
  thunder: ['ライトニングバグ', '雷鳴の子', 'ボルトシェイド', '電撃のコア', 'サンダーワーム'],
};

const WEAKNESSES = {
  fire: 'water',
  ice: 'fire',
  poison: 'earth',
  water: 'wood',
  thunder: 'earth',
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  // Verify cron secret
  const secret = request.headers.get('X-Cron-Secret');
  if (!secret || secret !== env.CRON_SECRET) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    // Pick random type
    const types = Object.keys(AMOEBA_NAMES);
    const type = types[Math.floor(Math.random() * types.length)];

    // Pick random name from type
    const names = AMOEBA_NAMES[type];
    const name = names[Math.floor(Math.random() * names.length)];

    // Random strength 3-7
    const strength = Math.floor(Math.random() * 5) + 3;

    // Pick random district as spawn point
    const randomDistrict = await env.GAME_DB.prepare(
      "SELECT code FROM districts WHERE status != 'fallen' ORDER BY RANDOM() LIMIT 1"
    ).first();

    if (!randomDistrict) {
      return errorResponse('No available districts to spawn amoeba');
    }

    const id = crypto.randomUUID();
    const hp = strength * 100;
    const currentDistricts = JSON.stringify([randomDistrict.code]);
    const weakness = WEAKNESSES[type] || 'earth';

    // News headline flavor text
    const headlines = [
      `${name}が${randomDistrict.code}地区に出現！`,
      `緊急速報：${randomDistrict.code}地区で${name}を確認`,
      `${randomDistrict.code}地区住民に警報：${name}が接近中`,
    ];
    const headline = headlines[Math.floor(Math.random() * headlines.length)];

    // Insert amoeba
    await env.GAME_DB.prepare(
      'INSERT INTO amoebas (id, name, type, strength, hp, max_hp, origin_district, current_districts, news_headline, weakness) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, name, type, strength, hp, hp, randomDistrict.code, currentDistricts, headline, weakness).run();

    // Apply initial damage to spawn district
    const initialDamage = strength * 5;
    await env.GAME_DB.prepare(
      'UPDATE districts SET hp = MAX(hp - ?, 0), last_updated = datetime("now") WHERE code = ?'
    ).bind(initialDamage, randomDistrict.code).run();

    // Update district status
    const district = await env.GAME_DB.prepare('SELECT hp, max_hp FROM districts WHERE code = ?').bind(randomDistrict.code).first();
    if (district) {
      const pct = (district.hp / district.max_hp) * 100;
      let status = 'healthy';
      if (pct < 80) status = 'anxious';
      if (pct < 50) status = 'pain';
      if (pct < 20) status = 'dark';
      if (pct <= 0) status = 'fallen';
      await env.GAME_DB.prepare('UPDATE districts SET status = ? WHERE code = ?').bind(status, randomDistrict.code).run();
    }

    return jsonResponse({
      success: true,
      amoeba: { id, name, type, strength, hp, origin: randomDistrict.code, headline, weakness },
    });
  } catch (err) {
    console.error('Generate amoeba error:', err);
    return errorResponse('Internal server error', 500);
  }
}
