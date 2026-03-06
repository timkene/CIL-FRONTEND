'use client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts'
import { MLRSummary } from '@/lib/supabase'

interface Props {
  label: string
  clients: MLRSummary[]
}

const MLR_CATEGORIES = [
  { key: 'under50',  label: '< 50%' },
  { key: 'mid',      label: '50–75%' },
  { key: 'over75',   label: '> 75%' },
]

const ACTUAL_COLOR = '#137fec'
const PAID_COLOR   = '#94a3b8'

function bucket(mlr: number): 'under50' | 'mid' | 'over75' {
  if (mlr < 0.50)      return 'under50'
  if (mlr <= 0.75)     return 'mid'
  return 'over75'
}

export default function DebitBinChart({ label, clients }: Props) {
  const chartData = MLR_CATEGORIES.map(cat => {
    const actual = clients.filter(c => bucket(c.actual_mlr)     === cat.key).length
    const paid   = clients.filter(c => bucket(c.claims_paid_mlr) === cat.key).length
    return { category: cat.label, actual, paid }
  })

  const total = clients.length

  const categoryColors: Record<string, string> = {
    '< 50%':   '#22c55e',
    '50–75%':  '#f59e0b',
    '> 75%':   '#ef4444',
  }

  if (total === 0) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
        <div className="mb-4">
          <h4 className="text-base font-bold">{label}</h4>
          <p className="text-xs text-slate-400 mt-0.5">No clients in this debit range</p>
        </div>
        <div className="flex-1 flex items-center justify-center h-40 text-slate-300 text-sm">
          No data
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-base font-bold">{label}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{total} client{total !== 1 ? 's' : ''}</p>
        </div>
        {/* mini legend */}
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
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            content={({ active, payload, label: lbl }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-white border border-slate-200 rounded-lg shadow p-3 text-xs">
                  <p className="font-bold mb-1" style={{ color: categoryColors[lbl ?? ''] ?? '#64748b' }}>{lbl}</p>
                  {payload.map(p => (
                    <p key={p.name} className="text-slate-600">
                      {p.name === 'actual' ? 'Actual' : 'Claims-Paid'}: <strong>{p.value}</strong> clients
                    </p>
                  ))}
                </div>
              )
            }}
          />
          <Bar dataKey="actual" name="actual" fill={ACTUAL_COLOR} radius={[4, 4, 0, 0]} />
          <Bar dataKey="paid"   name="paid"   fill={PAID_COLOR}   radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
