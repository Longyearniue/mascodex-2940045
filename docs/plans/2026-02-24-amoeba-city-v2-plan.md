# Amoeba City v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Amoeba City v1 with a Pokemon-style 120K character collection & turn-based battle browser game, featuring character search, pokedex, team building, and amoeba boss battles.

**Architecture:** Single-page `game.html` (LP + game) with Cloudflare Pages Functions API, D1 database, KV cache, and existing `img.mascodex.com` CDN for 120K character images. All character stats are deterministically generated from postal code hashes (no storage needed for 120K stat rows).

**Tech Stack:** Vanilla JS (no framework), Cloudflare Pages Functions (`export async function onRequest`), D1 (SQLite), KV, existing R2 CDN

---

## Context for All Tasks

**Existing code patterns (follow exactly):**
- Pages Functions: `export async function onRequest(context) { const { request, env } = context; ... }`
- Auth: `const playerId = await getPlayerId(request, env);` returns userId or null
- Responses: `jsonResponse({ success: true, ... })`, `errorResponse('msg', 400)`
- CORS: `if (request.method === 'OPTIONS') return corsResponse();`
- D1: `.prepare('SQL').bind(...).first()` or `.all()` or `.run()`
- KV: `.put(key, JSON.stringify(val), { expirationTtl: N })`, `.get(key, { type: 'json' })`
- Imports: `import { jsonResponse, errorResponse, corsResponse, getPlayerId } from '../_lib/helpers.js';`
- Frontend API: `apiFetch(path, options)` with Bearer token auth
- Toast: `showToast(message, type)` where type = 'success'|'info'|'error'

**Key infrastructure:**
- Character images: `https://img.mascodex.com/{7digitPostalCode}_{variant}.png` where variant = 01, 02, 03
- Auth token: `localStorage.getItem('mascodex_token')` — base64 of `userId:timestamp`
- D1 database: `mascodex-game` bound as `env.GAME_DB`
- KV: `GAME_KV` bound as `env.GAME_KV`, `USER_KV` as `env.USER_KV`
- Adjacency data: `data/adjacency.json` — `{ "100": ["101"], "101": ["100","102"], ... }`
- Districts data: `data/districts.json` — `{ "100": { "code":"100", "name":"千代田区", "prefecture":"東京都", ... } }`
- Working directory: `/Users/taiichiwada/mascodex-2940045/.claude/worktrees/amoeba-city-mvp/`

---

### Task 1: Character Stats Library

Create the deterministic character stats engine. This is the backbone — every character's HP, ATK, DEF, SPD, SP, rarity, element, and skills are computed from their 7-digit postal code. No database storage needed for 120K stats.

**Files:**
- Create: `functions/api/game/_lib/character.js`

**Implementation:**

```javascript
// functions/api/game/_lib/character.js

// Simple hash function for deterministic stat generation
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function statFromHash(postalCode, seed, min, max) {
  const h = hashCode(postalCode + seed);
  return min + (h % (max - min + 1));
}

// Element assignment from postal code prefix region
const PREFIX_ELEMENTS = {
  '0': 'water',   // Hokkaido, Tohoku
  '1': 'thunder', // Kanto (Tokyo, Kanagawa, Chiba, Saitama area)
  '2': 'thunder', // Kanto (extended)
  '3': 'earth',   // Chubu (Niigata, Nagano, Gunma area)
  '4': 'earth',   // Chubu (Shizuoka, Aichi area)
  '5': 'fire',    // Kansai (Osaka, Kyoto area)
  '6': 'fire',    // Kansai (extended)
  '7': 'wood',    // Chugoku, Shikoku
  '8': 'fire',    // Kyushu
  '9': 'water',   // Hokuriku, Okinawa
};

export function getCharacterElement(postalCode) {
  const prefix = postalCode.charAt(0);
  return PREFIX_ELEMENTS[prefix] || 'earth';
}

export function getCharacterRarity(postalCode) {
  const h = hashCode(postalCode + 'rarity') % 100;
  if (h < 1) return 'legend';      // 1%
  if (h < 5) return 'super_rare';  // 4%
  if (h < 20) return 'rare';       // 15%
  return 'normal';                  // 80%
}

const RARITY_MULTIPLIER = {
  normal: 1.0,
  rare: 1.2,
  super_rare: 1.5,
  legend: 2.0,
};

export function getCharacterStats(postalCode, level = 1, evolved = 0) {
  const rarity = getCharacterRarity(postalCode);
  const mult = RARITY_MULTIPLIER[rarity];
  const evoMult = evolved === 0 ? 1.0 : evolved === 1 ? 1.3 : 1.6;

  const baseStats = {
    hp:  statFromHash(postalCode, 'hp', 40, 120),
    atk: statFromHash(postalCode, 'atk', 30, 100),
    def: statFromHash(postalCode, 'def', 30, 100),
    spd: statFromHash(postalCode, 'spd', 20, 80),
    sp:  statFromHash(postalCode, 'sp', 20, 80),
  };

  // Apply rarity multiplier, evolution multiplier, and level scaling
  const levelScale = 1 + (level - 1) * 0.05; // +5% per level

  return {
    hp:  Math.floor(baseStats.hp * mult * evoMult * levelScale),
    atk: Math.floor(baseStats.atk * mult * evoMult * levelScale),
    def: Math.floor(baseStats.def * mult * evoMult * levelScale),
    spd: Math.floor(baseStats.spd * mult * evoMult * levelScale),
    sp:  Math.floor(baseStats.sp * mult * evoMult * levelScale),
  };
}

// Region-based special skills
const REGION_SKILLS = {
  water:   { id: 'blizzard',      name: 'ブリザード',   desc: '氷の嵐で全体攻撃',    power: 80, element: 'water' },
  thunder: { id: 'thunder_strike', name: 'サンダーストライク', desc: '高確率クリティカル', power: 90, element: 'thunder' },
  earth:   { id: 'mountain_wall',  name: '山岳の壁',     desc: 'DEF大幅上昇3ターン',   power: 0, element: 'earth', buff: 'def' },
  fire:    { id: 'fire_storm',     name: '火炎嵐',       desc: '高火力単体攻撃',       power: 100, element: 'fire' },
  wood:    { id: 'forest_heal',    name: '森の癒し',     desc: 'HP大回復',             power: 0, element: 'wood', heal: true },
};

export function getCharacterSkill(postalCode) {
  const element = getCharacterElement(postalCode);
  return REGION_SKILLS[element] || REGION_SKILLS.earth;
}

export function getEvolutionStage(level) {
  if (level >= 25) return 2;
  if (level >= 10) return 1;
  return 0;
}

export function getCharacterImageVariant(level) {
  const stage = getEvolutionStage(level);
  return `0${stage + 1}`; // '01', '02', '03'
}

// Full character profile (used by API responses)
export function getCharacterProfile(postalCode, level = 1, evolved = null) {
  const evo = evolved !== null ? evolved : getEvolutionStage(level);
  const stats = getCharacterStats(postalCode, level, evo);
  const element = getCharacterElement(postalCode);
  const rarity = getCharacterRarity(postalCode);
  const skill = getCharacterSkill(postalCode);
  const variant = getCharacterImageVariant(level);

  return {
    postalCode,
    element,
    rarity,
    stats,
    skill,
    level,
    evolved: evo,
    image: `https://img.mascodex.com/${postalCode}_${variant}.png`,
    images: {
      base: `https://img.mascodex.com/${postalCode}_01.png`,
      evo1: `https://img.mascodex.com/${postalCode}_02.png`,
      evo2: `https://img.mascodex.com/${postalCode}_03.png`,
    },
  };
}

