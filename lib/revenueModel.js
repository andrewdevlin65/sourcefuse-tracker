// ─────────────────────────────────────────────────────────
// Revenue Model Engine — SourceFuse $23M → $55M
// Pure calculation — no UI, no Supabase, no side effects.
// ─────────────────────────────────────────────────────────

const DEFAULT_ASSUMPTIONS = {
  // Section 1 - Revenue Targets
  current_revenue: 23000000,
  sellers_today: 4,
  target_y1: 25000000,
  target_y2: 35000000,
  target_y3: 55000000,
  direct_channel_pct: 0.20,

  // Section 2 - Rep Economics
  rep_quota: 1000000,
  rep_cost: 215000,
  fractional_monthly: 30000,

  // Section 3 - Three Stream
  recurring_pct: 0.80,
  active_accounts: 40,
  retention_y1: 0.70,
  retention_y2: 0.75,
  retention_y3: 0.80,
  recurring_conversion_pct: 0.20,
  avg_acv_today: 500000,
  target_acv_y3: 1000000,
  expansion_rate_y1: 0.15,
  expansion_rate_y2: 0.20,
  expansion_rate_y3: 0.25,
  new_logos_per_rep: 12,
  avg_new_logo_acv_y1: 100000,
  avg_new_logo_acv_y2: 150000,
  avg_new_logo_acv_y3: 200000,

  // Section 4 - Rep Productivity
  attainment_y1: 0.50,
  attainment_y2: 0.90,
  attainment_y3: 1.00,

  // Hire Plan
  hire_quarters: [1, 4, 7, 10],
  quarters_between_hires: 3,
}

