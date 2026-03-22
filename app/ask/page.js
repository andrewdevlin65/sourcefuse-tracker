'use client'
import { useState } from 'react'
import Link from 'next/link'
import Header from '../Components/header'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import CLIENT from '../../config/client'
import * as XLSX from 'xlsx'
import pptxgen from 'pptxgenjs'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

// Parse markdown table into array of objects
const parseMarkdownTable = (text) => {
  const lines = text.split('\n')
  const tableLines = lines.filter(l => l.trim().startsWith('|'))
  if (tableLines.length < 3) return null

  const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean)
  const rows = tableLines.slice(2).map(line => {
    const cells = line.split('|').map(c => c.trim()).filter(Boolean)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = cells[i] || '' })
    return obj
  }).filter(r => Object.values(r).some(v => v))

  return rows.length > 0 ? { headers, rows } : null
}

// Clean numeric value
const cleanNum = (val) => {
  if (!val) return 0
  const n = parseFloat(String(val).replace(/[$,%KMB\s]/g, '').replace(/K$/, '000').replace(/M$/, '000000'))
  // Handle K/M suffixes
  if (String(val).includes('K') || String(val).includes('k')) return parseFloat(String(val).replace(/[$,%\s]/g, '')) * 1000
  if (String(val).includes('M') || String(val).includes('m')) return parseFloat(String(val).replace(/[$,%\s]/g, '')) * 1000000
  return isNaN(n) ? 0 : n
}

