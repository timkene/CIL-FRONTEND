// ── Shared formatting utilities ───────────────────────────────────────────────

/** ₦1,200,000 → ₦1.20M | ₦45,000 → ₦45K */
export function fmtNaira(n: number): string {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

/** 0.756 → "75.6%" */
export function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

/** null-safe percentage string */
export function fmtPctSafe(n: number | null | undefined): string {
  return n == null ? '—' : fmtPct(n)
}

/** null-safe naira string */
export function fmtNairaSafe(n: number | null | undefined): string {
  return n == null ? '—' : fmtNaira(n)
}

/** ISO date → "5 Jun 2026" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Latest computed_at from an array of MLR rows */
export function latestComputedAt(rows: Array<{ computed_at: string }>): string {
  if (!rows.length) return '—'
  const iso = rows.reduce((max, r) => r.computed_at > max ? r.computed_at : max, rows[0].computed_at)
  return fmtDate(iso)
}
