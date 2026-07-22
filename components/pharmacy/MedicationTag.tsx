import type { Medication } from '@/lib/pharmacy-types'

interface MedicationTagProps {
  med: Medication
}

export function MedicationTag({ med }: MedicationTagProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-sm text-slate-600 border border-slate-200">
      {med.diagnosisCode && (
        <>
          <span className="text-[#137fec] font-semibold font-mono">{med.diagnosisCode}</span>
          <span className="text-slate-300">·</span>
        </>
      )}
      {med.procedureCode && (
        <>
          <span className="text-emerald-700 font-semibold font-mono">{med.procedureCode}</span>
          <span className="text-slate-300">·</span>
        </>
      )}
      {med.name} · {med.dosage}
      {med.tablets != null && <> · {med.tablets} tab{med.tablets !== 1 ? 's' : ''}</>}
      {med.frequency && <> · {med.frequency}</>}
      {med.durationDays != null && med.durationDays > 0 && <> · {med.durationDays}d</>}
    </span>
  )
}
