// ─────────────────────────────────────────────────────────
// Client Configuration — GP Oil Tools
// Change these values to rebrand the app for a different client.
// No other files should contain hardcoded client-specific strings.
// ─────────────────────────────────────────────────────────

const CLIENT = {

  // ── Identity ──────────────────────────────────────────
  id: 'gp-oil-tools',                         // Supabase client_id value
  ingestId: 'gpot',                            // client_id used in ingest_log table
  name: 'GP Oil Tools',                        // Short display name
  fullName: 'GENERAL PETROLEUM OIL TOOLS',     // Header banner name (uppercase)
  nameLine1: 'GENERAL PETROLEUM',              // Home page logo line 1
  nameLine2: 'OIL TOOLS',                      // Home page logo line 2
  logoText: 'GP',                              // Circle logo initials
  industry: 'oil & gas equipment distributor',  // Used in AI prompts
  location: 'Queensland, Australia',           // Used in AI prompts

  // ── Branding / Colors ────────────────────────────────
  brand: {
    orange: '#E8612C',
    blue: '#1B3F6E',
    blueDark: '#0f2847',
    headerGradient: 'linear-gradient(135deg, #1B3F6E 0%, #0f2847 100%)',
  },

  // ── Platform Branding ────────────────────────────────
  platform: {
    name: 'Scaletech Sales Tracker',
    tagline: 'Powered by Scaletech · Sales Xceleration',
    company: 'Scaletech',
    partner: 'Sales Xceleration',
    footer: 'Scaletech / Sales Xceleration',
    motto: 'Strategic Growth, Delivered',
  },

  // ── Locale & Currency ────────────────────────────────
  locale: 'en-AU',
  timezone: 'Australia/Sydney',
  timezoneLabel: 'AEST',
  currency: 'AUD',
  currencySymbol: '$',

  // ── CRM / Source System ──────────────────────────────
  crm: {
    name: 'Acumatica',
    opportunityPrefix: 'OPP',
    campaignIdLabel: 'Acumatica Campaign ID',
    bowReportName: 'Invoiced+Supplied+Unsupplied',
  },

  // ── Fiscal Year ──────────────────────────────────────
  // Fiscal year starts in July. FY2026 = Jul 2025 – Jun 2026.
  fiscalYearStartMonth: 7,   // 1=Jan, 7=Jul
  fiscalYears: ['FY2025', 'FY2026', 'FY2027'],

  // Quarter mapping: month number → quarter name
  // GP Oil Tools: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
  quarters: {
    7: 'Q1', 8: 'Q1', 9: 'Q1',
    10: 'Q2', 11: 'Q2', 12: 'Q2',
    1: 'Q3', 2: 'Q3', 3: 'Q3',
    4: 'Q4', 5: 'Q4', 6: 'Q4',
  },

  // Ordered quarter definitions (for dropdowns, iteration)
  quarterList: [
    { name: 'Q1', months: ['07', '08', '09'] },
    { name: 'Q2', months: ['10', '11', '12'] },
    { name: 'Q3', months: ['01', '02', '03'] },
    { name: 'Q4', months: ['04', '05', '06'] },
  ],

  // ── People ───────────────────────────────────────────
  reps: {
    // Account Executives — appear on forecast, accuracy, weekly actuals
    ae: ['Kyle', 'Kris', 'Jake'],

    // All reps shown on weekly form (includes non-AE roles)
    weekly: ['Kyle', 'Greg', 'Jake', 'Kris', 'Will Croft'],

    // Reps for weekly actuals revenue tracking
    weeklyActuals: ['Kyle', 'Jake', 'Kris'],

    // Reps on the month-end form (lowercase keys, display labels)
    monthEnd: [
      { key: 'kyle', label: 'Kyle' },
      { key: 'jake', label: 'Jake' },
      { key: 'kris', label: 'Kris' },
    ],

    // GM / manager reps (for forecast page)
    gm: ['Rob'],

    // All reps for accuracy tracking (AEs + GM)
    accuracy: ['Kyle', 'Kris', 'Jake', 'Rob'],

    // Quota grid reps (setup page) — 'Company' is the aggregate row
    quotaGrid: ['Company', 'Kyle', 'Kris', 'Jake', 'Inside Sales'],

    // Campaign owner options (CEO page dropdown)
    campaignOwners: ['Kyle', 'Kris', 'Jake', 'Rob', 'Sam Cavallaro'],

    // Default campaign owner
    defaultCampaignOwner: 'Kyle',

    // Default AE for new large deals
    defaultDealRep: 'Kyle',
  },

  // ── Stakeholders (for AI report prompts) ─────────────
  stakeholders: {
    gm: { name: 'Rob', title: 'GM Sales' },
    ceo: { name: 'Andy', title: 'CEO' },
    founder: { name: 'Sam', title: 'Founder' },
  },

  // ── AI Defaults (fallbacks when report_settings table is empty) ──
  aiDefaults: {
    reportPersona: 'You are a senior sales management consultant writing for GP Oil Tools executives (Rob GM Sales, Andy CEO, Sam Founder).',
    communicationStyle: 'Direct but positive. Lead with wins before gaps.',
    underperformanceFraming: 'Frame gaps as opportunities. Never assign blame.',
    stakeholderNotes: 'Rob wants specifics, Andy wants the story, Sam wants trajectory.',
    standardCloser: 'End with one specific concrete action.',
    toneDefault: 'encouraging',
  },

  // Full AI system persona for the settings page default
  defaultReportPersona: `You are a senior sales management consultant preparing a weekly revenue report on behalf of Scaletech for GP Oil Tools leadership in Queensland Australia. Write as an experienced advisor who understands the business and its people.`,

  // Report email recipients line
  reportRecipients: 'Rob (GM Sales) · Andy (CEO) · Sam (Founder)',
}

// ── Helpers ──────────────────────────────────────────────

/** Get the current fiscal year label based on today's date */
CLIENT.getCurrentFY = function () {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  return month >= this.fiscalYearStartMonth ? `FY${year + 1}` : `FY${year}`
}

/** Get the current quarter based on today's date */
CLIENT.getCurrentQuarter = function () {
  const month = new Date().getMonth() + 1
  return this.quarters[month] || 'Q1'
}

/** Build 12-month array for a given fiscal year */
CLIENT.getMonthsForFY = function (fy) {
  const MONTH_NAMES = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']
  const endYear = parseInt(fy.replace('FY', ''))
  const startYear = endYear - 1
  return MONTH_NAMES.map((m, i) => {
    const year = i < 6 ? startYear : endYear
    const monthNum = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6][i]
    const date = `${year}-${String(monthNum).padStart(2, '0')}-01`
    return { label: `${m} ${year}`, date }
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
