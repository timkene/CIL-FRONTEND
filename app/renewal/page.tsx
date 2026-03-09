'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface RenewalReport {
  id:             number
  group_id:       number
  group_name:     string
  contract_start: string
  contract_end:   string
  days_to_expiry: number
  pdf_url:        string | null
  generated_at:   string
  week_number:    number
  week_year:      number
}

function DaysBadge({ days }: { days: number }) {
  const color =
    days <= 30  ? 'bg-rose-100 text-rose-700' :
    days <= 60  ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded ${color}`}>
      {days}d left
    </span>
  )
}

export default function RenewalPage() {
  const [reports,  setReports]  = useState<RenewalReport[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    supabase
      .from('renewal_reports')
      .select('*')
      .order('days_to_expiry', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); setLoading(false); return }
        setReports(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = reports.filter(r =>
    r.group_name.toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const within30 = reports.filter(r => r.days_to_expiry <= 30).length
  const within60 = reports.filter(r => r.days_to_expiry > 30 && r.days_to_expiry <= 60).length
  const within90 = reports.filter(r => r.days_to_expiry > 60).length
  const latestTs = reports.length
    ? reports.reduce((max, r) => r.generated_at > max ? r.generated_at : max, reports[0].generated_at)
    : null
  const lastGenerated = latestTs
    ? new Date(latestTs).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="material-symbols-outlined text-4xl text-[#137fec]" style={{ animation: 'spin 1s linear infinite' }}>
          progress_activity
        </span>
        <p className="text-sm font-medium">Loading renewal reports...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 max-w-md text-center">
        <span className="material-symbols-outlined text-3xl mb-2">error</span>
        <p className="font-bold">Failed to load data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    </div>
  )

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight">Renewal Plan</h2>
        {lastGenerated && (
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="material-symbols-outlined text-sm">schedule</span>
            Last generated: {lastGenerated}
          </div>
        )}
      </header>

      <div className="p-4 md:p-8 space-y-6 md:space-y-8">

        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <span className="material-symbols-outlined text-6xl mb-4">event_upcoming</span>
            <p className="text-base font-medium text-slate-400">No renewal reports yet</p>
            <p className="text-sm mt-1 text-center max-w-xs">
              Reports are generated every Monday for clients expiring within 90 days.
            </p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Expiring ≤ 30 days', count: within30, color: 'text-rose-600',  bg: 'bg-rose-50',  border: 'border-rose-200',  icon: 'warning' },
                { label: 'Expiring 31–60 days', count: within60, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: 'schedule' },
                { label: 'Expiring 61–90 days', count: within90, color: 'text-blue-600',  bg: 'bg-blue-50',  border: 'border-blue-200',  icon: 'event_upcoming' },
              ].map(c => (
                <div key={c.label} className={`${c.bg} ${c.border} border rounded-xl p-4 md:p-5`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`material-symbols-outlined ${c.color}`} style={{ fontSize: '18px' }}>{c.icon}</span>
                    <p className="text-xs font-semibold text-slate-500 hidden sm:block">{c.label}</p>
                  </div>
                  <p className={`text-2xl md:text-3xl font-extrabold ${c.color}`}>{c.count}</p>
                  <p className="text-xs text-slate-400 mt-1 sm:hidden">{c.label}</p>
                </div>
              ))}
            </div>

            {/* Table card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Table header */}
              <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="text-lg font-bold">Renewal Analysis Reports</h4>
                  <p className="text-sm text-slate-500">
                    {filtered.length} client{filtered.length !== 1 ? 's' : ''} — sorted by days to expiry
                  </p>
                </div>
                <div className="relative w-full sm:w-56">
                  <span
                    className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 leading-none"
                    style={{ fontSize: '18px' }}
                  >search</span>
                  <input
                    className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] w-full outline-none"
                    placeholder="Search clients..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-4 md:px-6 py-3">#</th>
                      <th className="px-4 md:px-6 py-3">Client</th>
                      <th className="px-4 md:px-6 py-3">Contract Period</th>
                      <th className="px-4 md:px-6 py-3 text-center">Expiry</th>
                      <th className="px-4 md:px-6 py-3 hidden md:table-cell">Generated</th>
                      <th className="px-4 md:px-6 py-3 text-center">Report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((r, i) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 md:px-6 py-4 text-slate-400 font-medium">{i + 1}</td>
                        <td className="px-4 md:px-6 py-4 font-bold">{r.group_name}</td>
                        <td className="px-4 md:px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                          {r.contract_start} → {r.contract_end}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          <DaysBadge days={r.days_to_expiry} />
                        </td>
                        <td className="px-4 md:px-6 py-4 text-slate-500 text-xs hidden md:table-cell whitespace-nowrap">
                          {new Date(r.generated_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </td>
                        <td className="px-4 md:px-6 py-4 text-center">
                          {r.pdf_url ? (
                            <a
                              href={r.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#137fec]/10 text-[#137fec] rounded-lg text-xs font-bold hover:bg-[#137fec]/20 transition-colors"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                              <span className="hidden sm:inline">Download PDF</span>
                              <span className="sm:hidden">PDF</span>
                            </a>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                          No clients match your search
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Info note */}
            <div className="bg-[#137fec]/5 border border-[#137fec]/20 rounded-xl p-4 flex gap-3">
              <span className="material-symbols-outlined text-[#137fec] shrink-0" style={{ fontSize: '20px' }}>info</span>
              <p className="text-xs text-slate-600 leading-relaxed">
                Reports are auto-generated every <strong>Monday</strong> for clients with contracts expiring within 90 days.
                Each report includes MLR analysis, SRS risk classification, PMPM pricing, and AI-powered renewal recommendations.
                Reports are available for <strong>120 days</strong> then automatically removed.
              </p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
