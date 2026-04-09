-- ─── Migration: Add open_bets table + fix offers ──────────────────────────────
-- Run this in your Supabase SQL editor:
-- https://supabase.com/dashboard/project/_/sql

-- Open Bets (the actual bet tracker table the app uses)
CREATE TABLE IF NOT EXISTS open_bets (
  id TEXT PRIMARY KEY,
  bookie_id TEXT,
  bet_type TEXT DEFAULT 'Back/Lay',
  description TEXT DEFAULT '',
  back_stake TEXT,
  back_odds TEXT,
  lay_stake TEXT,
  lay_odds TEXT,
  commission TEXT DEFAULT '5',
  profit_guaranteed TEXT,
  profit_exchange_wins TEXT,
  profit_bookie_wins TEXT,
  date TEXT,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  settled_outcome TEXT,
  actual_profit NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add bet_id to offers so we can link settlements back to bets
ALTER TABLE offers ADD COLUMN IF NOT EXISTS bet_id TEXT;

-- Disable RLS for single-user anon access (required so the anon key can read/write)
ALTER TABLE open_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON open_bets FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON offers FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE bookies ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON bookies FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON income_entries FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON expenses FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON daily_tasks FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON task_completions FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON weight_log FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE calorie_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON calorie_log FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "anon full access" ON user_settings FOR ALL TO anon USING (true) WITH CHECK (true);
