export interface ClaimSelectionRow {
  batch_id: string
  request_id?: string | null
  enrollee_id: string
  procedure_code: string
  decision: string
  paid: boolean
  legacy_ambiguous?: boolean
}

export function claimSelectionKey(row: ClaimSelectionRow): string {
  return row.request_id
    ? `${row.batch_id}::${row.request_id}`
    : `${row.batch_id}::${row.enrollee_id}::${row.procedure_code}`
}

export function selectableClaims<T extends ClaimSelectionRow>(rows: T[], section: string): T[] {
  return rows.filter(row => !row.legacy_ambiguous && (section === 'PAID'
    ? row.paid
    : row.decision === 'APPROVE' && !row.paid))
}

export function claimsQuery(section: string, search: string, dateFrom: string, dateTo: string): URLSearchParams {
  const params = new URLSearchParams()
  if (section !== 'ALL') params.set('decision', section)
  if (search) params.set('search', search)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  return params
}

export function reversalReasonValid(reason: string): boolean {
  return reason.trim().length > 0
}

export function paymentError(detail: unknown): string {
  const code = typeof detail === 'string' ? detail
    : detail && typeof detail === 'object' && 'code' in detail ? String(detail.code)
    : Array.isArray(detail) ? 'INVALID_REQUEST' : 'UNKNOWN'
  const messages: Record<string, string> = {
    AMBIGUOUS_LEGACY_CLAIM: 'Multiple historical claim lines share this old identifier. Manual reconciliation is required before payment can be reversed.',
    AMBIGUOUS_PAYMENT_RECORD: 'Conflicting payment records require manual reconciliation.',
    CLAIM_NOT_APPROVED: 'A claim is no longer approved. Review the refreshed Claims list.',
    CLAIM_NOT_FOUND: 'A selected claim changed or is unavailable. Review the refreshed Claims list.',
    PAYMENT_STATE_CHANGED: 'A payment changed while processing. Review the refreshed Claims list.',
    PAYMENT_WRITE_FAILED: 'The payment write failed. The stopped claim may need manual review.',
    ALREADY_PAID: 'A selected claim is already paid.',
    PAYMENT_NOT_FOUND: 'The selected payment could not be found.',
    DUPLICATE_CLAIM: 'The same claim was selected more than once.',
    INVALID_REQUEST: 'The request is invalid. Check the selected claims and required fields.',
    LEGACY_KEY_NOT_AMBIGUOUS: 'This legacy key does not identify a conflicting set of claims.',
    CANONICAL_CLAIM_ALREADY_PAID: 'The selected canonical claim is already paid. Reconciliation was stopped.',
    APPROVE_ONLY_CONFLICT: 'This reconciliation path requires both an approved and a non-approved claim.',
    RECONCILIATION_EVIDENCE_REQUIRED: 'Enter a reason and evidence reference, and confirm no provider payment occurred.',
  }
  return messages[code] || 'Payment operation failed. Review the refreshed Claims list.'
}

export function reversalError(detail: unknown): string { return paymentError(detail) }

export async function withClaimsRefresh<T>(mutation: () => Promise<T>, refresh: () => Promise<void>): Promise<T> {
  try { return await mutation() }
  finally { await refresh() }
}
