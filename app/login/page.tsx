'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setSession, MODULE_ROUTES, type User } from '@/lib/auth'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Fetch staff by email
      const { data: staff, error: err } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, department, password, status, session_version')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (err || !staff) {
        setError('Email address not found.')
        setLoading(false)
        return
      }

      if (staff.status !== 'ACTIVE') {
        setError('Your account is inactive. Contact your administrator.')
        setLoading(false)
        return
      }

      if (staff.password !== password) {
        setError('Incorrect password.')
        setLoading(false)
        return
      }

      // Fetch department modules
      const { data: dept } = await supabase
        .from('department_permissions')
        .select('modules')
        .eq('department', staff.department)
        .single()

      const modules: string[] = dept?.modules ?? ['MLR Data']

      const user: User = {
        id:              staff.id,
        first_name:      staff.first_name,
        last_name:       staff.last_name,
        email:           staff.email,
        department:      staff.department,
        modules,
        session_version: staff.session_version,
      }

      setSession(user)

      // Redirect to first accessible module
      const isAll = modules.includes('ALL')
      const first = MODULE_ROUTES.find(r => isAll || modules.includes(r.module))
      router.replace(first?.href ?? '/mlr')

    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f8] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900">Clearline</h1>
          <p className="text-sm text-slate-500 mt-1">Analytics Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <h2 className="text-lg font-bold mb-6 text-slate-900">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Email address
              </label>
              <input
                type="email"
                className="mt-1.5 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none"
                placeholder="you@clearlinehmo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  type={showPw ? 'text' : 'password'}
                  className="w-full px-4 py-3 pr-11 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPw(v => !v)}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: '18px' }}>error</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#137fec] hover:bg-[#0f6fd4] text-white font-bold py-3 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-sm" style={{ animation: 'spin 1s linear infinite' }}>
                    progress_activity
                  </span>
                  Signing in...
                </>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Clearline International Limited · Analytics Portal
        </p>
      </div>
    </div>
  )
}
