export const targetBands = ['D', 'C', 'B', 'A'] as const
export type TargetBand = typeof targetBands[number]

export function canTargetBand(current: string | null | undefined, exception: unknown, target: string): target is TargetBand {
  const ranks: Record<string, number> = { D: 0, C: 1, B: 2, A: 3, Special: 4 }
  return !exception && targetBands.includes(target as TargetBand) &&
    current != null && Object.hasOwn(ranks, current) && ranks[target] < ranks[current]
}

export type AnalysisRequest = {
  provider_id?: string
  current_band: string | null
  provider_tariff?: Record<string, string | number>[]
}

export interface NegotiationLine {
  procedure_code: string
  procedure_name?: string
  current_hospital_price?: number | null
  hospital_price?: number | null
  proposed_price?: number | null
  effective_reference?: number | null
  signed_ladder?: Partial<Record<'band_d' | 'band_c' | 'band_b' | 'band_a' | 'band_special', number | null>> | null
  reduction_amount?: number | null
  reduction_percent?: number | null
  utilization_weight?: number | null
  frequency?: number | null
  weighted_index_impact?: number | null
  annual_financial_exposure?: number | null
  annual_savings_estimate?: number | null
  reason_selected?: string
  reason?: string
  is_final_partial_line?: boolean
  candidate_floor?: number | null
  target_ladder_price?: number | null
  affects_official_band?: boolean
  in_core_basket?: boolean
}

export interface NegotiationResult {
  current_relative_band: string
  current_index: number | null
  target_relative_band: TargetBand
  target_index: number
  target_index_threshold?: number
  feasible: boolean
  projected_relative_band: string
  projected_index: number | null
  index_reduction: number | null
  selected_line_count: number
  total_core_candidate_count: number
  weighted_coverage: number | null
  raw_coverage: number | null
  exception: boolean
  message: string
  reason: string
  remaining_index_gap: number | null
  best_achievable_index?: number | null
  best_achievable_relative_band?: string | null
  offers: NegotiationLine[]
  ineligible?: {
    procedure_code: string
    current_hospital_price?: number | null
    raw_candidate_floor?: number | null
    candidate_floor?: number | null
    effective_reference?: number | null
    target_ladder_price?: number | null
    reason?: string
  }[]
  unselected: NegotiationLine[]
  non_core_lines: NegotiationLine[]
  excluded_codes: { procedure_code: string; procedure_name?: string; reason?: string }[]
  duplicate_codes: { procedure_code: string; conflict?: boolean; prices?: number[]; price?: number; count?: number }[]
  duplicate_conflicts?: { procedure_code: string; conflict?: boolean; prices?: number[]; count?: number }[]
}
