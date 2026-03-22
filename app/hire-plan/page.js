'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../Components/header'
import CLIENT from '../../config/client'
import { calculateRevenueModel, DEFAULT_ASSUMPTIONS } from '../../lib/revenueModel'

const fmt$ = (n) => n != null ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'

const QUARTERS = ['Q1 Y1','Q2 Y1','Q3 Y1','Q4 Y1','Q1 Y2','Q2 Y2','Q3 Y2','Q4 Y2','Q1 Y3','Q2 Y3','Q3 Y3','Q4 Y3']

const HIRE_TIMELINE = [
  { name: 'Andrew Devlin', role: 'Fractional CRO', status: Array(12).fill('active') },
  { name: 'Joe Garrison', role: 'Fractional Sales Dir', status: Array(12).fill('active') },
  ...(() => {
    const reps = CLIENT.hirePlan?.reps || []
    return reps.map(rep => {
      const hireQ = rep.hireQuarter
      const qMatch = hireQ.match(/Q(\d)\s*Y(\d)/)
      if (!qMatch) return { name: rep.name, role: 'AE', status: Array(12).fill('planned') }
      const hireIdx = (parseInt(qMatch[2]) - 1) * 4 + parseInt(qMatch[1]) - 1
      return {
        name: rep.name,
        role: 'AE',
        status: QUARTERS.map((_, i) => {
          if (i < hireIdx) return 'planned'
          if (i === hireIdx) return 'hire'
          if (i <= hireIdx + 2) return 'ramp'
          return 'active'
        }),
      }
    })
  })(),
]

const ROI_GATES = [
  {
    id: 'gate1',
    title: 'Gate 1: Foundation',
    quarter: 'Q2 Y1',
    defaultStatus: 'completed',
    criteria: [
      { id: 'g1c1', label: 'CRM configured & reps onboarded', description: 'HubSpot pipeline stages, deal fields, and reporting set up' },
      { id: 'g1c2', label: 'ICP & target account list defined', description: '100+ target accounts identified and assigned' },
      { id: 'g1c3', label: 'First rep generating pipeline', description: 'Alex Chen has 5+ qualified opportunities' },
      { id: 'g1c4', label: 'Weekly reporting cadence established', description: 'Revenue tracker live and reviewed weekly with Kelly' },
    ],
  },
  {
    id: 'gate2',
    title: 'Gate 2: Traction',
    quarter: 'Q4 Y1',
    defaultStatus: 'active',
    criteria: [
      { id: 'g2c1', label: 'First rep at $500K+ pipeline', description: 'Qualified pipeline value for Rep 1' },
      { id: 'g2c2', label: '3+ new logos closed', description: 'Net new customer wins from outbound motion' },
      { id: 'g2c3', label: 'Second rep hired and ramping', description: 'Marcus Taylor onboarded and in ramp quarter' },
      { id: 'g2c4', label: 'Expansion playbook showing results', description: 'At least 2 account expansions completed' },
    ],
  },
  {
    id: 'gate3',
    title: 'Gate 3: Scale',
    quarter: 'Q2 Y2',
    defaultStatus: 'pending',
    criteria: [
      { id: 'g3c1', label: 'Both reps at or above quota', description: 'Combined attainment > 80% of plan' },
      { id: 'g3c2', label: '$35M run rate achieved', description: 'Annualized revenue on track for Y2 target' },
      { id: 'g3c3', label: 'Third rep hire approved', description: 'ROI from first 2 reps justifies expansion' },
      { id: 'g3c4', label: 'Retention rate > 75%', description: 'Gross dollar retention meeting model assumptions' },
    ],
  },
]

const statusColors = {
  planned: 'bg-gray-100 text-gray-400',
  hire: 'bg-red-500 text-white',
  ramp: 'bg-amber-400 text-amber-900',
  active: 'bg-green-500 text-white',
}
const statusLabels = { planned: '', hire: 'HIRE', ramp: 'RAMP', active: '' }

