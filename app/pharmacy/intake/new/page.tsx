'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { IntakeForm } from '@/components/pharmacy/IntakeForm'
import { createPharmacyOrder, updatePharmacyOrder, getPharmacyOrder, PharmacyApiError } from '@/lib/pharmacy-api'
import type { Enrollee, Medication, Provider, PharmacyOrder } from '@/lib/pharmacy-types'

function generateIntakeId(): string {
  const n = Math.floor(10_000 + Math.random() * 90_000)
  const s = Math.random().toString(36).slice(2, 4).toUpperCase()
  return `INTAKE-${n}-${s}`
}

function IntakePage() {
  const router = useRouter()
  const params = useSearchParams()
  const editId = params.get('editId')

  const [intakeId] = useState(generateIntakeId)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [existing, setExisting] = useState<PharmacyOrder | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(!!editId)

  useEffect(() => {
    if (!editId) return
    getPharmacyOrder(editId)
      .then(o => {
        if (o.status !== 'pending_review' && o.status !== 'rejected') {
          setToast('This order can no longer be edited.')
        } else {
          setExisting(o)
        }
      })
      .catch(() => setToast('Failed to load order for editing.'))
      .finally(() => setLoadingExisting(false))
  }, [editId])

  const handleSubmit = async (data: {
    enrollee: Enrollee
    provider: Provider
    medications: Medication[]
  }) => {
    setSubmitting(true)
    try {
      if (editId) {
        await updatePharmacyOrder(editId, data)
        router.push(`/pharmacy/orders/${editId}`)
      } else {
        const { orderId } = await createPharmacyOrder(data)
        router.push(`/pharmacy/orders/${orderId}`)
      }
    } catch (err) {
      setToast(err instanceof PharmacyApiError ? err.message : 'Failed to save intake. Please try again.')
      setSubmitting(false)
    }
  }

  const isEdit = !!editId
  const displayId = existing?.intakeId ?? intakeId

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
            {isEdit && existing && (
              <>
                {' › '}
                <Link href={`/pharmacy/orders/${editId}`} className="hover:text-[#137fec]">{existing.intakeId}</Link>
              </>
            )}
            {' › '}
            <span className="text-slate-700">{isEdit ? 'Edit Prescription' : 'New Intake'}</span>
          </nav>
          <h1 className="text-2xl font-semibold text-slate-900">
            {isEdit ? 'Edit Prescription' : 'New Prescription Intake'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isEdit
              ? 'Update the details below and save to resubmit for pharmacist review.'
              : 'Fill out the details below to create a prescription for review.'}
          </p>
        </div>
        <div className="text-right shrink-0 ml-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Intake ID</p>
          <p className="font-mono text-sm font-semibold text-slate-700">{displayId}</p>
        </div>
      </div>

      {loadingExisting ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-48 bg-slate-100 rounded-lg" />
          <div className="h-64 bg-slate-100 rounded-lg" />
        </div>
      ) : (
        <IntakeForm
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={isEdit ? 'Save Changes' : 'Submit for Review'}
          initialData={existing ? {
            enrollee: existing.enrollee,
            provider: existing.provider ?? { providerId: '', providerName: '' },
            medications: existing.medications,
          } : undefined}
        />
      )}
    </div>
  )
}

export default function NewPharmacyIntakePage() {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse"><div className="h-8 bg-slate-100 rounded w-1/3 mb-4" /><div className="h-64 bg-slate-100 rounded" /></div>}>
      <IntakePage />
    </Suspense>
  )
}
