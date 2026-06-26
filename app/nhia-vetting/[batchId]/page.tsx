'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useVirtualizer } from '@tanstack/react-virtual'
import { SearchComboBox, type ComboOption } from '@/components/SearchComboBox'
import { Button, Badge, Card, useToast } from '@/components/ui'
import { nhiaFetch } from '@/lib/nhia-fetch'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface BatchRow {
  row_id: string
  pa_number: string
  ticket_id: string
  enrollee_id: string
  first_name: string
  last_name: string
  procedure_code: string
  procedure_name: string
  diagnosis_code: string
  diagnosis_name: string
  provider_id: string
  provider_name: string
  encounter_date_from: string
  encounter_date_to: string
  date_submitted: string
  price: number | null
  quantity: number
  is_manual: boolean
  pa_enrollee_id: string
}

interface PALookupRow {
  pa_number?: string
  ticket_id?: string
  pa_code?: string
  enrollee_id: string
  first_name?: string
  last_name?: string
  procedure_code: string
  procedure_name?: string
  diagnosis_code?: string
  diagnosis_name?: string
  provider_id?: string
  provider_name?: string
  encounter_date_from?: string
}

interface LineItem {
  procedure_code: string
  procedure_name: string
  diagnosis_code: string
  diagnosis_name: string
  decision: string
  confidence: number
  reasoning: string
  drop_reason: string | null
  stated_price: number | null
  tariff_price: number | null
  adjusted_price: number | null
  stated_quantity: number | null
  adjusted_quantity: number | null
  total_amount: number | null
  rules: { rule_name: string; passed: boolean; source: string; confidence: number; reasoning: string }[]
}

interface VettingResult {
  enrollee_id?: string
  overall_decision?: string
  overall_status?: string
  total_approved_amount?: number
  line_items?: LineItem[]
  error?: string
}

interface Batch {
  batch_id: string
  batch_name: string
  status: 'OPEN' | 'PROCESSING' | 'VETTED' | 'ACCEPTED' | 'REJECTED'
  created_by: string
  created_at: string
  encounter_date: string
  batch_date_submitted: string
  rows: BatchRow[]
  vetting_results: VettingResult[] | null
  total_rows: number
  total_approved: number
  total_denied: number
  total_amount: number
  supervisor_notes?: string
  reviewed_by?: string
  reviewed_at?: string
}

const DECISION_STYLE: Record<string, string> = {
  APPROVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  DENY:    'bg-rose-50 text-rose-700 border border-rose-200',
}