export default function HirePlanPage() {
  const [assumptions, setAssumptions] = useState({ ...DEFAULT_ASSUMPTIONS })
  const [gates, setGates] = useState(ROI_GATES.map(g => ({ ...g, checks: g.criteria.map(() => g.defaultStatus === 'completed'), notes: '' })))
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: aRows }, { data: gateRows }] = await Promise.all([
      supabase.from('sf_assumptions').select('*').eq('client_id', CLIENT.id),
      supabase.from('roi_gates').select('*').eq('client_id', CLIENT.id),
    ])
    if (aRows?.length) {
      const merged = { ...DEFAULT_ASSUMPTIONS }
      aRows.forEach(r => { if (r.value_y1 != null) merged[r.assumption_key] = r.value_y1 })
      setAssumptions(merged)
    }
    if (gateRows?.length) {
      setGates(prev => prev.map(g => {
        const dbGate = gateRows.find(r => r.gate_id === g.id)
        if (!dbGate) return g
        return { ...g, checks: dbGate.checks || g.checks, notes: dbGate.notes || '' }
      }))
    }
    setLoading(false)
  }

  const model = useMemo(() => calculateRevenueModel(assumptions), [assumptions])

  const toggleCheck = (gateIdx, checkIdx) => {
    setGates(prev => prev.map((g, gi) => gi === gateIdx ? { ...g, checks: g.checks.map((c, ci) => ci === checkIdx ? !c : c) } : g))
  }

  const hireCount = CLIENT.hirePlan?.reps?.length || 4
  const totalRepCost3yr = hireCount * assumptions.rep_cost * 3
  const totalFractional3yr = assumptions.fractional_monthly * 12 * 3
  const totalInvestment = totalRepCost3yr + totalFractional3yr
  const roiMultiple = totalInvestment > 0 ? (model.total_organic.y1 + model.total_organic.y2 + model.total_organic.y3) / totalInvestment : 0
  const paybackMonths = model.total_organic.y1 > 0 ? Math.ceil(totalInvestment / (model.total_organic.y1 / 12)) : 36

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-gray-400">Loading hire plan...</p></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Hire Plan & ROI Gates" subtitle={`${CLIENT.name} · Rep timeline & gate scorecards`} />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* SECTION A — Hire Timeline */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100" style={{ background: CLIENT.brand.secondary }}>
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">Hire Timeline — 3 Year Plan</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 font-semibold text-gray-700 sticky left-0 bg-gray-50 min-w-40">Person</th>
                  {QUARTERS.map(q => <th key={q} className="text-center px-2 py-2 font-medium text-gray-500 min-w-16">{q}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {HIRE_TIMELINE.map((person, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5 sticky left-0 bg-white">
                      <p className="font-semibold text-gray-800">{person.name}</p>
                      <p className="text-gray-400">{person.role}</p>
                    </td>
                    {person.status.map((s, qi) => (
                      <td key={qi} className="px-1 py-2.5 text-center">
                        <div className={`rounded-md px-1 py-1.5 text-[10px] font-bold ${statusColors[s]}`}>
                          {statusLabels[s] || (s === 'active' ? '●' : '')}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-100 flex gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> HIRE</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> RAMP</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> ACTIVE</span>
          </div>
        </div>

        {/* SECTION B — ROI Gate Scorecards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {gates.map((gate, gi) => {
            const allChecked = gate.checks.every(Boolean)
            const anyChecked = gate.checks.some(Boolean)
            const statusBadge = allChecked ? { bg: 'bg-green-100', text: 'text-green-700', label: 'Completed' }
              : anyChecked ? { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Active' }
              : { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Pending' }
            return (
              <div key={gate.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-gray-800">{gate.title}</h4>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusBadge.bg} ${statusBadge.text}`}>{statusBadge.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">Target: {gate.quarter}</p>
                </div>
                <div className="p-4 space-y-3">
                  {gate.criteria.map((c, ci) => (
                    <label key={c.id} className="flex items-start gap-3 cursor-pointer group">
                      <input type="checkbox" checked={gate.checks[ci]} onChange={() => toggleCheck(gi, ci)}
                        className="mt-0.5 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                      <div>
                        <p className={`text-sm font-medium ${gate.checks[ci] ? 'text-green-700 line-through' : 'text-gray-800'}`}>{c.label}</p>
                        <p className="text-xs text-gray-400">{c.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* SECTION C — ROI Summary */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100" style={{ background: CLIENT.brand.secondary }}>
            <h3 className="font-bold text-white text-sm uppercase tracking-wide">ROI Summary — 3 Year Investment</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-100">
            <div className="p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Total Investment</p>
              <p className="text-xl font-bold text-gray-900">{fmt$(totalInvestment)}</p>
              <p className="text-xs text-gray-400 mt-1">Reps: {fmt$(totalRepCost3yr)} + Fractional: {fmt$(totalFractional3yr)}</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Revenue Generated</p>
              <p className="text-xl font-bold text-green-600">{fmt$(model.total_organic.y1 + model.total_organic.y2 + model.total_organic.y3)}</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">ROI Multiple</p>
              <p className="text-xl font-bold" style={{ color: CLIENT.brand.primary }}>{roiMultiple.toFixed(1)}x</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs text-gray-500 mb-1">Payback Period</p>
              <p className="text-xl font-bold text-gray-900">{paybackMonths} months</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
