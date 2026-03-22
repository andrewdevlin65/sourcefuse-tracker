'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../Components/header'
import CLIENT from '../../config/client'
import { calculateRevenueModel, DEFAULT_ASSUMPTIONS, ASSUMPTION_METADATA } from '../../lib/revenueModel'

const fmt$ = (n) => n != null ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'
const fmtPct = (n) => n != null ? (n * 100).toFixed(1) + '%' : '—'
const fmtNum = (n) => n != null ? Math.round(n).toLocaleString() : '—'
const fmtVal = (v, format) => format === 'currency' ? fmt$(v) : format === 'percent' ? fmtPct(v) : fmtNum(v)

const SECTIONS = ['Revenue Targets', 'Rep Economics', 'Three-Stream Revenue', 'Rep Productivity']

export default function AssumptionsPage() {
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS })
  const [dbValues, setDbValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [openSections, setOpenSections] = useState(SECTIONS.reduce((a, s) => ({ ...a, [s]: true }), {}))
  const [modelResult, setModelResult] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [lastCalc, setLastCalc] = useState(null)

  useEffect(() => { loadAssumptions() }, [])

  const loadAssumptions = async () => {
    setLoading(true)
    const { data } = await supabase.from('sf_assumptions').select('*').eq('client_id', CLIENT.id)
    if (data?.length) {
      const merged = { ...DEFAULT_ASSUMPTIONS }
      const dbMap = {}
      data.forEach(row => {
        dbMap[row.assumption_key] = row
        if (row.value_y1 != null) merged[row.assumption_key] = row.value_y1
      })
      setAssumptions(merged)
      setDbValues(dbMap)
    }
    setLoading(false)
  }

  const saveAssumption = async (key, value) => {
    setSaving(key)
    const numVal = parseFloat(value)
    if (isNaN(numVal)) { setSaving(null); return }
    setAssumptions(prev => ({ ...prev, [key]: numVal }))
    await supabase.from('sf_assumptions').upsert({
      client_id: CLIENT.id,
      assumption_key: key,
      value_y1: numVal,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'client_id,assumption_key' })
    setSaving(null)
  }

  const recalculate = () => {
    const result = calculateRevenueModel(assumptions)
    setModelResult(result)
    setLastCalc(new Date())
    setShowModal(true)
  }

  const toggleSection = (s) => setOpenSections(prev => ({ ...prev, [s]: !prev[s] }))

  const kellyInputs = ASSUMPTION_METADATA.filter(m => m.is_kelly_input)
  const statusDot = (status) => {
    if (!status) return null
    const colors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' }
    return <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`} />
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-gray-400">Loading assumptions...</p></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Revenue Assumptions" subtitle="35 variables driving the $55M model — edit any value to see the impact" />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Kelly's Key Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kellyInputs.map(meta => {
            const val = assumptions[meta.key]
            const dbRow = dbValues[meta.key]
            return (
              <div key={meta.key} className="bg-white rounded-xl border-2 p-5 shadow-sm" style={{ borderColor: CLIENT.brand.primary }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: CLIENT.brand.primary }}>Kelly Input</span>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{meta.label}</p>
                <p className="text-xs text-gray-400 mb-3">{meta.notes}</p>
                <div className="flex items-center gap-3">
                  <input type="text" defaultValue={meta.format === 'percent' ? (val * 100).toFixed(1) : val}
                    onBlur={e => {
                      let v = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''))
                      if (meta.format === 'percent') v = v / 100
                      saveAssumption(meta.key, v)
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                    className="w-32 border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500" />
                  <span className="text-sm text-gray-400">{meta.format === 'percent' ? '%' : meta.format === 'currency' ? 'USD' : ''}</span>
                </div>
                {dbRow?.actual_value != null && (
                  <p className="text-xs text-gray-500 mt-2">Actual: <span className="font-semibold">{fmtVal(dbRow.actual_value, meta.format)}</span></p>
                )}
              </div>
            )
          })}
        </div>

        {/* Collapsible Sections */}
        {SECTIONS.map(section => {
          const items = ASSUMPTION_METADATA.filter(m => m.section === section && !m.is_kelly_input)
          if (!items.length) return null
          return (
            <div key={section} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button onClick={() => toggleSection(section)} className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50">
                <h3 className="font-semibold text-gray-800">{section}</h3>
                <span className="text-gray-400 text-lg">{openSections[section] ? '−' : '+'}</span>
              </button>
              {openSections[section] && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-2">Assumption</th>
                        <th className="text-right px-3 py-2 w-28">Value</th>
                        <th className="text-right px-3 py-2 w-28">Actual</th>
                        <th className="text-center px-3 py-2 w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map(meta => {
                        const val = assumptions[meta.key]
                        const dbRow = dbValues[meta.key]
                        const actual = dbRow?.actual_value
                        const variance = actual != null && val != null ? actual - val : null
                        const status = actual != null ? (actual >= val ? 'green' : actual >= val * 0.85 ? 'yellow' : 'red') : null
                        return (
                          <tr key={meta.key} className="hover:bg-gray-50">
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-800">{meta.label}</p>
                              <p className="text-xs text-gray-400">{meta.notes}</p>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <input type="text"
                                defaultValue={meta.format === 'percent' ? (val * 100).toFixed(1) : meta.format === 'currency' ? Math.round(val).toLocaleString() : val}
                                onBlur={e => {
                                  let v = parseFloat(e.target.value.replace(/[^0-9.-]/g, ''))
                                  if (meta.format === 'percent') v = v / 100
                                  saveAssumption(meta.key, v)
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                                className="w-24 text-right border border-gray-200 rounded px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-500" />
                            </td>
                            <td className="px-3 py-3 text-right text-gray-500 text-xs">
                              {actual != null ? fmtVal(actual, meta.format) : '—'}
                            </td>
                            <td className="px-3 py-3 text-center">{statusDot(status)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}

        {/* Recalculate Button */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div>
            <p className="text-sm text-gray-500">Model last recalculated</p>
            <p className="text-xs text-gray-400">{lastCalc ? lastCalc.toLocaleString() : 'Not yet calculated'}</p>
          </div>
          <button onClick={recalculate}
            className="text-white px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all"
            style={{ background: CLIENT.brand.primary }}>
            Recalculate Model
          </button>
        </div>

        {/* Modal */}
        {showModal && modelResult && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-gray-900">Model Results</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">$55M Target Date</p>
                  <p className="text-lg font-bold" style={{ color: CLIENT.brand.primary }}>{modelResult.projected_55m_quarter}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">On Track</p>
                  <p className={`text-lg font-bold ${modelResult.projected_55m_on_track ? 'text-green-600' : 'text-red-600'}`}>
                    {modelResult.projected_55m_on_track ? 'Yes' : 'Behind'}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Y1 Organic</p>
                  <p className="text-lg font-bold text-gray-900">{fmt$(modelResult.total_organic.y1)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Y3 Organic</p>
                  <p className="text-lg font-bold text-gray-900">{fmt$(modelResult.total_organic.y3)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Reps Needed</p>
                  <p className="text-lg font-bold text-gray-900">{modelResult.reps_needed}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">3yr ROI</p>
                  <p className="text-lg font-bold text-gray-900">{modelResult.revenue_per_dollar_invested.toFixed(1)}x</p>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>Stream 1 (Recurring): {fmt$(modelResult.stream1.y1)} → {fmt$(modelResult.stream1.y3)}</p>
                <p>Stream 2 (Expansion): {fmt$(modelResult.stream2.y1)} → {fmt$(modelResult.stream2.y3)}</p>
                <p>Stream 3 (New Logos): {fmt$(modelResult.stream3.y1)} → {fmt$(modelResult.stream3.y3)}</p>
                <p className="font-semibold pt-1">Gap at Y3: {fmt$(modelResult.gap.y3)}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-full py-2.5 bg-gray-100 rounded-lg text-gray-700 font-medium hover:bg-gray-200">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
