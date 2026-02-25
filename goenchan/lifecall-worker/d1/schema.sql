-- Life Call Concierge Schema

CREATE TABLE IF NOT EXISTS lifecall_sessions (
  id TEXT PRIMARY KEY,
  postal_code TEXT NOT NULL,
  char_name TEXT,
  category TEXT,
  status TEXT DEFAULT 'chatting',
  hearing_data TEXT,
  price_tier INTEGER,
  locale TEXT DEFAULT 'ja',
  stripe_payment_intent_id TEXT,
  stripe_refund_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lifecall_calls (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  target_name TEXT NOT NULL,
  target_phone TEXT NOT NULL,
  target_address TEXT,
  call_order INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  outcome TEXT,
  ai_summary TEXT,
  price_quoted TEXT,
  telnyx_call_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lifecall_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_postal ON lifecall_sessions(postal_code);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON lifecall_sessions(status);
CREATE INDEX IF NOT EXISTS idx_calls_session ON lifecall_calls(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON lifecall_messages(session_id);