// Element matchup (5-way cycle)
const ELEMENT_CYCLE = ['fire', 'wood', 'earth', 'thunder', 'water'];

export function getElementMultiplier(attackerElement, defenderElement) {
  if (attackerElement === defenderElement) return 1.0;
  const atkIdx = ELEMENT_CYCLE.indexOf(attackerElement);
  const defIdx = ELEMENT_CYCLE.indexOf(defenderElement);
  if (atkIdx === -1 || defIdx === -1) return 1.0;
  // Clockwise = advantage
  if ((atkIdx + 1) % 5 === defIdx) return 1.5;
  // Counter-clockwise = disadvantage
  if ((defIdx + 1) % 5 === atkIdx) return 0.5;
  return 1.0;
}
```

**Verify:** This is a pure library with no external dependencies. Test by importing in another file later.

**Commit:**
```bash
git add functions/api/game/_lib/character.js
git commit -m "feat(game-v2): add deterministic character stats engine for 120K characters"
```

---

### Task 2: D1 Schema Migration

Add new tables for character collection, battles, shards, and explorations. Keep existing tables intact.

**Files:**
- Create: `d1/migrations/002_game_v2_schema.sql`

**Implementation:**

```sql
-- d1/migrations/002_game_v2_schema.sql

-- Player's collected characters
CREATE TABLE IF NOT EXISTS player_characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  evolved INTEGER DEFAULT 0,
  is_team INTEGER DEFAULT 0,
  acquired_at TEXT DEFAULT (datetime('now')),
  UNIQUE(player_id, postal_code)
);

CREATE INDEX IF NOT EXISTS idx_pc_player ON player_characters(player_id);
CREATE INDEX IF NOT EXISTS idx_pc_team ON player_characters(player_id, is_team);

-- Battle log
CREATE TABLE IF NOT EXISTS battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  amoeba_id INTEGER NOT NULL,
  result TEXT NOT NULL,
  xp_gained INTEGER DEFAULT 0,
  drops TEXT DEFAULT '[]',
  fought_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_battles_player ON battles(player_id);

-- Character shards (collect 10 to unlock character)
CREATE TABLE IF NOT EXISTS character_shards (
  player_id TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (player_id, postal_code)
);

-- Exploration log (track daily limits)
CREATE TABLE IF NOT EXISTS explorations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  district_code TEXT NOT NULL,
  found_postal TEXT,
  explored_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_explorations_player ON explorations(player_id);

-- Add new columns to amoebas table for v2
ALTER TABLE amoebas ADD COLUMN atk INTEGER DEFAULT 30;
ALTER TABLE amoebas ADD COLUMN def INTEGER DEFAULT 20;
ALTER TABLE amoebas ADD COLUMN spd INTEGER DEFAULT 15;
ALTER TABLE amoebas ADD COLUMN boss_type TEXT DEFAULT 'normal';
ALTER TABLE amoebas ADD COLUMN drop_postal TEXT;
ALTER TABLE amoebas ADD COLUMN level INTEGER DEFAULT 1;
ALTER TABLE amoebas ADD COLUMN element TEXT DEFAULT 'fire';
```

**Run migration:**
```bash
npx wrangler d1 execute mascodex-game --remote --file=d1/migrations/002_game_v2_schema.sql
```

**Commit:**
```bash
git add d1/migrations/002_game_v2_schema.sql
git commit -m "feat(game-v2): add D1 schema for character collection, battles, shards"
```

---

### Task 3: Character Detail API

API endpoint to get any character's full profile by postal code. No auth required (used by LP search).

**Files:**
- Create: `functions/api/game/character/[[postalCode]].js`

**Implementation:**

```javascript
// functions/api/game/character/[[postalCode]].js
import { jsonResponse, errorResponse, corsResponse } from '../_lib/helpers.js';
import { getCharacterProfile } from '../_lib/character.js';

