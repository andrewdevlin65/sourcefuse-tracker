'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'
import Header from '../Components/header'
import CLIENT from '../../config/client'

const REPS = CLIENT.reps.accuracy

const fmt = (n) => {
  if (!n || isNaN(n)) return '$0'
  const num = parseFloat(n)
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K'
  return '$' + Math.round(num).toLocaleString()
}

const getAccuracyColor = (pct, settings, type = 'week') => {
  if (pct === null || pct === undefined) return { bg: 'bg-gray-100', text: 'text-gray-400', hex: '#e5e7eb', label: '—' }
  const min = settings?.[`${type}_green_min`] ?? 90
  const max = settings?.[`${type}_green_max`] ?? 120
  if (pct >= min && pct <= max) return { bg: 'bg-green-100', text: 'text-green-800', hex: '#16a34a', label: `${pct.toFixed(0)}%` }
  if (pct > max) return { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#d97706', label: `${pct.toFixed(0)}%` }
  return { bg: 'bg-red-100', text: 'text-red-800', hex: '#dc2626', label: `${pct.toFixed(0)}%` }
}

export default function AccuracyPage() {
  const [tab, setTab] = useState('week')
  const [forecasts, setForecasts] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [monthEndSnapshots, setMonthEndSnapshots] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedRep, setSelectedRep] = useState('all')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: f }, { data: s }, { data: me }, { data: st }] = await Promise.all([
      supabase.from('forecasts').select('*').eq('client_id', CLIENT.id).order('period_start', { ascending: false }),
      supabase.from('weekly_snapshots').select('*').eq('client_id', CLIENT.id).eq('is_month_end', false).order('week_ending', { ascending: true }),
      supabase.from('weekly_snapshots').select('*').eq('client_id', CLIENT.id).eq('is_month_end', true).order('week_ending', { ascending: true }),
      supabase.from('forecast_settings').select('*').eq('client_id', CLIENT.id).maybeSingle()
    ])
    setForecasts(f || [])
    setSnapshots(s || [])
    setMonthEndSnapshots(me || [])
    setSettings(st || { weekly_green_min: 90, weekly_green_max: 120, monthly_green_min: 90, monthly_green_max: 120, quarterly_green_min: 85, quarterly_green_max: 115 })
    setLoading(false)
  }

  const getWeeklyActuals = () => {
    const actuals = {}
    snapshots.forEach((snap, i) => {
      const prev = i > 0 ? snapshots[i - 1] : null
      const snapMonth = snap.week_ending.substring(0, 7)
      const prevMonth = prev?.week_ending?.substring(0, 7)
      let actual = 0
      if (!prev) {
        actual = snap.revenue_mtd || 0
      } else if (snapMonth === prevMonth) {
        actual = (snap.revenue_mtd || 0) - (prev.revenue_mtd || 0)
      } else {
        // Month boundary — check if there's a month-end snapshot for prev month
        const prevMonthEnd = monthEndSnapshots.find(me => me.week_ending.substring(0, 7) === prevMonth)
        const prevMonthFinal = prevMonthEnd ? (prevMonthEnd.revenue_mtd || 0) : (prev.revenue_mtd || 0)
        // This week's actual = MTD minus whatever carried from prev month (which is 0 for new month)
        actual = snap.revenue_mtd || 0
      }
      actuals[snap.week_ending] = Math.max(0, actual)
    })
    return actuals
  }

  const getMonthlyActuals = () => {
    const actuals = {}

    // First — use month-end snapshots as definitive source (most accurate)
    monthEndSnapshots.forEach(snap => {
      const month = snap.week_ending.substring(0, 7)
      actuals[month] = snap.revenue_mtd || 0
    })

    // Then — fill in any months that don't have a month-end snapshot
    // using the last weekly MTD for that month as a fallback
    const byMonth = {}
    snapshots.forEach(snap => {
      const month = snap.week_ending.substring(0, 7)
      if (!byMonth[month] || snap.week_ending > byMonth[month].week_ending) {
        byMonth[month] = snap
      }
    })
    Object.entries(byMonth).forEach(([month, snap]) => {
      if (!actuals[month]) {
        actuals[month] = snap.revenue_mtd || 0
      }
    })

    return actuals
  }

  const weeklyActuals = getWeeklyActuals()
  const monthlyActuals = getMonthlyActuals()

  const getMatchedForecasts = (type) => {
    return forecasts.filter(f => f.forecast_type === type).map(f => {
      let actual = null
      if (type === 'week') {
        const keys = Object.keys(weeklyActuals)
        const closest = keys.find(k => Math.abs(new Date(k) - new Date(f.period_start)) < 7 * 24 * 60 * 60 * 1000)
        actual = closest ? weeklyActuals[closest] : null
      } else if (type === 'month') {
        actual = monthlyActuals[f.period_start.substring(0, 7)] ?? null
      }
      const accuracy = actual !== null && f.amount > 0 ? (actual / f.amount) * 100 : null
      return { ...f, actual, accuracy }
    })
  }

  const weekForecasts = getMatchedForecasts('week')
  const monthForecasts = getMatchedForecasts('month')
  const quarterForecasts = getMatchedForecasts('quarter')
  const allForecasts = tab === 'week' ? weekForecasts : tab === 'month' ? monthForecasts : quarterForecasts

  const getStackRank = (type) => {
    const data = type === 'week' ? weekForecasts : type === 'month' ? monthForecasts : quarterForecasts
    return REPS.map(rep => {
      const repData = data.filter(f => f.rep_name === rep && f.accuracy !== null)
      const avgAccuracy = repData.length > 0 ? repData.reduce((s, f) => s + f.accuracy, 0) / repData.length : null
      const min = settings?.[`${type}_green_min`] ?? 90
      const max = settings?.[`${type}_green_max`] ?? 120
      const green = repData.filter(f => f.accuracy >= min && f.accuracy <= max).length
      const late = data.filter(f => f.rep_name === rep && f.is_late).length
      const total = data.filter(f => f.rep_name === rep).length
      return { rep, avgAccuracy, green, total, late, count: repData.length }
    }).filter(r => r.total > 0).sort((a, b) => {
      if (a.avgAccuracy === null) return 1
      if (b.avgAccuracy === null) return -1
      return Math.abs(100 - a.avgAccuracy) - Math.abs(100 - b.avgAccuracy)
    })
  }

  const stackRank = getStackRank(tab)
  const greenMin = settings?.[`${tab}_green_min`] ?? 90
  const greenMax = settings?.[`${tab}_green_max`] ?? 120

  const getRepChartData = (rep) => {
    const data = tab === 'week' ? weekForecasts : tab === 'month' ? monthForecasts : quarterForecasts
    return data.filter(f => f.rep_name === rep && f.accuracy !== null).slice(0, 12).reverse().map(f => ({
      period: f.period_start,
      accuracy: parseFloat(f.accuracy.toFixed(1)),
      forecast: f.amount,
      actual: f.actual
    }))
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-gray-400">Loading accuracy data...</p>
    </div>
  )

  const TABS = [
    { key: 'week', label: '📅 Weekly' },
    { key: 'month', label: '📊 Monthly' },
    { key: 'quarter', label: '🏆 Quarterly' },
  ]

  // Show month-end data source indicator
  const monthsWithMonthEnd = monthEndSnapshots.map(me => me.week_ending.substring(0, 7))

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="🎯 Forecast Accuracy" subtitle="Track, compare and improve forecast precision" actions={
          <div className="flex gap-2">
            <Link href="/forecast" className="text-white px-3 py-1.5 rounded-lg text-sm font-medium" style={{background:CLIENT.brand.orange}}>+ Submit Forecast</Link>
            <Link href="/setup" className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-medium">⚙️ Settings</Link>
          </div>
        } />
      <div className="bg-gradient-to-r from-indigo-800 to-indigo-700 text-white px-6 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
