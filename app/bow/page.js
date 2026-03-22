'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../Components/header'
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from 'recharts'
import CLIENT from '../../config/client'

const fmt = (n) => {
  if (!n || isNaN(n)) return '$0'
  const num = parseFloat(n)
  if (num >= 1000000) return '$' + (num/1000000).toFixed(2) + 'M'
  if (num >= 1000) return '$' + Math.round(num/1000) + 'K'
  return '$' + Math.round(num).toLocaleString()
}
const fmtFull = (n) => {
  if (!n || isNaN(n)) return '$0'
  return '$' + Math.round(parseFloat(n)).toLocaleString()
}
const xlDate = (v) => {
  if (!v) return null
  if (typeof v === 'string' && v.includes('-')) return v
  const n = parseFloat(v)
  if (isNaN(n) || n < 1000) return null
  return new Date(Math.round((n-25569)*86400000)).toISOString().split('T')[0]
}
const mLabel = (d) => {
  if (!d) return null
  try { return new Date(d+'T12:00:00').toLocaleString('default',{month:'short',year:'numeric'}) } catch { return null }
}
const MONTH_SORT = ['Sep 2025','Oct 2025','Nov 2025','Dec 2025','Jan 2026','Feb 2026','Mar 2026','Apr 2026','May 2026','Jun 2026','Jul 2026','Aug 2026']
const TABS = ['Dashboard','Prospecting','Proposal','Negotiation','By Customer']

