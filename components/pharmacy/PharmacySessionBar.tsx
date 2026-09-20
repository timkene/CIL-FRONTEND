'use client'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { logoutPharmacyStaff } from '@/lib/pharmacy-api'

export function PharmacySessionBar() {
  const pathname = usePathname()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  if (pathname === '/pharmacy/login') return null
  async function logout() {
    if (inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError(null)
    try {
      await logoutPharmacyStaff()
      window.location.assign('/pharmacy/login')
    } catch {
      setError('Unable to sign out. Please try again.')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  return <div className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-8 py-3">
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    <button onClick={logout} disabled={pending} className="text-sm font-semibold text-[#137fec] disabled:opacity-50">{pending ? 'Signing out…' : 'Sign out of Pharmacy'}</button>
  </div>
}