</div></div>
          <div className="flex gap-4 text-xs flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span>Green: {greenMin}–{greenMax}% (accurate)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>Yellow: &gt;{greenMax}% (sandbagged)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span>Red: &lt;{greenMin}% (missed)</span>
            {monthsWithMonthEnd.length > 0 && (
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block"></span>Month-end verified: {monthsWithMonthEnd.join(', ')}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

        <div className="flex gap-2">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Month-end data notice */}
        {tab === 'month' && (
          <div className={`rounded-lg px-4 py-3 text-sm ${monthsWithMonthEnd.length > 0 ? 'bg-blue-50 border border-blue-200 text-blue-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
            {monthsWithMonthEnd.length > 0
              ? `✅ Month-end snapshots found for: ${monthsWithMonthEnd.join(', ')} — these use final verified figures for accuracy calculations`
              : `⚠️ No month-end snapshots found — monthly accuracy is calculated from the last weekly MTD figure. Add month-end snapshots for more accurate results.`}
          </div>
        )}

        {/* STACK RANK */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">🏆 Stack Rank — {tab.charAt(0).toUpperCase() + tab.slice(1)} Accuracy</h2>
            <p className="text-xs text-gray-500 mt-0.5">Ranked by closeness to 100% — not highest</p>
          </div>
          <div className="divide-y divide-gray-50">
            {stackRank.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No forecast data yet — submit some forecasts to see rankings!</div>
            )}
            {stackRank.map((rep, i) => {
              const color = getAccuracyColor(rep.avgAccuracy, settings, tab)
              const medals = ['🥇', '🥈', '🥉', '4️⃣']
              return (
                <div key={rep.rep} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50">
                  <span className="text-2xl w-8">{medals[i] || `${i+1}.`}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{rep.rep}</p>
                      {rep.late > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{rep.late} late</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{rep.count} with actuals</span>
                      <span>{rep.green} green boxes</span>
                      <span>{rep.total} total submitted</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${color.bg} ${color.text}`}>
                      {rep.avgAccuracy !== null ? rep.avgAccuracy.toFixed(1) + '%' : '—'}
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">avg accuracy</p>
                  </div>
                  <button onClick={() => setSelectedRep(selectedRep === rep.rep ? 'all' : rep.rep)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedRep === rep.rep ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'}`}>
                    {selectedRep === rep.rep ? 'Hide' : 'Detail'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* REP DETAIL CHART */}
        {selectedRep !== 'all' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-1">{selectedRep} — Accuracy Trend</h3>
            <p className="text-xs text-gray-500 mb-4">Last 12 {tab} forecasts vs actuals</p>
            {getRepChartData(selectedRep).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No data with actuals yet for {selectedRep}</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={getRepChartData(selectedRep)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={v => v + '%'} tick={{ fontSize: 11 }} domain={[0, 150]} />
                  <Tooltip formatter={(v, n) => [n === 'accuracy' ? v + '%' : fmt(v), n]} />
                  <ReferenceLine y={greenMin} stroke="#16a34a" strokeDasharray="4 4" label={{ value: `${greenMin}%`, fontSize: 10, fill: '#16a34a' }} />
                  <ReferenceLine y={greenMax} stroke="#d97706" strokeDasharray="4 4" label={{ value: `${greenMax}%`, fontSize: 10, fill: '#d97706' }} />
                  <ReferenceLine y={100} stroke="#6366f1" strokeWidth={1.5} />
                  <Bar dataKey="accuracy" name="accuracy" radius={[4,4,0,0]}>
                    {getRepChartData(selectedRep).map((entry, i) => (
                      <Cell key={i} fill={
                        entry.accuracy >= greenMin && entry.accuracy <= greenMax ? '#16a34a' :
                        entry.accuracy > greenMax ? '#d97706' : '#dc2626'
                      } />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* GREEN BOX SCOREBOARD */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-1">🟩 Green Box Scoreboard</h2>
          <p className="text-xs text-gray-500 mb-4">Accurate forecast history per rep — {tab} period</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {REPS.map(rep => {
              const data = allForecasts.filter(f => f.rep_name === rep && f.accuracy !== null)
              const greens = data.filter(f => f.accuracy >= greenMin && f.accuracy <= greenMax).length
              const yellows = data.filter(f => f.accuracy > greenMax).length
              const reds = data.filter(f => f.accuracy < greenMin).length
              return (
                <div key={rep} className="border border-gray-100 rounded-xl p-4 text-center">
                  <p className="font-semibold text-gray-800 mb-3">{rep}</p>
                  <div className="flex justify-center gap-1 flex-wrap mb-2">
                    {data.map((f, i) => (
                      <div key={i} title={`${f.period_start}: ${f.accuracy.toFixed(0)}%`}
                        className={`w-5 h-5 rounded cursor-default ${
                          f.accuracy >= greenMin && f.accuracy <= greenMax ? 'bg-green-500' :
                          f.accuracy > greenMax ? 'bg-yellow-400' : 'bg-red-400'
                        }`} />
                    ))}
                    {data.length === 0 && <p className="text-gray-300 text-xs">No data yet</p>}
                  </div>
                  <div className="flex justify-center gap-2 text-xs mt-2">
                    <span className="text-green-700 font-bold">{greens}🟩</span>
                    <span className="text-yellow-600 font-bold">{yellows}🟨</span>
                    <span className="text-red-600 font-bold">{reds}🟥</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* HISTORY TABLE */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Forecast History</h2>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSelectedRep('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium ${selectedRep === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                All
              </button>
              {REPS.map(r => (
                <button key={r} onClick={() => setSelectedRep(r)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${selectedRep === r ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Period</th>
                  <th className="text-left px-4 py-3">Rep</th>
                  <th className="text-right px-4 py-3">Forecast</th>
                  <th className="text-right px-4 py-3">Actual</th>
                  <th className="text-left px-4 py-3">Source</th>
                  <th className="text-right px-4 py-3">Accuracy</th>
                  <th className="text-left px-4 py-3">Result</th>
                  <th className="text-left px-4 py-3">Key Deals</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allForecasts
                  .filter(f => selectedRep === 'all' || f.rep_name === selectedRep)
                  .map((f, i) => {
                    const color = getAccuracyColor(f.accuracy, settings, tab)
                    const month = f.period_start.substring(0, 7)
                    const hasMonthEnd = monthsWithMonthEnd.includes(month)
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{f.period_start}</p>
                          {f.is_late && <span className="text-xs text-red-500 font-medium">⏰ Late</span>}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">{f.rep_name || '—'}</td>
                        <td className="px-4 py-3 text-right">{fmt(f.amount)}</td>
                        <td className="px-4 py-3 text-right">{f.actual !== null ? fmt(f.actual) : <span className="text-gray-300">Pending</span>}</td>
                        <td className="px-4 py-3">
                          {f.actual !== null && tab === 'month' ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${hasMonthEnd ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                              {hasMonthEnd ? '✅ Month-end' : 'Last weekly MTD'}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {f.accuracy !== null
                            ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${color.bg} ${color.text}`}>{color.label}</span>
                            : <span className="text-gray-300 text-xs">Pending</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {f.accuracy !== null
                            ? <span className={color.text}>{f.accuracy >= greenMin && f.accuracy <= greenMax ? '✅ Accurate' : f.accuracy > greenMax ? '🟡 Sandbagged' : '🔴 Missed'}</span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{f.key_deals || '—'}</td>
                      </tr>
                    )
                  })}
                {allForecasts.filter(f => selectedRep === 'all' || f.rep_name === selectedRep).length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No forecasts yet for this period type</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}