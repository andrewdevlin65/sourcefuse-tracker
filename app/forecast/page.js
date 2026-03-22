'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Header from '../Components/header'
import CLIENT from '../../config/client'

const AE_REPS = CLIENT.reps.ae
const GM_REPS = CLIENT.reps.gm
const ALL_REPS = [...AE_REPS, ...GM_REPS]

const fmt = (n) => {
  if (!n || isNaN(n)) return '$0'
  const num = parseFloat(n)
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K'
  return '$' + Math.round(num).toLocaleString()
}

const getDayName = (dayNum) => ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayNum] || 'Friday'

const getDeadlineInfo = (type, repName, settings) => {
  const now = new Date()
  const isGM = GM_REPS.includes(repName)

  if (type === 'week') {
    const deadlineDay = isGM
      ? (settings?.gm_weekly_deadline_day ?? 5)
      : (settings?.ae_weekly_deadline_day ?? 5)
    const deadlineHour = isGM
      ? (settings?.gm_weekly_deadline_hour ?? 16)
      : (settings?.ae_weekly_deadline_hour ?? 12)

    const dayName = getDayName(deadlineDay)
    const hourStr = deadlineHour === 0 ? '12:00 AM' : deadlineHour < 12 ? `${deadlineHour}:00 AM` : deadlineHour === 12 ? '12:00 PM' : `${deadlineHour-12}:00 PM`
    const current = now.getDay()
    let daysUntil = (deadlineDay - current + 7) % 7
    if (daysUntil === 0 && now.getHours() >= deadlineHour) daysUntil = 7
    const deadline = new Date(now)
    deadline.setDate(now.getDate() + daysUntil)
    deadline.setHours(deadlineHour, 0, 0, 0)
    const isLate = daysUntil === 0 && now.getHours() >= deadlineHour
    const hoursUntil = Math.round((deadline - now) / 1000 / 60 / 60)

    // For GM — also show AE deadline context
    const aeDeadlineDay = settings?.ae_weekly_deadline_day ?? 5
    const aeDeadlineHour = settings?.ae_weekly_deadline_hour ?? 12
    const aeDayName = getDayName(aeDeadlineDay)
    const aeHourStr = aeDeadlineHour === 0 ? '12:00 AM' : aeDeadlineHour < 12 ? `${aeDeadlineHour}:00 AM` : aeDeadlineHour === 12 ? '12:00 PM' : `${aeDeadlineHour-12}:00 PM`

    return {
      label: `Due: ${dayName}s at ${hourStr}`,
      urgent: hoursUntil <= 4 && !isLate,
      isLate,
      detail: isLate ? '🚨 This submission is LATE' : hoursUntil <= 24 ? `⏰ Due in ${hoursUntil} hours` : `Due ${dayName} at ${hourStr}`,
      aeContext: isGM ? `AE forecasts due ${aeDayName}s at ${aeHourStr} — check those first before submitting yours` : null
    }
  }

  if (type === 'month') {
    const isLastDay = settings?.monthly_deadline_is_last_day ?? true
    const specificDay = settings?.monthly_deadline_day ?? 28
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const deadlineDate = isLastDay ? lastDay : new Date(now.getFullYear(), now.getMonth(), specificDay)
    const daysUntil = Math.ceil((deadlineDate - now) / 1000 / 60 / 60 / 24)
    const isLate = now > deadlineDate
    const dateStr = deadlineDate.toLocaleDateString(CLIENT.locale, { day: 'numeric', month: 'short' })
    return {
      label: `Due: ${isLastDay ? 'Last day of prior month' : `${specificDay}th of prior month`} (${dateStr})`,
      urgent: daysUntil <= 2,
      isLate,
      detail: isLate ? '🚨 This submission is LATE' : `${daysUntil} days remaining`,
      aeContext: null
    }
  }

  if (type === 'quarter') {
    const week = settings?.quarterly_deadline_week ?? 2
    const dayOfWeek = settings?.quarterly_deadline_day ?? 1
    const qMonth = Math.floor(now.getMonth() / 3) * 3 + 1
    const firstOfMonth = new Date(now.getFullYear(), qMonth, 1)
    const firstDOW = firstOfMonth.getDay()
    const daysToTarget = (dayOfWeek - firstDOW + 7) % 7
    const firstOccurrence = new Date(firstOfMonth)
    firstOccurrence.setDate(1 + daysToTarget)
    const deadline = new Date(firstOccurrence)
    deadline.setDate(firstOccurrence.getDate() + (week - 1) * 7)
    const isLate = now > deadline
    const daysUntil = Math.ceil((deadline - now) / 1000 / 60 / 60 / 24)
    const dateStr = deadline.toLocaleDateString(CLIENT.locale, { day: 'numeric', month: 'short' })
    const weekNames = ['', 'first', 'second', 'third', 'fourth']
    return {
      label: `Due: ${weekNames[week]} ${getDayName(dayOfWeek)} of quarter's 2nd month (${dateStr})`,
      urgent: daysUntil <= 3,
      isLate,
      detail: isLate ? '🚨 This submission is LATE' : `${daysUntil} days remaining`,
      aeContext: null
    }
  }

  return { label: '', urgent: false, isLate: false, detail: '', aeContext: null }
}

