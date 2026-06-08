'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button, Badge, Card, useToast } from '@/components/ui'
import { nhiaFetch } from '@/lib/nhia-fetch'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface Batch {
  batch_id: string
  batch_name: string
  status: 'OPEN' | 'VETTED' | 'ACCEPTED' | 'REJECTED'
  created_by: string
  created_at: string
  encounter_date: string
  total_rows: number
  total_approved: number
  total_denied: number
  total_amount: number
}

const STATUS_STYLE: Record<string, string> = {
  OPEN:     'bg-blue-50 text-blue-700 border border-blue-200',
  VETTED:   'bg-amber-50 text-amber-700 border border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
}

function fmt(n: number) {
  return n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtMoney(n: number) {
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function NHIAVettingPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const toast = useToast()

  async function loadBatches() {
    setLoading(true)
    try {
      const url = statusFilter === 'ALL'
        ? `${API}/api/v1/nhia/web-batches`
        : `${API}/api/v1/nhia/web-batches?status=${statusFilter}`
      const res = await nhiaFetch(url)
      const data = await res.json()
      setBatches(data.batches || [])
    } catch {
      const errorMsg = 'Failed to load batches'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadBatches() }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createBatch() {
    setCreating(true)
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_by: 'staff' }),
      })
      const data = await res.json()
      toast.success('Batch created successfully')
      router.push(`/nhia-vetting/${data.batch_id}`)
    } catch {
      const errorMsg = 'Failed to create batch'
      setError(errorMsg)
      toast.error(errorMsg)
      setCreating(false)
    }
  }

  async function deleteBatch(batchId: string, batchName: string) {
    if (!confirm(`Delete "${batchName}"? This cannot be undone.`)) return
    setDeletingId(batchId)
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batchId}`, { method: 'DELETE' })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Delete failed') }
      toast.success('Batch deleted successfully')
      setBatches(prev => prev.filter(b => b.batch_id !== batchId))
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : 'Delete failed'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setDeletingId(null)
    }
  }

  const counts = batches.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const allBatches = statusFilter === 'ALL' ? batches : batches.filter(b => b.status === statusFilter)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">NHIA Claims Vetting</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage NHIA claims batches for AI-powered vetting</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/nhia-vetting/tables"
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Data Tables
          </Link>
          <Link
            href="/nhia-vetting/claims"
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Claims
          </Link>
          <Link
            href="/nhia-vetting/learning"
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Learning DB
          </Link>
          <Link
            href="/nhia-vetting/supervisor"
            className="px-4 py-2 text-sm font-semibold text-[#137fec] border border-[#137fec] rounded-lg hover:bg-[#137fec]/5 transition-colors"
          >
            Supervisor Review
          </Link>
          <Link
            href="/nhia-vetting/audit-log"
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Audit Log
          </Link>
          <Button
            variant="primary"
            size="md"
            onClick={createBatch}
            loading={creating}
          >
            + New Batch
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(['OPEN', 'VETTED', 'ACCEPTED', 'REJECTED'] as const).map(s => (
          <Card
            key={s}
            padding="md"
            interactive
            onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
            className={`cursor-pointer ${statusFilter === s ? 'border-[#137fec] ring-1 ring-[#137fec]/30' : ''}`}
          >
            <p className="text-2xl font-bold text-slate-900">{counts[s] || 0}</p>
            <p className="text-xs font-medium text-slate-500 mt-1">{s}</p>
          </Card>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {['ALL', 'OPEN', 'VETTED', 'ACCEPTED', 'REJECTED'].map(s => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter(s)}
            className={`border-b-2 rounded-none ${
              statusFilter === s
                ? 'border-[#137fec] text-[#137fec]'
                : 'border-transparent'
            }`}
          >
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
          <Button
            variant="primary"
            size="md"
            onClick={createBatch}
            loading={creating}
            className="mt-4"
          >
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
                <tr key={b.batch_id} className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{b.batch_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">by {b.created_by}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        b.status === 'ACCEPTED' ? 'success' :
                        b.status === 'REJECTED' ? 'error' :
                        b.status === 'VETTED' ? 'warning' : 'info'
                      }
                      size="sm"
                    >
                      {b.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{fmt(b.total_rows)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(b.total_approved)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-rose-500">{fmt(b.total_denied)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{b.total_amount > 0 ? fmtMoney(b.total_amount) : '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{b.encounter_date}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/nhia-vetting/${b.batch_id}`}
                        className="text-xs font-semibold text-[#137fec] hover:underline"
                      >
                        {b.status === 'OPEN' ? 'Edit' : 'View'}
                      </Link>
                      {b.status !== 'ACCEPTED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteBatch(b.batch_id, b.batch_name)}
                          disabled={deletingId === b.batch_id}
                          className="text-xs text-slate-300 hover:text-rose-500"
                          title="Delete batch"
                        >
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
    </div>
  )
}
