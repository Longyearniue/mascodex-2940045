import { jsonResponse, errorResponse, corsResponse } from '../_lib/helpers.js';

const ELEMENTS = ['fire', 'water', 'wood', 'earth', 'thunder'];

// v2 5-way weakness cycle: fire→wood→earth→thunder→water→fire
const WEAKNESS_MAP = {
  fire: 'water',
  water: 'thunder',
  thunder: 'earth',
  earth: 'wood',
  wood: 'fire',
};

// 15 Japanese amoeba names (element-agnostic)
const AMOEBA_NAMES = [
  'ネバネバン',
  'プルプルン',
  'ドロリッチ',
  'ヌメヌメーバ',
  'ゼリモン',
  'スライモ',
  'グニョリ',
  'トロロイド',
  'ベタベータ',
  'ムニュムニュ',
  'ブヨブヨン',
  'ネチョリン',
  'ペタモチ',
  'ヌルヌーラ',
  'ゴムゴモン',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate stats for a normal amoeba at given level
function generateStats(level) {
  return {
    hp: level * 50 + Math.floor(Math.random() * level * 20),
    atk: level * 8 + Math.floor(Math.random() * level * 3),
    def: level * 5 + Math.floor(Math.random() * level * 2),
    spd: level * 4 + Math.floor(Math.random() * level * 2),
  };
}

// Generate stats for a boss amoeba
function generateBossStats(level, bossType) {
  const hpMultiplier = bossType === 'monthly' ? 300 : 200;
  return {
    hp: level * hpMultiplier + Math.floor(Math.random() * level * 50),
    atk: level * 12 + Math.floor(Math.random() * level * 5),
    def: level * 8 + Math.floor(Math.random() * level * 3),
    spd: level * 5 + Math.floor(Math.random() * level * 2),
  };
}

async function createAmoeba(env, { name, element, level, stats, bossType, district }) {
  const id = crypto.randomUUID();
  const weakness = WEAKNESS_MAP[element] || 'water';
  const currentDistricts = JSON.stringify([district.code]);

  // Generate a random drop postal code from this district
  const suffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  const dropPostal = district.code + suffix;

  // News headline
  const headlines = [
    `${name}が${district.code}地区に出現！`,
    `緊急速報：${district.code}地区で${name}を確認`,
    `${district.code}地区住民に警報：${name}が接近中`,
  ];
  const headline = pickRandom(headlines);

  await env.GAME_DB.prepare(
    `INSERT INTO amoebas (id, name, type, element, strength, hp, max_hp, atk, def, spd, level, boss_type, drop_postal, origin_district, current_districts, news_headline, weakness)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, name, element, element, level,
    stats.hp, stats.hp, stats.atk, stats.def, stats.spd,
    level, bossType, dropPostal,
    district.code, currentDistricts, headline, weakness
  ).run();

  // Apply initial damage to spawn district
  const initialDamage = Math.floor(level * 3);
  await env.GAME_DB.prepare(
    'UPDATE districts SET hp = MAX(hp - ?, 0), last_updated = datetime("now") WHERE code = ?'
  ).bind(initialDamage, district.code).run();

  // Update district status
  const districtData = await env.GAME_DB.prepare('SELECT hp, max_hp FROM districts WHERE code = ?').bind(district.code).first();
  if (districtData) {
    const pct = (districtData.hp / districtData.max_hp) * 100;
    let status = 'healthy';
    if (pct < 80) status = 'anxious';
    if (pct < 50) status = 'pain';
    if (pct < 20) status = 'dark';
    if (pct <= 0) status = 'fallen';
    await env.GAME_DB.prepare('UPDATE districts SET status = ? WHERE code = ?').bind(status, district.code).run();
  }

  return { id, name, element, level, hp: stats.hp, atk: stats.atk, def: stats.def, spd: stats.spd, bossType, origin: district.code, dropPostal, headline, weakness };
}

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
    const generated = [];

    // Generate 3-5 daily normal amoebas
    const count = randomBetween(3, 5);
    for (let i = 0; i < count; i++) {
      const district = await env.GAME_DB.prepare(
        "SELECT code FROM districts WHERE status != 'fallen' ORDER BY RANDOM() LIMIT 1"
      ).first();
      if (!district) continue;

      const element = pickRandom(ELEMENTS);
      const name = pickRandom(AMOEBA_NAMES);
      const level = randomBetween(5, 19);
      const stats = generateStats(level);

      const amoeba = await createAmoeba(env, {
        name, element, level, stats, bossType: 'normal', district,
      });
      generated.push(amoeba);
    }

    // On Mondays (UTC day 1): generate a weekly boss
    const now = new Date();
    if (now.getUTCDay() === 1) {
      const bossDistrict = await env.GAME_DB.prepare(
        "SELECT code FROM districts WHERE status != 'fallen' ORDER BY RANDOM() LIMIT 1"
      ).first();

      if (bossDistrict) {
        const element = pickRandom(ELEMENTS);
        const bossName = pickRandom(AMOEBA_NAMES) + '・ボス';
        const level = randomBetween(30, 50);
        const stats = generateBossStats(level, 'weekly');

        const boss = await createAmoeba(env, {
          name: bossName, element, level, stats, bossType: 'weekly', district: bossDistrict,
        });
        generated.push(boss);
      }
    }

    return jsonResponse({
      success: true,
      count: generated.length,
      amoebas: generated,
    });
  } catch (err) {
    console.error('Generate amoeba error:', err);
    return errorResponse('Internal server error', 500);
  }
}
