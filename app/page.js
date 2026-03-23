import Link from 'next/link'
import { ScaletechBar } from './Components/header'
import CLIENT from '../config/client'

export default function Home() {
  const fy = CLIENT.getCurrentFY()
  const q = CLIENT.getCurrentQuarter()
  const fyMonths = CLIENT.getMonthsForFY(fy)
  const fyEndYear = parseInt(fy.replace('FY', ''))
  const fyLabel = `${fy} (${fyMonths[0].label} – ${fyMonths[11].label})`
  const qDef = CLIENT.quarterList.find(qd => qd.name === q)
  const qMonthNames = qDef ? qDef.months.map(m => {
    const mn = parseInt(m)
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mn - 1]
  }) : []
  const qYear = qDef && parseInt(qDef.months[0]) >= 7 ? fyEndYear - 1 : fyEndYear
  const qLabel = `Current: ${q} ${fy.replace('FY20', 'FY')} (${qMonthNames[0]} – ${qMonthNames[qMonthNames.length - 1]} ${qYear})`

  return (
    <div className="min-h-screen bg-slate-50">
      <ScaletechBar />

      {/* Client Header */}
      <div style={{ background: CLIENT.brand.headerGradient }} className="text-white px-6 py-8">
        <div className="max-w-md mx-auto text-center">
          <div className="mb-3">
            <h1 className="text-2xl font-bold tracking-wide">{CLIENT.nameLine1}</h1>
            <p className="text-sm tracking-widest" style={{ color: CLIENT.brand.primary }}>{CLIENT.nameLine2}</p>
          </div>
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mt-2">{CLIENT.platform.name}</p>
          <p className="text-blue-200 text-sm mt-1">{fyLabel}</p>
          <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{qLabel}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-3">

          {/* INPUTS */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">Inputs</p>

          <Link href="/forecast" className="flex items-center justify-between w-full bg-white border-l-4 text-gray-800 px-4 py-3 rounded-lg hover:bg-orange-50 shadow-sm transition-colors" style={{ borderLeftColor: CLIENT.brand.orange }}>
            <span className="font-medium">🎯 Submit Forecast</span>
            <span className="text-xs text-gray-400">AEs + GM — weekly/monthly/quarterly</span>
          </Link>

          <Link href="/weekly" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">📋 Weekly Revenue Input from CRM</span>
            <span className="text-xs text-gray-400">Enter weekly data</span>
          </Link>

          <Link href="/month-end" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">📅 Month End Snapshot</span>
            <span className="text-xs text-gray-400">Capture final monthly figures</span>
          </Link>

          {/* REPORTING */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2">Reporting</p>

          <Link href="/bow" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">📊 Pipeline Dashboard</span>
            <span className="text-xs text-gray-400">Active deals by stream & product</span>
          </Link>

          <Link href="/opportunities" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">💼 Opportunities</span>
            <span className="text-xs text-gray-400">Import & lost deal analysis</span>
          </Link>

          <Link href="/ceo" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">📈 Revenue Tracker</span>
            <span className="text-xs text-gray-400">Weekly performance & reports</span>
          </Link>

          <Link href="/revenue-bridge" className="flex items-center justify-between w-full text-white px-4 py-3 rounded-lg shadow-sm transition-colors hover:opacity-90" style={{ background: CLIENT.brand.secondary }}>
            <span className="font-medium">🏗️ Revenue Architecture</span>
            <span className="text-xs text-gray-300">$23M → $55M live model</span>
          </Link>

          <Link href="/hire-plan" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">👥 Hire Plan & ROI Gates</span>
            <span className="text-xs text-gray-400">Rep timeline & gate scorecards</span>
          </Link>

          <Link href="/accuracy" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">🎯 Forecast Accuracy</span>
            <span className="text-xs text-gray-400">Stack rank & green boxes</span>
          </Link>

          <Link href="/ask" className="flex items-center justify-between w-full text-white px-4 py-3 rounded-lg shadow-sm transition-colors" style={{ background: 'linear-gradient(135deg, #3D1A6E, #2D1255)' }}>
            <span className="font-medium">🤖 Ask Your Sales Data</span>
            <span className="text-xs" style={{ color: '#2DD4BF' }}>Powered by Claude AI</span>
          </Link>

          {/* ADMIN */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 pt-2">Admin</p>

          <Link href="/setup" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">⚙️ Setup — Quotas & Settings</span>
            <span className="text-xs text-gray-400">Quotas, actuals, forecast settings</span>
          </Link>

          <Link href="/assumptions" className="flex items-center justify-between w-full bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
            <span className="font-medium">🔬 Model Assumptions</span>
            <span className="text-xs text-gray-400">35 variables driving the forecast</span>
          </Link>

        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3D1A6E' }}></div>
            <p className="text-xs font-semibold" style={{ color: '#3D1A6E' }}>{CLIENT.platform.company.toUpperCase()}</p>
            <p className="text-xs text-gray-400">· {CLIENT.platform.motto}</p>
          </div>
          <p className="text-xs text-gray-300">Powered by {CLIENT.platform.partner}</p>
        </div>
      </div>

    </div>
  )
}
