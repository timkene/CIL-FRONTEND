import type { DateRange } from '@/lib/api/fraudApi'

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangeFilter({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-slate-500 font-medium">Period:</span>
      <input
        type="date"
        value={value.start}
        onChange={e => onChange({ ...value, start: e.target.value })}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/40"
      />
      <span className="text-slate-400 text-sm">→</span>
      <input
        type="date"
        value={value.end}
        onChange={e => onChange({ ...value, end: e.target.value })}
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/40"
      />
      {(value.start || value.end) && (
        <button
          onClick={() => onChange({ start: '', end: '' })}
          className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  )
}
