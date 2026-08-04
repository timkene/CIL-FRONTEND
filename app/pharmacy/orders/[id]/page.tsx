'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { BiddingTable } from '@/components/pharmacy/BiddingTable'
import { CountdownTimer } from '@/components/pharmacy/CountdownTimer'
import { StatusChip } from '@/components/pharmacy/StatusChip'
import { getPharmacyOrder, closePharmacyBidding, staffConfirmPharmacyReceipt, clearlineApprovePharmacyOrder, PharmacyApiError } from '@/lib/pharmacy-api'
import { generatePharmacyPA, getPharmacyPARecords, KlaireApiError } from '@/lib/klaire-api'
import type { PharmacyOrder, Bid, OrderStatus } from '@/lib/pharmacy-types'
import type { PharmacyPARecord, PharmacyMedicationAmount } from '@/lib/klaire-api'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_review: 'Pending Review',
  rejected: 'Rejected',
  bidding: 'Bidding Active',
  clearline_price_review: 'Clearline Price Review',
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
  const [closingBid, setClosingBid] = useState(false)
  const [confirmingReceipt, setConfirmingReceipt] = useState(false)
  const [approvingPrice, setApprovingPrice] = useState(false)
  const [adjustedPrice, setAdjustedPrice] = useState<string>('')
  const [paRecords, setPaRecords] = useState<PharmacyPARecord[]>([])
  const [showPaModal, setShowPaModal] = useState(false)
  const [generatingPa, setGeneratingPa] = useState(false)
  const [medAmounts, setMedAmounts] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try {
      const [data, paData] = await Promise.all([
        getPharmacyOrder(id),
        getPharmacyPARecords(id).catch(() => ({ pa_records: [], total: 0 })),
      ])
      setOrder(data)
      setBids(data.bids ?? [])
      setStatus(data.status)
      setPaRecords(paData.pa_records)
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
      <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#137fec]/10 flex items-center justify-center text-[#137fec] font-bold text-lg shrink-0">
            {order.enrollee.fullName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-900">{order.enrollee.fullName}</h1>
            {order.enrollee.enrolleeId && (
              <p className="font-mono text-sm text-slate-500">{order.enrollee.enrolleeId}</p>
            )}
            {order.provider && (
              <p className="text-xs text-slate-500 mt-0.5">
                Provider: <span className="font-semibold text-slate-900">{order.provider.providerName}</span>
                {order.provider.providerId && <span className="font-mono ml-1 text-slate-400">({order.provider.providerId})</span>}
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

        {/* Enrollee details grid */}
        {(() => {
          const e = order.enrollee
          const fields: [string, string | undefined | null][] = [
            ['Phone', e.phone],
            ['Address', e.address],
            ['Title', e.title],
            ['Gender', e.gender],
            ['Date of Birth', e.dateOfBirth],
            ['Plan Type', e.planType],
            ['Group / Employer', e.groupName],
            ['Email', e.email],
            ['Effective Date', e.effectiveDate],
            ['Termination Date', e.terminationDate],
          ]
          const visible = fields.filter(([, v]) => v)
          if (visible.length === 0) return null
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visible.map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
                  <p className={`text-sm font-medium ${
                    label === 'Termination Date' && e.isterminated
                      ? 'text-rose-600'
                      : 'text-slate-800'
                  }`}>{value}</p>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Medications table */}
        {order.medications.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Medications / Procedures</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Diagnosis', 'Medication / Procedure', 'Dosage', 'Qty', 'Tabs', 'Frequency', 'Duration'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {order.medications.map((med, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-3 py-2 text-slate-700">
                        {med.diagnosisCode && <span className="font-mono text-[#137fec] mr-1">{med.diagnosisCode}</span>}
                        {med.diagnosis}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {med.procedureCode && <span className="font-mono text-emerald-700 mr-1">{med.procedureCode}</span>}
                        {med.name}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{med.dosage}</td>
                      <td className="px-3 py-2 text-slate-600">{med.quantity}</td>
                      <td className="px-3 py-2 text-slate-600">{med.tablets}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{med.frequency || '—'}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{med.durationDays ? `${med.durationDays}d` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
        <div className="bg-[#137fec] rounded-lg p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-1">Bidding Window Active</p>
            <p className="text-white text-sm">
              {bids.length} aggregator{bids.length !== 1 ? 's' : ''} responding
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white/60 text-[32px]">hourglass_top</span>
              <CountdownTimer endsAt={order.biddingEndsAt} />
            </div>
            <button
              disabled={closingBid}
              onClick={async () => {
                if (!window.confirm(`Close bidding now? ${bids.length} bid${bids.length !== 1 ? 's' : ''} received. The cheapest will be selected.`)) return
                setClosingBid(true)
                try {
                  await closePharmacyBidding(id)
                  await load()
                } catch (err) {
                  setToast(err instanceof PharmacyApiError ? err.message : 'Failed to close bidding')
                } finally {
                  setClosingBid(false)
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {closingBid ? 'Closing…' : 'Close Bidding'}
            </button>
          </div>
        </div>
      )}

      {/* STATE 2.5: Clearline price review — internal approval gate */}
      {status === 'clearline_price_review' && (
        <div className="bg-white border border-amber-300 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <StatusChip status="pending" label="Clearline Price Review" />
            <span className="text-sm font-bold text-slate-900">Winner: {order.winnerName || '—'}</span>
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
            Bidding has closed. Review the winning price before the aggregator is notified.
            You may adjust the price (e.g. after an off-portal negotiation) before approving.
          </p>
          <div className="flex items-end gap-3 pt-1 border-t border-amber-200">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Adjusted Price (optional)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={order.winnerTotalPrice ? `₦${order.winnerTotalPrice.toLocaleString()}` : 'Enter amount'}
                value={adjustedPrice}
                onChange={e => setAdjustedPrice(e.target.value)}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <button
              disabled={approvingPrice}
              onClick={async () => {
                const parsed = adjustedPrice.trim() ? parseFloat(adjustedPrice) : undefined
                if (parsed !== undefined && isNaN(parsed)) {
                  setToast('Please enter a valid price')
                  return
                }
                setApprovingPrice(true)
                try {
                  await clearlineApprovePharmacyOrder(id, parsed)
                  setAdjustedPrice('')
                  await load()
                } catch (err) {
                  setToast(err instanceof PharmacyApiError ? err.message : 'Failed to approve price')
                } finally {
                  setApprovingPrice(false)
                }
              }}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {approvingPrice ? 'Approving…' : 'Approve & Notify Aggregator'}
            </button>
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
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 space-y-3">
          <StatusChip status="pending" label="Awaiting Enrollee Confirmation" />
          <p className="text-sm text-slate-500">
            Klaire has asked the enrollee to confirm receipt. Waiting for their reply.
          </p>
          <div className="pt-1 border-t border-amber-200">
            <p className="text-xs text-slate-500 mb-2">
              If the enrollee has confirmed via phone call or is unreachable, you can manually mark receipt here.
            </p>
            <button
              disabled={confirmingReceipt}
              onClick={async () => {
                if (!window.confirm('Confirm that the enrollee has received their medication? This will close the order and move it to payment.')) return
                setConfirmingReceipt(true)
                try {
                  await staffConfirmPharmacyReceipt(id)
                  await load()
                } catch (err) {
                  setToast(err instanceof PharmacyApiError ? err.message : 'Failed to confirm receipt')
                } finally {
                  setConfirmingReceipt(false)
                }
              }}
              className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {confirmingReceipt ? 'Confirming…' : 'Manually Confirm Receipt'}
            </button>
          </div>
        </div>
      )}

      {/* STATE 5: Completed */}
      {status === 'completed' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-emerald-700 font-bold text-lg mb-1">Order Completed</p>
              <p className="text-sm text-slate-500">The enrollee confirmed they received their medication.</p>
            </div>
            {paRecords.length === 0 && (
              <button
                onClick={() => {
                  const initial: Record<string, string> = {}
                  order.medications.forEach(m => {
                    if (m.procedureCode) initial[m.procedureCode] = ''
                  })
                  setMedAmounts(initial)
                  setShowPaModal(true)
                }}
                className="shrink-0 px-4 py-2 bg-[#137fec] hover:bg-[#137fec]/90 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Generate PA
              </button>
            )}
          </div>

          {/* PA Records */}
          {paRecords.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700 uppercase tracking-wider">PA Generated</p>
                <button
                  onClick={() => {
                    const initial: Record<string, string> = {}
                    order.medications.forEach(m => {
                      if (m.procedureCode) initial[m.procedureCode] = ''
                    })
                    setMedAmounts(initial)
                    setShowPaModal(true)
                  }}
                  className="text-xs text-[#137fec] hover:underline font-semibold"
                >
                  Generate another
                </button>
              </div>
              {paRecords.map(rec => (
                <div key={rec.pa_number} className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-emerald-800 font-bold text-base font-mono">{rec.pa_number}</span>
                    <span className="text-xs text-slate-500">by {rec.generated_by}</span>
                    <span className="text-xs text-slate-400">{new Date(rec.generated_at).toLocaleString()}</span>
                    {rec.fulfillment_type === 'delivered' && (
                      <span className="text-[10px] font-bold bg-[#137fec]/10 text-[#137fec] px-2 py-0.5 rounded uppercase tracking-wide">Delivery incl.</span>
                    )}
                  </div>
                  {rec.medication_amounts.length > 0 && (
                    <div className="text-xs text-slate-600 space-y-0.5">
                      {rec.medication_amounts.map((m, i) => (
                        <div key={i} className="flex gap-3">
                          <span className="font-mono text-[#137fec]">{m.procedure_code}</span>
                          <span className="flex-1 truncate">{m.procedure_desc || m.diagnosis_desc}</span>
                          <span className="font-semibold shrink-0">₦{m.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PA Generation Modal */}
      {showPaModal && order && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Generate PA</h3>
                <button
                  onClick={() => setShowPaModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-slate-500">
                Enter the approved amount for each medication/procedure. These will appear as
                <span className="font-semibold"> AmountRequested</span> and <span className="font-semibold">AmountGranted</span> in the PA.
                {order.fulfillmentType === 'delivered' && (
                  <span className="block mt-1 text-[#137fec]">
                    Delivery fee of ₦{order.deliveryFee?.toLocaleString() ?? '—'} will be added as PRE11.
                  </span>
                )}
              </p>

              <div className="space-y-3">
                {order.medications.map(med => (
                  <div key={med.procedureCode ?? med.name} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      {med.procedureCode && (
                        <span className="font-mono text-xs text-emerald-700 mr-1">{med.procedureCode}</span>
                      )}
                      <span className="text-sm text-slate-800 truncate">{med.name}</span>
                      <span className="text-xs text-slate-400 ml-1">× {med.quantity}</span>
                    </div>
                    <div className="shrink-0 w-36">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="₦ Amount"
                        value={medAmounts[med.procedureCode ?? ''] ?? ''}
                        onChange={e => setMedAmounts(prev => ({ ...prev, [med.procedureCode ?? '']: e.target.value }))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setShowPaModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={generatingPa}
                  onClick={async () => {
                    const amounts: PharmacyMedicationAmount[] = Object.entries(medAmounts)
                      .filter(([code]) => code)
                      .map(([procedure_code, amt]) => ({
                        procedure_code,
                        amount: parseFloat(amt) || 0,
                      }))
                    setGeneratingPa(true)
                    try {
                      const result = await generatePharmacyPA(id, amounts)
                      setShowPaModal(false)
                      setToast(`PA generated: ${result.pa_number}`)
                      await load()
                    } catch (err) {
                      const msg = err instanceof KlaireApiError ? err.message : 'Failed to generate PA'
                      setToast(msg)
                    } finally {
                      setGeneratingPa(false)
                    }
                  }}
                  className="px-4 py-2 bg-[#137fec] hover:bg-[#137fec]/90 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {generatingPa ? 'Generating…' : 'Generate PA'}
                </button>
              </div>
            </div>
          </div>
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
