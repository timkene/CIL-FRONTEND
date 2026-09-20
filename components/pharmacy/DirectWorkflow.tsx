'use client'
import { useRef, useState } from 'react'
import { mutatePharmacyLifecycle, pharmacyMutationError, type StaffLifecycleRequest } from '@/lib/pharmacy-api'
import type { PharmacyOrder } from '@/lib/pharmacy-types'
import { ReviewActions } from './ReviewActions'

const postStates = ['awaiting_confirmation', 'completed', 'not_received', 'fulfilled']
export const isDirectOrder = (order: PharmacyOrder) => order.assignmentType === 'direct' || order.status.startsWith('direct_')
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `₦${value.toLocaleString()}` : 'Not recorded'
const label = (value: string) => value.replaceAll('_', ' ')

export function OrderHistory({ order }: { order: PharmacyOrder }) {
  return <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
    <h2 className="font-semibold">Order History</h2>
    {!order.history?.length && <p className="text-sm text-slate-500">No history recorded.</p>}
    {[...(order.history ?? [])].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? '')).map((event, i) => <div key={i} className="border-t border-slate-100 pt-3 text-sm space-y-1">
      <p className="font-semibold capitalize">{label(event.eventType)}</p>
      {event.timestamp && <p>{new Date(event.timestamp).toLocaleString()}</p>}
      {(event.actorName || event.actorId) && <p>By {event.actorName || event.actorId}{event.actorRole ? ` (${event.actorRole})` : ''}</p>}
      {(event.aggregatorName || event.aggregatorId) && <p>Aggregator: {event.aggregatorName || event.aggregatorId}</p>}
      {event.assignmentVersion != null && <p>Assignment attempt {event.assignmentVersion}</p>}
      {event.reason && <p className="whitespace-pre-wrap">Reason: {event.reason}</p>}
      {['winnerTotalPrice', 'totalPrice', 'directQuote'].map(field => {
        const extract = (value: unknown) => field === 'directQuote' && value && typeof value === 'object' ? (value as { totalPrice?: number }).totalPrice : value
        const oldPrice = extract(event.oldValues?.[field]), newPrice = extract(event.newValues?.[field])
        return typeof oldPrice === 'number' || typeof newPrice === 'number' ? <p key={field}>{field === 'directQuote' ? 'Aggregator quote' : 'Price'}: {money(oldPrice)} → {money(newPrice)}</p> : null
      })}
    </div>)}
  </section>
}

