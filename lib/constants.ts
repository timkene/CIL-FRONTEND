// ── Supabase table names ──────────────────────────────────────────────────────
export const TABLES = {
  MLR_SUMMARY:                     'mlr_summary',
  MLR_TOP_PROVIDERS:               'mlr_top_providers',
  MLR_TOP_ENROLLEES:               'mlr_top_enrollees',
  MLR_TOP_PROCEDURES:              'mlr_top_procedures',
  STAFF:                           'staff',
  DEPT_PERMISSIONS:                'department_permissions',
  ENROLLEE_PROVIDER_MAPPING_FLAGS: 'enrollee_provider_mapping_flags',
  ENROLLEE_PROVIDER_VISIT_FLAGS:   'enrollee_provider_visit_flags',
  AI_MONTHLY_REPORTS:              'ai_monthly_reports',
  SLA_DOCUMENTS:                   'sla_documents',
  PAYMENT_EVIDENCE:                'payment_evidence',
  DUES:                            'dues',
} as const

// ── MLR business rules ────────────────────────────────────────────────────────
export const MLR_THRESHOLDS = {
  LOSS:    0.75,
  WARNING: 0.70,
} as const

export const MLR_STATUS_LABELS = {
  LOSS:       'LOSS',
  WARNING:    'WARNING',
  PROFITABLE: 'PROFITABLE',
} as const

// Maps an MLR ratio to its status
export function getMlrStatus(mlr: number): 'LOSS' | 'WARNING' | 'PROFITABLE' {
  if (mlr > MLR_THRESHOLDS.LOSS)    return 'LOSS'
  if (mlr > MLR_THRESHOLDS.WARNING) return 'WARNING'
  return 'PROFITABLE'
}

// Tailwind classes for MLR status
export const MLR_STATUS_CLASSES = {
  LOSS:       { text: 'text-rose-600',    bg: 'bg-rose-100',    border: 'border-rose-200',    icon: 'bg-rose-500/10'    },
  WARNING:    { text: 'text-amber-600',   bg: 'bg-amber-100',   border: 'border-amber-200',   icon: 'bg-amber-500/10'   },
  PROFITABLE: { text: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200', icon: 'bg-emerald-500/10' },
} as const

// ── Formatting helpers ────────────────────────────────────────────────────────
export const NAIRA_LOCALE: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}

export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const

// ── Brand ─────────────────────────────────────────────────────────────────────
export const BRAND_BLUE = '#137fec'
