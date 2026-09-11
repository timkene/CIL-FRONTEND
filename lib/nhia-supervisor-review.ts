export const SUPERVISOR_REVIEW_HEADER = 'X-Nhia-Supervisor-Review'

export type ReviewState = {
  overrides: Record<string, 'APPROVE' | 'DENY'>
  qtyEdits: Record<string, number>
  priceEdits: Record<string, number>
  overrideReasons: Record<string, string>
  notes: string
  reviewer: string
}

export function supervisorReviewHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return { [SUPERVISOR_REVIEW_HEADER]: '1', ...headers }
}

export function reviewSnapshot(state: ReviewState): string {
  return JSON.stringify({
    overrides: state.overrides,
    qty_edits: state.qtyEdits,
    price_edits: state.priceEdits,
    override_reasons: state.overrideReasons,
    notes: state.notes,
    reviewer: state.reviewer,
  })
}

export function reviewIsDirty(current: ReviewState, savedSnapshot: string): boolean {
  return reviewSnapshot(current) !== savedSnapshot
}

export function hasReviewLineItems(batch: { vetting_results?: Array<{ line_items?: unknown[] }> | null } | null): boolean {
  return (batch?.vetting_results ?? []).some(result => (result.line_items ?? []).length > 0)
}
