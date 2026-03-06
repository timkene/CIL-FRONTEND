'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { MLRSummary } from '@/lib/supabase'

interface Props { data: MLRSummary[]; mode: 'actual' | 'paid' }

const BINS = [
  { key: 'profitable', label: '< 50%',    color: '#22c55e', desc: 'Profitable' },
  { key: 'warning',    label: '50 – 75%', color: '#f59e0b', desc: 'Watch Zone' },
  { key: 'loss',       label: '> 75%',    color: '#ef4444', desc: 'Loss Territory' },
]

export default function BinsChart({ data, mode }: Props) {
  const withDebit = data.filter(d => d.total_debit_amount > 0)

  const counts = withDebit.reduce(
    (acc, d) => {
      const mlr = mode === 'actual' ? d.actual_mlr : d.claims_paid_mlr
      if (mlr < 0.50)      acc.profitable++
      else if (mlr <= 0.75) acc.warning++
      else                  acc.loss++
      return acc
    },
    { profitable: 0, warning: 0, loss: 0 }
  )

  const chartData = BINS.map(b => ({
    ...b,
    count: counts[b.key as keyof typeof counts],
  }))

  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm xl:col-span-2">
      <div className="mb-6">
        <h4 className="text-lg font-bold">Portfolio MLR Distribution</h4>
        <p className="text-sm text-slate-500">
          Clients grouped by {mode === 'actual' ? 'Actual' : 'Claims-Paid'} MLR band
        </p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} barSize={64} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 13, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Clients', angle: -90, position: 'insideLeft', fontSize: 12, fill: '#94a3b8' }}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as { desc: string; count: number; color: string }
              return (
                <div className="bg-white border border-slate-200 rounded-lg shadow p-3 text-sm">
                  <p className="font-bold" style={{ color: d.color }}>{d.desc}</p>
                  <p className="text-slate-600">{d.count} clients</p>
                </div>
              )
            }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-6 mt-4 justify-center">
        {BINS.map(b => (
          <div key={b.key} className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-3 h-3 rounded-full" style={{ background: b.color }} />
            {b.label} — {b.desc}
          </div>
        ))}
      </div>
    </div>
  )
}
