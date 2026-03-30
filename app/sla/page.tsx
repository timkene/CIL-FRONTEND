'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Constants ────────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1)
const YEARS  = ['2025','2026','2027','2028']

const DEFAULT_DIRECTOR_NAME   = 'Director'
const DEFAULT_DIRECTOR_EMAIL  = 'leocasey0@gmail.com'
const DEFAULT_LEGAL_HEAD_NAME = 'Head, Legal Services'
const DEFAULT_LEGAL_HEAD_EMAIL= 'leocasey0@gmail.com'
const DEFAULT_HR_EMAIL        = 'leocasey0@gmail.com'

// ── Types ────────────────────────────────────────────────────────────────────
interface PlanRow {
  plan_type:   string
  description: string
  num_lives:   string
  amount:      string
}

interface SLADoc {
  id:                    number
  company_name:          string
  contract_start:        string
  contract_end:          string
  generated_by:          string
  action:                string
  download_url:          string
  storage_path:          string
  signature_request_id:  string | null
  test_mode:             boolean | null
  created_at:            string
}

interface ContractRow {
  group_name:            string
  current_contract_start: string | null
  current_contract_end:   string | null
}

// ── Helper ───────────────────────────────────────────────────────────────────
function parseDateParts(iso: string | null): { day: number; month: string; year: string } {
  if (!iso) return { day: 1, month: 'January', year: '2026' }
  const d = new Date(iso)
  return {
    day:   d.getUTCDate(),
    month: MONTHS[d.getUTCMonth()],
    year:  String(d.getUTCFullYear()),
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Select({
  value, onChange, options, className = '',
}: { value: string; onChange: (v: string) => void; options: (string | number)[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 ${className}`}
    >
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

function Input({
  value, onChange, placeholder = '', className = '', type = 'text',
}: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 w-full ${className}`}
    />
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#0a3d6b] text-white text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-t-lg">
      {title}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SLAPage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')

  // ── Form state ──────────────────────────────────────────────────────────
  const [companySearch,    setCompanySearch]    = useState('')
  const [companyOptions,   setCompanyOptions]   = useState<ContractRow[]>([])
  const [showDropdown,     setShowDropdown]     = useState(false)
  const [companyName,      setCompanyName]      = useState('')
  const [companyAddress,   setCompanyAddress]   = useState('')
  const [contractDay,      setContractDay]      = useState<number>(1)
  const [contractMonth,    setContractMonth]    = useState('January')
  const [contractYear,     setContractYear]     = useState('2026')
  const [numBeneficiaries, setNumBeneficiaries] = useState('')
  const [premiumNaira,     setPremiumNaira]     = useState('')
  const [premiumWords,     setPremiumWords]     = useState('')
  const [plans,            setPlans]            = useState<PlanRow[]>([
    { plan_type: '', description: '', num_lives: '', amount: '' },
  ])
  const [startDay,   setStartDay]   = useState<number>(1)
  const [startMonth, setStartMonth] = useState('January')
  const [startYear,  setStartYear]  = useState('2026')
  const [endDay,     setEndDay]     = useState<number>(31)
  const [endMonth,   setEndMonth]   = useState('December')
  const [endYear,    setEndYear]    = useState('2026')

  // ── Action state ────────────────────────────────────────────────────────
  const [generating,   setGenerating]   = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [downloadUrl,  setDownloadUrl]  = useState('')

  // ── ESign modal ─────────────────────────────────────────────────────────
  const [showEsign,        setShowEsign]        = useState(false)
  const [directorName,     setDirectorName]     = useState(DEFAULT_DIRECTOR_NAME)
  const [directorEmail,    setDirectorEmail]    = useState(DEFAULT_DIRECTOR_EMAIL)
  const [legalHeadName,    setLegalHeadName]    = useState(DEFAULT_LEGAL_HEAD_NAME)
  const [legalHeadEmail,   setLegalHeadEmail]   = useState(DEFAULT_LEGAL_HEAD_EMAIL)
  const [hrEmail,          setHrEmail]          = useState(DEFAULT_HR_EMAIL)
  const [clientName,       setClientName]       = useState('')
  const [clientEmail,      setClientEmail]      = useState('')
  const [esignTestMode,    setEsignTestMode]    = useState(true)
  const [esignLoading,     setEsignLoading]     = useState(false)
  const [esignError,       setEsignError]       = useState('')
  const [esignSuccess,     setEsignSuccess]     = useState(false)
  const [esignRequestId,   setEsignRequestId]   = useState('')

  // ── History ─────────────────────────────────────────────────────────────
  const [history,      setHistory]      = useState<SLADoc[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // ── Load companies ───────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchCompanies() {
      const { data } = await supabase
        .from('dashboard_contract_summary')
        .select('group_name, current_contract_start, current_contract_end')
        .order('group_name')
      if (data) setCompanyOptions(data as ContractRow[])
    }
    fetchCompanies()
  }, [])

  // ── Load history ─────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data } = await supabase
      .from('sla_documents')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setHistory(data as SLADoc[])
    setHistoryLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'history') loadHistory()
  }, [activeTab, loadHistory])

  // ── Company select ───────────────────────────────────────────────────────
  const filteredCompanies = companyOptions.filter(c =>
    c.group_name.toLowerCase().includes(companySearch.toLowerCase())
  )

  function selectCompany(row: ContractRow) {
    setCompanyName(row.group_name)
    setCompanySearch(row.group_name)
    setShowDropdown(false)

    const start = parseDateParts(row.current_contract_start)
    const end   = parseDateParts(row.current_contract_end)
    setStartDay(start.day);   setStartMonth(start.month);   setStartYear(start.year)
    setEndDay(end.day);       setEndMonth(end.month);       setEndYear(end.year)
  }

  // ── Plan helpers ─────────────────────────────────────────────────────────
  function updatePlan(idx: number, field: keyof PlanRow, val: string) {
    setPlans(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))
  }
  function addPlan() {
    setPlans(prev => [...prev, { plan_type: '', description: '', num_lives: '', amount: '' }])
  }
  function removePlan(idx: number) {
    setPlans(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  const planTotal = plans.reduce((sum, p) => {
    const v = parseFloat(p.amount.replace(/,/g, '').replace(/₦/g, '')) || 0
    return sum + v
  }, 0)

  // ── Build request body ───────────────────────────────────────────────────
  function buildRequestBody() {
    return {
      company_name:      companyName,
      company_address:   companyAddress,
      contract_day:      contractDay,
      contract_month:    contractMonth,
      contract_year:     contractYear,
      num_beneficiaries: numBeneficiaries,
      premium_naira:     premiumNaira,
      premium_words:     premiumWords,
      plans:             plans.map(p => ({
        plan_type:   p.plan_type,
        description: p.description,
        num_lives:   p.num_lives,
        amount:      p.amount,
      })),
      start_day:   startDay,
      start_month: startMonth,
      start_year:  startYear,
      end_day:     endDay,
      end_month:   endMonth,
      end_year:    endYear,
    }
  }

  // ── Generate & Download ───────────────────────────────────────────────────
  async function handleGenerate() {
    setGenerating(true)
    setGenerateError('')
    setDownloadUrl('')
    try {
      const res = await fetch('/api/sla_generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.detail || data.error || 'Generation failed')
        return
      }
      setDownloadUrl(data.download_url)
      window.open(data.download_url, '_blank')
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setGenerating(false)
    }
  }

  // ── Send for e-signature ──────────────────────────────────────────────────
  async function handleEsign() {
    setEsignLoading(true)
    setEsignError('')
    setEsignSuccess(false)
    try {
      const body = {
        ...buildRequestBody(),
        director_name:    directorName,
        director_email:   directorEmail,
        legal_head_name:  legalHeadName,
        legal_head_email: legalHeadEmail,
        hr_email:         hrEmail,
        client_name:      clientName,
        client_email:     clientEmail,
        test_mode:        esignTestMode,
      }
      const res = await fetch('/api/sla_esign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setEsignError(data.detail || data.error || 'E-sign request failed')
        return
      }
      setEsignSuccess(true)
      setEsignRequestId(data.signature_request_id || '')
    } catch (e: unknown) {
      setEsignError(e instanceof Error ? e.message : 'Network error')
    } finally {
      setEsignLoading(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f6f7f8]">
      {/* Page header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <h1 className="text-xl font-bold text-slate-800">SLA Generator</h1>
        <p className="text-sm text-slate-500 mt-0.5">Generate and send service level agreements</p>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-5">
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {(['generate', 'history'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-[#137fec] shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'generate' ? 'Generate New' : 'Document History'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Generate New Tab ─────────────────────────────────────────────── */}
      {activeTab === 'generate' && (
        <div className="px-6 py-5 space-y-5 max-w-4xl">

          {/* Section 1: Client Information */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader title="Client Information" />
            <div className="p-5 space-y-4">
              {/* Searchable company dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Company Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={companySearch}
                    onChange={e => { setCompanySearch(e.target.value); setShowDropdown(true) }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    placeholder="Search company..."
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#137fec]/40 w-full"
                  />
                  {showDropdown && filteredCompanies.length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                      {filteredCompanies.map(c => (
                        <button
                          key={c.group_name}
                          onMouseDown={() => selectCompany(c)}
                          className="w-full text-left px-4 py-2 text-sm hover:bg-[#137fec]/10 text-slate-700"
                        >
                          {c.group_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {companySearch && companyName !== companySearch && (
                  <p className="text-xs text-slate-400 mt-1">
                    Custom name — not matched to a contract record
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Company Address</label>
                <Input value={companyAddress} onChange={setCompanyAddress} placeholder="Registered office address" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Agreement Date</label>
                <div className="flex gap-2">
                  <Select value={String(contractDay)}   onChange={v => setContractDay(Number(v))}   options={DAYS}   className="w-20" />
                  <Select value={contractMonth}         onChange={setContractMonth}                  options={MONTHS} className="flex-1" />
                  <Select value={contractYear}          onChange={setContractYear}                   options={YEARS}  className="w-24" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Premium Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader title="Premium Details" />
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Number of Beneficiaries</label>
                  <Input value={numBeneficiaries} onChange={setNumBeneficiaries} placeholder="e.g. 150" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Premium Amount (₦)</label>
                  <Input value={premiumNaira} onChange={setPremiumNaira} placeholder="e.g. 6,000,000" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Amount in Words</label>
                  <Input value={premiumWords} onChange={setPremiumWords} placeholder="e.g. Six Million Naira Only" />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Plan Details */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader title="Plan Details" />
            <div className="p-5">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1.5fr_80px_120px_40px] gap-2 mb-2">
                {['Plan Type','Description','No. of Lives','Amount/Annum (₦)',''].map(h => (
                  <span key={h} className="text-xs font-semibold text-slate-500 uppercase">{h}</span>
                ))}
              </div>
              {plans.map((plan, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1.5fr_80px_120px_40px] gap-2 mb-2">
                  <Input value={plan.plan_type}   onChange={v => updatePlan(idx,'plan_type',v)}   placeholder="e.g. Gold" />
                  <Input value={plan.description} onChange={v => updatePlan(idx,'description',v)} placeholder="Description" />
                  <Input value={plan.num_lives}   onChange={v => updatePlan(idx,'num_lives',v)}   placeholder="50" />
                  <Input value={plan.amount}      onChange={v => updatePlan(idx,'amount',v)}      placeholder="3,000,000" />
                  <button
                    onClick={() => removePlan(idx)}
                    className="text-red-400 hover:text-red-600 text-lg font-bold flex items-center justify-center"
                    title="Remove row"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={addPlan}
                  className="text-sm text-[#137fec] hover:underline font-medium"
                >
                  + Add Plan Row
                </button>
                {planTotal > 0 && (
                  <span className="text-sm text-slate-600 font-semibold">
                    Total: ₦{planTotal.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Period of Cover */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <SectionHeader title="Period of Cover" />
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date</label>
                <div className="flex gap-2">
                  <Select value={String(startDay)}   onChange={v => setStartDay(Number(v))}   options={DAYS}   className="w-20" />
                  <Select value={startMonth}         onChange={setStartMonth}                  options={MONTHS} className="flex-1" />
                  <Select value={startYear}          onChange={setStartYear}                   options={YEARS}  className="w-24" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">End Date</label>
                <div className="flex gap-2">
                  <Select value={String(endDay)}   onChange={v => setEndDay(Number(v))}   options={DAYS}   className="w-20" />
                  <Select value={endMonth}         onChange={setEndMonth}                  options={MONTHS} className="flex-1" />
                  <Select value={endYear}          onChange={setEndYear}                   options={YEARS}  className="w-24" />
                </div>
              </div>
            </div>
          </div>

          {/* Error / Download feedback */}
          {generateError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {generateError}
            </div>
          )}
          {downloadUrl && !generateError && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-3">
              <span>Document generated.</span>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold"
              >
                Click here to download
              </a>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-[#137fec] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0f6fd0] disabled:opacity-50 transition-colors shadow-sm"
            >
              {generating ? (
                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-base">download</span>
              )}
              Generate &amp; Download
            </button>
            <button
              onClick={() => { setShowEsign(true); setEsignSuccess(false); setEsignError('') }}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-base">mail</span>
              Send via Dropbox Sign
            </button>
          </div>
        </div>
      )}

      {/* ── Document History Tab ──────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="px-6 py-5 max-w-6xl">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">All SLA Documents</h2>
              <button
                onClick={loadHistory}
                className="text-xs text-[#137fec] hover:underline"
              >
                Refresh
              </button>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-12">
                <span className="material-symbols-outlined text-3xl text-[#137fec] animate-spin">progress_activity</span>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <span className="material-symbols-outlined text-4xl block mb-2">description</span>
                No SLA documents yet. Generate your first SLA above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Company','Contract Period','Action','Generated By','Date','Status / Download'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(doc => (
                      <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-800">{doc.company_name}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {doc.contract_start && doc.contract_end
                            ? `${doc.contract_start} – ${doc.contract_end}`
                            : doc.contract_start || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            doc.action === 'esign'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {doc.action === 'esign' ? 'E-Sign' : 'Download'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{doc.generated_by || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(doc.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          {doc.action === 'download' ? (
                            <a
                              href={doc.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#137fec] hover:underline text-xs font-medium"
                            >
                              <span className="material-symbols-outlined text-sm">download</span>
                              Download
                            </a>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                                <span className="material-symbols-outlined text-sm">mark_email_read</span>
                                Sent for Signature
                              </span>
                              {doc.signature_request_id && (
                                <p className="text-xs text-slate-400 font-mono">
                                  {doc.signature_request_id.slice(0, 16)}…
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ESign Modal ───────────────────────────────────────────────────── */}
      {showEsign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Send SLA for E-Signature</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Document: {companyName || '(company not set)'}
                </p>
              </div>
              <button
                onClick={() => setShowEsign(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
              >
                ×
              </button>
            </div>

            {esignSuccess ? (
              <div className="px-6 py-8 text-center">
                <span className="material-symbols-outlined text-5xl text-emerald-500 block mb-3">check_circle</span>
                <p className="text-base font-semibold text-emerald-700 mb-1">Signature request sent!</p>
                <p className="text-sm text-slate-500">Each signer will receive an email from Dropbox Sign.</p>
                {esignRequestId && (
                  <p className="mt-3 text-xs text-slate-400 font-mono break-all">
                    Request ID: {esignRequestId}
                  </p>
                )}
                <button
                  onClick={() => setShowEsign(false)}
                  className="mt-6 bg-[#137fec] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#0f6fd0]"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-5">
                {/* Clearline Signers */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Clearline Signers</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Director Name</label>
                      <Input value={directorName} onChange={setDirectorName} placeholder="Director" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Director Email</label>
                      <Input value={directorEmail} onChange={setDirectorEmail} placeholder="director@clearline.com" type="email" />
                    </div>
                  </div>
                </div>

                {/* Head Legal */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Head Legal</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Head Legal Name</label>
                      <Input value={legalHeadName} onChange={setLegalHeadName} placeholder="Head, Legal Services" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Head Legal Email</label>
                      <Input value={legalHeadEmail} onChange={setLegalHeadEmail} placeholder="legal@clearline.com" type="email" />
                    </div>
                  </div>
                </div>

                {/* HR */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">HR (receives copy)</p>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">HR Email</label>
                    <Input value={hrEmail} onChange={setHrEmail} placeholder="hr@clearline.com" type="email" />
                  </div>
                </div>

                {/* Client Signatory */}
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Client Signatory (optional)</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Client Contact Name</label>
                      <Input value={clientName} onChange={setClientName} placeholder="Client representative" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Client Contact Email</label>
                      <Input value={clientEmail} onChange={setClientEmail} placeholder="client@company.com" type="email" />
                    </div>
                  </div>
                </div>

                {/* Test Mode */}
                <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <input
                    id="test-mode"
                    type="checkbox"
                    checked={esignTestMode}
                    onChange={e => setEsignTestMode(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <label htmlFor="test-mode" className="text-xs text-amber-800 font-medium cursor-pointer">
                    Test mode — not legally binding
                  </label>
                </div>

                {esignError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    {esignError}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setShowEsign(false)}
                    className="flex-1 border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEsign}
                    disabled={esignLoading}
                    className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {esignLoading ? (
                      <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                    ) : (
                      <span className="material-symbols-outlined text-base">send</span>
                    )}
                    Send for Signature
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
