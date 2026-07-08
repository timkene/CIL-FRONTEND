'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Badge, Card, useToast } from '@/components/ui'
import { SearchComboBox, type ComboOption } from '@/components/SearchComboBox'
import { nhiaFetch } from '@/lib/nhia-fetch'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface Batch {
  batch_id: string
  batch_name: string
  status: 'OPEN' | 'PROCESSING' | 'VETTED' | 'ACCEPTED' | 'REJECTED'
  created_by: string
  created_at: string
  encounter_date: string
  total_rows: number
  total_approved: number
  total_denied: number
  total_amount: number
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number) {
  return n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtMoney(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function fetchProviders(q: string): Promise<ComboOption[]> {
  if (q.length < 2) return []
  try {
    const res = await fetch(`${API}/api/v1/klaire/providers?q=${encodeURIComponent(q)}&limit=20`)
    const data = await res.json()
    return (data.providers || []).map((p: { provider_id: string; provider_name: string }) => ({
      code:  p.provider_id,
      name:  p.provider_name,
      label: p.provider_name,
    }))
  } catch {
    return []
  }
}

const TEMPLATE_HEADERS = [
  'pa_number','enrollee_id','first_name','last_name',
  'procedure_code','procedure_name','diagnosis_code','diagnosis_name',
  'provider_id','provider_name','encounter_date_from','encounter_date_to',
  'date_submitted','price','quantity','decision','approved_price','approved_qty','reasoning',
]

export default function NHIAVettingPage() {
  const router = useRouter()
  const toast  = useToast()

  const [batches, setBatches]           = useState<Batch[]>([])
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [error, setError]               = useState('')
  const [deletingId, setDeletingId]     = useState<string | null>(null)

  // Create batch modal
  const now = new Date()
  const [showCreate, setShowCreate]       = useState(false)
  const [providerKey, setProviderKey]     = useState('')
  const [providerName, setProviderName]   = useState('')
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[now.getMonth()])
  const [selectedYear, setSelectedYear]   = useState(String(now.getFullYear()))
  const [creating, setCreating]           = useState(false)

  // Import vetted modal
  const [showImport, setShowImport]       = useState(false)
  const [importBatchId, setImportBatchId] = useState('')
  const [importFile, setImportFile]       = useState<File | null>(null)
  const [importing, setImporting]         = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Rename all
  const [renaming, setRenaming] = useState(false)

  const batchNamePreview = providerName
    ? `${providerName}-${selectedMonth}-${selectedYear}`
    : ''

  async function loadBatches() {
    setLoading(true)
    try {
      const url = statusFilter === 'ALL'
        ? `${API}/api/v1/nhia/web-batches`
        : `${API}/api/v1/nhia/web-batches?status=${statusFilter}`
      const res  = await nhiaFetch(url)
      const data = await res.json()
      setBatches(data.batches || [])
    } catch {
      toast.error('Failed to load batches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBatches() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createBatch() {
    if (!providerName) { toast.error('Please select a provider'); return }
    setCreating(true)
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          created_by:    'staff',
          provider_name: providerName,
          provider_id:   providerKey,
          batch_name:    batchNamePreview,
        }),
      })
      const data = await res.json()
      setShowCreate(false)
      setProviderKey('')
      setProviderName('')
      toast.success(`Batch "${batchNamePreview}" created`)
      router.push(`/nhia-vetting/${data.batch_id}`)
    } catch {
      toast.error('Failed to create batch')
      setCreating(false)
    }
  }

  async function deleteBatch(batchId: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingId(batchId)
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batchId}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Delete failed') }
      toast.success('Batch deleted')
      setBatches(prev => prev.filter(b => b.batch_id !== batchId))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRenameAll() {
    if (!confirm('Rename ALL existing batches to ProviderName-MMM-YYYY format? This will overwrite current batch names.')) return
    setRenaming(true)
    try {
      const res  = await nhiaFetch(`${API}/api/v1/nhia/web-batches/rename-all`, { method: 'POST' })
      const data = await res.json()
      toast.success(`Renamed ${(data.web_batches_renamed ?? 0) + (data.vetted_batches_renamed ?? 0)} batches`)
      await loadBatches()
    } catch {
      toast.error('Rename failed')
    } finally {
      setRenaming(false)
    }
  }

  async function handleImport() {
    if (!importBatchId) { toast.error('Select a batch to associate with'); return }
    if (!importFile)    { toast.error('Select a CSV or Excel file'); return }
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', importFile)
      const res = await nhiaFetch(
        `${API}/api/v1/nhia/web-batches/${importBatchId}/import-vetted`,
        { method: 'POST', body: form },
      )
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Import failed') }
      const data = await res.json()
      setShowImport(false)
      setImportFile(null)
      setImportBatchId('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      toast.success(`Imported ${data.rows_imported} rows → Claims table`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  function downloadTemplate() {
    const csv  = TEMPLATE_HEADERS.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = 'vetted_claims_template.csv'
    a.click()
  }

  const counts    = batches.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc }, {} as Record<string, number>)
  const allBatches = statusFilter === 'ALL' ? batches : batches.filter(b => b.status === statusFilter)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">NHIA Claims Vetting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage NHIA claims batches for AI-powered vetting</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/nhia-vetting/tables"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Data Tables
          </Link>
          <Link href="/nhia-vetting/claims"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Claims
          </Link>
          <Link href="/nhia-vetting/learning"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Learning DB
          </Link>
          <Link href="/nhia-vetting/supervisor"
            className="px-3 py-2 text-sm font-semibold text-[#137fec] border border-[#137fec] rounded-lg hover:bg-[#137fec]/5 transition-colors">
            Supervisor Review
          </Link>
          <Link href="/nhia-vetting/audit-log"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Audit Log
          </Link>
          <Button variant="outline" size="md" onClick={() => setShowImport(true)}>
            ↑ Import Vetted
          </Button>
          <Button variant="outline" size="md" onClick={handleRenameAll} loading={renaming}>
            Rename All
          </Button>
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
            + New Batch
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['OPEN', 'VETTED', 'ACCEPTED', 'REJECTED'] as const).map(s => (
          <Card key={s} padding="md" interactive
            onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
            className={`cursor-pointer ${statusFilter === s ? 'border-[#137fec] ring-1 ring-[#137fec]/30' : ''}`}>
            <p className="text-2xl font-bold text-slate-900">{counts[s] || 0}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{s}</p>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {['ALL', 'OPEN', 'VETTED', 'ACCEPTED', 'REJECTED'].map(s => (
          <Button key={s} variant="ghost" size="sm"
            onClick={() => setStatusFilter(s)}
            className={`border-b-2 rounded-none ${statusFilter === s ? 'border-[#137fec] text-[#137fec]' : 'border-transparent'}`}>
            {s}
          </Button>
        ))}
      </div>

      {/* Batch table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
      ) : allBatches.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No batches found</p>
          <Button variant="primary" size="md" onClick={() => setShowCreate(true)} className="mt-4">
            Create First Batch
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Batch</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rows</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Approved</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Denied</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {allBatches.map((b, i) => (
                <tr key={b.batch_id}
                  className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{b.batch_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">by {b.created_by}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={b.status === 'ACCEPTED' ? 'success' : b.status === 'REJECTED' ? 'error' : b.status === 'VETTED' ? 'warning' : 'info'}
                      size="sm">
                      {b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(b.total_rows)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(b.total_approved)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-500">{fmt(b.total_denied)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {b.total_amount > 0 ? fmtMoney(b.total_amount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{b.encounter_date}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/nhia-vetting/${b.batch_id}`}
                        className="text-xs font-semibold text-[#137fec] hover:underline">
                        {b.status === 'OPEN' ? 'Edit' : 'View'}
                      </Link>
                      {b.status !== 'ACCEPTED' && (
                        <Button variant="ghost" size="sm"
                          onClick={() => deleteBatch(b.batch_id, b.batch_name)}
                          disabled={deletingId === b.batch_id}
                          className="text-xs text-slate-300 hover:text-rose-500"
                          title="Delete batch">
                          {deletingId === b.batch_id ? '…' : '✕'}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Batch Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">New Batch</h2>
              <button onClick={() => { setShowCreate(false); setProviderKey(''); setProviderName('') }}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Provider</label>
                <SearchComboBox
                  code={providerKey}
                  name={providerName}
                  fetchOptions={fetchProviders}
                  placeholder="Search provider name…"
                  onSelect={(key, name) => { setProviderKey(key); setProviderName(name) }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Month</label>
                  <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30">
                    {MONTHS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Year</label>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30">
                    {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              {batchNamePreview && (
                <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                  <p className="text-[11px] text-slate-500 mb-1 uppercase tracking-wide font-semibold">Batch name preview</p>
                  <p className="text-sm font-bold text-slate-900 font-mono break-all">{batchNamePreview}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" size="md"
                onClick={() => { setShowCreate(false); setProviderKey(''); setProviderName('') }}
                className="flex-1">
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={createBatch}
                loading={creating} disabled={!providerName} className="flex-1">
                Create Batch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Vetted Claims Modal ── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Import Manually Vetted Claims</h2>
              <button onClick={() => { setShowImport(false); setImportFile(null); setImportBatchId('') }}
                className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Associated Batch</label>
                <select value={importBatchId} onChange={e => setImportBatchId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30">
                  <option value="">— Select a batch —</option>
                  {batches.map(b => (
                    <option key={b.batch_id} value={b.batch_id}>
                      {b.batch_name} ({b.status})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">The import creates a new accepted batch that appears in Claims. The batch selected here is for reference only.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-800 mb-1.5">Expected CSV/Excel columns:</p>
                <p className="text-[11px] text-blue-700 font-mono leading-relaxed break-all">
                  {TEMPLATE_HEADERS.join(', ')}
                </p>
                <p className="text-[11px] text-blue-600 mt-2">
                  <strong>decision</strong> = APPROVE or DENY &nbsp;·&nbsp;
                  <strong>approved_price/qty</strong> = optional, defaults to stated values
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-2 text-xs">
                  ↓ Download CSV Template
                </Button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Upload File (CSV or Excel)</label>
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls"
                  onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-50" />
                {importFile && <p className="text-xs text-slate-500 mt-1">{importFile.name}</p>}
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="ghost" size="md"
                onClick={() => { setShowImport(false); setImportFile(null); setImportBatchId('') }}
                className="flex-1">
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleImport}
                loading={importing} disabled={!importBatchId || !importFile} className="flex-1">
                Import Claims
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
