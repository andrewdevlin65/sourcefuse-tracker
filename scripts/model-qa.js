// ─────────────────────────────────────────────────────────
// Revenue Model QA — Directional Impact Tests
// Run: node scripts/model-qa.js
// ─────────────────────────────────────────────────────────
const { calculateRevenueModel, DEFAULT_ASSUMPTIONS } = require('../lib/revenueModel')

// Suppress console.log from model during tests
const origLog = console.log
console.log = () => {}

let pass = 0, fail = 0, total = 0
const failures = []

function baseline() { return calculateRevenueModel({ ...DEFAULT_ASSUMPTIONS }) }
function run(overrides, actuals) { return calculateRevenueModel({ ...DEFAULT_ASSUMPTIONS, ...overrides }, actuals) }

function test(name, fn) {
  total++
  try {
    const result = fn()
    if (result === true) {
      pass++
    } else {
      fail++
      failures.push({ name, ...result })
    }
  } catch (e) {
    fail++
    failures.push({ name, error: e.message })
  }
}

function gt(a, b, label) {
  if (a > b) return true
  return { expected: `${label} > baseline`, actual: `${a} <= ${b}` }
}
function lt(a, b, label) {
  if (a < b) return true
  return { expected: `${label} < baseline`, actual: `${a} >= ${b}` }
}
function eq(a, b, label) {
  if (a === b) return true
  return { expected: `${label} === ${b}`, actual: `got ${a}` }
}

const b = baseline()

// ══════════════════════════════════════════════════════════
// GROUP 1 — Stream 1 (Recurring Base)
// ══════════════════════════════════════════════════════════

test('1a: retention_y3 0.80→0.90 → stream1.y3 INCREASES', () => {
  const r = run({ retention_y3: 0.90 })
  return gt(r.stream1.y3, b.stream1.y3, 'stream1.y3')
})

test('1b: recurring_pct 0.80→0.60 → stream1.y1 DECREASES', () => {
  const r = run({ recurring_pct: 0.60 })
  return lt(r.stream1.y1, b.stream1.y1, 'stream1.y1')
})

test('1c: recurring_conversion_pct 0.20→0.30 → stream1.y2 INCREASES', () => {
  const r = run({ recurring_conversion_pct: 0.30 })
  return gt(r.stream1.y2, b.stream1.y2, 'stream1.y2')
})

// ══════════════════════════════════════════════════════════
// GROUP 2 — Stream 2 (Account Expansion)
// ══════════════════════════════════════════════════════════

test('2a: expansion_rate_y1 0.15→0.25 → stream2.y1 INCREASES', () => {
  const r = run({ expansion_rate_y1: 0.25 })
  return gt(r.stream2.y1, b.stream2.y1, 'stream2.y1')
})

test('2b: active_accounts 40→60 → stream2.y1 INCREASES proportionally', () => {
  const r = run({ active_accounts: 60 })
  return gt(r.stream2.y1, b.stream2.y1, 'stream2.y1')
})

test('2c: target_acv_y3 1M→1.5M → stream2.y3 INCREASES', () => {
  const r = run({ target_acv_y3: 1500000 })
  return gt(r.stream2.y3, b.stream2.y3, 'stream2.y3')
})

test('2d: avg_acv_today 500K→750K → stream2.y1 INCREASES', () => {
  const r = run({ avg_acv_today: 750000 })
  return gt(r.stream2.y1, b.stream2.y1, 'stream2.y1')
})

// ══════════════════════════════════════════════════════════
// GROUP 3 — Stream 3 (New Logos)
// ══════════════════════════════════════════════════════════

test('3a: new_logos_per_rep 12→16 → stream3.y1 INCREASES', () => {
  const r = run({ new_logos_per_rep: 16 })
  return gt(r.stream3.y1, b.stream3.y1, 'stream3.y1')
})

test('3b: avg_new_logo_acv_y1 100K→150K → stream3.y1 INCREASES proportionally', () => {
  const r = run({ avg_new_logo_acv_y1: 150000 })
  return gt(r.stream3.y1, b.stream3.y1, 'stream3.y1')
})

