-- SourceFuse Revenue Model — Assumptions & Actuals Schema
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS sf_assumptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL DEFAULT 'sourcefuse',
  assumption_key TEXT NOT NULL,
  value_y1 NUMERIC,
  value_y2 NUMERIC,
  value_y3 NUMERIC,
  actual_value NUMERIC,
  actual_updated_at TIMESTAMPTZ,
  notes TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, assumption_key)
);

CREATE TABLE IF NOT EXISTS sf_stream_actuals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL DEFAULT 'sourcefuse',
  period TEXT NOT NULL,
  year_number INTEGER,
  quarter_number INTEGER,
  stream1_amount NUMERIC DEFAULT 0,
  stream2_amount NUMERIC DEFAULT 0,
  stream3_amount NUMERIC DEFAULT 0,
  aws_channel_amount NUMERIC DEFAULT 0,
  founder_direct_amount NUMERIC DEFAULT 0,
  net_new_amount NUMERIC DEFAULT 0,
  new_logos_count INTEGER DEFAULT 0,
  active_accounts_count INTEGER DEFAULT 0,
  notes TEXT,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, period)
);

ALTER TABLE sf_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sf_stream_actuals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON sf_assumptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON sf_stream_actuals FOR ALL USING (true) WITH CHECK (true);
