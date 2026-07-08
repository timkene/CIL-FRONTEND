'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button, Badge, useToast } from '@/components/ui'
import { nhiaFetch } from '@/lib/nhia-fetch'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface Claim {
  batch_id: string
  batch_name: string
  encounter_date: string
  accepted_at: string
  enrollee_id: string
  procedure_code: string
  procedure_name: string
  diagnosis_code: string
  diagnosis_name: string
  decision: string
  confidence: number | null
  reasoning: string | null
  drop_reason: string | null
  total_amount: number | null
  pipeline_stage: string | null
  encounter_date_from: string | null
  encounter_date_to: string | null
  date_submitted: string | null
  pa_number: string | null
  provider_id: string | null
  provider_name: string | null
  stated_price: number | null
  stated_quantity: number | null
  adjusted_price: number | null
  adjusted_quantity: number | null
  paid: boolean
  paid_date: string | null
}

type ClaimKey = { batch_id: string; enrollee_id: string; procedure_code: string }

function fmtMoney(n: number | null) {
  if (!n) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return s.slice(0, 10)
}
function claimKey(c: Claim): string {
  return `${c.batch_id}::${c.enrollee_id}::${c.procedure_code}`
}

export default function NHIAClaimsPage() {
  const toast = useToast()

  const [claims, setClaims]         = useState<Claim[]>([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [decision, setDecision]     = useState('ALL')
  const [search, setSearch]         = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [page, setPage]             = useState(1)
  const limit = 50

  // Pay state
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [showPay, setShowPay]     = useState(false)
  const [payDate, setPayDate]     = useState(new Date().toISOString().slice(0, 10))
  const [paying, setPaying]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (decision !== 'ALL') params.set('decision', decision)
      if (search)   params.set('search', search)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo)   params.set('date_to', dateTo)
      const res  = await fetch(`${API}/api/v1/nhia/claims?${params}`)
      const data = await res.json()
      setClaims(data.claims || [])
      setTotal(data.total || 0)
      setSelected(new Set())
    } catch {
      const msg = 'Failed to load claims'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [decision, search, dateFrom, dateTo, page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  function handleSearch(e: React.SyntheticEvent) {
    e.preventDefault()
    setPage(1)
    load()
  }

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const approvableOnPage = claims.filter(c => c.decision === 'APPROVE' && !c.paid)

  function selectAllOnPage() {
    setSelected(new Set(approvableOnPage.map(claimKey)))
  }

  async function handlePay() {
    if (selected.size === 0) return
    if (!payDate) { toast.error('Enter a payment date'); return }
    setPaying(true)
    try {
      const keyMap = new Map(claims.map(c => [claimKey(c), c]))
      const claim_keys: ClaimKey[] = [...selected].map(k => {
        const c = keyMap.get(k)!
        return { batch_id: c.batch_id, enrollee_id: c.enrollee_id, procedure_code: c.procedure_code }
      })
      const res = await nhiaFetch(`${API}/api/v1/nhia/claims/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim_keys, paid_date: payDate }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Pay failed') }
      const data = await res.json()
      toast.success(`${data.paid} claim${data.paid !== 1 ? 's' : ''} marked as paid`)
      setShowPay(false)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Pay failed')
    } finally {
      setPaying(false)
    }
  }

  const totalPages   = Math.ceil(total / limit)
  const denialReason = (c: Claim) => c.decision === 'DENY' ? (c.drop_reason || c.reasoning || '—') : null

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">NHIA Claims</h1>
          <p className="text-sm text-slate-500 mt-0.5">All individual claim lines from accepted batches</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <Button variant="primary" size="md" onClick={() => setShowPay(true)}
              className="bg-emerald-600 hover:bg-emerald-700">
              Pay Selected ({selected.size})
            </Button>
          )}
          {approvableOnPage.length > 0 && selected.size === 0 && (
            <Button variant="outline" size="md" onClick={selectAllOnPage}>
              Select All Approved ({approvableOnPage.length})
            </Button>
          )}
          <Link href="/nhia-vetting/learning"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Learning DB
          </Link>
          <Link href="/nhia-vetting/supervisor"
            className="px-3 py-2 text-sm font-semibold text-[#137fec] border border-[#137fec] rounded-lg hover:bg-[#137fec]/5 transition-colors">
            Supervisor
          </Link>
          <Link href="/nhia-vetting"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            ← Batches
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(['ALL', 'APPROVE', 'DENY', 'PAID'] as const).map(d => (
              <Button key={d} variant={decision === d ? 'primary' : 'ghost'} size="sm"
                type="button"
                onClick={() => { setDecision(d); setPage(1) }}
                className={`rounded-none ${
                  decision === d && d === 'APPROVE' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  decision === d && d === 'DENY'    ? 'bg-rose-500 hover:bg-rose-600'       :
                  decision === d && d === 'PAID'    ? 'bg-[#137fec] hover:bg-[#137fec]/90' : ''
                }`}>
                {d}
              </Button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input type="text" placeholder="Search enrollee ID or procedure…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
          </div>
          <Button type="submit" variant="primary" size="md">Search</Button>
          {(search || dateFrom || dateTo) && (
            <Button type="button" variant="ghost" size="md"
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setPage(1) }}>
              Clear
            </Button>
          )}
        </div>
      </form>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {!loading && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {total.toLocaleString()} claim{total !== 1 ? 's' : ''}
            {decision !== 'ALL' && ` · ${decision}`}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </span>
          {totalPages > 1 && <span>Page {page} of {totalPages}</span>}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">No claims found</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox"
                    checked={approvableOnPage.length > 0 && approvableOnPage.every(c => selected.has(claimKey(c)))}
                    onChange={e => e.target.checked ? selectAllOnPage() : setSelected(new Set())}
                    className="rounded border-slate-300" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">PA #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Enrollee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Procedure</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Diagnosis</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Enc. From</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Enc. To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date Submitted</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-50/50">Stated Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-50/50">Stated Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap bg-emerald-50/30">Approved Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap bg-emerald-50/30">Approved Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap bg-emerald-50/30">Approved Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Stated Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-rose-500 uppercase tracking-wide whitespace-nowrap bg-rose-50/30">Denied Amt</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Decision</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Paid</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Denial Reason</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Batch</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c, i) => {
                const key        = claimKey(c)
                const isSelected = selected.has(key)
                const canSelect  = c.decision === 'APPROVE' && !c.paid
                const reason     = denialReason(c)
                const statedTotal = c.stated_price != null
                  ? Math.round((c.stated_price * (c.stated_quantity ?? 1)) * 100) / 100
                  : null
                const deniedAmt = statedTotal != null && c.total_amount != null
                  ? Math.round((statedTotal - c.total_amount) * 100) / 100
                  : statedTotal
                return (
                  <tr key={`${key}-${i}`}
                    className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-emerald-50/40' : i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-3 py-3 text-center">
                      {canSelect && (
                        <input type="checkbox" checked={isSelected}
                          onChange={() => toggleSelect(key)}
                          className="rounded border-slate-300 accent-emerald-600" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{c.pa_number || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{c.enrollee_id || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-800 text-xs">{c.procedure_code}</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate" title={c.procedure_name ?? undefined}>{c.procedure_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-800 text-xs">{c.diagnosis_code || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-[160px] truncate" title={c.diagnosis_name ?? undefined}>{c.diagnosis_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-slate-700">{c.provider_id || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-[160px] truncate" title={c.provider_name ?? undefined}>{c.provider_name || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{fmtDate(c.encounter_date_from)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{fmtDate(c.encounter_date_to)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(c.date_submitted)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap bg-slate-50/30">{fmtMoney(c.stated_price)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap bg-slate-50/30">{c.stated_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap bg-emerald-50/20">
                      {c.adjusted_price != null ? (
                        <span className={c.adjusted_price !== c.stated_price ? 'text-amber-600' : 'text-slate-800'}>
                          {fmtMoney(c.adjusted_price)}
                          {c.adjusted_price !== c.stated_price && c.stated_price != null && (
                            <span className="block text-[10px] font-normal text-slate-400 line-through">{fmtMoney(c.stated_price)}</span>
                          )}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap bg-emerald-50/20">
                      {c.adjusted_quantity != null ? (
                        <span className={c.adjusted_quantity !== c.stated_quantity ? 'text-amber-600' : 'text-slate-800'}>
                          {c.adjusted_quantity}
                          {c.adjusted_quantity !== c.stated_quantity && c.stated_quantity != null && (
                            <span className="block text-[10px] font-normal text-slate-400 line-through">{c.stated_quantity}</span>
                          )}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-900 whitespace-nowrap bg-emerald-50/20">{fmtMoney(c.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap">{fmtMoney(statedTotal)}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap bg-rose-50/20">
                      {deniedAmt != null && deniedAmt > 0
                        ? <span className="text-rose-600">{fmtMoney(deniedAmt)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={c.decision === 'APPROVE' ? 'success' : c.decision === 'DENY' ? 'error' : 'neutral'} size="sm">
                        {c.decision}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {c.paid ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">PAID</span>
                          {c.paid_date && <p className="text-[10px] text-slate-400 mt-0.5">{c.paid_date}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      {reason
                        ? <p className="text-xs text-rose-600 leading-relaxed">{reason}</p>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-slate-700">{c.batch_name || c.batch_id}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ← Prev
          </Button>
          <span className="text-sm text-slate-500 px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next →
          </Button>
        </div>
      )}

      {/* ── Pay Modal ── */}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Mark as Paid</h2>
              <button onClick={() => setShowPay(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-slate-600">
              Marking <span className="font-bold text-emerald-700">{selected.size}</span> claim{selected.size !== 1 ? 's' : ''} as paid.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Payment Date</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="ghost" size="md" onClick={() => setShowPay(false)} className="flex-1">Cancel</Button>
              <Button variant="primary" size="md" onClick={handlePay} loading={paying}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