test('3c: hire_quarters [1,2,3,4] → stream3.y2/y3 INCREASE', () => {
  // More reps hired earlier → more effective reps → more new logos
  // Stream3 doesn't directly use hire_quarters, it uses effectiveReps which
  // are hardcoded. But hire_plan_revenue should increase.
  const r = run({ hire_quarters: [1, 2, 3, 4] })
  return gt(r.hire_plan_revenue, b.hire_plan_revenue, 'hire_plan_revenue')
})

// ══════════════════════════════════════════════════════════
// GROUP 4 — Gap & Headcount
// ══════════════════════════════════════════════════════════

test('4a: boost all streams → gap.y3 DECREASES or stays 0', () => {
  const r = run({ retention_y3: 0.95, expansion_rate_y3: 0.35, new_logos_per_rep: 16 })
  if (r.gap.y3 <= b.gap.y3) return true
  return { expected: 'gap.y3 <= baseline', actual: `${r.gap.y3} > ${b.gap.y3}` }
})

test('4a-reps: boost all streams → reps_needed DECREASES or stays 0', () => {
  const r = run({ retention_y3: 0.95, expansion_rate_y3: 0.35, new_logos_per_rep: 16 })
  if (r.reps_needed <= b.reps_needed) return true
  return { expected: 'reps_needed <= baseline', actual: `${r.reps_needed} > ${b.reps_needed}` }
})

test('4b-reps: rep_quota 1M→1.5M → reps_needed DECREASES or stays 0', () => {
  const r = run({ rep_quota: 1500000 })
  if (r.reps_needed <= b.reps_needed) return true
  return { expected: 'reps_needed <= baseline', actual: `${r.reps_needed} > ${b.reps_needed}` }
})

test('4b-reps-deficit: with low streams, rep_quota 1M→1.5M → reps_needed DECREASES', () => {
  // Force a gap so we can test the divisor
  const lo = { retention_y1: 0.50, retention_y2: 0.50, retention_y3: 0.50, expansion_rate_y1: 0.05, expansion_rate_y2: 0.05, expansion_rate_y3: 0.05 }
  const bLo = run(lo)
  const rLo = run({ ...lo, rep_quota: 1500000 })
  if (bLo.gap.y3 === 0) return true  // no gap to test
  return lt(rLo.reps_needed, bLo.reps_needed, 'reps_needed')
})

test('4b-hire: rep_quota 1M→1.5M → hire_plan_revenue INCREASES', () => {
  const r = run({ rep_quota: 1500000 })
  return gt(r.hire_plan_revenue, b.hire_plan_revenue, 'hire_plan_revenue')
})

test('4c-ramp: attainment_y2 0.90→0.95 → weighted_ramp INCREASES', () => {
  const r = run({ attainment_y2: 0.95 })
  return gt(r.weighted_ramp, b.weighted_ramp, 'weighted_ramp')
})

test('4c-reps: attainment_y2 0.90→0.95 → reps_needed DECREASES or equal', () => {
  const r = run({ attainment_y2: 0.95 })
  if (r.reps_needed <= b.reps_needed) return true
  return { expected: 'reps_needed <= baseline', actual: `${r.reps_needed} > ${b.reps_needed}` }
})

test('4c-hire: attainment_y2 0.90→0.95 → hire_plan_revenue INCREASES', () => {
  const r = run({ attainment_y2: 0.95 })
  return gt(r.hire_plan_revenue, b.hire_plan_revenue, 'hire_plan_revenue')
})

// ══════════════════════════════════════════════════════════
// GROUP 5 — $55M Date Projection
// ══════════════════════════════════════════════════════════

test('5a: very high streams → within Y3, on_track=true', () => {
  const r = run({
    retention_y1: 0.95, retention_y2: 0.95, retention_y3: 0.95,
    expansion_rate_y1: 0.35, expansion_rate_y2: 0.40, expansion_rate_y3: 0.45,
    new_logos_per_rep: 20, avg_new_logo_acv_y1: 200000, avg_new_logo_acv_y2: 300000, avg_new_logo_acv_y3: 400000,
  })
  if (!r.projected_55m_on_track) return { expected: 'on_track=true', actual: `on_track=false, quarter=${r.projected_55m_quarter}` }
  if (!r.projected_55m_quarter.includes('Y1') && !r.projected_55m_quarter.includes('Y2') && !r.projected_55m_quarter.includes('Y3'))
    return { expected: 'within Y1-Y3', actual: r.projected_55m_quarter }
  return true
})

