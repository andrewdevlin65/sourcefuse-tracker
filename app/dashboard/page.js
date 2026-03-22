'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()
  useEffect(() => { router.replace('/forecast') }, [])
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-gray-400">Redirecting to GM Forecast...</p>
    </div>
  )
}