type BandingResult = {
  relative_band?: string | null
  tariff_band?: string | null
  sensitivity_band?: string | null
}

export function tariffBandingCopy(result: BandingResult | null | undefined) {
  return {
    officialLabel: 'Official Relative Band',
    sensitivityLabel: 'Sensitivity Check',
    diagnosticNote: 'Diagnostic only — this does not change the official band.',
    unbandableNote: result?.sensitivity_band === 'UNBANDABLE'
      ? `Sensitivity becomes unbandable after removing the largest contributor. Official band remains ${result.relative_band ?? result.tariff_band ?? '—'}.`
      : null,
  }
}