export default function BowWave() {
  const [orders, setOrders] = useState([])
  const [snaps, setSnaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Dashboard')
  const [importing, setImporting] = useState(false)
  const [status, setStatus] = useState('')
  const [selDate, setSelDate] = useState(null)
  const [notes, setNotes] = useState('')
  const [editNotes, setEditNotes] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  const fetchData = async () => {
    // Fetch bow_orders in batches of 1000 (Supabase server limit)
    let allOrders = []
    let from = 0
    const batchSize = 1000
    while (true) {
      const { data, error } = await supabase.from('bow_orders').select('*').eq('client_id',CLIENT.id).order('import_date',{ascending:false}).range(from, from+batchSize-1)
      if (error || !data || data.length === 0) break
      allOrders = [...allOrders, ...data]
      if (data.length < batchSize) break
      from += batchSize
    }
    const { data: s } = await supabase.from('bow_snapshots').select('*').eq('client_id',CLIENT.id).order('import_date',{ascending:false})
    setOrders(allOrders)
    setSnaps(s||[])
    if (s?.length) { setSelDate(s[0].import_date); setNotes(s[0].notes||'') }
    // Fetch last updated from ingest_log
    const { data: ingestRow } = await supabase.from('ingest_log').select('report_generated_at').eq('client_id',CLIENT.ingestId).order('report_generated_at',{ascending:false}).limit(1).maybeSingle()
    if (ingestRow?.report_generated_at) setLastUpdated(ingestRow.report_generated_at)
  }

  const load = async () => {
    setLoading(true)
    await fetchData()
    setLoading(false)
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setStatus('Reading file...')
    try {
      const buf = await file.arrayBuffer()
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(new Uint8Array(buf))
      setStatus('Parsing XML...')
      const ssXml = await zip.file('xl/sharedStrings.xml')?.async('string') || ''
      const strings = []
      const siMatches = ssXml.match(/<si>[\s\S]*?<\/si>/g) || []
      siMatches.forEach(si => {
        const texts = si.match(/<t[^>]*>([^<]*)<\/t>/g) || []
        strings.push(texts.map(t => t.replace(/<[^>]+>/g,'')).join(''))
      })
      const sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string')
      if (!sheetXml) throw new Error('sheet1.xml not found')
      const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []
      setStatus(`Found ${rowMatches.length} rows, processing...`)
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
      // Parse date from filename (e.g. Invoiced_Supplied_Unsupplied_20260321.xlsx)
      const dateMatch = file.name.match(/(\d{8})/)
      let today
      if (dateMatch) {
        const d = dateMatch[1]
        today = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
      } else {
        const now = new Date()
        today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
      }
      const imported = []
      let lastA='', lastB='', lastE=''
      rowMatches.forEach((rowXml, rowIdx) => {
        if (rowIdx === 0) return
        const cells = {}
        const matches = [...rowXml.matchAll(/<c{1,2} r="([^"]+)"([^>]*)>([\s\S]*?)<\/c{1,2}>/g)]
        for (const m of matches) {
          const col = m[1].replace(/[0-9]/g,'').toUpperCase()
          cells[col] = getCell(m[0])
        }
        if (cells['A']) lastA = cells['A']
        if (cells['B']) lastB = cells['B']
        if (cells['E']) lastE = cells['E']
        if (!cells['N'] && !cells['O']) return
        const amt = parseFloat(cells['N']) || 0
        const invAmt = parseFloat(cells['O']) || 0
        const qtyOnShip = parseFloat(cells['Y']) || 0
        const unshippedQty = parseFloat(cells['Z']) || 0
        const orderDate = xlDate(cells['C'])
        const requestedOn = xlDate(cells['T'])
        const shipDate = xlDate(cells['S'])
        let category = 'invoiced'
        if (invAmt === 0 && qtyOnShip === 0 && unshippedQty > 0) category = 'unsupplied'
        else if (qtyOnShip > 0 && invAmt === 0) category = 'sni'
        imported.push({
          client_id:CLIENT.id,
          order_nbr: lastE||('ROW-'+rowIdx),
          order_date: orderDate,
          requested_on: requestedOn,
          customer_name: lastB||'',
          order_total_aud: amt,
          shipment_nbr: qtyOnShip>0?'shipped':null,
          shipment_date: shipDate,
          status: category,
          invoice_nbr: invAmt>0?'invoiced':null,
          invoice_date: invAmt>0?requestedOn:null,
          invoice_total_aud: invAmt,
          unbilled_qty: 0,
          unshipped_qty: unshippedQty,
          import_date: today,
          month_label: mLabel(requestedOn||orderDate)
        })
      })
      if (!imported.length) { setStatus('No rows found'); setImporting(false); return }
      setStatus(`Saving ${imported.length} rows...`)
      await supabase.from('bow_orders').delete().eq('client_id',CLIENT.id).eq('import_date',today)
      for (let i = 0; i < imported.length; i += 500) {
        const { error } = await supabase.from('bow_orders').insert(imported.slice(i,i+500))
        if (error) throw error
      }
      const unsup = imported.filter(r=>r.status==='unsupplied')
      const sni = imported.filter(r=>r.status==='sni')
      const inv = imported.filter(r=>r.status==='invoiced')
      await supabase.from('bow_snapshots').upsert({
        client_id:CLIENT.id, import_date:today, total_orders:imported.length,
        total_unsupplied: unsup.reduce((s,r)=>s+r.order_total_aud,0),
        total_supplied_not_invoiced: sni.reduce((s,r)=>s+r.order_total_aud,0),
        total_invoiced: inv.reduce((s,r)=>s+r.invoice_total_aud,0),
        notes: notes
      },{ onConflict:'client_id,import_date' })
      setStatus(`✅ Imported ${imported.length} rows! (${unsup.length} unsupplied, ${sni.length} SNI, ${inv.length} invoiced)`)
      await fetchData()
      setTab('Dashboard')
    } catch(err) { setStatus('❌ '+err.message); console.error(err) }
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const saveNotes = async () => {
    if (!selDate) return
    await supabase.from('bow_snapshots').update({notes}).eq('client_id',CLIENT.id).eq('import_date',selDate)
    setEditNotes(false)
  }

  const snap = selDate ? orders.filter(o=>o.import_date===selDate) : []
  const unsupplied = snap.filter(o=>o.status==='unsupplied')
  const sni = snap.filter(o=>o.status==='sni')
  const invoiced = snap.filter(o=>o.status==='invoiced')
  const currentMonth = mLabel(new Date().toISOString().split('T')[0])
  const tU = unsupplied.reduce((s,o)=>s+(o.order_total_aud||0),0)
  const tS = sni.reduce((s,o)=>s+(o.order_total_aud||0),0)
  const tI = invoiced.filter(o=>o.month_label===currentMonth).reduce((s,o)=>s+(o.invoice_total_aud||0),0)
  const totalPipeline = tU+tS+tI
  const uniqueCustomers = new Set(snap.map(o=>o.customer_name)).size

  const aggByOrder = (lines) => {
    const m = {}
    lines.forEach(l => {
      if (!m[l.order_nbr]) m[l.order_nbr] = {...l, order_total_aud:0, invoice_total_aud:0}
      m[l.order_nbr].order_total_aud += l.order_total_aud||0
      m[l.order_nbr].invoice_total_aud += l.invoice_total_aud||0
    })
    return Object.values(m).sort((a,b)=>b.order_total_aud-a.order_total_aud)
  }

  // Pipeline chart: current month 3 bars + forward months by due date
  const chartData = []
  // Current month: 3 separate bars (Negotiation, Proposal, Prospecting)
  const curInvoiced = invoiced.filter(o=>o.month_label===currentMonth).reduce((s,o)=>s+(o.invoice_total_aud||0),0)
  const curSNI = sni.filter(o=>o.month_label===currentMonth).reduce((s,o)=>s+(o.order_total_aud||0),0)
  const curUnsupplied = unsupplied.filter(o=>o.month_label===currentMonth).reduce((s,o)=>s+(o.order_total_aud||0),0)
  chartData.push({month:`Negotiation\n${currentMonth}`, invoiced:curInvoiced, sni:0, unsupplied:0, pipeline:curInvoiced})
  chartData.push({month:`Proposal\n${currentMonth}`, invoiced:0, sni:curSNI, unsupplied:0, pipeline:curInvoiced+curSNI})
  chartData.push({month:`Prospecting\n${currentMonth}`, invoiced:0, sni:0, unsupplied:curUnsupplied, pipeline:curInvoiced+curSNI+curUnsupplied})
  // Forward months: unsupplied orders grouped by requested_on month
  const fwdMonths = {}
  unsupplied.filter(o=>o.month_label && o.month_label!==currentMonth).forEach(o=>{
    const m=o.month_label||'?'
    if(!fwdMonths[m]) fwdMonths[m]=0
    fwdMonths[m]+=o.order_total_aud||0
  })
  let cum = curInvoiced+curSNI+curUnsupplied
  const sortedFwd = Object.entries(fwdMonths)
    .sort((a,b)=>(MONTH_SORT.indexOf(a[0])>-1?MONTH_SORT.indexOf(a[0]):99)-(MONTH_SORT.indexOf(b[0])>-1?MONTH_SORT.indexOf(b[0]):99))
  sortedFwd.forEach(([m,v])=>{
    cum+=v
    chartData.push({month:m, invoiced:0, sni:0, unsupplied:v, pipeline:cum})
  })
  const monthData = chartData
  // Keep byMonth for the table
  const byMonth = {}
  snap.forEach(o=>{
    const m=o.month_label||'?'
    if(!byMonth[m]) byMonth[m]={month:m,invoiced:0,sni:0,unsupplied:0}
    if(o.status==='invoiced') byMonth[m].invoiced+=o.invoice_total_aud||0
    if(o.status==='sni') byMonth[m].sni+=o.order_total_aud||0
    if(o.status==='unsupplied') byMonth[m].unsupplied+=o.order_total_aud||0
  })

  const byCust = {}
  snap.forEach(o=>{
    const n=o.customer_name||'Unknown'
    if(!byCust[n]) byCust[n]={name:n,unsupplied:0,sni:0,invoiced:0}
    if(o.status==='invoiced') byCust[n].invoiced+=o.invoice_total_aud||0
    if(o.status==='sni') byCust[n].sni+=o.order_total_aud||0
    if(o.status==='unsupplied') byCust[n].unsupplied+=o.order_total_aud||0
  })
  const custList = Object.values(byCust).map(c=>({...c,total:c.unsupplied+c.sni+c.invoiced})).sort((a,b)=>b.total-a.total)

  const Tbl = ({data, isInv}) => {
    const agg = aggByOrder(data)
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Order #</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Order Date</th>
              <th className="text-left px-4 py-3">Due</th>
              <th className="text-left px-4 py-3">Month</th>
              <th className="text-right px-4 py-3">Value ({CLIENT.currency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {agg.slice(0,200).map((o,i)=>(
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{o.order_nbr}</td>
                <td className="px-4 py-2 text-gray-900 max-w-xs truncate">{o.customer_name}</td>
                <td className="px-4 py-2 text-xs text-gray-500">{o.order_date}</td>
                <td className="px-4 py-2 text-xs">{o.requested_on?<span className={new Date(o.requested_on)<new Date()?'text-red-500 font-medium':'text-gray-500'}>{o.requested_on}</span>:'—'}</td>
                <td className="px-4 py-2 text-xs text-gray-400">{o.month_label||'—'}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-800">{isInv?fmt(o.invoice_total_aud):fmt(o.order_total_aud)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td colSpan={5} className="px-4 py-3 font-semibold text-gray-700">TOTAL ({agg.length} orders · {data.length} lines)</td>
              <td className="px-4 py-3 text-right font-bold">{isInv?fmt(data.reduce((s,o)=>s+(o.invoice_total_aud||0),0)):fmt(data.reduce((s,o)=>s+(o.order_total_aud||0),0))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>

  return (
    <div className="min-h-screen bg-slate-50">
      <Header title="Pipeline Dashboard" subtitle={lastUpdated ? `${CLIENT.name} · Active deals by stream & product · Data as of ${CLIENT.formatDateTime(lastUpdated)}` : `${CLIENT.name} · Active deals by stream & product`} />
      <div className="max-w-7xl mx-auto px-6 py-4">

        <div className="flex gap-1 flex-wrap mb-6">
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab===t?'text-white':'bg-white text-gray-600 border border-gray-200'}`} style={tab===t?{background:CLIENT.brand.blue}:{}}>
              {t}
            </button>
          ))}
        </div>

        {tab==='Dashboard' && (
          <div className="space-y-5">
            {snap.length===0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="text-gray-600 font-medium mb-2">No pipeline data yet</p>
                <p className="text-gray-400 text-sm mb-6">Import deal data from {CLIENT.crm.name} to get started</p>
              </div>
            ) : (<>
              {/* KPI Cards */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100" style={{background:CLIENT.brand.blue}}>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">1. Top Performance Indicators</h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-y divide-gray-100">
                  <div className="px-5 py-4">
                    <p className="text-xs text-gray-500 mb-1">Total Pipeline Value</p>
                    <p className="text-2xl font-bold" style={{color:CLIENT.brand.blue}}>{fmtFull(totalPipeline)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sum of all deal values across all months</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-gray-500 mb-1">✅ Negotiation</p>
                    <p className="text-2xl font-bold text-green-700">{fmtFull(tI)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Late-stage deals in negotiation</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-gray-500 mb-1">📋 Proposal</p>
                    <p className="text-2xl font-bold text-blue-700">{fmtFull(tS)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Proposals sent — awaiting decision</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-gray-500 mb-1">🔍 Prospecting</p>
                    <p className="text-2xl font-bold text-amber-700">{fmtFull(tU)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Early-stage deals in qualification</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-gray-500 mb-1">Active Accounts</p>
                    <p className="text-2xl font-bold text-gray-800">{uniqueCustomers}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Accounts with active deals</p>
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-xs text-gray-500 mb-1">Total Deal Lines</p>
                    <p className="text-2xl font-bold text-gray-800">{snap.length.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Deal lines in current snapshot</p>
                  </div>
                </div>
              </div>

              {/* Monthly breakdown table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100" style={{background:CLIENT.brand.blue}}>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">2. Monthly Pipeline Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-gray-500 uppercase tracking-wide bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 min-w-48">Category</th>
                        {monthData.map(m=><th key={m.month} className="text-right px-3 py-3 whitespace-nowrap">{m.month}</th>)}
                        <th className="text-right px-4 py-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-green-700">✅ Negotiation</td>
                        {monthData.map(m=><td key={m.month} className="text-right px-3 py-3 text-green-700 font-medium">{m.invoiced>0?fmt(m.invoiced):<span className="text-gray-200">—</span>}</td>)}
                        <td className="text-right px-4 py-3 font-bold text-green-700">{fmt(tI)}</td>
                      </tr>
                      <tr className="border-t border-gray-100 bg-blue-50">
                        <td className="px-4 py-3 font-medium text-blue-700">📋 Proposal</td>
                        {monthData.map(m=><td key={m.month} className="text-right px-3 py-3 text-blue-700 font-medium">{m.sni>0?fmt(m.sni):<span className="text-gray-200">—</span>}</td>)}
                        <td className="text-right px-4 py-3 font-bold text-blue-700">{fmt(tS)}</td>
                      </tr>
                      <tr className="border-t border-gray-100">
                        <td className="px-4 py-3 font-medium text-amber-700">🔍 Prospecting</td>
                        {monthData.map(m=><td key={m.month} className="text-right px-3 py-3 text-amber-700 font-medium">{m.unsupplied>0?fmt(m.unsupplied):<span className="text-gray-200">—</span>}</td>)}
                        <td className="text-right px-4 py-3 font-bold text-amber-700">{fmt(tU)}</td>
                      </tr>
                      <tr className="border-t-2 border-gray-300 bg-gray-50">
                        <td className="px-4 py-3 font-bold text-gray-800">Pipeline Value</td>
                        {monthData.map(m=><td key={m.month} className="text-right px-3 py-3 font-bold text-gray-800">{fmt(m.invoiced+m.sni+m.unsupplied)}</td>)}
                        <td className="text-right px-4 py-3 font-bold text-gray-900">{fmt(totalPipeline)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pipeline chart */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-800 mb-1">Monthly Pipeline Overview</h3>
                <p className="text-xs text-gray-400 mb-4">Bars = monthly value by stage · Line = cumulative pipeline</p>
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={monthData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                    <XAxis dataKey="month" tick={{fontSize:11}}/>
                    <YAxis yAxisId="bars" tickFormatter={v=>`$${(v/1000).toFixed(0)}K`} tick={{fontSize:11}}/>
                    <YAxis yAxisId="line" orientation="right" tickFormatter={v=>`$${(v/1000000).toFixed(1)}M`} tick={{fontSize:11}}/>
                    <Tooltip formatter={v=>fmt(v)}/>
                    <Legend/>
                    <Bar yAxisId="bars" dataKey="invoiced" name="Negotiation" stackId="a" fill="#22c55e"/>
                    <Bar yAxisId="bars" dataKey="sni" name="Proposal" stackId="a" fill="#3b82f6"/>
                    <Bar yAxisId="bars" dataKey="unsupplied" name="Prospecting" stackId="a" fill="#f59e0b" radius={[3,3,0,0]}/>
                    <Line yAxisId="line" type="monotone" dataKey="pipeline" name="Pipeline" stroke={CLIENT.brand.blue} strokeWidth={2.5} dot={{r:4}}/>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Top 15 customers */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100" style={{background:CLIENT.brand.blue}}>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">3. Top 15 Customers by Total Pipeline Value</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="text-left px-4 py-3">Rank</th>
                        <th className="text-left px-4 py-3">Customer</th>
                        <th className="text-right px-4 py-3">🔍 Prospecting</th>
                        <th className="text-right px-4 py-3">📋 Proposal</th>
                        <th className="text-right px-4 py-3">✅ Negotiation</th>
                        <th className="text-right px-4 py-3">Total</th>
                        <th className="text-right px-4 py-3">%</th>
                        <th className="px-4 py-3 w-32">Bar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {custList.slice(0,15).map((c,i)=>(
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400 font-medium">{i+1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                          <td className="px-4 py-3 text-right text-amber-700">{c.unsupplied>0?fmt(c.unsupplied):<span className="text-gray-200">—</span>}</td>
                          <td className="px-4 py-3 text-right text-blue-700">{c.sni>0?fmt(c.sni):<span className="text-gray-200">—</span>}</td>
                          <td className="px-4 py-3 text-right text-green-700">{c.invoiced>0?fmt(c.invoiced):<span className="text-gray-200">—</span>}</td>
                          <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(c.total)}</td>
                          <td className="px-4 py-3 text-right text-gray-500 text-xs">{totalPipeline>0?(c.total/totalPipeline*100).toFixed(1)+'%':'—'}</td>
                          <td className="px-4 py-3">
                            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full" style={{width:`${custList[0].total>0?Math.min(c.total/custList[0].total*100,100):0}%`,background:CLIENT.brand.orange}}/>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                        <td colSpan={2} className="px-4 py-3 text-gray-700">TOP 15 SUBTOTAL</td>
                        <td className="px-4 py-3 text-right text-amber-700">{fmt(custList.slice(0,15).reduce((s,c)=>s+c.unsupplied,0))}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{fmt(custList.slice(0,15).reduce((s,c)=>s+c.sni,0))}</td>
                        <td className="px-4 py-3 text-right text-green-700">{fmt(custList.slice(0,15).reduce((s,c)=>s+c.invoiced,0))}</td>
                        <td className="px-4 py-3 text-right text-gray-900">{fmt(custList.slice(0,15).reduce((s,c)=>s+c.total,0))}</td>
                        <td className="px-4 py-3 text-right text-gray-500 text-xs">{totalPipeline>0?(custList.slice(0,15).reduce((s,c)=>s+c.total,0)/totalPipeline*100).toFixed(1)+'%':'—'}</td>
                        <td/>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between" style={{background:CLIENT.brand.blue}}>
                  <h3 className="font-bold text-white text-sm uppercase tracking-wide">4. Commentary & Pipeline Notes</h3>
                  <button onClick={()=>setEditNotes(!editNotes)} className="text-xs text-blue-200 hover:text-white">{editNotes?'Cancel':'✏️ Edit'}</button>
                </div>
                <div className="p-5">
                  {editNotes ? (
                    <div>
                      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={6}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                        placeholder="Pipeline health summary, revenue conversion notes, customer concentration risks, forward pipeline risks, recommended actions..."/>
                      <button onClick={saveNotes} className="mt-2 px-4 py-2 text-white text-sm rounded-lg font-medium" style={{background:CLIENT.brand.blue}}>Save Notes</button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 whitespace-pre-wrap min-h-12">
                      {notes||<span className="text-gray-300 italic">No commentary yet — click Edit to add pipeline notes, risks and recommended actions</span>}
                    </div>
                  )}
                </div>
              </div>
            </>)}
          </div>
        )}

        {tab==='Prospecting' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between">
              <div><h3 className="font-semibold text-gray-800">🔍 Prospecting Deals</h3><p className="text-xs text-gray-400">Early-stage deals in qualification · {unsupplied.length} lines</p></div>
              <span className="text-sm font-bold text-amber-700">{fmt(tU)}</span>
            </div>
            <Tbl data={unsupplied}/>
          </div>
        )}

        {tab==='Proposal' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between">
              <div><h3 className="font-semibold text-gray-800">📋 Proposal Deals</h3><p className="text-xs text-gray-400">Proposals sent — awaiting decision · {sni.length} lines</p></div>
              <span className="text-sm font-bold text-blue-700">{fmt(tS)}</span>
            </div>
            <Tbl data={sni}/>
          </div>
        )}

        {tab==='Negotiation' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between">
              <div><h3 className="font-semibold text-gray-800">✅ Negotiation Deals</h3><p className="text-xs text-gray-400">Late-stage deals in negotiation · {invoiced.length} lines</p></div>
              <span className="text-sm font-bold text-green-700">{fmt(tI)}</span>
            </div>
            <Tbl data={invoiced} isInv/>
          </div>
        )}

        {tab==='By Customer' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-800">All {custList.length} Customers</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3">#</th>
                    <th className="text-left px-4 py-3">Customer</th>
                    <th className="text-right px-4 py-3">🔍 Prospecting</th>
                    <th className="text-right px-4 py-3">📋 Proposal</th>
                    <th className="text-right px-4 py-3">✅ Negotiation</th>
                    <th className="text-right px-4 py-3">Total</th>
                    <th className="text-right px-4 py-3">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {custList.map((c,i)=>(
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i+1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-3 text-right">{c.unsupplied>0?<span className="text-amber-700 font-medium">{fmt(c.unsupplied)}</span>:<span className="text-gray-200">—</span>}</td>
                      <td className="px-4 py-3 text-right">{c.sni>0?<span className="text-blue-700 font-medium">{fmt(c.sni)}</span>:<span className="text-gray-200">—</span>}</td>
                      <td className="px-4 py-3 text-right">{c.invoiced>0?<span className="text-green-700 font-medium">{fmt(c.invoiced)}</span>:<span className="text-gray-200">—</span>}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(c.total)}</td>
                      <td className="px-4 py-3 text-right text-gray-400 text-xs">{totalPipeline>0?(c.total/totalPipeline*100).toFixed(1)+'%':'—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                    <td colSpan={2} className="px-4 py-3 text-gray-700">TOTAL</td>
                    <td className="px-4 py-3 text-right text-amber-700">{fmt(tU)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{fmt(tS)}</td>
                    <td className="px-4 py-3 text-right text-green-700">{fmt(tI)}</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmt(totalPipeline)}</td>
                    <td className="px-4 py-3 text-right text-gray-400">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Import tab removed — data comes via API ingest */}
      </div>
    </div>
  )
}