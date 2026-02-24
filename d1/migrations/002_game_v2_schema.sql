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

-- Exploration log
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
