export const ELEMENTS = ['fire', 'water', 'wood', 'earth', 'thunder'];

// Region-based element mapping
const REGION_ELEMENTS = {
  hokkaido: 'water',
  tohoku: 'water',
  kanto: 'thunder',
  chubu: 'earth',
  kansai: 'fire',
  chugoku: 'wood',
  shikoku: 'wood',
  kyushu: 'fire',
  okinawa: 'fire',
};

// Prefecture → region mapping
const PREFECTURE_REGIONS = {
  '北海道': 'hokkaido',
  '青森県': 'tohoku', '岩手県': 'tohoku', '宮城県': 'tohoku',
  '秋田県': 'tohoku', '山形県': 'tohoku', '福島県': 'tohoku',
  '茨城県': 'kanto', '栃木県': 'kanto', '群馬県': 'kanto',
  '埼玉県': 'kanto', '千葉県': 'kanto', '東京都': 'kanto', '神奈川県': 'kanto',
  '新潟県': 'chubu', '富山県': 'chubu', '石川県': 'chubu', '福井県': 'chubu',
  '山梨県': 'chubu', '長野県': 'chubu', '岐阜県': 'chubu', '静岡県': 'chubu', '愛知県': 'chubu',
  '三重県': 'kansai', '滋賀県': 'kansai', '京都府': 'kansai',
  '大阪府': 'kansai', '兵庫県': 'kansai', '奈良県': 'kansai', '和歌山県': 'kansai',
  '鳥取県': 'chugoku', '島根県': 'chugoku', '岡山県': 'chugoku',
  '広島県': 'chugoku', '山口県': 'chugoku',
  '徳島県': 'shikoku', '香川県': 'shikoku', '愛媛県': 'shikoku', '高知県': 'shikoku',
  '福岡県': 'kyushu', '佐賀県': 'kyushu', '長崎県': 'kyushu', '熊本県': 'kyushu',
  '大分県': 'kyushu', '宮崎県': 'kyushu', '鹿児島県': 'kyushu',
  '沖縄県': 'okinawa',
};

export function getElement(prefecture) {
  const region = PREFECTURE_REGIONS[prefecture];
  return region ? REGION_ELEMENTS[region] : 'earth';
}

export function getRegion(prefecture) {
  return PREFECTURE_REGIONS[prefecture] || 'unknown';
}

// Element effectiveness for damage calculation
export const MATCHUPS = {
  fire:    { strong: 'wood',    weak: 'water' },
  water:   { strong: 'fire',    weak: 'wood' },
  wood:    { strong: 'water',   weak: 'fire' },
  earth:   { strong: 'thunder', weak: 'wood' },
  thunder: { strong: 'wood',    weak: 'earth' },
};

// Returns damage multiplier: 1.5 for advantage, 0.7 for disadvantage, 1.0 for neutral
export function getDamageMultiplier(playerElement, amoebaType) {
  const matchup = MATCHUPS[playerElement];
  if (!matchup) return 1.0;
  if (matchup.strong === amoebaType) return 1.5;
  if (matchup.weak === amoebaType) return 0.7;
  return 1.0;
}
