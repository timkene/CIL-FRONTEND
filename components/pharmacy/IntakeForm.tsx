'use client'
import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Enrollee, Medication, MedicationFrequency, Provider } from '@/lib/pharmacy-types'
import { PharmacySearchComboBox } from './SearchComboBox'
import {
  searchPharmacyMembers,
  searchPharmacyProviders,
  searchPharmacyProcedures,
  searchPharmacyDiagnoses,
  getPharmacyMemberDetail,
} from '@/lib/pharmacy-api'

interface IntakeFormProps {
  onSubmit: (data: { enrollee: Enrollee; provider: Provider; medications: Medication[] }) => void
  submitting: boolean
}

const FREQUENCY_OPTIONS: MedicationFrequency[] = [
  'every 24 hrs', 'every 12 hrs', 'every 8 hrs', 'every 6 hrs', 'every week', 'every month',
]

const EMPTY_MED: Medication = {
  procedureCode: '', name: '', dosage: '', quantity: 1,
  tablets: 1, frequency: '', durationDays: 1, diagnosisCode: '', diagnosis: '',
}

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#137fec] focus:ring-2 focus:ring-[#137fec]/20'

export function IntakeForm({ onSubmit, submitting }: IntakeFormProps) {
  const [enrollee, setEnrollee] = useState<Enrollee>({ enrolleeId: '', fullName: '' })
  const [provider, setProvider] = useState<Provider>({ providerId: '', providerName: '' })
  const [medications, setMedications] = useState<Medication[]>([])
  const [medError, setMedError] = useState('')
  const [fetchingContact, setFetchingContact] = useState(false)
  const [terminated, setTerminated] = useState(false)

  const handleEnrolleeSelect = async (r: { code: string; label: string }) => {
    setEnrollee({ enrolleeId: r.code, fullName: r.label })
    setTerminated(false)
    setFetchingContact(true)
    try {
      const d = await getPharmacyMemberDetail(r.code)
      const isTerminated =
        d.isterminated === true ||
        (!!d.terminationDate && new Date(d.terminationDate) < new Date())
      setTerminated(isTerminated)
      setEnrollee({
        enrolleeId: r.code,
        fullName: d.fullName ?? r.label,
        phone: d.phone ?? '',
        address: d.address ?? '',
        title: d.title ?? undefined,
        gender: d.gender ?? undefined,
        dateOfBirth: d.dateOfBirth ?? undefined,
        planType: d.planType ?? undefined,
        groupName: d.groupName ?? undefined,
        email: d.email ?? undefined,
        effectiveDate: d.effectiveDate ?? undefined,
        terminationDate: d.terminationDate ?? undefined,
        isterminated: isTerminated,
      })
    } finally {
      setFetchingContact(false)
    }
  }

  const addMed = () => setMedications(prev => [...prev, { ...EMPTY_MED }])
  const updateMed = (idx: number, patch: Partial<Medication>) =>
    setMedications(prev => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  const removeMed = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!enrollee.enrolleeId) { setMedError('Please select an enrollee.'); return }
    if (terminated) { setMedError('This enrollee\'s coverage is terminated. Prescriptions cannot be generated.'); return }
    if (!provider.providerId) { setMedError('Please select a provider.'); return }
    const filledMeds = medications.filter(m => m.name.trim())
    if (filledMeds.length === 0) { setMedError('Add at least one medication / procedure.'); return }
    const missingDiag = filledMeds.findIndex(m => !m.diagnosis.trim())
    if (missingDiag !== -1) { setMedError(`Medication ${missingDiag + 1} is missing a diagnosis.`); return }
    const missingFreq = filledMeds.findIndex(m => !m.frequency)
    if (missingFreq !== -1) { setMedError(`Medication ${missingFreq + 1} is missing a frequency.`); return }
    const badDuration = filledMeds.findIndex(m => !m.durationDays || m.durationDays < 1)
    if (badDuration !== -1) { setMedError(`Medication ${badDuration + 1} needs a valid course duration.`); return }
    setMedError('')
    onSubmit({ enrollee, provider, medications: filledMeds })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-6 mb-6">

        {/* Left — Enrollee + Provider */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-5">
          <h2 className="text-xl font-semibold text-slate-900">Enrollee & Provider</h2>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Enrollee ID <span className="text-slate-400 font-normal">(search by ID or name)</span>
            </label>
            <PharmacySearchComboBox
              placeholder="e.g. CL12345 or Jane Doe"
              onSearch={searchPharmacyMembers}
              onSelect={handleEnrolleeSelect}
              displayValue={enrollee.enrolleeId ? `${enrollee.enrolleeId} — ${enrollee.fullName}` : ''}
            />
            {enrollee.enrolleeId && (
              <p className="text-xs text-slate-500 mt-1">
                Selected: <span className="font-semibold text-slate-900">{enrollee.fullName}</span>{' '}
                <span className="font-mono">({enrollee.enrolleeId})</span>
              </p>
            )}
          </div>

          {enrollee.enrolleeId && fetchingContact && (
            <p className="text-xs text-slate-400 animate-pulse">Fetching member details…</p>
          )}

          {enrollee.enrolleeId && !fetchingContact && terminated && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-rose-700">Coverage Terminated</p>
              <p className="text-xs text-rose-600 mt-0.5">
                Termination date: {enrollee.terminationDate ?? 'unknown'}. Prescriptions cannot be generated for this enrollee.
              </p>
            </div>
          )}

          {enrollee.enrolleeId && !fetchingContact && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Phone', enrollee.phone],
                  ['Address', enrollee.address],
                  ['Title', enrollee.title],
                  ['Gender', enrollee.gender],
                  ['Date of Birth', enrollee.dateOfBirth],
                  ['Plan Type', enrollee.planType],
                  ['Group / Employer', enrollee.groupName],
                  ['Email', enrollee.email],
                  ['Effective Date', enrollee.effectiveDate],
                  ['Termination Date', enrollee.terminationDate],
                ] as [string, string | undefined][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-slate-500 mb-0.5">{label}</p>
                    <p className={`text-sm rounded-lg px-3 py-2 border ${
                      label === 'Termination Date' && terminated
                        ? 'bg-rose-50 border-rose-200 text-rose-700 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Provider Source <span className="text-slate-400 font-normal">(search by name or ID)</span>
            </label>
            <PharmacySearchComboBox
              placeholder="e.g. St. Mary's Hospital"
              onSearch={searchPharmacyProviders}
              onSelect={r => setProvider({ providerId: r.code, providerName: r.label })}
              displayValue={provider.providerId ? `${provider.providerId} — ${provider.providerName}` : ''}
            />
            {provider.providerId && (
              <p className="text-xs text-slate-500 mt-1">
                Selected: <span className="font-semibold text-slate-900">{provider.providerName}</span>{' '}
                <span className="font-mono">({provider.providerId})</span>
              </p>
            )}
          </div>
        </div>

        {/* Right — Medications */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-900">Medications / Procedures</h2>
            <button
              type="button"
              onClick={addMed}
              className="text-sm text-[#137fec] font-semibold hover:underline"
            >
              + Add Line
            </button>
          </div>

          {medications.length === 0 && (
            <p className="text-sm text-slate-400 italic">Each line links one diagnosis to one procedure.</p>
          )}

          <div className="space-y-3">
            {medications.map((med, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50/50">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-1">Diagnosis (ICD-10)</label>
                    <PharmacySearchComboBox
                      placeholder="Search diagnosis…"
                      onSearch={searchPharmacyDiagnoses}
                      onSelect={r => updateMed(idx, { diagnosisCode: r.code, diagnosis: r.label })}
                      displayValue={med.diagnosisCode ? `${med.diagnosisCode} — ${med.diagnosis}` : ''}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMed(idx)}
                    aria-label="Remove line"
                    className="mt-6 text-rose-400 hover:text-rose-600 text-xl leading-none shrink-0"
                  >
                    ×
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Procedure / Medication</label>
                  <PharmacySearchComboBox
                    placeholder="Search procedure or medication…"
                    onSearch={searchPharmacyProcedures}
                    onSelect={r => updateMed(idx, { procedureCode: r.code, name: r.label })}
                    displayValue={med.procedureCode ? `${med.procedureCode} — ${med.name}` : ''}
                  />
                </div>

                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Dosage</label>
                    <input className={INPUT} placeholder="e.g. 500mg" value={med.dosage}
                      onChange={e => updateMed(idx, { dosage: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Qty</label>
                    <input type="number" min={1} className={INPUT} value={med.quantity}
                      onChange={e => updateMed(idx, { quantity: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="grid grid-cols-[72px_1fr_96px] gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Tablets</label>
                    <input type="number" min={1} className={INPUT} value={med.tablets}
                      onChange={e => updateMed(idx, { tablets: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Frequency</label>
                    <select className={INPUT} value={med.frequency}
                      onChange={e => updateMed(idx, { frequency: e.target.value as MedicationFrequency })}>
                      <option value="">Select…</option>
                      {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Duration (days)</label>
                    <input type="number" min={1} className={INPUT} value={med.durationDays || ''}
                      onChange={e => updateMed(idx, { durationDays: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {medError && <p role="alert" className="text-sm text-rose-600">{medError}</p>}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 bg-[#137fec] hover:bg-[#137fec]/90 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>
          {submitting ? 'Submitting…' : 'Submit for Bidding'}
        </button>
      </div>
    </form>
  )
}
