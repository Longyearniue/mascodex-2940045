-- Amoeba City MVP Game Schema

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,              -- same as userId from auth (user_xxxx)
  email TEXT,
  postal_code TEXT NOT NULL,        -- 7-digit postal code
  prefecture TEXT NOT NULL,         -- prefecture name in Japanese
  district TEXT NOT NULL,           -- 3-digit district code
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  total_defense INTEGER DEFAULT 0,  -- total HP contributed
  consecutive_days INTEGER DEFAULT 0,
  last_login_date TEXT,             -- YYYY-MM-DD in JST
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_players_district ON players(district);
CREATE INDEX idx_players_prefecture ON players(prefecture);
CREATE INDEX idx_players_last_login ON players(last_login_date);

-- Districts table (seeded from data/districts.json)
CREATE TABLE IF NOT EXISTS districts (
  code TEXT PRIMARY KEY,            -- 3-digit postal prefix
  prefecture TEXT NOT NULL,
  name TEXT DEFAULT '',
  hp INTEGER DEFAULT 100,
  max_hp INTEGER DEFAULT 100,
  status TEXT DEFAULT 'healthy',    -- healthy/anxious/pain/dark/fallen
  immune_until TEXT,                -- ISO datetime, null if not immune
  player_count INTEGER DEFAULT 0,
  last_updated TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_districts_prefecture ON districts(prefecture);
CREATE INDEX idx_districts_status ON districts(status);
CREATE INDEX idx_districts_hp ON districts(hp);

-- Active amoebas
CREATE TABLE IF NOT EXISTS amoebas (
  id TEXT PRIMARY KEY,              -- UUID
  name TEXT NOT NULL,               -- Japanese name
  type TEXT NOT NULL,               -- fire/ice/poison/water/thunder
  strength INTEGER NOT NULL,        -- 3-7
  hp INTEGER NOT NULL,              -- amoeba HP (strength * 100)
  max_hp INTEGER NOT NULL,
  spread_speed INTEGER DEFAULT 1,   -- districts per hour
  origin_district TEXT NOT NULL,    -- 3-digit code where it spawned
  current_districts TEXT DEFAULT '[]', -- JSON array of 3-digit codes
  news_headline TEXT DEFAULT '',    -- flavor text
  weakness TEXT DEFAULT '',         -- element weakness
  is_active INTEGER DEFAULT 1,     -- 1=active, 0=defeated
  created_at TEXT DEFAULT (datetime('now')),
  defeated_at TEXT
);

CREATE INDEX idx_amoebas_active ON amoebas(is_active);
CREATE INDEX idx_amoebas_origin ON amoebas(origin_district);

-- Player action log
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  action_type TEXT NOT NULL,        -- login/quiz/share
  district_code TEXT NOT NULL,
  hp_given INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  metadata TEXT DEFAULT '{}',       -- JSON for extra data
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_actions_player ON actions(player_id);
CREATE INDEX idx_actions_district ON actions(district_code);
CREATE INDEX idx_actions_date ON actions(created_at);
CREATE INDEX idx_actions_type ON actions(action_type);

-- Prefecture rankings (daily snapshots)
CREATE TABLE IF NOT EXISTS prefecture_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prefecture TEXT NOT NULL,
  period TEXT NOT NULL,              -- YYYY-MM-DD
  defense_rate REAL DEFAULT 0,      -- % of districts with HP > 0
  active_rate REAL DEFAULT 0,       -- % of players who acted today
  avg_hp REAL DEFAULT 0,
  defeat_count INTEGER DEFAULT 0,   -- amoebas defeated today
  total_score REAL DEFAULT 0,
  rank INTEGER DEFAULT 0,
  UNIQUE(prefecture, period)
);

CREATE INDEX idx_scores_period ON prefecture_scores(period);
CREATE INDEX idx_scores_rank ON prefecture_scores(period, rank);
