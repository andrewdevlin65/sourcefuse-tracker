// ─────────────────────────────────────────────────────────
// Client Configuration — SourceFuse
// Change these values to rebrand the app for a different client.
// No other files should contain hardcoded client-specific strings.
// ─────────────────────────────────────────────────────────

const CLIENT = {

  // ── Identity ──────────────────────────────────────────
  id: 'sourcefuse',                              // Supabase client_id value
  ingestId: 'sourcefuse',                         // client_id used in ingest_log table
  name: 'SourceFuse',                             // Short display name
  fullName: 'SOURCEFUSE TECHNOLOGIES',            // Header banner name (uppercase)
  nameLine1: 'SOURCEFUSE',                        // Home page logo line 1
  nameLine2: 'TECHNOLOGIES',                      // Home page logo line 2
  logoText: '</SOURCEFUSE>',                      // Logo text
  logoFont: 'monospace',                          // Logo font family
  industry: 'AWS Premier Partner specializing in cloud-native solutions',  // Used in AI prompts
  location: 'Jacksonville, FL',                   // Used in AI prompts

  // ── Branding / Colors ────────────────────────────────
  brand: {
    primary: '#e8192c',
    secondary: '#0f1117',
    accent: '#ffffff',
    headerGradient: 'linear-gradient(135deg, #0f1117 0%, #1a1d2e 100%)',
    // Legacy aliases used by components that reference brand.orange / brand.blue
    orange: '#e8192c',
    blue: '#0f1117',
    blueDark: '#0a0c10',
  },

  // ── Platform Branding ────────────────────────────────
  platform: {
    name: 'Revenue Architecture Platform',
    tagline: 'From $23M to $55M — tracked every week',
    company: 'Scaletech',
    partner: 'Sales Xceleration',
    footer: 'Powered by Scaletech / Sales Xceleration',
    motto: 'Revenue Architecture, Delivered',
  },

  // ── Locale & Currency ────────────────────────────────
  locale: 'en-US',
  timezone: 'America/New_York',
  timezoneLabel: 'ET',
  currency: 'USD',
  currencySymbol: '$',

  // ── CRM / Source System ──────────────────────────────
  crm: {
    name: 'HubSpot',
    opportunityPrefix: 'DEAL',
    campaignIdLabel: 'HubSpot Campaign ID',
    bowReportName: 'Pipeline Export',
  },

  // ── Fiscal Year ──────────────────────────────────────
  // Fiscal year starts in January. FY2025 = Jan 2025 – Dec 2025.
  fiscalYearStartMonth: 1,   // 1=Jan, 7=Jul
  fiscalYears: ['FY2024', 'FY2025', 'FY2026'],

  // Quarter mapping: month number → quarter name
  // SourceFuse: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
  quarters: {
    1: 'Q1', 2: 'Q1', 3: 'Q1',
    4: 'Q2', 5: 'Q2', 6: 'Q2',
    7: 'Q3', 8: 'Q3', 9: 'Q3',
    10: 'Q4', 11: 'Q4', 12: 'Q4',
  },

  // Ordered quarter definitions (for dropdowns, iteration)
  quarterList: [
    { name: 'Q1', months: ['01', '02', '03'] },
    { name: 'Q2', months: ['04', '05', '06'] },
    { name: 'Q3', months: ['07', '08', '09'] },
    { name: 'Q4', months: ['10', '11', '12'] },
  ],

  // ── People ───────────────────────────────────────────
  reps: {
    // Account Executives — appear on forecast, accuracy, weekly actuals
    ae: ['Alex Chen', 'Marcus Taylor'],

    // All reps shown on weekly form (includes non-AE roles)
    weekly: ['Alex Chen', 'Marcus Taylor'],

    // Reps for weekly actuals revenue tracking
    weeklyActuals: ['Alex Chen', 'Marcus Taylor'],

    // Reps on the month-end form (lowercase keys, display labels)
    monthEnd: [
      { key: 'alex_chen', label: 'Alex Chen' },
      { key: 'marcus_taylor', label: 'Marcus Taylor' },
    ],

    // GM / manager reps (for forecast page)
    gm: ['Kelly'],

    // All reps for accuracy tracking (AEs + GM)
    accuracy: ['Alex Chen', 'Marcus Taylor', 'Kelly'],

    // Quota grid reps (setup page) — 'Company' is the aggregate row
    quotaGrid: ['Company', 'Alex Chen', 'Marcus Taylor'],

    // Campaign owner options (CEO page dropdown)
    campaignOwners: ['Alex Chen', 'Marcus Taylor', 'Kelly', 'Andrew Devlin', 'Joe Garrison'],

    // Default campaign owner
    defaultCampaignOwner: 'Alex Chen',

    // Default AE for new large deals
    defaultDealRep: 'Alex Chen',
  },

  // ── Stakeholders (for AI report prompts) ─────────────
  stakeholders: {
    gm: { name: 'Kelly', title: 'CEO' },
    ceo: { name: 'Andrew Devlin', title: 'Fractional CRO' },
    founder: { name: 'Joe Garrison', title: 'Fractional Sales Director' },
  },

  // ── AI Defaults (fallbacks when report_settings table is empty) ──
  aiDefaults: {
    reportPersona: 'You are a strategic revenue advisor for SourceFuse, an AWS Premier Partner. You help CEO Kelly and fractional advisors Andrew Devlin and Joe Garrison track progress toward a $55M revenue target. SourceFuse has $23M current revenue, 80% recurring, 40 active accounts averaging $500K ACV. Revenue grows through 3 streams: recurring base, account expansion, and net new logos.',
    communicationStyle: 'Data-driven and strategic. Lead with metrics, then context. Frame everything against the $23M→$55M growth trajectory.',
    underperformanceFraming: 'Frame gaps as pipeline risks with specific remediation paths. Focus on leading indicators and account-level actions.',
    stakeholderNotes: 'Kelly wants strategic trajectory and risk flags. Andrew Devlin wants pipeline mechanics and rep productivity. Joe Garrison wants deal-level detail and coaching insights.',
    standardCloser: 'End with the single highest-leverage action for the coming week — name the account, the deal, or the initiative.',
    toneDefault: 'encouraging',
  },

  // Full AI system persona for the settings page default
  defaultReportPersona: `You are a strategic revenue advisor for SourceFuse, an AWS Premier Partner in Jacksonville FL. You prepare weekly revenue reports for CEO Kelly and fractional advisors Andrew Devlin (CRO) and Joe Garrison (Sales Director). Write as an experienced SaaS revenue leader who understands cloud services, recurring revenue models, and account expansion.`,

  // Report email recipients line
  reportRecipients: 'Kelly (CEO) · Andrew Devlin (Fractional CRO) · Joe Garrison (Fractional Sales Director)',

  // ── Products / Service Lines ─────────────────────────
  products: [
    { id: 'arc', name: 'ARC by SourceFuse', color: '#e8192c' },
    { id: 'cloud', name: 'Cloud Migration & Modernization', color: '#3b82f6' },
    { id: 'appdev', name: 'Application Development', color: '#10b981' },
    { id: 'digital', name: 'Digital Transformation', color: '#f59e0b' },
    { id: 'managed', name: 'Managed Services', color: '#8b5cf6' },
  ],

  // ── Revenue Model ────────────────────────────────────
  revenueModel: {
    currentArr: 23000000,
    recurringPct: 0.80,
    activeAccounts: 40,
    avgAcv: 500000,
    targets: { year1: 25000000, year2: 35000000, year3: 55000000 },
  },

  // ── Hire Plan ────────────────────────────────────────
  hirePlan: {
    repQuota: 1000000,
    repCost: 215000,
    fractionalMonthly: 30000,
    reps: [
      { id: 1, name: 'Alex Chen', hireQuarter: 'Q1 Y1', status: 'active' },
      { id: 2, name: 'Marcus Taylor', hireQuarter: 'Q4 Y1', status: 'ramping' },
      { id: 3, name: 'TBD Rep 3', hireQuarter: 'Q3 Y2', status: 'planned' },
      { id: 4, name: 'TBD Rep 4', hireQuarter: 'Q2 Y3', status: 'planned' },
    ],
  },
}

