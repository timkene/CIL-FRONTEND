'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Report {
  id: number
  report_period: string
  status: string
  report_markdown: string | null
  key_metrics: string | null
  triggered_at: string
  generated_at: string | null
}

interface KeyMetrics {
  pa_total_granted_2026_ytd: number
  pa_total_granted_2025: number
  pa_count_2026_ytd: number
  claims_approved_2026_ytd: number
  claims_approved_2025: number
  claims_count_2026_ytd: number
  inpatient_pct_2026: number
  denial_rate_2026: number
  top_5_pa_diagnoses: string[]
  top_5_pa_providers: string[]
  top_5_pa_groups: string[]
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const Mn = (n: number) => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`
  return `₦${(n / 1_000).toFixed(0)}K`
}

function StatusBadge({ status }: { status: string }) {
  const isComplete = status === 'complete'
  const isRunning  = status === 'running'
  const isError    = status.startsWith('error')
  const cls = isComplete ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : isRunning  ? 'bg-amber-100 text-amber-700 border-amber-200'
    : isError    ? 'bg-rose-100 text-rose-700 border-rose-200'
    : 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
      {isRunning && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
      {isComplete ? 'Complete' : isRunning ? 'Generating…' : isError ? 'Error' : status}
    </span>
  )
}

// ── Markdown renderer (simple) ─────────────────────────────────────────────────
function MarkdownReport({ md }: { md: string }) {
  // Split into sections by H2 headings
  const sections = md.split(/^## /m).filter(Boolean)

  return (
    <div className="space-y-6">
      {sections.map((section, i) => {
        const [heading, ...bodyLines] = section.split('\n')
        const body = bodyLines.join('\n').trim()
        return (
          <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
              <h3 className="text-base font-bold text-slate-800">{heading.trim()}</h3>
            </div>
            <div className="px-6 py-5">
              <FormattedBody text={body} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FormattedBody({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = (key: string) => {
    if (listBuffer.length) {
      elements.push(
        <ul key={key} className="list-none space-y-1.5 my-3">
          {listBuffer.map((item, j) => (
            <li key={j} className="flex gap-2 text-sm text-slate-700">
              <span className="text-[#137fec] mt-0.5 shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (!trimmed) { flushList(`fl-${i}`); return }

    if (trimmed.startsWith('### ')) {
      flushList(`fl-${i}`)
      elements.push(<h4 key={i} className="text-sm font-bold text-slate-700 mt-5 mb-2 border-l-2 border-[#137fec] pl-3">{trimmed.slice(4)}</h4>)
    } else if (trimmed.startsWith('#### ')) {
      flushList(`fl-${i}`)
      elements.push(<h5 key={i} className="text-xs font-bold text-slate-600 uppercase tracking-wide mt-4 mb-1">{trimmed.slice(5)}</h5>)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listBuffer.push(trimmed.slice(2))
    } else if (/^\d+\./.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\d+\.\s*/, ''))
    } else {
      flushList(`fl-${i}`)
      elements.push(
        <p key={i} className="text-sm text-slate-700 leading-relaxed my-2"
           dangerouslySetInnerHTML={{ __html: inlineFormat(trimmed) }} />
      )
    }
  })
  flushList('final')

  return <div>{elements}</div>
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-slate-900">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-[#137fec] px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/₦([\d,]+(?:\.\d+)?[BMK]?)/g, '<span class="font-semibold text-emerald-700">₦$1</span>')
}

// ── Key Metrics Strip ──────────────────────────────────────────────────────────
function MetricsStrip({ raw }: { raw: string }) {
  let m: KeyMetrics
  try { m = JSON.parse(raw) } catch { return null }

  const yoy = m.pa_total_granted_2025
    ? ((m.pa_total_granted_2026_ytd - m.pa_total_granted_2025) / m.pa_total_granted_2025 * 100)
    : 0

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'PA Granted 2026 YTD', val: Mn(m.pa_total_granted_2026_ytd), sub: `vs ${Mn(m.pa_total_granted_2025)} full 2025` },
        { label: 'PA Count 2026 YTD',   val: m.pa_count_2026_ytd.toLocaleString(), sub: `${yoy >= 0 ? '+' : ''}${yoy.toFixed(1)}% YoY` },
        { label: 'Claims Approved 2026', val: Mn(m.claims_approved_2026_ytd), sub: `${m.claims_count_2026_ytd.toLocaleString()} claims` },
        { label: 'Inpatient % 2026',    val: `${m.inpatient_pct_2026}%`,  sub: `${m.denial_rate_2026}% denial rate` },
      ].map(c => (
        <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 font-medium">{c.label}</p>
          <p className="text-xl font-extrabold text-slate-800 mt-1">{c.val}</p>
          <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}

// ── Run Now Button ─────────────────────────────────────────────────────────────
async function triggerWorkflow(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch('/api/trigger-report', { method: 'POST' })
    const body = await res.json()
    return { ok: res.ok, message: body.message ?? (res.ok ? 'Triggered' : 'Failed') }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [reports,   setReports]   = useState<Report[]>([])
  const [selected,  setSelected]  = useState<Report | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [running,   setRunning]   = useState(false)
  const [runMsg,    setRunMsg]    = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { load() }, [])

  // Clean up polling on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('ai_monthly_reports')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(24)
    setReports(data ?? [])
    if (data?.length) setSelected(data[0])
    setLoading(false)
  }

  async function handleRunNow() {
    setRunning(true)
    setRunMsg('Triggering report…')
    const { ok, message } = await triggerWorkflow()
    if (!ok) {
      setRunMsg(`Failed: ${message}`)
      setRunning(false)
      return
    }
    setRunMsg('Report is generating (takes ~5–10 minutes). This page will update automatically.')
    // Poll every 30s for the new report
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('ai_monthly_reports')
        .select('*')
        .order('triggered_at', { ascending: false })
        .limit(1)
        .single()
      if (data?.status === 'complete' || data?.status?.startsWith('error')) {
        clearInterval(pollRef.current!)
        setRunning(false)
        setRunMsg(data.status === 'complete' ? 'Report ready!' : `Error: ${data.status}`)
        load()
      }
    }, 30_000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-[#137fec] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading reports…</p>
      </div>
    </div>
  )

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight">AI Medical Analytics</h2>
          <p className="text-xs text-slate-400">Powered by Claude Opus 4.6 · Runs last day of every month</p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={running}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
            ${running
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-[#137fec] text-white hover:bg-[#0f6fd4]'}`}
        >
          {running
            ? <><span className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" /> Generating…</>
            : '▶ Run Report Now'}
        </button>
      </header>

      <div className="p-4 md:p-8">
        {runMsg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${runMsg.startsWith('Failed') || runMsg.startsWith('Error') ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
            {runMsg}
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar — report list */}
          <div className="w-52 shrink-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Reports</p>
            {reports.length === 0 ? (
              <p className="text-xs text-slate-400">No reports yet. Click "Run Report Now" to generate your first one.</p>
            ) : (
              <div className="space-y-1.5">
                {reports.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all text-sm
                      ${selected?.id === r.id
                        ? 'bg-[#137fec] text-white border-[#137fec]'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-[#137fec] hover:text-[#137fec]'}`}
                  >
                    <div className="font-semibold">{r.report_period}</div>
                    <div className={`text-xs mt-0.5 ${selected?.id === r.id ? 'text-blue-100' : 'text-slate-400'}`}>
                      {r.generated_at ? new Date(r.generated_at).toLocaleDateString('en-GB') : '—'}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={r.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Main — report content */}
          <div className="flex-1 min-w-0">
            {!selected ? (
              <div className="text-center py-20 text-slate-400">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-semibold">No report selected</p>
                <p className="text-sm mt-1">Click "Run Report Now" to generate your first AI medical analytics report.</p>
              </div>
            ) : selected.status === 'running' ? (
              <div className="text-center py-20 text-amber-600">
                <div className="w-12 h-12 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold">Report is being generated</p>
                <p className="text-sm mt-1 text-slate-500">Claude Opus is analysing your entire dataset. This takes 5–10 minutes.</p>
                <p className="text-xs text-slate-400 mt-2">This page checks for updates every 30 seconds.</p>
              </div>
            ) : selected.status.startsWith('error') ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700">
                <p className="font-bold">Report failed</p>
                <p className="text-sm mt-1">{selected.status.replace('error: ', '')}</p>
              </div>
            ) : selected.report_markdown ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Report: {selected.report_period}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Generated {selected.generated_at ? new Date(selected.generated_at).toLocaleString('en-NG') : '—'} · Claude Opus 4.6</p>
                  </div>
                  <button
                    onClick={() => {
                      const blob = new Blob([selected.report_markdown!], { type: 'text/markdown' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = `clearline_ai_report_${selected.report_period}.md`; a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:border-[#137fec] hover:text-[#137fec] transition-colors"
                  >
                    ↓ Download
                  </button>
                </div>
                {selected.key_metrics && <MetricsStrip raw={selected.key_metrics} />}
                <MarkdownReport md={selected.report_markdown} />
              </>
            ) : (
              <p className="text-slate-400 text-sm">No content available.</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
