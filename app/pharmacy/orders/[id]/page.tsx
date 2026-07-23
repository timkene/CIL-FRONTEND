'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { BiddingTable } from '@/components/pharmacy/BiddingTable'
import { CountdownTimer } from '@/components/pharmacy/CountdownTimer'
import { MedicationTag } from '@/components/pharmacy/MedicationTag'
import { StatusChip } from '@/components/pharmacy/StatusChip'
import { getPharmacyOrder, PharmacyApiError } from '@/lib/pharmacy-api'
import type { PharmacyOrder, Bid, OrderStatus } from '@/lib/pharmacy-types'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_review: 'Pending Review',
  rejected: 'Rejected',
  bidding: 'Bidding Active',
  awaiting_fulfillment: 'Awaiting Acceptance',
  accepted: 'Order Accepted',
  awaiting_confirmation: 'Awaiting Enrollee Confirmation',
  completed: 'Completed',
  not_received: 'Not Received — Follow Up Required',
}

function OrderSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-100 rounded w-1/3" />
      <div className="h-32 bg-slate-100 rounded" />
      <div className="h-64 bg-slate-100 rounded" />
    </div>
  )
}

export default function PharmacyOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [order, setOrder] = useState<PharmacyOrder | null>(null)
  const [bids, setBids] = useState<Bid[]>([])
  const [status, setStatus] = useState<OrderStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getPharmacyOrder(id)
      setOrder(data)
      setBids(data.bids ?? [])
      setStatus(data.status)
    } catch (err) {
      setToast(err instanceof PharmacyApiError ? err.message : 'Failed to load order')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Poll while non-terminal; 10s for bidding, 30s for other active, 60s for pending
  useEffect(() => {
    const isTerminal = status === 'completed' || status === 'not_received'
    if (isTerminal) return
    const interval = status === 'bidding' ? 10_000 : (status === 'pending_review' || status === 'rejected') ? 60_000 : 30_000
    const id = setInterval(load, interval)
    return () => clearInterval(id)
  }, [load, status])

  if (loading) {
    return (
      <div className="p-8"><OrderSkeleton /></div>
    )
  }

  if (!order || !status) return null

  const avgBidPrice = bids.length > 0
    ? bids.reduce((sum, b) => sum + b.totalPrice, 0) / bids.length
    : 0
  const savings = order.winnerTotalPrice && avgBidPrice > 0
    ? avgBidPrice - order.winnerTotalPrice
    : 0

  return (
    <div className="p-8 space-y-6">
      {toast && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-rose-400 hover:text-rose-600 ml-4">✕</button>
        </div>
      )}

      <nav className="text-sm text-slate-400">
        <Link href="/pharmacy" className="hover:text-[#137fec]">Pharmacy</Link>
        {' › '}
        <span className="font-mono text-slate-700">{order.intakeId}</span>
      </nav>

      {/* Prescription summary card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-[#137fec]/10 flex items-center justify-center text-[#137fec] font-bold text-lg shrink-0">
            {order.enrollee.fullName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{order.enrollee.fullName}</h1>
            <p className="text-sm text-slate-500">
              {order.enrollee.enrolleeId && (
                <span className="font-mono mr-2">{order.enrollee.enrolleeId}</span>
              )}
              {order.medications.map(m => m.diagnosis).filter(Boolean).join(' · ')}
            </p>
            {order.enrollee.phone && (
              <p className="text-xs text-slate-500 mt-0.5">
                Phone: <span className="font-semibold text-slate-900">{order.enrollee.phone}</span>
              </p>
            )}
            {order.enrollee.address && (
              <p className="text-xs text-slate-500 mt-0.5">
                Address: <span className="font-semibold text-slate-900">{order.enrollee.address}</span>
              </p>
            )}
            {order.provider && (
              <p className="text-xs text-slate-500 mt-0.5">
                Provider: <span className="font-semibold text-slate-900">{order.provider.providerName}</span>
              </p>
            )}
          </div>
          <StatusChip
            status={
              status === 'completed' ? 'active'
              : status === 'not_received' || status === 'rejected' ? 'error'
              : status === 'bidding' ? 'info'
              : 'pending'
            }
            label={STATUS_LABELS[status]}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {order.medications.map((med, i) => <MedicationTag key={i} med={med} />)}
        </div>
      </div>

      {/* STATE 0a: Pending Review */}
      {status === 'pending_review' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <p className="text-amber-800 font-bold text-base mb-1">Awaiting Pharmacist Review</p>
          <p className="text-sm text-slate-500">
            This prescription is in the holding queue. An authorised staff member must approve it before it is sent to aggregators for bidding.
          </p>
          <div className="mt-3 flex gap-3">
            <Link
              href={`/pharmacy/intake/new?editId=${order.id}`}
              className="text-sm text-[#137fec] hover:underline font-semibold"
            >
              Edit Prescription
            </Link>
            <Link href="/pharmacy" className="text-sm text-slate-500 hover:underline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      )}

      {/* STATE 0b: Rejected */}
      {status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-5">
          <p className="text-rose-700 font-bold text-base mb-1">Prescription Rejected</p>
          <p className="text-sm text-slate-500">
            The pharmacist has flagged an issue with this prescription. Edit and resubmit it for another review.
          </p>
          <div className="mt-3">
            <Link
              href={`/pharmacy/intake/new?editId=${order.id}`}
              className="inline-flex items-center gap-1 bg-[#137fec] hover:bg-[#137fec]/90 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
              Edit &amp; Resubmit
            </Link>
          </div>
        </div>
      )}

      {/* STATE 1: Bidding Active */}
      {status === 'bidding' && (
        <div className="bg-[#137fec] rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Bidding Window Active</p>
            <p className="text-white text-sm">
              {bids.length} aggregator{bids.length !== 1 ? 's' : ''} responding
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/60 text-[32px]">hourglass_top</span>
            <CountdownTimer endsAt={order.biddingEndsAt} />
          </div>
        </div>
      )}

      {/* STATE 2: Winner selected — awaiting acceptance */}
      {status === 'awaiting_fulfillment' && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusChip status="pending" label="Awaiting Acceptance" />
            <span className="text-sm font-bold text-slate-900">Winner: {order.winnerName}</span>
            {order.winnerTotalPrice && (
              <span className="font-mono text-sm font-semibold text-slate-700">
                ₦{order.winnerTotalPrice.toLocaleString()}
              </span>
            )}
            {savings > 0 && (
              <span className="text-sm text-emerald-700">
                ↓ ₦{savings.toLocaleString()} saved vs avg
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {order.winnerName
              ? `Waiting for ${order.winnerName} to accept. The enrollee has been notified via WhatsApp.`
              : 'Bidding closed with no bids received.'}
          </p>
        </div>
      )}

      {/* STATE 3: Accepted */}
      {status === 'accepted' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 space-y-1">
          <div className="flex items-center gap-3">
            <StatusChip status="active" label="Order Accepted" />
            <span className="text-sm font-bold text-slate-900">{order.winnerName}</span>
            <span className="font-mono text-sm text-slate-700">₦{order.winnerTotalPrice?.toLocaleString()}</span>
          </div>
          <p className="text-sm text-slate-500">
            The pharmacy has accepted and is preparing the medication. The enrollee has been notified.
          </p>
        </div>
      )}

      {/* STATE 4: Awaiting confirmation */}
      {status === 'awaiting_confirmation' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
          <StatusChip status="pending" label="Awaiting Enrollee Confirmation" />
          <p className="text-sm text-slate-500 mt-2">
            Klaire has asked the enrollee to confirm receipt. Waiting for their reply.
          </p>
        </div>
      )}

      {/* STATE 5: Completed */}
      {status === 'completed' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
          <p className="text-emerald-700 font-bold text-lg mb-1">Order Completed</p>
          <p className="text-sm text-slate-500">The enrollee confirmed they received their medication.</p>
        </div>
      )}

      {/* STATE 6: Not received */}
      {status === 'not_received' && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-5">
          <p className="text-rose-600 font-bold text-lg mb-1">Medication Not Received</p>
          <p className="text-sm text-slate-500">
            The enrollee reported they did not receive their medication.
            Please follow up with {order.winnerName} immediately.
          </p>
        </div>
      )}

      <BiddingTable bids={bids} />
    </div>
  )
}
