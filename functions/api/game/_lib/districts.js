// Convert 7-digit postal code to 3-digit district code
export function getDistrictCode(postalCode) {
  return postalCode.replace('-', '').slice(0, 3);
}

// Determine character visual state from HP percentage
export function getStatusFromHp(hp, maxHp) {
  const pct = (hp / maxHp) * 100;
  if (pct >= 80) return 'healthy';
  if (pct >= 50) return 'anxious';
  if (pct >= 20) return 'pain';
  if (pct > 0)   return 'dark';
  return 'fallen';
}

// CSS class for each status
export function getStatusClass(status) {
  const classes = {
    healthy: 'char-healthy',
    anxious: 'char-anxious',
    pain: 'char-pain',
    dark: 'char-dark',
    fallen: 'char-fallen',
    evolved: 'char-evolved',
  };
  return classes[status] || 'char-healthy';
}

// District skill definitions
export const SKILLS = {
  ocean_guardian:    { name: '海の守護',   desc: '水アメーバのダメージ-50%', icon: '🌊' },
  mountain_wall:    { name: '山の壁',     desc: '拡散1時間遅延',           icon: '🏔' },
  city_shield:      { name: '都市の盾',   desc: 'プレイヤー5人で防衛+20%', icon: '🏙' },
  onsen_heal:       { name: '温泉の癒し', desc: '回復速度2倍',             icon: '♨️' },
  ancient_ward:     { name: '古の結界',   desc: '毒アメーバダメージ-40%',   icon: '🏯' },
  harvest_blessing: { name: '豊穣の祝福', desc: 'ログインHP+5追加',        icon: '🌾' },
  local_pride:      { name: '地元の誇り', desc: '自地区XP+20%',            icon: '🏠' },
};

// XP required for each level
export function getXpForLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Calculate level from total XP
export function getLevelFromXp(totalXp) {
  let level = 1;
  let xpNeeded = 100;
  let remaining = totalXp;
  while (remaining >= xpNeeded) {
    remaining -= xpNeeded;
    level++;
    xpNeeded = Math.floor(100 * Math.pow(1.5, level - 1));
  }
  return { level, currentXp: remaining, nextLevelXp: xpNeeded };
}