const ASSUMPTION_METADATA = [
  // Section 1 - Revenue Targets
  { key: 'current_revenue', label: 'Current annual revenue', section: 'Revenue Targets', format: 'currency', notes: 'Baseline ARR as of model start', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'sellers_today', label: 'Active sellers today', section: 'Revenue Targets', format: 'number', notes: 'Includes fractional advisors', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'target_y1', label: 'Year 1 revenue target', section: 'Revenue Targets', format: 'currency', notes: '$25M target', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'target_y2', label: 'Year 2 revenue target', section: 'Revenue Targets', format: 'currency', notes: '$35M target', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'target_y3', label: 'Year 3 revenue target', section: 'Revenue Targets', format: 'currency', notes: '$55M target', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'direct_channel_pct', label: 'Direct channel %', section: 'Revenue Targets', format: 'percent', notes: 'Revenue from direct sales vs AWS channel', is_kelly_input: false, has_y1_y2_y3: false },

  // Section 2 - Rep Economics
  { key: 'rep_quota', label: 'Annual rep quota', section: 'Rep Economics', format: 'currency', notes: 'Fully-ramped annual target per rep', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'rep_cost', label: 'Fully-loaded rep cost', section: 'Rep Economics', format: 'currency', notes: 'Base + OTE + benefits + tools', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'fractional_monthly', label: 'Fractional advisor cost/month', section: 'Rep Economics', format: 'currency', notes: 'Andrew Devlin + Joe Garrison combined', is_kelly_input: false, has_y1_y2_y3: false },

  // Section 3 - Three Stream
  { key: 'recurring_pct', label: 'Recurring % of current revenue', section: 'Three-Stream Revenue', format: 'percent', notes: 'Industry avg 45-60% for IT services', is_kelly_input: true, has_y1_y2_y3: false },
  { key: 'active_accounts', label: 'Active accounts today', section: 'Three-Stream Revenue', format: 'number', notes: 'Accounts generating recurring revenue', is_kelly_input: true, has_y1_y2_y3: false },
  { key: 'retention_y1', label: 'Gross retention rate Y1', section: 'Three-Stream Revenue', format: 'percent', notes: '70-80% typical for managed services', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'retention_y2', label: 'Gross retention rate Y2', section: 'Three-Stream Revenue', format: 'percent', notes: 'Improving with CS investment', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'retention_y3', label: 'Gross retention rate Y3', section: 'Three-Stream Revenue', format: 'percent', notes: 'Target 80%+ at scale', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'recurring_conversion_pct', label: 'Project-to-recurring conversion', section: 'Three-Stream Revenue', format: 'percent', notes: '% of project revenue that converts to recurring', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'avg_acv_today', label: 'Avg ACV today', section: 'Three-Stream Revenue', format: 'currency', notes: 'Current average contract value', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'target_acv_y3', label: 'Target ACV by Year 3', section: 'Three-Stream Revenue', format: 'currency', notes: 'Goal: double ACV through expansion', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'expansion_rate_y1', label: 'Net expansion rate Y1', section: 'Three-Stream Revenue', format: 'percent', notes: 'Cross-sell + upsell within existing accounts', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'expansion_rate_y2', label: 'Net expansion rate Y2', section: 'Three-Stream Revenue', format: 'percent', notes: 'Growing with account management maturity', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'expansion_rate_y3', label: 'Net expansion rate Y3', section: 'Three-Stream Revenue', format: 'percent', notes: 'Target 25% net dollar expansion', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'new_logos_per_rep', label: 'New logos per rep per year', section: 'Three-Stream Revenue', format: 'number', notes: '12 = 1 per month fully ramped', is_kelly_input: false, has_y1_y2_y3: false },
  { key: 'avg_new_logo_acv_y1', label: 'Avg new logo ACV Y1', section: 'Three-Stream Revenue', format: 'currency', notes: 'Smaller initial deals as reps ramp', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'avg_new_logo_acv_y2', label: 'Avg new logo ACV Y2', section: 'Three-Stream Revenue', format: 'currency', notes: 'Growing as reps mature', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'avg_new_logo_acv_y3', label: 'Avg new logo ACV Y3', section: 'Three-Stream Revenue', format: 'currency', notes: 'Target $200K initial deal size', is_kelly_input: false, has_y1_y2_y3: true },

  // Section 4 - Rep Productivity
  { key: 'attainment_y1', label: 'Rep attainment Y1', section: 'Rep Productivity', format: 'percent', notes: '50% — ramp year', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'attainment_y2', label: 'Rep attainment Y2', section: 'Rep Productivity', format: 'percent', notes: '90% — maturing', is_kelly_input: false, has_y1_y2_y3: true },
  { key: 'attainment_y3', label: 'Rep attainment Y3', section: 'Rep Productivity', format: 'percent', notes: '100% — fully productive', is_kelly_input: false, has_y1_y2_y3: true },
]

function varianceStatus(assumed, actual) {
  if (actual == null || assumed == null) return null
  if (actual >= assumed) return 'green'
  if (actual >= assumed * 0.85) return 'yellow'
  return 'red'
}

function makeVariance(assumed, actual) {
  return {
    assumed,
    actual: actual ?? null,
    delta: actual != null ? actual - assumed : null,
    status: varianceStatus(assumed, actual),
  }
}

