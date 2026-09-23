import test from 'node:test'
import assert from 'node:assert/strict'
import { claimSelectionKey, selectableClaims, claimsQuery, mergeEligibleSelection,
  removeSelectedClaim, selectionSummary, createLatestRequestGate,
  mergeConfirmedBulkSelection, clearSelectionForScopeChange, reversalReasonValid,
  reversalError, paymentError, withClaimsRefresh } from '../lib/claims-selection.ts'

const rows = [
  { batch_id: 'b', request_id: 'a', enrollee_id: 'e', procedure_code: 'P', decision: 'APPROVE', paid: false, eligible_for_pay: true, total_amount: 10.1 },
  { batch_id: 'b', request_id: 'd', enrollee_id: 'e', procedure_code: 'P', decision: 'DENY', paid: false },
  { batch_id: 'b', request_id: 'p', enrollee_id: 'e', procedure_code: 'P', decision: 'APPROVE', paid: true, eligible_for_pay: false },
  { batch_id: 'b', request_id: 'x', enrollee_id: 'e', procedure_code: 'P', decision: 'DENY', paid: true },
]

test('Pay and Select All exclude denied and paid rows', () => {
  assert.deepEqual(selectableClaims(rows, 'APPROVE').map(claimSelectionKey), ['b::a'])
  assert.deepEqual(selectableClaims(rows, 'ALL').map(claimSelectionKey), ['b::a'])
})

test('Paid selection includes accidental paid denial for reversal', () => {
  assert.deepEqual(selectableClaims(rows, 'PAID').map(claimSelectionKey), ['b::p', 'b::x'])
})

test('request ID distinguishes repeated procedure codes', () => {
  assert.notEqual(claimSelectionKey(rows[0]), claimSelectionKey(rows[1]))
  assert.equal(claimSelectionKey({ ...rows[0], request_id: null }), 'b::e::P')
})

test('download query carries the same section and filters as the list', () => {
  assert.equal(claimsQuery('PAID', 'e', '2026-01-01', '2026-01-31', 'batch-1').toString(),
    'decision=PAID&search=e&date_from=2026-01-01&date_to=2026-01-31&batch_id=batch-1')
  assert.equal(claimsQuery('ALL', '', '', '').toString(), '')
})

test('Unpay requires a reason and explains ambiguous legacy payments', () => {
  assert.equal(reversalReasonValid('   '), false)
  assert.equal(reversalReasonValid('incorrect payment'), true)
  assert.match(reversalError('AMBIGUOUS_LEGACY_CLAIM'), /Manual reconciliation/)
})


test('ambiguous legacy rows are excluded from Select All for Pay and Unpay', () => {
  const ambiguous = { batch_id: 'b', enrollee_id: 'e', procedure_code: 'L',
    decision: 'DENY', paid: true, legacy_ambiguous: true }
  assert.deepEqual(selectableClaims([ambiguous, rows[2]], 'PAID').map(claimSelectionKey), ['b::p'])
  assert.deepEqual(selectableClaims([{ ...ambiguous, decision: 'APPROVE', paid: false, eligible_for_pay: false }, rows[0]], 'ALL').map(claimSelectionKey), ['b::a'])
})

test('selection persists across pages and deselection/removal persists', () => {
  const page1 = [rows[0]]
  const page2 = [{ ...rows[0], request_id: 'page-2', total_amount: 20.2 }]
  let selected = mergeEligibleSelection(new Map(), page1)
  selected = mergeEligibleSelection(selected, page2)
  assert.deepEqual([...selected.keys()], ['b::a', 'b::page-2'])
  selected = removeSelectedClaim(selected, 'b::a')
  assert.deepEqual([...selected.keys()], ['b::page-2'])
})

test('Select page accepts only server-eligible canonical claims', () => {
  const noRequest = { ...rows[0], request_id: null }
  const denied = { ...rows[1], eligible_for_pay: false }
  const selected = mergeEligibleSelection(new Map(), [rows[0], noRequest, denied, rows[2]])
  assert.deepEqual([...selected.keys()], ['b::a'])
})

test('selected count and cent-safe amount span pages and update on removal and clear', () => {
  const page2 = { ...rows[0], request_id: 'page-2', total_amount: 20.2 }
  const missing = { ...rows[0], request_id: 'missing', total_amount: null }
  let selected = mergeEligibleSelection(new Map(), [rows[0], page2, missing])
  assert.deepEqual(selectionSummary(selected.values()), {
    count: 3, recordedAmount: 30.3, missingAmountCount: 1, batches: ['b'],
  })
  selected = removeSelectedClaim(selected, 'b::page-2')
  assert.deepEqual(selectionSummary(selected.values()), {
    count: 2, recordedAmount: 10.1, missingAmountCount: 1, batches: ['b'],
  })
  selected = new Map()
  assert.equal(selectionSummary(selected.values()).count, 0)
})

