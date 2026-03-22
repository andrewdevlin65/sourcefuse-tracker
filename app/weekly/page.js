'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Header from '../Components/header'
import CLIENT from '../../config/client'

const AE_REPS = CLIENT.reps.weekly
const AE_ACTUALS_REPS = CLIENT.reps.weeklyActuals
const DEAL_TIERS = ['runRate', 'tier25to50', 'tier50to100', 'tier100Plus']

function getSundayOfWeek(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? 0 : 7 - day
  const sunday = new Date(d)
  sunday.setDate(d.getDate() + diff)
  return sunday.toISOString().split('T')[0]
}

function getMondayOfWeek(sundayStr) {
  if (!sundayStr) return ''
  const d = new Date(sundayStr)
  const monday = new Date(d)
  monday.setDate(d.getDate() - 6)
  return monday.toISOString().split('T')[0]
}

function formatDisplay(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(CLIENT.locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

function isFirstSnapshotOfMonth(weekEnding, existingSnapshots) {
  if (!weekEnding) return true
  const d = new Date(weekEnding)
  const month = d.getMonth()
  const year = d.getFullYear()
  const priorThisMonth = existingSnapshots.filter(s => {
    const sd = new Date(s.week_ending)
    return sd.getMonth() === month && sd.getFullYear() === year && s.week_ending < weekEnding
  })
  return priorThisMonth.length === 0
}

const fmt = (n) => {
  if (!n || isNaN(n)) return '—'
  const num = parseFloat(n)
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K'
  return '$' + Math.round(num).toLocaleString()
}

const fmtPct = (n) => n ? parseFloat(n).toFixed(1) + '%' : '—'

export default function WeeklyInputV3() {
  const [selectedDate, setSelectedDate] = useState('')
  const [weekEnding, setWeekEnding] = useState('')
  const [weekStart, setWeekStart] = useState('')
  const [section, setSection] = useState(1)
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [existingSnapshot, setExistingSnapshot] = useState(null)
  const [lastWeekSnapshot, setLastWeekSnapshot] = useState(null)
  const [allSnapshots, setAllSnapshots] = useState([])
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isFirstOfMonth, setIsFirstOfMonth] = useState(true)
  const [dupWarning, setDupWarning] = useState('')

  // S2: Monthly performance
  const [monthlyQuota, setMonthlyQuota] = useState('')
  const [revenueMTD, setRevenueMTD] = useState('')
  const [totalDealsClosed, setTotalDealsClosed] = useState('')
  const [avgDealSize, setAvgDealSize] = useState('')
  const [openPipeline, setOpenPipeline] = useState('')
  const [weightedFunnel, setWeightedFunnel] = useState('')
  const [avgDaysToClose, setAvgDaysToClose] = useState('')
  const [dealsOver100k, setDealsOver100k] = useState('')
  const [overdueCount, setOverdueCount] = useState('')
  const [overdueValue, setOverdueValue] = useState('')

  // S2b: Quarter
  const [quarterName, setQuarterName] = useState(CLIENT.getCurrentQuarter())
  const [quarterQuota, setQuarterQuota] = useState('9100000')
  const [quarterRevenueYTD, setQuarterRevenueYTD] = useState('')

  // S3: Sales orders
  const [soRevenue, setSoRevenue] = useState('')
  const [soDealCount, setSoDealCount] = useState('')
  const [soAvgMargin, setSoAvgMargin] = useState('')
  const [winRateRevenue, setWinRateRevenue] = useState('')
  const [winRateDealCount, setWinRateDealCount] = useState('')

  // S4: Deal bands
  const [bands, setBands] = useState({
    runRate:     { rev: '', deals: '' },
    tier25to50:  { rev: '', deals: '' },
    tier50to100: { rev: '', deals: '' },
    tier100Plus: { rev: '', deals: '' },
  })

  // S5: Large deals
  const [largeDeals, setLargeDeals] = useState([])

  // S6: Forward funnel
  const [funnel, setFunnel] = useState([
    { month: '', quota: '', totalFunnel: '', weightedFunnel: '' },
    { month: '', quota: '', totalFunnel: '', weightedFunnel: '' },
    { month: '', quota: '', totalFunnel: '', weightedFunnel: '' },
  ])

  // S7: Rep activity
  const [activity, setActivity] = useState(
    AE_REPS.map(r => ({ rep: r, calls: '', meetings: '' }))
  )

  // S7b: AE Revenue actuals (MTD)
  const [aeActuals, setAeActuals] = useState(
    AE_ACTUALS_REPS.map(r => ({ rep: r, revenueMTD: '', dealsClosed: '' }))
  )

  // S8: Analysis
  const [analysisNotes, setAnalysisNotes] = useState('')

  // S9: Campaign snapshots
  const [activeCampaigns, setActiveCampaigns] = useState([])
  const [campaignUpdates, setCampaignUpdates] = useState({})

  // Campaign management state
  const [showAddCampaign, setShowAddCampaign] = useState(false)
  const [newCampaignName, setNewCampaignName] = useState('')
  const [newCampaignDesc, setNewCampaignDesc] = useState('')
  const [newCampaignAcuId, setNewCampaignAcuId] = useState('')
  const [addCampaignStatus, setAddCampaignStatus] = useState('')

  const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const sectionCard = "bg-white rounded-lg shadow p-6 space-y-4"

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('weekly_snapshots').select('week_ending, updated_at, created_at').eq('client_id', CLIENT.id).order('week_ending', { ascending: false })
      setAllSnapshots(data || [])
      if (data?.length && (data[0].updated_at || data[0].created_at)) setLastUpdated(data[0].updated_at || data[0].created_at)
    }
    load()
  }, [])

  // Load campaigns on mount independently so they appear even before date is picked
  useEffect(() => {
    const loadCampaigns = async () => {
      const { data, error } = await supabase.from('campaigns').select('*').eq('client_id', CLIENT.id).order('campaign_id', { ascending: true })
      // Note: mount load has no sunday yet — snapshot data loads when date is picked
      if (error) { console.error('Campaigns load error:', error); return }
      if (data?.length) {
        setActiveCampaigns(data)
        const updates = {}
        data.forEach(c => {
          updates[c.id] = {
            activities_count: c.activities_count || 0,
            opportunities_count: c.opportunities_count || 0,
            opportunities_value: c.opportunities_value || 0,
            won_count: c.won_count || 0,
            won_value: c.won_value || 0,
            notes: c.notes || ''
          }
        })
        setCampaignUpdates(updates)
      }
    }
    loadCampaigns()
  }, [])

  useEffect(() => {
    if (!selectedDate) return
    const sunday = getSundayOfWeek(selectedDate)
    const monday = getMondayOfWeek(sunday)
    setWeekEnding(sunday)
    setWeekStart(monday)
    checkExisting(sunday)
    const firstOfMonth = isFirstSnapshotOfMonth(sunday, allSnapshots)
    setIsFirstOfMonth(firstOfMonth)
    loadOpenDeals()
    loadActiveCampaigns(sunday)
    loadQuotaForWeek(sunday)
    loadLastWeekSnapshot(sunday)
  }, [selectedDate, allSnapshots])

  // ─── Calculate Quarter Revenue YTD automatically ───────────────────
  // For each prior month in the quarter, fetch the last snapshot's revenue_mtd.
  // For the current month, use the revenueMTD input value.
  const calcQuarterYTD = useCallback(async () => {
    if (!weekEnding) return
    const quarterMonths = Object.fromEntries(CLIENT.quarterList.map(q => [q.name, q.months]))
    const months = quarterMonths[quarterName]
    if (!months) return

    const weekDate = new Date(weekEnding + 'T12:00:00')
    const weekYear = weekDate.getFullYear()
    const weekMonthNum = String(weekDate.getMonth() + 1).padStart(2, '0')

    let total = 0
    for (const m of months) {
      if (m === weekMonthNum) {
        // Current month — use what's typed in the Revenue MTD field
        total += parseFloat(revenueMTD) || 0
      } else {
        // Prior month in quarter — fetch last snapshot for that month
        const monthStart = `${weekYear}-${m}-01`
        const mInt = parseInt(m)
        const nextMonthStr = mInt === 12
          ? `${weekYear + 1}-01-01`
          : `${weekYear}-${String(mInt + 1).padStart(2, '0')}-01`
        const { data } = await supabase
          .from('weekly_snapshots')
          .select('revenue_mtd')
          .eq('client_id', CLIENT.id)
          .gte('week_ending', monthStart)
          .lt('week_ending', nextMonthStr)
          .order('week_ending', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (data?.revenue_mtd) total += parseFloat(data.revenue_mtd) || 0
      }
    }
    setQuarterRevenueYTD(Math.round(total).toString())
  }, [weekEnding, quarterName, revenueMTD])

  useEffect(() => {
    calcQuarterYTD()
  }, [calcQuarterYTD])
  // ──────────────────────────────────────────────────────────────────────────

  const checkExisting = async (sunday) => {
    const { data } = await supabase.from('weekly_snapshots').select('*').eq('week_ending', sunday).eq('client_id', CLIENT.id).maybeSingle()
    setExistingSnapshot(data || null)
    if (data) {
      setMonthlyQuota(data.monthly_quota || '')
      setRevenueMTD(data.revenue_mtd || '')
      setTotalDealsClosed(data.total_deals_closed || '')
      setAvgDealSize(data.avg_deal_size || '')
      setOpenPipeline(data.open_pipeline || '')
      setWeightedFunnel(data.weighted_funnel || '')
      setAvgDaysToClose(data.avg_days_to_close || '')
      setDealsOver100k(data.deals_over_100k || '')
      setOverdueCount(data.overdue_count || '')
      setOverdueValue(data.overdue_value || '')
      setQuarterName(data.quarter_name || 'Q3')
      setQuarterQuota(data.quarter_quota || '9100000')
      // Note: quarterRevenueYTD is now auto-calculated, not loaded from snapshot
      setSoRevenue(data.sales_orders_revenue || '')
      setSoDealCount(data.sales_orders_deal_count || '')
      setSoAvgMargin(data.avg_margin || '')
      setWinRateRevenue(data.win_rate_revenue || '')
      setWinRateDealCount(data.win_rate_deal_count || '')
      setAnalysisNotes(data.notes || '')
      // Load forward funnel
      setFunnel([
        { month: data.funnel_month_1 || '', quota: data.funnel_quota_1 || '', totalFunnel: data.funnel_total_1 || '', weightedFunnel: data.funnel_weighted_1 || '' },
        { month: data.funnel_month_2 || '', quota: data.funnel_quota_2 || '', totalFunnel: data.funnel_total_2 || '', weightedFunnel: data.funnel_weighted_2 || '' },
        { month: data.funnel_month_3 || '', quota: data.funnel_quota_3 || '', totalFunnel: data.funnel_total_3 || '', weightedFunnel: data.funnel_weighted_3 || '' },
      ])
      setBands({
        runRate:     { rev: data.run_rate_rev || '', deals: data.run_rate_deals || '' },
        tier25to50:  { rev: data.tier25to50_rev || '', deals: data.tier25to50_deals || '' },
        tier50to100: { rev: data.tier50to100_rev || '', deals: data.tier50to100_deals || '' },
        tier100Plus: { rev: data.tier100plus_rev || '', deals: data.tier100plus_deals || '' },
      })
      // Load AE actuals if they exist
      loadAeActuals(sunday)
    }
  }

  const loadAeActuals = async (sunday) => {
    const { data } = await supabase.from('rep_actuals').select('rep_name, actual_revenue, deals_closed, calls, meetings')
      .eq('client_id', CLIENT.id).eq('week_ending', sunday)
    if (data?.length) {
      // Load AE revenue actuals
      setAeActuals(AE_ACTUALS_REPS.map(r => {
        const found = data.find(d => d.rep_name === r)
        return { rep: r, revenueMTD: found?.actual_revenue || '', dealsClosed: found?.deals_closed || '' }
      }))
      // Load calls/meetings for all reps
      setActivity(AE_REPS.map(r => {
        const found = data.find(d => d.rep_name === r)
        return { rep: r, calls: found?.calls || '', meetings: found?.meetings || '' }
      }))
    }
  }

  const loadLastWeekSnapshot = async (sunday) => {
    const { data } = await supabase.from('weekly_snapshots').select('*').eq('client_id', CLIENT.id).lt('week_ending', sunday).order('week_ending', { ascending: false }).limit(1).maybeSingle()
    setLastWeekSnapshot(data || null)
  }

  const loadActiveCampaigns = async (sunday) => {
    const { data, error } = await supabase.from('campaigns').select('*').eq('client_id', CLIENT.id).order('campaign_id', { ascending: true })
    if (error) { console.error('Campaigns load error:', error); return }
    if (data?.length) {
      setActiveCampaigns(data)
      // Try to load existing campaign snapshots for this week
      let snapData = []
      if (sunday) {
        const { data: snaps } = await supabase.from('campaign_snapshots').select('*').eq('client_id', CLIENT.id).eq('week_ending', sunday)
        snapData = snaps || []
      }
      const updates = {}
      data.forEach(c => {
        const snap = snapData.find(s => s.campaign_id === c.id)
        updates[c.id] = {
          activities_count: snap?.activities_count ?? c.activities_count ?? 0,
          opportunities_count: snap?.opportunities_count ?? c.opportunities_count ?? 0,
          opportunities_value: snap?.opportunities_value ?? c.opportunities_value ?? 0,
          won_count: snap?.won_count ?? c.won_count ?? 0,
          won_value: snap?.won_value ?? c.won_value ?? 0,
          notes: snap?.notes ?? c.notes ?? ''
        }
      })
      setCampaignUpdates(updates)
    }
  }

  const loadOpenDeals = async () => {
    const { data } = await supabase.from('large_deals').select('*').eq('client_id', CLIENT.id).eq('status', 'open').order('value', { ascending: false })
    if (data?.length) {
      setLargeDeals(data.map(d => ({ ...d, isNew: false, _changed: false })))
    } else {
      setLargeDeals([])
    }
  }

  const loadQuotaForWeek = async (sunday) => {
    const monthStart = sunday.substring(0, 7) + '-01'
    const { data } = await supabase.from('quotas').select('amount').eq('client_id', CLIENT.id).eq('rep_name', 'Company').eq('month_start', monthStart).maybeSingle()
    if (data?.amount && !monthlyQuota) setMonthlyQuota(data.amount)
  }

  const checkDuplicateOppId = async (oppId) => {
    if (!oppId) return false
    const { data } = await supabase.from('large_deals').select('id, customer, status').eq('client_id', CLIENT.id).eq('opportunity_id', oppId).maybeSingle()
    return data || null
  }

  const updateBand = (tier, field, val) => setBands(prev => ({ ...prev, [tier]: { ...prev[tier], [field]: val } }))
  const updateFunnel = (i, field, val) => { const u = [...funnel]; u[i][field] = val; setFunnel(u) }
  const updateActivity = (i, field, val) => { const u = [...activity]; u[i][field] = val; setActivity(u) }

  // ─── FIX 2: Quota auto-populate — derive year dynamically ─────────────────
  const loadQuotaForFunnelMonth = async (i, monthName) => {
    const monthMap = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' }
    const key = monthName.toLowerCase().trim()
    const monthNum = monthMap[key]
    if (!monthNum || !weekEnding) return
    // Try current year first, then next year — handles Dec/Jan boundaries
    const currentYear = new Date(weekEnding + 'T12:00:00').getFullYear()
    for (const tryYear of [currentYear, currentYear + 1]) {
      const monthStart = `${tryYear}-${monthNum}-01`
      const { data } = await supabase.from('quotas').select('amount').eq('client_id', CLIENT.id).eq('rep_name', 'Company').eq('month_start', monthStart).maybeSingle()
      if (data?.amount) {
        const u = [...funnel]; u[i].quota = data.amount; setFunnel(u)
        return
      }
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const updateDeal = (i, field, val) => {
    const u = [...largeDeals]
    u[i] = { ...u[i], [field]: val, _changed: true }
    setLargeDeals(u)
    if (field === 'opportunity_id') setDupWarning('')
  }

  const handleOppIdBlur = async (dealIndex, oppId) => {
    if (!oppId) return
    const existing = await checkDuplicateOppId(oppId)
    if (existing) {
      setDupWarning(`⚠️ ${oppId} already exists — "${existing.customer}" (${existing.status}). This may be a duplicate!`)
    } else {
      setDupWarning('')
    }
  }

  const updateAeActual = (i, field, val) => { const u = [...aeActuals]; u[i][field] = val; setAeActuals(u) }

  const handleAddCampaign = async () => {
    if (!newCampaignName.trim()) return
    const { data, error } = await supabase.from('campaigns').insert([{
      client_id: CLIENT.id,
      campaign_name: newCampaignName.trim(),
      description: newCampaignDesc.trim() || null,
      status: 'active',
      campaign_id: newCampaignAcuId.trim() || newCampaignName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    }]).select().single()
    if (error) {
      setAddCampaignStatus('❌ Error: ' + error.message)
    } else {
      setActiveCampaigns(prev => [...prev, data].sort((a, b) => a.campaign_id.localeCompare(b.campaign_id)))
      setCampaignUpdates(prev => ({ ...prev, [data.id]: { activities_count: 0, opportunities_count: 0, opportunities_value: 0, won_count: 0, won_value: 0, notes: '' } }))
      setNewCampaignName('')
      setNewCampaignDesc('')
      setNewCampaignAcuId('')
      setAddCampaignStatus('✅ Campaign added!')
      setTimeout(() => { setShowAddCampaign(false); setAddCampaignStatus('') }, 1500)
    }
  }

  const handleToggleCampaignStatus = async (campaign) => {
    const newStatus = campaign.status === 'inactive' ? 'active' : 'inactive'
    const { error } = await supabase.from('campaigns').update({ status: newStatus }).eq('id', campaign.id)
    if (!error) {
      setActiveCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c))
    }
  }

  const coverageRatio = openPipeline && monthlyQuota && revenueMTD
    ? (parseFloat(openPipeline) / (parseFloat(monthlyQuota) - parseFloat(revenueMTD))).toFixed(2)
    : '—'

  const soAvgDealSize = soRevenue && soDealCount && parseFloat(soDealCount) > 0
    ? Math.round(parseFloat(soRevenue) / parseFloat(soDealCount))
    : null

  const totalBandRev = DEAL_TIERS.reduce((s, t) => s + (parseFloat(bands[t].rev) || 0), 0)
  const totalBandDeals = DEAL_TIERS.reduce((s, t) => s + (parseInt(bands[t].deals) || 0), 0)

  const handleSubmit = async () => {
    if (!weekEnding) { setStatus('Please select a date first'); return }
    setSaving(true)
    setStatus('Saving...')
    try {
      const snapshotData = {
        id: weekEnding + '-001',
        week_ending: weekEnding,
        label: 'Week of ' + formatDisplay(weekStart) + ' – ' + formatDisplay(weekEnding),
        current_month: new Date(weekEnding + 'T12:00:00').toLocaleString('default', { month: 'long' }),
        monthly_quota: parseFloat(monthlyQuota) || 0,
        revenue_mtd: parseFloat(revenueMTD) || 0,
        total_deals_closed: parseInt(totalDealsClosed) || 0,
        avg_deal_size: parseFloat(avgDealSize) || 0,
        open_pipeline: parseFloat(openPipeline) || 0,
        weighted_funnel: parseFloat(weightedFunnel) || 0,
        coverage_ratio: parseFloat(coverageRatio) || 0,
        avg_days_to_close: parseFloat(avgDaysToClose) || 0,
        deals_over_100k: parseInt(dealsOver100k) || 0,
        overdue_count: parseInt(overdueCount) || 0,
        overdue_value: parseFloat(overdueValue) || 0,
        quarter_name: quarterName,
        quarter_quota: parseFloat(quarterQuota) || 0,
        quarter_revenue_ytd: parseFloat(quarterRevenueYTD) || 0,
        sales_orders_revenue: parseFloat(soRevenue) || 0,
        sales_orders_deal_count: parseInt(soDealCount) || 0,
        avg_margin: parseFloat(soAvgMargin) || 0,
        win_rate_revenue: parseFloat(winRateRevenue) || 0,
        win_rate_deal_count: parseFloat(winRateDealCount) || 0,
        run_rate_rev: parseFloat(bands.runRate.rev) || 0,
        run_rate_deals: parseInt(bands.runRate.deals) || 0,
        tier25to50_rev: parseFloat(bands.tier25to50.rev) || 0,
        tier25to50_deals: parseInt(bands.tier25to50.deals) || 0,
        tier50to100_rev: parseFloat(bands.tier50to100.rev) || 0,
        tier50to100_deals: parseInt(bands.tier50to100.deals) || 0,
        tier100plus_rev: parseFloat(bands.tier100Plus.rev) || 0,
        tier100plus_deals: parseInt(bands.tier100Plus.deals) || 0,
        total_calls: activity.reduce((s, r) => s + (parseInt(r.calls) || 0), 0),
        total_meetings: activity.reduce((s, r) => s + (parseInt(r.meetings) || 0), 0),
        notes: analysisNotes,
        funnel_month_1: funnel[0].month || '',
        funnel_quota_1: parseFloat(funnel[0].quota) || 0,
        funnel_total_1: parseFloat(funnel[0].totalFunnel) || 0,
        funnel_weighted_1: parseFloat(funnel[0].weightedFunnel) || 0,
        funnel_month_2: funnel[1].month || '',
        funnel_quota_2: parseFloat(funnel[1].quota) || 0,
        funnel_total_2: parseFloat(funnel[1].totalFunnel) || 0,
        funnel_weighted_2: parseFloat(funnel[1].weightedFunnel) || 0,
        funnel_month_3: funnel[2].month || '',
        funnel_quota_3: parseFloat(funnel[2].quota) || 0,
        funnel_total_3: parseFloat(funnel[2].totalFunnel) || 0,
        funnel_weighted_3: parseFloat(funnel[2].weightedFunnel) || 0,
        client_id: CLIENT.id
      }

      const { error: snapErr } = await supabase.from('weekly_snapshots').upsert(snapshotData, { onConflict: 'id' })
      if (snapErr) throw snapErr

      // Save activity (calls/meetings) for all reps
      for (const ra of activity.filter(r => r.calls || r.meetings)) {
        await supabase.from('rep_actuals').upsert({
          week_ending: weekEnding,
          rep_name: ra.rep,
          actual_revenue: 0,
          calls: parseInt(ra.calls) || 0,
          meetings: parseInt(ra.meetings) || 0,
          client_id: CLIENT.id
        }, { onConflict: 'week_ending,rep_name' })
      }
      // Save AE revenue actuals (MTD) for Kyle, Jake, Kris
      for (const ae of aeActuals.filter(a => a.revenueMTD || a.dealsClosed)) {
        await supabase.from('rep_actuals').upsert({
          week_ending: weekEnding,
          rep_name: ae.rep,
          actual_revenue: parseFloat(ae.revenueMTD) || 0,
          deals_closed: parseInt(ae.dealsClosed) || 0,
          client_id: CLIENT.id
        }, { onConflict: 'week_ending,rep_name' })
      }

      for (const deal of largeDeals) {
        if (!deal.customer) continue
        if (deal.isNew) {
          const { error: dealErr } = await supabase.from('large_deals').insert([{
            customer: deal.customer,
            opportunity_id: deal.opportunity_id || null,
            value: parseFloat(deal.value) || 0,
            rep: deal.rep,
            current_close_date: deal.closeDate || null,
            original_close_date: deal.closeDate || null,
            probability: parseFloat(deal.probability) || 0,
            status: deal.status || 'open',
            notes: deal.notes,
            week_added: weekEnding,
            client_id: CLIENT.id
          }])
          if (dealErr) {
            if (dealErr.code === '23505') {
              setStatus(`❌ Duplicate OPP ID: ${deal.opportunity_id} already exists. Remove it or use a different ID.`)
              setSaving(false)
              return
            }
            throw dealErr
          }
        } else if (deal._changed && deal.id) {
          await supabase.from('deal_history').insert([{
            deal_id: deal.id,
            week_ending: weekEnding,
            new_close_date: deal.closeDate || deal.current_close_date,
            new_status: deal.status,
            new_probability: parseFloat(deal.probability) || 0,
            notes: deal.notes
          }])
          await supabase.from('large_deals').update({
            current_close_date: deal.closeDate || deal.current_close_date,
            probability: parseFloat(deal.probability) || 0,
            status: deal.status,
            notes: deal.notes,
            value: parseFloat(deal.value) || 0,
            opportunity_id: deal.opportunity_id || null,
            updated_at: new Date().toISOString()
          }).eq('id', deal.id)
        }
      }

      for (const campaign of activeCampaigns) {
        const update = campaignUpdates[campaign.id]
        if (!update) continue
        await supabase.from('campaign_snapshots').upsert({
          client_id: CLIENT.id,
          campaign_id: campaign.id,
          week_ending: weekEnding,
          activities_count: parseInt(update.activities_count) || 0,
          opportunities_count: parseInt(update.opportunities_count) || 0,
          opportunities_value: parseFloat(update.opportunities_value) || 0,
          won_count: parseInt(update.won_count) || 0,
          won_value: parseFloat(update.won_value) || 0,
          notes: update.notes || ''
        }, { onConflict: 'campaign_id,week_ending' })
        await supabase.from('campaigns').update({
          activities_count: parseInt(update.activities_count) || 0,
          opportunities_count: parseInt(update.opportunities_count) || 0,
          opportunities_value: parseFloat(update.opportunities_value) || 0,
          won_count: parseInt(update.won_count) || 0,
          won_value: parseFloat(update.won_value) || 0,
          notes: update.notes || '',
          updated_at: new Date().toISOString()
        }).eq('id', campaign.id)
      }

      setStatus(existingSnapshot ? '✅ Snapshot updated!' : '✅ Snapshot saved!')
      setExistingSnapshot(snapshotData)
    } catch (err) {
      setStatus('❌ Error: ' + err.message)
    }
    setSaving(false)
  }

  const sections = ['Week', 'Monthly', 'Sales Orders', 'Deal Bands', 'Large Deals', 'Funnel', 'Activity', 'Campaigns', 'Analysis']

  const WoW = ({ label, current, previous, isCurrency = true, isGoodDown = false }) => {
    if (!previous || !current) return null
    const curr = parseFloat(current)
    const prev = parseFloat(previous)
    if (isNaN(curr) || isNaN(prev) || prev === 0) return null
    const diff = curr - prev
    const isPositive = isGoodDown ? diff < 0 : diff > 0
    return (
      <div className={`text-xs mt-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {diff > 0 ? '↑' : '↓'} {isCurrency ? fmt(Math.abs(diff)) : Math.round(Math.abs(diff))} vs last week
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <Header title="Weekly Revenue Input from CRM" subtitle={lastUpdated ? `Fill in after ${CLIENT.crm.name} pull · Data as of ${CLIENT.formatDateTime(lastUpdated)}` : `Fill in after ${CLIENT.crm.name} pull`} />

        <div className="flex gap-1 mb-2">
          {sections.map((s, i) => (
            <button key={i} onClick={() => setSection(i + 1)}
              className={`flex-1 py-1 text-xs rounded transition-colors ${section === i + 1 ? 'bg-blue-600 text-white' : section > i + 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
              {i + 1}
            </button>
          ))}
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-4">{section}. {sections[section - 1]}</p>

        {section === 1 && (
          <div className={sectionCard}>
            <div>
              <label className={labelClass}>Pick any day this week</label>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className={inputClass} />
            </div>
            {weekEnding && (
              <div className={`rounded-lg p-4 ${existingSnapshot ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                <p className={`font-semibold text-sm ${existingSnapshot ? 'text-amber-800' : 'text-green-800'}`}>
                  {existingSnapshot ? '⚠️ Updating existing snapshot' : '✅ New snapshot'}
                </p>
                <p className={`text-sm mt-1 ${existingSnapshot ? 'text-amber-700' : 'text-green-700'}`}>
                  Week: {formatDisplay(weekStart)} – {formatDisplay(weekEnding)}
                </p>
                <p className="text-xs mt-1 text-purple-700 font-medium">🔄 All open large deals auto-loaded — update status or add new ones in Section 5</p>
              </div>
            )}
            <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">Pull these from {CLIENT.crm.name} before continuing:</p>
              <ul className="list-disc ml-4 space-y-0.5 text-xs">
                <li>Revenue closed won (MTD)</li>
                <li>Sales Orders report (revenue, deals, margin)</li>
                <li>Open pipeline by month</li>
                <li>Overdue activities report</li>
                <li>Rep activity log (calls + meetings)</li>
                <li>Large deals over $100K (use OPP ID from {CLIENT.crm.name})</li>
              </ul>
            </div>
          </div>
        )}

        {section === 2 && (
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">Monthly Performance</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Monthly quota ($)</label>
                <input type="number" value={monthlyQuota} onChange={e => setMonthlyQuota(e.target.value)} className={inputClass} placeholder="2730000"/>
                {monthlyQuota && <p className="text-xs text-gray-400 mt-0.5">{fmt(monthlyQuota)}</p>}
              </div>
              <div>
                <label className={labelClass}>Revenue MTD ($)</label>
                <input type="number" value={revenueMTD} onChange={e => setRevenueMTD(e.target.value)} className={inputClass} placeholder="0"/>
                {revenueMTD && monthlyQuota && <p className="text-xs text-gray-400 mt-0.5">{((parseFloat(revenueMTD)/parseFloat(monthlyQuota))*100).toFixed(1)}% of quota</p>}
                <WoW current={revenueMTD} previous={lastWeekSnapshot?.revenue_mtd} label="Revenue MTD" />
              </div>
              <div>
                <label className={labelClass}>Total deals closed (MTD)</label>
                <input type="number" value={totalDealsClosed} onChange={e => setTotalDealsClosed(e.target.value)} className={inputClass} placeholder="0"/>
                <WoW current={totalDealsClosed} previous={lastWeekSnapshot?.total_deals_closed} label="Deals" isCurrency={false} />
              </div>
              <div>
                <label className={labelClass}>Avg deal size ($)</label>
                <input type="number" value={avgDealSize} onChange={e => setAvgDealSize(e.target.value)} className={inputClass} placeholder="0"/>
                {avgDealSize && <p className="text-xs text-gray-400 mt-0.5">{fmt(avgDealSize)}</p>}
                <WoW current={avgDealSize} previous={lastWeekSnapshot?.avg_deal_size} label="Avg Deal Size" />
              </div>
              <div>
                <label className={labelClass}>Deals over $100K (count)</label>
                <input type="number" value={dealsOver100k} onChange={e => setDealsOver100k(e.target.value)} className={inputClass} placeholder="0"/>
              </div>
              <div>
                <label className={labelClass}>Open pipeline ($)</label>
                <input type="number" value={openPipeline} onChange={e => setOpenPipeline(e.target.value)} className={inputClass} placeholder="0"/>
                {coverageRatio !== '—' && <p className="text-xs text-gray-400 mt-0.5">Coverage: {coverageRatio}x</p>}
                <WoW current={openPipeline} previous={lastWeekSnapshot?.open_pipeline} label="Pipeline" />
              </div>
              <div>
                <label className={labelClass}>Weighted funnel ($)</label>
                <input type="number" value={weightedFunnel} onChange={e => setWeightedFunnel(e.target.value)} className={inputClass} placeholder="0"/>
                {weightedFunnel && <p className="text-xs text-gray-400 mt-0.5">{fmt(weightedFunnel)}</p>}
              </div>
              <div>
                <label className={labelClass}>Avg days to close</label>
                <input type="number" value={avgDaysToClose} onChange={e => setAvgDaysToClose(e.target.value)} className={inputClass} placeholder="0" step="0.1"/>
              </div>
              <div>
                <label className={labelClass}>Overdue activities (count)</label>
                <input type="number" value={overdueCount} onChange={e => setOverdueCount(e.target.value)} className={inputClass} placeholder="0"/>
                <WoW current={overdueCount} previous={lastWeekSnapshot?.overdue_count} label="Overdues" isCurrency={false} isGoodDown={true} />
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Overdue value ($)</label>
                <input type="number" value={overdueValue} onChange={e => setOverdueValue(e.target.value)} className={inputClass} placeholder="0"/>
                <WoW current={overdueValue} previous={lastWeekSnapshot?.overdue_value} label="Overdue value" isGoodDown={true} />
              </div>
            </div>

            <h2 className="font-semibold text-gray-800 border-b pb-2 pt-2">Quarter Performance</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Quarter</label>
                <select value={quarterName} onChange={e => setQuarterName(e.target.value)} className={inputClass}>
                  <option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Quarter quota ($)</label>
                <input type="number" value={quarterQuota} onChange={e => setQuarterQuota(e.target.value)} className={inputClass}/>
              </div>
              <div className="col-span-2">
                <label className={labelClass}>Quarter revenue YTD — auto-calculated ✨</label>
                <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-700 text-sm">
                  {quarterRevenueYTD
                    ? <>
                        <span className="font-semibold">{fmt(quarterRevenueYTD)}</span>
                        {quarterQuota && <span className="text-gray-500 ml-2">({((parseFloat(quarterRevenueYTD)/parseFloat(quarterQuota))*100).toFixed(1)}% of {quarterName} target)</span>}
                      </>
                    : <span className="text-gray-400">Calculating… (enter Revenue MTD above)</span>
                  }
                </div>
                <p className="text-xs text-gray-400 mt-0.5">Sum of final revenue MTD for each completed month in {quarterName} + this month's MTD</p>
              </div>
            </div>
          </div>
        )}

        {section === 3 && (
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">Sales Orders (from CRM orders report)</h2>
            <p className="text-xs text-gray-500">Sales Orders can differ from Closed Won — enter from your orders report</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Sales orders revenue ($)</label>
                <input type="number" value={soRevenue} onChange={e => setSoRevenue(e.target.value)} className={inputClass} placeholder="0"/>
                {soRevenue && <p className="text-xs text-gray-400 mt-0.5">{fmt(soRevenue)}</p>}
              </div>
              <div>
                <label className={labelClass}>Sales orders deal count</label>
                <input type="number" value={soDealCount} onChange={e => setSoDealCount(e.target.value)} className={inputClass} placeholder="0"/>
              </div>
              <div>
                <label className={labelClass}>Avg deal size (auto)</label>
                <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-gray-600 text-sm">
                  {soAvgDealSize ? '$' + soAvgDealSize.toLocaleString() : '— enter revenue + deals'}
                </div>
              </div>
              <div>
                <label className={labelClass}>Avg margin %</label>
                <input type="number" value={soAvgMargin} onChange={e => setSoAvgMargin(e.target.value)} className={inputClass} placeholder="36" step="0.1"/>
              </div>
              <div>
                <label className={labelClass}>Win rate — revenue %</label>
                <input type="number" value={winRateRevenue} onChange={e => setWinRateRevenue(e.target.value)} className={inputClass} placeholder="0" step="0.1"/>
              </div>
              <div>
                <label className={labelClass}>Win rate — deal count %</label>
                <input type="number" value={winRateDealCount} onChange={e => setWinRateDealCount(e.target.value)} className={inputClass} placeholder="0" step="0.1"/>
              </div>
            </div>
            {lastWeekSnapshot && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 border border-gray-200">
                <p className="font-medium text-gray-700 mb-1">Last week:</p>
                <p>Sales orders: {fmt(lastWeekSnapshot.sales_orders_revenue)} · {lastWeekSnapshot.sales_orders_deal_count} deals · Margin: {fmtPct(lastWeekSnapshot.avg_margin)}</p>
              </div>
            )}
          </div>
        )}

        {section === 4 && (
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">Deal Bands (Closed Won MTD)</h2>
            <p className="text-xs text-gray-500">Revenue and deal count for each deal size tier</p>
            {[
              { key: 'runRate', label: 'Run Rate — Under $25K', color: 'bg-gray-50 border-gray-200' },
              { key: 'tier25to50', label: '$25K – $50K', color: 'bg-blue-50 border-blue-200' },
              { key: 'tier50to100', label: '$50K – $100K', color: 'bg-amber-50 border-amber-200' },
              { key: 'tier100Plus', label: '$100K+', color: 'bg-green-50 border-green-200' },
            ].map(({ key, label, color }) => (
              <div key={key} className={`border rounded-lg p-4 ${color}`}>
                <p className="text-sm font-semibold text-gray-800 mb-3">{label}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Revenue ($)</label>
                    <input type="number" value={bands[key].rev} onChange={e => updateBand(key, 'rev', e.target.value)} className={inputClass} placeholder="0"/>
                    {bands[key].rev && <p className="text-xs text-gray-400 mt-0.5">{fmt(bands[key].rev)}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Deal count</label>
                    <input type="number" value={bands[key].deals} onChange={e => updateBand(key, 'deals', e.target.value)} className={inputClass} placeholder="0"/>
                    {bands[key].rev && bands[key].deals && parseInt(bands[key].deals) > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">AVD: ${Math.round(parseFloat(bands[key].rev)/parseInt(bands[key].deals)).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {totalBandRev > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-800">Total across all bands: {fmt(totalBandRev)} · {totalBandDeals} deals</p>
                {lastWeekSnapshot && <p className="text-xs text-blue-600 mt-0.5">Last week total: {fmt(lastWeekSnapshot.run_rate_rev + lastWeekSnapshot.tier25to50_rev + lastWeekSnapshot.tier50to100_rev + lastWeekSnapshot.tier100plus_rev)}</p>}
              </div>
            )}
          </div>
        )}

        {section === 5 && (
          <div className={sectionCard}>
            <div className="border-b pb-2">
              <h2 className="font-semibold text-gray-800">Large Deals — Over $100K</h2>
              <p className="text-xs text-gray-500 mt-0.5">🔄 All open deals loaded — update status or add new ones below</p>
            </div>

            {dupWarning && (
              <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800 font-medium">
                {dupWarning}
              </div>
            )}

            {largeDeals.filter(d => !d.isNew).map((deal, i) => (
              <div key={deal.id || i} className={`border rounded-lg p-4 space-y-3 ${deal.status === 'won' ? 'bg-green-50 border-green-300' : deal.status === 'lost' ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm">{deal.customer}</p>
                      {deal.opportunity_id && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono">{deal.opportunity_id}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{fmt(deal.value)} · {deal.rep} · close {deal.current_close_date}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => updateDeal(largeDeals.indexOf(deal), 'status', 'won')} className={`text-xs px-2 py-1 rounded ${deal.status === 'won' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-green-100'}`}>✅ Won</button>
                    <button onClick={() => updateDeal(largeDeals.indexOf(deal), 'status', 'lost')} className={`text-xs px-2 py-1 rounded ${deal.status === 'lost' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'}`}>❌ Lost</button>
                    <button onClick={() => updateDeal(largeDeals.indexOf(deal), 'status', 'pushed')} className={`text-xs px-2 py-1 rounded ${deal.status === 'pushed' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-amber-100'}`}>📅 Pushed</button>
                  </div>
                </div>
                {deal.status !== 'won' && deal.status !== 'lost' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelClass}>New close date</label>
                      <input type="date" value={deal.closeDate || deal.current_close_date || ''} onChange={e => updateDeal(largeDeals.indexOf(deal), 'closeDate', e.target.value)} className={inputClass}/>
                    </div>
                    <div>
                      <label className={labelClass}>Probability %</label>
                      <input type="number" value={deal.probability || ''} onChange={e => updateDeal(largeDeals.indexOf(deal), 'probability', e.target.value)} className={inputClass} placeholder="50"/>
                    </div>
                    <div>
                      <label className={labelClass}>Value ($)</label>
                      <input type="number" value={deal.value || ''} onChange={e => updateDeal(largeDeals.indexOf(deal), 'value', e.target.value)} className={inputClass}/>
                    </div>
                    <div>
                      <label className={labelClass}>Notes</label>
                      <input type="text" value={deal.notes || ''} onChange={e => updateDeal(largeDeals.indexOf(deal), 'notes', e.target.value)} className={inputClass} placeholder="Status update"/>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {largeDeals.filter(d => d.isNew).map((deal, i) => (
              <div key={i} className="border border-dashed border-blue-300 bg-blue-50 rounded-lg p-4 space-y-3">
                <p className="text-xs font-medium text-blue-700">New deal {i + 1}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className={labelClass}>Opportunity ID (from {CLIENT.crm.name})</label>
                    <input type="text"
                      value={deal.opportunity_id || ''}
                      onChange={e => updateDeal(largeDeals.indexOf(deal), 'opportunity_id', e.target.value)}
                      onBlur={e => handleOppIdBlur(largeDeals.indexOf(deal), e.target.value)}
                      className={inputClass}
                      placeholder="e.g. OPP061234"/>
                    <p className="text-xs text-gray-400 mt-0.5">Enter the OPP ID first — this prevents duplicates</p>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Account / Deal Description</label>
                    <input type="text" value={deal.customer} onChange={e => updateDeal(largeDeals.indexOf(deal), 'customer', e.target.value)} className={inputClass} placeholder="Company name — deal description"/>
                  </div>
                  <div>
                    <label className={labelClass}>Value ($)</label>
                    <input type="number" value={deal.value} onChange={e => updateDeal(largeDeals.indexOf(deal), 'value', e.target.value)} className={inputClass} placeholder="0"/>
                  </div>
                  <div>
                    <label className={labelClass}>Close date</label>
                    <input type="date" value={deal.closeDate} onChange={e => updateDeal(largeDeals.indexOf(deal), 'closeDate', e.target.value)} className={inputClass}/>
                  </div>
                  <div>
                    <label className={labelClass}>AE</label>
                    <select value={deal.rep} onChange={e => updateDeal(largeDeals.indexOf(deal), 'rep', e.target.value)} className={inputClass}>
                      {AE_REPS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Probability %</label>
                    <input type="number" value={deal.probability} onChange={e => updateDeal(largeDeals.indexOf(deal), 'probability', e.target.value)} className={inputClass} placeholder="50"/>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Notes</label>
                    <input type="text" value={deal.notes} onChange={e => updateDeal(largeDeals.indexOf(deal), 'notes', e.target.value)} className={inputClass} placeholder="Status, blockers, next steps"/>
                  </div>
                </div>
                {largeDeals.filter(d => d.isNew).length > 1 && (
                  <button onClick={() => setLargeDeals(prev => prev.filter((_, idx) => idx !== largeDeals.indexOf(deal)))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                )}
              </div>
            ))}

            <button onClick={() => setLargeDeals(prev => [...prev, { opportunity_id: '', customer: '', value: '', closeDate: '', rep: CLIENT.reps.defaultDealRep, probability: '', notes: '', status: 'open', isNew: true }])}
              className="w-full py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 text-sm font-medium">
              + Add New Deal
            </button>
          </div>
        )}

        {section === 6 && (
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">Forward Funnel — Next 3 Months</h2>
            <p className="text-xs text-gray-500">Enter month name — quota auto-fills from the quota table</p>
            {funnel.map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Month {i + 1}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Month</label>
                    <input type="text" value={f.month} onChange={e => updateFunnel(i, 'month', e.target.value)} onBlur={e => loadQuotaForFunnelMonth(i, e.target.value)} className={inputClass} placeholder="April"/>
                  </div>
                  <div>
                    <label className={labelClass}>Quota ($) — auto-fills</label>
                    <input type="number" value={f.quota} onChange={e => updateFunnel(i, 'quota', e.target.value)} className={inputClass} placeholder="Auto"/>
                    {f.quota && <p className="text-xs text-gray-400 mt-0.5">{fmt(f.quota)}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Total funnel ($)</label>
                    <input type="number" value={f.totalFunnel} onChange={e => updateFunnel(i, 'totalFunnel', e.target.value)} className={inputClass} placeholder="0"/>
                    {f.totalFunnel && f.quota && <p className="text-xs text-gray-400 mt-0.5">{(parseFloat(f.totalFunnel)/parseFloat(f.quota)).toFixed(2)}x coverage</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Weighted funnel ($)</label>
                    <input type="number" value={f.weightedFunnel} onChange={e => updateFunnel(i, 'weightedFunnel', e.target.value)} className={inputClass} placeholder="0"/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {section === 7 && (
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">AE Revenue Actuals — MTD</h2>
            <p className="text-xs text-gray-500">Pull from {CLIENT.crm.name} closed won report filtered by AE — cumulative month to date</p>
            {aeActuals.map((ae, i) => (
              <div key={ae.rep} className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900 mb-3">{ae.rep}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Revenue MTD ($)</label>
                    <input type="number" value={ae.revenueMTD} onChange={e => updateAeActual(i, 'revenueMTD', e.target.value)} className={inputClass} placeholder="0"/>
                    {ae.revenueMTD && <p className="text-xs text-gray-400 mt-0.5">{fmt(ae.revenueMTD)}</p>}
                  </div>
                  <div>
                    <label className={labelClass}>Deals closed MTD</label>
                    <input type="number" value={ae.dealsClosed} onChange={e => updateAeActual(i, 'dealsClosed', e.target.value)} className={inputClass} placeholder="0"/>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium">AE total MTD: {fmt(aeActuals.reduce((s, a) => s + (parseFloat(a.revenueMTD) || 0), 0))} · {aeActuals.reduce((s, a) => s + (parseInt(a.dealsClosed) || 0), 0)} deals</p>
              <p className="text-xs text-blue-600 mt-0.5">This feeds forecast accuracy tracking for each AE</p>
            </div>

            <h2 className="font-semibold text-gray-800 border-b pb-2 pt-2">Rep Activity This Week</h2>
            <p className="text-xs text-gray-500">Pull from CRM activity report — calls and meetings logged this week</p>
            {activity.map((ra, i) => (
              <div key={ra.rep} className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3">{ra.rep}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Calls</label>
                    <input type="number" value={ra.calls} onChange={e => updateActivity(i, 'calls', e.target.value)} className={inputClass} placeholder="0"/>
                  </div>
                  <div>
                    <label className={labelClass}>Meetings</label>
                    <input type="number" value={ra.meetings} onChange={e => updateActivity(i, 'meetings', e.target.value)} className={inputClass} placeholder="0"/>
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border border-gray-200">
              Total this week: <strong>{activity.reduce((s, r) => s + (parseInt(r.calls) || 0), 0)} calls</strong> · <strong>{activity.reduce((s, r) => s + (parseInt(r.meetings) || 0), 0)} meetings</strong>
              {lastWeekSnapshot && <span className="text-gray-500 ml-2">(last week: {lastWeekSnapshot.total_calls} calls · {lastWeekSnapshot.total_meetings} meetings)</span>}
            </div>
          </div>
        )}

        {section === 8 && (
          <div className={sectionCard}>
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-gray-800">Campaigns</h2>
              <button
                onClick={() => setShowAddCampaign(v => !v)}
                className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 py-1 rounded shadow-sm hover:shadow-md transition-all duration-200">
                + Add Campaign
              </button>
            </div>

            {/* Add new campaign form */}
            {showAddCampaign && (
              <div className="border border-blue-300 bg-blue-50 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-800">New Campaign</p>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className={labelClass}>Campaign name</label>
                    <input type="text" value={newCampaignName} onChange={e => setNewCampaignName(e.target.value)} className={inputClass} placeholder="e.g. Q3 Drill Bits Promo"/>
                  </div>
                  <div>
                    <label className={labelClass}>{CLIENT.crm.name} Campaign ID (optional)</label>
                    <input type="text" value={newCampaignAcuId} onChange={e => setNewCampaignAcuId(e.target.value)} className={inputClass} placeholder="e.g. 000008"/>
                  </div>
                  <div>
                    <label className={labelClass}>Description (optional)</label>
                    <input type="text" value={newCampaignDesc} onChange={e => setNewCampaignDesc(e.target.value)} className={inputClass} placeholder="Brief description..."/>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddCampaign} disabled={!newCampaignName.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded text-sm disabled:opacity-40 shadow-sm hover:shadow-md transition-all duration-200">
                    Save Campaign
                  </button>
                  <button onClick={() => { setShowAddCampaign(false); setNewCampaignName(''); setNewCampaignDesc(''); setNewCampaignAcuId('') }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
                    Cancel
                  </button>
                </div>
                {addCampaignStatus && <p className="text-xs text-green-700 font-medium">{addCampaignStatus}</p>}
              </div>
            )}

            <p className="text-xs text-gray-500">Update each active campaign — or deactivate ones no longer running</p>

            {activeCampaigns.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">No active campaigns found</div>
            )}
            {activeCampaigns.map(campaign => {
              const u = campaignUpdates[campaign.id] || {}
              const updateCampaign = (field, val) => setCampaignUpdates(prev => ({
                ...prev,
                [campaign.id]: { ...prev[campaign.id], [field]: val }
              }))
              const isInactive = campaign.status === 'inactive'
              return (
                <div key={campaign.id} className={`border rounded-lg p-4 space-y-3 ${isInactive ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-gray-200'}`}>
                  {/* Campaign header with name + deactivate toggle */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{campaign.campaign_name}</p>
                        {campaign.campaign_id && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono">{campaign.campaign_id}</span>
                        )}
                      </div>
                      {campaign.description && <p className="text-xs text-gray-500 mt-0.5">{campaign.description}</p>}
                      {isInactive && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded mt-1 inline-block">Inactive — not tracked</span>}
                    </div>
                    <button
                      onClick={() => handleToggleCampaignStatus(campaign)}
                      className={`text-xs px-2 py-1 rounded ml-2 flex-shrink-0 ${isInactive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'}`}>
                      {isInactive ? '▶ Reactivate' : '⏸ Deactivate'}
                    </button>
                  </div>
                  {/* Only show fields if active */}
                  {!isInactive && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Activities (count)</label>
                        <input type="number" value={u.activities_count || ''} onChange={e => updateCampaign('activities_count', e.target.value)} className={inputClass} placeholder="0"/>
                      </div>
                      <div>
                        <label className={labelClass}>Opportunities (count)</label>
                        <input type="number" value={u.opportunities_count || ''} onChange={e => updateCampaign('opportunities_count', e.target.value)} className={inputClass} placeholder="0"/>
                      </div>
                      <div>
                        <label className={labelClass}>Opportunities value ($)</label>
                        <input type="number" value={u.opportunities_value || ''} onChange={e => updateCampaign('opportunities_value', e.target.value)} className={inputClass} placeholder="0"/>
                        {u.opportunities_value && <p className="text-xs text-gray-400 mt-0.5">{fmt(u.opportunities_value)}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Won (count)</label>
                        <input type="number" value={u.won_count || ''} onChange={e => updateCampaign('won_count', e.target.value)} className={inputClass} placeholder="0"/>
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass}>Won value ($)</label>
                        <input type="number" value={u.won_value || ''} onChange={e => updateCampaign('won_value', e.target.value)} className={inputClass} placeholder="0"/>
                        {u.won_value && <p className="text-xs text-gray-400 mt-0.5">{fmt(u.won_value)}</p>}
                      </div>
                      <div className="col-span-2">
                        <label className={labelClass}>Notes</label>
                        <input type="text" value={u.notes || ''} onChange={e => updateCampaign('notes', e.target.value)} className={inputClass} placeholder="Campaign update this week..."/>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {section === 9 && (
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">Your Analysis</h2>
            <p className="text-xs text-gray-500">This feeds the Revenue Report — be specific and direct</p>
            {lastWeekSnapshot && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                <p className="font-semibold text-blue-900 mb-1">📊 Last week at a glance:</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span>Revenue MTD: {fmt(lastWeekSnapshot.revenue_mtd)}</span>
                  <span>Pipeline: {fmt(lastWeekSnapshot.open_pipeline)}</span>
                  <span>Deals: {lastWeekSnapshot.total_deals_closed}</span>
                  <span>Avg Deal Size: {fmt(lastWeekSnapshot.avg_deal_size)}</span>
                  <span>$100K+: {lastWeekSnapshot.deals_over_100k}</span>
                  <span>Overdues: {lastWeekSnapshot.overdue_count} ({fmt(lastWeekSnapshot.overdue_value)})</span>
                  <span>Coverage: {lastWeekSnapshot.coverage_ratio?.toFixed(2)}x</span>
                  <span>Calls: {lastWeekSnapshot.total_calls}</span>
                  <span>Meetings: {lastWeekSnapshot.total_meetings}</span>
                </div>
                {lastWeekSnapshot.notes && <p className="mt-1 text-blue-700 italic">"{lastWeekSnapshot.notes}"</p>}
              </div>
            )}
            <div>
              <label className={labelClass}>What do the numbers tell us?</label>
              <textarea value={analysisNotes} onChange={e => setAnalysisNotes(e.target.value)} rows={4} className={inputClass} placeholder="Key insight this week — what changed, what's the trend, what's the story..."/>
            </div>
            <button onClick={handleSubmit} disabled={saving}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium text-lg disabled:opacity-50 shadow-sm hover:shadow-md transition-all">
              {saving ? 'Saving...' : existingSnapshot ? '💾 Update Snapshot' : '💾 Save Snapshot'}
            </button>
            {status && <p className={`text-center text-sm mt-2 font-medium ${status.includes('✅') ? 'text-green-700' : status.includes('❌') ? 'text-red-700' : 'text-gray-600'}`}>{status}</p>}
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-800">End of month? →{' '}
                <Link href="/month-end" className="font-semibold text-amber-900 underline hover:text-amber-700">Submit Month End Review</Link>
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-between mt-4">
          <button onClick={() => setSection(Math.max(1, section - 1))} disabled={section === 1}
            className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-30">
            ← Back
          </button>
          {section < 9 && (
            <button onClick={() => setSection(Math.min(9, section + 1))}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
              Next →
            </button>
          )}
        </div>

      </div>
    </div>
  )
}