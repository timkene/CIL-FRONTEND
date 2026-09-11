'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui'
import { NegotiationPlan } from './NegotiationPlan'
import { canTargetBand, targetBands, type TargetBand, type AnalysisRequest, type NegotiationResult } from '@/lib/tariff-negotiation'
import { tariffBandingCopy } from '@/lib/tariff-banding-copy'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${(Number(value) * 100).toFixed(1)}%`
}

async function readCsv(file: File) {
  if (file.name.toLowerCase().endsWith('.xlsx') || file.type.includes('spreadsheet')) {
    throw new Error('Upload the Migration CSV export (procedure_code, procedure_name, hospital_price). XLSX is accepted by the API once converted to CSV.')
  }
  const lines = (await file.text()).trim().split(/\r?\n/)
  const parse = (line: string) => line.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.slice(0,-1).map(v => v.replace(/,$/,'').replace(/^"|"$/g,'').replace(/""/g,'"')) ?? []
  const headers = parse(lines.shift()!).map(x => x.trim())
  return lines.map(line => {
    const values = parse(line)
    return Object.fromEntries(headers.map((h, i) => [h, Number.isNaN(Number(values[i])) ? values[i]?.trim() : Number(values[i])]))
  })
}

export default function TariffPage() {
  const [providerId, setProviderId] = useState('')
  const [providerSearch, setProviderSearch] = useState('')
  const [providers, setProviders] = useState<any[]>([])
  const [currentBand, setCurrentBand] = useState('')
  const [tariff, setTariff] = useState<File>()
  const [result, setResult] = useState<any>(null)
  const [negotiation, setNegotiation] = useState<NegotiationResult | null>(null)
  const [targetBand, setTargetBand] = useState<TargetBand | ''>('')
  const [analysisRequest, setAnalysisRequest] = useState<AnalysisRequest | null>(null)
  const [analysisError, setAnalysisError] = useState('')
  const [negotiationError, setNegotiationError] = useState('')
  const [busy, setBusy] = useState(false)
  async function searchProviders() {
    if (!providerSearch.trim()) return
    const res = await fetch(`${API}/api/v1/tariff-banding/providers?search=${encodeURIComponent(providerSearch)}&limit=25`)
    if (res.ok) {
      const found = (await res.json()).results ?? []
      setProviders(found)
      // Numeric MediCloud IDs can be valid even when the directory hides the
      // provider (for example, an inactive listing). Preserve that ID so the
      // tariff endpoint can return the authoritative result.
      if (!found.length && /^\d+$/.test(providerSearch.trim())) setProviderId(providerSearch.trim())
    }
  }

  async function analyse() {
    setNegotiation(null); setTargetBand(''); setAnalysisRequest(null); setNegotiationError('')
    if (!providerId && /^\d+$/.test(providerSearch.trim())) setProviderId(providerSearch.trim())
    const effectiveProviderId = providerId || providerSearch.trim()
    if ((!effectiveProviderId || !/^\d+$/.test(effectiveProviderId)) && !tariff) return setAnalysisError('Select a provider, or upload a new provider tariff CSV.')
    setBusy(true); setAnalysisError(''); setResult(null)
    try {
      const body = { provider_id: effectiveProviderId || undefined, current_band: currentBand || null,
        provider_tariff: tariff ? await readCsv(tariff) : undefined }
      const res = await fetch(`${API}/api/v1/tariff-banding/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
      setAnalysisRequest(body)
    } catch (e) { setAnalysisError(e instanceof Error ? e.message : 'Analysis failed') }
    finally { setBusy(false) }
  }

  async function generateNegotiation() {
    if (busy || !analysisRequest || !canTargetBand(relativeBand, result?.exception, targetBand)) return
    setBusy(true); setNegotiationError(''); setNegotiation(null)
    try {
      const body = { ...analysisRequest, target_relative_band: targetBand }
      const res = await fetch(`${API}/api/v1/tariff-banding/negotiate-v2`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      setNegotiation(await res.json())
    } catch (e) { setNegotiationError(e instanceof Error ? e.message : 'Negotiation failed') }
    finally { setBusy(false) }
  }

  const relativeBand = result?.relative_band ?? result?.tariff_band
  const bandingCopy = tariffBandingCopy(result)
  const sub = result?.sub_indices ?? {}

  return <>
    <PageHeader title="Tariff Banding" right={<span className="text-sm text-slate-500">Network-relative provider review</span>} />
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold">Analyse a provider tariff</h2>
          <p className="text-sm text-slate-500 mt-1">Search and select a provider for its live tariff, or upload a new tariff or a finalized Migration export. Network weights and reference prices are managed centrally.</p>
          <ol className="mt-3 list-decimal pl-5 text-sm text-slate-600 space-y-1">
            <li>Search by provider name or numeric MediCloud ID, then select the provider.</li>
            <li>Upload either banding CSV <code>procedure_code, procedure_name, tariff_amount</code> or Migration export <code>procedure_code, procedure_name, hospital_price, original_hospital_item</code>.</li>
            <li>The overall result is a <strong>relative price-index band</strong>. Per-line signed ₦ ladder positions are not the hospital band.</li>
            <li>Run analysis and review coverage and outlier exposure before confirming a band.</li>
          </ol>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="text-sm font-medium"><label>Find provider<input className="mt-1 w-full border rounded-lg p-2" value={providerSearch} onChange={e => setProviderSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchProviders()} placeholder="Name, code or ID" /></label><button type="button" className="mt-2 text-blue-700" onClick={searchProviders}>Search</button>{providers.length > 0 && <select className="mt-2 w-full border rounded-lg p-2" value={providerId} onChange={e => { setProviderId(e.target.value); const p=providers.find(x => String(x.provider_id)===e.target.value); setCurrentBand(p?.band_category?.replace(/^Band\s+/i,'') ?? '') }}><option value="">Select provider</option>{providers.map(p => <option key={p.provider_id} value={p.provider_id}>{p.provider_name} ({p.provider_id}) — {p.band_category ?? 'Unbanded'}</option>)}</select>}</div>
          <label className="text-sm font-medium">Current human band<select className="mt-1 w-full border rounded-lg p-2" value={currentBand} onChange={e => setCurrentBand(e.target.value)}><option value="">Auto-detect</option>{['D','C','B','A','Special'].map(b => <option key={b}>{b}</option>)}</select></label>
          <label className="text-sm font-medium">Tariff or Migration CSV (optional)<input className="mt-1 block w-full text-sm" type="file" accept=".csv,.xlsx" onChange={e => setTariff(e.target.files?.[0])} /></label>
        </div>
        <div className="flex flex-wrap gap-3"><Button variant="primary" loading={busy} onClick={analyse}>Run analysis</Button></div>
        {analysisError && <p className="text-sm text-rose-600">{analysisError}</p>}
      </section>
      {result && <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <p><strong>{bandingCopy.officialLabel}: {relativeBand ?? '—'}</strong> (weighted hospital / reference index {result.tariff_index?.toFixed(3) ?? '—'}). This is not a signed Clearline ₦ ladder band.</p>
          <p className="mt-1 text-blue-800">{result.signed_ladder_note}</p>
        </div>
        <div className="grid sm:grid-cols-4 gap-4">
          {[
            [bandingCopy.officialLabel, relativeBand],
            ['Tariff index', result.tariff_index?.toFixed(3)],
            ['Weighted coverage', pct(result.weighted_coverage)],
            ['Raw core coverage', pct(result.raw_coverage ?? result.coverage)],
          ].map(([label,value]) => <div key={label as string} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>)}
        </div>
        {result.concentration?.warning && <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950"><strong>Concentration warning.</strong> Largest core weight {pct(result.concentration.largest_single_code_weight)}; top 5 cumulative {pct(result.concentration.top5_cumulative_weight)}. Weights are not capped in this foundation pass.</div>}
        {result.exception && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Do not confirm this band yet.</strong> Coverage is below 70% or the tariff integrity is unusually low. Request the missing core tariff lines and review the listed outliers with Contracting.</div>}
        <div className="flex flex-wrap gap-4 text-sm"><span>Current human band: {result.current_band ?? 'Unclassified'}</span><span>Reference: {result.reference_method ?? 'max(network median, Band D floor)'}</span><span className={result.exception ? 'text-rose-600 font-bold' : 'text-emerald-600'}>{result.exception ? 'Manual review required' : 'Eligible for confirmation'}</span></div>
        <div className="rounded-lg border border-slate-200 p-4 text-sm">
          <h3 className="font-semibold">{bandingCopy.sensitivityLabel}</h3>
          <p className="mt-1">Drop {result.sensitivity_dropped_code ?? '—'}: {result.sensitivity_band ?? '—'} {result.sensitivity_index != null ? result.sensitivity_index.toFixed(3) : ''}</p>
          <p className="mt-1 text-slate-600">{bandingCopy.diagnosticNote}</p>
          {bandingCopy.unbandableNote && <p className="mt-1 text-slate-600">{bandingCopy.unbandableNote}</p>}
        </div>
        <div>
          <h3 className="font-semibold">Informational sub-indices</h3>
          <p className="text-xs text-slate-500 mt-1">Diagnostic only. They do not assign the overall relative band.</p>
          <div className="mt-2 grid sm:grid-cols-4 gap-3 text-sm">
            {[['consultations','Consultations'],['medications','Medications'],['procedures_diagnostics','Procedures / diagnostics'],['OTHER','Other']].map(([key,label]) => {
              const row = sub[key] ?? {}
              return <div key={key} className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-bold">{row.band ?? '—'} {row.index != null ? row.index.toFixed(3) : ''}</p><p className="text-xs text-slate-500">weight {pct(row.weight_sum)}</p></div>
            })}
          </div>
        </div>
        {result.concentration?.top5?.length > 0 && <details open><summary className="cursor-pointer font-semibold">Top contributors ({result.concentration.top5.length})</summary><p className="mt-2 text-xs text-slate-500">Cumulative top 5 weight {pct(result.concentration.top5_cumulative_weight)}. Largest single-code weight {pct(result.concentration.largest_single_code_weight)}.</p><pre className="mt-3 max-h-64 overflow-auto text-xs bg-slate-50 p-3 rounded">{result.concentration.top5.map((p:any) => `${p.procedure_code} — ${p.procedure_name ?? ''} · weight ${(p.weight * 100).toFixed(1)}% · ₦${p.hospital_price ?? ''}`).join('\n')}</pre></details>}
        {result.excluded_codes?.length > 0 && <details open><summary className="cursor-pointer font-semibold text-slate-800">Excluded family codes ({result.excluded_codes.length})</summary><p className="mt-2 text-xs text-slate-500">Codes containing NHIS, NHIA, or BRG anywhere (same rule as Tariff Migration) are dropped before the index. This can include catalog codes such as BRG0606.</p><pre className="mt-3 max-h-64 overflow-auto text-xs bg-slate-50 p-3 rounded">{result.excluded_codes.map((p:any) => `${p.procedure_code} — ${p.procedure_name ?? ''} · ${p.reason}`).join('\n')}</pre></details>}
        {result.duplicate_codes?.length > 0 && <details open><summary className="cursor-pointer font-semibold text-rose-800">Duplicate mapped codes ({result.duplicate_codes.length})</summary><p className="mt-2 text-xs text-slate-500">Equal prices collapse to the first row. Conflicting prices are excluded from the official index and listed for review.</p><pre className="mt-3 max-h-64 overflow-auto text-xs bg-rose-50 p-3 rounded">{result.duplicate_codes.map((d:any) => `${d.procedure_code} — ${d.conflict ? 'CONFLICT ' + JSON.stringify(d.prices) : 'same price ₦' + d.price} · n=${d.count}`).join('\n')}</pre></details>}
        {result.missing_procedures?.length > 0 && <details open><summary className="cursor-pointer font-semibold text-amber-800">Missing core procedures ({result.missing_procedures.length})</summary><p className="mt-2 text-xs text-slate-500">Request prices for these procedures before confirming the band. No price has been imputed.</p><pre className="mt-3 max-h-64 overflow-auto text-xs bg-amber-50 p-3 rounded">{result.missing_procedures.map((p:any) => `${p.procedure_code} — ${p.procedure_name ?? ''}`).join('\n')}</pre></details>}
        {result.non_core_lines?.length > 0 && <details open><summary className="cursor-pointer font-semibold">Non-core mapped procedures ({result.non_core_lines.length})</summary><p className="mt-2 text-xs text-slate-500">Mapped Migration lines outside the frozen core basket. They stay in the appendix and do not disappear. Signed ladder on a line is not the hospital band.</p><pre className="mt-3 max-h-64 overflow-auto text-xs bg-slate-50 p-3 rounded">{result.non_core_lines.map((p:any) => `${p.procedure_code} — ${p.procedure_name ?? ''} · ₦${p.hospital_price ?? ''} · ladder ${p.signed_ladder_position ?? 'n/a'}`).join('\n')}</pre></details>}
        <details><summary className="cursor-pointer font-semibold">Line-level analysis ({result.line_items?.length ?? 0})</summary><p className="mt-2 text-xs text-slate-500">signed_ladder_position is the procedure’s Clearline ₦ ladder, distinct from the overall relative band {relativeBand}.</p><pre className="mt-3 max-h-64 overflow-auto text-xs bg-slate-50 p-3 rounded">{JSON.stringify(result.line_items, null, 2)}</pre></details>
        <details><summary className="cursor-pointer font-semibold">Outlier lines ({result.outliers?.length ?? 0})</summary><pre className="mt-3 max-h-64 overflow-auto text-xs bg-slate-50 p-3 rounded">{JSON.stringify(result.outliers, null, 2)}</pre></details>
      </section>}
      {result && analysisRequest && <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-lg font-bold">Target Relative Band</h2>
        {result.exception || !['D', 'C', 'B', 'A', 'Special'].includes(relativeBand) || result.tariff_index == null
          ? <p className="text-sm text-amber-900">Negotiation needs a bandable official result without an exception. Resolve the coverage or tariff issues and run analysis again.</p>
          : <>
            <p className="text-sm text-slate-600">Choose a cheaper band than the current Official Relative Band {relativeBand}. The plan uses the provider or CSV from the last successful analysis; run analysis again after changing inputs.</p>
            {relativeBand === 'D' && <p className="text-sm text-slate-600">D is already the cheapest relative band. No cheaper target is available.</p>}
            <label className="block text-sm font-medium">Target Relative Band
              <select required className="mt-1 block w-full max-w-xs border rounded-lg p-2" value={targetBand} disabled={busy || relativeBand === 'D'} onChange={e => { setTargetBand(e.target.value as TargetBand | ''); setNegotiation(null); setNegotiationError('') }}>
                <option value="">Select a target</option>
                {targetBands.map(band => <option key={band} value={band} disabled={!canTargetBand(relativeBand, result.exception, band)}>{band}</option>)}
              </select>
            </label>
            <Button variant="secondary" loading={busy} disabled={busy || !canTargetBand(relativeBand, result.exception, targetBand)} onClick={generateNegotiation}>Generate negotiation plan</Button>
            {busy && <p role="status" className="text-sm text-slate-600">Generating negotiation plan. A full-core request can take about a minute. Do not close this page.</p>}
            {negotiationError && <p className="text-sm text-rose-600">{negotiationError}</p>}
          </>}
      </section>}
      {negotiation && <NegotiationPlan plan={negotiation} />}
    </main>
  </>
}
