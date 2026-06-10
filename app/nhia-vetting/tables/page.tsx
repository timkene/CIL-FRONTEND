'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button, Modal, useToast } from '@/components/ui'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface TableMeta  { collection: string; label: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>

function fmtVal(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (Array.isArray(v)) return v.join(', ')
  if (typeof v === 'object') {
    // Show flat objects as Key: Value pairs
    const entries = Object.entries(v as Record<string, unknown>)
    if (entries.length <= 3) return entries.map(([k, val]) => `${k}: ${val}`).join(' | ')
    return JSON.stringify(v)
  }
  return String(v)
}

// Collect every key across docs for column headers (max first 10 non-_id)
function getColumns(docs: Doc[]): string[] {
  const seen = new Set<string>()
  for (const d of docs) {
    for (const k of Object.keys(d)) {
      if (k !== '_id') seen.add(k)
      if (seen.size >= 10) break
    }
  }
  return ['_id', ...Array.from(seen)]
}

// ── EditModal — field-by-field form ──────────────────────────────────────────
function EditModal({
  doc, collection, onSave, onClose,
}: { doc: Doc | null; collection: string; onSave: () => void; onClose: () => void }) {
  const isNew = !doc || !doc._id
  const toast = useToast()

  // Build initial fields: existing doc keys (minus _id) or one empty row for new
  const initFields = (): Array<{ key: string; value: string }> => {
    if (isNew) return [{ key: '', value: '' }]
    return Object.entries(doc!).filter(([k]) => k !== '_id').map(([k, v]) => ({
      key: k,
      value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
    }))
  }

  const [fields,  setFields]  = useState(initFields)
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  function setField(i: number, part: 'key' | 'value', val: string) {
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, [part]: val } : f))
  }

  function addField() { setFields(prev => [...prev, { key: '', value: '' }]) }
  function removeField(i: number) { setFields(prev => prev.filter((_, idx) => idx !== i)) }

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      const body: Doc = {}
      for (const { key, value } of fields) {
        if (!key.trim()) continue
        // Try to parse as JSON for booleans/numbers/arrays; fall back to string
        try { body[key.trim()] = JSON.parse(value) } catch { body[key.trim()] = value }
      }
      const url = isNew
        ? `${API}/api/v1/nhia/tables/${collection}`
        : `${API}/api/v1/nhia/tables/${collection}/${doc!._id}`
      const res = await fetch(url, {
        method:  isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Save failed') }
      toast.success(isNew ? 'Record added successfully' : 'Record updated successfully')
      onSave()
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Save failed'
      setErr(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={isNew ? 'Add Record' : 'Edit Record'}
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-2">
        {!isNew && <p className="text-xs text-slate-400 font-mono mb-3">_id: {doc!._id}</p>}

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_2fr_auto] gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wide pb-1 border-b border-slate-100">
          <span>Field</span><span>Value</span><span />
        </div>

        {fields.map((f, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
            <input
              value={f.key}
              onChange={e => setField(i, 'key', e.target.value)}
              placeholder="field_name"
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#137fec] font-mono text-slate-600"
            />
            <input
              value={f.value}
              onChange={e => setField(i, 'value', e.target.value)}
              placeholder="value"
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#137fec] text-slate-800"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeField(i)}
              className="text-slate-300 hover:text-rose-500 text-sm"
            >
              ✕
            </Button>
          </div>
        ))}

        <Button
          variant="ghost"
          size="sm"
          onClick={addField}
          className="text-xs text-[#137fec] hover:underline mt-1"
        >
          + Add field
        </Button>

        {err && <p className="text-xs text-rose-600 mt-2">{err}</p>}
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TablesPage() {
  const [tables,     setTables]     = useState<TableMeta[]>([])
  const [active,     setActive]     = useState<string>('')
  const [docs,       setDocs]       = useState<Doc[]>([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [editDoc,    setEditDoc]    = useState<Doc | null | undefined>(undefined) // undefined=closed, null=new
  const [deleting,   setDeleting]   = useState<string | null>(null)
  const limit = 50
  const toast = useToast()

  useEffect(() => {
    fetch(`${API}/api/v1/nhia/tables`)
      .then(r => r.json())
      .then(d => { setTables(d.tables || []); if (d.tables?.length) setActive(d.tables[0].collection) })
      .catch(() => {
        const errorMsg = 'Failed to load tables'
        setError(errorMsg)
        toast.error(errorMsg)
      })
  }, [toast])

  const loadDocs = useCallback(async () => {
    if (!active) return
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (search) params.set('q', search)
      const res  = await fetch(`${API}/api/v1/nhia/tables/${active}?${params}`)
      const data = await res.json()
      setDocs(data.docs || [])
      setTotal(data.total || 0)
    } catch {
      const errorMsg = 'Failed to load records'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }, [active, page, search, toast])

  useEffect(() => { loadDocs() }, [loadDocs])

  // Reset page when table or search changes
  useEffect(() => { setPage(1) }, [active, search])

  async function handleDelete(id: string) {
    if (!confirm('Delete this record? This cannot be undone.')) return
    setDeleting(id)
    try {
      const res = await fetch(`${API}/api/v1/nhia/tables/${active}/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Record deleted successfully')
        loadDocs()
      } else {
        toast.error('Failed to delete record')
      }
    } catch {
      toast.error('Error deleting record')
    } finally {
      setDeleting(null)
    }
  }

  const cols      = getColumns(docs)
  const activeLabel = tables.find(t => t.collection === active)?.label || active
  const totalPages  = Math.ceil(total / limit)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <Link href="/nhia-vetting" className="text-xs text-[#137fec] hover:underline">← NHIA Vetting</Link>
          <h2 className="font-bold text-slate-900 mt-2 text-sm">Data Tables</h2>
          <p className="text-xs text-slate-400">MongoDB reference collections</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {tables.map(t => (
            <Button
              key={t.collection}
              variant={active === t.collection ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setActive(t.collection)}
              className={`w-full justify-start ${active === t.collection ? 'border-r-2 border-[#137fec]' : ''}`}
            >
              {t.label}
            </Button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <h1 className="font-bold text-slate-900">{activeLabel}</h1>
            <p className="text-xs text-slate-400 mt-0.5">{total.toLocaleString()} records</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 w-48"
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => setEditDoc(null)}
            >
              + Add Record
            </Button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-slate-400 text-sm">No records found</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  {cols.map(c => (
                    <th key={c} className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, i) => (
                  <tr key={doc._id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    {cols.map(c => (
                      <td key={c} className="px-4 py-2.5 max-w-[200px]">
                        <span className="block truncate text-slate-700" title={fmtVal(doc[c])}>
                          {fmtVal(doc[c])}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditDoc(doc)}
                        className="text-xs font-semibold text-[#137fec] mr-2"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(doc._id)}
                        disabled={deleting === doc._id}
                        className="text-xs text-slate-300 hover:text-rose-500"
                      >
                        {deleting === doc._id ? '…' : '✕'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-200 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Prev
            </Button>
            <span className="text-sm text-slate-500 px-2">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Edit/Add modal */}
      {editDoc !== undefined && (
        <EditModal
          doc={editDoc}
          collection={active}
          onSave={() => { setEditDoc(undefined); loadDocs() }}
          onClose={() => setEditDoc(undefined)}
        />
      )}
    </div>
  )
}