export function DirectWorkflow({ order, onComplete }: { order: PharmacyOrder; onComplete: () => Promise<void> }) {
  const [action, setAction] = useState<'approve' | 'adjust' | 'deny' | 'recall' | 'final' | 'cancel' | null>(null)
  const [price, setPrice] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const openedVersion = useRef(0)
  const direct = isDirectOrder(order)
  const post = postStates.includes(order.status)
  const terminal = ['cancelled', 'post_fulfilment_recalled'].includes(order.status)
  const recall = post || (direct && ['direct_quote_requested', 'direct_price_review', 'awaiting_fulfillment', 'accepted'].includes(order.status))
  const needsPrice = action === 'adjust' || action === 'final'
  const valid = (!needsPrice || (price.trim() !== '' && Number.isFinite(Number(price)) && Number(price) > 0)) && (action === 'approve' || (reason.trim().length > 0 && reason.trim().length <= 2000))
  const open = (next: typeof action) => { openedVersion.current = order.version ?? 0; setAction(next); setPrice(next === 'final' ? String(order.winnerTotalPrice ?? '') : ''); setReason(''); setError(null) }
  const submit = async () => {
    if (!action || !valid || locked.current) return
    if (openedVersion.current !== (order.version ?? 0)) { setAction(null); setError('This order was updated by someone else. Review the latest information and choose the action again.'); return }
    if (!window.confirm(`${action === 'approve' ? 'Approve submitted price' : label(action)} for ${order.intakeId}?${post ? ' Prior fulfilment remains recorded.' : ''}`)) return
    locked.current = true; setBusy(true); setError(null)
    const expectedVersion = order.version ?? 0
    const request: StaffLifecycleRequest = action === 'approve' ? { action: 'direct-approve', expectedVersion }
      : action === 'adjust' ? { action: 'direct-approve', expectedVersion, adjusted_price: Number(price), reason }
      : action === 'final' ? { action: 'adjust-price', expectedVersion, totalPrice: Number(price), reason }
      : { action: action === 'deny' ? 'direct-deny' : action, expectedVersion, reason }
    try { await mutatePharmacyLifecycle(order.id, request); setAction(null); await onComplete() }
    catch (err) { setAction(null); setError(await pharmacyMutationError(err, onComplete)) }
    finally { locked.current = false; setBusy(false) }
  }
  if (!direct && !post && !terminal) return null
  const button = 'px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold disabled:opacity-40'
  return <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
    <h2 className="font-semibold">{direct ? 'Direct Assignment' : 'Fulfilment administration'}</h2>
    {order.status === 'direct_reassignment' ? <>
      <p>Previous assignment is no longer active. Send to another pharmacy.</p>
      {order.denialComment && <p>Denial reason: {order.denialComment}</p>}
      <ReviewActions order={order} onComplete={onComplete} />
    </> : <p>{terminal ? 'Previous aggregator' : 'Aggregator'}: {order.winnerName || order.winnerId || 'Not recorded'}</p>}
    {direct && <p>{order.status === 'direct_reassignment' ? 'Previous Aggregator Quote' : 'Aggregator Quote'} (original order total): {money(order.directQuote?.totalPrice)}</p>}
    {order.directQuote?.submittedAt && <p>Quote submitted: {new Date(order.directQuote.submittedAt).toLocaleString()}</p>}
    {order.status !== 'direct_reassignment' && <p>Approved Price / Current Final Total: {money(order.winnerTotalPrice)}</p>}
    {order.status === 'direct_quote_requested' && <p>Sent directly to {order.winnerName || order.winnerId || 'selected aggregator'}. Waiting for pharmacy price.</p>}
    {order.status === 'direct_price_review' && <p>Pharmacy price submitted. Waiting for Clearline approval.</p>}
    {direct && order.status === 'awaiting_fulfillment' && <p>{order.priceApprovedAt ? 'Price approved. Waiting for aggregator acceptance / fulfilment.' : 'No price approval recorded. Legacy assignment must be recalled and reassigned for quoting.'}</p>}
    {direct && order.status === 'accepted' && <p>Accepted by aggregator. Waiting for fulfilment.</p>}
    {terminal && <p className="font-semibold text-rose-700">{order.status === 'cancelled' ? 'Cancelled' : 'Post-fulfilment recalled — reversal'}. Prior fulfilment remains recorded.</p>}
    {(post || terminal) && <div className="text-sm space-y-1">
      <p>Fulfilment remains recorded{order.fulfillmentType ? `: ${label(order.fulfillmentType)}` : '.'}</p>
      {order.fulfilledAt && <p>Fulfilled: {new Date(order.fulfilledAt).toLocaleString()}</p>}
      {order.completedAt && <p>Completed: {new Date(order.completedAt).toLocaleString()}</p>}
      {order.deliveryFee != null && <p>Delivery fee: {money(order.deliveryFee)} (included in final total)</p>}
    </div>}
    {error && <p role="alert" className="text-rose-700">{error}</p>}
    <div className="flex flex-wrap gap-2">
      {direct && order.status === 'direct_price_review' && <>
        <button className={button} disabled={busy} onClick={() => open('approve')}>Approve Price</button>
        <button className={button} disabled={busy} onClick={() => open('adjust')}>Adjust Price + Approve</button>
        <button className={`${button} text-rose-700`} disabled={busy} onClick={() => open('deny')}>Deny Price</button>
      </>}
      {post && <><button className={button} disabled={busy} onClick={() => open('final')}>Edit Price</button><button className={`${button} text-rose-700`} disabled={busy} onClick={() => open('cancel')}>Cancel Order</button></>}
      {recall && <button className={`${button} text-rose-700`} disabled={busy} onClick={() => open('recall')}>{post ? 'Recall / Reversal' : 'Recall'}</button>}
    </div>
    {(post || terminal) && <div><button disabled className={button} aria-describedby="pa-unavailable">Generate PA</button><p id="pa-unavailable" className="text-sm text-slate-500">{order.paGeneration?.available === false ? 'PA generation is not yet available for this workflow.' : 'PA generation is not configured for this workflow.'}</p></div>}
    {action && <div role="dialog" aria-label="Confirm pharmacy action" className="border border-amber-300 rounded-lg p-4 space-y-3">
      <p className="font-semibold">Confirm {label(action)}{post ? ' — fulfilment history will be preserved' : ''}</p>
      {needsPrice && <label className="block">{action === 'final' ? 'Final inclusive price (Naira)' : 'Approved Price (Naira)'}<input type="number" min="0.01" step="any" value={price} disabled={busy} onChange={e => setPrice(e.target.value)} className="block border rounded p-2" /></label>}
      {action !== 'approve' && <label className="block">Reason (required)<textarea maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} className="block border rounded p-2 w-full" /></label>}
      <button className={button} disabled={busy || !valid} onClick={() => void submit()}>Confirm action</button>{' '}
      <button className={button} disabled={busy} onClick={() => setAction(null)}>Close</button>
    </div>}
  </section>
}
