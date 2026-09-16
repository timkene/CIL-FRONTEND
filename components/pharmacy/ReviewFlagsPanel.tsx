import type { ReviewFlags } from '@/lib/pharmacy-types'

const LABELS: Record<string, string> = {
  ENROLLEE_TERMINATED: 'ENROLLEE TERMINATED',
  LOW_MEDICATION_BENEFIT: 'LOW MEDICATION BENEFIT',
  MEDICATION_USED_WITHIN_LAST_21_DAYS: 'MEDICATION USED WITHIN LAST 21 DAYS',
  REVIEW_CHECKS_INCOMPLETE: 'REVIEW CHECKS INCOMPLETE',
}

const amount = (value: number | null | undefined) =>
  value == null ? 'Unavailable' : `₦${value.toLocaleString('en-NG')}`

export function ReviewFlagsPanel({ flags }: { flags?: ReviewFlags | null }) {
  const codes = new Set(Array.isArray(flags?.codes) ? flags.codes : [])
  if (flags?.enrollee_status?.flagged) codes.add('ENROLLEE_TERMINATED')
  if (flags?.medication_benefit?.flagged) codes.add('LOW_MEDICATION_BENEFIT')
  if (flags?.recent_medication?.flagged) codes.add('MEDICATION_USED_WITHIN_LAST_21_DAYS')
  const benefit = flags?.medication_benefit
  const history = flags?.recent_medication

  return (
    <section aria-label="Review flags" className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-sm text-slate-700">
      <h3 className="font-semibold text-slate-900">Review flags</h3>
      <p className="text-xs text-slate-500">Advisory only: staff decide whether to approve, deny or send directly. Flags do not automatically deny an order.</p>
      {!flags ? <p>Review snapshot unavailable for this order.</p> : <>
        {codes.size ? <ul className="list-disc pl-5 text-amber-800">{Array.from(codes, code => <li key={code}>{LABELS[code] ?? code}</li>)}</ul> : <p>No review flags.</p>}
        <p className="text-xs text-slate-500">Frozen snapshot checked at: {flags.checked_at || 'Unavailable'} · Request date: {flags.request_date || 'Unavailable'}{flags.enrollee_id ? ` · Enrollee: ${flags.enrollee_id}` : ''}</p>
        <p>Enrollee terminated: {flags.enrollee_status?.isterminated == null ? 'Unavailable' : flags.enrollee_status.isterminated ? 'Yes' : 'No'} · Termination date: {flags.enrollee_status?.terminationDate || 'Unavailable'}</p>
        <div className="space-y-1">
          <h4 className="font-semibold">Medication benefit{benefit?.benefit_name ? ` — ${benefit.benefit_name}` : ''}</h4>
          {benefit?.error && <p className="text-amber-800">Benefit check incomplete: {benefit.error}</p>}
          <p>Limit: {amount(benefit?.limit_amount)} · Used: {amount(benefit?.utilized_amount)} · Remaining: {amount(benefit?.remaining_amount)}</p>
          {benefit?.checked_at && <p className="text-xs text-slate-500">Benefit checked at: {benefit.checked_at}</p>}
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold">21-day medication history</h4>
          <p className="text-xs text-slate-500">{history?.from_date || 'Unavailable'} to {history?.to_date || 'Unavailable'}</p>
          {history?.error && <p className="text-amber-800">History check incomplete: {history.error}</p>}
          {Array.isArray(history?.items) && history.items.length ? <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50"><tr>{['Date', 'Procedure code', 'Description', 'Provider', 'Amount'].map(label => <th scope="col" key={label} className="p-2 font-semibold text-slate-500">{label}</th>)}</tr></thead>
              <tbody>{history.items.map((item, index) => <tr key={index} className="border-t border-slate-200">
                <td className="p-2">{item.date || '—'}</td><td className="p-2">{item.procedure_code || '—'}</td><td className="p-2">{item.description || '—'}</td><td className="p-2">{item.provider || '—'}</td><td className="p-2 whitespace-nowrap">{amount(item.amount)}</td>
              </tr>)}</tbody>
            </table>
          </div> : <p>{!history || history.error ? 'Medication history unavailable.' : 'No medication history recorded in this snapshot.'}</p>}
        </div>
      </>}
    </section>
  )
}
