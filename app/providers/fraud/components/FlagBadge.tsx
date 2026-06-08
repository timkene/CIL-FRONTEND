export function FlagBadge({ flagged, reason }: { flagged: boolean; reason?: string }) {
  if (!flagged) return <span className="text-emerald-600 text-xs font-medium">Clean</span>
  return (
    <span
      title={reason}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-200 cursor-help"
    >
      ⚑ Flagged
    </span>
  )
}

export function flagRowClass(flagged: boolean): string {
  return flagged ? 'bg-rose-50 border-l-2 border-l-rose-400' : ''
}