export async function onRequest(context) {
  const { request, params } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const postalCode = (params.postalCode || []).join('');
  const clean = postalCode.replace(/[-\s]/g, '');

  if (!/^\d{7}$/.test(clean)) {
    return errorResponse('Invalid postal code. Must be 7 digits.', 400);
  }

  const profile = getCharacterProfile(clean);

  return jsonResponse({
    success: true,
    character: profile,
  });
}
```

**Verify:**
```bash
curl https://mascodex-2940045.pages.dev/api/game/character/1000001
# Should return { success: true, character: { postalCode: "1000001", element: "thunder", rarity: "...", stats: {...}, ... } }
```

**Commit:**
```bash
git add "functions/api/game/character/[[postalCode]].js"
git commit -m "feat(game-v2): add character detail API endpoint"
```

---

### Task 4: Update Register to Create Starter Character

Modify registration to also create the player's first character in `player_characters` and assign it to team slot 1.

**Files:**
- Modify: `functions/api/game/register.js`

**Implementation:**

After the existing player insert (line `INSERT OR IGNORE INTO players`), add:

```javascript
// Create starter character
await env.GAME_DB.prepare(
  'INSERT OR IGNORE INTO player_characters (player_id, postal_code, level, xp, evolved, is_team) VALUES (?, ?, 1, 0, 0, 1)'
).bind(playerId, clean).run();
```

And add to the response:

```javascript
const starterChar = getCharacterProfile(clean);
// ... in the return jsonResponse:
return jsonResponse({
  success: true,
  player: { ... },
  district: { ... },
  element,
  region,
  characterImage: `https://img.mascodex.com/${clean}_01.png`,
  starter: starterChar,  // ADD THIS
});
```

Add import at top:
```javascript
import { getCharacterProfile } from './_lib/character.js';
```

**Commit:**
```bash
git add functions/api/game/register.js
git commit -m "feat(game-v2): create starter character on registration"
```

---

### Task 5: Pokedex API

Returns the player's collection with completion stats per prefecture.

**Files:**
- Create: `functions/api/game/pokedex.js`

**Implementation:**

```javascript
// functions/api/game/pokedex.js
import { jsonResponse, errorResponse, corsResponse, getPlayerId } from './_lib/helpers.js';
import { getCharacterProfile } from './_lib/character.js';
import { getDistrictCode } from './_lib/districts.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    // Get all collected characters
    const collected = await env.GAME_DB.prepare(
      'SELECT * FROM player_characters WHERE player_id = ? ORDER BY acquired_at DESC'
    ).bind(playerId).all();

    // Get all shards in progress
    const shards = await env.GAME_DB.prepare(
      'SELECT * FROM character_shards WHERE player_id = ? AND count > 0'
    ).bind(playerId).all();

    const characters = (collected.results || []).map(c => ({
      ...getCharacterProfile(c.postal_code, c.level, c.evolved),
      xp: c.xp,
      isTeam: c.is_team,
      acquiredAt: c.acquired_at,
    }));

    const shardList = (shards.results || []).map(s => ({
      postalCode: s.postal_code,
      count: s.count,
      needed: 10,
      preview: getCharacterProfile(s.postal_code),
    }));

    return jsonResponse({
      success: true,
      collected: characters,
      totalCollected: characters.length,
      shards: shardList,
    });
  } catch (err) {
    console.error('Pokedex error:', err);
    return errorResponse('Internal server error', 500);
  }
}
```

**Commit:**
```bash
git add functions/api/game/pokedex.js
git commit -m "feat(game-v2): add pokedex API for character collection"
```

---

### Task 6: Team API

Get and update team composition (3 slots).

**Files:**
- Create: `functions/api/game/team.js`

**Implementation:**

```javascript
// functions/api/game/team.js
import { jsonResponse, errorResponse, corsResponse, getPlayerId } from './_lib/helpers.js';
import { getCharacterProfile } from './_lib/character.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  if (request.method === 'GET') {
    return getTeam(env, playerId);
  }

  if (request.method === 'POST') {
    const body = await request.json();
    return updateTeam(env, playerId, body);
  }

  return errorResponse('Method not allowed', 405);
}

async function getTeam(env, playerId) {
  const team = await env.GAME_DB.prepare(
    'SELECT * FROM player_characters WHERE player_id = ? AND is_team > 0 ORDER BY is_team ASC'
  ).bind(playerId).all();

  const members = (team.results || []).map(c => ({
    slot: c.is_team,
    ...getCharacterProfile(c.postal_code, c.level, c.evolved),
    xp: c.xp,
  }));

  return jsonResponse({ success: true, team: members });
}

async function updateTeam(env, playerId, body) {
  const { slots } = body; // [{ postalCode, slot }] — slot: 1, 2, or 3
  if (!Array.isArray(slots) || slots.length === 0 || slots.length > 3) {
    return errorResponse('Team must have 1-3 members', 400);
  }

  // Clear current team
  await env.GAME_DB.prepare(
    'UPDATE player_characters SET is_team = 0 WHERE player_id = ?'
  ).bind(playerId).run();

  // Set new team
  for (const s of slots) {
    if (s.slot < 1 || s.slot > 3) continue;
    await env.GAME_DB.prepare(
      'UPDATE player_characters SET is_team = ? WHERE player_id = ? AND postal_code = ?'
    ).bind(s.slot, playerId, s.postalCode).run();
  }

  return getTeam(env, playerId);
}
```

**Commit:**
```bash
git add functions/api/game/team.js
git commit -m "feat(game-v2): add team composition API (get/update 3 slots)"
```

---

### Task 7: Explore API

Random encounter system. Players explore adjacent districts to find new characters.

**Files:**
- Create: `functions/api/game/explore.js`

**Implementation:**

```javascript
// functions/api/game/explore.js
import { jsonResponse, errorResponse, corsResponse, getPlayerId, getTodayJST } from './_lib/helpers.js';
import { getCharacterProfile, getCharacterRarity } from './_lib/character.js';
import { getDistrictCode } from './_lib/districts.js';
import adjacency from '../../data/adjacency.json';
import districts from '../../data/districts.json';

