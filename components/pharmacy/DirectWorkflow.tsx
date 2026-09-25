'use client'
import { useRef, useState } from 'react'
import { generatePharmacyPA, markInterruptedPharmacyPA, verifyPharmacyPALine, mutatePharmacyLifecycle, pharmacyMutationError, type StaffLifecycleRequest } from '@/lib/pharmacy-api'
import type { PharmacyOrder, PharmacyProcedurePrice } from '@/lib/pharmacy-types'
import { ReviewActions } from './ReviewActions'

const postStates = ['awaiting_confirmation', 'completed', 'not_received', 'fulfilled']
export const isDirectOrder = (order: PharmacyOrder) => order.assignmentType === 'direct' || order.status.startsWith('direct_')
const money = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `₦${value.toLocaleString()}` : 'Not recorded'
const label = (value: string) => value.replaceAll('_', ' ')
const validMoney = (value: string) => /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0 && Number.isFinite(Number(value))
const currentLines = (order: PharmacyOrder) => order.finalProcedurePrices ?? order.approvedProcedurePrices ?? order.quotedProcedurePrices ?? order.directQuote?.procedurePrices ?? []
const prices = (title: string, order: PharmacyOrder, lines?: PharmacyProcedurePrice[] | null) => lines?.length ? <div className="text-sm space-y-1"><p className="font-semibold">{title}</p>{lines.map(line => { const med = order.medications.find(item => item.lineId === line.medicationLineId); return <p key={line.medicationLineId}>{line.procedureCode} — {med?.name ?? 'Medication'} · {med?.quantity ?? '?'} units{med?.dosage ? ` · ${med.dosage}` : ''}: line total {money(line.amount)}</p> })}</div> : null

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
  const [lineValues, setLineValues] = useState<Record<string, string>>({})
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [paConfirmVersion, setPaConfirmVersion] = useState<number | null>(null)
  const [recoveryLine, setRecoveryLine] = useState<string | null>(null)
  const [recoveryResolution, setRecoveryResolution] = useState<'existing_pa' | 'confirmed_no_pa'>('existing_pa')
  const [paNumber, setPaNumber] = useState('')
  const [verificationMethod, setVerificationMethod] = useState('')
  const [checkedWith, setCheckedWith] = useState('')
  const [recoveryEvidence, setRecoveryEvidence] = useState('')
  const [confirmNoPaCreated, setConfirmNoPaCreated] = useState(false)
  const locked = useRef(false)
  const openedVersion = useRef(0)
  const direct = isDirectOrder(order)
  const post = postStates.includes(order.status)
  const terminal = ['cancelled', 'post_fulfilment_recalled'].includes(order.status)
  const recall = post || (direct && ['direct_quote_requested', 'direct_price_review', 'awaiting_fulfillment', 'accepted'].includes(order.status))
  const needsPrice = action === 'adjust' || action === 'final'
  const hasLines = currentLines(order).length > 0
  const linePrices = (): PharmacyProcedurePrice[] | null => {
    const source = currentLines(order)
    if (!source.length || source.length !== order.medications.length) return null
    if (source.some(line => !validMoney(lineValues[line.medicationLineId] ?? ''))) return null
    return source.map(line => ({ ...line, amount: Number(lineValues[line.medicationLineId]) }))
  }
  const valid = (!needsPrice || (hasLines ? linePrices() !== null : validMoney(price))) && (action === 'approve' || (reason.trim().length > 0 && reason.trim().length <= 2000))
  const open = (next: typeof action) => {
    openedVersion.current = order.version ?? 0; setAction(next)
    setPrice(next === 'final' ? String(order.winnerTotalPrice ?? '') : '')
    setLineValues(Object.fromEntries(currentLines(order).map(line => [line.medicationLineId, String(line.amount)])))
    setReason(''); setError(null)
  }
  const submit = async () => {
    if (!action || !valid || locked.current) return
    if (openedVersion.current !== (order.version ?? 0)) { setAction(null); setError('This order was updated by someone else. Review the latest information and choose the action again.'); return }
    if (!window.confirm(`${action === 'approve' ? 'Approve submitted price' : label(action)} for ${order.intakeId}?${post ? ' Prior fulfilment remains recorded.' : ''}`)) return
    locked.current = true; setBusy(true); setError(null)
    const expectedVersion = order.version ?? 0
    const request: StaffLifecycleRequest = action === 'approve' ? { action: 'direct-approve', expectedVersion }
      : action === 'adjust' ? hasLines ? { action: 'direct-approve', expectedVersion, procedurePrices: linePrices()!, reason } : { action: 'direct-approve', expectedVersion, reason, adjusted_price: Number(price) }
      : action === 'final' ? hasLines ? { action: 'adjust-price', expectedVersion, procedurePrices: linePrices()!, reason } : { action: 'adjust-price', expectedVersion, totalPrice: Number(price), reason }
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
    {prices('Aggregator quote by procedure', order, order.quotedProcedurePrices ?? order.directQuote?.procedurePrices)}
    {prices('Staff approved procedure prices', order, order.approvedProcedurePrices)}
    {prices('Current final procedure prices', order, order.finalProcedurePrices)}
    {order.directQuote?.submittedAt && <p>Quote submitted: {new Date(order.directQuote.submittedAt).toLocaleString()}</p>}
    {order.status !== 'direct_reassignment' && <><p>Medication subtotal: {money(order.medicationSubtotal)}</p><p>Overall total: {money(order.overallTotal ?? order.winnerTotalPrice)}</p></>}
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
      {post && <><button className={button} disabled={busy || !!order.paGeneration?.lines?.length} onClick={() => open('final')}>Edit Price</button><button className={`${button} text-rose-700`} disabled={busy || !!order.paGeneration?.lines?.length} onClick={() => open('cancel')}>Cancel Order</button></>}
      {recall && <button className={`${button} text-rose-700`} disabled={busy || !!order.paGeneration?.lines?.length} onClick={() => open('recall')}>{post ? 'Recall / Reversal' : 'Recall'}</button>}
    </div>
    {(post || terminal) && <div className="space-y-2">
      <p>PA status: {label(order.paGeneration?.status ?? 'not_generated')}</p>
      {order.paGeneration?.lines?.map(line => <p key={line.lineId} className="text-sm">{line.procedureCode} — {money(line.amount)}: {label(line.status)}{line.paNumber ? ` · PA ${line.paNumber}` : ''}</p>)}
      {order.paGeneration?.status === 'verification_required' && <p role="alert" className="text-amber-800">A PA result is uncertain. Verify it with MediCloud and ask an authorized PA recovery staff member to record the outcome before any resubmission.</p>}
      {order.paGeneration?.lines?.filter(line => line.status === 'verification_required').map(line => <button key={line.lineId} className={button} disabled={busy} onClick={() => { setRecoveryLine(line.lineId); setRecoveryEvidence(''); setPaNumber(''); setVerificationMethod(''); setCheckedWith(''); setConfirmNoPaCreated(false) }}>Record verified outcome for {line.procedureCode}</button>)}
      {order.paGeneration?.interrupted && <div role="alert" className="text-amber-800">PA submission was interrupted. Its result may be unknown. An authorized recovery staff member must mark it for verification before resolving the line.<button className={button} disabled={busy} onClick={async () => { setBusy(true); try { await markInterruptedPharmacyPA(order.id); await onComplete() } catch (err) { setError(await pharmacyMutationError(err, onComplete)) } finally { setBusy(false) } }}>Mark interrupted PA for verification</button></div>}
      {order.status !== 'completed' && <p className="text-sm text-slate-500">PA generation is available only after completion.</p>}
      {order.status === 'completed' && !hasLines && <p className="text-sm text-slate-500">This legacy order has no procedure prices; PA amounts cannot be inferred.</p>}
      {order.status === 'completed' && hasLines && <button className={button} disabled={generating || busy || order.paGeneration?.active || order.paGeneration?.interrupted || ['generated', 'verification_required'].includes(order.paGeneration?.status ?? '')}
        onClick={() => { setPaConfirmVersion(order.version ?? 0); setError(null) }}>
        {generating ? 'Generating…' : order.paGeneration?.status === 'partial_failure' ? 'Retry safe PA lines' : 'Generate PA'}
      </button>}
      {paConfirmVersion !== null && <div role="dialog" aria-label="Confirm PA generation" className="border border-amber-300 rounded-lg p-4 space-y-2">
        <p className="font-semibold">Confirm PA submission for order version {paConfirmVersion}</p>
        <p>Aggregator: {order.winnerName || order.winnerId || 'Not recorded'}</p>
        {prices('Medication PA line totals', order, order.finalProcedurePrices)}
        {order.fulfillmentType === 'delivered' && <p>Delivery PRE11: {money(order.deliveryFee)}</p>}
        <p>Medication subtotal: {money(order.medicationSubtotal)}</p><p>Overall total: {money(order.overallTotal)}</p>
        <button className={button} disabled={generating || paConfirmVersion !== (order.version ?? 0)} onClick={async () => {
          if (generating) return
          const version = paConfirmVersion; setPaConfirmVersion(null); setGenerating(true); setError(null)
          try { await generatePharmacyPA(order.id, version) }
          catch (err) { setError(err instanceof Error ? `${err.message} Refresh and verify the order before another PA attempt.` : 'PA result may be unknown. Refresh and verify the order before another attempt.') }
          finally { try { await onComplete() } catch { setError('PA result may be unknown. Refresh and verify the order before another attempt.') } setGenerating(false) }
        }}>Confirm and submit PA</button>{' '}
        <button className={button} disabled={generating} onClick={() => setPaConfirmVersion(null)}>Close</button>
      </div>}
      {recoveryLine && <div role="dialog" aria-label="Record PA verification" className="border border-amber-300 rounded-lg p-4 space-y-2">
        <p className="font-semibold">Record externally verified PA outcome</p>
        <p>Line: {order.paGeneration?.lines?.find(line => line.lineId === recoveryLine)?.procedureCode}</p>
        <label className="block">Outcome<select value={recoveryResolution} onChange={e => setRecoveryResolution(e.target.value as 'existing_pa' | 'confirmed_no_pa')} className="block border rounded p-2"><option value="existing_pa">Existing PA found</option><option value="confirmed_no_pa">Confirmed no PA created</option></select></label>
        {recoveryResolution === 'existing_pa' ? <label className="block">Verified PA number<input value={paNumber} onChange={e => setPaNumber(e.target.value)} className="block border rounded p-2" /></label>
          : <label className="block"><input type="checkbox" checked={confirmNoPaCreated} onChange={e => setConfirmNoPaCreated(e.target.checked)} /> I explicitly confirmed no PA was created</label>}
        <label className="block">Verification method<input value={verificationMethod} onChange={e => setVerificationMethod(e.target.value)} className="block border rounded p-2" /></label>
        <label className="block">Who or what was checked<input value={checkedWith} onChange={e => setCheckedWith(e.target.value)} className="block border rounded p-2" /></label>
        <label className="block">Reason and notes<textarea value={recoveryEvidence} onChange={e => setRecoveryEvidence(e.target.value)} className="block border rounded p-2 w-full" /></label>
        <button className={button} disabled={busy || recoveryEvidence.trim().length < 10 || !verificationMethod.trim() || !checkedWith.trim() || (recoveryResolution === 'existing_pa' ? !paNumber.trim() : !confirmNoPaCreated)} onClick={async () => {
          setBusy(true); setError(null)
          try { await verifyPharmacyPALine(order.id, recoveryLine, { resolution: recoveryResolution, evidence: recoveryEvidence, ...(recoveryResolution === 'existing_pa' ? { paNumber: paNumber.trim() } : { confirmNoPaCreated: true }), verificationMethod, checkedWith, verifiedAt: new Date().toISOString() }); setRecoveryLine(null); await onComplete() }
          catch (err) { setError(await pharmacyMutationError(err, onComplete)) }
          finally { setBusy(false) }
        }}>Save verified outcome</button>{' '}<button className={button} disabled={busy} onClick={() => setRecoveryLine(null)}>Close</button>
      </div>}
    </div>}
    {action && <div role="dialog" aria-label="Confirm pharmacy action" className="border border-amber-300 rounded-lg p-4 space-y-3">
      <p className="font-semibold">Confirm {label(action)}{post ? ' — fulfilment history will be preserved' : ''}</p>
      {needsPrice && (hasLines ? currentLines(order).map(line => <label key={line.medicationLineId} className="block">{line.procedureCode} final procedure price (Naira)<input type="number" min="0.01" step="0.01" value={lineValues[line.medicationLineId] ?? ''} disabled={busy} onChange={e => setLineValues(prev => ({ ...prev, [line.medicationLineId]: e.target.value }))} className="block border rounded p-2" /></label>) : <label className="block">Legacy total price (Naira)<input type="number" min="0.01" step="0.01" value={price} disabled={busy} onChange={e => setPrice(e.target.value)} className="block border rounded p-2" /></label>)}
      {action !== 'approve' && <label className="block">Reason (required)<textarea maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} className="block border rounded p-2 w-full" /></label>}
      <button className={button} disabled={busy || !valid} onClick={() => void submit()}>Confirm action</button>{' '}
      <button className={button} disabled={busy} onClick={() => setAction(null)}>Close</button>
    </div>}
  </section>
}
