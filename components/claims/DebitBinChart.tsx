'use client'
import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { MLRSummary } from '@/lib/supabase'

interface Props {
  label: string
  clients: MLRSummary[]
}

interface ModalState {
  category: string
  type: 'actual' | 'paid'
  clients: MLRSummary[]
}

const MLR_CATEGORIES = [
  { key: 'under50',  label: '< 50%' },
  { key: 'mid',      label: '50–75%' },
  { key: 'over75',   label: '> 75%' },
]

const ACTUAL_COLOR = '#137fec'
const PAID_COLOR   = '#94a3b8'

const CATEGORY_COLORS: Record<string, string> = {
  '< 50%':   '#22c55e',
  '50–75%':  '#f59e0b',
  '> 75%':   '#ef4444',
}

function bucket(mlr: number): 'under50' | 'mid' | 'over75' {
  if (mlr < 0.50)  return 'under50'
  if (mlr <= 0.75) return 'mid'
  return 'over75'
}

function fmt(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function mlrColor(mlr: number) {
  if (mlr > 0.75) return 'text-rose-600'
  if (mlr > 0.50) return 'text-amber-600'
  return 'text-emerald-600'
}

export default function DebitBinChart({ label, clients }: Props) {
  const [modal, setModal] = useState<ModalState | null>(null)

  const chartData = MLR_CATEGORIES.map(cat => {
    const actual = clients.filter(c => bucket(c.actual_mlr)      === cat.key).length
    const paid   = clients.filter(c => bucket(c.claims_paid_mlr) === cat.key).length
    return { category: cat.label, catKey: cat.key, actual, paid }
  })

  const total = clients.length

  function openModal(catLabel: string, catKey: string, type: 'actual' | 'paid') {
    const field = type === 'actual' ? 'actual_mlr' : 'claims_paid_mlr'
    const matched = clients.filter(c => bucket(c[field]) === catKey)
    setModal({ category: catLabel, type, clients: matched })
  }

  if (total === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="mb-4">
          <h4 className="text-base font-bold">{label}</h4>
          <p className="text-xs text-slate-400 mt-0.5">No clients in this range</p>
        </div>
        <div className="flex-1 flex items-center justify-center h-40 text-slate-300 text-sm">No data</div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h4 className="text-base font-bold">{label}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{total} client{total !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: ACTUAL_COLOR }} />
              Actual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: PAID_COLOR }} />
              Claims-Paid
            </span>
          </div>
        </div>

        <p className="text-[10px] text-slate-400 -mt-2 mb-2">Click any bar to see the clients</p>

        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={chartData}
            barCategoryGap="30%"
            barGap={3}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="category"
              tick={{ fontSize: 12, fontWeight: 600, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: '#f8fafc' }}
              content={({ active, payload, label: lbl }) => {
                if (!active || !payload?.length) return null
                return (
                  <div className="bg-white border border-slate-200 rounded-lg shadow p-3 text-xs">
                    <p className="font-bold mb-1" style={{ color: CATEGORY_COLORS[lbl ?? ''] ?? '#64748b' }}>{lbl}</p>
                    {payload.map(p => (
                      <p key={p.name} className="text-slate-600">
                        {p.name === 'actual' ? 'Actual' : 'Claims-Paid'}: <strong>{p.value}</strong> clients
                      </p>
                    ))}
                    <p className="text-slate-400 mt-1 italic">Click to view list</p>
                  </div>
                )
              }}
            />
            <Bar
              dataKey="actual"
              name="actual"
              fill={ACTUAL_COLOR}
              radius={[4, 4, 0, 0]}
              style={{ cursor: 'pointer' }}
              onClick={(d: unknown) => { const e = d as { category: string; catKey: string }; openModal(e.category, e.catKey, 'actual') }}
            />
            <Bar
              dataKey="paid"
              name="paid"
              fill={PAID_COLOR}
              radius={[4, 4, 0, 0]}
              style={{ cursor: 'pointer' }}
              onClick={(d: unknown) => { const e = d as { category: string; catKey: string }; openModal(e.category, e.catKey, 'paid') }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Client list modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  {label} — {modal.category}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modal.type === 'actual' ? 'Actual MLR' : 'Claims-Paid MLR'} ·{' '}
                  <strong>{modal.clients.length}</strong> client{modal.clients.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              {modal.clients.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No clients</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Client</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Debit</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actual MLR</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Claims-Paid MLR</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">End Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modal.clients
                      .sort((a, b) => b.actual_mlr - a.actual_mlr)
                      .map(c => (
                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{c.group_name}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{fmt(c.total_debit_amount)}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${mlrColor(c.actual_mlr)}`}>
                            {(c.actual_mlr * 100).toFixed(1)}%
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${mlrColor(c.claims_paid_mlr)}`}>
                            {(c.claims_paid_mlr * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-right text-slate-500">
                            {c.end_date ? new Date(c.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
