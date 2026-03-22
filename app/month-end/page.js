'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Link from 'next/link'
import Header from '../Components/header'
import CLIENT from '../../config/client'

const fmt = (n) => {
  if (!n || isNaN(n)) return '$0'
  const num = parseFloat(n)
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(2) + 'M'
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K'
  return '$' + Math.round(num).toLocaleString()
}

// Build MONTHS dynamically from fiscal year config
const FULL_MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
function buildMonths() {
  const fy = CLIENT.getCurrentFY()
  const months = CLIENT.getMonthsForFY(fy)
  return months.map(m => {
    const monthNum = parseInt(m.date.split('-')[1])
    const year = parseInt(m.date.split('-')[0])
    const quarter = CLIENT.quarters[monthNum] || 'Q1'
    return { label: `${FULL_MONTH_NAMES[monthNum - 1]} ${year}`, value: m.date, fy, quarter }
  })
}
const MONTHS = buildMonths()

const AE_REPS = CLIENT.reps.monthEnd.map(r => r.key)
const AE_LABELS = Object.fromEntries(CLIENT.reps.monthEnd.map(r => [r.key, r.label]))

function detectCurrentMonth() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const val = `${y}-${m}-01`
  return MONTHS.find(mo => mo.value === val)?.value || ''
}

export default function MonthEndPage() {
  const [selectedMonth, setSelectedMonth] = useState(detectCurrentMonth)
  const [existing, setExisting] = useState(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  // Company
  const [companyRevenue, setCompanyRevenue] = useState('')
  const [companyDeals, setCompanyDeals] = useState('')
  const [companyQuota, setCompanyQuota] = useState('')

  // AE data: { kyle: { revenue, deals, avgDealSize, daysToClose, quota }, ... }
  const [aeData, setAeData] = useState(
    Object.fromEntries(AE_REPS.map(r => [r, { revenue: '', deals: '', avgDealSize: '', daysToClose: '', quota: '' }]))
  )

  const [notes, setNotes] = useState('')

  const monthObj = MONTHS.find(m => m.value === selectedMonth)

  useEffect(() => {
    if (selectedMonth) loadMonth(selectedMonth)
  }, [selectedMonth])

  const loadMonth = async (monthStart) => {
    // Load existing record
    const { data: rec } = await supabase
      .from('month_end_actuals')
      .select('*')
      .eq('client_id', CLIENT.id)
      .eq('month_start', monthStart)
      .maybeSingle()

    setExisting(rec || null)

    if (rec) {
      setCompanyRevenue(rec.company_revenue ?? '')
      setCompanyDeals(rec.company_deals ?? '')
      setCompanyQuota(rec.company_quota ?? '')
      setNotes(rec.notes ?? '')
      const newAe = {}
      AE_REPS.forEach(r => {
        newAe[r] = {
          revenue: rec[`${r}_revenue`] ?? '',
          deals: rec[`${r}_deals`] ?? '',
          avgDealSize: rec[`${r}_avg_deal_size`] ?? '',
          daysToClose: rec[`${r}_days_to_close`] ?? '',
          quota: '',
        }
      })
      // Still load quotas for display even on existing records
      const { data: quotas } = await supabase.from('quotas').select('rep_name, amount')
        .eq('client_id', CLIENT.id).eq('month_start', monthStart)
      if (quotas) {
        const qMap = Object.fromEntries(quotas.map(q => [q.rep_name, q.amount]))
        setCompanyQuota(prev => rec.company_quota || qMap['Company'] || prev)
        AE_REPS.forEach(r => {
          const repName = AE_LABELS[r]
          if (qMap[repName]) newAe[r].quota = qMap[repName]
        })
      }
      setAeData(newAe)
    } else {
      // Reset form and load quotas
      setCompanyRevenue('')
      setCompanyDeals('')
      setCompanyQuota('')
      setNotes('')
      setAeData(Object.fromEntries(AE_REPS.map(r => [r, { revenue: '', deals: '', avgDealSize: '', daysToClose: '', quota: '' }])))

      const { data: quotas } = await supabase.from('quotas').select('rep_name, amount')
        .eq('client_id', CLIENT.id).eq('month_start', monthStart)
      if (quotas) {
        const qMap = Object.fromEntries(quotas.map(q => [q.rep_name, q.amount]))
        if (qMap['Company']) setCompanyQuota(qMap['Company'])
        setAeData(prev => {
          const updated = { ...prev }
          AE_REPS.forEach(r => {
            const repName = AE_LABELS[r]
            if (qMap[repName]) updated[r] = { ...updated[r], quota: qMap[repName] }
          })
          return updated
        })
      }
    }
  }

  const updateAe = (rep, field, val) => {
    setAeData(prev => ({ ...prev, [rep]: { ...prev[rep], [field]: val } }))
  }

  const attainment = (rev, quota) => {
    if (!rev || !quota || parseFloat(quota) === 0) return null
    return ((parseFloat(rev) / parseFloat(quota)) * 100).toFixed(1)
  }

  const handleSubmit = async () => {
    if (!selectedMonth) { setStatus('Please select a month'); return }
    setSaving(true)
    setStatus('Saving...')

    const mo = MONTHS.find(m => m.value === selectedMonth)

    const payload = {
      client_id: CLIENT.id,
      month_start: selectedMonth,
      fiscal_year: mo?.fy || CLIENT.getCurrentFY(),
      quarter: mo?.quarter || '',
      company_revenue: parseFloat(companyRevenue) || 0,
      company_deals: parseInt(companyDeals) || 0,
      company_quota: parseFloat(companyQuota) || 0,
      kyle_revenue: parseFloat(aeData.kyle.revenue) || 0,
      kyle_deals: parseInt(aeData.kyle.deals) || 0,
      kyle_avg_deal_size: parseFloat(aeData.kyle.avgDealSize) || 0,
      kyle_days_to_close: parseFloat(aeData.kyle.daysToClose) || 0,
      jake_revenue: parseFloat(aeData.jake.revenue) || 0,
      jake_deals: parseInt(aeData.jake.deals) || 0,
      jake_avg_deal_size: parseFloat(aeData.jake.avgDealSize) || 0,
      jake_days_to_close: parseFloat(aeData.jake.daysToClose) || 0,
      kris_revenue: parseFloat(aeData.kris.revenue) || 0,
      kris_deals: parseInt(aeData.kris.deals) || 0,
      kris_avg_deal_size: parseFloat(aeData.kris.avgDealSize) || 0,
      kris_days_to_close: parseFloat(aeData.kris.daysToClose) || 0,
      notes,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('month_end_actuals').upsert(payload, { onConflict: 'client_id,month_start' })

    if (error) {
      setStatus('Error: ' + error.message)
    } else {
      setStatus(existing ? 'Updated successfully!' : 'Saved successfully!')
      setExisting(payload)
    }
    setSaving(false)
  }

  const inputClass = "w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"
  const sectionCard = "bg-white rounded-lg shadow p-6 space-y-4"

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Month End Review" subtitle={`${CLIENT.name} · Final monthly actuals by AE`} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Month Selector */}
        <div className={sectionCard}>
          <label className={labelClass}>Select Month</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={inputClass}>
            <option value="">Choose a month...</option>
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          {monthObj && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
              <p className="font-semibold">Closing: {monthObj.label}</p>
              <p className="text-xs text-blue-600 mt-0.5">{monthObj.fy} · {monthObj.quarter}</p>
            </div>
          )}
          {existing && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              Existing record found — editing will update
            </div>
          )}
        </div>

        {selectedMonth && (<>

          {/* Company Totals */}
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">Company Totals</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Revenue — Closed Won ($)</label>
                <input type="number" value={companyRevenue} onChange={e => setCompanyRevenue(e.target.value)} className={inputClass} placeholder="0" />
                {companyRevenue && <p className="text-xs text-gray-400 mt-1">{fmt(companyRevenue)}</p>}
              </div>
              <div>
                <label className={labelClass}>Deals Closed</label>
                <input type="number" value={companyDeals} onChange={e => setCompanyDeals(e.target.value)} className={inputClass} placeholder="0" />
              </div>
              <div>
                <label className={labelClass}>Monthly Quota ($)</label>
                <input type="number" value={companyQuota} onChange={e => setCompanyQuota(e.target.value)} className={inputClass} placeholder="Auto-filled from quotas" />
                {companyQuota && <p className="text-xs text-gray-400 mt-1">{fmt(companyQuota)}</p>}
              </div>
              <div>
                <label className={labelClass}>Attainment</label>
                <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50 text-sm">
                  {attainment(companyRevenue, companyQuota)
                    ? <span className={`font-semibold ${parseFloat(attainment(companyRevenue, companyQuota)) >= 100 ? 'text-green-700' : parseFloat(attainment(companyRevenue, companyQuota)) >= 80 ? 'text-amber-700' : 'text-red-700'}`}>
                        {attainment(companyRevenue, companyQuota)}%
                      </span>
                    : <span className="text-gray-400">—</span>
                  }
                </div>
              </div>
            </div>
            {companyQuota && companyRevenue && (
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${parseFloat(attainment(companyRevenue, companyQuota)) >= 100 ? 'bg-green-500' : parseFloat(attainment(companyRevenue, companyQuota)) >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(parseFloat(attainment(companyRevenue, companyQuota) || 0), 120)}%` }} />
              </div>
            )}
          </div>

          {/* AE Performance */}
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">AE Performance</h2>
            <div className="space-y-4">
              {AE_REPS.map(rep => {
                const d = aeData[rep]
                const att = attainment(d.revenue, d.quota)
                return (
                  <div key={rep} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-800">{AE_LABELS[rep]}</p>
                      {d.quota && <p className="text-xs text-gray-500">Quota: {fmt(d.quota)}</p>}
                    </div>
                    {att && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full ${parseFloat(att) >= 100 ? 'bg-green-500' : parseFloat(att) >= 80 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(parseFloat(att), 120)}%` }} />
                        </div>
                        <span className={`text-sm font-semibold ${parseFloat(att) >= 100 ? 'text-green-700' : parseFloat(att) >= 80 ? 'text-amber-700' : 'text-red-700'}`}>{att}%</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Revenue ($)</label>
                        <input type="number" value={d.revenue} onChange={e => updateAe(rep, 'revenue', e.target.value)} className={inputClass} placeholder="0" />
                        {d.revenue && <p className="text-xs text-gray-400 mt-0.5">{fmt(d.revenue)}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Deals Closed</label>
                        <input type="number" value={d.deals} onChange={e => updateAe(rep, 'deals', e.target.value)} className={inputClass} placeholder="0" />
                      </div>
                      <div>
                        <label className={labelClass}>Avg Deal Size ($)</label>
                        <input type="number" value={d.avgDealSize} onChange={e => updateAe(rep, 'avgDealSize', e.target.value)} className={inputClass} placeholder="0" />
                        {d.avgDealSize && <p className="text-xs text-gray-400 mt-0.5">{fmt(d.avgDealSize)}</p>}
                      </div>
                      <div>
                        <label className={labelClass}>Avg Days to Close</label>
                        <input type="number" value={d.daysToClose} onChange={e => updateAe(rep, 'daysToClose', e.target.value)} className={inputClass} placeholder="0" step="0.1" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className={sectionCard}>
            <h2 className="font-semibold text-gray-800 border-b pb-2">Month End Commentary</h2>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className={inputClass}
              placeholder="Key observations — what drove results, what carries into next month, patterns to note..." />
          </div>

          {/* Save */}
          <button onClick={handleSubmit} disabled={saving}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium text-lg disabled:opacity-50 shadow-sm hover:shadow-md transition-all">
            {saving ? 'Saving...' : existing ? 'Update Month End Review' : 'Save Month End Review'}
          </button>

          {status && (
            <p className={`text-center text-sm font-medium ${status.includes('success') ? 'text-green-700' : status.includes('Error') ? 'text-red-700' : 'text-gray-600'}`}>
              {status}
            </p>
          )}

        </>)}
      </div>
    </div>
  )
}
