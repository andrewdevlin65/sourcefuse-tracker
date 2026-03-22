'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../Components/header'
import CLIENT from '../../config/client'
import { calculateRevenueModel, DEFAULT_ASSUMPTIONS } from '../../lib/revenueModel'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, ComposedChart } from 'recharts'

const fmt$ = (n) => n != null ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'

export default function RevenueBridgePage() {
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS })
  const [actuals, setActuals] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('stream')
  const [sliders, setSliders] = useState({ expansion: 15, quota: 1000000, retention: 70 })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: aRows }, { data: sRows }] = await Promise.all([
      supabase.from('sf_assumptions').select('*').eq('client_id', CLIENT.id),
      supabase.from('sf_stream_actuals').select('*').eq('client_id', CLIENT.id).order('period', { ascending: true }),
    ])
    if (aRows?.length) {
      const merged = { ...DEFAULT_ASSUMPTIONS }
      aRows.forEach(r => { if (r.value_y1 != null) merged[r.assumption_key] = r.value_y1 })
      setAssumptions(merged)
      setSliders({ expansion: Math.round(merged.expansion_rate_y1 * 100), quota: merged.rep_quota, retention: Math.round(merged.retention_y1 * 100) })
    }
    setActuals(sRows || [])
    setLoading(false)
  }

  const model = useMemo(() => calculateRevenueModel(assumptions), [assumptions])

  const liveModel = useMemo(() => calculateRevenueModel({
    ...assumptions,
    expansion_rate_y1: sliders.expansion / 100,
    expansion_rate_y2: (sliders.expansion + 5) / 100,
    expansion_rate_y3: (sliders.expansion + 10) / 100,
    rep_quota: sliders.quota,
    retention_y1: sliders.retention / 100,
    retention_y2: (sliders.retention + 5) / 100,
    retention_y3: (sliders.retention + 10) / 100,
  }), [assumptions, sliders])

  // Chart data
  const stackedData = [
    { year: 'Year 1', stream1: model.stream1.y1, stream2: model.stream2.y1, stream3: model.stream3.y1, target: assumptions.target_y1 },
    { year: 'Year 2', stream1: model.stream1.y2, stream2: model.stream2.y2, stream3: model.stream3.y2, target: assumptions.target_y2 },
    { year: 'Year 3', stream1: model.stream1.y3, stream2: model.stream2.y3, stream3: model.stream3.y3, target: assumptions.target_y3 },
  ]

  // Actuals vs Projected line data
  const quarterlyData = []
  const projPerQ = { y1: model.total_organic.y1 / 4, y2: model.total_organic.y2 / 4, y3: model.total_organic.y3 / 4 }
  for (let y = 1; y <= 3; y++) {
    for (let q = 1; q <= 4; q++) {
      const label = `Q${q} Y${y}`
      const proj = y === 1 ? projPerQ.y1 : y === 2 ? projPerQ.y2 : projPerQ.y3
      const act = actuals.find(a => a.year_number === y && a.quarter_number === q)
      const actTotal = act ? (act.stream1_amount || 0) + (act.stream2_amount || 0) + (act.stream3_amount || 0) : null
      quarterlyData.push({ quarter: label, projected: Math.round(proj), actual: actTotal ? Math.round(actTotal) : null, isDemo: act?.is_demo })
    }
  }

  const hasDemo = actuals.some(a => a.is_demo)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {fmt$(p.value)}</p>)}
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-gray-400">Loading revenue model...</p></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Revenue Architecture" subtitle={`${CLIENT.name} · $23M → $55M live model`} />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* SECTION A — Headline KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Current ARR</p>
            <p className="text-2xl font-bold text-gray-900">{fmt$(assumptions.current_revenue)}</p>
          </div>
          <div className="bg-white rounded-xl border-l-4 border border-gray-100 p-5 shadow-sm" style={{ borderLeftColor: CLIENT.brand.primary }}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">$55M Target Date</p>
            <p className="text-2xl font-bold" style={{ color: CLIENT.brand.primary }}>{model.projected_55m_quarter}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Track Status</p>
            <p className={`text-2xl font-bold ${model.projected_55m_on_track ? 'text-green-600' : 'text-amber-600'}`}>
              {model.months_ahead_behind >= 0 ? `${model.months_ahead_behind}mo ahead` : `${Math.abs(model.months_ahead_behind)}mo behind`}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Hunters Must Close</p>
            <p className="text-2xl font-bold text-red-600">{fmt$(model.gap.y3)}</p>
          </div>
        </div>

        {/* SECTION B — View Toggle */}
        <div className="flex gap-2">
          {['stream', 'channel'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
              style={view === v ? { background: CLIENT.brand.secondary } : {}}>
              {v === 'stream' ? 'Stream View' : 'Channel View'}
            </button>
          ))}
        </div>

        {/* SECTION C — Stacked Bar Chart */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Three-Year Revenue Projection</h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={stackedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 13 }} />
              <YAxis domain={[0, 60000000]} tickFormatter={v => `$${(v / 1000000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="stream1" name="Stream 1: Recurring" stackId="a" fill="#3b82f6" />
              <Bar dataKey="stream2" name="Stream 2: Expansion" stackId="a" fill="#22c55e" />
              <Bar dataKey="stream3" name="Stream 3: New Logos" stackId="a" fill={CLIENT.brand.primary} radius={[4, 4, 0, 0]} />
              <ReferenceLine y={55000000} stroke={CLIENT.brand.primary} strokeDasharray="6 4" strokeWidth={2} label={{ value: '$55M', position: 'right', fill: CLIENT.brand.primary, fontSize: 12, fontWeight: 700 }} />
              <ReferenceLine y={25000000} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: '$25M', position: 'right', fill: '#94a3b8', fontSize: 11 }} />
              <ReferenceLine y={35000000} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: '$35M', position: 'right', fill: '#94a3b8', fontSize: 11 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* SECTION D — Actuals vs Projected */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 relative">
          <h3 className="font-semibold text-gray-800 mb-4">Quarterly: Actual vs Projected</h3>
          {hasDemo && <span className="absolute top-5 right-5 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Demo data</span>}
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={quarterlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line type="monotone" dataKey="projected" name="Projected" stroke="#94a3b8" strokeDasharray="6 4" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="actual" name="Actual" stroke={CLIENT.brand.primary} strokeWidth={2.5} dot={{ r: 4, fill: CLIENT.brand.primary }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* SECTION E — Gap Calculator */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100" style={{ background: CLIENT.brand.secondary }}>
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">Gap Calculator — Year 3</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {[
              { label: '$55M Target', value: fmt$(assumptions.target_y3), bold: true },
              { label: '— Stream 1: Recurring base', value: fmt$(model.stream1.y3), color: 'text-blue-600' },
              { label: '— Stream 2: Account expansion', value: fmt$(model.stream2.y3), color: 'text-green-600' },
              { label: '— Stream 3: New logos', value: fmt$(model.stream3.y3), color: 'text-red-600' },
              { label: '= Gap hunters must close', value: fmt$(model.gap.y3), highlight: true },
              { label: `÷ Rep quota (${fmt$(assumptions.rep_quota)}) × ramp`, value: `${model.weighted_ramp.toFixed(2)}x` },
              { label: '= Reps required', value: model.reps_needed, highlight: model.reps_needed > (CLIENT.hirePlan?.reps?.length || 4) },
              { label: 'Your hire plan covers', value: `${CLIENT.hirePlan?.reps?.length || 4} reps` },
              { label: 'Remaining gap', value: fmt$(model.hire_plan_gap), highlight: model.hire_plan_gap > 0, color: model.hire_plan_gap === 0 ? 'text-green-600' : 'text-red-600' },
            ].map((row, i) => (
              <div key={i} className={`px-5 py-3 flex justify-between items-center ${row.highlight ? 'bg-red-50' : ''}`}>
                <span className={`text-sm ${row.bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>{row.label}</span>
                <span className={`text-sm font-semibold ${row.color || 'text-gray-900'}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION F — Sensitivity Sliders */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Assumption Sensitivity</h3>
            <p className="text-xs text-gray-400">Move any lever to see the impact on your $55M date</p>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-4">
            <p className="text-lg font-bold" style={{ color: CLIENT.brand.primary }}>{liveModel.projected_55m_quarter}</p>
            <p className={`text-sm font-medium ${liveModel.projected_55m_on_track ? 'text-green-600' : 'text-amber-600'}`}>
              {liveModel.months_ahead_behind >= 0 ? `${liveModel.months_ahead_behind}mo ahead` : `${Math.abs(liveModel.months_ahead_behind)}mo behind`}
            </p>
          </div>
          {[
            { key: 'expansion', label: 'Expansion Rate', min: 10, max: 35, step: 1, suffix: '%' },
            { key: 'quota', label: 'Rep Quota', min: 500000, max: 2000000, step: 50000, prefix: '$', format: v => `$${(v / 1000000).toFixed(1)}M` },
            { key: 'retention', label: 'Retention Rate', min: 60, max: 95, step: 1, suffix: '%' },
          ].map(s => (
            <div key={s.key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{s.label}</span>
                <span className="font-semibold text-gray-900">{s.format ? s.format(sliders[s.key]) : `${sliders[s.key]}${s.suffix || ''}`}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={sliders[s.key]}
                onChange={e => setSliders(prev => ({ ...prev, [s.key]: parseFloat(e.target.value) }))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ accentColor: CLIENT.brand.primary }} />
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