// ── Helpers ──────────────────────────────────────────────

/** Get the current fiscal year label based on today's date */
CLIENT.getCurrentFY = function () {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (this.fiscalYearStartMonth === 1) {
    // Calendar-year FY: FY2025 = Jan 2025 – Dec 2025
    return `FY${year}`
  }
  // Mid-year FY: e.g. Jul start → FY2026 = Jul 2025 – Jun 2026
  return month >= this.fiscalYearStartMonth ? `FY${year + 1}` : `FY${year}`
}

/** Get the current quarter based on today's date */
CLIENT.getCurrentQuarter = function () {
  const month = new Date().getMonth() + 1
  return this.quarters[month] || 'Q1'
}

/** Build 12-month array for a given fiscal year */
CLIENT.getMonthsForFY = function (fy) {
  const ALL_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const startIdx = this.fiscalYearStartMonth - 1  // 0-based index
  const fyYear = parseInt(fy.replace('FY', ''))

  return Array.from({ length: 12 }, (_, i) => {
    const monthIdx = (startIdx + i) % 12
    const monthNum = monthIdx + 1
    // For Jan-start: all months are in fyYear
    // For Jul-start: first 6 months (Jul-Dec) are in fyYear-1, last 6 (Jan-Jun) in fyYear
    const year = (monthIdx < startIdx) ? fyYear : (startIdx === 0 ? fyYear : fyYear - 1)
    const date = `${year}-${String(monthNum).padStart(2, '0')}-01`
    return { label: `${ALL_MONTHS[monthIdx]} ${year}`, date }
  })
}

/** Format a date using the client's locale and timezone */
CLIENT.formatDateTime = function (dateStr) {
  return new Date(dateStr).toLocaleString(this.locale, {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: this.timezone,
  }) + ' ' + this.timezoneLabel
}

/** Format a date (date only, no time) */
CLIENT.formatDate = function (dateStr) {
  return new Date(dateStr).toLocaleDateString(this.locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

/** Format a date for reports (long form) */
CLIENT.formatDateLong = function (dateStr) {
  return new Date(dateStr).toLocaleDateString(this.locale, {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Stakeholder list as a string for prompts */
CLIENT.stakeholderList = function () {
  return Object.values(this.stakeholders).map(s => `${s.name} ${s.title}`).join(', ')
}

/** Build the AI system context for /api/ask */
CLIENT.buildAISystemPrompt = function (extraContext) {
  const { ae, gm } = this.reps
  const fy = this.getCurrentFY()
  const q = this.getCurrentQuarter()
  return `You are a sales analytics assistant for ${this.name}, ${this.industry} in ${this.location}.
The sales team has ${ae.length} AEs: ${ae.join(', ')}. Their manager is ${this.stakeholders.gm.name} (${this.stakeholders.gm.title}).
Fiscal year runs ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][this.fiscalYearStartMonth - 1]} 1 – ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][(this.fiscalYearStartMonth + 10) % 12]} 30.
Current period is ${q} ${fy}.
Accuracy rules: 90-120% of forecast = Green (accurate), >120% = Yellow (sandbagged), <90% = Red (missed).

${extraContext || ''}`
}

module.exports = CLIENT
