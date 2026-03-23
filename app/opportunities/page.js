'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../Components/header'
import CLIENT from '../../config/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const fmt$ = (n) => n != null ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—'
const TABS = ['Import', 'Lost Analysis']
const CUTOFF = '2024-10-01'

const LOSS_COLORS = {
  'Closed - Lost': '#ef4444',
  'Closed - Not Required': '#f59e0b',
  'Duplicate': '#94a3b8',
}

function dealBand(total) {
  if (total < 25000) return '0-25K'
  if (total < 50000) return '25-50K'
  if (total < 100000) return '50-100K'
  return '100K+'
}

function xlDate(v) {
  if (!v) return null
  if (typeof v === 'string' && v.includes('-')) return v
  const n = parseFloat(v)
  if (isNaN(n) || n < 1000) return null
  return new Date(Math.round((n - 25569) * 86400000)).toISOString().split('T')[0]
}

function monthLabel(d) {
  if (!d) return null
  try { return new Date(d + 'T12:00:00').toLocaleString('default', { month: 'short', year: 'numeric' }) } catch { return null }
}

export default function OpportunitiesPage() {
  const [tab, setTab] = useState('Import')
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState('')
  const [lostData, setLostData] = useState([])
  const [loadingLost, setLoadingLost] = useState(false)
  const fileRef = useRef()

  useEffect(() => { if (tab === 'Lost Analysis') loadLostData() }, [tab])

  // ── Import ──────────────────────────────────────────────

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setStatus('Reading file...')

    try {
      const buf = await file.arrayBuffer()
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(new Uint8Array(buf))

      // Parse shared strings
      const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string') || ''
      const strings = []
      const siMatches = ssXml.match(/<si>[\s\S]*?<\/si>/g) || []
      siMatches.forEach(si => {
        const texts = si.match(/<t[^>]*>([^<]*)<\/t>/g) || []
        strings.push(texts.map(t => t.replace(/<[^>]+>/g, '')).join(''))
      })

      const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string')
      if (!sheetXml) throw new Error('sheet1.xml not found')
      const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []
      setStatus(`Found ${rowMatches.length} rows, parsing...`)

      const getCell = (cellXml) => {
        if (cellXml.includes('inlineStr')) {
          const m = cellXml.match(/<t[^>]*>([^<]*)<\/t>/)
          return m ? m[1] : null
        }
        const v = cellXml.match(/<v>([^<]*)<\/v>/)
        if (!v) return null
        if (cellXml.includes('t="s"')) return strings[parseInt(v[1])] ?? null
        return v[1]
      }

      // Load account ownership for join
      const { data: owners } = await supabase.from('account_ownership').select('account_name, ae_name, salesperson_code')
      const ownerMap = {}
      if (owners) owners.forEach(o => { ownerMap[o.account_name?.toLowerCase()] = o })

      const rows = []
      rowMatches.forEach((rowXml, rowIdx) => {
        if (rowIdx === 0) return // skip header
        const cells = {}
        const matches = [...rowXml.matchAll(/<c{1,2} r="([^"]+)"([^>]*)>([\s\S]*?)<\/c{1,2}>/g)]
        for (const m of matches) {
          const col = m[1].replace(/[0-9]/g, '').toUpperCase()
          cells[col] = getCell(m[0])
        }

        const createdOn = xlDate(cells['C'])
        if (createdOn && createdOn < CUTOFF) return // filter pre-Oct 2024

        const total = parseFloat(cells['F']) || 0
        const currency = (cells['K'] || '').trim().toUpperCase()
        const totalAud = currency === 'USD' ? total * 1.30 : total
        const accountName = (cells['B'] || '').trim()
        const owner = ownerMap[accountName.toLowerCase()]

        rows.push({
          client_id: CLIENT.id,
          opportunity_id: (cells['R'] || '').trim(),
          subject: (cells['L'] || '').trim(),
          account_name: accountName,
          owner: (cells['D'] || '').trim(),
          ae_name: owner?.ae_name || null,
          salesperson_code: owner?.salesperson_code || null,
          stage: (cells['G'] || '').trim(),
          status: (cells['I'] || '').trim(),
          class_id: (cells['H'] || '').trim(),
          probability: parseFloat(cells['S']) || 0,
          total,
          currency: currency || 'AUD',
          total_aud: totalAud,
          deal_band: dealBand(totalAud),
          created_on: createdOn,
          estimated_close_date: xlDate(cells['E']),
          actual_close_date: xlDate(cells['A']),
        })
      })

      if (!rows.length) { setStatus('No rows found after filtering'); setImporting(false); return }
      setStatus(`Upserting ${rows.length} opportunities...`)

      // Upsert in batches
      let upserted = 0
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500)
        const { error } = await supabase.from('opportunities').upsert(batch, { onConflict: 'client_id,opportunity_id' })
        if (error) throw error
        upserted += batch.length
        setStatus(`Upserted ${upserted} of ${rows.length}...`)
      }

      // Summary
      const stages = {}
      rows.forEach(r => { stages[r.stage] = (stages[r.stage] || 0) + 1 })
      const bands = {}
      rows.forEach(r => { bands[r.deal_band] = (bands[r.deal_band] || 0) + 1 })
      const totalValue = rows.reduce((s, r) => s + r.total_aud, 0)

      setStatus(`✅ Imported ${rows.length} opportunities · ${fmt$(totalValue)} total value · ${Object.keys(stages).length} stages`)
    } catch (err) {
      setStatus(`❌ ${err.message}`)
      console.error(err)
    }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Lost Analysis ───────────────────────────────────────

  const loadLostData = async () => {
    setLoadingLost(true)
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('client_id', CLIENT.id)
      .or('stage.ilike.Closed - Lost%,stage.ilike.Closed - Not Required%,stage.eq.Duplicate')
      .gte('actual_close_date', CUTOFF)
      .order('actual_close_date', { ascending: true })

    if (error) { console.error(error); setLoadingLost(false); return }
    setLostData(data || [])
    setLoadingLost(false)
  }

  // Group lost deals by month and reason
  const lostByMonth = {}
  const allReasons = new Set()
  lostData.forEach(d => {
    const month = monthLabel(d.actual_close_date) || 'Unknown'
    const reason = d.stage?.startsWith('Closed - Lost') ? 'Closed - Lost'
      : d.stage?.startsWith('Closed - Not Required') ? 'Closed - Not Required'
      : d.stage === 'Duplicate' ? 'Duplicate' : d.stage || 'Unknown'
    allReasons.add(reason)
    if (!lostByMonth[month]) lostByMonth[month] = { month, total: 0, count: 0, reasons: {} }
    if (!lostByMonth[month].reasons[reason]) lostByMonth[month].reasons[reason] = { count: 0, value: 0 }
    lostByMonth[month].reasons[reason].count++
    lostByMonth[month].reasons[reason].value += d.total_aud || 0
    lostByMonth[month].total += d.total_aud || 0
    lostByMonth[month].count++
  })
  const monthOrder = Object.values(lostByMonth).sort((a, b) => {
    const da = new Date(a.month + ' 1'), db = new Date(b.month + ' 1')
    return da - db
  })

  // Chart data
  const reasons = [...allReasons].sort()
  const chartData = monthOrder.map(m => {
    const row = { month: m.month }
    reasons.forEach(r => { row[r] = m.reasons[r]?.value || 0 })
    return row
  })

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.filter(p => p.value > 0).map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {fmt$(p.value)}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Opportunities" subtitle={`${CLIENT.name} · Import & lost deal analysis`} />

      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2 mb-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
              style={tab === t ? { background: CLIENT.brand.secondary } : {}}>
              {t}
            </button>
          ))}
        </div>

        {/* ── IMPORT TAB ── */}
        {tab === 'Import' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 text-lg mb-1">Import Opportunities</h3>
              <p className="text-sm text-gray-500 mb-4">Upload the {CLIENT.crm.name} opportunities export (.xlsx). Records before Oct 2024 are filtered out. USD deals are converted at 1.30x.</p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                <p className="font-semibold mb-1">Column mapping:</p>
                <p className="text-xs text-blue-700">A=Close Date, B=Account, C=Created, D=Owner, E=Est Close, F=Total, G=Stage, H=Class, I=Status, K=Currency, L=Subject, R=Opp ID, S=Probability</p>
              </div>

              <div onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-gray-400 transition-colors">
                <p className="text-4xl mb-3">📂</p>
                <p className="font-medium text-gray-700 mb-1">Click to select Excel file</p>
                <p className="text-xs text-gray-400">.xlsx · {CLIENT.crm.name} opportunities export</p>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              </div>

              {importing && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-blue-700">{status}</p>
                </div>
              )}
              {!importing && status && (
                <div className={`mt-4 rounded-lg px-4 py-3 text-sm ${status.startsWith('✅') ? 'bg-green-50 border border-green-200 text-green-700' : status.startsWith('❌') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
                  {status}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LOST ANALYSIS TAB ── */}
        {tab === 'Lost Analysis' && (
          <div className="space-y-6">
            {loadingLost ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <p className="text-gray-400">Loading lost deal data...</p>
              </div>
            ) : lostData.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <p className="text-gray-600 font-medium mb-2">No lost deals found</p>
                <p className="text-gray-400 text-sm">Import opportunities first, or no deals match the lost/duplicate criteria after Oct 2024.</p>
              </div>
            ) : (<>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Lost Deals</p>
                  <p className="text-2xl font-bold text-gray-900">{lostData.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Lost Value</p>
                  <p className="text-2xl font-bold" style={{ color: CLIENT.brand.primary }}>{fmt$(lostData.reduce((s, d) => s + (d.total_aud || 0), 0))}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Avg Lost Deal Size</p>
                  <p className="text-2xl font-bold text-gray-900">{fmt$(lostData.reduce((s, d) => s + (d.total_aud || 0), 0) / lostData.length)}</p>
                </div>
              </div>

              {/* Bar Chart — Lost Value by Month */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Lost Deal Value by Month</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {reasons.map(r => (
                      <Bar key={r} dataKey={r} name={r} stackId="a"
                        fill={LOSS_COLORS[r] || '#6b7280'}
                        radius={reasons.indexOf(r) === reasons.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Detail Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100" style={{ background: CLIENT.brand.secondary }}>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">Lost Deals by Month & Reason</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-5 py-3">Month</th>
                        <th className="text-left px-4 py-3">Loss Reason</th>
                        <th className="text-right px-4 py-3"># Deals</th>
                        <th className="text-right px-5 py-3">Value (AUD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthOrder.map(m => (<>
                        {Object.entries(m.reasons).sort((a, b) => b[1].value - a[1].value).map(([reason, data], ri) => (
                          <tr key={`${m.month}-${reason}`} className="hover:bg-gray-50">
                            {ri === 0 && (
                              <td className="px-5 py-3 font-semibold text-gray-800" rowSpan={Object.keys(m.reasons).length + 1}>
                                {m.month}
                              </td>
                            )}
                            <td className="px-4 py-3 text-gray-700">
                              <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: LOSS_COLORS[reason] || '#6b7280' }} />
                              {reason}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600">{data.count}</td>
                            <td className="px-5 py-3 text-right font-medium text-gray-800">{fmt$(data.value)}</td>
                          </tr>
                        ))}
                        <tr key={`${m.month}-total`} className="bg-gray-50 border-t border-gray-200">
                          <td className="px-4 py-2 text-xs font-bold text-gray-600 uppercase">Month Total</td>
                          <td className="px-4 py-2 text-right font-bold text-gray-700">{m.count}</td>
                          <td className="px-5 py-2 text-right font-bold text-gray-900">{fmt$(m.total)}</td>
                        </tr>
                      </>))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>)}
          </div>
        )}
      </div>
    </div>
  )
}
