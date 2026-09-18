'use client'
import { useRef, useState } from 'react'
import { approvePharmacyOrder, rejectPharmacyOrder, listPharmacyAggregators, assignPharmacyOrder, pharmacyMutationError } from '@/lib/pharmacy-api'
import type { PharmacyAggregator, PharmacyOrder } from '@/lib/pharmacy-types'

export function ReviewActions({ order, onComplete }: { order: PharmacyOrder; onComplete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [aggregators, setAggregators] = useState<PharmacyAggregator[] | null>(null)
  const [aggregatorId, setAggregatorId] = useState('')
  const [finished, setFinished] = useState(false)

  if (!['pending_review', 'direct_reassignment'].includes(order.status) || finished) return null

  const run = async (action: () => Promise<unknown>, completes = true) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
      if (completes) {
        await onComplete()
        setFinished(true)
      }
    } catch (err) {
      setError(await pharmacyMutationError(err, onComplete))
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  const deny = () => {
    const comment = window.prompt(`Denial comment for ${order.intakeId} (required):`)
    if (comment === null) return
    if (!comment.trim()) {
      setError('A denial comment is required.')
      return
    }
    void run(() => rejectPharmacyOrder(order.id, comment))
  }
  const selected = aggregators?.find(a => a.id === aggregatorId)
  const buttonClass = 'text-sm font-semibold hover:underline disabled:opacity-40'

  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
    <div className="flex flex-wrap gap-3">
      {order.status === 'pending_review' && <><button disabled={busy} onClick={() => void run(() => approvePharmacyOrder(order.id))} className={`${buttonClass} text-emerald-600`}>Approve</button>
      <button disabled={busy} onClick={deny} className={`${buttonClass} text-rose-600`}>Deny</button></>}
      <button disabled={busy} onClick={() => void run(async () => { setAggregators(await listPharmacyAggregators()); setAggregatorId('') }, false)} className={`${buttonClass} text-[#137fec]`}>Send directly</button>
      {busy && <span role="status" className="text-sm text-slate-500">Please wait…</span>}
    </div>
    {aggregators !== null && <div className="rounded-lg border border-slate-200 p-3 space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        Aggregator
        <select value={aggregatorId} disabled={busy} onChange={e => setAggregatorId(e.target.value)} className="block mt-1 w-full border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#137fec]">
          <option value="">Select an aggregator</option>
          {(Array.isArray(aggregators) ? aggregators : []).map(a => <option key={a.id} value={a.id}>{a.companyName} — {a.contactName} ({a.email})</option>)}
        </select>
      </label>
          {aggregators.length === 0 && <p className="text-sm text-slate-500">No aggregators available. Try Send directly again to reload.</p>}
          {aggregators.some(a => !a.id) && <p role="alert" className="text-sm text-rose-600">Aggregator list in unexpected format.</p>}
      <div className="flex gap-3">
        <button disabled={busy || !selected} onClick={() => {
          if (selected && window.confirm(`Send order ${order.intakeId} directly to ${selected.companyName}?`)) {
            void run(() => assignPharmacyOrder(order.id, selected.id, order.version ?? 0))
          }
        }} className="bg-[#137fec] text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40">Confirm send</button>
        <button disabled={busy} onClick={() => { setAggregators(null); setAggregatorId('') }} className={`${buttonClass} text-slate-600`}>Cancel</button>
      </div>
    </div>}
  </div>
}
