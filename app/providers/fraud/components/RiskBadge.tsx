type RiskLevel = 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'NORMAL' | 'MONITOR'

const STYLES: Record<RiskLevel, string> = {
  CRITICAL: 'bg-rose-100 text-rose-700 border-rose-200',
  HIGH:     'bg-orange-100 text-orange-700 border-orange-200',
  ELEVATED: 'bg-amber-100 text-amber-700 border-amber-200',
  NORMAL:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  MONITOR:  'bg-slate-100 text-slate-600 border-slate-200',
}

export function RiskBadge({ level }: { level: RiskLevel | string }) {
  const style = STYLES[level as RiskLevel] ?? STYLES.MONITOR
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      {level}
    </span>
  )
}

export function riskRowClass(level: string): string {
  if (level === 'CRITICAL') return 'bg-rose-50'
  if (level === 'HIGH')     return 'bg-orange-50'
  if (level === 'ELEVATED') return 'bg-amber-50/60'
  return ''
}
