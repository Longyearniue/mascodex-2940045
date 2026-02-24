// Deterministic character stats engine for 120K yuru-chara (one per postal code)
// All stats are computed from the postal code hash — no database needed.

const IMAGE_BASE = 'https://img.mascodex.com';

// --- Internal helpers ---

// Simple deterministic hash for a string → 32-bit signed integer
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Produce a deterministic float in [0, 1) from a hash + salt
function hashFloat(postalCode, salt) {
  const h = Math.abs(hashCode(postalCode + ':' + salt));
  return (h % 10000) / 10000;
}

// Scale a hash-derived float into an integer range [min, max] (inclusive)
function hashRange(postalCode, salt, min, max) {
  return Math.floor(hashFloat(postalCode, salt) * (max - min + 1)) + min;
}

// --- Element mapping ---

const PREFIX_ELEMENT = {
  '0': 'water',    // Hokkaido / Tohoku
  '1': 'thunder',  // Kanto
  '2': 'thunder',  // Kanto
  '3': 'earth',    // Chubu
  '4': 'earth',    // Chubu
  '5': 'fire',     // Kansai
  '6': 'fire',     // Kansai
  '7': 'wood',     // Chugoku / Shikoku
  '8': 'fire',     // Kyushu
  '9': 'water',    // Hokuriku / Okinawa
};

export function getCharacterElement(postalCode) {
  const prefix = postalCode.replace('-', '').charAt(0);
  return PREFIX_ELEMENT[prefix] || 'earth';
}

// --- Rarity ---

const RARITY_THRESHOLDS = [
  { max: 0.01, rarity: 'legend' },
  { max: 0.05, rarity: 'super_rare' },
  { max: 0.20, rarity: 'rare' },
  { max: 1.00, rarity: 'normal' },
];

const RARITY_MULTIPLIER = {
  normal: 1.0,
  rare: 1.2,
  super_rare: 1.5,
  legend: 2.0,
};

export function getCharacterRarity(postalCode) {
  const roll = hashFloat(postalCode, 'rarity');
  for (const { max, rarity } of RARITY_THRESHOLDS) {
    if (roll < max) return rarity;
  }
  return 'normal';
}

// --- Evolution ---

export function getEvolutionStage(level) {
  if (level >= 25) return 2;
  if (level >= 10) return 1;
  return 0;
}

// --- Image variant ---

const VARIANT_MAP = ['01', '02', '03'];

export function getCharacterImageVariant(level) {
  return VARIANT_MAP[getEvolutionStage(level)];
}

// --- Stats ---

export function getCharacterStats(postalCode, level = 1, evolved = null) {
  const code = postalCode.replace('-', '');

  // Base stats from hash (deterministic per postal code)
  const baseHp  = hashRange(code, 'hp',  40, 120);
  const baseAtk = hashRange(code, 'atk', 30, 100);
  const baseDef = hashRange(code, 'def', 30, 100);
  const baseSpd = hashRange(code, 'spd', 20, 80);
  const baseSp  = hashRange(code, 'sp',  20, 80);

  // Rarity multiplier
  const rarity = getCharacterRarity(code);
  const rarityMul = RARITY_MULTIPLIER[rarity];

  // Evolution multiplier: 0 → 1.0, 1 → 1.3, 2 → 1.6
  const evoStage = evolved != null ? evolved : getEvolutionStage(level);
  const evoMul = 1.0 + evoStage * 0.3;

  // Level scaling: 1 + (level - 1) * 0.05
  const lvlMul = 1 + (level - 1) * 0.05;

  const scale = (base) => Math.floor(base * rarityMul * evoMul * lvlMul);

  return {
    hp:  scale(baseHp),
    atk: scale(baseAtk),
    def: scale(baseDef),
    spd: scale(baseSpd),
    sp:  scale(baseSp),
  };
}

// --- Skills ---

const ELEMENT_SKILLS = {
  water:   { id: 'blizzard',       name: 'ブリザード',     desc: '氷の嵐で敵を凍らせる',     power: 80,  element: 'water' },
  thunder: { id: 'thunder_strike', name: 'サンダーストライク', desc: '稲妻の一撃を放つ',       power: 85,  element: 'thunder' },
  earth:   { id: 'mountain_wall',  name: 'マウンテンウォール', desc: '大地の壁で守りを固める', power: 60,  element: 'earth' },
  fire:    { id: 'fire_storm',     name: 'ファイアストーム',   desc: '炎の嵐で焼き尽くす',     power: 90,  element: 'fire' },
  wood:    { id: 'forest_heal',    name: 'フォレストヒール',   desc: '森の力で仲間を癒す',     power: 50,  element: 'wood' },
};

export function getCharacterSkill(postalCode) {
  const element = getCharacterElement(postalCode);
  return { ...ELEMENT_SKILLS[element] };
}

// --- Element matchup multiplier (v2 5-way cycle) ---
// fire → wood → earth → thunder → water → fire
// Advantage: 1.5x, Disadvantage: 0.5x, Neutral: 1.0x

const ADVANTAGE_MAP = {
  fire:    'wood',
  wood:    'earth',
  earth:   'thunder',
  thunder: 'water',
  water:   'fire',
};

export function getElementMultiplier(attackerElement, defenderElement) {
  if (attackerElement === defenderElement) return 1.0;
  if (ADVANTAGE_MAP[attackerElement] === defenderElement) return 1.5;
  if (ADVANTAGE_MAP[defenderElement] === attackerElement) return 0.5;
  return 1.0;
}

// --- Full profile ---

export function getCharacterProfile(postalCode, level = 1, evolved = null) {
  const code = postalCode.replace('-', '');
  const evoStage = evolved != null ? evolved : getEvolutionStage(level);
  const variant = VARIANT_MAP[evoStage];

  return {
    postalCode: code,
    element: getCharacterElement(code),
    rarity: getCharacterRarity(code),
    stats: getCharacterStats(code, level, evoStage),
    skill: getCharacterSkill(code),
    level,
    evolved: evoStage,
    image: `${IMAGE_BASE}/${code}_${variant}.png`,
    images: {
      base: `${IMAGE_BASE}/${code}_01.png`,
      evo1: `${IMAGE_BASE}/${code}_02.png`,
      evo2: `${IMAGE_BASE}/${code}_03.png`,
    },
  };
}
