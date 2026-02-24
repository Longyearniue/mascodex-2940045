# Amoeba City v2 Design: 12万体ポケモン × 日本全国

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 12万体のゆるキャラを収集・育成・バトルするポケモン型ブラウザゲーム。モンハンを超えるスケール感と地元愛。

**Architecture:** Cloudflare Pages (HTML SPA) + Pages Functions API + D1 + KV + img.mascodex.com CDN

**Tech Stack:** Vanilla JS SPA, Cloudflare D1 (SQLite), KV, Pages Functions, existing img.mascodex.com R2 CDN

---

## Why This Surpasses Monster Hunter

| Axis | MonHun | Amoeba City v2 |
|------|--------|-----------------|
| Character count | ~100 monsters | 120,000 yuru-chara |
| Emotional bond | Generic hunter | "My town's character" |
| Real-world tie | None | Real postal codes, real geography |
| Entry barrier | Console + $60 | Free browser game |
| Collection depth | ~100 materials | 120K chars × 3 variants × 4 rarities |
| Social scale | 4-player co-op | 47-prefecture nationwide competition |

---

## Page Structure

| Page | Content |
|------|---------|
| `game.html` (top) | Game LP: hero, character search, CTA |
| `game.html#play` | Main game: map, pokedex, battle, team |

---

## 1. Game Landing Page (LP)

- Hero section: Amoeba City logo + tagline "12万体のゆるキャラで日本を守れ"
- Character search: postal code & address search (reuse existing zip-tree.json)
- Search result: character image (3 variants) + name + area + element + rarity + stats preview
- CTA: "このキャラで冒険を始める" button → registration → game start

---

## 2. Character System

### Stats Generation (Deterministic from postal code)

Each character's stats are deterministically generated from their 7-digit postal code hash:

- **HP**: 40-120 base
- **ATK**: 30-100 base
- **DEF**: 30-100 base
- **SPD**: 20-80 base
- **SP** (special): 20-80 base

Formula: `hash(postalCode + statSeed) % range + base`

### 5 Elements (Rock-Paper-Scissors-Lizard-Spock style)

```
Fire → Wood → Earth → Thunder → Water → Fire
```

- Fire: Kansai, Kyushu (postal 5xx-8xx)
- Water: Hokkaido, Tohoku (postal 0xx)
- Wood: Chugoku, Shikoku (postal 7xx)
- Earth: Chubu (postal 3xx-4xx)
- Thunder: Kanto (postal 1xx-2xx)

Advantage: 1.5x damage / Disadvantage: 0.5x damage

### Rarity (Deterministic from postal code)

- **Normal** (80%): Standard stats
- **Rare** (15%): Stats × 1.2, gold name
- **Super Rare** (4%): Stats × 1.5, purple glow
- **Legend** (1%): Stats × 2.0, rainbow border, unique title

Rarity determined by: `hash(postalCode + 'rarity') % 100`

### Evolution

- **Base form**: `_01.png` image (Lv1-9)
- **1st evolution**: `_02.png` image (Lv10+), stats × 1.3
- **2nd evolution**: `_03.png` image (Lv25+), stats × 1.6, special skill unlocked

### Special Skills (Region-based)

Each region's characters get thematic skills:
- Hokkaido/Tohoku: "Blizzard" (Water AOE)
- Kanto: "Thunder Strike" (high crit)
- Chubu: "Mountain Wall" (DEF boost)
- Kansai/Kyushu: "Fire Storm" (high damage)
- Chugoku/Shikoku: "Forest Heal" (HP recovery)

---

## 3. Collection System (Pokedex)

### Acquisition Methods

| Method | Range | Condition | Daily Limit |
|--------|-------|-----------|-------------|
| Starter | Own postal code | Registration | Once |
| Explore | Adjacent 3-digit postal areas | Random encounter | 3/day |
| Quiz | Same prefecture | Correct answer | 5/day |
| Battle drop | Nationwide | Defeat amoeba boss | No limit |
| Trade | Nationwide | Player-to-player | 3/day |

### Pokedex UI

- 47 prefecture tabs
- Grid of character thumbnails (collected = color, uncollected = silhouette)
- Completion % per prefecture + national total
- Filters: element, rarity, collected/uncollected
- Character detail: full image, stats radar chart, skills, evolution chain

---

## 4. Battle System (Turn-based Command)

### Team Composition

- 3-character party (1 active + 2 bench)
- Element balance matters (mono-element = weakness exploitable)

### Commands

