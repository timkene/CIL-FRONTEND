export interface ClaimSelectionRow {
  batch_id: string
  request_id?: string | null
  enrollee_id: string
  procedure_code: string
  decision: string
  paid: boolean
  legacy_ambiguous?: boolean
  eligible_for_pay?: boolean
  total_amount?: number | null
}

export function claimSelectionKey(row: ClaimSelectionRow): string {
  return row.request_id
    ? `${row.batch_id}::${row.request_id}`
    : `${row.batch_id}::${row.enrollee_id}::${row.procedure_code}`
}

export function selectableClaims<T extends ClaimSelectionRow>(rows: T[], section: string): T[] {
  return rows.filter(row => !row.legacy_ambiguous && (section === 'PAID'
    ? row.paid
    : row.eligible_for_pay === true && Boolean(row.request_id)))
}

export function claimsQuery(section: string, search: string, dateFrom: string, dateTo: string,
                            batchId = ''): URLSearchParams {
  const params = new URLSearchParams()
  if (section !== 'ALL') params.set('decision', section)
  if (search) params.set('search', search)
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  if (batchId) params.set('batch_id', batchId)
  return params
}

export function mergeEligibleSelection<T extends ClaimSelectionRow>(current: Map<string, T>, rows: T[]): Map<string, T> {
  const next = new Map(current)
  for (const row of rows) {
    if (row.eligible_for_pay === true && row.request_id) next.set(claimSelectionKey(row), row)
  }
  return next
}

export function removeSelectedClaim<T>(current: Map<string, T>, key: string): Map<string, T> {
  const next = new Map(current)
  next.delete(key)
  return next
}

export function selectionSummary(rows: Iterable<ClaimSelectionRow>) {
  let count = 0
  let recordedCents = 0
  let missingAmountCount = 0
  const batches = new Set<string>()
  for (const row of rows) {
    count++
    batches.add(row.batch_id)
    if (row.total_amount == null || !Number.isFinite(row.total_amount)) missingAmountCount++
    else recordedCents += Math.round(row.total_amount * 100)
  }
  return { count, recordedAmount: recordedCents / 100, missingAmountCount,
    batches: [...batches].sort() }
}

export interface RequestTicket {
  generation: number
  scope: string
}

/** A tiny deterministic guard for fetches whose responses may arrive out of order. */
export function createLatestRequestGate() {
  let generation = 0
  return {
    begin(scope: string): RequestTicket {
      generation += 1
      return { generation, scope }
    },
    isCurrent(ticket: RequestTicket, currentScope: string): boolean {
      return ticket.generation === generation && ticket.scope === currentScope
    },
    invalidate(): void { generation += 1 },
  }
}

export interface BulkSelectionSnapshot<T extends ClaimSelectionRow> {
  claims: T[]
  eligibleCount: number
  excludedCount: number
  recordedAmount: number
  missingAmountCount: number
  selectionLimit: number
  selectionLimitExceeded: boolean
}

export function mergeConfirmedBulkSelection<T extends ClaimSelectionRow>(
  current: Map<string, T>, snapshot: BulkSelectionSnapshot<T>,
  capturedScope: string, currentScope: string,
): Map<string, T> {
  if (capturedScope !== currentScope || snapshot.selectionLimitExceeded ||
      snapshot.claims.length !== snapshot.eligibleCount) return current
  return mergeEligibleSelection(current, snapshot.claims)
}

export function clearSelectionForScopeChange<T>(): Map<string, T> {
  return new Map()
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
