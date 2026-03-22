'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import CLIENT from '../../config/client'

export function ScaletechBar() {
  return (
    <div className="bg-slate-900 text-slate-400 text-xs py-1 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span>{CLIENT.platform.name}</span>
        <span>{CLIENT.platform.tagline}</span>
      </div>
    </div>
  )
}

function SignOutButton() {
  const [session, setSession] = useState(null)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (!session) return null

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button onClick={handleSignOut}
      className="text-xs px-2 py-1 rounded transition-colors"
      style={{ color: '#64748b' }}
      onMouseOver={e => e.currentTarget.style.color = CLIENT.brand.primary}
      onMouseOut={e => e.currentTarget.style.color = '#64748b'}>
      Sign out
    </button>
  )
}

export default function Header({ title, subtitle, actions }) {
  return (
    <>
    <ScaletechBar />
    <div style={{ background: CLIENT.brand.headerGradient }} className="text-white px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div style={{ background: CLIENT.brand.orange, borderRadius: '50%', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: 'white', fontFamily: 'Georgia, serif', flexShrink: 0 }}>
              {CLIENT.logoText}
            </div>
            <div>
              <p className="text-xs font-bold tracking-widest leading-none" style={{ color: CLIENT.brand.orange }}>{CLIENT.fullName}</p>
              <p className="text-white font-semibold text-sm leading-tight mt-0.5">{title}</p>
              {subtitle && <p className="text-xs leading-none mt-0.5" style={{ color: '#94a3b8' }}>{subtitle}</p>}
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {actions}
          <Link href="/" className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:text-white" style={{ color: '#64748b' }}>← Home</Link>
          <SignOutButton />
        </div>
      </div>
    </div>
    </>
  )
}
