'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Header from '../Components/header'
import CLIENT from '../../config/client'

const REPS = CLIENT.reps.quotaGrid

const MONTH_NAMES = ['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun']

function getMonthsForFY(fy) {
  // FY2026 = Jul 2025 – Jun 2026
  const endYear = parseInt(fy.replace('FY',''))
  const startYear = endYear - 1
  return MONTH_NAMES.map((m, i) => {
    const year = i < 6 ? startYear : endYear
    const monthNum = [7,8,9,10,11,12,1,2,3,4,5,6][i]
    const date = `${year}-${String(monthNum).padStart(2,'0')}-01`
    return { label: `${m} ${year}`, date }
  })
}

function getCurrentFY() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1  // 1-12
  // FY runs Jul-Jun. If Jul+ we're in FY(year+1), else FY(year)
  return month >= 7 ? `FY${year + 1}` : `FY${year}`
}

const FISCAL_YEARS = CLIENT.fiscalYears

const DAYS = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 0 },
]

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`
}))

const WEEKS = [
  { label: 'First week', value: 1 },
  { label: 'Second week', value: 2 },
  { label: 'Third week', value: 3 },
  { label: 'Fourth week', value: 4 },
]

const emptyGrid = (months) => {
  const grid = {}
  REPS.forEach(rep => {
    grid[rep] = {}
    months.forEach(m => { grid[rep][m.date] = '' })
  })
  return grid
}

const AccuracyPreview = ({ min, max }) => (
  <div className="flex gap-2 mt-2 flex-wrap text-xs">
    <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">&lt;{min}% = 🔴 Missed</span>
    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">{min}–{max}% = ✅ Accurate</span>
    <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">&gt;{max}% = 🟡 Sandbagged</span>
  </div>
)

export default function SetupPage() {
  const [tab, setTab] = useState('quotas')
  const [fiscalYear, setFiscalYear] = useState(getCurrentFY)
  const months = getMonthsForFY(fiscalYear)
  const [quotas, setQuotas] = useState(() => emptyGrid(getMonthsForFY(getCurrentFY())))
  const [actuals, setActuals] = useState(() => emptyGrid(getMonthsForFY(getCurrentFY())))
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  // Settings
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  // Weekly deadlines — AE and GM separate
  const [aeWeeklyDay, setAeWeeklyDay] = useState(5)
  const [aeWeeklyHour, setAeWeeklyHour] = useState(12)
  const [gmWeeklyDay, setGmWeeklyDay] = useState(5)
  const [gmWeeklyHour, setGmWeeklyHour] = useState(16)

  // Monthly deadline
  const [monthlyIsLastDay, setMonthlyIsLastDay] = useState(true)
  const [monthlyDeadlineDay, setMonthlyDeadlineDay] = useState(28)

  // Quarterly deadline
  const [quarterlyWeek, setQuarterlyWeek] = useState(2)
  const [quarterlyDay, setQuarterlyDay] = useState(1)

  // Accuracy thresholds
  const [weeklyGreenMin, setWeeklyGreenMin] = useState(90)
  const [weeklyGreenMax, setWeeklyGreenMax] = useState(120)
  const [monthlyGreenMin, setMonthlyGreenMin] = useState(90)
  const [monthlyGreenMax, setMonthlyGreenMax] = useState(120)
  const [quarterlyGreenMin, setQuarterlyGreenMin] = useState(85)
  const [quarterlyGreenMax, setQuarterlyGreenMax] = useState(115)

  useEffect(() => { loadExisting(fiscalYear) }, [fiscalYear])
  useEffect(() => { if (tab === 'settings') loadSettings() }, [tab])

  const loadExisting = async (fy) => {
    setLoading(true)
    const fyMonths = getMonthsForFY(fy)
    const startDate = fyMonths[0].date
    const endDate = fyMonths[fyMonths.length - 1].date
    const { data: qData } = await supabase.from('quotas').select('*').eq('client_id', CLIENT.id).gte('month_start', startDate).lte('month_start', endDate)
    const qGrid = emptyGrid(fyMonths)
    if (qData?.length) {
      qData.forEach(q => { if (qGrid[q.rep_name]?.[q.month_start] !== undefined) qGrid[q.rep_name][q.month_start] = q.amount })
    }
    setQuotas(qGrid)
    const { data: aData } = await supabase.from('monthly_actuals').select('*').eq('client_id', CLIENT.id).gte('month_start', startDate).lte('month_start', endDate)
    const aGrid = emptyGrid(fyMonths)
    if (aData?.length) {
      aData.forEach(a => { if (aGrid[a.rep_name]?.[a.month_start] !== undefined) aGrid[a.rep_name][a.month_start] = a.actual_revenue })
    }
    setActuals(aGrid)
    setLoading(false)
  }

  const loadSettings = async () => {
    setSettingsLoading(true)
    const { data } = await supabase.from('forecast_settings').select('*').eq('client_id', CLIENT.id).maybeSingle()
    if (data) {
      setAeWeeklyDay(data.ae_weekly_deadline_day ?? 5)
      setAeWeeklyHour(data.ae_weekly_deadline_hour ?? 12)
      setGmWeeklyDay(data.gm_weekly_deadline_day ?? 5)
      setGmWeeklyHour(data.gm_weekly_deadline_hour ?? 16)
      setMonthlyIsLastDay(data.monthly_deadline_is_last_day ?? true)
      setMonthlyDeadlineDay(data.monthly_deadline_day ?? 28)
      setQuarterlyWeek(data.quarterly_deadline_week ?? 2)
      setQuarterlyDay(data.quarterly_deadline_day ?? 1)
      setWeeklyGreenMin(data.weekly_green_min ?? 90)
      setWeeklyGreenMax(data.weekly_green_max ?? 120)
      setMonthlyGreenMin(data.monthly_green_min ?? 90)
      setMonthlyGreenMax(data.monthly_green_max ?? 120)
      setQuarterlyGreenMin(data.quarterly_green_min ?? 85)
      setQuarterlyGreenMax(data.quarterly_green_max ?? 115)
    }
    setSettingsLoading(false)
  }

  const saveSettings = async () => {
    setSettingsLoading(true)
    const { error } = await supabase.from('forecast_settings').upsert({
      client_id: CLIENT.id,
      ae_weekly_deadline_day: parseInt(aeWeeklyDay),
      ae_weekly_deadline_hour: parseInt(aeWeeklyHour),
      gm_weekly_deadline_day: parseInt(gmWeeklyDay),
      gm_weekly_deadline_hour: parseInt(gmWeeklyHour),
      monthly_deadline_is_last_day: monthlyIsLastDay,
      monthly_deadline_day: parseInt(monthlyDeadlineDay),
      quarterly_deadline_week: parseInt(quarterlyWeek),
      quarterly_deadline_day: parseInt(quarterlyDay),
      weekly_green_min: parseFloat(weeklyGreenMin),
      weekly_green_max: parseFloat(weeklyGreenMax),
      monthly_green_min: parseFloat(monthlyGreenMin),
      monthly_green_max: parseFloat(monthlyGreenMax),
      quarterly_green_min: parseFloat(quarterlyGreenMin),
      quarterly_green_max: parseFloat(quarterlyGreenMax),
      updated_at: new Date().toISOString()
    }, { onConflict: 'client_id' })
    if (error) setStatus('❌ Error: ' + error.message)
    else { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 3000) }
    setSettingsLoading(false)
  }

  const saveQuotas = async () => {
    setStatus('Saving quotas...')
    const rows = []
    REPS.forEach(rep => {
      months.forEach(m => {
        const val = parseFloat(quotas[rep][m.date])
        if (!isNaN(val) && val > 0) rows.push({ client_id: CLIENT.id, fiscal_year: fiscalYear, rep_name: rep, month_start: m.date, amount: val })
      })
    })
    const { error } = await supabase.from('quotas').upsert(rows, { onConflict: 'client_id,rep_name,month_start' })
    if (error) setStatus('❌ Error: ' + error.message)
    else setStatus('✅ Quotas saved!')
  }

  const saveActuals = async () => {
    setStatus('Saving actuals...')
    const rows = []
    REPS.forEach(rep => {
      months.forEach(m => {
        const val = parseFloat(actuals[rep][m.date])
        if (!isNaN(val) && val > 0) rows.push({ client_id: CLIENT.id, rep_name: rep, month_start: m.date, actual_revenue: val })
      })
    })
    const { error } = await supabase.from('monthly_actuals').upsert(rows, { onConflict: 'client_id,rep_name,month_start' })
    if (error) setStatus('❌ Error: ' + error.message)
    else setStatus('✅ Historical actuals saved!')
  }

  const fmt = (val) => {
    const n = parseFloat(val)
    if (!val || isNaN(n)) return ''
    if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'K'
    return '$' + n
  }

  const colTotal = (grid, date) => REPS.filter(r => r !== 'Company').reduce((sum, rep) => sum + (parseFloat(grid[rep]?.[date]) || 0), 0)

  const pasteRow = (rep, grid, setGrid) => {
    const raw = prompt(`Paste ${rep}'s 12 monthly values (tab or comma separated, Jul → Jun):`)
    if (!raw) return
    const values = raw.split(/[\t,]/).map(v => v.trim().replace(/[$,\s]/g, ''))
    if (values.length !== 12) { alert(`Expected 12 values, got ${values.length}.`); return }
    const updated = { ...grid, [rep]: { ...grid[rep] } }
    months.forEach((m, i) => { updated[rep][m.date] = values[i] })
    setGrid(updated)
  }

  const inputClass = "w-full border border-gray-200 rounded px-2 py-1 text-gray-900 bg-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  const settingSelect = "border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
  const settingInput = "border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const card = "bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4"

  const Grid = ({ grid, setGrid, onSave, saveLabel }) => (
    <div>
      <div className="overflow-x-auto rounded-lg shadow">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="text-left px-3 py-2 sticky left-0 bg-gray-800 min-w-40">Rep</th>
              {months.map(m => <th key={m.date} className="px-2 py-2 text-center min-w-24 font-medium">{m.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {REPS.map((rep, ri) => (
              <tr key={rep} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className={`px-3 py-2 sticky left-0 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-medium whitespace-nowrap ${rep === 'Company' ? 'text-blue-700' : 'text-gray-700'}`}>
                      {rep === 'Company' ? '🏢 Company' : rep === 'Inside Sales' ? '📞 Inside Sales' : '👤 ' + rep}
                    </span>
                    <button onClick={() => pasteRow(rep, grid, setGrid)} className="text-xs text-blue-500 hover:text-blue-700 whitespace-nowrap border border-blue-200 rounded px-1 py-0.5">paste row</button>
                  </div>
                </td>
                {months.map(m => (
                  <td key={m.date} className="px-1 py-1">
                    <input type="number" value={grid[rep]?.[m.date] ?? ''}
                      onChange={e => { const u = { ...grid, [rep]: { ...grid[rep], [m.date]: e.target.value } }; setGrid(u) }}
                      className={inputClass} placeholder="0"/>
                    {grid[rep]?.[m.date] ? <p className="text-xs text-gray-400 text-right px-1">{fmt(grid[rep][m.date])}</p> : null}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td className="px-3 py-2 font-semibold text-blue-700 sticky left-0 bg-blue-50">AE Total</td>
              {months.map(m => <td key={m.date} className="px-2 py-2 text-right text-sm font-medium text-blue-700">{colTotal(grid, m.date) > 0 ? fmt(colTotal(grid, m.date)) : '—'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4">
        {status && <p className="text-sm text-gray-700">{status}</p>}
        <button onClick={onSave} className="ml-auto px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all duration-200">{saveLabel}</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <Header title="⚙️ Admin — Setup & Settings" subtitle={`Quotas, actuals and forecast configuration · ${CLIENT.name}`} />

        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'quotas', label: '📊 Monthly Quotas' },
            { key: 'actuals', label: '📈 Historical Actuals' },
            { key: 'settings', label: '⚙️ Forecast Settings' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setStatus('') }}
              className={`px-5 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:border-blue-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab !== 'settings' && (
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-700">Fiscal Year:</label>
            <select value={fiscalYear} onChange={e => { setFiscalYear(e.target.value); setStatus('') }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {FISCAL_YEARS.map(fy => {
                const endYr = parseInt(fy.replace('FY',''))
                return <option key={fy} value={fy}>{fy} (Jul {endYr - 1} – Jun {endYr})</option>
              })}
            </select>
          </div>
        )}

        {loading && tab !== 'settings' ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">Loading...</div>
        ) : tab === 'quotas' ? (
          <div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
              Enter each rep's monthly quota in dollars. Use "paste row" to paste 12 values at once from Excel.
            </div>
            <Grid grid={quotas} setGrid={setQuotas} onSave={saveQuotas} saveLabel="Save All Quotas" />
          </div>
        ) : tab === 'actuals' ? (
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
              Enter actual revenue achieved each month. Future months leave blank — filled from weekly snapshots as the year progresses.
            </div>
            <Grid grid={actuals} setGrid={setActuals} onSave={saveActuals} saveLabel="Save Historical Actuals" />
          </div>
        ) : (

          /* SETTINGS TAB */
          <div className="space-y-6 max-w-2xl">

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">⚙️ Admin Only — Forecast Rules</p>
              <p className="text-xs">Changes apply immediately to forecast submission pages and accuracy tracking.</p>
            </div>

            {/* AE Weekly Deadline */}
            <div className={card}>
              <div>
                <h2 className="font-semibold text-gray-900 mb-0.5">🎯 AE Weekly Forecast Deadline</h2>
                <p className="text-xs text-gray-500">When {CLIENT.reps.ae.join(', ')} and other AEs must submit by. {CLIENT.stakeholders.gm.name} can see their submissions before completing his own.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Due Day</label>
                  <select value={aeWeeklyDay} onChange={e => setAeWeeklyDay(e.target.value)} className={settingSelect}>
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Due Time</label>
                  <select value={aeWeeklyHour} onChange={e => setAeWeeklyHour(e.target.value)} className={settingSelect}>
                    {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                📌 AE forecasts due: <strong>{DAYS.find(d => d.value === parseInt(aeWeeklyDay))?.label}s at {HOURS.find(h => h.value === parseInt(aeWeeklyHour))?.label}</strong>
              </div>
            </div>

            {/* GM Weekly Deadline */}
            <div className={card}>
              <div>
                <h2 className="font-semibold text-gray-900 mb-0.5">📊 GM Weekly Forecast Deadline</h2>
                <p className="text-xs text-gray-500">{CLIENT.stakeholders.gm.name}&apos;s deadline — set later than AE deadline so {CLIENT.stakeholders.gm.name} can review AE submissions first.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Due Day</label>
                  <select value={gmWeeklyDay} onChange={e => setGmWeeklyDay(e.target.value)} className={settingSelect}>
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Due Time</label>
                  <select value={gmWeeklyHour} onChange={e => setGmWeeklyHour(e.target.value)} className={settingSelect}>
                    {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                📌 GM forecast due: <strong>{DAYS.find(d => d.value === parseInt(gmWeeklyDay))?.label}s at {HOURS.find(h => h.value === parseInt(gmWeeklyHour))?.label}</strong>
              </div>
              {parseInt(gmWeeklyDay) === parseInt(aeWeeklyDay) && parseInt(gmWeeklyHour) <= parseInt(aeWeeklyHour) && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  ⚠️ GM deadline is the same time or earlier than AE deadline — {CLIENT.stakeholders.gm.name} won&apos;t have time to review AE submissions!
                </div>
              )}
            </div>

            {/* Monthly Deadline */}
            <div className={card}>
              <div>
                <h2 className="font-semibold text-gray-900 mb-0.5">📅 Monthly Forecast Deadline</h2>
                <p className="text-xs text-gray-500">When monthly forecasts must be submitted. Typically the last day of the prior month.</p>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={monthlyIsLastDay} onChange={() => setMonthlyIsLastDay(true)} className="accent-blue-600"/>
                  <span className="text-sm text-gray-700">Last day of prior month (recommended)</span>
                </label>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={!monthlyIsLastDay} onChange={() => setMonthlyIsLastDay(false)} className="accent-blue-600"/>
                  <span className="text-sm text-gray-700">Specific day of prior month:</span>
                </label>
                {!monthlyIsLastDay && (
                  <div className="flex items-center gap-2">
                    <input type="number" value={monthlyDeadlineDay} onChange={e => setMonthlyDeadlineDay(e.target.value)} className={settingInput} min="1" max="31"/>
                    <span className="text-sm text-gray-500">of the prior month</span>
                  </div>
                )}
              </div>
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                📌 Monthly forecasts due: <strong>{monthlyIsLastDay ? 'Last day of the prior month' : `${monthlyDeadlineDay}th of the prior month`}</strong> — e.g. April forecast due {monthlyIsLastDay ? '31 March' : `${monthlyDeadlineDay} March`}
              </div>
            </div>

            {/* Quarterly Deadline */}
            <div className={card}>
              <div>
                <h2 className="font-semibold text-gray-900 mb-0.5">🏆 Quarterly Forecast Deadline</h2>
                <p className="text-xs text-gray-500">Set to the second week to give reps time to be more accurate with their quarterly view.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Week of quarter's 2nd month</label>
                  <select value={quarterlyWeek} onChange={e => setQuarterlyWeek(e.target.value)} className={settingSelect}>
                    {WEEKS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Day of that week</label>
                  <select value={quarterlyDay} onChange={e => setQuarterlyDay(e.target.value)} className={settingSelect}>
                    {DAYS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                📌 Quarterly forecasts due: <strong>{WEEKS.find(w => w.value === parseInt(quarterlyWeek))?.label} {DAYS.find(d => d.value === parseInt(quarterlyDay))?.label} of the quarter's 2nd month</strong> — e.g. Q3 forecast due {WEEKS.find(w => w.value === parseInt(quarterlyWeek))?.label} {DAYS.find(d => d.value === parseInt(quarterlyDay))?.label} of February
              </div>
            </div>

            {/* Weekly Accuracy */}
            <div className={card}>
              <div>
                <h2 className="font-semibold text-gray-900 mb-0.5">🟩 Weekly Accuracy Thresholds</h2>
                <p className="text-xs text-gray-500">What % range counts as an accurate weekly forecast.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Green Min %</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={weeklyGreenMin} onChange={e => setWeeklyGreenMin(e.target.value)} className={settingInput} min="0" max="100" step="5"/>
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Green Max %</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={weeklyGreenMax} onChange={e => setWeeklyGreenMax(e.target.value)} className={settingInput} min="100" max="200" step="5"/>
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              </div>
              <AccuracyPreview min={weeklyGreenMin} max={weeklyGreenMax} />
            </div>

            {/* Monthly Accuracy */}
            <div className={card}>
              <div>
                <h2 className="font-semibold text-gray-900 mb-0.5">🟩 Monthly Accuracy Thresholds</h2>
                <p className="text-xs text-gray-500">What % range counts as an accurate monthly forecast.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Green Min %</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={monthlyGreenMin} onChange={e => setMonthlyGreenMin(e.target.value)} className={settingInput} min="0" max="100" step="5"/>
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Green Max %</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={monthlyGreenMax} onChange={e => setMonthlyGreenMax(e.target.value)} className={settingInput} min="100" max="200" step="5"/>
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              </div>
              <AccuracyPreview min={monthlyGreenMin} max={monthlyGreenMax} />
            </div>

            {/* Quarterly Accuracy */}
            <div className={card}>
              <div>
                <h2 className="font-semibold text-gray-900 mb-0.5">🟩 Quarterly Accuracy Thresholds</h2>
                <p className="text-xs text-gray-500">Quarterly forecasts typically allow a wider tolerance.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Green Min %</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={quarterlyGreenMin} onChange={e => setQuarterlyGreenMin(e.target.value)} className={settingInput} min="0" max="100" step="5"/>
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Green Max %</label>
                  <div className="flex items-center gap-2">
                    <input type="number" value={quarterlyGreenMax} onChange={e => setQuarterlyGreenMax(e.target.value)} className={settingInput} min="100" max="200" step="5"/>
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                </div>
              </div>
              <AccuracyPreview min={quarterlyGreenMin} max={quarterlyGreenMax} />
            </div>

            <button onClick={saveSettings} disabled={settingsLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium text-sm disabled:opacity-50 shadow-sm hover:shadow-md transition-all">
              {settingsLoading ? 'Saving...' : '💾 Save All Settings'}
            </button>

            {settingsSaved && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-center text-green-800 text-sm font-medium">
                ✅ Settings saved! Forecast pages will now reflect these rules.
              </div>
            )}

          </div>
        )}

        {tab !== 'settings' && (
          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Once saved, these numbers feed automatically into:</p>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <span>✅ Weekly snapshot form (pre-fills quota)</span>
              <span>✅ Manager dashboard (quota vs actuals)</span>
              <span>✅ Revenue Tracker (monthly achievement %)</span>
              <span>✅ AI chat (knows all quotas and history)</span>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}