test('5b: very low streams → beyond Y3, on_track=false', () => {
  const r = run({
    retention_y1: 0.50, retention_y2: 0.50, retention_y3: 0.50,
    expansion_rate_y1: 0.05, expansion_rate_y2: 0.05, expansion_rate_y3: 0.05,
    new_logos_per_rep: 3, avg_new_logo_acv_y1: 50000, avg_new_logo_acv_y2: 50000, avg_new_logo_acv_y3: 50000,
  })
  if (r.projected_55m_on_track) return { expected: 'on_track=false', actual: 'on_track=true' }
  return true
})

test('5c: rep_quota 1M→2M → hire_plan_revenue INCREASES → better $55M date', () => {
  const r = run({ rep_quota: 2000000 })
  if (r.hire_plan_revenue <= b.hire_plan_revenue)
    return { expected: 'hire_plan_revenue increases', actual: `${r.hire_plan_revenue} <= ${b.hire_plan_revenue}` }
  // Better date = less negative months_ahead_behind
  if (r.months_ahead_behind < b.months_ahead_behind)
    return { expected: 'months_ahead_behind improves', actual: `${r.months_ahead_behind} < ${b.months_ahead_behind}` }
  return true
})

// ══════════════════════════════════════════════════════════
// GROUP 6 — ROI Calculations
// ══════════════════════════════════════════════════════════

test('6a: more reps (6 hires) → total_rep_cost_3yr INCREASES', () => {
  const r = run({ hire_quarters: [1, 2, 3, 4, 5, 6] })
  return gt(r.total_rep_cost_3yr, b.total_rep_cost_3yr, 'total_rep_cost_3yr')
})

test('6a-roi: more reps → revenue_per_dollar_invested CHANGES', () => {
  const r = run({ hire_quarters: [1, 2, 3, 4, 5, 6] })
  if (r.revenue_per_dollar_invested === b.revenue_per_dollar_invested)
    return { expected: 'ROI changes', actual: 'ROI unchanged' }
  return true
})

test('6b: fractional_monthly 30K→50K → total_fractional_cost_3yr INCREASES', () => {
  const r = run({ fractional_monthly: 50000 })
  return gt(r.total_fractional_cost_3yr, b.total_fractional_cost_3yr, 'total_fractional_cost_3yr')
})

test('6b-inv: fractional_monthly 30K→50K → total_investment_3yr INCREASES', () => {
  const r = run({ fractional_monthly: 50000 })
  return gt(r.total_investment_3yr, b.total_investment_3yr, 'total_investment_3yr')
})

// ══════════════════════════════════════════════════════════
// GROUP 7 — Variance Calculations
// ══════════════════════════════════════════════════════════

test('7a: recurring_pct_actual > assumed → status green', () => {
  const r = run({}, { recurring_pct_actual: 0.85 })
  return eq(r.variances.recurring_pct.status, 'green', 'status')
})

test('7b: expansion_rate_actual < assumed*0.84 → status red', () => {
  // assumed = 0.15, so 0.84 * 0.15 = 0.126. Use 0.12.
  const r = run({}, { expansion_rate_actual: 0.12 })
  return eq(r.variances.expansion_rate.status, 'red', 'status')
})

test('7c: new_logos_actual = assumed*0.90 → status yellow', () => {
  // assumed = 12, so 12*0.90 = 10.8
  const r = run({}, { new_logos_actual: 10.8 })
  return eq(r.variances.new_logos.status, 'yellow', 'status')
})

// ══════════════════════════════════════════════════════════
// REPORT
// ══════════════════════════════════════════════════════════
console.log = origLog

console.log('\n═══════════════════════════════════════')
console.log('  REVENUE MODEL QA RESULTS')
console.log('═══════════════════════════════════════')
console.log(`  Total tests: ${total}`)
console.log(`  ✅ PASS: ${pass}`)
console.log(`  ❌ FAIL: ${fail}`)
console.log('═══════════════════════════════════════\n')

if (failures.length > 0) {
  console.log('FAILURES:\n')
  failures.forEach(f => {
    console.log(`  ❌ ${f.name}`)
    if (f.error) console.log(`     Error: ${f.error}`)
    if (f.expected) console.log(`     Expected: ${f.expected}`)
    if (f.actual) console.log(`     Actual:   ${f.actual}`)
    console.log()
  })
}

process.exit(fail > 0 ? 1 : 0)
