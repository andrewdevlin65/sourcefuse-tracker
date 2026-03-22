-- SourceFuse — Seed 52 weeks of demo weekly snapshots + quotas
-- Run in Supabase SQL Editor after sf-assumptions-schema.sql

-- Add is_demo column if not exists
ALTER TABLE weekly_snapshots ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- ════════════════════════════════════════════════════════════
-- WEEKLY SNAPSHOTS — Mar 2025 through Mar 2026 (52 weeks)
-- Story: Alex Chen ramping Q1-Q2, producing Q3-Q4.
--        Marcus Taylor hired Oct 2025, ramping Q4 2025 into Q1 2026.
--        Momentum building toward $25M Y1 target.
-- ════════════════════════════════════════════════════════════

INSERT INTO weekly_snapshots (
  id, client_id, week_ending, label, current_month,
  monthly_quota, revenue_mtd, total_deals_closed, avg_deal_size,
  open_pipeline, weighted_funnel, coverage_ratio,
  avg_days_to_close, deals_over_100k, overdue_count, overdue_value,
  quarter_name, quarter_quota, quarter_revenue_ytd,
  total_calls, total_meetings, notes,
  funnel_month_1, funnel_total_1, funnel_weighted_1, funnel_quota_1,
  is_demo
) VALUES
-- ─── March 2025 ───
('sf-2025-03-09','sourcefuse','2025-03-09','Week 1 Mar','March',2083333,120000,1,120000,4200000,1680000,2.0,45,0,3,85000,'Q1',6250000,820000,38,9,'Alex ramping — first qualified pipeline building. HealthStream showing early interest in cloud migration.',  'April',3100000,1240000,2083333,true),
('sf-2025-03-16','sourcefuse','2025-03-16','Week 2 Mar','March',2083333,245000,2,122500,4500000,1800000,2.2,42,0,2,62000,'Q1',6250000,945000,42,10,'Two small deals closed. Pipeline growing — Vertex Healthcare discovery call went well.',  'April',3200000,1280000,2083333,true),
('sf-2025-03-23','sourcefuse','2025-03-23','Week 3 Mar','March',2083333,365000,3,121667,4800000,1920000,2.3,40,0,2,55000,'Q1',6250000,1065000,45,11,'Steady week. GlobalFinServ ARC demo scheduled for next week.',  'April',3400000,1360000,2083333,true),
('sf-2025-03-30','sourcefuse','2025-03-30','Week 4 Mar','March',2083333,410000,4,102500,5100000,2040000,2.4,38,1,2,48000,'Q1',6250000,1110000,48,12,'Month close at $410K — below $2.1M quota but pipeline coverage strong at 2.4x. First $100K+ deal in negotiation.',  'April',3500000,1400000,2083333,true),
-- ─── April 2025 ───
('sf-2025-04-06','sourcefuse','2025-04-06','Week 1 Apr','April',2083333,95000,1,95000,5300000,2120000,2.5,36,0,2,42000,'Q2',6250000,95000,50,12,'New quarter. Alex focused on HealthStream AWS migration — SOW in review.',  'May',3200000,1280000,2083333,true),
('sf-2025-04-13','sourcefuse','2025-04-13','Week 2 Apr','April',2083333,215000,2,107500,5500000,2200000,2.6,35,0,1,30000,'Q2',6250000,215000,52,13,'Pipeline building nicely. Two proposals out this week.',  'May',3400000,1360000,2083333,true),
('sf-2025-04-20','sourcefuse','2025-04-20','Week 3 Apr','April',2083333,380000,3,126667,5200000,2080000,2.5,34,1,1,25000,'Q2',6250000,380000,55,14,'HealthStream $120K cloud migration closed! First large deal. Momentum shift.',  'May',3600000,1440000,2083333,true),
('sf-2025-04-27','sourcefuse','2025-04-27','Week 4 Apr','April',2083333,480000,5,96000,5400000,2160000,2.6,33,1,1,20000,'Q2',6250000,480000,58,15,'$480K month — tracking better. 5 deals closed. Referral from HealthStream opening door at MedFirst.',  'May',3800000,1520000,2083333,true),
-- ─── May 2025 ───
('sf-2025-05-04','sourcefuse','2025-05-04','Week 1 May','May',2083333,110000,1,110000,5600000,2240000,2.7,32,0,1,18000,'Q2',6250000,590000,55,13,'Solid start. Alex pipeline hygiene week — moved 3 stale deals to closed-lost.',  'June',3500000,1400000,2083333,true),
('sf-2025-05-11','sourcefuse','2025-05-11','Week 2 May','May',2083333,280000,3,93333,5800000,2320000,2.8,31,0,1,15000,'Q2',6250000,760000,58,14,'Three deals in one week. Smaller ACVs but good velocity. Application dev demand picking up.',  'June',3700000,1480000,2083333,true),
('sf-2025-05-18','sourcefuse','2025-05-18','Week 3 May','May',2083333,420000,4,105000,5500000,2200000,2.6,30,1,2,32000,'Q2',6250000,900000,60,15,'$420K MTD. GlobalFinServ ARC license $150K in final negotiation — close expected next week.',  'June',3900000,1560000,2083333,true),
('sf-2025-05-25','sourcefuse','2025-05-25','Week 4 May','May',2083333,520000,5,104000,5700000,2280000,2.7,29,1,1,22000,'Q2',6250000,1000000,62,16,'$520K! Best month yet. GlobalFinServ ARC license closed at $155K. Strong Q2 momentum.',  'June',4100000,1640000,2083333,true),
-- ─── June 2025 ───
('sf-2025-06-01','sourcefuse','2025-06-01','Week 1 Jun','June',2083333,85000,1,85000,5900000,2360000,2.8,28,0,1,18000,'Q2',6250000,1085000,58,14,'June started slow — 2 deals pushed to next week. Pipeline remains healthy.',  'July',3800000,1520000,2083333,true),
('sf-2025-06-08','sourcefuse','2025-06-08','Week 2 Jun','June',2083333,230000,2,115000,6100000,2440000,2.9,27,0,1,14000,'Q2',6250000,1230000,60,15,'MedFirst $95K managed services deal closed. Cross-sell from HealthStream referral working.',  'July',4000000,1600000,2083333,true),
('sf-2025-06-15','sourcefuse','2025-06-15','Week 3 Jun','June',2083333,395000,4,98750,6300000,2520000,3.0,26,1,1,10000,'Q2',6250000,1395000,63,16,'Two more closes. Pipeline coverage hit 3.0x — first time. Alex fully ramped and producing consistently.',  'July',4200000,1680000,2083333,true),
('sf-2025-06-22','sourcefuse','2025-06-22','Week 4 Jun','June',2083333,510000,5,102000,6000000,2400000,2.9,26,1,1,8000,'Q2',6250000,1510000,65,17,'$510K close. Q2 total $1.51M — not at $6.25M quarterly target but trajectory improving 20%+ MoM.',  'July',4400000,1760000,2083333,true),
-- ─── July 2025 ───
('sf-2025-07-06','sourcefuse','2025-07-06','Week 1 Jul','July',2083333,145000,1,145000,6200000,2480000,3.0,25,0,1,12000,'Q3',6250000,145000,60,14,'New half year. Alex pipeline strong. Starting search for Rep 2 — targeting Q4 start.',  'August',4100000,1640000,2083333,true),
('sf-2025-07-13','sourcefuse','2025-07-13','Week 2 Jul','July',2083333,310000,3,103333,6500000,2600000,3.1,24,1,1,10000,'Q3',6250000,310000,62,15,'TechVault $125K digital transformation deal advancing. 3 closes this week.',  'August',4300000,1720000,2083333,true),
('sf-2025-07-20','sourcefuse','2025-07-20','Week 3 Jul','July',2083333,480000,4,120000,6300000,2520000,3.0,24,1,0,0,'Q3',6250000,480000,65,16,'Strong week. Clean overdue queue. Pipeline converting well.',  'August',4500000,1800000,2083333,true),
('sf-2025-07-27','sourcefuse','2025-07-27','Week 4 Jul','July',2083333,620000,6,103333,6600000,2640000,3.2,23,1,1,15000,'Q3',6250000,620000,68,17,'$620K month! 6 deals. TechVault closed at $130K. Best single month. Alex at full stride.',  'August',4700000,1880000,2083333,true),
-- ─── August 2025 ───
('sf-2025-08-03','sourcefuse','2025-08-03','Week 1 Aug','August',2083333,130000,1,130000,6800000,2720000,3.3,22,0,1,12000,'Q3',6250000,750000,62,15,'August open. Large deal pipeline building — 3 opportunities >$100K in discovery.',  'September',4500000,1800000,2083333,true),
('sf-2025-08-10','sourcefuse','2025-08-10','Week 2 Aug','August',2083333,290000,3,96667,7000000,2800000,3.4,22,0,0,0,'Q3',6250000,910000,65,16,'Velocity continues. NovaPharma cloud migration discovery going well.',  'September',4700000,1880000,2083333,true),
('sf-2025-08-17','sourcefuse','2025-08-17','Week 3 Aug','August',2083333,450000,4,112500,6700000,2680000,3.2,21,1,1,18000,'Q3',6250000,1070000,67,17,'$450K MTD. Second $100K+ deal — DataFlow ARC platform $110K proposal accepted.',  'September',4900000,1960000,2083333,true),
('sf-2025-08-24','sourcefuse','2025-08-24','Week 4 Aug','August',2083333,680000,6,113333,6900000,2760000,3.3,21,2,1,10000,'Q3',6250000,1300000,70,18,'$680K! New record month. Two $100K+ deals. Rep 2 interviews in progress — Marcus Taylor front-runner.',  'September',5100000,2040000,2083333,true),
-- ─── September 2025 ───
('sf-2025-09-07','sourcefuse','2025-09-07','Week 1 Sep','September',2083333,155000,2,77500,7200000,2880000,3.5,20,0,1,14000,'Q3',6250000,1455000,65,15,'Sept started strong. Marcus Taylor offer accepted — starts Oct 1. Pipeline at all-time high.',  'October',4800000,1920000,2083333,true),
('sf-2025-09-14','sourcefuse','2025-09-14','Week 2 Sep','September',2083333,340000,3,113333,7400000,2960000,3.6,20,1,1,10000,'Q3',6250000,1640000,68,16,'NovaPharma $140K cloud deal in final SOW review. Q3 looking strong.',  'October',5000000,2000000,2083333,true),
('sf-2025-09-21','sourcefuse','2025-09-21','Week 3 Sep','September',2083333,530000,5,106000,7100000,2840000,3.4,19,1,0,0,'Q3',6250000,1830000,70,17,'NovaPharma closed! $145K. 5 deals in a week. Excellent Q3 close momentum.',  'October',5200000,2080000,2083333,true),
('sf-2025-09-28','sourcefuse','2025-09-28','Week 4 Sep','September',2083333,720000,7,102857,7300000,2920000,3.5,19,2,1,8000,'Q3',6250000,2020000,72,18,'$720K close! Q3 total $2.02M — up 34% from Q2. Marcus starts Monday. Scale phase beginning.',  'October',5400000,2160000,2083333,true),
-- ─── October 2025 ───
('sf-2025-10-05','sourcefuse','2025-10-05','Week 1 Oct','October',2083333,110000,1,110000,7500000,3000000,3.6,19,0,1,12000,'Q4',6250000,110000,68,15,'Q4 open. Marcus in onboarding week 1 — shadowing Alex on calls. Pipeline coverage 3.6x.',  'November',5100000,2040000,2083333,true),
('sf-2025-10-12','sourcefuse','2025-10-12','Week 2 Oct','October',2083333,280000,3,93333,7800000,3120000,3.8,18,0,1,10000,'Q4',6250000,280000,72,16,'Marcus making first outbound calls. Alex pipeline generating steadily.',  'November',5300000,2120000,2083333,true),
('sf-2025-10-19','sourcefuse','2025-10-19','Week 3 Oct','October',2083333,485000,5,97000,7600000,3040000,3.7,18,1,1,8000,'Q4',6250000,485000,75,17,'$485K MTD. 5 closes. EnviroTech $105K managed services win. Marcus had first solo meeting.',  'November',5500000,2200000,2083333,true),
('sf-2025-10-26','sourcefuse','2025-10-26','Week 4 Oct','October',2083333,780000,7,111429,7900000,3160000,3.8,17,2,0,0,'Q4',6250000,780000,78,18,'$780K! New record. Two-rep pipeline effect visible even in ramp phase. Marcus contributing to pipeline generation.',  'November',5700000,2280000,2083333,true),
-- ─── November 2025 ───
('sf-2025-11-02','sourcefuse','2025-11-02','Week 1 Nov','November',2083333,140000,2,70000,8100000,3240000,3.9,17,0,1,10000,'Q4',6250000,920000,75,16,'Nov started well. Marcus first qualified opportunity — MidWest Manufacturing discovery.',  'December',5400000,2160000,2083333,true),
('sf-2025-11-09','sourcefuse','2025-11-09','Week 2 Nov','November',2083333,320000,3,106667,8300000,3320000,4.0,17,1,1,8000,'Q4',6250000,1100000,78,17,'Pipeline hit $8.3M — 4x coverage. Alex and Marcus both contributing pipeline gen.',  'December',5600000,2240000,2083333,true),
('sf-2025-11-16','sourcefuse','2025-11-16','Week 3 Nov','November',2083333,540000,5,108000,8000000,3200000,3.8,16,1,0,0,'Q4',6250000,1320000,80,18,'$540K MTD. Conversion rate improving — avg days to close down to 16.',  'December',5800000,2320000,2083333,true),
('sf-2025-11-23','sourcefuse','2025-11-23','Week 4 Nov','November',2083333,850000,8,106250,8200000,3280000,4.0,16,2,1,6000,'Q4',6250000,1630000,82,19,'$850K! Another record. 8 deals. Marcus first close — $45K app dev project. Team selling motion working.',  'December',6000000,2400000,2083333,true),
-- ─── December 2025 ───
('sf-2025-12-07','sourcefuse','2025-12-07','Week 1 Dec','December',2083333,165000,2,82500,8400000,3360000,4.0,16,0,1,8000,'Q4',6250000,1795000,72,15,'Dec open. Year-end budget flush opportunities appearing. 2 quick closes.',  'January',5500000,2200000,2083333,true),
('sf-2025-12-14','sourcefuse','2025-12-14','Week 2 Dec','December',2083333,380000,4,95000,8600000,3440000,4.1,15,1,1,6000,'Q4',6250000,2010000,75,16,'Year-end push. ClearPath $115K ARC license in final stage. Marcus ramping well.',  'January',5700000,2280000,2083333,true),
('sf-2025-12-21','sourcefuse','2025-12-21','Week 3 Dec','December',2083333,620000,6,103333,8200000,3280000,3.9,15,1,0,0,'Q4',6250000,2250000,68,14,'$620K MTD. Holiday slowdown expected next week. ClearPath closed at $120K.',  'January',5900000,2360000,2083333,true),
('sf-2025-12-28','sourcefuse','2025-12-28','Week 4 Dec','December',2083333,920000,9,102222,8500000,3400000,4.1,15,2,1,5000,'Q4',6250000,2550000,60,12,'$920K December! Q4 total $2.55M. Year 1 total ~$7.5M from direct sales. Pipeline entering Y2 at $8.5M.',  'January',6100000,2440000,2083333,true),
-- ─── January 2026 ───
('sf-2026-01-04','sourcefuse','2026-01-04','Week 1 Jan','January',2083333,125000,1,125000,8800000,3520000,4.2,15,0,1,10000,'Q1',6250000,125000,75,16,'Year 2 begins. Both reps producing. Marcus past ramp — entering productive phase.',  'February',5800000,2320000,2083333,true),
('sf-2026-01-11','sourcefuse','2026-01-11','Week 2 Jan','January',2083333,310000,3,103333,9000000,3600000,4.3,14,0,0,0,'Q1',6250000,310000,78,17,'Strong start to Y2. Pipeline >$9M first time. Two-rep engine firing.',  'February',6000000,2400000,2083333,true),
('sf-2026-01-18','sourcefuse','2026-01-18','Week 3 Jan','January',2083333,520000,5,104000,8700000,3480000,4.2,14,1,1,8000,'Q1',6250000,520000,80,18,'$520K MTD. Marcus first $100K+ deal — BrightWave digital transformation. Huge milestone.',  'February',6200000,2480000,2083333,true),
('sf-2026-01-25','sourcefuse','2026-01-25','Week 4 Jan','January',2083333,880000,8,110000,9100000,3640000,4.4,14,2,0,0,'Q1',6250000,880000,82,19,'$880K January! 8 deals. Both reps contributing $100K+ deals. Y2 trajectory on pace.',  'February',6400000,2560000,2083333,true),
-- ─── February 2026 ───
('sf-2026-02-01','sourcefuse','2026-02-01','Week 1 Feb','February',2083333,135000,1,135000,9300000,3720000,4.5,13,0,1,6000,'Q1',6250000,1015000,78,17,'Feb started clean. Pipeline growing organically. Expansion deals from existing accounts showing up.',  'March',6100000,2440000,2083333,true),
('sf-2026-02-08','sourcefuse','2026-02-08','Week 2 Feb','February',2083333,340000,3,113333,9500000,3800000,4.6,13,1,0,0,'Q1',6250000,1220000,80,18,'Vertex Healthcare expansion $130K closed. Account ACV now $285K — growth playbook working.',  'March',6300000,2520000,2083333,true),
('sf-2026-02-15','sourcefuse','2026-02-15','Week 3 Feb','February',2083333,580000,5,116000,9200000,3680000,4.4,13,1,1,5000,'Q1',6250000,1460000,82,19,'$580K MTD. 5 deals. Expansion revenue 25% of monthly total — Stream 2 thesis proving out.',  'March',6500000,2600000,2083333,true),
('sf-2026-02-22','sourcefuse','2026-02-22','Week 4 Feb','February',2083333,950000,8,118750,9400000,3760000,4.5,12,2,0,0,'Q1',6250000,1830000,85,20,'$950K! February record. 8 deals, 2 above $100K. Days to close trending down to 12.',  'March',6700000,2680000,2083333,true),
-- ─── March 2026 ───
('sf-2026-03-01','sourcefuse','2026-03-01','Week 1 Mar','March',2083333,150000,2,75000,9600000,3840000,4.6,12,0,0,0,'Q1',6250000,1980000,80,18,'March open. Q1 already at $1.98M with 4 weeks left. $6.25M quarterly target in sight.',  'April',6400000,2560000,2083333,true),
('sf-2026-03-08','sourcefuse','2026-03-08','Week 2 Mar','March',2083333,380000,4,95000,9800000,3920000,4.7,12,1,1,4000,'Q1',6250000,2260000,82,19,'Pipeline approaching $10M. 4 deals closed. NexGen $105K cloud deal won.',  'April',6600000,2640000,2083333,true),
('sf-2026-03-15','sourcefuse','2026-03-15','Week 3 Mar','March',2083333,640000,6,106667,9500000,3800000,4.6,11,1,0,0,'Q1',6250000,2520000,85,20,'$640K MTD. 6 deals. Pipeline converting well — Q1 close at $2.5M+ likely. Days to close at 11.',  'April',6800000,2720000,2083333,true),
('sf-2026-03-22','sourcefuse','2026-03-22','Week 4 Mar','March',2083333,1100000,9,122222,9700000,3880000,4.7,11,3,0,0,'Q1',6250000,2980000,88,21,'$1.1M March! 9 deals, 3 above $100K. Q1 total $2.98M — up 47% from Q4. Both reps above quota. Hire plan for Rep 3 discussion starting.',  'April',7000000,2800000,2083333,true)
ON CONFLICT (id) DO UPDATE SET
  revenue_mtd = EXCLUDED.revenue_mtd,
  total_deals_closed = EXCLUDED.total_deals_closed,
  avg_deal_size = EXCLUDED.avg_deal_size,
  open_pipeline = EXCLUDED.open_pipeline,
  weighted_funnel = EXCLUDED.weighted_funnel,
  coverage_ratio = EXCLUDED.coverage_ratio,
  avg_days_to_close = EXCLUDED.avg_days_to_close,
  deals_over_100k = EXCLUDED.deals_over_100k,
  overdue_count = EXCLUDED.overdue_count,
  overdue_value = EXCLUDED.overdue_value,
  quarter_name = EXCLUDED.quarter_name,
  quarter_quota = EXCLUDED.quarter_quota,
  quarter_revenue_ytd = EXCLUDED.quarter_revenue_ytd,
  total_calls = EXCLUDED.total_calls,
  total_meetings = EXCLUDED.total_meetings,
  notes = EXCLUDED.notes,
  funnel_month_1 = EXCLUDED.funnel_month_1,
  funnel_total_1 = EXCLUDED.funnel_total_1,
  funnel_weighted_1 = EXCLUDED.funnel_weighted_1,
  funnel_quota_1 = EXCLUDED.funnel_quota_1,
  is_demo = EXCLUDED.is_demo;