const DAILY_EXPLORE_LIMIT = 3;
const ENCOUNTER_RATE = 0.6; // 60% chance to find a character

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const today = getTodayJST();

    // Check daily limit
    const countResult = await env.GAME_DB.prepare(
      "SELECT COUNT(*) as count FROM explorations WHERE player_id = ? AND date(explored_at) = ?"
    ).bind(playerId, today).first();
    const exploreCount = countResult?.count || 0;

    if (exploreCount >= DAILY_EXPLORE_LIMIT) {
      return jsonResponse({
        success: false,
        error: '本日の探索回数を使い切りました',
        remaining: 0,
      });
    }

    // Get player's district
    const player = await env.GAME_DB.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first();
    if (!player) return errorResponse('Player not found', 404);

    const playerDistrict = player.district;
    const adjacent = adjacency[playerDistrict] || [];

    if (adjacent.length === 0) {
      return errorResponse('No adjacent areas to explore', 400);
    }

    // Pick random adjacent district
    const targetDistrict = adjacent[Math.floor(Math.random() * adjacent.length)];
    const districtInfo = districts[targetDistrict];

    // Generate a random postal code in this district
    const randomSuffix = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const foundPostal = targetDistrict + randomSuffix;

    // Log exploration
    await env.GAME_DB.prepare(
      'INSERT INTO explorations (player_id, district_code, found_postal, explored_at) VALUES (?, ?, ?, datetime("now"))'
    ).bind(playerId, targetDistrict, foundPostal).run();

    // Random encounter check
    const encountered = Math.random() < ENCOUNTER_RATE;

    if (!encountered) {
      return jsonResponse({
        success: true,
        explored: true,
        encounter: false,
        district: districtInfo ? { code: targetDistrict, name: districtInfo.name, prefecture: districtInfo.prefecture } : { code: targetDistrict },
        message: `${districtInfo?.name || targetDistrict}を探索しましたが、キャラクターは見つかりませんでした`,
        remaining: DAILY_EXPLORE_LIMIT - exploreCount - 1,
      });
    }

    // Check if already collected
    const existing = await env.GAME_DB.prepare(
      'SELECT * FROM player_characters WHERE player_id = ? AND postal_code = ?'
    ).bind(playerId, foundPostal).first();

    if (existing) {
      // Already have this character — give XP instead
      await env.GAME_DB.prepare(
        'UPDATE player_characters SET xp = xp + 20 WHERE player_id = ? AND postal_code = ?'
      ).bind(playerId, foundPostal).run();

      return jsonResponse({
        success: true,
        explored: true,
        encounter: true,
        duplicate: true,
        character: getCharacterProfile(foundPostal, existing.level, existing.evolved),
        message: `既に持っているキャラと再会！ XP+20`,
        remaining: DAILY_EXPLORE_LIMIT - exploreCount - 1,
      });
    }

    // New character found! Add to collection
    await env.GAME_DB.prepare(
      'INSERT INTO player_characters (player_id, postal_code, level, xp, evolved, is_team) VALUES (?, ?, 1, 0, 0, 0)'
    ).bind(playerId, foundPostal).run();

    const newChar = getCharacterProfile(foundPostal);

    return jsonResponse({
      success: true,
      explored: true,
      encounter: true,
      duplicate: false,
      character: newChar,
      district: districtInfo ? { code: targetDistrict, name: districtInfo.name, prefecture: districtInfo.prefecture } : { code: targetDistrict },
      message: `新しいキャラクター発見！ ${districtInfo?.name || ''}のキャラをゲット！`,
      remaining: DAILY_EXPLORE_LIMIT - exploreCount - 1,
    });
  } catch (err) {
    console.error('Explore error:', err);
    return errorResponse('Internal server error', 500);
  }
}
```

**Commit:**
```bash
git add functions/api/game/explore.js
git commit -m "feat(game-v2): add exploration API with random encounters"
```

---

### Task 8: Battle System API

Turn-based battle engine. Start a battle, submit actions each turn, resolve damage.

**Files:**
- Create: `functions/api/game/battle/start.js`
- Create: `functions/api/game/battle/action.js`

**Implementation for `battle/start.js`:**

```javascript
// functions/api/game/battle/start.js
import { jsonResponse, errorResponse, corsResponse, getPlayerId } from '../_lib/helpers.js';
import { getCharacterProfile, getCharacterStats, getCharacterElement, getElementMultiplier } from '../_lib/character.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const amoebaId = body.amoebaId;

    // Get amoeba
    const amoeba = await env.GAME_DB.prepare(
      'SELECT * FROM amoebas WHERE id = ? AND is_active = 1'
    ).bind(amoebaId).first();

    if (!amoeba) return errorResponse('Amoeba not found or already defeated', 404);

    // Get player's team
    const team = await env.GAME_DB.prepare(
      'SELECT * FROM player_characters WHERE player_id = ? AND is_team > 0 ORDER BY is_team ASC'
    ).bind(playerId).all();

    if (!team.results || team.results.length === 0) {
      return errorResponse('No team members. Set your team first.', 400);
    }

    // Build battle state
    const teamState = team.results.map(c => {
      const stats = getCharacterStats(c.postal_code, c.level, c.evolved);
      return {
        postalCode: c.postal_code,
        slot: c.is_team,
        level: c.level,
        element: getCharacterElement(c.postal_code),
        hp: stats.hp,
        maxHp: stats.hp,
        atk: stats.atk,
        def: stats.def,
        spd: stats.spd,
        sp: stats.sp,
        spGauge: 0, // Charges each turn, skill at 3
        alive: true,
        image: `https://img.mascodex.com/${c.postal_code}_0${Math.min(c.evolved + 1, 3)}.png`,
      };
    });

    const battleState = {
      id: crypto.randomUUID(),
      amoebaId: amoeba.id,
      amoeba: {
        name: amoeba.name,
        element: amoeba.element || amoeba.type,
        level: amoeba.level || amoeba.strength * 5,
        hp: amoeba.hp,
        maxHp: amoeba.max_hp,
        atk: amoeba.atk || amoeba.strength * 15,
        def: amoeba.def || amoeba.strength * 10,
        spd: amoeba.spd || amoeba.strength * 8,
        bossType: amoeba.boss_type || 'normal',
      },
      team: teamState,
      activeSlot: teamState[0].slot,
      turn: 1,
      log: [],
      status: 'active', // active, won, lost
    };

    // Store battle state in KV (15 min TTL)
    await env.GAME_KV.put(
      `battle_${playerId}`,
      JSON.stringify(battleState),
      { expirationTtl: 900 }
    );

    return jsonResponse({
      success: true,
      battle: {
        id: battleState.id,
        amoeba: battleState.amoeba,
        team: battleState.team,
        activeSlot: battleState.activeSlot,
        turn: battleState.turn,
      },
    });
  } catch (err) {
    console.error('Battle start error:', err);
    return errorResponse('Internal server error', 500);
  }
}
```

**Implementation for `battle/action.js`:**

```javascript
// functions/api/game/battle/action.js
import { jsonResponse, errorResponse, corsResponse, getPlayerId } from '../_lib/helpers.js';
import { getCharacterProfile, getElementMultiplier, getCharacterSkill, getCharacterElement } from '../_lib/character.js';
import { getLevelFromXp, getXpForLevel } from '../_lib/districts.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const playerId = await getPlayerId(request, env);
  if (!playerId) return errorResponse('Unauthorized', 401);

  try {
    const body = await request.json();
    const { action, targetSlot } = body;
    // action: 'attack' | 'skill' | 'defend' | 'switch'

    // Get battle state from KV
    const battleState = await env.GAME_KV.get(`battle_${playerId}`, { type: 'json' });
    if (!battleState || battleState.status !== 'active') {
      return errorResponse('No active battle', 400);
    }

    const amoeba = battleState.amoeba;
    const activeChar = battleState.team.find(t => t.slot === battleState.activeSlot && t.alive);
    if (!activeChar) return errorResponse('No active character', 400);

    const turnLog = [];

    // --- PLAYER ACTION ---
    if (action === 'attack') {
      const elemMult = getElementMultiplier(activeChar.element, amoeba.element);
      const damage = Math.max(1, Math.floor(
        (activeChar.atk * elemMult) / (amoeba.def * 0.5) + Math.floor(Math.random() * activeChar.atk * 0.1)
      ));
      amoeba.hp = Math.max(0, amoeba.hp - damage);
      activeChar.spGauge = Math.min(3, activeChar.spGauge + 1);
      turnLog.push({ actor: 'player', type: 'attack', damage, effective: elemMult > 1 ? 'super' : elemMult < 1 ? 'weak' : 'normal' });

    } else if (action === 'skill') {
      if (activeChar.spGauge < 3) {
        return errorResponse('SP gauge not full (need 3)', 400);
      }
      const skill = getCharacterSkill(activeChar.postalCode);
      activeChar.spGauge = 0;

      if (skill.heal) {
        const healAmt = Math.floor(activeChar.hp * 0.5);
        activeChar.hp = Math.min(activeChar.maxHp, activeChar.hp + healAmt);
        turnLog.push({ actor: 'player', type: 'skill', skillName: skill.name, heal: healAmt });
      } else if (skill.buff) {
        activeChar.def = Math.floor(activeChar.def * 1.5);
        turnLog.push({ actor: 'player', type: 'skill', skillName: skill.name, buff: skill.buff });
      } else {
        const elemMult = getElementMultiplier(skill.element, amoeba.element);
        const damage = Math.max(1, Math.floor(
          (activeChar.atk * (skill.power / 50) * elemMult) / (amoeba.def * 0.5)
        ));
        amoeba.hp = Math.max(0, amoeba.hp - damage);
        turnLog.push({ actor: 'player', type: 'skill', skillName: skill.name, damage, effective: elemMult > 1 ? 'super' : elemMult < 1 ? 'weak' : 'normal' });
      }

    } else if (action === 'defend') {
      activeChar._defending = true;
      activeChar.spGauge = Math.min(3, activeChar.spGauge + 1);
      turnLog.push({ actor: 'player', type: 'defend' });

    } else if (action === 'switch') {
      if (!targetSlot) return errorResponse('Must specify targetSlot for switch', 400);
      const target = battleState.team.find(t => t.slot === targetSlot && t.alive);
      if (!target) return errorResponse('Target character not available', 400);
      battleState.activeSlot = targetSlot;
      turnLog.push({ actor: 'player', type: 'switch', to: target.postalCode });

    } else {
      return errorResponse('Invalid action. Use: attack, skill, defend, switch', 400);
    }

    // --- CHECK WIN ---
    if (amoeba.hp <= 0) {
      battleState.status = 'won';
      battleState.log.push(...turnLog);

      // Calculate rewards
      const xpGained = amoeba.level * 10 + (amoeba.bossType === 'weekly' ? 100 : amoeba.bossType === 'monthly' ? 500 : 0);
      const drops = [];

      // Character shard drop chance
      if (amoeba.drop_postal) {
        const dropChance = amoeba.bossType === 'normal' ? 0.3 : amoeba.bossType === 'weekly' ? 0.7 : 1.0;
        if (Math.random() < dropChance) {
          drops.push({ type: 'shard', postalCode: amoeba.drop_postal });
          // Add shard to DB
          await env.GAME_DB.prepare(
            'INSERT INTO character_shards (player_id, postal_code, count) VALUES (?, ?, 1) ON CONFLICT(player_id, postal_code) DO UPDATE SET count = count + 1'
          ).bind(playerId, amoeba.drop_postal).run();

          // Check if 10 shards = unlock character
          const shardCount = await env.GAME_DB.prepare(
            'SELECT count FROM character_shards WHERE player_id = ? AND postal_code = ?'
          ).bind(playerId, amoeba.drop_postal).first();

          if (shardCount && shardCount.count >= 10) {
            await env.GAME_DB.prepare(
              'INSERT OR IGNORE INTO player_characters (player_id, postal_code, level, xp, evolved, is_team) VALUES (?, ?, 1, 0, 0, 0)'
            ).bind(playerId, amoeba.drop_postal).run();
            await env.GAME_DB.prepare(
              'DELETE FROM character_shards WHERE player_id = ? AND postal_code = ?'
            ).bind(playerId, amoeba.drop_postal).run();
            drops.push({ type: 'character_unlock', postalCode: amoeba.drop_postal });
          }
        }
      }

      // Award XP to all team members
      for (const member of battleState.team) {
        if (member.alive) {
          await env.GAME_DB.prepare(
            'UPDATE player_characters SET xp = xp + ? WHERE player_id = ? AND postal_code = ?'
          ).bind(xpGained, playerId, member.postalCode).run();

          // Check for level up / evolution
          const updated = await env.GAME_DB.prepare(
            'SELECT * FROM player_characters WHERE player_id = ? AND postal_code = ?'
          ).bind(playerId, member.postalCode).first();
          if (updated) {
            const levelInfo = getLevelFromXp(updated.xp);
            const newEvo = levelInfo.level >= 25 ? 2 : levelInfo.level >= 10 ? 1 : 0;
            if (levelInfo.level !== updated.level || newEvo !== updated.evolved) {
              await env.GAME_DB.prepare(
                'UPDATE player_characters SET level = ?, evolved = ? WHERE player_id = ? AND postal_code = ?'
              ).bind(levelInfo.level, newEvo, playerId, member.postalCode).run();
            }
          }
        }
      }

      // Log battle
      await env.GAME_DB.prepare(
        'INSERT INTO battles (player_id, amoeba_id, result, xp_gained, drops) VALUES (?, ?, ?, ?, ?)'
      ).bind(playerId, battleState.amoebaId, 'win', xpGained, JSON.stringify(drops)).run();

      // Mark amoeba defeated
      await env.GAME_DB.prepare(
        'UPDATE amoebas SET is_active = 0, hp = 0, defeated_at = datetime("now") WHERE id = ?'
      ).bind(battleState.amoebaId).run();

      // Clean up KV
      await env.GAME_KV.delete(`battle_${playerId}`);

      return jsonResponse({
        success: true,
        battle: { status: 'won', turn: battleState.turn, log: battleState.log },
        rewards: { xp: xpGained, drops },
      });
    }

    // --- AMOEBA ACTION ---
    const aliveChars = battleState.team.filter(t => t.alive);
    const currentActive = battleState.team.find(t => t.slot === battleState.activeSlot && t.alive);

    if (currentActive) {
      const amoebaDamage = Math.max(1, Math.floor(
        (amoeba.atk) / (currentActive.def * (currentActive._defending ? 1.0 : 0.5))
        + Math.floor(Math.random() * amoeba.atk * 0.1)
      ));
      currentActive.hp = Math.max(0, currentActive.hp - amoebaDamage);
      currentActive._defending = false;
      turnLog.push({ actor: 'amoeba', type: 'attack', damage: amoebaDamage, target: currentActive.postalCode });

      if (currentActive.hp <= 0) {
        currentActive.alive = false;
        turnLog.push({ actor: 'system', type: 'fainted', target: currentActive.postalCode });

        // Auto-switch to next alive member
        const nextAlive = battleState.team.find(t => t.alive);
        if (nextAlive) {
          battleState.activeSlot = nextAlive.slot;
          turnLog.push({ actor: 'system', type: 'auto_switch', to: nextAlive.postalCode });
        }
      }
    }

    // --- CHECK LOSE ---
    const stillAlive = battleState.team.filter(t => t.alive);
    if (stillAlive.length === 0) {
      battleState.status = 'lost';
      battleState.log.push(...turnLog);

      await env.GAME_DB.prepare(
        'INSERT INTO battles (player_id, amoeba_id, result, xp_gained, drops) VALUES (?, ?, ?, 0, ?)'
      ).bind(playerId, battleState.amoebaId, 'lose', '[]').run();

      await env.GAME_KV.delete(`battle_${playerId}`);

      return jsonResponse({
        success: true,
        battle: { status: 'lost', turn: battleState.turn, log: battleState.log },
      });
    }

    // --- NEXT TURN ---
    battleState.turn++;
    battleState.log.push(...turnLog);

    // Save updated state
    await env.GAME_KV.put(
      `battle_${playerId}`,
      JSON.stringify(battleState),
      { expirationTtl: 900 }
    );

    return jsonResponse({
      success: true,
      battle: {
        status: 'active',
        turn: battleState.turn,
        amoeba: { hp: amoeba.hp, maxHp: amoeba.maxHp },
        team: battleState.team.map(t => ({
          postalCode: t.postalCode,
          slot: t.slot,
          hp: t.hp,
          maxHp: t.maxHp,
          alive: t.alive,
          spGauge: t.spGauge,
          image: t.image,
          element: t.element,
        })),
        activeSlot: battleState.activeSlot,
        log: turnLog,
      },
    });
  } catch (err) {
    console.error('Battle action error:', err);
    return errorResponse('Internal server error', 500);
  }
}
```

**Commit:**
```bash
git add functions/api/game/battle/start.js functions/api/game/battle/action.js
git commit -m "feat(game-v2): add turn-based battle system with element matchups and rewards"
```

---

### Task 9: Updated Amoeba Generation (Cron)

Update the cron amoeba generator to create v2-compatible amoebas with stats, element, level, and drop postal codes.

**Files:**
- Modify: `functions/api/game/cron/generate-amoeba.js`

**Implementation (replace entire file):**

```javascript
// functions/api/game/cron/generate-amoeba.js
import { jsonResponse, errorResponse, corsResponse } from '../_lib/helpers.js';

