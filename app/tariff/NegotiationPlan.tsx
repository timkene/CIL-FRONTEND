import type { NegotiationLine, NegotiationResult } from '@/lib/tariff-negotiation'

const number = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-NG', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const money = (value: number | null | undefined) => value == null ? '—' : `₦${number(value)}`
const percent = (value: number | null | undefined) => value == null ? '—' : `${number(value, 1)}%`
const reason = (value?: string) => value?.replaceAll('_', ' ') ?? '—'

function Lines({ lines }: { lines: NegotiationLine[] }) {
  if (!lines.length) return <p className="mt-2 text-sm text-slate-500">No lines.</p>
  return <div className="mt-3 overflow-x-auto"><table className="w-full text-sm text-left">
    <thead className="bg-slate-50"><tr>{['Procedure', 'Current hospital ₦', 'Effective Clearline reference', 'Signed D / C / B / A / Special', 'Proposed ₦', 'Reduction ₦', 'Reduction %', 'Weight / utilization', 'Index impact', 'Annual exposure / savings', 'Why selected / status'].map(title => <th key={title} scope="col" className="p-3 whitespace-nowrap">{title}</th>)}</tr></thead>
    <tbody>{lines.map((line, i) => <tr key={`${line.procedure_code}-${i}`} className={`border-t align-top ${line.is_final_partial_line ? 'bg-amber-50' : ''}`}>
      <td className="p-3">{line.procedure_code}<div className="text-slate-500">{line.procedure_name}</div>{line.is_final_partial_line && <strong className="block text-amber-900">Final partially reduced line</strong>}</td>
      <td className="p-3 whitespace-nowrap">{money(line.current_hospital_price ?? line.hospital_price)}</td>
      <td className="p-3 whitespace-nowrap">{money(line.effective_reference)}</td>
      <td className="p-3 whitespace-nowrap">{(['d', 'c', 'b', 'a', 'special'] as const).map(band => <div key={band}>{band === 'special' ? 'Special' : band.toUpperCase()}: {money(line.signed_ladder?.[`band_${band}`])}</div>)}</td>
      <td className="p-3 whitespace-nowrap">{money(line.proposed_price)}</td>
      <td className="p-3 whitespace-nowrap">{money(line.reduction_amount)}</td>
      <td className="p-3">{percent(line.reduction_percent)}</td>
      <td className="p-3 whitespace-nowrap">Weight: {percent(line.utilization_weight == null ? null : line.utilization_weight * 100)}<div>Frequency: {number(line.frequency, 0)}</div></td>
      <td className="p-3">{number(line.weighted_index_impact, 4)}</td>
      <td className="p-3 whitespace-nowrap">{money(line.annual_financial_exposure)}<div className="text-emerald-700">Save {money(line.annual_savings_estimate)}</div></td>
      <td className="p-3">{reason(line.reason_selected ?? line.reason)}{line.affects_official_band === false && <div>Does not affect official band</div>}</td>
    </tr>)}</tbody>
  </table></div>
}

export function NegotiationPlan({ plan }: { plan: NegotiationResult }) {
  const blocked = plan.exception || plan.current_relative_band === 'UNBANDABLE' || plan.current_index == null
  return <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" aria-label="Negotiation plan">
    <h2 className="text-lg font-bold">Negotiation plan</h2>
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
      <p className="text-lg font-semibold">Current: Relative Band {plan.current_relative_band} — {number(plan.current_index)}</p>
      {!blocked && <p className="text-lg font-semibold mt-2">If proposed prices are accepted: Relative Band {plan.projected_relative_band} — {number(plan.projected_index)}</p>}
      <p className="text-sm mt-2">Target: Relative Band {plan.target_relative_band} — {number(plan.target_index)} · Index reduction: {number(plan.index_reduction, 4)}</p>
    </div>
    {blocked ? <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">Negotiation needs a bandable official result without an exception. Run analysis again and resolve the reported issues. {plan.message}</p> : !plan.feasible ? <div role="status" className="rounded-lg bg-amber-50 p-4 text-amber-900"><p>Target {plan.target_relative_band} cannot be reached with the available eligible tariff lines. Best achievable: Band {plan.best_achievable_relative_band ?? plan.projected_relative_band}, index {number(plan.best_achievable_index ?? plan.projected_index)}.</p><p className="mt-1">Remaining index gap: {number(plan.remaining_index_gap, 4)}. {plan.message}</p></div> : <p className="text-sm text-emerald-800">{plan.message}</p>}
    <p className="text-sm">{plan.selected_line_count} selected of {plan.total_core_candidate_count} core candidates · Weighted coverage {percent(plan.weighted_coverage == null ? null : plan.weighted_coverage * 100)} · Raw coverage {percent(plan.raw_coverage == null ? null : plan.raw_coverage * 100)}</p>
    <p className="text-sm text-slate-600">Signed ₦ ladder prices describe each procedure, not the hospital’s relative band. Review proposed prices before sharing. Offers are not sent automatically.</p>
    {!blocked && <><h3 className="font-semibold">Proposed offers</h3><Lines lines={plan.offers ?? []} /><details><summary className="cursor-pointer font-semibold">Unselected reducible lines ({plan.unselected?.length ?? 0})</summary><Lines lines={plan.unselected ?? []} /></details></>}
    <details><summary className="cursor-pointer font-semibold">Invalid candidate floors ({plan.ineligible?.length ?? 0})</summary>
      <p className="mt-2 text-sm text-slate-600">These lines are not offers and do not contribute to the official target.</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm text-left">
        <thead className="bg-slate-50"><tr>{['Procedure', 'Current hospital price', 'Raw floor (₦)', 'Rounded floor', 'Reference', 'Target ladder', 'Reason'].map(title => <th key={title} scope="col" className="p-3 whitespace-nowrap">{title}</th>)}</tr></thead>
        <tbody>{plan.ineligible?.map((line, i) => <tr key={`${line.procedure_code}-${i}`} className="border-t align-top">
          <td className="p-3">{line.procedure_code}</td>
          <td className="p-3 whitespace-nowrap">{money(line.current_hospital_price)}</td>
          <td className="p-3">{line.raw_candidate_floor ?? '—'}</td>
          <td className="p-3 whitespace-nowrap">{money(line.candidate_floor)}</td>
          <td className="p-3 whitespace-nowrap">{money(line.effective_reference)}</td>
          <td className="p-3 whitespace-nowrap">{money(line.target_ladder_price)}</td>
          <td className="p-3">{reason(line.reason)}</td>
        </tr>)}</tbody>
      </table></div>
    </details>
    <details><summary className="cursor-pointer font-semibold">Excluded codes ({plan.excluded_codes?.length ?? 0})</summary><ul className="mt-2 text-sm space-y-1">{plan.excluded_codes?.map((line, i) => <li key={i}>{line.procedure_code} — {line.procedure_name} · {reason(line.reason)}</li>)}</ul></details>
    <details><summary className="cursor-pointer font-semibold">Duplicate codes and conflicts ({plan.duplicate_codes?.length ?? 0})</summary><ul className="mt-2 text-sm space-y-1">{plan.duplicate_codes?.map((line, i) => <li key={i}>{line.procedure_code} — {line.conflict ? `Conflict: ${line.prices?.map(money).join(', ')}` : `Same price: ${money(line.price)}`} · Count: {line.count}</li>)}</ul></details>
    <details><summary className="cursor-pointer font-semibold">Non-core appendix ({plan.non_core_lines?.length ?? 0}) — does not affect official band</summary><Lines lines={plan.non_core_lines ?? []} /></details>
  </section>
}
