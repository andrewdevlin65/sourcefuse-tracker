'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../Components/header'
import Link from 'next/link'
import CLIENT from '../../config/client'

const stk = CLIENT.stakeholders
const DEFAULT_SETTINGS = {
  consultant_name: 'Andrew Devlin',
  communication_style: CLIENT.aiDefaults.communicationStyle,
  underperformance_framing: CLIENT.aiDefaults.underperformanceFraming,
  stakeholder_notes: `${stk.gm.name} (${stk.gm.title}): Responds well to data and specifics. ${stk.ceo.name} (${stk.ceo.title}): Wants the story behind the numbers. ${stk.founder.name} (${stk.founder.title}): Big picture, trends and trajectory.`,
  standard_closer: CLIENT.aiDefaults.standardCloser,
  tone_default: CLIENT.aiDefaults.toneDefault,
  report_persona: CLIENT.defaultReportPersona,
}

const TONE_OPTIONS = [
  { value: 'encouraging', label: 'Encouraging', desc: 'Momentum is building — lead with positives' },
  { value: 'cautious', label: 'Cautious', desc: 'Behind pace — honest but constructive' },
  { value: 'urgent', label: 'Urgent', desc: 'Critical gap — direct and action-focused' },
  { value: 'celebratory', label: 'Celebratory', desc: 'Strong results — acknowledge the wins' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const inputClass = 'w-full border border-gray-300 rounded-md px-3 py-2 text-gray-900 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1'
  const hintClass = 'text-xs text-gray-400 mt-1'

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('report_settings').select('*').eq('client_id', CLIENT.id).maybeSingle()
      if (data) setSettings(prev => ({ ...prev, ...data }))
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setStatus('')
    const { error } = await supabase.from('report_settings').upsert({ client_id: CLIENT.id, ...settings, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
    setStatus(error ? 'Error: ' + error.message : 'Settings saved — will apply to next report generated')
    setSaving(false)
  }

  if (loading) return <div className='min-h-screen bg-slate-50 flex items-center justify-center'><p className='text-gray-400'>Loading...</p></div>

  return (
    <div className='min-h-screen bg-slate-50 py-6 px-4'>
      <div className='max-w-2xl mx-auto'>
        <Header title='Report Settings' subtitle='Consultant voice and report tone configuration' />
        <div className='mb-4 flex items-center justify-between'>
          <Link href='/ceo' className='text-sm text-blue-600 hover:text-blue-800'>Back to Revenue Tracker</Link>
          <button onClick={() => setSettings(DEFAULT_SETTINGS)} className='text-xs text-gray-400 underline'>Reset to defaults</button>
        </div>
        <div className='space-y-5'>
          <div className='bg-white rounded-lg shadow p-6 space-y-4'>
            <h2 className='font-semibold text-gray-800 border-b pb-2'>Consultant Identity</h2>
            <div><label className={labelClass}>Your name</label><input type='text' value={settings.consultant_name} onChange={e => setSettings(p => ({...p, consultant_name: e.target.value}))} className={inputClass}/></div>
            <div><label className={labelClass}>Report persona</label><textarea value={settings.report_persona} onChange={e => setSettings(p => ({...p, report_persona: e.target.value}))} rows={4} className={inputClass}/><p className={hintClass}>The role Claude takes when writing. Be specific about industry, client, and audience.</p></div>
          </div>
          <div className='bg-white rounded-lg shadow p-6 space-y-4'>
            <h2 className='font-semibold text-gray-800 border-b pb-2'>Communication Style</h2>
            <div>
              <label className={labelClass}>Default tone</label>
              <div className='grid grid-cols-2 gap-2 mt-1'>
                {TONE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setSettings(p => ({...p, tone_default: opt.value}))}
                    className={'text-left px-3 py-2.5 rounded-lg border text-sm ' + (settings.tone_default === opt.value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-600')}>
                    <p className='font-medium'>{opt.label}</p>
                    <p className='text-xs text-gray-400'>{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div><label className={labelClass}>How to communicate wins and momentum</label><textarea value={settings.communication_style} onChange={e => setSettings(p => ({...p, communication_style: e.target.value}))} rows={4} className={inputClass}/></div>
            <div><label className={labelClass}>How to handle underperformance or gaps</label><textarea value={settings.underperformance_framing} onChange={e => setSettings(p => ({...p, underperformance_framing: e.target.value}))} rows={4} className={inputClass}/><p className={hintClass}>Most important — how you talk about gaps defines your consulting relationship.</p></div>
          </div>
          <div className='bg-white rounded-lg shadow p-6 space-y-4'>
            <h2 className='font-semibold text-gray-800 border-b pb-2'>Stakeholder Notes</h2>
            <div><label className={labelClass}>How each reader prefers to receive information</label><textarea value={settings.stakeholder_notes} onChange={e => setSettings(p => ({...p, stakeholder_notes: e.target.value}))} rows={5} className={inputClass}/></div>
          </div>
          <div className='bg-white rounded-lg shadow p-6 space-y-4'>
            <h2 className='font-semibold text-gray-800 border-b pb-2'>Standard Report Closer</h2>
            <div><label className={labelClass}>How to end every report</label><textarea value={settings.standard_closer} onChange={e => setSettings(p => ({...p, standard_closer: e.target.value}))} rows={3} className={inputClass}/></div>
          </div>
          <button onClick={handleSave} disabled={saving} className='w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-medium text-lg disabled:opacity-50 shadow-sm hover:shadow-md transition-all'>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {status && <p className='text-center text-sm font-medium text-green-700'>{status}</p>}
        </div>
      </div>
    </div>
  )
}
