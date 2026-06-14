'use client'
import { useState, useRef, useCallback } from 'react'
import { Button, Badge, Card, useToast } from '@/components/ui'
import {
  uploadBatch, listEnrollees, analyseEnrollee,
  generateAndDownloadPdf, downloadExistingPdf,
  sendEmail, generateBackblazeLink, streamNarrative,
  type UploadResult, type EnrolleeWithStatus, type KlaireAnalysis, type EmailMethod,
} from '@/lib/health-api'

// ── Constants ─────────────────────────────────────────────────────────────────

const SAMPLE_CSV = [
  'name,age,gender,systolic,diastolic,blood_glucose,bmi,cholesterol,email,phone',
  'Ngozi Adeyemi,34,F,118,76,92,22.8,175,ngozi.adeyemi@company.com,+2348012345678',
  'Emeka Okonkwo,47,M,145,95,110,28.3,220,emeka.okonkwo@company.com,+2348087654321',
  'Amaka Eze,29,F,108,70,85,21.1,160,amaka.eze@company.com,+2349023456789',
  'Chibuike Nwosu,52,M,158,100,130,31.5,245,chibuike.nwosu@company.com,+2348034567890',
].join('\n')

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = 'health_screening_sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

const COLUMN_GUIDE: [string, string, boolean][] = [
  ['name',          'Full name',           true],
  ['age',           'Age (years)',          true],
  ['gender',        'M or F',              true],
  ['systolic',      'Systolic BP (mmHg)',  false],
  ['diastolic',     'Diastolic BP (mmHg)', false],
  ['blood_glucose', 'Glucose (mg/dL)',     false],
  ['bmi',           'Body Mass Index',     false],
  ['cholesterol',   'Cholesterol (mg/dL)', false],
  ['email',         'Email address',       false],
  ['phone',         'Phone number',        false],
]

const URGENCY_COLOR: Record<string, string> = {
  routine:  'success',
  watch:    'warning',
  urgent:   'error',
  critical: 'error',
}

const URGENCY_LABEL: Record<string, string> = {
  routine:  'All Clear',
  watch:    'Keep Watch',
  urgent:   'Needs Attention',
  critical: 'Seek Care Now',
}

// ── Upload Panel ──────────────────────────────────────────────────────────────

