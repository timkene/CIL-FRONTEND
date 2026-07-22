'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IntakeForm } from '@/components/pharmacy/IntakeForm'
import { createPharmacyOrder, PharmacyApiError } from '@/lib/pharmacy-api'
import type { Enrollee, Medication, Provider } from '@/lib/pharmacy-types'

function generateIntakeId(): string {
  const n = Math.floor(10_000 + Math.random() * 90_000)
  const s = Math.random().toString(36).slice(2, 4).toUpperCase()
  return `INTAKE-${n}-${s}`
}

export default function NewPharmacyIntakePage() {
  const router = useRouter()
  const [intakeId] = useState(generateIntakeId)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const handleSubmit = async (data: {
    enrollee: Enrollee
    provider: Provider
    medications: Medication[]
  }) => {
    setSubmitting(true)
    try {
      const { orderId } = await createPharmacyOrder(data)
      router.push(`/pharmacy/orders/${orderId}`)
    } catch (err) {
      setToast(err instanceof PharmacyApiError ? err.message : 'Failed to create intake. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="p-8">
      {toast && (
        <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-rose-400 hover:text-rose-600 ml-4">✕</button>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <nav className="text-sm text-slate-400 mb-2">
            <Link href="/pharmacy" className="hover:text-[#137fec]">Pharmacy</Link>
            {' › '}
            <span className="text-slate-700">New Intake</span>
          </nav>
          <h1 className="text-2xl font-semibold text-slate-900">New Prescription Intake</h1>
          <p className="text-sm text-slate-500 mt-1">Fill out the details below to open a bidding session.</p>
        </div>
        <div className="text-right shrink-0 ml-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Intake ID</p>
          <p className="font-mono text-sm font-semibold text-slate-700">{intakeId}</p>
        </div>
      </div>

      <IntakeForm onSubmit={handleSubmit} submitting={submitting} />
    </div>
  )
}