const STATUS_STYLE: Record<string, string> = {
  OPEN:       'bg-blue-50 text-blue-700 border border-blue-200',
  PROCESSING: 'bg-violet-50 text-violet-700 border border-violet-200',
  VETTED:     'bg-amber-50 text-amber-700 border border-amber-200',
  ACCEPTED:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED:   'bg-rose-50 text-rose-700 border border-rose-200',
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function newRowId() {
  return Math.random().toString(36).slice(2, 10)
}

function emptyRow(paNumber = ''): BatchRow {
  return {
    row_id: newRowId(),
    pa_number: paNumber,
    ticket_id: '',
    enrollee_id: '',
    first_name: '',
    last_name: '',
    procedure_code: '',
    procedure_name: '',
    diagnosis_code: '',
    diagnosis_name: '',
    provider_id: '',
    provider_name: '',
    encounter_date_from: '',
    encounter_date_to: '',
    date_submitted: '',
    price: null,
    quantity: 1,
    is_manual: true,
    pa_enrollee_id: '',
  }
}

function CellInput({ value, onChange, placeholder, className = '', error = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string; error?: boolean
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border hover:border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-1 py-0.5 text-xs bg-transparent w-full ${error ? 'border-rose-400 bg-rose-50/40' : 'border-transparent'} ${className}`}
    />
  )
}

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>()
  const toast = useToast()

  const [batch, setBatch] = useState<Batch | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [paInput, setPaInput] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupRows, setLookupRows] = useState<PALookupRow[]>([])
  const [lookupError, setLookupError] = useState('')

  const [rows, setRows] = useState<BatchRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [batchDateSubmitted, setBatchDateSubmitted] = useState('')
  const enrolleeDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tableContainerRef    = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count:           rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize:    () => 80,  // ~80px per row; virtualizer will adjust on measurement
    overscan:        5,
  })

  const loadBatch = useCallback(async () => {
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batchId}`)
      if (!res.ok) throw new Error('Batch not found')
      const data: Batch = await res.json()
      setBatch(data)
      setRows(data.rows || [])
      setBatchDateSubmitted(data.batch_date_submitted || '')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load batch')
    } finally {
      setLoading(false)
    }
  }, [batchId])

  useEffect(() => { loadBatch() }, [loadBatch])

  async function lookupPA() {
    if (!paInput.trim()) return
    setLookupLoading(true)
    setLookupError('')
    setLookupRows([])
    try {
      const res = await fetch(`${API}/api/v1/nhia/pa-lookup?ticket_id=${encodeURIComponent(paInput.trim())}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'PA not found')
      }
      const data = await res.json()
      setLookupRows(data.rows || [])
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setLookupLoading(false)
    }
  }

  function paRowToBatchRow(lr: PALookupRow): BatchRow {
    return {
      row_id: newRowId(),
      pa_number: lr.pa_number || lr.pa_code || lr.ticket_id || paInput.trim(),
      ticket_id: lr.ticket_id || '',
      enrollee_id: lr.enrollee_id,
      first_name: lr.first_name || '',
      last_name: lr.last_name || '',
      procedure_code: lr.procedure_code,
      procedure_name: lr.procedure_name || '',
      diagnosis_code: lr.diagnosis_code || '',
      diagnosis_name: lr.diagnosis_name || '',
      provider_id: lr.provider_id || '',
      provider_name: lr.provider_name || '',
      encounter_date_from: lr.encounter_date_from || '',
      encounter_date_to: lr.encounter_date_from || '',
      date_submitted: batchDateSubmitted,
      price: null,
      quantity: 1,
      is_manual: false,
      pa_enrollee_id: lr.enrollee_id,
    }
  }

  function addAllLookupRows() {
    setRows(prev => [...prev, ...lookupRows.map(paRowToBatchRow)])
    setLookupRows([])
    setPaInput('')
    setDirty(true)
  }

  function addOneRow(lr: PALookupRow) {
    setRows(prev => [...prev, paRowToBatchRow(lr)])
    setDirty(true)
  }

  function addBlankRow() {
    setRows(prev => {
      const last = prev[prev.length - 1]
      return [...prev, {
        ...emptyRow(),
        date_submitted: batchDateSubmitted,
        enrollee_id:   last?.enrollee_id   || '',
        first_name:    last?.first_name    || '',
        last_name:     last?.last_name     || '',
        pa_number:     last?.pa_number     || '',
        provider_id:   last?.provider_id   || '',
        provider_name: last?.provider_name || '',
      }]
    })
    setDirty(true)
    // Scroll the new row into view after React renders it
    setTimeout(() => rowVirtualizer.scrollToIndex(rows.length, { align: 'end' }), 50)
  }

  function updateRow(rowId: string, field: keyof BatchRow, value: string | number | null) {
    setRows(prev => prev.map(r => {
      if (r.row_id !== rowId) return r
      // When the enrollee ID is edited on a PA-lookup row, clear the name immediately
      // so stale names from the original PA don't persist
      if (field === 'enrollee_id' && r.pa_enrollee_id) {
        return { ...r, enrollee_id: String(value ?? ''), first_name: '', last_name: '' }
      }
      return { ...r, [field]: value }
    }))
    setDirty(true)
    if (field === 'enrollee_id' && typeof value === 'string' && value.trim()) {
      if (enrolleeDebounceRef.current) clearTimeout(enrolleeDebounceRef.current)
      enrolleeDebounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(`${API}/api/v1/nhia/enrollee-lookup?enrollee_id=${encodeURIComponent(value.trim())}`)
          const data = await res.json()
          if (data.found) {
            setRows(prev => prev.map(r => r.row_id === rowId
              ? { ...r, first_name: data.first_name, last_name: data.last_name }
              : r))
          }
        } catch { /* silent */ }
      }, 600)
    }
  }

  function deleteRow(rowId: string) {
    setRows(prev => prev.filter(r => r.row_id !== rowId))
    setDirty(true)
  }

  async function saveRows() {
    setSaving(true)
    try {
      await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, batch_date_submitted: batchDateSubmitted }),
      })
      setDirty(false)
      toast.success('Batch saved successfully')
    } catch {
      setError('Failed to save')
      toast.error('Failed to save batch')
    } finally {
      setSaving(false)
    }
  }

  const router = useRouter()

  async function deleteBatch() {
    if (!batch || !confirm(`Delete "${batch.batch_name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batchId}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Delete failed') }
      toast.success('Batch deleted successfully')
      router.push('/nhia-vetting')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      toast.error(e instanceof Error ? e.message : 'Delete failed')
      setDeleting(false)
    }
  }

  async function reopenBatch() {
    if (!batch) return
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Re-open failed') }
      toast.success('Batch re-opened successfully')
      await loadBatch()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Re-open failed')
      toast.error(e instanceof Error ? e.message : 'Re-open failed')
    }
  }

  async function fetchProcedures(q: string): Promise<ComboOption[]> {
    const res  = await fetch(`${API}/api/v1/klaire/procedures?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    return (data.procedures || []).map((p: { procedure_code: string; procedure_name: string }) => ({
      code: p.procedure_code,
      name: p.procedure_name,
    }))
  }

  async function fetchDiagnoses(q: string): Promise<ComboOption[]> {
    const res  = await fetch(`${API}/api/v1/klaire/search-diagnoses?q=${encodeURIComponent(q)}&limit=30`)
    const data = await res.json()
    return (data.diagnoses || []).map((d: { code: string; name: string }) => ({
      code: d.code,
      name: d.name,
    }))
  }

  async function fetchEnrollees(q: string): Promise<ComboOption[]> {
    const res  = await fetch(`${API}/api/v1/nhia/search-enrollee?q=${encodeURIComponent(q)}&limit=20`)
    const data = await res.json()
    return (data.enrollees || []).map((e: { enrollee_id: string; first_name: string; last_name: string }) => ({
      code: e.enrollee_id,
      name: `${e.first_name} ${e.last_name}`.trim() || e.enrollee_id,
    }))
  }

  async function fetchProviders(q: string): Promise<ComboOption[]> {
    const res  = await fetch(`${API}/api/v1/klaire/search-providers?q=${encodeURIComponent(q)}&limit=20`)
    const data = await res.json()
    return (data.providers || []).map((p: { provider_id: string; provider_name: string }) => ({
      code: p.provider_id,
      name: p.provider_name,
    }))
  }

  async function lookupDiagnosisCode(code: string): Promise<{ found: boolean; code: string; name: string; error?: string }> {
    const res  = await fetch(`${API}/api/v1/klaire/lookup-diagnosis?code=${encodeURIComponent(code.trim().toUpperCase())}`)
    return res.json()
  }

  async function submitForVetting() {
    const missing = rows.some(r => !r.procedure_code.trim() || !r.diagnosis_code.trim())
    if (missing) {
      setShowErrors(true)
      toast.error('Please fill in all procedure and diagnosis codes')
      return
    }
    if (dirty) await saveRows()
    setSubmitting(true)
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batchId}/submit`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        const detail = err.detail
        if (detail && typeof detail === 'object' && detail.duplicate_pa_numbers) {
          const msg = `${detail.message}\nDuplicate PAs: ${detail.duplicate_pa_numbers.join(', ')}`
          setError(msg)
          toast.error(msg)
        } else {
          const msg = typeof detail === 'string' ? detail : 'Submit failed'
          setError(msg)
          toast.error(msg)
        }
        return
      }
      // 202 — vetting is running in the background; reload to show PROCESSING state
      toast.success('Vetting started — results will appear automatically when ready')
      await loadBatch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Submit failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Poll every 4 s while batch is PROCESSING
  useEffect(() => {
    if (!batch || batch.status !== 'PROCESSING') return
    const id = setInterval(async () => {
      await loadBatch()
    }, 4000)
    return () => clearInterval(id)
  }, [batch?.status, loadBatch])

  function EnrolleeCell({ row }: { row: BatchRow }) {
    const [idInput, setIdInput] = useState('')

    return (
      <div>
        <SearchComboBox
          code={row.enrollee_id}
          name={row.enrollee_id ? `${row.first_name} ${row.last_name}`.trim() : ''}
          fetchOptions={fetchEnrollees}
          placeholder="Search by name…"
          onSelect={(id, fullName) => {
            const [first, ...rest] = fullName.split(' ')
            setRows(prev => prev.map(r => r.row_id !== row.row_id ? r : {
              ...r, enrollee_id: id, first_name: first || '', last_name: rest.join(' '),
            }))
            setDirty(true)
          }}
        />
        <input
          type="text"
          value={idInput}
          onChange={e => { setIdInput(e.target.value.toUpperCase()); updateRow(row.row_id, 'enrollee_id', e.target.value) }}
          placeholder="or type ID…"
          className="text-[10px] font-mono w-full border border-transparent hover:border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-1 py-0.5 mt-0.5 bg-transparent placeholder-slate-300"
        />
      </div>
    )
  }

  function ProviderCell({ row }: { row: BatchRow }) {
    return (
      <div>
        <SearchComboBox
          code={row.provider_id}
          name={row.provider_name}
          fetchOptions={fetchProviders}
          placeholder="Search provider…"
          onSelect={(id, name) => {
            setRows(prev => prev.map(r => r.row_id !== row.row_id ? r : {
              ...r, provider_id: id, provider_name: name,
            }))
            setDirty(true)
          }}
        />
      </div>
    )
  }

  function DiagnosisCell({ row }: { row: BatchRow }) {
    const [codeInput, setCodeInput] = useState('')
    const [codeError, setCodeError] = useState('')
    const [codeLoading, setCodeLoading] = useState(false)

    async function handleCodeLookup() {
      const c = codeInput.trim()
      if (!c) return
      setCodeLoading(true)
      setCodeError('')
      try {
        const data = await lookupDiagnosisCode(c)
        if (data.found) {
          updateRow(row.row_id, 'diagnosis_code', data.code)
          updateRow(row.row_id, 'diagnosis_name', data.name)
          setShowErrors(false)
          setCodeInput('')
        } else {
          setCodeError(data.error || 'Code not found, try again')
        }
      } catch {
        setCodeError('Lookup failed, try again')
      } finally {
        setCodeLoading(false)
      }
    }

    return (
      <div>
        <SearchComboBox
          code={row.diagnosis_code}
          name={row.diagnosis_name}
          fetchOptions={fetchDiagnoses}
          placeholder="Search by name…"
          error={showErrors && !row.diagnosis_code.trim()}
          onSelect={(code, name) => {
            updateRow(row.row_id, 'diagnosis_code', code)
            updateRow(row.row_id, 'diagnosis_name', name)
            setShowErrors(false)
          }}
        />
        <div className="mt-1 flex items-center gap-1">
          <input
            type="text"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError('') }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCodeLookup() } }}
            onBlur={() => { if (codeInput.trim()) handleCodeLookup() }}
            placeholder="or type ICD-10 code…"
            disabled={codeLoading}
            className="flex-1 text-[10px] font-mono border border-transparent hover:border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-1 py-0.5 bg-transparent placeholder-slate-300"
          />
          {codeLoading && <span className="text-[10px] text-slate-400 shrink-0">…</span>}
        </div>
        {codeError && <p className="text-[10px] text-rose-500 mt-0.5 leading-tight">{codeError}</p>}
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center min-h-[60vh] text-slate-400 text-sm">Loading batch…</div>
  if (!batch) return <div className="p-6 text-rose-600 text-sm">{error || 'Batch not found'} <Link href="/nhia-vetting" className="ml-4 text-[#137fec] underline">Back</Link></div>

  const isOpen       = batch.status === 'OPEN'
  const isProcessing = batch.status === 'PROCESSING'
  const isVetted     = batch.status === 'VETTED'
  const canDelete    = batch.status !== 'ACCEPTED'

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/nhia-vetting" className="text-slate-400 hover:text-slate-600 text-sm">← Back</Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{batch.batch_name}</h1>
              <Badge variant={
                batch.status === 'OPEN'       ? 'info' :
                batch.status === 'PROCESSING' ? 'info' :
                batch.status === 'VETTED'     ? 'warning' :
                batch.status === 'ACCEPTED'   ? 'success' :
                'error'
              }>{batch.status}</Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Encounter: {batch.encounter_date} · by {batch.created_by} · {batch.total_rows} rows</p>
            {isOpen && (
              <div className="flex items-center gap-2 mt-2">
                <label className="text-xs text-slate-500 whitespace-nowrap font-medium">Date Submitted:</label>
                <input
                  type="date"
                  value={batchDateSubmitted}
                  onChange={e => {
                    const d = e.target.value
                    setBatchDateSubmitted(d)
                    setRows(prev => prev.map(r => ({ ...r, date_submitted: r.date_submitted || d })))
                    setDirty(true)
                  }}
                  className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec]"
                />
              </div>
            )}
            {!isOpen && batchDateSubmitted && (
              <p className="text-xs text-slate-400 mt-0.5">Submitted: {batchDateSubmitted}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDelete && (
            <Button variant="danger" onClick={deleteBatch} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          )}
          {isVetted && (
            <Button variant="outline" onClick={reopenBatch}>
              Re-open for Editing
            </Button>
          )}
          {isOpen && dirty && (
            <Button variant="secondary" onClick={saveRows} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
          {isOpen && (
            <Button variant="primary" onClick={submitForVetting} disabled={submitting || rows.length === 0}>
              {submitting ? 'Submitting…' : 'Submit for Vetting'}
            </Button>
          )}
        </div>
      </div>

      {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 whitespace-pre-line">{error}</div>}

      {/* ── PROCESSING: spinner banner ── */}
      {isProcessing && (
        <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-5 py-4">
          <svg className="animate-spin h-5 w-5 text-violet-500 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-violet-800">Vetting in progress…</p>
            <p className="text-xs text-violet-600 mt-0.5">This page will refresh automatically when results are ready. You can safely leave and come back.</p>
          </div>
        </div>
      )}

      {/* ── OPEN: PA lookup + editor ── */}
      {isOpen && (
        <>
          {/* PA Lookup */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h2 className="text-sm font-bold text-slate-700 mb-3">Look Up PA Number</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={paInput}
                onChange={e => setPaInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupPA()}
                placeholder="Enter PA / ticket number…"
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec]"
              />
              <Button variant="primary" onClick={lookupPA} disabled={lookupLoading || !paInput.trim()}>
                {lookupLoading ? 'Looking up…' : 'Look Up'}
              </Button>
            </div>
            {lookupError && <p className="mt-2 text-xs text-rose-600">{lookupError}</p>}

            {lookupRows.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    Found {lookupRows.length} row{lookupRows.length !== 1 ? 's' : ''} for PA {lookupRows[0].pa_number || lookupRows[0].pa_code || lookupRows[0].ticket_id}
                  </p>
                  <Button variant="ghost" size="sm" onClick={addAllLookupRows}>Add All →</Button>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold">Enrollee</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold">Procedure</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold">Diagnosis</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold">Provider</th>
                        <th className="text-left px-3 py-2 text-slate-500 font-semibold">Request Date</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lookupRows.map((lr, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800">{lr.enrollee_id}</p>
                            {(lr.first_name || lr.last_name) && (
                              <p className="text-slate-500">{[lr.first_name, lr.last_name].filter(Boolean).join(' ')}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800">{lr.procedure_code}</p>
                            {lr.procedure_name && <p className="text-slate-500 truncate max-w-[160px]">{lr.procedure_name}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800">{lr.diagnosis_code || '—'}</p>
                            {lr.diagnosis_name && <p className="text-slate-500 truncate max-w-[160px]">{lr.diagnosis_name}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800">{lr.provider_id || '—'}</p>
                            {lr.provider_name && <p className="text-slate-500">{lr.provider_name}</p>}
                          </td>
                          <td className="px-3 py-2 text-slate-500">{lr.encounter_date_from || '—'}</td>
                          <td className="px-3 py-2">
                            <Button variant="ghost" size="sm" onClick={() => addOneRow(lr)}>+ Add</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Total batch amount scorecard */}
          {(() => {
            const totalAmt = rows.reduce((s, r) => r.price != null ? s + r.price * r.quantity : s, 0)
            const priced   = rows.filter(r => r.price != null).length
            return (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-800">{rows.length}</p>
                  <p className="text-xs text-slate-500 mt-1">Total Rows</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">{priced}</p>
                  <p className="text-xs text-slate-500 mt-1">Rows Priced</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
                  <p className="text-xl font-bold text-emerald-600">{fmtMoney(totalAmt)}</p>
                  <p className="text-xs text-slate-500 mt-1">Total Batch Amount</p>
                </div>
              </div>
            )
          })()}

          {/* Batch Rows Editor */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-700">
                Batch Rows <span className="text-slate-400 font-normal ml-1">({rows.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
                <Button variant="outline" size="sm" onClick={addBlankRow}>
                  + Add Row Manually
                </Button>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                No rows yet — look up a PA number above, or add rows manually
              </div>
            ) : (() => {
              const virtualRows  = rowVirtualizer.getVirtualItems()
              const totalHeight  = rowVirtualizer.getTotalSize()
              const paddingTop   = virtualRows.length > 0 ? virtualRows[0].start : 0
              const paddingBottom = virtualRows.length > 0
                ? totalHeight - virtualRows[virtualRows.length - 1].end : 0
              return (
                /* Scrollable container — virtualizer renders only visible rows */
                <div
                  ref={tableContainerRef}
                  style={{ maxHeight: 'calc(100vh - 380px)', minHeight: '300px' }}
                  className="overflow-auto"
                >
                  <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                    {/* Sticky header stays visible as user scrolls */}
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                        <th className="text-left px-3 py-2.5">PA #</th>
                        <th className="text-left px-3 py-2.5">Enrollee</th>
                        <th className="text-left px-3 py-2.5">Procedure</th>
                        <th className="text-left px-3 py-2.5">Diagnosis</th>
                        <th className="text-left px-3 py-2.5">Provider</th>
                        <th className="text-left px-3 py-2.5">Enc. Date From</th>
                        <th className="text-left px-3 py-2.5">Enc. Date To</th>
                        <th className="text-left px-3 py-2.5">Date Submitted</th>
                        <th className="text-right px-3 py-2.5">Unit Price (₦)</th>
                        <th className="text-right px-3 py-2.5">Qty</th>
                        <th className="text-right px-3 py-2.5">Total (₦)</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {/* Top spacer maintains scroll position for off-screen rows */}
                      {paddingTop > 0 && (
                        <tr><td colSpan={12} style={{ height: paddingTop, padding: 0 }} /></tr>
                      )}
                      {virtualRows.map(virtualRow => {
                        const row = rows[virtualRow.index]
                        return (
                          <tr
                            key={row.row_id}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            className={`border-b border-slate-100 align-top ${row.is_manual ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-slate-50/40'}`}
                          >
                            {/* PA Number */}
                            <td className="px-3 py-2">
                              <CellInput value={row.pa_number} onChange={v => updateRow(row.row_id, 'pa_number', v)} placeholder="PA #" className="w-24" />
                              {row.is_manual && (
                                <Badge variant="warning" size="sm" className="mt-1">MANUAL</Badge>
                              )}
                            </td>
                            {/* Enrollee */}
                            <td className="px-3 py-2 min-w-[220px]">
                              <EnrolleeCell row={row} />
                            </td>
                            {/* Procedure */}
                            <td className="px-3 py-2 min-w-[160px]">
                              <SearchComboBox
                                code={row.procedure_code}
                                name={row.procedure_name}
                                fetchOptions={fetchProcedures}
                                placeholder="Search procedure…"
                                error={showErrors && !row.procedure_code.trim()}
                                onSelect={(code, name) => {
                                  updateRow(row.row_id, 'procedure_code', code)
                                  updateRow(row.row_id, 'procedure_name', name)
                                  setShowErrors(false)
                                }}
                              />
                            </td>
                            {/* Diagnosis */}
                            <td className="px-3 py-2 min-w-[180px]">
                              <DiagnosisCell row={row} />
                            </td>
                            {/* Provider */}
                            <td className="px-3 py-2 min-w-[180px]">
                              <ProviderCell row={row} />
                            </td>
                            {/* Enc. Date From */}
                            <td className="px-3 py-2">
                              <input type="date" value={row.encounter_date_from}
                                onChange={e => updateRow(row.row_id, 'encounter_date_from', e.target.value)}
                                className="border border-transparent hover:border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-1 py-0.5 text-xs w-32"
                              />
                            </td>
                            {/* Enc. Date To */}
                            <td className="px-3 py-2">
                              <input type="date" value={row.encounter_date_to}
                                onChange={e => updateRow(row.row_id, 'encounter_date_to', e.target.value)}
                                className="border border-transparent hover:border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-1 py-0.5 text-xs w-32"
                              />
                            </td>
                            {/* Date Submitted */}
                            <td className="px-3 py-2">
                              <input type="date" value={row.date_submitted}
                                onChange={e => updateRow(row.row_id, 'date_submitted', e.target.value)}
                                className="border border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-1 py-0.5 text-xs w-32"
                              />
                            </td>
                            {/* Price */}
                            <td className="px-3 py-2 text-right">
                              <input type="number" value={row.price ?? ''}
                                onChange={e => updateRow(row.row_id, 'price', e.target.value ? parseFloat(e.target.value) : null)}
                                placeholder="0.00"
                                className="w-24 border border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-2 py-1 text-right text-xs"
                              />
                            </td>
                            {/* Qty */}
                            <td className="px-3 py-2 text-right">
                              <input type="number" value={row.quantity} min={1}
                                onChange={e => updateRow(row.row_id, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-14 border border-slate-200 focus:border-[#137fec] focus:outline-none rounded px-2 py-1 text-right text-xs"
                              />
                            </td>
                            {/* Total */}
                            <td className="px-3 py-2 text-right text-slate-700 font-medium tabular-nums">
                              {row.price != null ? fmtMoney(row.price * row.quantity) : '—'}
                            </td>
                            {/* Delete */}
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => deleteRow(row.row_id)}
                                className="text-slate-300 hover:text-rose-500 transition-colors text-lg leading-none">×</button>
                            </td>
                          </tr>
                        )
                      })}
                      {/* Bottom spacer */}
                      {paddingBottom > 0 && (
                        <tr><td colSpan={12} style={{ height: paddingBottom, padding: 0 }} /></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        </>
      )}

      {/* ── VETTED / ACCEPTED / REJECTED: vetting results ── */}
      {batch.status !== 'OPEN' && batch.status !== 'PROCESSING' && batch.vetting_results && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{batch.total_approved}</p>
              <p className="text-xs text-slate-500 mt-1">Approved</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-rose-500">{batch.total_denied}</p>
              <p className="text-xs text-slate-500 mt-1">Denied</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{fmtMoney(batch.total_amount)}</p>
              <p className="text-xs text-slate-500 mt-1">Total Approved Amount</p>
            </div>
          </div>

          {batch.supervisor_notes && (
            <div className={`rounded-xl border p-4 ${batch.status === 'ACCEPTED' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <p className="text-xs font-bold text-slate-600">Supervisor {batch.status} — {batch.reviewed_by}</p>
              <p className="text-sm text-slate-700 mt-1">{batch.supervisor_notes}</p>
            </div>
          )}

          {batch.vetting_results.map((result, gi) => (
            <div key={gi} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700">Enrollee: {result.enrollee_id}</span>
                  {result.overall_decision && (
                    <Badge variant={result.overall_decision === 'APPROVE' ? 'success' : 'error'}>
                      {result.overall_decision}
                    </Badge>
                  )}
                </div>
                {result.total_approved_amount != null && (
                  <span className="text-sm font-bold text-emerald-600">{fmtMoney(result.total_approved_amount)}</span>
                )}
              </div>

              {result.error ? (
                <div className="px-5 py-4 text-sm text-rose-600">Vetting error: {result.error}</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 font-semibold">
                      <th className="text-left px-4 py-2.5">Procedure</th>
                      <th className="text-left px-4 py-2.5">Diagnosis</th>
                      <th className="text-right px-4 py-2.5">Stated Price</th>
                      <th className="text-right px-4 py-2.5">Tariff</th>
                      <th className="text-right px-4 py-2.5">Qty</th>
                      <th className="text-right px-4 py-2.5">Total</th>
                      <th className="text-left px-4 py-2.5">Decision</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {(result.line_items || []).map((item, li) => (
                      <React.Fragment key={`${gi}-${li}`}>
                        <tr
                          className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer"
                          onClick={() => setExpandedRow(expandedRow === `${gi}-${li}` ? null : `${gi}-${li}`)}>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-800">{item.procedure_code}</p>
                            <p className="text-slate-400 truncate max-w-[180px]">{item.procedure_name}</p>
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-slate-800">{item.diagnosis_code}</p>
                            <p className="text-slate-400 truncate max-w-[180px]">{item.diagnosis_name}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{fmtMoney(item.stated_price)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-600">{fmtMoney(item.tariff_price)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-700">
                            {item.stated_quantity != null && item.adjusted_quantity != null && item.stated_quantity !== item.adjusted_quantity ? (
                              <span><span className="line-through text-slate-400">{item.stated_quantity}</span><span className="text-amber-600 ml-1">{item.adjusted_quantity}</span></span>
                            ) : (item.adjusted_quantity ?? item.stated_quantity ?? '—')}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{fmtMoney(item.total_amount)}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant={item.decision === 'APPROVE' ? 'success' : 'error'} size="sm">
                              {item.decision}
                            </Badge>
                            {item.drop_reason && <p className="text-[10px] text-slate-400 mt-0.5">{item.drop_reason}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">{expandedRow === `${gi}-${li}` ? '▲' : '▼'}</td>
                        </tr>
                        {expandedRow === `${gi}-${li}` && (
                          <tr key={`exp-${gi}-${li}`} className="bg-slate-50">
                            <td colSpan={8} className="px-4 py-3">
                              <p className="text-xs text-slate-600 font-medium mb-2">
                                Reasoning: <span className="font-normal">{item.reasoning}</span>
                              </p>
                              <div className="space-y-1">
                                {(item.rules || []).map((rule, ri) => (
                                  <div key={ri} className="flex items-start gap-2 text-[11px]">
                                    <span className={rule.passed ? 'text-emerald-500' : 'text-rose-500'}>{rule.passed ? '✓' : '✗'}</span>
                                    <span className="font-medium text-slate-700 w-52 shrink-0">{rule.rule_name}</span>
                                    <span className="text-slate-500">{rule.reasoning}</span>
                                    <span className="text-slate-400 ml-auto shrink-0">{rule.confidence}%</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