function UploadPanel({ onUpload }: { onUpload: (result: UploadResult) => void }) {
  const [file, setFile]             = useState<File | null>(null)
  const [company, setCompany]       = useState('')
  const [uploading, setUploading]   = useState(false)
  const [dragOver, setDragOver]     = useState(false)
  const inputRef                    = useRef<HTMLInputElement>(null)
  const toast                       = useToast()

  const handleFile = (f: File) => setFile(f)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleSubmit = async () => {
    if (!file || !company.trim()) return
    setUploading(true)
    try {
      const result = await uploadBatch(file, company.trim())
      toast.success(`Uploaded ${result.count} enrollees from ${result.company_name}`)
      onUpload(result)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#137fec]/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-[#137fec]" style={{ fontSize: 28 }}>
              medical_services
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800">Upload Health Screening Data</h2>
          <p className="text-sm text-slate-500 mt-1">
            Upload a CSV or Excel file with enrollee health data to generate Klaire AI reports
          </p>
        </div>

        <Card padding="lg">
          <div className="space-y-4">
            {/* Sample format guide */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-600">Required columns</p>
                <button
                  onClick={downloadSampleCsv}
                  className="text-xs text-[#137fec] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>download</span>
                  Download sample
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {COLUMN_GUIDE.map(([col, desc, req]) => (
                  <div key={col} className="flex items-start gap-1.5">
                    <span className={`text-[10px] font-bold mt-0.5 ${req ? 'text-rose-500' : 'text-slate-300'}`}>●</span>
                    <div>
                      <span className="text-[11px] font-mono font-semibold text-slate-700">{col}</span>
                      <span className="text-[10px] text-slate-400 ml-1">{desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">
                <span className="text-rose-500 font-bold">●</span> Required &nbsp;
                <span className="text-slate-300 font-bold">●</span> Optional (recommended for full analysis)
              </p>
            </div>

            {/* Company name */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Company / Organisation Name
              </label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                placeholder="e.g. Arik Air"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec]"
              />
            </div>

            {/* File dropzone */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Health Screening File
              </label>
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? 'border-[#137fec] bg-[#137fec]/5'
                    : file
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-200 hover:border-[#137fec]/50 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {file ? (
                  <>
                    <span className="material-symbols-outlined text-emerald-500 text-3xl">check_circle</span>
                    <p className="text-sm font-semibold text-slate-700 mt-2">{file.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(0)} KB · Click to change</p>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-slate-300 text-3xl">upload_file</span>
                    <p className="text-sm text-slate-500 mt-2">Drop CSV or Excel file here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse</p>
                  </>
                )}
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={uploading}
              disabled={!file || !company.trim()}
              onClick={handleSubmit}
            >
              Upload & Process
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Urgency Badge ─────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  if (!urgency) return <Badge variant="neutral" size="sm">Not Analysed</Badge>
  return (
    <Badge variant={URGENCY_COLOR[urgency] as 'success' | 'warning' | 'error' | 'neutral'} size="sm">
      {URGENCY_LABEL[urgency] ?? urgency}
    </Badge>
  )
}

// ── Score Ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, urgency }: { score: number; urgency: string }) {
  const color = urgency === 'routine' ? '#00C87A' : urgency === 'watch' ? '#FFA726' : '#EF5350'
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width={80} height={80} className="-rotate-90">
        <circle cx={40} cy={40} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={7} />
        <circle
          cx={40} cy={40} r={radius}
          fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-extrabold text-slate-800">{score}</span>
        <span className="text-[9px] text-slate-400 -mt-0.5">/ 100</span>
      </div>
    </div>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  enrollee:       EnrolleeWithStatus
  analysis:       KlaireAnalysis | null
  analysing:      boolean
  generating:     boolean
  streaming:      boolean
  streamText:     string
  emailSent:      boolean
  emailSending:   boolean
  emailMethod:    EmailMethod | 'backblaze'
  backblazeUrl:   string | null
  onAnalyse:      () => void
  onGeneratePdf:  () => void
  onDownload:     () => void
  onSendEmail:    () => void
  onStream:       () => void
  onMethodChange: (m: EmailMethod | 'backblaze') => void
}

function DetailPanel({
  enrollee, analysis, analysing, generating, streaming, streamText,
  emailSent, emailSending, emailMethod, backblazeUrl,
  onAnalyse, onGeneratePdf, onDownload, onSendEmail, onStream, onMethodChange,
}: DetailPanelProps) {
  const firstName = enrollee.name.split(' ')[0]

  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-slate-800">{enrollee.name}</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          {enrollee.age}y · {enrollee.gender === 'F' ? 'Female' : 'Male'} · {enrollee.company_name}
        </p>
        {enrollee.email && (
          <p className="text-xs text-slate-400">{enrollee.email}</p>
        )}
      </div>

      {/* Analysis result */}
      {analysis ? (
        <>
          {/* Score */}
          <div className="flex items-center gap-4 bg-slate-50 rounded-xl p-4">
            <ScoreRing score={analysis.health_score} urgency={analysis.urgency} />
            <div>
              <p className="text-xs text-slate-500 font-medium">Health Score</p>
              <div className="mt-1">
                <UrgencyBadge urgency={analysis.urgency} />
              </div>
              {analysis.dominant_risk && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Risk: {analysis.dominant_risk}
                </p>
              )}
            </div>
          </div>

          {/* Metric scores */}
          {analysis.metric_scores.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Metrics</p>
              <div className="space-y-1.5">
                {analysis.metric_scores.map(m => (
                  <div key={m.metric} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 capitalize">{m.metric.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      {m.flag && (
                        <span className="text-rose-500 font-medium">{m.flag}</span>
                      )}
                      <span className="font-bold text-slate-700 w-6 text-right">{m.score}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next steps */}
          {analysis.next_steps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Next Steps
              </p>
              <ol className="space-y-1.5">
                {analysis.next_steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-600">
                    <span className="w-4 h-4 rounded-full bg-[#137fec]/10 text-[#137fec] font-bold flex items-center justify-center shrink-0 text-[10px]">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Klaire summary */}
          {analysis.klaire_flags && (
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 mb-1">Klaire's Summary</p>
              <p className="text-xs text-blue-800 leading-relaxed">{analysis.klaire_flags}</p>
            </div>
          )}
        </>
      ) : (
        <div className="bg-slate-50 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-slate-300 text-3xl">psychology</span>
          <p className="text-sm text-slate-500 mt-2">No analysis yet</p>
          <p className="text-xs text-slate-400 mt-0.5">Click Analyse to run Klaire AI</p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {!analysis && (
          <Button variant="primary" size="sm" fullWidth loading={analysing} onClick={onAnalyse}>
            {analysing ? 'Analysing with Klaire…' : 'Analyse with Klaire AI'}
          </Button>
        )}

        {analysis && (
          <>
            {enrollee.has_pdf ? (
              <Button variant="outline" size="sm" fullWidth onClick={onDownload}
                leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>}>
                Download PDF Report
              </Button>
            ) : (
              <Button variant="primary" size="sm" fullWidth loading={generating} onClick={onGeneratePdf}
                leftIcon={!generating ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span> : undefined}>
                {generating ? 'Generating PDF…' : 'Generate PDF Report'}
              </Button>
            )}

            <Button variant="outline" size="sm" fullWidth
              loading={streaming}
              onClick={onStream}
              leftIcon={!streaming ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>stream</span> : undefined}
            >
              {streaming ? 'Klaire is writing…' : streamText ? 'Refresh Narrative' : 'Read Klaire\'s Narrative'}
            </Button>

            {enrollee.email && (
              <div className="space-y-2">
                {/* Method selector */}
                <div className="flex rounded-lg overflow-hidden border border-slate-200">
                  {([
                    ['smtp',      'SMTP Zoho'],
                    ['zohoapi',   'ZohoMail API'],
                    ['backblaze', 'Backblaze Link'],
                  ] as [EmailMethod | 'backblaze', string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => onMethodChange(val)}
                      className={`flex-1 py-1.5 text-[11px] font-medium transition-colors border-r last:border-r-0 border-slate-200 ${
                        emailMethod === val
                          ? 'bg-[#137fec] text-white'
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {emailMethod === 'backblaze' ? (
                  backblazeUrl ? (
                    <div className="space-y-1.5">
                      <div className="bg-slate-50 rounded-lg border border-slate-200 p-2">
                        <p className="text-[10px] text-slate-500 break-all leading-relaxed">{backblazeUrl}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        fullWidth
                        onClick={() => navigator.clipboard.writeText(backblazeUrl)}
                        leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>}
                      >
                        Copy Link
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      fullWidth
                      loading={emailSending}
                      onClick={onSendEmail}
                      leftIcon={!emailSending ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cloud_upload</span> : undefined}
                    >
                      {emailSending ? 'Uploading to Backblaze…' : 'Generate Download Link'}
                    </Button>
                  )
                ) : (
                  <Button
                    variant={emailSent ? 'secondary' : 'outline'}
                    size="sm"
                    fullWidth
                    onClick={onSendEmail}
                    disabled={emailSent || emailSending}
                    loading={emailSending}
                    leftIcon={!emailSending ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {emailSent ? 'mark_email_read' : 'send'}
                    </span> : undefined}
                  >
                    {emailSent ? 'Email Sent' : emailSending ? 'Sending…' : `Email to ${firstName}`}
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {analysis && !enrollee.has_pdf && !generating && (
          <Button variant="ghost" size="sm" fullWidth loading={analysing} onClick={onAnalyse}>
            Re-analyse
          </Button>
        )}
      </div>

      {/* SSE Stream text */}
      {(streaming || streamText) && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Klaire&apos;s Personal Report
            {streaming && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-[#137fec] animate-pulse" />}
          </p>
          <div className="bg-white rounded-xl border border-slate-200 p-4 max-h-72 overflow-y-auto">
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{streamText}</p>
            {streaming && <span className="inline-block w-0.5 h-3 bg-[#137fec] animate-pulse ml-0.5" />}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

interface EnrolleeState {
  analysing:    boolean
  generating:   boolean
  streaming:    boolean
  streamText:   string
  emailSent:    boolean
  emailSending: boolean
  backblazeUrl: string | null
}

export default function HealthScreeningPage() {
  const [batch,     setBatch]     = useState<UploadResult | null>(null)
  const [enrollees, setEnrollees] = useState<EnrolleeWithStatus[]>([])
  const [analyses,  setAnalyses]  = useState<Record<string, KlaireAnalysis>>({})
  const [selected,  setSelected]  = useState<string | null>(null)
  const [states,    setStates]    = useState<Record<string, EnrolleeState>>({})
  const [loading,   setLoading]   = useState(false)
  const [filter,      setFilter]      = useState<'all' | 'analysed' | 'pdf' | 'none'>('all')
  const [emailMethod, setEmailMethod] = useState<EmailMethod | 'backblaze'>('smtp')
  const toast = useToast()

  const getState = (id: string): EnrolleeState =>
    states[id] ?? { analysing: false, generating: false, streaming: false, streamText: '', emailSent: false, emailSending: false, backblazeUrl: null }

  const patchState = (id: string, patch: Partial<EnrolleeState>) =>
    setStates(s => ({ ...s, [id]: { ...getState(id), ...patch } }))

  const patchEnrollee = (id: string, patch: Partial<EnrolleeWithStatus>) =>
    setEnrollees(es => es.map(e => e.enrollee_id === id ? { ...e, ...patch } : e))

  const handleUpload = useCallback(async (result: UploadResult) => {
    setBatch(result)
    setLoading(true)
    try {
      const rows = await listEnrollees(result.batch_id)
      setEnrollees(rows)
      const existing: Record<string, KlaireAnalysis> = {}
      rows.forEach(r => {
        if (r.health_score !== null && r.urgency) {
          existing[r.enrollee_id] = {
            enrollee_id:   r.enrollee_id,
            health_score:  r.health_score,
            urgency:       r.urgency as KlaireAnalysis['urgency'],
            metric_scores: [],
            dominant_risk: null,
            next_steps:    [],
            klaire_flags:  '',
          }
        }
      })
      setAnalyses(existing)
      if (rows.length) setSelected(rows[0].enrollee_id)
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }, [toast])

  const handleAnalyse = useCallback(async (enrolleeId: string) => {
    patchState(enrolleeId, { analysing: true })
    try {
      const result = await analyseEnrollee(enrolleeId)
      setAnalyses(a => ({ ...a, [enrolleeId]: result }))
      patchEnrollee(enrolleeId, { health_score: result.health_score, urgency: result.urgency })
      toast.success(`Analysis complete — Score: ${result.health_score}/100`)
    } catch (err) {
      toast.error(String(err))
    } finally {
      patchState(enrolleeId, { analysing: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeneratePdf = useCallback(async (enrollee: EnrolleeWithStatus) => {
    patchState(enrollee.enrollee_id, { generating: true })
    try {
      await generateAndDownloadPdf(enrollee.enrollee_id, enrollee.name)
      patchEnrollee(enrollee.enrollee_id, { has_pdf: true })
      toast.success('PDF report downloaded')
    } catch (err) {
      toast.error(String(err))
    } finally {
      patchState(enrollee.enrollee_id, { generating: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = useCallback(async (enrollee: EnrolleeWithStatus) => {
    try {
      await downloadExistingPdf(enrollee.enrollee_id, enrollee.name)
    } catch (err) {
      toast.error(String(err))
    }
  }, [toast])

  const handleSendEmail = useCallback(async (enrolleeId: string) => {
    patchState(enrolleeId, { emailSending: true })
    try {
      if (emailMethod === 'backblaze') {
        const result = await generateBackblazeLink(enrolleeId)
        patchState(enrolleeId, { backblazeUrl: result.download_url, emailSending: false })
        toast.success('Backblaze download link generated')
      } else {
        await sendEmail(enrolleeId, emailMethod)
        patchState(enrolleeId, { emailSent: true, emailSending: false })
        patchEnrollee(enrolleeId, { email_sent: true })
        toast.success('Report emailed successfully')
      }
    } catch (err) {
      toast.error(String(err))
      patchState(enrolleeId, { emailSending: false })
    }
  }, [emailMethod]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStream = useCallback(async (enrolleeId: string) => {
    patchState(enrolleeId, { streaming: true, streamText: '' })
    await streamNarrative(
      enrolleeId,
      chunk => setStates(s => {
        const cur = s[enrolleeId] ?? { analysing: false, generating: false, streaming: true, streamText: '', emailSent: false }
        return { ...s, [enrolleeId]: { ...cur, streamText: cur.streamText + chunk } }
      }),
      ()    => patchState(enrolleeId, { streaming: false }),
      err   => { toast.error(err); patchState(enrolleeId, { streaming: false }) },
    )
  }, [toast]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = enrollees.filter(e => {
    if (filter === 'analysed') return e.health_score !== null
    if (filter === 'pdf')      return e.has_pdf
    if (filter === 'none')     return e.health_score === null
    return true
  })

  const selectedEnrollee = enrollees.find(e => e.enrollee_id === selected) ?? null

  return (
    <>
      {/* Page header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Health Screening</h2>
          <p className="text-xs text-slate-400">
            {batch
              ? `${batch.company_name} · ${enrollees.length} enrollees · Batch ${batch.batch_id}`
              : 'Upload a health screening file to begin'}
          </p>
        </div>
        {batch && (
          <Button
            variant="outline"
            size="md"
            onClick={() => {
              setBatch(null)
              setEnrollees([])
              setAnalyses({})
              setSelected(null)
              setStates({})
            }}
            leftIcon={<span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload</span>}
          >
            New Upload
          </Button>
        )}
      </header>

      {/* Body */}
      {!batch ? (
        <UploadPanel onUpload={handleUpload} />
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-[#137fec] rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400">Loading enrollees…</p>
          </div>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-64px)]">
          {/* Left: enrollee list */}
          <div className="w-80 border-r border-slate-200 flex flex-col bg-white shrink-0">
            {/* Filters */}
            <div className="p-3 border-b border-slate-100 flex gap-1 flex-wrap">
              {([
                ['all',      'All',          enrollees.length],
                ['analysed', 'Analysed',     enrollees.filter(e => e.health_score !== null).length],
                ['pdf',      'PDF Ready',    enrollees.filter(e => e.has_pdf).length],
                ['none',     'Not Analysed', enrollees.filter(e => e.health_score === null).length],
              ] as const).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === key
                      ? 'bg-[#137fec] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label} <span className={filter === key ? 'opacity-70' : 'text-slate-400'}>({count})</span>
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-12">No enrollees match filter</p>
              ) : (
                filtered.map(e => {
                  const st = getState(e.enrollee_id)
                  const isSelected = selected === e.enrollee_id
                  return (
                    <button
                      key={e.enrollee_id}
                      onClick={() => setSelected(e.enrollee_id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
                        isSelected ? 'bg-[#137fec]/5 border-l-2 border-l-[#137fec]' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-[#137fec]' : 'text-slate-800'}`}>
                            {e.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {e.age}y · {e.gender}
                          </p>
                        </div>
                        <div className="shrink-0">
                          {st.analysing ? (
                            <div className="w-4 h-4 border-2 border-slate-200 border-t-[#137fec] rounded-full animate-spin" />
                          ) : e.health_score !== null ? (
                            <span className="text-sm font-bold text-slate-700">{e.health_score}</span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <UrgencyBadge urgency={e.health_score !== null ? (e.urgency ?? null) : null} />
                        {e.has_pdf && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">PDF</span>
                        )}
                        {(e.email_sent || st.emailSent) && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Sent</span>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Batch actions */}
            <div className="p-3 border-t border-slate-100 space-y-2">
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onClick={async () => {
                  const unanalysed = enrollees.filter(e => !analyses[e.enrollee_id])
                  if (!unanalysed.length) { toast.info('All enrollees already analysed'); return }
                  toast.info(`Running Klaire analysis on ${unanalysed.length} enrollees…`)
                  for (const e of unanalysed) {
                    await handleAnalyse(e.enrollee_id)
                  }
                  toast.success('Bulk analysis complete')
                }}
              >
                Analyse All Remaining
              </Button>
            </div>
          </div>

          {/* Right: detail panel */}
          <div className="flex-1 overflow-hidden bg-slate-50">
            {selectedEnrollee ? (
              <DetailPanel
                enrollee={selectedEnrollee}
                analysis={analyses[selectedEnrollee.enrollee_id] ?? null}
                analysing={getState(selectedEnrollee.enrollee_id).analysing}
                generating={getState(selectedEnrollee.enrollee_id).generating}
                streaming={getState(selectedEnrollee.enrollee_id).streaming}
                streamText={getState(selectedEnrollee.enrollee_id).streamText}
                emailSent={getState(selectedEnrollee.enrollee_id).emailSent || selectedEnrollee.email_sent}
                emailSending={getState(selectedEnrollee.enrollee_id).emailSending}
                emailMethod={emailMethod}
                backblazeUrl={getState(selectedEnrollee.enrollee_id).backblazeUrl}
                onAnalyse={() => handleAnalyse(selectedEnrollee.enrollee_id)}
                onGeneratePdf={() => handleGeneratePdf(selectedEnrollee)}
                onDownload={() => handleDownload(selectedEnrollee)}
                onSendEmail={() => handleSendEmail(selectedEnrollee.enrollee_id)}
                onStream={() => handleStream(selectedEnrollee.enrollee_id)}
                onMethodChange={setEmailMethod}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <span className="material-symbols-outlined text-4xl">person_search</span>
                  <p className="text-sm mt-2">Select an enrollee to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
