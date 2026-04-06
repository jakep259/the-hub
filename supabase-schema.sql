-- The Hub — Supabase Schema
-- Run this in your Supabase SQL editor at:
-- https://qsrnopeoazzfaijlopln.supabase.co/project/default/sql

-- Enable Row Level Security on all tables
-- (For single-user use, you can disable RLS or use anon key without auth)

-- ─── Bookies ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#0D1F35',
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Restricted', 'Gubbed')),
  notes TEXT DEFAULT '',
  same_day_withdrawal BOOLEAN DEFAULT FALSE,
  stake_only_on_offer_days BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  health INTEGER DEFAULT 75,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Bets ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  bookie_id TEXT REFERENCES bookies(id) ON DELETE CASCADE,
  bet_type TEXT NOT NULL CHECK (bet_type IN ('mug', 'offer', 'recreational')),
  stake NUMERIC(10,2),
  odds TEXT,
  sport TEXT,
  notes TEXT,
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Offers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  bookie_id TEXT REFERENCES bookies(id) ON DELETE SET NULL,
  offer_type TEXT DEFAULT 'Reload',
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Taken', 'Skipped', 'Completed')),
  expected_profit NUMERIC(10,2),
  actual_profit NUMERIC(10,2),
  stake NUMERIC(10,2),
  skip_reason TEXT,
  notes TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Income Entries ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS income_entries (
  id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Expenses ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  amount NUMERIC(10,2) NOT NULL,
  category TEXT DEFAULT 'Other',
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Daily Tasks ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_tasks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  value NUMERIC(8,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Task Completions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_completions (
  id TEXT PRIMARY KEY,
  task_id TEXT REFERENCES daily_tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_id, date)
);

-- ─── Weight Log ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_log (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  weight NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Calorie Log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calorie_log (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  calories INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Consistency Log (stored as JSONB) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consistency_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date DATE NOT NULL UNIQUE,
  completed_items TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Settings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  salary NUMERIC(10,2) DEFAULT 0,
  default_commission NUMERIC(5,2) DEFAULT 5,
  dark_mode BOOLEAN DEFAULT FALSE,
  goal_start_date DATE DEFAULT '2026-04-06',
  consistency_goal_target INTEGER DEFAULT 75,
  consistency_goal_days INTEGER DEFAULT 85,
  income_streams JSONB DEFAULT '[]',
  notifications_enabled BOOLEAN DEFAULT FALSE,
  notification_time TEXT DEFAULT '08:00',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO user_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bets_bookie ON bets(bookie_id);
CREATE INDEX IF NOT EXISTS idx_offers_bookie ON offers(bookie_id);
CREATE INDEX IF NOT EXISTS idx_offers_date ON offers(date);
CREATE INDEX IF NOT EXISTS idx_income_date ON income_entries(date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_task_comp_date ON task_completions(date);
CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_log(date);
