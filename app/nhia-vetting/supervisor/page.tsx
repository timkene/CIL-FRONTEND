'use client'
import { useEffect, useState, Fragment } from 'react'
import Link from 'next/link'
import { Button, Badge, useToast } from '@/components/ui'
import { nhiaFetch } from '@/lib/nhia-fetch'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LineItem {
  procedure_code:     string
  procedure_name:     string
  diagnosis_code:     string
  diagnosis_name:     string
  decision:           string
  original_ai_decision?: string
  supervisor_override?: boolean
  confidence:         number
  reasoning:          string
  drop_reason:        string | null
  stated_price:       number | null
  tariff_price:       number | null
  adjusted_price:     number | null
  stated_quantity:    number | null
  adjusted_quantity:  number | null
  total_amount:       number | null
}

interface VettingResult {
  enrollee_id?:           string
  overall_decision?:      string
  total_approved_amount?: number
  line_items?:            LineItem[]
  error?:                 string
}

interface Batch {
  batch_id:        string
  batch_name:      string
  status:          string
  created_by:      string
  created_at:      string
  encounter_date:  string
  total_rows:      number
  total_approved:  number
  total_denied:    number
  total_amount:    number
  vetting_results: VettingResult[] | null
}

interface RowOverride {
  enrollee_id:       string
  procedure_code:    string
  override_decision: 'APPROVE' | 'DENY'
  adjusted_quantity?: number
  adjusted_price?:    number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function rowKey(enrolleeId: string, procedureCode: string) {
  return `${enrolleeId}|${procedureCode}`
}

// ── BatchCard ─────────────────────────────────────────────────────────────────

function BatchCard({ batch, onReviewed }: { batch: Batch; onReviewed: () => void }) {
  const [expanded,     setExpanded]     = useState(false)
  const [expandedLine, setExpandedLine] = useState<string | null>(null)
  // key → 'APPROVE' | 'DENY' — only entries the supervisor has overridden
  const [overrides,    setOverrides]    = useState<Record<string, 'APPROVE' | 'DENY'>>({})
  // key → supervisor-edited quantity / price
  const [qtyEdits,     setQtyEdits]     = useState<Record<string, number>>({})
  const [priceEdits,   setPriceEdits]   = useState<Record<string, number>>({})
  const [reviewer,     setReviewer]     = useState('Supervisor')
  const [notes,        setNotes]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const toast = useToast()

  // Effective decision for a row: override if present, else AI's decision
  function effectiveDecision(eid: string, item: LineItem): 'APPROVE' | 'DENY' {
    const k = rowKey(eid, item.procedure_code)
    return (overrides[k] ?? item.decision) as 'APPROVE' | 'DENY'
  }

  function toggleRow(eid: string, item: LineItem) {
    const k    = rowKey(eid, item.procedure_code)
    const curr = effectiveDecision(eid, item)
    const next: 'APPROVE' | 'DENY' = curr === 'APPROVE' ? 'DENY' : 'APPROVE'
    // If next equals the original AI decision, remove override (no longer changed)
    if (next === item.decision) {
      setOverrides(prev => { const n = { ...prev }; delete n[k]; return n })
    } else {
      setOverrides(prev => ({ ...prev, [k]: next }))
    }
  }

  const overrideCount = Object.keys(overrides).length

  // Recalculate totals with overrides for summary display
  const allItems: Array<{ eid: string; item: LineItem }> = []
  for (const r of batch.vetting_results ?? []) {
    for (const item of r.line_items ?? []) {
      allItems.push({ eid: r.enrollee_id ?? '', item })
    }
  }
  const previewApproved = allItems.filter(({ eid, item }) => effectiveDecision(eid, item) === 'APPROVE').length
  const previewDenied   = allItems.length - previewApproved

  // All keys that have any supervisor change (decision OR qty/price)
  const allEditedKeys = new Set([
    ...Object.keys(overrides),
    ...Object.keys(qtyEdits),
    ...Object.keys(priceEdits),
  ])

  function effectiveTotal(eid: string, item: LineItem): number | null {
    const k    = rowKey(eid, item.procedure_code)
    const qty   = qtyEdits[k]   ?? item.adjusted_quantity ?? item.stated_quantity ?? 1
    const price = priceEdits[k] ?? item.adjusted_price    ?? item.stated_price
    return price != null ? Math.round(price * qty * 100) / 100 : item.total_amount
  }

  async function doAccept() {
    setSubmitting(true)
    try {
      const rowOverrides: RowOverride[] = Array.from(allEditedKeys).map(key => {
        const [enrollee_id, procedure_code] = key.split('|')
        const override: RowOverride = {
          enrollee_id,
          procedure_code,
          override_decision: overrides[key] ?? (
            allItems.find(x => rowKey(x.eid, x.item.procedure_code) === key)?.item.decision as 'APPROVE' | 'DENY'
          ) ?? 'APPROVE',
        }
        if (qtyEdits[key]   != null) override.adjusted_quantity = qtyEdits[key]
        if (priceEdits[key] != null) override.adjusted_price    = priceEdits[key]
        return override
      }).filter(o => o.override_decision)
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batch.batch_id}/accept`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'ACCEPT',
          reviewed_by:  reviewer,
          notes,
          row_overrides: rowOverrides,
        }),
      })
      if (res.ok) {
        toast.success(
          overrideCount > 0
            ? `Batch accepted with ${overrideCount} override${overrideCount !== 1 ? 's' : ''}`
            : 'Batch accepted successfully'
        )
        onReviewed()
      } else {
        toast.error('Failed to accept batch')
      }
    } catch (err) {
      toast.error('Error accepting batch')
    } finally {
      setSubmitting(false)
    }
  }

  async function doReject() {
    setSubmitting(true)
    try {
      const res = await nhiaFetch(`${API}/api/v1/nhia/web-batches/${batch.batch_id}/reject`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'REJECT', reviewed_by: reviewer, notes }),
      })
      if (res.ok) {
        toast.success('Batch rejected')
        onReviewed()
      } else {
        toast.error('Failed to reject batch')
      }
    } catch (err) {
      toast.error('Error rejecting batch')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Batch header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900">{batch.batch_name}</h3>
            <Link href={`/nhia-vetting/${batch.batch_id}`} className="text-xs text-[#137fec] hover:underline">
              Full view ↗
            </Link>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {batch.encounter_date} · by {batch.created_by} · {batch.total_rows} rows
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-emerald-600">{batch.total_approved}</p>
            <p className="text-[10px] text-slate-400">AI Approved</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-rose-500">{batch.total_denied}</p>
            <p className="text-[10px] text-slate-400">AI Denied</p>
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-slate-900">{fmtMoney(batch.total_amount)}</p>
            <p className="text-[10px] text-slate-400">Total</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpanded(e => !e)}
          >
            {expanded ? 'Collapse' : 'Review'}
          </Button>
        </div>
      </div>

      {expanded && (
        <>
          {/* Per-row vetting results */}
          <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto">
            {(batch.vetting_results ?? []).map((result, gi) => (
              <div key={gi}>
                {/* Enrollee subheader */}
                <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50">
                  <span className="text-xs font-bold text-slate-600">Enrollee: {result.enrollee_id}</span>
                  <span className="text-xs font-semibold text-emerald-600">{fmtMoney(result.total_approved_amount)}</span>
                </div>

                {result.error ? (
                  <p className="px-5 py-3 text-xs text-rose-600">Error: {result.error}</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-4 py-2 text-slate-400 font-medium">Procedure</th>
                        <th className="text-left px-4 py-2 text-slate-400 font-medium">Diagnosis</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-medium">Stated</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-medium">Tariff</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-medium">Qty</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-medium">Price</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-medium">Total</th>
                        <th className="text-left px-4 py-2 text-slate-400 font-medium">AI Decision</th>
                        <th className="text-left px-4 py-2 text-slate-400 font-medium">Supervisor</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {(result.line_items ?? []).map((item, li) => {
                        const eid          = result.enrollee_id ?? ''
                        const lineKey      = `${gi}-${li}`
                        const k            = rowKey(eid, item.procedure_code)
                        const effective    = effectiveDecision(eid, item)
                        const isOverridden = overrides[k] !== undefined
                        const hasQtyEdit   = qtyEdits[k]   != null
                        const hasPriceEdit = priceEdits[k] != null
                        const dispQty      = qtyEdits[k]   ?? item.adjusted_quantity ?? item.stated_quantity ?? 1
                        const dispPrice    = priceEdits[k] ?? item.adjusted_price    ?? item.stated_price
                        const dispTotal    = effectiveTotal(eid, item)
                        const hasEdit      = isOverridden || hasQtyEdit || hasPriceEdit
                        return (
                          <Fragment key={lineKey}>
                            <tr
                              className={`border-b border-slate-50 cursor-pointer transition-colors ${
                                hasEdit ? 'bg-amber-50/60 hover:bg-amber-50' : 'hover:bg-slate-50/50'
                              }`}
                              onClick={() => setExpandedLine(expandedLine === lineKey ? null : lineKey)}
                            >
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-slate-800">{item.procedure_code}</p>
                                <p className="text-slate-400 truncate max-w-[140px]" title={item.procedure_name}>{item.procedure_name}</p>
                              </td>
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-slate-800">{item.diagnosis_code}</p>
                                <p className="text-slate-400 truncate max-w-[140px]" title={item.diagnosis_name}>{item.diagnosis_name}</p>
                              </td>
                              {/* Stated price + AI slash indicator */}
                              <td className="px-4 py-2.5 text-right text-[11px]">
                                <p className="text-slate-400">{fmtMoney(item.stated_price)}</p>
                              </td>
                              {/* Tariff */}
                              <td className="px-4 py-2.5 text-right text-slate-400 text-[11px]">{fmtMoney(item.tariff_price)}</td>

                              {/* Editable Qty */}
                              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                <input
                                  type="number"
                                  min={1}
                                  value={dispQty}
                                  onChange={e => {
                                    const v = parseInt(e.target.value) || 1
                                    setQtyEdits(prev => ({ ...prev, [k]: v }))
                                  }}
                                  className={`w-14 text-xs text-right border rounded px-1.5 py-0.5 focus:outline-none focus:border-[#137fec] ${
                                    hasQtyEdit ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                                  }`}
                                />
                              </td>

                              {/* Editable Price */}
                              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={dispPrice ?? ''}
                                  placeholder="—"
                                  onChange={e => {
                                    const v = parseFloat(e.target.value)
                                    if (!isNaN(v)) setPriceEdits(prev => ({ ...prev, [k]: v }))
                                  }}
                                  className={`w-24 text-xs text-right border rounded px-1.5 py-0.5 focus:outline-none focus:border-[#137fec] ${
                                    hasPriceEdit ? 'border-amber-400 bg-amber-50' : 'border-slate-200'
                                  }`}
                                />
                              </td>

                              {/* Recalculated total */}
                              <td className={`px-4 py-2.5 text-right font-semibold ${(hasQtyEdit || hasPriceEdit) ? 'text-amber-700' : 'text-slate-900'}`}>
                                {fmtMoney(dispTotal)}
                              </td>

                              {/* AI Decision + slash indicators */}
                              <td className="px-4 py-2.5">
                                <Badge
                                  variant={item.decision === 'APPROVE' ? 'success' : 'error'}
                                  size="sm"
                                >
                                  {item.decision}
                                </Badge>
                                {item.drop_reason && (
                                  <p className="text-[10px] text-rose-400 mt-0.5 max-w-[120px] truncate" title={item.drop_reason}>
                                    {item.drop_reason}
                                  </p>
                                )}
                                {/* Show AI price slashing inline */}
                                {item.adjusted_price != null && item.stated_price != null && item.adjusted_price !== item.stated_price && (
                                  <p className="text-[10px] text-amber-600 mt-0.5 whitespace-nowrap">
                                    Price: {fmtMoney(item.stated_price)} → {fmtMoney(item.adjusted_price)}
                                  </p>
                                )}
                                {item.adjusted_quantity != null && item.stated_quantity != null && item.adjusted_quantity !== item.stated_quantity && (
                                  <p className="text-[10px] text-amber-600 whitespace-nowrap">
                                    Qty: {item.stated_quantity} → {item.adjusted_quantity}
                                  </p>
                                )}
                              </td>

                              {/* Supervisor decision */}
                              <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                {isOverridden ? (
                                  <Badge
                                    variant={effective === 'APPROVE' ? 'success' : 'error'}
                                    size="sm"
                                  >
                                    {effective}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-slate-300">Same as AI</span>
                                )}
                              </td>

                              {/* Override toggle */}
                              <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                                <Button
                                  variant={isOverridden ? 'outline' : item.decision === 'APPROVE' ? 'danger' : 'primary'}
                                  size="sm"
                                  onClick={() => toggleRow(eid, item)}
                                  className="text-[10px]"
                                >
                                  {isOverridden ? 'Revert' : item.decision === 'APPROVE' ? 'Override → DENY' : 'Override → APPROVE'}
                                </Button>
                              </td>
                            </tr>

                            {/* Expanded reasoning row */}
                            {expandedLine === lineKey && (
                              <tr key={`exp-${lineKey}`} className="bg-blue-50/40">
                                <td colSpan={10} className="px-5 py-3 text-[11px] text-slate-600 space-y-1">
                                  <p><strong>Reasoning:</strong> {item.reasoning}</p>
                                  {item.adjusted_quantity !== item.stated_quantity && item.adjusted_quantity != null && (
                                    <p className="text-amber-600">AI qty: {item.stated_quantity} → {item.adjusted_quantity}</p>
                                  )}
                                  {item.adjusted_price !== item.stated_price && item.adjusted_price != null && (
                                    <p className="text-amber-600">AI price: {fmtMoney(item.stated_price)} → {fmtMoney(item.adjusted_price)} (tariff cap)</p>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>

          {/* Override summary strip */}
          {overrideCount > 0 && (
            <div className="px-5 py-2.5 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-2">
              <span className="font-bold">{overrideCount} row{overrideCount !== 1 ? 's' : ''} overridden</span>
              <span className="text-amber-500">·</span>
              <span>Final: <strong className="text-emerald-600">{previewApproved} approved</strong>, <strong className="text-rose-500">{previewDenied} denied</strong></span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOverrides({})}
                className="ml-auto text-amber-600 hover:text-amber-700"
              >
                Reset all overrides
              </Button>
            </div>
          )}

          {/* Review action panel */}
          <div className="border-t border-slate-200 px-5 py-4 bg-slate-50/60">
            <p className="text-xs font-bold text-slate-600 mb-3">
              Supervisor Decision
              {overrideCount > 0 && (
                <span className="ml-2 font-normal text-amber-600">
                  ({overrideCount} row{overrideCount !== 1 ? 's' : ''} will be overridden)
                </span>
              )}
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  value={reviewer}
                  onChange={e => setReviewer(e.target.value)}
                  placeholder="Reviewer name"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec] w-48"
                />
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Notes (optional)…"
                  rows={2}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec] resize-none"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={doAccept}
                  loading={submitting}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 focus-visible:ring-emerald-500"
                >
                  {overrideCount > 0
                    ? `Accept (${overrideCount} override${overrideCount !== 1 ? 's' : ''}) — Store to MongoDB`
                    : 'Accept — Store to MongoDB'}
                </Button>
                <Button
                  variant="danger"
                  size="md"
                  onClick={doReject}
                  disabled={submitting}
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SupervisorPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const toast = useToast()

  async function loadBatches() {
    setLoading(true)
    setError('')
    try {
      const res  = await nhiaFetch(`${API}/api/v1/nhia/web-batches/supervisor`)
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

  useEffect(() => { loadBatches() }, [])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link href="/nhia-vetting" className="text-slate-400 hover:text-slate-600 text-sm">← Back</Link>
            <h1 className="text-xl font-bold text-slate-900">Supervisor Review</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Review AI-vetted batches · override individual rows before accepting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{batches.length} batch{batches.length !== 1 ? 'es' : ''} pending</span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadBatches}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading…</div>
      ) : batches.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No batches awaiting review</p>
          <p className="text-xs text-slate-300 mt-1">Vetted batches will appear here for supervisor approval</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map(b => (
            <BatchCard key={b.batch_id} batch={b} onReviewed={loadBatches} />
          ))}
        </div>
      )}
    </div>
  )
}
