'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { ScaletechBar } from '../Components/header'
import CLIENT from '../../config/client'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, ComposedChart
} from 'recharts'

const fmt = (n) => {
  if (!n || isNaN(n)) return '$0'
  const num = parseFloat(n)
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K'
  return '$' + Math.round(num).toLocaleString()
}

const fmtPct = (n) => n ? parseFloat(n).toFixed(1) + '%' : '0%'
const fmtRatio = (n) => n ? parseFloat(n).toFixed(2) + 'x' : '0x'

const TABS = ['Dashboard', 'Pipeline', 'Deal Tiers', 'Activity', 'History', '$100K+ Deals', 'Campaigns', 'Email Report', 'Settings']

const StatCard = ({ label, value, sub, trend, trendGood, accent }) => {
  const accentClass = accent || 'border-l-gray-300'
  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${accentClass} p-4 shadow-sm hover:shadow-md transition-shadow duration-200`}>
      <p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
      {trend && <p className={`text-xs font-medium mt-1 ${trendGood ? 'text-green-600' : 'text-red-600'}`}>{trend}</p>}
    </div>
  )
}

export default function RevenueTracker() {
  const [snapshots, setSnapshots] = useState([])
  const [largeDeals, setLargeDeals] = useState([])
  const [forecasts, setForecasts] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [campaignSnapshots, setCampaignSnapshots] = useState([])
  const [campaignForm, setCampaignForm] = useState({ campaign_id: '', campaign_name: '', stage: 'Execution', owner: CLIENT.reps.defaultCampaignOwner, start_date: '', end_date: '', activities_count: '', opportunities_count: '', opportunities_value: '', won_count: '', won_value: '', notes: '' })
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [campaignStatus, setCampaignStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Dashboard')
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [generatedHTML, setGeneratedHTML] = useState('')
  const [reportType, setReportType] = useState('weekly')
  const [copied, setCopied] = useState(false)
  const [reportSettings, setReportSettings] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: snaps }, { data: deals }, { data: fc }, { data: camps }, { data: campSnaps }, { data: rSettings }] = await Promise.all([
      supabase.from('weekly_snapshots').select('*').eq('client_id', CLIENT.id).order('week_ending', { ascending: true }),
      supabase.from('large_deals').select('*').eq('client_id', CLIENT.id).order('value', { ascending: false }),
      supabase.from('forecasts').select('*').eq('client_id', CLIENT.id).order('period_start', { ascending: false }).limit(50),
      supabase.from('campaigns').select('*').eq('client_id', CLIENT.id).order('created_at', { ascending: false }),
      supabase.from('campaign_snapshots').select('*').eq('client_id', CLIENT.id).order('week_ending', { ascending: false }).limit(100),
      supabase.from('report_settings').select('*').eq('client_id', CLIENT.id).maybeSingle()
    ])
    setSnapshots(snaps || [])
    setLargeDeals(deals || [])
    setForecasts(fc || [])
    setCampaigns(camps || [])
    setCampaignSnapshots(campSnaps || [])
    if (rSettings) setReportSettings(rSettings)
    if (snaps?.length) {
      setSelectedWeek(snaps[snaps.length - 1])
      const mostRecent = snaps[snaps.length - 1]
      if (mostRecent?.updated_at) setLastUpdated(mostRecent.updated_at)
      else if (mostRecent?.created_at) setLastUpdated(mostRecent.created_at)
    }
    setLoading(false)
  }

  const generateReport = async () => {
    if (!snapshots.length) return
    setEmailLoading(true)
    setGeneratedHTML('')

    const latest = snapshots[snapshots.length - 1]
    const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
    const quotaPct = latest.monthly_quota > 0 ? (latest.revenue_mtd / latest.monthly_quota * 100).toFixed(1) : 0
    const quarterPct = latest.quarter_quota > 0 ? (latest.quarter_revenue_ytd / latest.quarter_quota * 100).toFixed(1) : 0
    const quotaGap = (latest.monthly_quota || 0) - (latest.revenue_mtd || 0)
    const rptQuarterLabel = latest.quarter_name || CLIENT.getCurrentQuarter()
    const totalBandRev = (latest.run_rate_rev||0) + (latest.tier25to50_rev||0) + (latest.tier50to100_rev||0) + (latest.tier100plus_rev||0)
    const totalBandDeals = (latest.run_rate_deals||0) + (latest.tier25to50_deals||0) + (latest.tier50to100_deals||0) + (latest.tier100plus_deals||0)

    const diff = (curr, prev) => {
      if (!prev) return ''
      const d = parseFloat(curr||0) - parseFloat(prev||0)
      const sign = d >= 0 ? '▲' : '▼'
      const color = d >= 0 ? '#16a34a' : '#dc2626'
      return `<span style="color:${color};font-weight:600">${sign} ${fmt(Math.abs(d))}</span>`
    }
    const diffNum = (curr, prev) => {
      if (!prev) return ''
      const d = parseFloat(curr||0) - parseFloat(prev||0)
      const sign = d >= 0 ? '▲' : '▼'
      const color = d >= 0 ? '#16a34a' : '#dc2626'
      return `<span style="color:${color};font-weight:600">${sign} ${Math.abs(Math.round(d))}</span>`
    }

    const reportTitle = reportType === 'weekly' ? 'Weekly Revenue Report' : reportType === 'month_end' ? 'Month End Review' : 'Quarter End Review'
    const quotaColor = parseFloat(quotaPct) >= 90 ? '#16a34a' : parseFloat(quotaPct) >= 60 ? '#2563eb' : '#d97706'
    const quarterColor = parseFloat(quarterPct) >= 90 ? '#16a34a' : parseFloat(quarterPct) >= 60 ? '#2563eb' : '#d97706'


    // Build campaign WoW section for email report
    const campWeeks = [...new Set((campaignSnapshots||[]).map(s => s.week_ending))].sort().reverse()
    const thisCampWeek = campWeeks[0]
    const lastCampWeek = campWeeks[1]
    const thisCampSnaps = (campaignSnapshots||[]).filter(s => s.week_ending === thisCampWeek)
    const lastCampSnaps = (campaignSnapshots||[]).filter(s => s.week_ending === lastCampWeek)
    const activeCampsForReport = (campaigns||[]).filter(c => c.status !== 'inactive')

    const campaignRowsHtml = activeCampsForReport.map(c => {
      const ts = thisCampSnaps.find(s => s.campaign_id === c.id)
      const ls = lastCampSnaps.find(s => s.campaign_id === c.id)
      const opp = ts?.opportunities_count ?? c.opportunities_count ?? 0
      const val = ts?.opportunities_value ?? c.opportunities_value ?? 0
      const dOpp = ls != null ? opp - (ls.opportunities_count ?? 0) : null
      const dVal = ls != null ? val - (ls.opportunities_value ?? 0) : null
      const dOppStr = dOpp === null ? '&mdash;' : dOpp === 0 ? '<span style="color:#94a3b8">No change</span>' : '<span style="color:' + (dOpp>0?'#16a34a':'#dc2626') + ';font-weight:600">' + (dOpp>0?'&#8593;':'&#8595;') + ' ' + Math.abs(dOpp) + '</span>'
      const dValStr = dVal === null ? '&mdash;' : dVal === 0 ? '<span style="color:#94a3b8">No change</span>' : '<span style="color:' + (dVal>0?'#16a34a':'#dc2626') + ';font-weight:600">' + (dVal>0?'&#8593;':'&#8595;') + ' ' + fmt(Math.abs(dVal)) + '</span>'
      return '<tr><td><strong>' + c.campaign_name + '</strong>' + (c.campaign_id ? '<br><span style="font-size:11px;color:#94a3b8;font-family:monospace">' + c.campaign_id + '</span>' : '') + '</td><td style="text-align:right;font-weight:600">' + opp + '</td><td style="text-align:right">' + dOppStr + '</td><td style="text-align:right;color:#2563eb;font-weight:500">' + fmt(val) + '</td><td style="text-align:right">' + dValStr + '</td></tr>'
    }).join('')

    const campTotal = activeCampsForReport.reduce((s,c) => {
      const ts = thisCampSnaps.find(x => x.campaign_id === c.id)
      return { opp: s.opp + (ts?.opportunities_count ?? c.opportunities_count ?? 0), val: s.val + (ts?.opportunities_value ?? c.opportunities_value ?? 0) }
    }, { opp: 0, val: 0 })

    const campaignSection = activeCampsForReport.length > 0 ? (
      '<div class="section"><div class="section-header"><span>&#128227;</span><h2>Campaign Tracker' + (thisCampWeek ? ' &mdash; ' + thisCampWeek : '') + '</h2></div><div class="section-body">' +
      (thisCampWeek
        ? '<p style="font-size:12px;color:#64748b;margin-bottom:12px">' + (lastCampWeek ? 'Showing changes vs ' + lastCampWeek : 'First week recorded &mdash; no prior week to compare.') + '</p><table><thead><tr><th>Campaign</th><th style="text-align:right">Opps</th><th style="text-align:right">&Delta; Opps</th><th style="text-align:right">Opp Value</th><th style="text-align:right">&Delta; Value</th></tr></thead><tbody>' + campaignRowsHtml + '</tbody><tfoot><tr style="background:#f8fafc;font-weight:700;border-top:2px solid #e2e8f0"><td><strong>TOTAL — ALL CAMPAIGNS</strong></td><td style="text-align:right">' + campTotal.opp + '</td><td></td><td style="text-align:right;color:#2563eb">' + fmt(campTotal.val) + '</td><td></td></tr></tfoot></table><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid #f1f5f9"><div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center"><p style="font-size:22px;font-weight:700;color:#0f172a;margin:0">' + activeCampsForReport.reduce((s,c) => { const ts = thisCampSnaps.find(x => x.campaign_id === c.id); return s + (ts?.activities_count ?? c.activities_count ?? 0) }, 0) + '</p><p style="font-size:11px;color:#64748b;margin:4px 0 0">Total activities across all campaigns</p></div><div style="background:#f8fafc;border-radius:8px;padding:12px;text-align:center"><p style="font-size:22px;font-weight:700;color:#0f172a;margin:0">' + campTotal.opp + '</p><p style="font-size:11px;color:#64748b;margin:4px 0 0">Total opportunities generated</p></div><div style="background:#2563eb;border-radius:8px;padding:12px;text-align:center"><p style="font-size:22px;font-weight:700;color:white;margin:0">' + fmt(campTotal.val) + '</p><p style="font-size:11px;color:#bfdbfe;margin:4px 0 0">Total pipeline from campaigns</p></div></div>'
        : '<p style="font-size:12px;color:#64748b;margin-bottom:12px">No weekly campaign snapshots recorded yet — showing current campaign totals.</p>' +
          '<table><thead><tr><th>Campaign</th><th style="text-align:right">Opportunities</th><th style="text-align:right">Pipeline Value</th><th style="text-align:right">Activities</th></tr></thead><tbody>' +
          activeCampsForReport.map(c => '<tr><td><strong>' + c.campaign_name + '</strong></td><td style="text-align:right">' + (c.opportunities_count||0) + '</td><td style="text-align:right;color:#2563eb;font-weight:500">' + fmt(c.opportunities_value||0) + '</td><td style="text-align:right">' + (c.activities_count||0) + '</td></tr>').join('') +
          '</tbody></table>') +
      '</div></div>'
    ) : ''

    // Build accuracy data for report
    const REPS = CLIENT.reps.accuracy
    const weeklyActuals = {}
    snapshots.forEach((snap, i) => {
      const prev = i > 0 ? snapshots[i-1] : null
      const snapMonth = snap.week_ending.substring(0,7)
      const prevMonth = prev?.week_ending?.substring(0,7)
      let actual = 0
      if (!prev) actual = snap.revenue_mtd || 0
      else if (snapMonth === prevMonth) actual = (snap.revenue_mtd||0) - (prev.revenue_mtd||0)
      else actual = snap.revenue_mtd || 0
      weeklyActuals[snap.week_ending] = Math.max(0, actual)
    })

    const weekForecasts = forecasts.filter(f => f.forecast_type === 'week')
    const accuracyRows = REPS.map(rep => {
      const repF = weekForecasts.filter(f => f.rep_name === rep)
      const withActuals = repF.map(f => {
        const keys = Object.keys(weeklyActuals)
        const closest = keys.find(k => Math.abs(new Date(k) - new Date(f.period_start)) < 7*24*60*60*1000)
        const actual = closest ? weeklyActuals[closest] : null
        const accuracy = actual !== null && f.amount > 0 ? (actual / f.amount) * 100 : null
        return { ...f, actual, accuracy }
      }).filter(f => f.accuracy !== null)

      if (withActuals.length === 0) return null
      const avg = withActuals.reduce((s,f) => s + f.accuracy, 0) / withActuals.length
      const greens = withActuals.filter(f => f.accuracy >= 90 && f.accuracy <= 120).length
      const lates = repF.filter(f => f.is_late).length
      const color = avg >= 90 && avg <= 120 ? '#16a34a' : avg > 120 ? '#d97706' : '#dc2626'
      const bg = avg >= 90 && avg <= 120 ? '#dcfce7' : avg > 120 ? '#fef3c7' : '#fee2e2'
      const label = avg >= 90 && avg <= 120 ? '✅ Accurate' : avg > 120 ? '🟡 Sandbagged' : '🔴 Missed'
      const boxes = withActuals.slice(0,8).map(f => {
        const c = f.accuracy >= 90 && f.accuracy <= 120 ? '#16a34a' : f.accuracy > 120 ? '#d97706' : '#dc2626'
        return `<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${c};margin:1px;" title="${f.period_start}: ${f.accuracy.toFixed(0)}%"></span>`
      }).join('')
      return { rep, avg, greens, total: withActuals.length, lates, color, bg, label, boxes }
    }).filter(Boolean)

    const accuracySection = accuracyRows.length > 0 ? `
  <div class="section">
    <div class="section-header"><span>🎯</span><h2>Forecast Accuracy — Weekly</h2></div>
    <div class="section-body">
      <p style="font-size:12px;color:#64748b;margin-bottom:12px">Green zone: 90–120% of forecast. Ranked by closeness to 100%.</p>
      <table>
        <thead><tr><th>Rep</th><th>Avg Accuracy</th><th>Result</th><th>Green Boxes</th><th>Submissions</th><th>Late</th><th>Recent History</th></tr></thead>
        <tbody>
          ${accuracyRows.sort((a,b) => Math.abs(100-a.avg) - Math.abs(100-b.avg)).map((r, i) => `
          <tr>
            <td><strong>${['🥇','🥈','🥉','4️⃣'][i] || ''} ${r.rep}</strong></td>
            <td><span style="background:${r.bg};color:${r.color};padding:3px 10px;border-radius:999px;font-weight:700;font-size:12px">${r.avg.toFixed(1)}%</span></td>
            <td style="font-size:12px">${r.label}</td>
            <td style="color:#16a34a;font-weight:700">${r.greens} 🟩</td>
            <td>${r.total}</td>
            <td style="color:${r.lates > 0 ? '#dc2626' : '#94a3b8'}">${r.lates > 0 ? `⏰ ${r.lates}` : '—'}</td>
            <td>${r.boxes}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''

    // Build forward funnel WoW from snapshot data
    const funnelWoW = []
    for (let i = 1; i <= 3; i++) {
      const month = latest[`funnel_month_${i}`]
      const total = parseFloat(latest[`funnel_total_${i}`]) || 0
      const weighted = parseFloat(latest[`funnel_weighted_${i}`]) || 0
      const quota = parseFloat(latest[`funnel_quota_${i}`]) || 0
      if (!month) continue
      const prevTotal = previous ? (parseFloat(previous[`funnel_total_${i}`]) || 0) : null
      const coverage = quota > 0 ? (total / quota).toFixed(2) : null
      funnelWoW.push({ month, total, weighted, quota, coverage, totalChange: prevTotal !== null ? total - prevTotal : null })
    }

    // Build AI prompt — truncate funnel detail if prompt gets too long
    const funnelSummary = funnelWoW.length > 0
      ? funnelWoW.map(f => '- ' + f.month + ': Total ' + fmt(f.total) + ' weighted ' + fmt(f.weighted) + (f.quota ? ' coverage ' + f.coverage + 'x vs quota ' + fmt(f.quota) : '') + (f.totalChange !== null ? ' WoW: ' + (f.totalChange >= 0 ? '+' : '') + fmt(f.totalChange) : '')).join('\n')
      : '- No forward funnel data this week'

    const basePrompt = `${reportSettings?.report_persona || CLIENT.aiDefaults.reportPersona}

CONSULTANT VOICE GUIDELINES:
- Communication style: ${reportSettings?.communication_style || CLIENT.aiDefaults.communicationStyle}
- Handling underperformance: ${reportSettings?.underperformance_framing || CLIENT.aiDefaults.underperformanceFraming}
- Stakeholder context: ${reportSettings?.stakeholder_notes || CLIENT.aiDefaults.stakeholderNotes}
- How to close: ${reportSettings?.standard_closer || CLIENT.aiDefaults.standardCloser}
- Tone this week: ${reportSettings?.tone_default || CLIENT.aiDefaults.toneDefault}

Write ONLY the "Key Observations & Recommendations" section of a ${reportTitle} for week ending ${latest.week_ending}.

Data:
- Revenue MTD: ${fmt(latest.revenue_mtd)} (${quotaPct}% of ${fmt(latest.monthly_quota)} quota)
- Quota gap remaining: ${fmt(quotaGap)}
- Quarter YTD: ${fmt(latest.quarter_revenue_ytd)} (${quarterPct}% of ${fmt(latest.quarter_quota)})
- Deals closed MTD: ${latest.total_deals_closed || 0}, avg deal size: ${fmt(latest.avg_deal_size||0)}
- Open pipeline: ${fmt(latest.open_pipeline)}, weighted funnel: ${fmt(latest.weighted_funnel)}, coverage: ${fmtRatio(latest.coverage_ratio)}
- Overdue: ${latest.overdue_count||0} activities (${fmt(latest.overdue_value)})
- $100K+ deals closed: ${latest.deals_over_100k||0}
- Calls: ${latest.total_calls||0}, Meetings: ${latest.total_meetings||0}
- Analysis notes: ${latest.notes || 'none'}
${previous ? `- Last week revenue MTD: ${fmt(previous.revenue_mtd)}` : ''}
${accuracyRows.length > 0 ? `- Forecast accuracy this week: ${accuracyRows.map(r => `${r.rep} ${r.avg.toFixed(0)}%`).join(', ')}` : ''}

FORWARD FUNNEL — NEXT 3 MONTHS:
${funnelSummary}`

    // Only add detailed analysis instructions if prompt isn't too long
    const analysisInstructions = basePrompt.length < 4000
      ? `\n\nUsing the forward funnel data, include analysis of:\n- Is pipeline growing or shrinking month by month WoW? Has revenue shifted between months?\n- Which months have coverage gaps below 2x quota?\n- What does current funnel shape tell us about quarter-end risk and next quarter readiness?`
      : ''

    const fullPrompt = basePrompt + analysisInstructions + `\n\nWrite 3-4 sharp observations and 3 specific recommended focus areas. Professional consultant tone. No markdown symbols. Use plain paragraphs with clear labels like "OBSERVATION 1:" etc. Keep it concise.`

    let narrative = ''
    let aiError = false
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: fullPrompt })
      })
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      narrative = data.answer || ''
      if (!narrative.trim()) throw new Error('Empty response')
    } catch(e) {
      console.error('AI report generation failed:', e)
      aiError = true
      narrative = latest.notes || 'No analysis available.'
    }

    const maxBandRev = Math.max(latest.run_rate_rev||0, latest.tier25to50_rev||0, latest.tier50to100_rev||0, latest.tier100plus_rev||0) || 1

    const aiErrorBanner = aiError ? '<div class="alert alert-amber" style="margin-bottom:16px"><strong>AI analysis unavailable</strong> — showing manual notes from the weekly snapshot.</div>' : ''

    const narrativeHTML = aiErrorBanner + narrative.split('\n').filter(l => l.trim()).map(line => {
      if (line.match(/^(OBSERVATION|RECOMMENDATION|FOCUS|KEY|CONCERN|ACTION)/i)) {
        return `<p style="margin:0 0 8px 0"><strong style="color:#1e293b">${line}</strong></p>`
      }
      return `<p style="margin:0 0 12px 0;color:#374151;line-height:1.6">${line}</p>`
    }).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; font-size: 14px; }
  .container { max-width: 860px; margin: 0 auto; padding: 24px; }
  .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; border-radius: 12px; padding: 28px 32px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .header p { color: #94a3b8; font-size: 13px; }
  .header-meta { display: flex; gap: 24px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); }
  .header-meta span { color: #cbd5e1; font-size: 12px; }
  .header-meta strong { color: white; }
  .section { background: white; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; overflow: hidden; }
  .section-header { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 8px; }
  .section-header h2 { font-size: 14px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.05em; }
  .section-body { padding: 20px; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
  .stat-card { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
  .stat-card .label { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
  .stat-card .value { font-size: 22px; font-weight: 700; color: #0f172a; }
  .stat-card .sub { font-size: 11px; color: #94a3b8; margin-top: 3px; }
  .progress-bar { background: #f1f5f9; border-radius: 999px; height: 10px; overflow: hidden; margin: 8px 0; }
  .progress-fill { height: 100%; border-radius: 999px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #f8fafc; color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; padding: 10px 14px; text-align: left; border-bottom: 2px solid #e2e8f0; }
  td { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #374151; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #16a34a; }
  .badge-blue { background: #dbeafe; color: #2563eb; }
  .badge-amber { background: #fef3c7; color: #d97706; }
  .alert { border-radius: 8px; padding: 12px 16px; margin: 12px 0; font-size: 13px; }
  .alert-amber { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
  .alert-green { background: #f0fdf4; border: 1px solid #bbf7d0; color: #14532d; }
  .alert-red { background: #fef2f2; border: 1px solid #fecaca; color: #7f1d1d; }
  .band-row td:first-child { font-weight: 600; }
  .band-total td { background: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 24px; padding: 16px; }
</style>
</head>
<body><div class="container">

  <div class="header">
    <h1>📊 ${reportTitle}</h1>
    <p>Week Ending ${latest.week_ending} &nbsp;·&nbsp; ${latest.current_month || ''} &nbsp;·&nbsp; ${rptQuarterLabel} ${CLIENT.getCurrentFY()} &nbsp;·&nbsp; ${CLIENT.name}</p>
    <div class="header-meta">
      <span>To: <strong>${CLIENT.reportRecipients}</strong></span>
      <span>Prepared by: <strong>${CLIENT.platform.name}</strong></span>
      <span>Snapshots: <strong>${snapshots.length} weeks</strong></span>
    </div>
  </div>

  <div class="stat-grid-charts" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px">
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px;text-align:center">
      <p style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:0 0 8px">Revenue vs quota</p>
      <svg viewBox="0 0 200 120" style="width:100%;max-width:180px;display:block;margin:0 auto">
        <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#f1f5f9" stroke-width="16" stroke-linecap="round"/>
        <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="${quotaColor}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${(Math.min(parseFloat(quotaPct),100)/100*251).toFixed(0)} 251"/>
        <text x="100" y="85" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="700" fill="#0f172a">${quotaPct}%</text>
        <text x="100" y="105" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#64748b">of quota</text>
      </svg>
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:8px 0 2px">${fmt(latest.revenue_mtd)}</p>
      <p style="font-size:11px;color:#475569;margin:0">Revenue MTD · quota ${fmt(latest.monthly_quota)}</p>
    </div>
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px">
      <p style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px">${rptQuarterLabel} YTD progress</p>
      <p style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 2px">${fmt(latest.quarter_revenue_ytd)}</p>
      <p style="font-size:11px;color:#475569;margin:0 0 12px">${quarterPct}% of ${fmt(latest.quarter_quota)}</p>
      <div style="background:#f1f5f9;border-radius:999px;height:18px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;border-radius:999px;background:${quarterColor};width:${Math.min(parseFloat(quarterPct),100)}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:14px"><span>0%</span><span>${quarterPct}% achieved</span><span>100%</span></div>
      <div style="background:#f8fafc;border-radius:8px;padding:10px;text-align:center">
        <p style="font-size:13px;font-weight:700;color:#0f172a;margin:0">${fmt((latest.quarter_quota||0)-(latest.quarter_revenue_ytd||0))}</p>
        <p style="font-size:10px;color:#64748b;margin:2px 0 0">remaining to target</p>
      </div>
    </div>
    <div style="background:white;border-radius:12px;border:1px solid #e2e8f0;padding:20px">
      <p style="font-size:11px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:0 0 6px">Pipeline coverage</p>
      <p style="font-size:22px;font-weight:700;color:${parseFloat(latest.coverage_ratio||0)>=2?'#16a34a':parseFloat(latest.coverage_ratio||0)>=1.5?'#2563eb':'#d97706'};margin:0 0 2px">${fmtRatio(latest.coverage_ratio)}</p>
      <p style="font-size:11px;color:#475569;margin:0 0 12px">${fmt(latest.open_pipeline)} open pipeline</p>
      <div style="background:#f1f5f9;border-radius:999px;height:12px;margin-bottom:20px;position:relative">
        <div style="height:100%;border-radius:999px;background:${parseFloat(latest.coverage_ratio||0)>=2?'#16a34a':parseFloat(latest.coverage_ratio||0)>=1.5?'#2563eb':'#d97706'};width:${Math.min(((parseFloat(latest.coverage_ratio||0))/3)*100,100).toFixed(0)}%"></div>
        <span style="position:absolute;left:50%;top:14px;transform:translateX(-50%);font-size:9px;color:#94a3b8;white-space:nowrap">1.5x&nbsp;&nbsp;&nbsp;2x target</span>
      </div>
      <p style="font-size:11px;color:#475569;margin:8px 0 0">${latest.overdue_count||0} overdue · ${fmt(latest.overdue_value)}</p>
      <p style="font-size:11px;color:#475569;margin:4px 0 0">Weighted: ${fmt(latest.weighted_funnel)}</p>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card" style="border-top: 3px solid ${quotaColor}">
      <div class="label">Revenue MTD</div>
      <div class="value">${fmt(latest.revenue_mtd)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(parseFloat(quotaPct),100)}%;background:${quotaColor}"></div></div>
      <div class="sub">${quotaPct}% of ${fmt(latest.monthly_quota)} quota</div>
    </div>
    <div class="stat-card" style="border-top: 3px solid #2563eb">
      <div class="label">Open Pipeline</div>
      <div class="value">${fmt(latest.open_pipeline)}</div>
      <div class="sub">${fmtRatio(latest.coverage_ratio)} coverage ratio</div>
    </div>
    <div class="stat-card" style="border-top: 3px solid ${quarterColor}">
      <div class="label">${rptQuarterLabel} YTD</div>
      <div class="value">${fmt(latest.quarter_revenue_ytd)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(parseFloat(quarterPct),100)}%;background:${quarterColor}"></div></div>
      <div class="sub">${quarterPct}% of ${fmt(latest.quarter_quota)}</div>
    </div>
    <div class="stat-card" style="border-top: 3px solid #8b5cf6">
      <div class="label">Weighted Funnel</div>
      <div class="value">${fmt(latest.weighted_funnel)}</div>
      <div class="sub">Probability-adjusted</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header"><span>💰</span><h2>Revenue Snapshot</h2></div>
    <div class="section-body">
      ${parseFloat(quotaPct) < 60 ? `<div class="alert alert-red">⚠️ <strong>Quota Gap Alert:</strong> ${fmt(quotaGap)} still required to reach ${fmt(latest.monthly_quota)} monthly quota.</div>` : parseFloat(quotaPct) >= 90 ? `<div class="alert alert-green">✅ <strong>On Track:</strong> ${quotaPct}% of quota achieved.</div>` : `<div class="alert alert-amber">⚠️ <strong>Behind Pace:</strong> ${fmt(quotaGap)} remaining to quota.</div>`}
      <table>
        <thead><tr><th>Metric</th><th>This Week</th><th>Last Week</th><th>Change</th></tr></thead>
        <tbody>
          <tr><td><strong>Revenue MTD</strong></td><td><strong>${fmt(latest.revenue_mtd)}</strong></td><td>${previous ? fmt(previous.revenue_mtd) : '—'}</td><td>${previous ? diff(latest.revenue_mtd, previous.revenue_mtd) : '—'}</td></tr>
          <tr><td>% of Monthly Quota</td><td><span class="badge ${parseFloat(quotaPct)>=90?'badge-green':parseFloat(quotaPct)>=60?'badge-blue':'badge-amber'}">${quotaPct}%</span></td><td>${previous && previous.monthly_quota > 0 ? ((previous.revenue_mtd/previous.monthly_quota)*100).toFixed(1)+'%' : '—'}</td><td>—</td></tr>
          <tr><td>Quarter YTD</td><td>${fmt(latest.quarter_revenue_ytd)}</td><td>${previous ? fmt(previous.quarter_revenue_ytd) : '—'}</td><td>${previous ? diff(latest.quarter_revenue_ytd, previous.quarter_revenue_ytd) : '—'}</td></tr>
          <tr><td>Deals Closed MTD</td><td>${latest.total_deals_closed||0}</td><td>${previous ? previous.total_deals_closed||0 : '—'}</td><td>${previous ? diffNum(latest.total_deals_closed, previous.total_deals_closed) : '—'}</td></tr>
          <tr><td>Avg Deal Size</td><td>${fmt(latest.avg_deal_size||0)}</td><td>${previous ? fmt(previous.avg_deal_size||0) : '—'}</td><td>${previous ? diff(latest.avg_deal_size||0, previous.avg_deal_size||0) : '—'}</td></tr>
          <tr><td>Deals Over $100K</td><td>${latest.deals_over_100k||0}</td><td>${previous ? previous.deals_over_100k||0 : '—'}</td><td>${previous ? diffNum(latest.deals_over_100k||0, previous.deals_over_100k||0) : '—'}</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-header"><span>📊</span><h2>Deal Band Breakdown — Closed Won MTD</h2></div>
    <div class="section-body">
      <table>
        <thead><tr><th>Tier</th><th>Revenue</th><th>Deals</th><th>Avg Size</th><th>% of Total</th></tr></thead>
        <tbody class="band-rows">
          <tr class="band-row"><td>Run Rate (&lt;$25K)</td><td>${fmt(latest.run_rate_rev||0)}</td><td>${latest.run_rate_deals||0}</td><td>${(latest.run_rate_deals||0)>0?fmt(Math.round((latest.run_rate_rev||0)/(latest.run_rate_deals||1))):'—'}</td><td>${totalBandRev>0?((latest.run_rate_rev||0)/totalBandRev*100).toFixed(0)+'%':'—'}</td></tr>
          <tr class="band-row"><td style="color:#2563eb">Mid ($25K–$50K)</td><td>${fmt(latest.tier25to50_rev||0)}</td><td>${latest.tier25to50_deals||0}</td><td>${(latest.tier25to50_deals||0)>0?fmt(Math.round((latest.tier25to50_rev||0)/(latest.tier25to50_deals||1))):'—'}</td><td>${totalBandRev>0?((latest.tier25to50_rev||0)/totalBandRev*100).toFixed(0)+'%':'—'}</td></tr>
          <tr class="band-row"><td style="color:#d97706">Mid-Large ($50K–$100K)</td><td>${fmt(latest.tier50to100_rev||0)}</td><td>${latest.tier50to100_deals||0}</td><td>${(latest.tier50to100_deals||0)>0?fmt(Math.round((latest.tier50to100_rev||0)/(latest.tier50to100_deals||1))):'—'}</td><td>${totalBandRev>0?((latest.tier50to100_rev||0)/totalBandRev*100).toFixed(0)+'%':'—'}</td></tr>
          <tr class="band-row"><td style="color:#16a34a">Large ($100K+)</td><td>${fmt(latest.tier100plus_rev||0)}</td><td>${latest.tier100plus_deals||0}</td><td>${(latest.tier100plus_deals||0)>0?fmt(Math.round((latest.tier100plus_rev||0)/(latest.tier100plus_deals||1))):'—'}</td><td>${totalBandRev>0?((latest.tier100plus_rev||0)/totalBandRev*100).toFixed(0)+'%':'—'}</td></tr>
        </tbody>
        <tfoot><tr class="band-total"><td><strong>TOTAL</strong></td><td><strong>${fmt(totalBandRev)}</strong></td><td><strong>${totalBandDeals}</strong></td><td><strong>${totalBandDeals>0?fmt(Math.round(totalBandRev/totalBandDeals)):'—'}</strong></td><td><strong>100%</strong></td></tr></tfoot>
      </table>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9"><p style="font-size:12px;font-weight:600;color:#475569;margin:0 0 12px">Revenue mix</p><div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:11px;color:#475569;width:110px;flex-shrink:0">Run Rate &lt;$25K</span><div style="flex:1;background:#f1f5f9;border-radius:4px;height:18px;overflow:hidden"><div style="height:100%;background:#94a3b8;width:${((latest.run_rate_rev||0)/maxBandRev*100).toFixed(0)}%;border-radius:4px"></div></div><span style="font-size:11px;font-weight:600;color:#0f172a;width:65px;text-align:right">${fmt(latest.run_rate_rev||0)}</span></div><div style="display:flex;align-items:center;gap:10px"><span style="font-size:11px;color:#475569;width:110px;flex-shrink:0">$25K-$50K</span><div style="flex:1;background:#f1f5f9;border-radius:4px;height:18px;overflow:hidden"><div style="height:100%;background:#60a5fa;width:${((latest.tier25to50_rev||0)/maxBandRev*100).toFixed(0)}%;border-radius:4px"></div></div><span style="font-size:11px;font-weight:600;color:#0f172a;width:65px;text-align:right">${fmt(latest.tier25to50_rev||0)}</span></div><div style="display:flex;align-items:center;gap:10px"><span style="font-size:11px;color:#475569;width:110px;flex-shrink:0">$50K-$100K</span><div style="flex:1;background:#f1f5f9;border-radius:4px;height:18px;overflow:hidden"><div style="height:100%;background:#fbbf24;width:${((latest.tier50to100_rev||0)/maxBandRev*100).toFixed(0)}%;border-radius:4px"></div></div><span style="font-size:11px;font-weight:600;color:#0f172a;width:65px;text-align:right">${fmt(latest.tier50to100_rev||0)}</span></div><div style="display:flex;align-items:center;gap:10px"><span style="font-size:11px;color:#475569;width:110px;flex-shrink:0">$100K+</span><div style="flex:1;background:#f1f5f9;border-radius:4px;height:18px;overflow:hidden"><div style="height:100%;background:#22c55e;width:${((latest.tier100plus_rev||0)/maxBandRev*100).toFixed(0)}%;border-radius:4px"></div></div><span style="font-size:11px;font-weight:600;color:#0f172a;width:65px;text-align:right">${fmt(latest.tier100plus_rev||0)}</span></div></div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header"><span>🔭</span><h2>Pipeline & Funnel</h2></div>
    <div class="section-body">
      <table>
        <thead><tr><th>Metric</th><th>This Week</th><th>Last Week</th><th>Change</th></tr></thead>
        <tbody>
          <tr><td><strong>Open Pipeline</strong></td><td><strong>${fmt(latest.open_pipeline)}</strong></td><td>${previous?fmt(previous.open_pipeline):'—'}</td><td>${previous?diff(latest.open_pipeline,previous.open_pipeline):'—'}</td></tr>
          <tr><td>Weighted Funnel</td><td>${fmt(latest.weighted_funnel)}</td><td>${previous?fmt(previous.weighted_funnel):'—'}</td><td>${previous?diff(latest.weighted_funnel,previous.weighted_funnel):'—'}</td></tr>
          <tr><td>Coverage Ratio</td><td><span class="badge ${parseFloat(latest.coverage_ratio||0)>=2?'badge-green':parseFloat(latest.coverage_ratio||0)>=1.5?'badge-blue':'badge-amber'}">${fmtRatio(latest.coverage_ratio)}</span></td><td>${previous?fmtRatio(previous.coverage_ratio):'—'}</td><td>—</td></tr>
          <tr><td>Overdue Activities</td><td>${latest.overdue_count||0} (${fmt(latest.overdue_value)})</td><td>${previous?`${previous.overdue_count||0} (${fmt(previous.overdue_value)})`:'—'}</td><td>${previous?diff(latest.overdue_value,previous.overdue_value):'—'}</td></tr>
          <tr><td>Sales Orders Revenue</td><td>${fmt(latest.sales_orders_revenue||0)}</td><td>${previous?fmt(previous.sales_orders_revenue||0):'—'}</td><td>${previous?diff(latest.sales_orders_revenue||0,previous.sales_orders_revenue||0):'—'}</td></tr>
          <tr><td>Avg Margin</td><td>${fmtPct(latest.avg_margin)}</td><td>${previous?fmtPct(previous.avg_margin):'—'}</td><td>—</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-header"><span>📞</span><h2>Activity Metrics</h2></div>
    <div class="section-body">
      <table>
        <thead><tr><th>Metric</th><th>This Week</th><th>Last Week</th><th>Change</th></tr></thead>
        <tbody>
          <tr><td>Total Calls</td><td>${latest.total_calls||0}</td><td>${previous?previous.total_calls||0:'—'}</td><td>${previous?diffNum(latest.total_calls||0,previous.total_calls||0):'—'}</td></tr>
          <tr><td>Total Meetings</td><td>${latest.total_meetings||0}</td><td>${previous?previous.total_meetings||0:'—'}</td><td>${previous?diffNum(latest.total_meetings||0,previous.total_meetings||0):'—'}</td></tr>
          <tr><td>Avg Days to Close</td><td>${(latest.avg_days_to_close||0).toFixed(1)} days</td><td>${previous?(previous.avg_days_to_close||0).toFixed(1)+' days':'—'}</td><td>—</td></tr>
          <tr><td>Win Rate (Revenue)</td><td>${fmtPct(latest.win_rate_revenue)}</td><td>${previous?fmtPct(previous.win_rate_revenue):'—'}</td><td>—</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  ${campaignSection}

  

  ${accuracySection}

  <div class="section">
    <div class="section-header"><span>🔍</span><h2>Key Observations & Recommended Focus</h2></div>
    <div class="section-body">
      ${narrativeHTML || `<p style="color:#374151;line-height:1.6">${latest.notes || 'No analysis notes for this week.'}</p>`}
    </div>
  </div>

  <div class="footer">Generated by ${CLIENT.platform.name} · ${CLIENT.name} &nbsp;·&nbsp; ${CLIENT.formatDateLong(new Date().toISOString())} &nbsp;·&nbsp; Confidential</div>
</div></body></html>`

    setGeneratedHTML(html)
    setEmailLoading(false)
  }

  const openInNewTab = () => {
    const blob = new Blob([generatedHTML], { type: 'text/html' })
    window.open(URL.createObjectURL(blob), '_blank')
  }

  const copyHTML = () => {
    navigator.clipboard.writeText(generatedHTML)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <><ScaletechBar /><div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-gray-600 text-lg">Loading revenue data...</div></div></>
  if (!snapshots.length) return <><ScaletechBar /><div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="text-center"><p className="text-gray-500 mb-4">No snapshots yet</p><Link href="/weekly" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">Add Weekly Snapshot</Link></div></div></>

  const latest = snapshots[snapshots.length - 1]
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const quotaAchievement = latest.monthly_quota > 0 ? (latest.revenue_mtd / latest.monthly_quota * 100).toFixed(1) : null
  const quarterAchievement = latest.quarter_quota > 0 ? (latest.quarter_revenue_ytd / latest.quarter_quota * 100).toFixed(1) : null
  const quarterLabel = latest.quarter_name || CLIENT.getCurrentQuarter()

  const chartData = snapshots.map(s => ({
    label: s.label?.replace('Week ', 'Wk ')?.replace(' FINAL', ' Final') || s.week_ending,
    revenueMTD: s.revenue_mtd || 0,
    pipeline: s.open_pipeline || 0,
    weighted: s.weighted_funnel || 0,
    quota: s.monthly_quota || 0,
    coverage: s.coverage_ratio || 0,
    calls: s.total_calls || 0,
    meetings: s.total_meetings || 0,
    overdue: s.overdue_value || 0,
    quarterYTD: s.quarter_revenue_ytd || 0,
    runRate: s.run_rate_rev || 0,
    tier25: s.tier25to50_rev || 0,
    tier50: s.tier50to100_rev || 0,
    tier100: s.tier100plus_rev || 0,
    soRevenue: s.sales_orders_revenue || 0,
    avgMargin: s.avg_margin || 0,
  }))

  const recentData = chartData.slice(-8)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.name.includes('Coverage') ? fmtRatio(p.value) : fmt(p.value)}</p>)}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <ScaletechBar />
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Revenue Tracker</h1>
              <p className="text-slate-300 text-sm mt-0.5">{CLIENT.name} · {snapshots.length} weekly snapshots</p>
              {lastUpdated && <p className="text-slate-400 text-xs mt-0.5">Data as of {CLIENT.formatDateTime(lastUpdated)}</p>}
            </div>
            <div className="flex gap-3">
              <Link href="/weekly" className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200">+ Weekly Snapshot</Link>
              <Link href="/ask" className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200">🤖 Ask AI</Link>
              <Link href="/" className="text-slate-300 hover:text-white text-sm px-3 py-2">← Home</Link>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-white text-slate-800' : 'text-slate-300 hover:text-white hover:bg-slate-600'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">

        {activeTab === 'Dashboard' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Latest snapshot</p><p className="font-semibold text-gray-900">{latest.label} · {latest.current_month}</p></div>
                <div className="text-right"><p className="text-xs text-gray-600">Week ending</p><p className="font-medium text-gray-700">{latest.week_ending}</p></div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Revenue MTD" value={fmt(latest.revenue_mtd)} sub={quotaAchievement != null ? `${quotaAchievement}% of ${fmt(latest.monthly_quota)} quota` : 'No quota set'} trend={previous ? `${fmt(latest.revenue_mtd - previous.revenue_mtd)} vs last week` : null} trendGood={(latest.revenue_mtd||0) >= (previous?.revenue_mtd||0)} accent="border-l-green-500" />
              <StatCard label="Open Pipeline" value={fmt(latest.open_pipeline)} sub={`${fmtRatio(latest.coverage_ratio)} coverage`} trend={previous ? `${fmt(Math.abs(latest.open_pipeline - previous.open_pipeline))} ${latest.open_pipeline >= previous.open_pipeline ? '↑' : '↓'}` : null} trendGood={(latest.open_pipeline||0) >= (previous?.open_pipeline||0)} accent="border-l-blue-500" />
              <StatCard label={`${quarterLabel} Progress`} value={fmt(latest.quarter_revenue_ytd)} sub={quarterAchievement != null ? `${quarterAchievement}% of ${fmt(latest.quarter_quota)}` : 'No quota set'} accent="border-l-amber-500" />
              <StatCard label="Weighted Funnel" value={fmt(latest.weighted_funnel)} sub="Probability-adjusted" accent="border-l-purple-500" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Deals Closed MTD" value={latest.total_deals_closed||0} sub={`${fmt(latest.avg_deal_size||0)} avg deal`} accent="border-l-green-500" />
              <StatCard label="Deals >$100K" value={latest.deals_over_100k||0} sub="Large deal count" accent="border-l-amber-500" />
              <StatCard label="Overdue Count" value={latest.overdue_count||0} sub={fmt(latest.overdue_value)} accent="border-l-amber-500" />
              <StatCard label="Avg Days to Close" value={(latest.avg_days_to_close||0).toFixed(1)} sub="days" accent="border-l-purple-500" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Revenue MTD vs Monthly Quota — Last 8 Weeks</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={recentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="revenueMTD" name="Revenue MTD" fill="#3b82f6" opacity={0.8} radius={[3,3,0,0]} />
                  <Line dataKey="quota" name="Monthly Quota" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">{quarterLabel} {CLIENT.getCurrentFY()} Progress</h3>
                <span className="text-sm text-gray-500">{fmt(latest.quarter_revenue_ytd)} of {latest.quarter_quota > 0 ? fmt(latest.quarter_quota) : 'no quota set'}</span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${parseFloat(quarterAchievement||0) >= 90 ? 'bg-green-500' : parseFloat(quarterAchievement||0) >= 60 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(parseFloat(quarterAchievement||0), 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{quarterAchievement != null ? `${quarterAchievement}% achieved` : 'No quota set'}</span>
                <span>{latest.quarter_quota > 0 ? `${fmt((latest.quarter_quota||0) - (latest.quarter_revenue_ytd||0))} remaining` : ''}</span>
              </div>
            </div>
            {latest.notes && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Latest Analysis</p><p className="text-amber-900 text-sm leading-relaxed">{latest.notes}</p></div>}
          </div>
        )}

        {activeTab === 'Pipeline' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Open Pipeline" value={fmt(latest.open_pipeline)} sub={fmtRatio(latest.coverage_ratio) + ' coverage'} accent="border-l-blue-500" />
              <StatCard label="Weighted Funnel" value={fmt(latest.weighted_funnel)} sub="Probability adjusted" accent="border-l-purple-500" />
              <StatCard label="Overdue Value" value={fmt(latest.overdue_value)} sub={`${latest.overdue_count||0} overdue activities`} accent="border-l-amber-500" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Pipeline Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line dataKey="pipeline" name="Open Pipeline" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                  <Line dataKey="weighted" name="Weighted Funnel" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Coverage Ratio Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => v.toFixed(1) + 'x'} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => fmtRatio(v)} />
                  <ReferenceLine y={1.5} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '1.5x min', fontSize: 10 }} />
                  <ReferenceLine y={2.0} stroke="#22c55e" strokeDasharray="4 4" label={{ value: '2.0x target', fontSize: 10 }} />
                  <Line dataKey="coverage" name="Coverage" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Overdue Value Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v/1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area dataKey="overdue" name="Overdue Value" stroke="#ef4444" fill="#fecaca" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'Deal Tiers' && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Run Rate <$25K', rev: latest.run_rate_rev, deals: latest.run_rate_deals, color: 'border-gray-400', bg: 'bg-gray-50' },
                { label: '$25K–$50K', rev: latest.tier25to50_rev, deals: latest.tier25to50_deals, color: 'border-blue-400', bg: 'bg-blue-50' },
                { label: '$50K–$100K', rev: latest.tier50to100_rev, deals: latest.tier50to100_deals, color: 'border-amber-400', bg: 'bg-amber-50' },
                { label: '$100K+', rev: latest.tier100plus_rev, deals: latest.tier100plus_deals, color: 'border-green-500', bg: 'bg-green-50' },
              ].map(tier => (
                <div key={tier.label} className={`${tier.bg} border-t-4 ${tier.color} rounded-xl p-4`}>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">{tier.label}</p>
                  <p className="text-xl font-bold text-gray-900">{fmt(tier.rev||0)}</p>
                  <p className="text-sm text-gray-500 mt-1">{tier.deals||0} deals</p>
                  {tier.rev && tier.deals && parseInt(tier.deals) > 0 && <p className="text-xs text-gray-600 mt-0.5">AVD: ${Math.round(parseFloat(tier.rev)/parseInt(tier.deals)).toLocaleString()}</p>}
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Deal Tier Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData.filter(d => d.runRate + d.tier25 + d.tier50 + d.tier100 > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="runRate" name="<$25K Run Rate" stackId="a" fill="#94a3b8" />
                  <Bar dataKey="tier25" name="$25K–$50K" stackId="a" fill="#60a5fa" />
                  <Bar dataKey="tier50" name="$50K–$100K" stackId="a" fill="#fbbf24" />
                  <Bar dataKey="tier100" name="$100K+" stackId="a" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Sales Orders — Revenue & Margin</h3>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={recentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tickFormatter={v => `$${(v/1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={v => v + '%'} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="soRevenue" name="Sales Orders Rev" fill="#818cf8" radius={[3,3,0,0]} />
                  <Line yAxisId="right" dataKey="avgMargin" name="Avg Margin %" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'Activity' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <StatCard label="Calls This Week" value={latest.total_calls||0} sub="from CRM activity log" accent="border-l-blue-500" />
              <StatCard label="Meetings This Week" value={latest.total_meetings||0} sub="from CRM activity log" accent="border-l-green-500" />
              <StatCard label="Avg Calls/Week" value={Math.round(snapshots.reduce((s,w) => s+(w.total_calls||0),0)/snapshots.length)} sub="all-time average" accent="border-l-purple-500" />
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Activity Trend — Calls & Meetings</h3>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="calls" name="Calls" fill="#0ea5e9" radius={[3,3,0,0]} />
                  <Bar dataKey="meetings" name="Meetings" fill="#8b5cf6" radius={[3,3,0,0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'History' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">All Snapshots ({snapshots.length})</h3>
              <Link href="/weekly" className="text-sm text-blue-600 hover:text-blue-800">+ Add snapshot</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">Week</th>
                    <th className="text-right px-4 py-3">Revenue MTD</th>
                    <th className="text-right px-4 py-3">vs Quota</th>
                    <th className="text-right px-4 py-3">Pipeline</th>
                    <th className="text-right px-4 py-3">Coverage</th>
                    <th className="text-right px-4 py-3">Deals</th>
                    <th className="text-right px-4 py-3">$100K+</th>
                    <th className="text-right px-4 py-3">Quarter YTD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...snapshots].reverse().map((s) => {
                    const pct = s.monthly_quota > 0 ? (s.revenue_mtd / s.monthly_quota * 100) : 0
                    return (
                      <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedWeek(s)}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{s.label}</p>
                          <p className="text-xs text-gray-600">{s.week_ending}</p>
                          {s.is_month_end && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Month End</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(s.revenue_mtd)}</td>
                        <td className="px-4 py-3 text-right"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pct>=90?'bg-green-100 text-green-700':pct>=60?'bg-blue-100 text-blue-700':'bg-amber-100 text-amber-700'}`}>{pct.toFixed(0)}%</span></td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(s.open_pipeline)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmtRatio(s.coverage_ratio)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{s.total_deals_closed||0}</td>
                        <td className="px-4 py-3 text-right">{(s.deals_over_100k||0)>0?<span className="text-green-700 font-semibold">{s.deals_over_100k}</span>:<span className="text-gray-500">—</span>}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{fmt(s.quarter_revenue_ytd)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {selectedWeek && (
              <div className="border-t border-gray-100 bg-gray-50 p-5">
                <h4 className="font-semibold text-gray-700 mb-3">📋 {selectedWeek.label} — Detail</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                  <div><span className="text-gray-700 font-medium">Revenue MTD:</span> <strong>{fmt(selectedWeek.revenue_mtd)}</strong></div>
                  <div><span className="text-gray-700 font-medium">Pipeline:</span> <strong>{fmt(selectedWeek.open_pipeline)}</strong></div>
                  <div><span className="text-gray-700 font-medium">Weighted:</span> <strong>{fmt(selectedWeek.weighted_funnel)}</strong></div>
                  <div><span className="text-gray-700 font-medium">Sales Orders:</span> <strong>{fmt(selectedWeek.sales_orders_revenue)}</strong></div>
                  <div><span className="text-gray-700 font-medium">Calls:</span> <strong>{selectedWeek.total_calls||0}</strong></div>
                  <div><span className="text-gray-700 font-medium">Meetings:</span> <strong>{selectedWeek.total_meetings||0}</strong></div>
                  <div><span className="text-gray-700 font-medium">Overdue:</span> <strong>{selectedWeek.overdue_count||0} ({fmt(selectedWeek.overdue_value)})</strong></div>
                  <div><span className="text-gray-700 font-medium">Avg Margin:</span> <strong>{fmtPct(selectedWeek.avg_margin)}</strong></div>
                </div>
                {selectedWeek.notes && <p className="text-sm text-gray-700 italic border-l-2 border-amber-400 pl-3">"{selectedWeek.notes}"</p>}
              </div>
            )}
          </div>
        )}

        {activeTab === '$100K+ Deals' && (() => {
          const openDeals = largeDeals.filter(d => d.status === 'open')
          const wonDeals = largeDeals.filter(d => d.status === 'won')
          const lostDeals = largeDeals.filter(d => d.status === 'lost')
          const pushedDeals = largeDeals.filter(d => d.status === 'pushed')
          const totalOpen = openDeals.reduce((s, d) => s + (d.value || 0), 0)
          const totalWeighted = openDeals.reduce((s, d) => s + ((d.value || 0) * (d.probability || 0) / 100), 0)
          const totalWon = wonDeals.reduce((s, d) => s + (d.value || 0), 0)
          const totalLost = lostDeals.reduce((s, d) => s + (d.value || 0), 0)
          const totalPushed = pushedDeals.reduce((s, d) => s + (d.value || 0), 0)
          const allDates = [...new Set(largeDeals.map(d => d.week_added).filter(Boolean))].sort().reverse()
          const thisWeek = allDates[0] || null
          const newThisWeek = largeDeals.filter(d => d.week_added === thisWeek)
          return (
            <div className="space-y-6">
              {/* WoW Summary Panel */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800">📊 Month Summary — Large Deals (&gt;$100K)</h3>
                  <p className="text-xs text-gray-600 mt-0.5">All activity tracked this month across open, won, lost and pushed deals</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Open Pipeline</p>
                    <p className="text-2xl font-bold text-blue-600">{fmt(totalOpen)}</p>
                    <p className="text-xs text-gray-600 mt-1">{openDeals.length} deals · {fmt(totalWeighted)} weighted</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Closed Won ✅</p>
                    <p className="text-2xl font-bold text-green-600">{fmt(totalWon)}</p>
                    <p className="text-xs text-gray-600 mt-1">{wonDeals.length} deals</p>
                    {wonDeals.length > 0 && <div className="mt-2 space-y-0.5">{wonDeals.map((d,i) => <p key={i} className="text-xs text-green-700 truncate">✅ {d.customer} ({fmt(d.value)})</p>)}</div>}
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Pushed Out 📅</p>
                    <p className="text-2xl font-bold text-amber-500">{fmt(totalPushed)}</p>
                    <p className="text-xs text-gray-600 mt-1">{pushedDeals.length} deals</p>
                    {pushedDeals.length > 0 && <div className="mt-2 space-y-0.5">{pushedDeals.map((d,i) => <p key={i} className="text-xs text-amber-600 truncate">📅 {d.customer} ({fmt(d.value)})</p>)}</div>}
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Closed Lost ❌</p>
                    <p className="text-2xl font-bold text-red-500">{fmt(totalLost)}</p>
                    <p className="text-xs text-gray-600 mt-1">{lostDeals.length} deals</p>
                    {lostDeals.length > 0 && <div className="mt-2 space-y-0.5">{lostDeals.map((d,i) => <p key={i} className="text-xs text-red-600 truncate">❌ {d.customer} ({fmt(d.value)})</p>)}</div>}
                  </div>
                </div>
                {thisWeek && newThisWeek.length > 0 && (
                  <div className="px-5 py-3 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs font-semibold text-blue-700">📥 Most recently added ({thisWeek}): {newThisWeek.map(d => d.customer).join(' · ')}</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Open Deals</p><p className="text-2xl font-bold text-gray-900">{openDeals.length}</p><p className="text-xs text-gray-600 mt-0.5">{fmt(totalOpen)} total value</p></div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Weighted Value</p><p className="text-2xl font-bold text-blue-600">{fmt(totalWeighted)}</p><p className="text-xs text-gray-600 mt-0.5">probability-adjusted</p></div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Won</p><p className="text-2xl font-bold text-green-600">{wonDeals.length}</p><p className="text-xs text-gray-600 mt-0.5">{fmt(totalWon)}</p></div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"><p className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Pushed / Lost</p><p className="text-2xl font-bold text-amber-500">{pushedDeals.length} / {lostDeals.length}</p></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
                  <div><h3 className="font-semibold text-gray-800">🔴 Open Large Deals (&gt;$100K)</h3><p className="text-xs text-gray-500 mt-0.5">Use this to shape your GM forecast</p></div>
                  <span className="text-sm font-medium text-gray-500">{fmt(totalOpen)} total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr><th className="text-left px-4 py-3">Account</th><th className="text-left px-4 py-3">OPP ID</th><th className="text-left px-4 py-3">Rep</th><th className="text-right px-4 py-3">Value</th><th className="text-right px-4 py-3">Probability</th><th className="text-right px-4 py-3">Weighted</th><th className="text-left px-4 py-3">Close Date</th><th className="text-left px-4 py-3">Notes</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {openDeals.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-600">No open large deals</td></tr>}
                      {openDeals.map((deal, i) => {
                        const weighted = (deal.value || 0) * (deal.probability || 0) / 100
                        const closeDate = deal.current_close_date ? new Date(deal.current_close_date) : null
                        const isOverdue = closeDate && closeDate < new Date()
                        const daysUntil = closeDate ? Math.ceil((closeDate - new Date()) / 1000 / 60 / 60 / 24) : null
                        return (
                          <tr key={deal.id || i} className="hover:bg-gray-50">
                            <td className="px-4 py-3"><p className="font-medium text-gray-900">{deal.customer}</p>{deal.week_added && <p className="text-xs text-gray-600">Added {deal.week_added}</p>}</td>
                            <td className="px-4 py-3"><span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{deal.opportunity_id || '—'}</span></td>
                            <td className="px-4 py-3 text-gray-600">{deal.rep || '—'}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(deal.value)}</td>
                            <td className="px-4 py-3 text-right"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(deal.probability||0)>=75?'bg-green-100 text-green-700':(deal.probability||0)>=50?'bg-blue-100 text-blue-700':(deal.probability||0)>=25?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{deal.probability || 0}%</span></td>
                            <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(weighted)}</td>
                            <td className="px-4 py-3">{closeDate ? (<div><p className={`text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>{closeDate.toLocaleDateString(CLIENT.locale, { day: 'numeric', month: 'short' })}</p><p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-600'}`}>{isOverdue ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d away`}</p></div>) : <span className="text-gray-500">—</span>}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{deal.notes || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    {openDeals.length > 0 && <tfoot><tr className="bg-blue-50 border-t-2 border-blue-200"><td colSpan={3} className="px-4 py-3 font-semibold text-blue-800">TOTAL</td><td className="px-4 py-3 text-right font-bold text-blue-900">{fmt(totalOpen)}</td><td className="px-4 py-3"></td><td className="px-4 py-3 text-right font-bold text-blue-900">{fmt(totalWeighted)}</td><td colSpan={2}></td></tr></tfoot>}
                  </table>
                </div>
              </div>
              {wonDeals.length > 0 && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-800">✅ Won Large Deals</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide"><tr><th className="text-left px-4 py-3">Account</th><th className="text-left px-4 py-3">Rep</th><th className="text-right px-4 py-3">Value</th><th className="text-left px-4 py-3">Notes</th></tr></thead><tbody className="divide-y divide-gray-50">{wonDeals.map((deal, i) => <tr key={deal.id||i} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium text-gray-900">{deal.customer}</td><td className="px-4 py-3 text-gray-600">{deal.rep||'—'}</td><td className="px-4 py-3 text-right font-medium text-green-700">{fmt(deal.value)}</td><td className="px-4 py-3 text-xs text-gray-500">{deal.notes||'—'}</td></tr>)}</tbody></table></div></div>}
              {pushedDeals.length > 0 && <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"><div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-800">📅 Pushed Deals</h3></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide"><tr><th className="text-left px-4 py-3">Account</th><th className="text-left px-4 py-3">Rep</th><th className="text-right px-4 py-3">Value</th><th className="text-left px-4 py-3">New Close Date</th><th className="text-left px-4 py-3">Notes</th></tr></thead><tbody className="divide-y divide-gray-50">{pushedDeals.map((deal, i) => <tr key={deal.id||i} className="hover:bg-amber-50"><td className="px-4 py-3 font-medium text-gray-900">{deal.customer}</td><td className="px-4 py-3 text-gray-600">{deal.rep||'—'}</td><td className="px-4 py-3 text-right font-medium text-amber-700">{fmt(deal.value)}</td><td className="px-4 py-3 text-xs text-amber-600">{deal.current_close_date||'—'}</td><td className="px-4 py-3 text-xs text-gray-500">{deal.notes||'—'}</td></tr>)}</tbody></table></div></div>}
            </div>
          )
        })()}

        {activeTab === 'Campaigns' && (
          <div className="space-y-6">

            {/* Add / Edit Campaign */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-800 mb-4">➕ Add Campaign</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Campaign ID (from {CLIENT.crm.name})</label>
                  <input type="text" value={campaignForm.campaign_id} onChange={e => setCampaignForm(p => ({...p, campaign_id: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="000007"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Campaign Name</label>
                  <input type="text" value={campaignForm.campaign_name} onChange={e => setCampaignForm(p => ({...p, campaign_name: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Tiva Greaseless Frac Valves"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Stage</label>
                  <select value={campaignForm.stage} onChange={e => setCampaignForm(p => ({...p, stage: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option>Planning</option>
                    <option>Execution</option>
                    <option>Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Owner (Rep)</label>
                  <select value={campaignForm.owner} onChange={e => setCampaignForm(p => ({...p, owner: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {CLIENT.reps.campaignOwners.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Start Date</label>
                  <input type="date" value={campaignForm.start_date} onChange={e => setCampaignForm(p => ({...p, start_date: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">End Date</label>
                  <input type="date" value={campaignForm.end_date} onChange={e => setCampaignForm(p => ({...p, end_date: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Activities Count</label>
                  <input type="number" value={campaignForm.activities_count} onChange={e => setCampaignForm(p => ({...p, activities_count: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="6"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Opportunities Count</label>
                  <input type="number" value={campaignForm.opportunities_count} onChange={e => setCampaignForm(p => ({...p, opportunities_count: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="2"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Opportunities Value ($)</label>
                  <input type="number" value={campaignForm.opportunities_value} onChange={e => setCampaignForm(p => ({...p, opportunities_value: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="643032"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Won Opportunities Count</label>
                  <input type="number" value={campaignForm.won_count} onChange={e => setCampaignForm(p => ({...p, won_count: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Won Value ($)</label>
                  <input type="number" value={campaignForm.won_value} onChange={e => setCampaignForm(p => ({...p, won_value: e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="0"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1">Notes / Progress Summary</label>
                  <textarea value={campaignForm.notes} onChange={e => setCampaignForm(p => ({...p, notes: e.target.value}))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Key activities, outcomes, next steps..."/>
                </div>
              </div>
              <button onClick={async () => {
                if (!campaignForm.campaign_name) { setCampaignStatus('❌ Campaign name required'); return }
                setSavingCampaign(true)
                const { error } = await supabase.from('campaigns').insert([{
                  ...campaignForm,
                  activities_count: parseInt(campaignForm.activities_count) || 0,
                  opportunities_count: parseInt(campaignForm.opportunities_count) || 0,
                  opportunities_value: parseFloat(campaignForm.opportunities_value) || 0,
                  won_count: parseInt(campaignForm.won_count) || 0,
                  won_value: parseFloat(campaignForm.won_value) || 0,
                  client_id: CLIENT.id
                }])
                if (error) { setCampaignStatus('❌ ' + error.message) }
                else {
                  setCampaignStatus('✅ Campaign saved!')
                  setCampaignForm({ campaign_id: '', campaign_name: '', stage: 'Execution', owner: CLIENT.reps.defaultCampaignOwner, start_date: '', end_date: '', activities_count: '', opportunities_count: '', opportunities_value: '', won_count: '', won_value: '', notes: '' })
                  const { data } = await supabase.from('campaigns').select('*').eq('client_id', CLIENT.id).order('created_at', { ascending: false })
                  setCampaigns(data || [])
                }
                setSavingCampaign(false)
              }} disabled={savingCampaign} className="mt-4 w-full py-2.5 rounded-lg text-white font-medium text-sm disabled:opacity-50" style={{background:CLIENT.brand.blue}}>
                {savingCampaign ? 'Saving...' : '💾 Save Campaign'}
              </button>
              {campaignStatus && <p className="text-sm text-center mt-2">{campaignStatus}</p>}
            </div>

            {/* WoW Comparison */}
            {(() => {
              const weeks = [...new Set(campaignSnapshots.map(s => s.week_ending))].sort().reverse()
              const thisWeek = weeks[0]
              const lastWeek = weeks[1]
              if (!thisWeek) return null
              const thisSnaps = campaignSnapshots.filter(s => s.week_ending === thisWeek)
              const lastSnaps = campaignSnapshots.filter(s => s.week_ending === lastWeek)
              return (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">📈 Campaign WoW — {thisWeek}</h3>
                      <p className="text-xs text-gray-600 mt-0.5">{lastWeek ? `vs ${lastWeek}` : 'First week recorded — no previous to compare'}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-4 py-3">Campaign</th>
                          <th className="text-right px-4 py-3">Activities</th>
                          <th className="text-right px-4 py-3">Δ Act</th>
                          <th className="text-right px-4 py-3">Opps</th>
                          <th className="text-right px-4 py-3">Δ Opps</th>
                          <th className="text-right px-4 py-3">Opp Value</th>
                          <th className="text-right px-4 py-3">Δ Value</th>
                          <th className="text-left px-4 py-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {campaigns.map(c => {
                          const ts = thisSnaps.find(s => s.campaign_id === c.id)
                          const ls = lastSnaps.find(s => s.campaign_id === c.id)
                          const act = ts?.activities_count ?? c.activities_count ?? 0
                          const opp = ts?.opportunities_count ?? c.opportunities_count ?? 0
                          const val = ts?.opportunities_value ?? c.opportunities_value ?? 0
                          const dAct = ls ? act - ls.activities_count : null
                          const dOpp = ls ? opp - ls.opportunities_count : null
                          const dVal = ls ? val - ls.opportunities_value : null
                          const delta = (d, isCurrency) => {
                            if (d === null) return <span className="text-gray-500 text-xs">—</span>
                            if (d === 0) return <span className="text-gray-600 text-xs font-medium">→ No change</span>
                            const color = d > 0 ? 'text-green-600' : 'text-red-600'
                            const sign = d > 0 ? '↑' : '↓'
                            const v = isCurrency ? fmt(Math.abs(d)) : Math.abs(d)
                            return <span className={`text-xs font-semibold ${color}`}>{sign} {v}</span>
                          }
                          return (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{c.campaign_name}</p>
                                <p className="text-xs text-gray-600 font-mono">{c.campaign_id}</p>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{act}</td>
                              <td className="px-4 py-3 text-right">{delta(dAct, false)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{opp}</td>
                              <td className="px-4 py-3 text-right">{delta(dOpp, false)}</td>
                              <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(val)}</td>
                              <td className="px-4 py-3 text-right">{delta(dVal, true)}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">{ts?.notes || ls?.notes || <span className="text-gray-500">No change</span>}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            {/* WoW Comparison */}
            {(() => {
              const weeks = [...new Set(campaignSnapshots.map(s => s.week_ending))].sort().reverse()
              const thisWeek = weeks[0]
              const lastWeek = weeks[1]
              if (!thisWeek) return null
              const thisSnaps = campaignSnapshots.filter(s => s.week_ending === thisWeek)
              const lastSnaps = campaignSnapshots.filter(s => s.week_ending === lastWeek)
              return (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-800">📈 Campaign WoW — {thisWeek}</h3>
                      <p className="text-xs text-gray-600 mt-0.5">{lastWeek ? `vs ${lastWeek}` : 'First week recorded — no previous to compare'}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-4 py-3">Campaign</th>
                          <th className="text-right px-4 py-3">Activities</th>
                          <th className="text-right px-4 py-3">Δ Act</th>
                          <th className="text-right px-4 py-3">Opps</th>
                          <th className="text-right px-4 py-3">Δ Opps</th>
                          <th className="text-right px-4 py-3">Opp Value</th>
                          <th className="text-right px-4 py-3">Δ Value</th>
                          <th className="text-left px-4 py-3">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {campaigns.map(c => {
                          const ts = thisSnaps.find(s => s.campaign_id === c.id)
                          const ls = lastSnaps.find(s => s.campaign_id === c.id)
                          const act = ts?.activities_count ?? c.activities_count ?? 0
                          const opp = ts?.opportunities_count ?? c.opportunities_count ?? 0
                          const val = ts?.opportunities_value ?? c.opportunities_value ?? 0
                          const dAct = ls ? act - ls.activities_count : null
                          const dOpp = ls ? opp - ls.opportunities_count : null
                          const dVal = ls ? val - ls.opportunities_value : null
                          const delta = (d, isCurrency) => {
                            if (d === null) return <span className="text-gray-500 text-xs">—</span>
                            if (d === 0) return <span className="text-gray-600 text-xs font-medium">→ No change</span>
                            const color = d > 0 ? 'text-green-600' : 'text-red-600'
                            const sign = d > 0 ? '↑' : '↓'
                            const v = isCurrency ? fmt(Math.abs(d)) : Math.abs(d)
                            return <span className={`text-xs font-semibold ${color}`}>{sign} {v}</span>
                          }
                          return (
                            <tr key={c.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-900">{c.campaign_name}</p>
                                <p className="text-xs text-gray-600 font-mono">{c.campaign_id}</p>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{act}</td>
                              <td className="px-4 py-3 text-right">{delta(dAct, false)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{opp}</td>
                              <td className="px-4 py-3 text-right">{delta(dOpp, false)}</td>
                              <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(val)}</td>
                              <td className="px-4 py-3 text-right">{delta(dVal, true)}</td>
                              <td className="px-4 py-3 text-xs text-gray-500">{ts?.notes || ls?.notes || <span className="text-gray-500">No change</span>}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            {/* Campaign List */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">📣 Active Campaigns ({campaigns.length})</h3>
                <p className="text-xs text-gray-600">Updated from {CLIENT.crm.name} Marketing Campaigns</p>
              </div>
              {campaigns.length === 0 ? (
                <div className="px-5 py-12 text-center text-gray-600 text-sm">No campaigns yet — add one above</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3">Campaign</th>
                        <th className="text-left px-4 py-3">Owner</th>
                        <th className="text-left px-4 py-3">Stage</th>
                        <th className="text-left px-4 py-3">Start</th>
                        <th className="text-right px-4 py-3">Activities</th>
                        <th className="text-right px-4 py-3">Opps</th>
                        <th className="text-right px-4 py-3">Opp Value</th>
                        <th className="text-right px-4 py-3">Won</th>
                        <th className="text-right px-4 py-3">Won Value</th>
                        <th className="text-left px-4 py-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {campaigns.map((c, i) => (
                        <tr key={c.id || i} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{c.campaign_name}</p>
                            {c.campaign_id && <p className="text-xs text-gray-600 font-mono">{c.campaign_id}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{c.owner || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.stage === 'Execution' ? 'bg-blue-100 text-blue-700' : c.stage === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {c.stage}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{c.start_date || '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{c.activities_count || 0}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">{c.opportunities_count || 0}</td>
                          <td className="px-4 py-3 text-right text-blue-600 font-medium">{fmt(c.opportunities_value)}</td>
                          <td className="px-4 py-3 text-right text-green-600">{c.won_count || 0}</td>
                          <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(c.won_value)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{c.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={4} className="px-4 py-3 font-semibold text-gray-700">TOTALS</td>
                        <td className="px-4 py-3 text-right font-bold">{campaigns.reduce((s,c) => s+(c.activities_count||0), 0)}</td>
                        <td className="px-4 py-3 text-right font-bold">{campaigns.reduce((s,c) => s+(c.opportunities_count||0), 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-700">{fmt(campaigns.reduce((s,c) => s+(c.opportunities_value||0), 0))}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{campaigns.reduce((s,c) => s+(c.won_count||0), 0)}</td>
                        <td className="px-4 py-3 text-right font-bold text-green-700">{fmt(campaigns.reduce((s,c) => s+(c.won_value||0), 0))}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

                {activeTab === 'Settings' && (
          <div className="max-w-xl mx-auto py-8 text-center space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8">
              <p className="text-4xl mb-4">⚙️</p>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Report Settings</h2>
              <p className="text-gray-500 text-sm mb-6">Configure your consultant voice, tone, and stakeholder preferences. These settings shape every report Claude generates.</p>
              <a href="/settings" className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all">Open Settings Page →</a>
            </div>
          </div>
        )}

        {activeTab === 'Email Report' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="font-semibold text-gray-900 text-lg mb-1">Revenue Report Generator</h2>
              <p className="text-sm text-gray-500 mb-5">Generates a professional HTML report including forecast accuracy. Open in new tab to print or save as PDF.</p>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Latest snapshot — {latest.week_ending}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-900">
                  <div><span className="text-gray-700 font-medium">Revenue MTD:</span> <strong>{fmt(latest.revenue_mtd)}</strong></div>
                  <div><span className="text-gray-700 font-medium">vs Quota:</span> <strong>{quotaAchievement}%</strong></div>
                  <div><span className="text-gray-700 font-medium">Pipeline:</span> <strong>{fmt(latest.open_pipeline)}</strong></div>
                  <div><span className="text-gray-700 font-medium">Forecasts loaded:</span> <strong>{forecasts.length}</strong></div>
                </div>
              </div>
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-2">Report type</p>
                <div className="flex gap-3">
                  {[
                    { value: 'weekly', label: '📅 Weekly Update' },
                    { value: 'month_end', label: '📊 Month End Review' },
                    { value: 'quarter_end', label: '🏆 Quarter End Review' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setReportType(opt.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${reportType === opt.value ? 'bg-gradient-to-r from-slate-700 to-slate-900 text-white border-slate-800 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:border-slate-400'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={generateReport} disabled={emailLoading}
                className="w-full bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white py-3 rounded-lg font-medium text-sm disabled:opacity-50 shadow-sm hover:shadow-md transition-all duration-200">
                {emailLoading ? '✍️ Generating report...' : '📊 Generate Revenue Report'}
              </button>
            </div>
            {generatedHTML && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div><h3 className="font-semibold text-gray-800">Generated Report</h3><p className="text-xs text-gray-500 mt-0.5">Includes forecast accuracy section</p></div>
                  <div className="flex gap-2">
                    <button onClick={copyHTML} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>{copied ? '✅ Copied!' : '📋 Copy HTML'}</button>
                    <button onClick={openInNewTab} className="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950 text-white shadow-sm hover:shadow-md transition-all duration-200">🔗 Open in New Tab</button>
                  </div>
                </div>
                <div className="p-2 bg-gray-50">
                  <iframe srcDoc={generatedHTML} className="w-full rounded-lg border border-gray-200" style={{ height: '800px' }} title="Revenue Report Preview" />
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}