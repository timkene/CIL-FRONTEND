'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  listEnrollees, createEnrollee, updateEnrollee,
  listSupplies, confirmSupply, cancelSupply, retrySupplyPa,
  listInventory, createInventoryItem, updateInventoryItem,
  getCdrStats, triggerCdrNow,
  CdrApiError,
} from '@/lib/cdr-api'
import type {
  CdrEnrollee, CdrSupply, CdrInventoryItem, CdrStats, CdrMedication, SupplyStatus,
} from '@/lib/cdr-types'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const SUPPLY_STATUS_META: Record<SupplyStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-green-100 text-green-700' },
  expired:   { label: 'Expired',   cls: 'bg-slate-100 text-slate-500' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-400' },
  pa_failed: { label: 'PA Failed', cls: 'bg-red-100 text-red-700' },
}

function Badge({ status }: { status: SupplyStatus }) {
  const m = SUPPLY_STATUS_META[status] ?? { label: status, cls: 'bg-slate-100 text-slate-600' }
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${m.cls}`}>{m.label}</span>
}

function StatCard({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div className={`bg-white border rounded-lg p-5 ${warn ? 'border-red-200' : 'border-slate-200'}`}>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-3xl font-semibold ${warn ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  const isErr = msg.toLowerCase().startsWith('error') || msg.toLowerCase().includes('fail')
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm text-white
      ${isErr ? 'bg-red-600' : 'bg-emerald-600'}`}>
      {msg}
      <button className="ml-4 opacity-70 hover:opacity-100" onClick={onClose}>✕</button>
    </div>
  )
}

function Skeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-slate-100 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Dashboard tab ──────────────────────────────────────────────────────────────

function DashboardTab() {
  const [stats, setStats] = useState<CdrStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    getCdrStats()
      .then(setStats)
      .catch(() => setToast('Error loading stats'))
      .finally(() => setLoading(false))
  }, [])

  const handleTrigger = async (dryRun: boolean) => {
    setTriggering(true)
    try {
      const res = await triggerCdrNow(dryRun)
      if (dryRun && res.would_trigger) {
        setToast(`Dry run: ${res.would_trigger.length} enrollee(s) would be triggered`)
      } else {
        setToast(`Supply run triggered for ${res.would_trigger?.length ?? '?'} enrollee(s)`)
      }
    } catch (e) {
      setToast(`Error: ${e instanceof CdrApiError ? e.message : 'Trigger failed'}`)
    } finally {
      setTriggering(false)
    }
  }

  if (loading) return <div className="py-16 text-center text-slate-400">Loading…</div>

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active Enrollees"      value={stats?.active_enrollees ?? 0} />
        <StatCard label="Due Today"             value={stats?.due_today ?? 0} warn={(stats?.due_today ?? 0) > 0} />
        <StatCard label="Pending Confirmations" value={stats?.pending_confirmations ?? 0} />
        <StatCard label="Low Stock Drugs"       value={stats?.low_stock_count ?? 0} warn={(stats?.low_stock_count ?? 0) > 0} />
      </div>

      {/* Supply chart — simple table */}
      {stats && stats.supply_chart.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 text-sm">Supply Activity — Last 30 Days</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Date', 'Triggered', 'Confirmed'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...stats.supply_chart].reverse().map(row => (
                  <tr key={row.date} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{row.date}</td>
                    <td className="px-4 py-2">{row.triggered}</td>
                    <td className="px-4 py-2 text-green-600 font-medium">{row.confirmed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleTrigger(true)}
          disabled={triggering}
          className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          Dry Run
        </button>
        <button
          onClick={() => handleTrigger(false)}
          disabled={triggering}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {triggering ? 'Triggering…' : 'Trigger Supply Run Now'}
        </button>
      </div>
    </div>
  )
}

// ── Add Enrollee modal ─────────────────────────────────────────────────────────

const EMPTY_MED: CdrMedication = {
  drug_code: '', drug_name: '', quantity_per_supply: 30,
  diagnosis_code: '', procedure_code: '',
}

function AddEnrolleeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    enrollee_id: '', firstname: '', phone: '', last_supply_date: '',
  })
  const [meds, setMeds] = useState<CdrMedication[]>([{ ...EMPTY_MED }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const updateMed = (i: number, field: keyof CdrMedication, val: string | number) =>
    setMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))

  const submit = async () => {
    if (!form.enrollee_id || !form.firstname || !form.phone) {
      setErr('Enrollee ID, name, and phone are required')
      return
    }
    if (meds.some(m => !m.drug_code || !m.drug_name || !m.diagnosis_code || !m.procedure_code)) {
      setErr('All medication fields are required')
      return
    }
    setSaving(true)
    try {
      await createEnrollee({ ...form, medications: meds })
      onSaved()
    } catch (e) {
      setErr(e instanceof CdrApiError ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Add CDR Enrollee</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}

          {(['enrollee_id', 'firstname', 'phone'] as const).map(f => (
            <div key={f}>
              <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
                {f === 'enrollee_id' ? 'Enrollee ID' : f === 'firstname' ? 'Name' : 'Phone'}
              </label>
              <input
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                value={form[f]}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
              />
            </div>
          ))}

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">
              Last Supply Date (optional)
            </label>
            <input
              type="date"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={form.last_supply_date}
              onChange={e => setForm(p => ({ ...p, last_supply_date: e.target.value }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Medications</label>
              <button
                onClick={() => setMeds(p => [...p, { ...EMPTY_MED }])}
                className="text-xs text-blue-600 hover:underline"
              >+ Add drug</button>
            </div>
            {meds.map((m, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-3 mb-2 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-600">Drug {i + 1}</span>
                  {meds.length > 1 && (
                    <button
                      onClick={() => setMeds(p => p.filter((_, idx) => idx !== i))}
                      className="text-xs text-red-500 hover:underline"
                    >Remove</button>
                  )}
                </div>
                {(['drug_code', 'drug_name', 'diagnosis_code', 'procedure_code'] as const).map(f => (
                  <input
                    key={f}
                    placeholder={f.replace(/_/g, ' ')}
                    className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                    value={m[f] as string}
                    onChange={e => updateMed(i, f, e.target.value)}
                  />
                ))}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500">Qty/supply</label>
                  <input
                    type="number"
                    min={1}
                    className="w-20 border border-slate-200 rounded px-2 py-1 text-xs"
                    value={m.quantity_per_supply}
                    onChange={e => updateMed(i, 'quantity_per_supply', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Enrollee'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Enrollees tab ──────────────────────────────────────────────────────────────

function EnrolleesTab() {
  const [enrollees, setEnrollees] = useState<CdrEnrollee[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [actioning, setActioning] = useState<string | null>(null)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listEnrollees(statusFilter, page, PAGE_SIZE)
      setEnrollees(res.data)
      setTotal(res.total)
    } catch {
      setToast('Error loading enrollees')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => { load() }, [load])

  const setStatus = async (enrolleeId: string, status: string) => {
    setActioning(enrolleeId)
    try {
      await updateEnrollee(enrolleeId, { status })
      setToast(`Enrollee ${status}`)
      load()
    } catch (e) {
      setToast(`Error: ${e instanceof CdrApiError ? e.message : 'Update failed'}`)
    } finally {
      setActioning(null)
    }
  }

  const STATUS_COLORS: Record<string, string> = {
    active:     'bg-green-100 text-green-700',
    suspended:  'bg-amber-100 text-amber-700',
    discharged: 'bg-slate-100 text-slate-500',
  }

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {showAdd && (
        <AddEnrolleeModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setToast('Enrollee added'); load() }}
        />
      )}

      <div className="flex items-center gap-3">
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="discharged">Discharged</option>
        </select>
        <span className="text-sm text-slate-500 ml-auto">{total} enrollee{total !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Enrollee
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Enrollee ID', 'Name', 'Phone', 'Drugs', 'Status', 'Next Due', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <Skeleton rows={8} cols={7} /> : enrollees.map(e => (
                <tr key={e.enrollee_id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{e.enrollee_id}</td>
                  <td className="px-4 py-3 font-medium">{e.firstname}</td>
                  <td className="px-4 py-3 text-slate-500">{e.phone}</td>
                  <td className="px-4 py-3 text-slate-600">{e.medications.length}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[e.status] ?? ''}`}>
                      {e.status}
                    </span>
                    {e.is_due && <span className="ml-1 text-xs text-amber-600 font-medium">• Due</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{fmt(e.next_due_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {e.status === 'active' && (
                        <button
                          disabled={actioning === e.enrollee_id}
                          onClick={() => setStatus(e.enrollee_id, 'suspended')}
                          className="text-xs text-amber-600 hover:underline disabled:opacity-40"
                        >Suspend</button>
                      )}
                      {e.status === 'suspended' && (
                        <button
                          disabled={actioning === e.enrollee_id}
                          onClick={() => setStatus(e.enrollee_id, 'active')}
                          className="text-xs text-green-600 hover:underline disabled:opacity-40"
                        >Reactivate</button>
                      )}
                      {e.status !== 'discharged' && (
                        <button
                          disabled={actioning === e.enrollee_id}
                          onClick={() => setStatus(e.enrollee_id, 'discharged')}
                          className="text-xs text-red-500 hover:underline disabled:opacity-40"
                        >Discharge</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && enrollees.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No enrollees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-40"
          >← Prev</button>
          <span className="px-3 py-1 text-sm text-slate-500">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            disabled={page >= Math.ceil(total / PAGE_SIZE)}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-40"
          >Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Supplies tab ───────────────────────────────────────────────────────────────

function SuppliesTab() {
  const [supplies, setSupplies] = useState<CdrSupply[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState<SupplyStatus | ''>('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actioning, setActioning] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const PAGE_SIZE = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listSupplies(statusFilter, page, PAGE_SIZE)
      setSupplies(res.data)
      setTotal(res.total)
    } catch {
      setToast('Error loading supplies')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => { load() }, [load])

  const doAction = async (
    supplyId: string,
    action: 'confirm' | 'cancel' | 'retry'
  ) => {
    setActioning(supplyId)
    try {
      if (action === 'confirm') await confirmSupply(supplyId)
      else if (action === 'cancel') await cancelSupply(supplyId)
      else await retrySupplyPa(supplyId)
      setToast(`Supply ${action === 'retry' ? 'PA retried' : action + 'ed'}`)
      load()
    } catch (e) {
      setToast(`Error: ${e instanceof CdrApiError ? e.message : 'Action failed'}`)
    } finally {
      setActioning(null)
    }
  }

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div className="flex items-center gap-3">
        <select
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as SupplyStatus | ''); setPage(1) }}
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="pa_failed">PA Failed</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-sm text-slate-500 ml-auto">{total} record{total !== 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Supply ID', 'Enrollee', 'Drugs', 'Status', 'Triggered', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <Skeleton rows={8} cols={6} /> : supplies.map(s => (
                <>
                  <tr
                    key={s.supply_id}
                    className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                    onClick={() => setExpanded(expanded === s.supply_id ? null : s.supply_id)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{s.supply_id}</td>
                    <td className="px-4 py-3 text-slate-600">{s.enrollee_id}</td>
                    <td className="px-4 py-3">{s.medications.length}</td>
                    <td className="px-4 py-3"><Badge status={s.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDt(s.triggered_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        {(s.status === 'pending' || s.status === 'pa_failed') && (
                          <button
                            disabled={actioning === s.supply_id}
                            onClick={() => doAction(s.supply_id, 'confirm')}
                            className="text-xs text-green-600 hover:underline disabled:opacity-40"
                          >Confirm</button>
                        )}
                        {s.status === 'pa_failed' && (
                          <button
                            disabled={actioning === s.supply_id}
                            onClick={() => doAction(s.supply_id, 'retry')}
                            className="text-xs text-blue-600 hover:underline disabled:opacity-40"
                          >Retry PA</button>
                        )}
                        {s.status === 'pending' && (
                          <button
                            disabled={actioning === s.supply_id}
                            onClick={() => doAction(s.supply_id, 'cancel')}
                            className="text-xs text-red-500 hover:underline disabled:opacity-40"
                          >Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === s.supply_id && (
                    <tr key={`${s.supply_id}-exp`} className="bg-slate-50">
                      <td colSpan={6} className="px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-slate-500">
                              <th className="text-left py-1 pr-4">Drug</th>
                              <th className="text-left py-1 pr-4">Code</th>
                              <th className="text-left py-1 pr-4">Qty</th>
                              <th className="text-left py-1 pr-4">PA Number</th>
                              <th className="text-left py-1">PA Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.medications.map((m, i) => (
                              <tr key={i} className="border-t border-slate-200">
                                <td className="py-1 pr-4">{m.drug_name}</td>
                                <td className="py-1 pr-4 font-mono">{m.drug_code}</td>
                                <td className="py-1 pr-4">{m.quantity}</td>
                                <td className="py-1 pr-4 font-mono">{m.pa_number ?? '—'}</td>
                                <td className="py-1">
                                  <span className={`px-1.5 py-0.5 rounded font-semibold ${
                                    m.pa_status === 'ok' ? 'bg-green-100 text-green-700' :
                                    m.pa_status === 'failed' ? 'bg-red-100 text-red-600' :
                                    'text-slate-400'
                                  }`}>
                                    {m.pa_status ?? '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!loading && supplies.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No supplies found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-40">← Prev</button>
          <span className="px-3 py-1 text-sm text-slate-500">Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1 text-sm border border-slate-300 rounded disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Add Drug modal ─────────────────────────────────────────────────────────────

function AddDrugModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ drug_code: '', drug_name: '', unit_price: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!form.drug_code.trim() || !form.drug_name.trim()) {
      setErr('Drug code and name are required')
      return
    }
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price < 0) {
      setErr('Enter a valid price')
      return
    }
    setSaving(true)
    try {
      await createInventoryItem({ drug_code: form.drug_code.trim(), drug_name: form.drug_name.trim(), unit_price: price })
      onSaved()
    } catch (e) {
      setErr(e instanceof CdrApiError ? e.message : 'Failed to add drug')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">Add New Drug</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {err && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{err}</p>}
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Drug Code</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              placeholder="e.g. CDR0161"
              value={form.drug_code}
              onChange={e => setForm(p => ({ ...p, drug_code: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Drug Name</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="e.g. METFORMIN 500MG"
              value={form.drug_name}
              onChange={e => setForm(p => ({ ...p, drug_name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase block mb-1">Price per Unit (₦)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              placeholder="0.00"
              value={form.unit_price}
              onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))}
            />
          </div>
          <p className="text-xs text-slate-400">Stock will start at 0. Upload correct stock quantity via backend.</p>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Adding…' : 'Add Drug'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Inventory tab ──────────────────────────────────────────────────────────────

function InventoryTab() {
  const [items, setItems] = useState<CdrInventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editVals, setEditVals] = useState<{ name: string; price: string }>({ name: '', price: '' })
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInventory(debouncedSearch)
      setItems(res.data)
    } catch {
      setToast('Error loading inventory')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { load() }, [load])

  const startEdit = (item: CdrInventoryItem) => {
    setEditing(item.drug_code)
    setEditVals({ name: item.drug_name, price: String(item.unit_price) })
  }

  const saveEdit = async (drugCode: string) => {
    setSaving(true)
    try {
      await updateInventoryItem(drugCode, {
        drug_name:  editVals.name.trim() || undefined,
        unit_price: parseFloat(editVals.price),
      })
      setToast('Drug updated — price change applies to future orders only')
      setEditing(null)
      load()
    } catch (e) {
      setToast(`Error: ${e instanceof CdrApiError ? e.message : 'Save failed'}`)
    } finally {
      setSaving(false)
    }
  }

  const lowCount = items.filter(i => i.quantity_on_hand < i.low_stock_threshold).length

  return (
    <div className="space-y-4">
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}
      {showAdd && (
        <AddDrugModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); setToast('Drug added'); load() }}
        />
      )}

      <div className="flex items-center gap-3">
        <input
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-64"
          placeholder="Search drug name or code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-sm text-slate-500">
          {items.length} drug{items.length !== 1 ? 's' : ''}
          {lowCount > 0 && <span className="ml-2 text-red-500 font-medium">· {lowCount} low stock</span>}
        </span>
        <button
          onClick={() => setShowAdd(true)}
          className="ml-auto px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Drug
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Code', 'Drug Name', 'Stock', 'Unit Price (₦)', 'Last Updated', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <Skeleton rows={8} cols={6} /> : items.map(item => {
                const isLow = item.quantity_on_hand < item.low_stock_threshold
                const isEditing = editing === item.drug_code
                return (
                  <tr key={item.drug_code} className={`border-t border-slate-100 hover:bg-slate-50 ${isLow ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{item.drug_code}</td>
                    <td className="px-4 py-3 font-medium">
                      {isEditing ? (
                        <input
                          className="border border-slate-300 rounded px-2 py-1 text-sm w-64"
                          value={editVals.name}
                          onChange={e => setEditVals(p => ({ ...p, name: e.target.value }))}
                        />
                      ) : item.drug_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className={isLow ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                        {item.quantity_on_hand}
                      </span>
                      {isLow && <span className="ml-1.5 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">Low</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="border border-slate-300 rounded px-2 py-1 text-sm w-28"
                          value={editVals.price}
                          onChange={e => setEditVals(p => ({ ...p, price: e.target.value }))}
                        />
                      ) : (
                        <span>₦{item.unit_price.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{fmt(item.updated_at)}</td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-3">
                          <button disabled={saving} onClick={() => saveEdit(item.drug_code)}
                            className="text-xs text-green-600 hover:underline disabled:opacity-40">
                            {saving ? '…' : 'Save'}
                          </button>
                          <button onClick={() => setEditing(null)} className="text-xs text-slate-400 hover:underline">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:underline">
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {!loading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  {search ? `No drugs matching "${search}"` : 'No inventory items'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

type Tab = 'dashboard' | 'enrollees' | 'supplies' | 'inventory'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'enrollees', label: 'Enrollees' },
  { id: 'supplies',  label: 'Supplies' },
  { id: 'inventory', label: 'Inventory' },
]

export default function CdrPage() {
  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Chronic Drug Management</h1>
        <p className="text-sm text-slate-500 mt-1">Monthly supply scheduling, PA tracking, and inventory for chronic enrollees</p>
      </div>

      <div className="border-b border-slate-200 flex gap-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'enrollees' && <EnrolleesTab />}
      {tab === 'supplies'  && <SuppliesTab />}
      {tab === 'inventory' && <InventoryTab />}
    </div>
  )
}