-- ════════════════════════════════════════════════════════════
-- QUOTAS — Alex Chen, Marcus Taylor, Company
-- Jan 2025 through Jun 2026
-- ════════════════════════════════════════════════════════════

INSERT INTO quotas (client_id, rep_name, month_start, amount, fiscal_year)
VALUES
-- Company quota: $2,083,333/month
('sourcefuse','Company','2025-01-01',2083333,'FY2025'),
('sourcefuse','Company','2025-02-01',2083333,'FY2025'),
('sourcefuse','Company','2025-03-01',2083333,'FY2025'),
('sourcefuse','Company','2025-04-01',2083333,'FY2025'),
('sourcefuse','Company','2025-05-01',2083333,'FY2025'),
('sourcefuse','Company','2025-06-01',2083333,'FY2025'),
('sourcefuse','Company','2025-07-01',2083333,'FY2025'),
('sourcefuse','Company','2025-08-01',2083333,'FY2025'),
('sourcefuse','Company','2025-09-01',2083333,'FY2025'),
('sourcefuse','Company','2025-10-01',2083333,'FY2025'),
('sourcefuse','Company','2025-11-01',2083333,'FY2025'),
('sourcefuse','Company','2025-12-01',2083333,'FY2025'),
('sourcefuse','Company','2026-01-01',2083333,'FY2026'),
('sourcefuse','Company','2026-02-01',2083333,'FY2026'),
('sourcefuse','Company','2026-03-01',2083333,'FY2026'),
('sourcefuse','Company','2026-04-01',2083333,'FY2026'),
('sourcefuse','Company','2026-05-01',2083333,'FY2026'),
('sourcefuse','Company','2026-06-01',2083333,'FY2026'),
-- Alex Chen: $80K/mo Jan-Sep 2025, $95K Oct 2025+
('sourcefuse','Alex Chen','2025-01-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-02-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-03-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-04-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-05-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-06-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-07-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-08-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-09-01',80000,'FY2025'),
('sourcefuse','Alex Chen','2025-10-01',95000,'FY2025'),
('sourcefuse','Alex Chen','2025-11-01',95000,'FY2025'),
('sourcefuse','Alex Chen','2025-12-01',95000,'FY2025'),
('sourcefuse','Alex Chen','2026-01-01',95000,'FY2026'),
('sourcefuse','Alex Chen','2026-02-01',95000,'FY2026'),
('sourcefuse','Alex Chen','2026-03-01',95000,'FY2026'),
('sourcefuse','Alex Chen','2026-04-01',95000,'FY2026'),
('sourcefuse','Alex Chen','2026-05-01',95000,'FY2026'),
('sourcefuse','Alex Chen','2026-06-01',95000,'FY2026'),
-- Marcus Taylor: $0 Jan-Sep 2025, $65K Oct-Dec 2025, $85K Jan 2026+
('sourcefuse','Marcus Taylor','2025-01-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-02-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-03-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-04-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-05-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-06-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-07-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-08-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-09-01',0,'FY2025'),
('sourcefuse','Marcus Taylor','2025-10-01',65000,'FY2025'),
('sourcefuse','Marcus Taylor','2025-11-01',65000,'FY2025'),
('sourcefuse','Marcus Taylor','2025-12-01',65000,'FY2025'),
('sourcefuse','Marcus Taylor','2026-01-01',85000,'FY2026'),
('sourcefuse','Marcus Taylor','2026-02-01',85000,'FY2026'),
('sourcefuse','Marcus Taylor','2026-03-01',85000,'FY2026'),
('sourcefuse','Marcus Taylor','2026-04-01',85000,'FY2026'),
('sourcefuse','Marcus Taylor','2026-05-01',85000,'FY2026'),
('sourcefuse','Marcus Taylor','2026-06-01',85000,'FY2026')
ON CONFLICT (client_id, rep_name, month_start) DO UPDATE SET
  amount = EXCLUDED.amount,
  fiscal_year = EXCLUDED.fiscal_year;