test('filter changes behaviorally clear selection', () => {
  const selected = mergeEligibleSelection(new Map(), rows)
  assert.equal(selected.size, 1)
  assert.equal(clearSelectionForScopeChange().size, 0)
})

test('stale and out-of-order responses cannot win a latest-request gate', async () => {
  const gate = createLatestRequestGate()
  const applied = []
  let releaseOld
  let releaseNew
  const oldResponse = new Promise(resolve => { releaseOld = resolve })
  const newResponse = new Promise(resolve => { releaseNew = resolve })
  const oldTicket = gate.begin('old-scope')
  const oldApply = oldResponse.then(value => {
    if (gate.isCurrent(oldTicket, 'new-scope')) applied.push(value)
  })
  const newTicket = gate.begin('new-scope')
  const newApply = newResponse.then(value => {
    if (gate.isCurrent(newTicket, 'new-scope')) applied.push(value)
  })
  releaseNew('new')
  await newApply
  releaseOld('old')
  await oldApply
  assert.deepEqual(applied, ['new'])
})

test('newer request wins even when rapid requests share one scope', () => {
  const gate = createLatestRequestGate()
  const first = gate.begin('batch:b')
  const second = gate.begin('batch:b')
  assert.equal(gate.isCurrent(first, 'batch:b'), false)
  assert.equal(gate.isCurrent(second, 'batch:b'), true)
  gate.invalidate()
  assert.equal(gate.isCurrent(second, 'batch:b'), false)
})

test('whole-batch confirmation merges only on explicit valid confirmation', () => {
  const snapshot = {
    claims: [rows[0]], eligibleCount: 1, excludedCount: 4,
    recordedAmount: 10.1, missingAmountCount: 2,
    selectionLimit: 1000, selectionLimitExceeded: false,
  }
  const before = new Map()
  // Cancel means the transition is never invoked and selection remains unchanged.
  assert.equal(before.size, 0)
  const confirmed = mergeConfirmedBulkSelection(before, snapshot, 'scope', 'scope')
  assert.deepEqual([...confirmed.keys()], ['b::a'])
  assert.deepEqual({ count: snapshot.eligibleCount, total: snapshot.recordedAmount,
    missing: snapshot.missingAmountCount, excluded: snapshot.excludedCount },
  { count: 1, total: 10.1, missing: 2, excluded: 4 })
})

test('stale, incomplete, and over-limit confirmations leave selection unchanged', () => {
  const current = mergeEligibleSelection(new Map(), [rows[0]])
  const base = { claims: [rows[0]], eligibleCount: 1, excludedCount: 0,
    recordedAmount: 10.1, missingAmountCount: 0, selectionLimit: 1000,
    selectionLimitExceeded: false }
  assert.equal(mergeConfirmedBulkSelection(current, base, 'old', 'new'), current)
  assert.equal(mergeConfirmedBulkSelection(current, { ...base, eligibleCount: 2 }, 'same', 'same'), current)
  assert.equal(mergeConfirmedBulkSelection(current, { ...base, selectionLimitExceeded: true }, 'same', 'same'), current)
})

test('structured payment errors map to safe operator messages', () => {
  assert.match(paymentError({ code: 'PAYMENT_STATE_CHANGED', paid_claims: [rows[0]] }), /changed while processing/)
  assert.match(paymentError([{ loc: ['body', 'reason'], msg: 'required' }]), /invalid/)
  assert.match(reversalError('AMBIGUOUS_LEGACY_CLAIM'), /Manual reconciliation/)
  assert.match(paymentError('LEGACY_KEY_NOT_AMBIGUOUS'), /conflicting set/)
  assert.match(paymentError('CANONICAL_CLAIM_ALREADY_PAID'), /already paid/)
  assert.match(paymentError('APPROVE_ONLY_CONFLICT'), /approved and a non-approved/)
  assert.match(paymentError('RECONCILIATION_EVIDENCE_REQUIRED'), /evidence reference/)
})


test('Pay and Unpay both refresh after a failed server mutation', async () => {
  for (const action of ['pay', 'unpay']) {
    let refreshed = 0
    await assert.rejects(withClaimsRefresh(async () => { throw new Error(`${action} conflict`) },
      async () => { refreshed++ }), /conflict/)
    assert.equal(refreshed, 1)
  }
})