- **Attack**: Normal attack (element-typed damage)
- **Skill**: Character-specific skill (costs SP gauge, 3 turns to charge)
- **Defend**: Halve incoming damage + SPD boost next turn
- **Switch**: Swap active character with bench (costs turn)

### Damage Formula

```
damage = (ATK × skillMultiplier × elementMultiplier) / (DEF × 0.5)
+ random(0, ATK × 0.1)
```

### Enemies: Amoebas

- **Daily amoebas**: Auto-generated, Lv1-20, 1 element, appear on world map
- **Weekly boss**: Lv30-50, dual element, high HP, rare drops
- **Monthly raid**: Lv100, all-element, requires community damage accumulation

Drops: XP + coins + character shards (collect 10 → unlock that area's character)

---

## 5. World Map

- Japan SVG map (existing 47-prefecture layout)
- Tap prefecture → area list with amoeba activity
- Amoeba-active areas pulse red
- Explored areas = color, unexplored = grey
- Prefecture completion badge on 100% collection
- Player's home prefecture highlighted with star

---

## 6. Progression Loop

```
Register → Get starter character
    ↓
Explore nearby areas → Encounter new characters
    ↓
Build 3-char team → Battle amoebas
    ↓
Win → XP + coins + character shards
    ↓
Level up characters → Evolve at Lv10/25
    ↓
Unlock new prefectures → Expand exploration range
    ↓
Complete pokedex → Earn prefecture badges
    ↓
Weekly boss → Rare drops → Stronger team
    ↓
Monthly raid → Community event → Leaderboard glory
```

---

## 7. Database Schema (D1 Extension)

### New/Modified Tables

```sql
-- Player's collected characters
CREATE TABLE player_characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  postal_code TEXT NOT NULL,  -- 7-digit, links to character
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  evolved INTEGER DEFAULT 0, -- 0=base, 1=first, 2=second
  is_team INTEGER DEFAULT 0, -- 0=bench, 1/2/3=team slot
  acquired_at TEXT DEFAULT (datetime('now')),
  UNIQUE(player_id, postal_code)
);

-- Amoeba encounters (expanded)
CREATE TABLE amoebas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  element TEXT NOT NULL,
  level INTEGER NOT NULL,
  hp INTEGER NOT NULL,
  max_hp INTEGER NOT NULL,
  atk INTEGER NOT NULL,
  def INTEGER NOT NULL,
  spd INTEGER NOT NULL,
  district_code TEXT NOT NULL,
  boss_type TEXT DEFAULT 'normal', -- normal/weekly/monthly
  drop_postal TEXT,  -- character shard postal code
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Battle log
CREATE TABLE battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  amoeba_id INTEGER NOT NULL,
  result TEXT NOT NULL, -- win/lose/flee
  xp_gained INTEGER DEFAULT 0,
  drops TEXT, -- JSON array of drops
  fought_at TEXT DEFAULT (datetime('now'))
);

-- Character shards (collect N to unlock)
CREATE TABLE character_shards (
  player_id TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  PRIMARY KEY (player_id, postal_code)
);

-- Exploration log
CREATE TABLE explorations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  district_code TEXT NOT NULL,
  explored_at TEXT DEFAULT (datetime('now'))
);
```

---

## 8. API Endpoints

### Existing (keep)
- `GET /api/game/state` — Prefecture summary
- `GET /api/game/ranking/prefectures` — Rankings
- `POST /api/game/register` — Player registration

### New
- `GET /api/game/pokedex` — Player's collection + completion stats
- `GET /api/game/character/:postalCode` — Character detail (stats, rarity, element)
- `POST /api/game/explore` — Explore adjacent area, random encounter
- `GET /api/game/team` — Current team composition
- `POST /api/game/team` — Update team composition
- `POST /api/game/battle/start` — Start battle vs amoeba
- `POST /api/game/battle/action` — Submit battle command
- `GET /api/game/amoebas/map` — Active amoebas on world map
- `POST /api/game/trade/offer` — Create trade offer
- `POST /api/game/trade/accept` — Accept trade

### Modified
- `POST /api/game/register` — Now also creates starter character in player_characters
- `GET /api/game/player/me` — Include team, collection count, current area

---

## 9. Character Search on LP

Reuse existing infrastructure:
- `zip-tree.json` for address → postal code lookup
- Postal code input → show character at `img.mascodex.com/{code}_01.png`
- Display: 3 variant images, deterministic stats, element, rarity badge
- "このキャラで始める" → registration flow