function calculateRevenueModel(assumptions = {}, actuals = {}) {
  const a = { ...DEFAULT_ASSUMPTIONS, ...assumptions }
  const act = {
    recurring_pct_actual: null,
    active_accounts_actual: null,
    retention_actual: null,
    expansion_rate_actual: null,
    new_logos_actual: null,
    avg_new_logo_acv_actual: null,
    stream1_actuals: [],
    stream2_actuals: [],
    stream3_actuals: [],
    months_of_data: 0,
    ...actuals,
  }

  // ── Stream 1: Recurring Base ──
  const recurringBase = a.current_revenue * a.recurring_pct
  const stream1 = {
    y1: recurringBase * a.retention_y1,
    y2: recurringBase * a.retention_y1 * a.retention_y2,
    y3: recurringBase * a.retention_y1 * a.retention_y2 * a.retention_y3,
  }

  // ── Stream 2: Account Expansion ──
  const stream2 = {
    y1: recurringBase * a.expansion_rate_y1,
    y2: (recurringBase * a.retention_y1) * a.expansion_rate_y2,
    y3: (recurringBase * a.retention_y1 * a.retention_y2) * a.expansion_rate_y3,
  }

  // ── Stream 3: Net New Logos ──
  // Reps ramp over time — use attainment as a proxy for productive capacity
  const effectiveReps_y1 = 2 * a.attainment_y1  // 2 reps hired Y1
  const effectiveReps_y2 = 2 + 1 * a.attainment_y1  // 2 ramped + 1 ramping
  const effectiveReps_y3 = 3 + 1 * a.attainment_y1  // 3 ramped + 1 ramping
  const stream3 = {
    y1: effectiveReps_y1 * a.new_logos_per_rep * a.avg_new_logo_acv_y1,
    y2: effectiveReps_y2 * a.new_logos_per_rep * a.avg_new_logo_acv_y2,
    y3: effectiveReps_y3 * a.new_logos_per_rep * a.avg_new_logo_acv_y3,
  }

  // ── Total Organic ──
  const total_organic = {
    y1: stream1.y1 + stream2.y1 + stream3.y1,
    y2: stream1.y2 + stream2.y2 + stream3.y2,
    y3: stream1.y3 + stream2.y3 + stream3.y3,
  }

  // ── Gap Analysis ──
  const gap = {
    y1: Math.max(0, a.target_y1 - total_organic.y1),
    y2: Math.max(0, a.target_y2 - total_organic.y2),
    y3: Math.max(0, a.target_y3 - total_organic.y3),
  }
  const hunters_share_y3 = a.target_y3 > 0 ? gap.y3 / a.target_y3 : 0

  // ── Headcount ──
  const hireCount = a.hire_quarters?.length || 4
  const weighted_ramp = hireCount > 0
    ? a.hire_quarters.reduce((sum, hireQ, i) => {
        const quartersActive = 12 - hireQ + 1
        const rampFactor = Math.min(quartersActive / 4, 1) * (i < 2 ? a.attainment_y1 : a.attainment_y2)
        return sum + rampFactor
      }, 0) / hireCount
    : a.attainment_y1
  const reps_needed = a.rep_quota > 0 ? Math.ceil(gap.y3 / (a.rep_quota * a.attainment_y3)) : 0
  const hire_plan_revenue = hireCount * a.rep_quota * weighted_ramp
  const hire_plan_gap = Math.max(0, gap.y3 - hire_plan_revenue)

  // ── $55M Date Projection ──
  const cumY1 = total_organic.y1
  const cumY2 = total_organic.y2
  const cumY3 = total_organic.y3
  let projected_55m_quarter = 'Beyond Y3'
  let projected_55m_on_track = false
  let months_ahead_behind = 0
  const target = a.target_y3

  if (cumY3 >= target) {
    // Interpolate within Y1-Y3
    if (cumY1 >= target) {
      projected_55m_quarter = 'Q4 Y1'
      projected_55m_on_track = true
      months_ahead_behind = 24
    } else if (cumY2 >= target) {
      const frac = (target - cumY1) / (cumY2 - cumY1)
      const quarter = Math.ceil(frac * 4)
      projected_55m_quarter = `Q${quarter} Y2`
      projected_55m_on_track = true
      months_ahead_behind = Math.round((1 - frac) * 12)
    } else {
      const frac = (target - cumY2) / (cumY3 - cumY2)
      const quarter = Math.ceil(frac * 4)
      projected_55m_quarter = `Q${Math.min(quarter, 4)} Y3`
      projected_55m_on_track = frac <= 1.0
      months_ahead_behind = Math.round((1 - frac) * 12)
    }
  } else {
    // Project beyond Y3
    const y3GrowthRate = cumY2 > 0 ? (cumY3 - cumY2) / cumY2 : 0.15
    let projected = cumY3
    let extraYears = 0
    while (projected < target && extraYears < 5) {
      extraYears++
      projected *= (1 + y3GrowthRate)
    }
    if (extraYears <= 2) {
      projected_55m_quarter = `Y${3 + extraYears}`
    }
    months_ahead_behind = -extraYears * 12
  }

  // ── ROI ──
  const total_rep_cost_3yr = hireCount * a.rep_cost * 3
  const total_fractional_cost_3yr = a.fractional_monthly * 12 * 3
  const total_investment_3yr = total_rep_cost_3yr + total_fractional_cost_3yr
  const totalNewRevenue = total_organic.y1 + total_organic.y2 + total_organic.y3
  const revenue_per_dollar_invested = total_investment_3yr > 0 ? totalNewRevenue / total_investment_3yr : 0

  // ── ACV trajectory ──
  const avg_acv_y1 = a.avg_acv_today * (1 + a.expansion_rate_y1)
  const avg_acv_y2 = avg_acv_y1 * (1 + a.expansion_rate_y2)
  const avg_acv_y3 = avg_acv_y2 * (1 + a.expansion_rate_y3)

  // ── Variances ──
  const variances = {
    recurring_pct: makeVariance(a.recurring_pct, act.recurring_pct_actual),
    retention: makeVariance(a.retention_y1, act.retention_actual),
    expansion_rate: makeVariance(a.expansion_rate_y1, act.expansion_rate_actual),
    new_logos: makeVariance(a.new_logos_per_rep, act.new_logos_actual),
    avg_new_logo_acv: makeVariance(a.avg_new_logo_acv_y1, act.avg_new_logo_acv_actual),
  }

  // ── Recalibrated projection (using actuals where available) ──
  let recalibrated_55m_quarter = projected_55m_quarter
  let recalibration_note = 'Using assumption-based projections'
  if (act.months_of_data >= 3) {
    const s1Actual = act.stream1_actuals.reduce((s, q) => s + q.amount, 0)
    const s2Actual = act.stream2_actuals.reduce((s, q) => s + q.amount, 0)
    const s3Actual = act.stream3_actuals.reduce((s, q) => s + q.amount, 0)
    const actualTotal = s1Actual + s2Actual + s3Actual
    const quartersOfData = Math.ceil(act.months_of_data / 3)
    const annualizedActual = quartersOfData > 0 ? (actualTotal / quartersOfData) * 4 : 0
    if (annualizedActual > 0) {
      const yearsTo55M = annualizedActual > 0 ? Math.ceil((target - a.current_revenue) / (annualizedActual - a.current_revenue * 0.7)) : 5
      recalibrated_55m_quarter = yearsTo55M <= 3 ? `Y${yearsTo55M}` : `Y${yearsTo55M}`
      const pace = annualizedActual / a.target_y1
      recalibration_note = pace >= 1
        ? `Tracking ${Math.round((pace - 1) * 100)}% above Y1 target based on ${act.months_of_data} months of data`
        : `Tracking ${Math.round((1 - pace) * 100)}% below Y1 target — ${act.months_of_data} months of data`
    }
  }

  return {
    stream1, stream2, stream3, total_organic,
    gap, hunters_share_y3,
    reps_needed, weighted_ramp, hire_plan_revenue, hire_plan_gap,
    projected_55m_quarter, projected_55m_on_track, months_ahead_behind,
    total_rep_cost_3yr, total_fractional_cost_3yr, total_investment_3yr, revenue_per_dollar_invested,
    avg_acv_y1, avg_acv_y2, avg_acv_y3,
    variances,
    recalibrated_55m_quarter, recalibration_note,
  }
}

module.exports = { calculateRevenueModel, DEFAULT_ASSUMPTIONS, ASSUMPTION_METADATA }
