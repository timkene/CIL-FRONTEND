'use client'
import { useRef, useState, type FormEvent } from 'react'
import { loginPharmacyStaff, PharmacyApiError } from '@/lib/pharmacy-api'

export default function PharmacyLoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const form = event.currentTarget
    const fields = new FormData(form)
    const email = String(fields.get('email') ?? '').trim()
    const password = String(fields.get('password') ?? '')
    inFlight.current = true
    setPending(true)
    setError(null)
    // Do not retain passwords in React state or leave them in the form after submission.
    form.reset()
    try {
      const result = await loginPharmacyStaff(email, password)
      if (result.success !== true || !result.user?.userId) throw new Error('Invalid response')
      window.location.assign('/pharmacy')
    } catch (cause) {
      setError(cause instanceof PharmacyApiError ? cause.message : 'Unable to sign in. Please try again.')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f6f7f8] p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Pharmacy staff sign-in</h1>
        <p className="mt-2 text-sm text-slate-500">Use your existing Pharmacy staff account.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="pharmacy-email" className="block text-sm font-medium text-slate-700">Email</label>
            <input id="pharmacy-email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          <div>
            <label htmlFor="pharmacy-password" className="block text-sm font-medium text-slate-700">Password</label>
            <input id="pharmacy-password" name="password" type="password" autoComplete="current-password" required maxLength={4096} disabled={pending} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </div>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <button type="submit" disabled={pending} className="w-full rounded-lg bg-[#137fec] px-4 py-2 font-semibold text-white disabled:opacity-50">{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </main>
  )
}
