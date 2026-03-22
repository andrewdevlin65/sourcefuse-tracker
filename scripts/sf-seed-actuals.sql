-- SourceFuse Revenue Model — Seed Demo Actuals (Year 1)
-- Story: slight underperformance on Stream 3, overperformance on Stream 2

INSERT INTO sf_stream_actuals (client_id, period, year_number, quarter_number,
  stream1_amount, stream2_amount, stream3_amount,
  aws_channel_amount, founder_direct_amount, net_new_amount,
  new_logos_count, active_accounts_count, is_demo)
VALUES
  ('sourcefuse', '2025-Q1', 1, 1,
   3100000, 680000, 120000,
   2800000, 950000, 150000,
   1, 40, true),
  ('sourcefuse', '2025-Q2', 1, 2,
   3050000, 920000, 200000,
   2750000, 1020000, 400000,
   2, 41, true),
  ('sourcefuse', '2025-Q3', 1, 3,
   3020000, 1180000, 285000,
   2700000, 1285000, 500000,
   2, 43, true),
  ('sourcefuse', '2025-Q4', 1, 4,
   2990000, 1420000, 310000,
   2650000, 1570000, 500000,
   2, 46, true)
ON CONFLICT (client_id, period) DO UPDATE SET
  stream1_amount = EXCLUDED.stream1_amount,
  stream2_amount = EXCLUDED.stream2_amount,
  stream3_amount = EXCLUDED.stream3_amount,
  aws_channel_amount = EXCLUDED.aws_channel_amount,
  founder_direct_amount = EXCLUDED.founder_direct_amount,
  net_new_amount = EXCLUDED.net_new_amount,
  new_logos_count = EXCLUDED.new_logos_count,
  active_accounts_count = EXCLUDED.active_accounts_count,
  is_demo = EXCLUDED.is_demo,
  updated_at = NOW();