// Detect chart type
const detectChartType = (headers, rows) => {
  const firstKey = headers[0]?.toLowerCase() || ''
  const timeWords = ['month', 'week', 'date', 'period', 'quarter', 'year', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  if (timeWords.some(w => firstKey.includes(w))) return 'line'

  // Check if only one numeric column and values sum ~100 → pie
  const numericCols = headers.slice(1).filter(h => {
    return rows.some(r => cleanNum(r[h]) > 0)
  })
  if (numericCols.length === 1) {
    const total = rows.reduce((s, r) => s + cleanNum(r[numericCols[0]]), 0)
    if (total > 80 && total < 120) return 'pie'
  }

  return 'bar'
}

// Inline chart component
const InlineChart = ({ tableData }) => {
  const { headers, rows } = tableData
  const labelKey = headers[0]
  const valueKeys = headers.slice(1).filter(h => rows.some(r => cleanNum(r[h]) > 0))
  if (valueKeys.length === 0) return null

  const chartData = rows.map(r => {
    const obj = { name: r[labelKey] || '' }
    valueKeys.forEach(k => { obj[k] = cleanNum(r[k]) })
    return obj
  })

  const chartType = detectChartType(headers, rows)

  const fmt = (v) => {
    if (v >= 1000000) return '$' + (v/1000000).toFixed(1) + 'M'
    if (v >= 1000) return '$' + Math.round(v/1000) + 'K'
    return v % 1 === 0 ? v.toString() : v.toFixed(1)
  }

  return (
    <div className="mt-3 bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {chartType === 'line' ? '📈' : chartType === 'pie' ? '🥧' : '📊'} Chart — auto-detected from table data
      </p>
      <ResponsiveContainer width="100%" height={260}>
        {chartType === 'line' ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            {valueKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
            ))}
          </LineChart>
        ) : chartType === 'pie' ? (
          <PieChart>
            <Pie data={chartData} dataKey={valueKeys[0]} nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
          </PieChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(v)} />
            <Legend />
            {valueKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[3,3,0,0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export default function AskPage() {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState('')

  const ask = async () => {
    if (!question.trim()) return
    const q = question
    setQuestion('')
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setLoading(true)
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    })
    const data = await res.json()
    setMessages(prev => [...prev, { role: 'ai', text: data.answer }])
    setLoading(false)
  }

  const exportExcel = async (text) => {
    setExportLoading('excel')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Convert the following sales analysis into structured tabular data for Excel.
Return ONLY a JSON array of objects with consistent keys — no explanation, no markdown, just raw JSON.
Each object represents one row. Use clear column names.

Analysis:
${text}`
        })
      })
      const data = await res.json()
      let rows = []
      try {
        const clean = data.answer.replace(/```json|```/g, '').trim()
        rows = JSON.parse(clean)
        if (!Array.isArray(rows)) rows = [rows]
      } catch {
        rows = text.split('\n').filter(l => l.trim()).map((line, i) => ({ Row: i + 1, Content: line.trim() }))
      }
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length, 15) }))
      XLSX.utils.book_append_sheet(wb, ws, 'Sales Data')
      XLSX.writeFile(wb, `GP-Oil-Tools-Sales-${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (err) { console.error('Excel export error:', err) }
    setExportLoading('')
  }

  const exportWord = async (text) => {
    setExportLoading('word')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Format the following sales analysis as a professional Word document in HTML.
Use: <h1> for main title, <h2> for sections, <p> for paragraphs, <table><tr><th><td> for tables, <ul><li> for bullets.
Include title "${CLIENT.name} — Sales Analysis" and date ${CLIENT.formatDate(new Date().toISOString())}.
Return ONLY the HTML body content — no doctype or html/head/body tags.

Analysis:
${text}`
        })
      })
      const data = await res.json()
      const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${CLIENT.name} Sales Analysis</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11pt; color: #1e293b; margin: 40px; }
  h1 { font-size: 18pt; color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
  h2 { font-size: 14pt; color: #1e40af; margin-top: 20px; }
  p { line-height: 1.6; margin: 8px 0; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th { background: #1e293b; color: white; padding: 8px 12px; text-align: left; font-size: 10pt; }
  td { padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 10pt; }
  tr:nth-child(even) td { background: #f8fafc; }
  ul { margin: 8px 0; padding-left: 20px; }
  li { margin: 4px 0; line-height: 1.5; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 9pt; color: #94a3b8; }
</style></head>
<body>${data.answer}
<div class="footer">Generated by ${CLIENT.platform.name} · ${CLIENT.name} · ${CLIENT.formatDateLong(new Date().toISOString())} · Confidential</div>
</body></html>`
      const blob = new Blob([html], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `GP-Oil-Tools-Analysis-${new Date().toISOString().split('T')[0]}.doc`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error('Word export error:', err) }
    setExportLoading('')
  }

  const exportPowerPoint = async (text, tableData) => {
    setExportLoading('pptx')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Convert the following sales analysis into PowerPoint slides.
Return ONLY a JSON array of slide objects. Each slide:
- "title": slide title
- "bullets": array of bullet strings (max 5, max 10 words each)
- "isTitle": true only for first slide
Create 4-6 slides. Return raw JSON only.

Analysis:
${text}`
        })
      })
      const data = await res.json()

      let slides = []
      try {
        const clean = data.answer.replace(/```json|```/g, '').trim()
        slides = JSON.parse(clean)
      } catch {
        slides = [
          { title: '${CLIENT.name} — Sales Analysis', bullets: [], isTitle: true },
          { title: 'Key Findings', bullets: text.split('\n').filter(l => l.trim()).slice(0, 5) }
        ]
      }

      const pptx = new pptxgen()
      pptx.layout = 'LAYOUT_WIDE'

      slides.forEach((slide, i) => {
        const s = pptx.addSlide()
        s.background = { color: i === 0 ? '1e293b' : 'ffffff' }

        if (slide.isTitle) {
          s.addText(CLIENT.name, { x: 0.5, y: 1.5, w: 12, h: 1, fontSize: 36, bold: true, color: 'ffffff', align: 'center' })
          s.addText(slide.title || 'Sales Analysis', { x: 0.5, y: 2.8, w: 12, h: 0.8, fontSize: 24, color: '94a3b8', align: 'center' })
          s.addText(CLIENT.formatDateLong(new Date().toISOString()), { x: 0.5, y: 6.5, w: 12, h: 0.5, fontSize: 12, color: '64748b', align: 'center' })
        } else {
          s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 1.2, fill: { color: '1e293b' } })
          s.addText(slide.title || 'Analysis', { x: 0.4, y: 0.15, w: 12.5, h: 0.9, fontSize: 22, bold: true, color: 'ffffff' })
          ;(slide.bullets || []).slice(0, 6).forEach((bullet, bi) => {
            s.addShape(pptx.shapes.RECTANGLE, { x: 0.4, y: 1.5 + bi * 0.9, w: 0.08, h: 0.4, fill: { color: '3b82f6' } })
            s.addText(bullet, { x: 0.65, y: 1.45 + bi * 0.9, w: 12.2, h: 0.5, fontSize: 14, color: '1e293b' })
          })
          s.addText('${CLIENT.name} · Confidential', { x: 0.4, y: 7.0, w: 12.5, h: 0.3, fontSize: 9, color: '94a3b8' })
        }
      })

      // Add chart slide if table data exists
      if (tableData) {
        const { headers, rows } = tableData
        const labelKey = headers[0]
        const valueKeys = headers.slice(1).filter(h => rows.some(r => cleanNum(r[h]) > 0))
        const chartType = detectChartType(headers, rows)

        if (valueKeys.length > 0) {
          const s = pptx.addSlide()
          s.background = { color: 'ffffff' }
          s.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 1.2, fill: { color: '1e293b' } })
          s.addText('Data Visualisation', { x: 0.4, y: 0.15, w: 12.5, h: 0.9, fontSize: 22, bold: true, color: 'ffffff' })

          const chartData = [{
            name: valueKeys[0],
            labels: rows.map(r => r[labelKey] || ''),
            values: rows.map(r => cleanNum(r[valueKeys[0]]))
          }]

          const pptxChartType = chartType === 'line' ? pptx.charts.LINE : chartType === 'pie' ? pptx.charts.PIE : pptx.charts.BAR

          s.addChart(pptxChartType, chartData, {
            x: 0.5, y: 1.4, w: 12.3, h: 5.5,
            showLegend: true,
            legendPos: 'b',
            chartColors: ['0062A0', '22c55e', 'f59e0b', 'ef4444'],
          })

          s.addText('${CLIENT.name} · Confidential', { x: 0.4, y: 7.0, w: 12.5, h: 0.3, fontSize: 9, color: '94a3b8' })
        }
      }

      await pptx.writeFile({ fileName: `GP-Oil-Tools-Slides-${new Date().toISOString().split('T')[0]}.pptx` })
    } catch (err) { console.error('PowerPoint export error:', err) }
    setExportLoading('')
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Header title="🤖 Ask Your Sales Data" subtitle="Powered by Claude AI · Charts auto-render · Export to Excel, Word or PowerPoint" />

        <div className="bg-white rounded-lg shadow mb-4 p-4 min-h-64">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-8">
              <p className="text-4xl mb-3">💬</p>
              <p>Ask anything about your sales data.</p>
              <p className="text-sm mt-2">e.g. "Show me average deal size by month" or "Compare pipeline week over week"</p>
              <p className="text-xs mt-3 text-gray-300">📊 Charts auto-render from table data · Export to Excel, Word or PowerPoint</p>
            </div>
          )}
          {messages.map((m, i) => {
            const tableData = m.role === 'ai' ? parseMarkdownTable(m.text) : null
            return (
              <div key={i} className={`mb-6 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                {m.role === 'user' ? (
                  <span className="inline-block px-4 py-2 rounded-lg text-sm max-w-prose bg-blue-600 text-white">
                    {m.text}
                  </span>
                ) : (
                  <div>
                    {/* Text response */}
                    <div className="px-4 py-3 rounded-lg text-sm bg-gray-100 text-gray-900">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => (
                            <div className="overflow-x-auto my-2">
                              <table className="min-w-full border border-gray-300 rounded text-sm" {...props} />
                            </div>
                          ),
                          thead: ({node, ...props}) => <thead className="bg-gray-200" {...props} />,
                          th: ({node, ...props}) => <th className="px-3 py-2 border border-gray-300 text-left font-semibold text-gray-700" {...props} />,
                          td: ({node, ...props}) => <td className="px-3 py-2 border border-gray-300 text-gray-800" {...props} />,
                          tr: ({node, ...props}) => <tr className="even:bg-gray-50" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside my-1 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-inside my-1 space-y-1" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2" {...props} />,
                        }}
                      >{m.text}</ReactMarkdown>
                    </div>

                    {/* Inline chart — renders automatically if table detected */}
                    {tableData && <InlineChart tableData={tableData} />}

                    {/* Export buttons */}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button onClick={() => exportExcel(m.text)} disabled={exportLoading === 'excel'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors">
                        {exportLoading === 'excel' ? '⏳' : '📊'} Export Excel
                      </button>
                      <button onClick={() => exportWord(m.text)} disabled={exportLoading === 'word'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors">
                        {exportLoading === 'word' ? '⏳' : '📝'} Export Word
                      </button>
                      <button onClick={() => exportPowerPoint(m.text, tableData)} disabled={exportLoading === 'pptx'}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded-lg disabled:opacity-50 transition-colors">
                        {exportLoading === 'pptx' ? '⏳' : '📑'} Export PowerPoint
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {loading && (
            <div className="text-left">
              <span className="inline-block px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-500">Thinking...</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input type="text" value={question} onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask()}
            placeholder="Ask a question about your sales data..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button onClick={ask} disabled={loading}
            className="bg-gradient-to-r from-purple-500 to-purple-700 hover:from-purple-600 hover:to-purple-800 text-white px-6 py-3 rounded-lg disabled:opacity-50 font-medium shadow-sm hover:shadow-md transition-all duration-200">
            Ask
          </button>
        </div>
        <p className="text-center text-xs text-gray-400 mt-3">
          Charts auto-render from table data · Export any response to Excel, Word or PowerPoint
        </p>
      </div>
    </div>
  )
}