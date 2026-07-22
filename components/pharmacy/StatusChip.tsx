type ChipStatus = 'active' | 'pending' | 'error' | 'info'

const CHIP_CLASSES: Record<ChipStatus, string> = {
  active:  'bg-emerald-50 text-emerald-700',
  pending: 'bg-amber-50 text-amber-700',
  error:   'bg-rose-50 text-rose-600',
  info:    'bg-[#137fec]/10 text-[#137fec]',
}

interface StatusChipProps {
  status: ChipStatus
  label: string
}

export function StatusChip({ status, label }: StatusChipProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${CHIP_CLASSES[status]}`}>
      {label}
    </span>
  )
}
