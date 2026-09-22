import test from 'node:test'
import assert from 'node:assert/strict'
import { claimSelectionKey, selectableClaims, claimsQuery, reversalReasonValid, reversalError, paymentError, withClaimsRefresh } from '../lib/claims-selection.ts'

const rows = [
  { batch_id: 'b', request_id: 'a', enrollee_id: 'e', procedure_code: 'P', decision: 'APPROVE', paid: false },
  { batch_id: 'b', request_id: 'd', enrollee_id: 'e', procedure_code: 'P', decision: 'DENY', paid: false },
  { batch_id: 'b', request_id: 'p', enrollee_id: 'e', procedure_code: 'P', decision: 'APPROVE', paid: true },
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
  assert.equal(claimsQuery('PAID', 'e', '2026-01-01', '2026-01-31').toString(),
    'decision=PAID&search=e&date_from=2026-01-01&date_to=2026-01-31')
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
  assert.deepEqual(selectableClaims([{ ...ambiguous, decision: 'APPROVE', paid: false }, rows[0]], 'ALL').map(claimSelectionKey), ['b::a'])
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