const ELEMENTS = ['fire', 'water', 'wood', 'earth', 'thunder'];
const AMOEBA_NAMES = [
  'スライムーバ', 'ゲルゾーン', 'トキシコア', 'フロストビア', 'サンダージェル',
  'マグマブロブ', 'アクアモルフ', 'モスグリーン', 'テラコッタ', 'ボルトスライム',
  'ダークアメーバ', 'クリスタルーバ', 'ネオンジェル', 'シャドウモルフ', 'プラズマコア',
];

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'POST') return errorResponse('Method not allowed', 405);

  const cronSecret = request.headers.get('X-Cron-Secret');
  if (cronSecret !== env.CRON_SECRET) return errorResponse('Unauthorized', 403);

  try {
    // Get all district codes for random placement
    const allDistricts = await env.GAME_DB.prepare(
      'SELECT code, prefecture FROM districts ORDER BY RANDOM() LIMIT 10'
    ).all();

    const districtsArr = allDistricts.results || [];
    if (districtsArr.length === 0) return errorResponse('No districts found', 500);

    const created = [];

    // Generate 3-5 daily amoebas
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const district = districtsArr[i % districtsArr.length];
      const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
      const level = 5 + Math.floor(Math.random() * 15); // Lv5-19
      const name = AMOEBA_NAMES[Math.floor(Math.random() * AMOEBA_NAMES.length)];

      const hp = level * 50 + Math.floor(Math.random() * level * 20);
      const atk = level * 8 + Math.floor(Math.random() * level * 3);
      const def = level * 5 + Math.floor(Math.random() * level * 2);
      const spd = level * 3 + Math.floor(Math.random() * level * 2);

      // Drop: random postal code from this district
      const dropPostal = district.code + String(Math.floor(Math.random() * 10000)).padStart(4, '0');

      const id = crypto.randomUUID();
      await env.GAME_DB.prepare(
        `INSERT INTO amoebas (id, name, type, element, strength, hp, max_hp, atk, def, spd, level, boss_type, drop_postal,
         origin_district, current_districts, is_active, created_at, weakness)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?)`
      ).bind(
        id, name, element, element, Math.ceil(level / 5),
        hp, hp, atk, def, spd, level, 'normal', dropPostal,
        district.code, JSON.stringify([district.code]),
        ELEMENTS[(ELEMENTS.indexOf(element) + 4) % 5] // weakness = element that beats this one
      ).run();

      created.push({ id, name, element, level, district: district.code, hp });
    }

    // Weekly boss (on Mondays = day 1)
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    if (dayOfWeek === 1) {
      const bossDistrict = districtsArr[0];
      const bossElement = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
      const bossLevel = 30 + Math.floor(Math.random() * 20);
      const bossName = '大王' + AMOEBA_NAMES[Math.floor(Math.random() * AMOEBA_NAMES.length)];
      const bossHp = bossLevel * 200;
      const bossDropPostal = bossDistrict.code + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
      const bossId = crypto.randomUUID();

      await env.GAME_DB.prepare(
        `INSERT INTO amoebas (id, name, type, element, strength, hp, max_hp, atk, def, spd, level, boss_type, drop_postal,
         origin_district, current_districts, is_active, created_at, weakness)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), ?)`
      ).bind(
        bossId, bossName, bossElement, bossElement, 10,
        bossHp, bossHp, bossLevel * 12, bossLevel * 8, bossLevel * 5,
        bossLevel, 'weekly', bossDropPostal,
        bossDistrict.code, JSON.stringify([bossDistrict.code]),
        ELEMENTS[(ELEMENTS.indexOf(bossElement) + 4) % 5]
      ).run();

      created.push({ id: bossId, name: bossName, element: bossElement, level: bossLevel, district: bossDistrict.code, hp: bossHp, boss: true });
    }

    return jsonResponse({ success: true, created, count: created.length });
  } catch (err) {
    console.error('Generate amoeba error:', err);
    return errorResponse('Internal server error', 500);
  }
}
```

**Commit:**
```bash
git add functions/api/game/cron/generate-amoeba.js
git commit -m "feat(game-v2): update amoeba generation with stats, levels, and drop items"
```

---

### Task 10: Updated Amoeba List API

Return active amoebas with v2 fields (stats, element, level, boss_type).

**Files:**
- Modify: `functions/api/game/amoebas.js`

**Replace with:**

```javascript
// functions/api/game/amoebas.js
import { jsonResponse, errorResponse, corsResponse } from './_lib/helpers.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    const result = await env.GAME_DB.prepare(
      'SELECT * FROM amoebas WHERE is_active = 1 ORDER BY level DESC'
    ).all();

    const amoebas = (result.results || []).map(a => ({
      id: a.id,
      name: a.name,
      element: a.element || a.type,
      level: a.level || a.strength * 5,
      hp: a.hp,
      maxHp: a.max_hp,
      atk: a.atk || 30,
      def: a.def || 20,
      spd: a.spd || 15,
      bossType: a.boss_type || 'normal',
      district: a.origin_district,
      weakness: a.weakness,
    }));

    return jsonResponse({
      success: true,
      amoebas,
      count: amoebas.length,
    });
  } catch (err) {
    console.error('Amoebas list error:', err);
    return errorResponse('Internal server error', 500);
  }
}
```

**Commit:**
```bash
git add functions/api/game/amoebas.js
git commit -m "feat(game-v2): update amoeba list API with v2 fields"
```

---

### Task 11: Game Landing Page + Character Search

Complete rewrite of `game.html` — a proper game LP with character search, then the main game UI below.

**Files:**
- Rewrite: `game.html`

**This is the largest task.** The game.html should contain:

1. **LP Section** (visible before login):
   - Hero with game logo, tagline "12万体のゆるキャラで日本を守れ"
   - Character search (postal code + address via zip-tree.json)
   - Search result: character card with 3 variant images, stats radar, element badge, rarity border
   - CTA: "このキャラで冒険を始める"

2. **Game Section** (visible after login):
   - **World Map** tab: 47-prefecture Japan SVG map with amoeba indicators
   - **Pokedex** tab: Collection grid with silhouettes for uncollected
   - **Team** tab: 3-slot team editor with drag-to-reorder
   - **Battle** tab: Turn-based battle UI with HP bars, command buttons, battle log
   - **Explore** button: Trigger exploration with encounter animation

**The full HTML/CSS/JS for this file is ~2000+ lines. The implementer should build it in this order:**

**Phase A — LP (top section before game):**
```
- Header with game title
- Character search by postal code
- Character search by address (zip-tree.json dropdowns)
- Character result card (image, stats, element, rarity)
- Login/Register flow
- Responsive design
```

**Phase B — Game UI tabs:**
```
- Tab navigation (Map / Pokedex / Team / Battle)
- World Map tab (reuse existing Japan SVG map code from v1)
- Amoeba list on map (clickable to start battle)
```

**Phase C — Pokedex tab:**
```
- Prefecture filter dropdown
- Character grid (collected = color with stats, uncollected = grey silhouette)
- Collection counter (X / total per prefecture)
```

**Phase D — Team & Explore:**
```
- Team composition UI (3 slots, pick from collection)
- Explore button with daily counter
- Encounter animation (found/not found)
```

**Phase E — Battle UI:**
```
- Battle screen: player character (left) vs amoeba (right)
- HP bars for both sides
- Command buttons: Attack / Skill (greyed until SP=3) / Defend / Switch
- Battle log panel (scrolling messages)
- Victory/defeat screen with rewards
- Element effectiveness indicator
```

**Key implementation notes:**
- `API_BASE = ''` (same origin)
- Use `apiFetch()` pattern from v1
- Character stats: call `/api/game/character/{postalCode}` for search results
- All tabs use CSS `display:none`/`display:block` toggling, no router
- Character images use CSS `filter` for states (like v1's char-healthy, char-pain, etc.)
- Rarity borders: normal=none, rare=gold, super_rare=purple glow, legend=rainbow animation
- Load `zip-tree.json` for address search (copy exact code from mascodex index.html)

**Commit:**
```bash
git add game.html
git commit -m "feat(game-v2): complete game page with LP, search, pokedex, battle, team"
```

---

### Task 12: Deploy and Verify

Deploy the v2 game to both Pages projects and verify all APIs work.

**Steps:**

1. Run D1 migration:
```bash
npx wrangler d1 execute mascodex-game --remote --file=d1/migrations/002_game_v2_schema.sql
```

2. Deploy to mascodex-2940045 (pages.dev):
```bash
npx wrangler pages deploy . --project-name mascodex-2940045 --commit-dirty=true
```

3. Verify APIs:
```bash
curl https://mascodex-2940045.pages.dev/api/game/character/1000001
curl https://mascodex-2940045.pages.dev/api/game/amoebas
curl https://mascodex-2940045.pages.dev/api/game/state
```

4. Deploy to mascodex-top (mascodex.com):
```bash
npx wrangler pages deploy . --project-name mascodex-top --commit-dirty=true
```

5. Verify on mascodex.com:
```bash
curl https://mascodex.com/api/game/character/1000001
curl https://mascodex.com/game.html | head -5
```

6. Trigger amoeba generation to populate battles:
```bash
curl -X POST https://mascodex-2940045.pages.dev/api/game/cron/generate-amoeba \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json"
```

7. Update cron worker GAME_API_BASE:
```bash
cd game-cron-worker && echo "https://mascodex.com" | npx wrangler secret put GAME_API_BASE
```

**Commit:**
```bash
git add -A
git commit -m "chore(game-v2): deployment configuration updates"
git push origin main
```
