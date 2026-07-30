'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { setSession, MODULE_ROUTES, type User } from '@/lib/auth'
import { Card, Button, useToast } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const toast = useToast()

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
        const errorMsg = 'Email address not found.'
        setError(errorMsg)
        toast.error(errorMsg)
        setLoading(false)
        return
      }

      if (staff.status !== 'ACTIVE') {
        const errorMsg = 'Your account is inactive. Contact your administrator.'
        setError(errorMsg)
        toast.error(errorMsg)
        setLoading(false)
        return
      }

      if (staff.password !== password) {
        const errorMsg = 'Incorrect password.'
        setError(errorMsg)
        toast.error(errorMsg)
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
      const errorMsg = 'Something went wrong. Please try again.'
      setError(errorMsg)
      toast.error(errorMsg)
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
        <Card padding="lg" className="shadow-sm">
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0"
                  type="button"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </Button>
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
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
            >
              Sign in
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Clearline International Limited · Analytics Portal
        </p>
      </div>
    </div>
  )
}