const getAccuracyColor = (pct, settings, type) => {
  if (pct === null || pct === undefined) return null
  const min = settings?.[`${type}_green_min`] ?? 90
  const max = settings?.[`${type}_green_max`] ?? 120
  if (pct >= min && pct <= max) return { bg: 'bg-green-100', text: 'text-green-800', label: '✅ Accurate' }
  if (pct > max) return { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '🟡 Sandbagged' }
  return { bg: 'bg-red-100', text: 'text-red-800', label: '🔴 Missed' }
}

export default function ForecastPage() {
  const [form, setForm] = useState({
    rep_name: '', forecast_type: 'week', period_start: '',
    amount: '', key_deals: '', risks: ''
  })
  const [status, setStatus] = useState('')
  const [settings, setSettings] = useState(null)
  const [recentForecasts, setRecentForecasts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [aeForecasts, setAeForecasts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])
  useEffect(() => { if (form.rep_name) { loadRepHistory(); if (GM_REPS.includes(form.rep_name)) loadAeForecasts() } }, [form.rep_name, form.forecast_type])

  const loadData = async () => {
    const [{ data: st }, { data: s }] = await Promise.all([
      supabase.from('forecast_settings').select('*').eq('client_id', CLIENT.id).maybeSingle(),
      supabase.from('weekly_snapshots').select('*').eq('client_id', CLIENT.id).order('week_ending', { ascending: true })
    ])
    setSettings(st)
    setSnapshots(s || [])
    setLoading(false)
  }

  const loadRepHistory = async () => {
    const { data } = await supabase.from('forecasts').select('*')
      .eq('client_id', CLIENT.id).eq('rep_name', form.rep_name)
      .eq('forecast_type', form.forecast_type)
      .order('period_start', { ascending: false }).limit(8)
    setRecentForecasts(data || [])
  }

  const loadAeForecasts = async () => {
    const { data } = await supabase.from('forecasts').select('*')
      .eq('client_id', CLIENT.id).eq('forecast_type', form.forecast_type)
      .in('rep_name', AE_REPS)
      .order('period_start', { ascending: false }).limit(20)
    setAeForecasts(data || [])
  }

  const getWeeklyActuals = () => {
    const actuals = {}
    snapshots.forEach((snap, i) => {
      const prev = i > 0 ? snapshots[i - 1] : null
      const snapMonth = snap.week_ending.substring(0, 7)
      const prevMonth = prev?.week_ending?.substring(0, 7)
      let actual = 0
      if (!prev) actual = snap.revenue_mtd || 0
      else if (snapMonth === prevMonth) actual = (snap.revenue_mtd || 0) - (prev.revenue_mtd || 0)
      else actual = snap.revenue_mtd || 0
      actuals[snap.week_ending] = Math.max(0, actual)
    })
    return actuals
  }

  const getMonthlyActuals = () => {
    const byMonth = {}
    snapshots.forEach(snap => {
      const month = snap.week_ending.substring(0, 7)
      if (!byMonth[month] || snap.week_ending > byMonth[month].week_ending) byMonth[month] = snap
    })
    const actuals = {}
    Object.entries(byMonth).forEach(([month, snap]) => { actuals[month] = snap.revenue_mtd || 0 })
    return actuals
  }

  const getActualForForecast = (f) => {
    const weeklyActuals = getWeeklyActuals()
    const monthlyActuals = getMonthlyActuals()
    if (f.forecast_type === 'week') {
      const keys = Object.keys(weeklyActuals)
      const closest = keys.find(k => Math.abs(new Date(k) - new Date(f.period_start)) < 7 * 24 * 60 * 60 * 1000)
      return closest ? weeklyActuals[closest] : null
    }
    if (f.forecast_type === 'month') return monthlyActuals[f.period_start.substring(0, 7)] ?? null
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Saving...')
    const deadlineInfo = getDeadlineInfo(form.forecast_type, form.rep_name, settings)
    const { error } = await supabase.from('forecasts').insert([{
      forecast_type: form.forecast_type,
      period_start: form.period_start,
      amount: parseFloat(form.amount),
      key_deals: form.key_deals,
      risks: form.risks,
      rep_name: form.rep_name,
      submitted_at: new Date().toISOString(),
      is_late: deadlineInfo.isLate,
      client_id: CLIENT.id
    }])
    if (error) setStatus('❌ Error: ' + error.message)
    else {
      setStatus(deadlineInfo.isLate ? '⚠️ Forecast saved — marked as LATE' : '✅ Forecast saved!')
      setForm({ rep_name: form.rep_name, forecast_type: form.forecast_type, period_start: '', amount: '', key_deals: '', risks: '' })
      loadRepHistory()
      if (GM_REPS.includes(form.rep_name)) loadAeForecasts()
    }
  }

  const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const isGM = GM_REPS.includes(form.rep_name)
  const deadlineInfo = form.rep_name ? getDeadlineInfo(form.forecast_type, form.rep_name, settings) : { label: '', urgent: false, isLate: false, detail: '', aeContext: null }
  const greenMin = settings?.[`${form.forecast_type}_green_min`] ?? 90
  const greenMax = settings?.[`${form.forecast_type}_green_max`] ?? 120

  const recentWithActuals = recentForecasts.map(f => {
    const actual = getActualForForecast(f)
    const accuracy = actual !== null && f.amount > 0 ? (actual / f.amount) * 100 : null
    return { ...f, actual, accuracy }
  }).filter(f => f.accuracy !== null)

  const avgRecent = recentWithActuals.length > 0
    ? recentWithActuals.reduce((s, f) => s + f.accuracy, 0) / recentWithActuals.length : null

  // Latest AE forecasts for GM view — most recent period per AE
  const latestAeForecasts = AE_REPS.map(rep => {
    const repForecasts = aeForecasts.filter(f => f.rep_name === rep)
    return repForecasts[0] || null
  }).filter(Boolean)

  const aeTotalLatest = latestAeForecasts.reduce((s, f) => s + (f.amount || 0), 0)

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📋 Submit Forecast</h1>
            <p className="text-sm text-gray-500">{CLIENT.name} · Weekly / Monthly / Quarterly</p>
          </div>
          <div className="flex gap-3">
            <Link href="/accuracy" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">📊 Accuracy</Link>
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Home</Link>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Rep + Type */}
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Your Name</label>
                <select value={form.rep_name} onChange={e => setForm({...form, rep_name: e.target.value})} className={inputClass} required>
                  <option value="">Select...</option>
                  <optgroup label="Account Executives">
                    {AE_REPS.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                  <optgroup label="Sales Management">
                    {GM_REPS.map(r => <option key={r} value={r}>{r} (GM)</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className={labelClass}>Forecast Type</label>
                <select value={form.forecast_type} onChange={e => setForm({...form, forecast_type: e.target.value})} className={inputClass}>
                  <option value="week">Weekly</option>
                  <option value="month">Monthly</option>
                  <option value="quarter">Quarterly</option>
                </select>
              </div>
            </div>

            {/* Deadline banner */}
            {form.rep_name && (
              <div className={`rounded-lg px-4 py-3 flex items-start gap-3 ${
                deadlineInfo.isLate ? 'bg-red-50 border border-red-200' :
                deadlineInfo.urgent ? 'bg-amber-50 border border-amber-200' :
                'bg-blue-50 border border-blue-200'
              }`}>
                <span className="text-lg">{deadlineInfo.isLate ? '🚨' : deadlineInfo.urgent ? '⏰' : '📅'}</span>
                <div>
                  <p className={`font-semibold text-sm ${deadlineInfo.isLate ? 'text-red-800' : deadlineInfo.urgent ? 'text-amber-800' : 'text-blue-800'}`}>
                    {deadlineInfo.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${deadlineInfo.isLate ? 'text-red-600 font-bold' : deadlineInfo.urgent ? 'text-amber-600' : 'text-blue-600'}`}>
                    {deadlineInfo.detail}
                  </p>
                  {deadlineInfo.aeContext && (
                    <p className="text-xs mt-1.5 text-indigo-700 font-medium border-t border-blue-200 pt-1.5">
                      💡 {deadlineInfo.aeContext}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* GM Panel — AE forecasts summary */}
          {isGM && form.rep_name && latestAeForecasts.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5">
              <p className="text-sm font-semibold text-indigo-900 mb-3">👥 Latest AE Forecasts — {form.forecast_type}</p>
              <div className="space-y-2 mb-3">
                {latestAeForecasts.map(f => (
                  <div key={f.rep_name} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                    <div>
                      <span className="font-medium text-gray-800 text-sm">{f.rep_name}</span>
                      <span className="text-xs text-gray-500 ml-2">{f.period_start}</span>
                      {f.is_late && <span className="text-xs text-red-500 ml-2">⏰ Late</span>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 text-sm">{fmt(f.amount)}</p>
                      {f.key_deals && <p className="text-xs text-gray-400 truncate max-w-32">{f.key_deals}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-indigo-100 rounded-lg px-3 py-2 flex justify-between items-center">
                <span className="text-sm font-semibold text-indigo-800">AE Total</span>
                <span className="text-sm font-bold text-indigo-900">{fmt(aeTotalLatest)}</span>
              </div>
              {AE_REPS.filter(rep => !latestAeForecasts.find(f => f.rep_name === rep)).length > 0 && (
                <p className="text-xs text-amber-700 mt-2">
                  ⚠️ Missing: {AE_REPS.filter(rep => !latestAeForecasts.find(f => f.rep_name === rep)).join(', ')} haven't submitted yet
                </p>
              )}
            </div>
          )}

          {/* Recent accuracy panel */}
          {form.rep_name && recentWithActuals.length > 0 && (
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm font-semibold text-gray-700 mb-3">📈 Your recent {form.forecast_type} accuracy</p>
              <div className="flex gap-2 flex-wrap mb-3">
                {recentWithActuals.map((f, i) => {
                  const color = getAccuracyColor(f.accuracy, settings, form.forecast_type)
                  return (
                    <div key={i} title={`${f.period_start}: ${fmt(f.amount)} → ${fmt(f.actual)}`}
                      className={`px-2 py-1 rounded text-xs font-bold ${color.bg} ${color.text} cursor-default`}>
                      {f.accuracy.toFixed(0)}%
                    </div>
                  )
                })}
              </div>
              {avgRecent !== null && (
                <div className={`text-sm rounded-lg px-3 py-2 ${getAccuracyColor(avgRecent, settings, form.forecast_type)?.bg} ${getAccuracyColor(avgRecent, settings, form.forecast_type)?.text}`}>
                  <strong>Your avg: {avgRecent.toFixed(1)}%</strong>
                  {avgRecent > greenMax && <span className="ml-2 text-xs">— you tend to sandbag. Try submitting higher.</span>}
                  {avgRecent < greenMin && <span className="ml-2 text-xs">— you tend to miss. Try being more conservative.</span>}
                  {avgRecent >= greenMin && avgRecent <= greenMax && <span className="ml-2 text-xs">— you're in the green zone! Keep it up.</span>}
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">Green zone: {greenMin}–{greenMax}% = accurate</p>
            </div>
          )}

          {/* Forecast details */}
          <div className="bg-white rounded-lg shadow p-5 space-y-4">
            <div>
              <label className={labelClass}>Period Start Date</label>
              <input type="date" value={form.period_start} onChange={e => setForm({...form, period_start: e.target.value})} className={inputClass} required />
              <p className="text-xs text-gray-400 mt-1">
                {form.forecast_type === 'week' ? 'Enter the Monday of the week you are forecasting' :
                 form.forecast_type === 'month' ? 'Enter the 1st of the month (e.g. 2026-04-01)' :
                 'Enter the 1st day of the quarter (e.g. 2026-04-01)'}
              </p>
            </div>
            <div>
              <label className={labelClass}>
                {isGM ? 'Company Forecast Amount ($)' : 'Your Forecast Amount ($)'}
              </label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className={inputClass} placeholder="0" required />
              {form.amount && <p className="text-xs text-gray-400 mt-1">{fmt(parseFloat(form.amount))}</p>}
              {isGM && aeTotalLatest > 0 && form.amount && (
                <p className="text-xs text-indigo-600 mt-1">
                  {parseFloat(form.amount) > aeTotalLatest
                    ? `↑ ${fmt(parseFloat(form.amount) - aeTotalLatest)} above AE total of ${fmt(aeTotalLatest)}`
                    : parseFloat(form.amount) < aeTotalLatest
                    ? `↓ ${fmt(aeTotalLatest - parseFloat(form.amount))} below AE total of ${fmt(aeTotalLatest)}`
                    : `Matches AE total of ${fmt(aeTotalLatest)}`}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>{isGM ? 'Key assumptions / deal drivers' : 'Key deals supporting this forecast'}</label>
              <textarea value={form.key_deals} onChange={e => setForm({...form, key_deals: e.target.value})} rows={3} className={inputClass}
                placeholder={isGM ? 'What assumptions are you making about large deal conversion?' : 'List the deals you\'re counting on to hit this number...'} />
            </div>
            <div>
              <label className={labelClass}>Risks / Concerns</label>
              <textarea value={form.risks} onChange={e => setForm({...form, risks: e.target.value})} rows={2} className={inputClass}
                placeholder="What could prevent hitting this forecast?" />
            </div>

            <button type="submit"
              className={`w-full py-3 rounded-lg font-medium text-white transition-colors ${
                deadlineInfo.isLate ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}>
              {deadlineInfo.isLate ? '⚠️ Submit Late Forecast' : '✅ Submit Forecast'}
            </button>

            {status && (
              <p className={`text-center text-sm font-medium ${status.includes('✅') ? 'text-green-700' : status.includes('⚠️') ? 'text-amber-700' : 'text-red-700'}`}>
                {status}
              </p>
            )}
          </div>

        </form>
      </div>
    </div>
  )
}