'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui'

const API = process.env.NEXT_PUBLIC_API_URL ?? ''

async function readCsv(file: File) {
  const lines = (await file.text()).trim().split(/\r?\n/)
  const headers = lines.shift()!.split(',').map(x => x.trim())
  return lines.map(line => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, Number.isNaN(Number(values[i])) ? values[i]?.trim() : Number(values[i])]))
  })
}

export default function TariffPage() {
  const [providerId, setProviderId] = useState('')
  const [currentBand, setCurrentBand] = useState('')
  const [tariff, setTariff] = useState<File>()
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function analyse() {
    if (!providerId) return setError('Provider ID is required.')
    setBusy(true); setError(''); setResult(null)
    try {
      const body = { provider_id: providerId, current_band: currentBand || null,
        provider_tariff: tariff ? await readCsv(tariff) : undefined }
      const res = await fetch(`${API}/api/v1/tariff-banding/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      setResult(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed') }
    finally { setBusy(false) }
  }

  return <>
    <PageHeader title="Tariff Banding" right={<span className="text-sm text-slate-500">Network-relative provider review</span>} />
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div><h2 className="text-lg font-bold">Analyse a provider tariff</h2><p className="text-sm text-slate-500 mt-1">Select an existing provider to use its live tariff, or upload a new provider tariff. Network weights and reference prices are managed centrally.</p></div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm font-medium">Provider ID<input className="mt-1 w-full border rounded-lg p-2" value={providerId} onChange={e => setProviderId(e.target.value)} /></label>
          <label className="text-sm font-medium">Current human band<select className="mt-1 w-full border rounded-lg p-2" value={currentBand} onChange={e => setCurrentBand(e.target.value)}><option value="">Unknown</option>{['D','C','B','A','Special'].map(b => <option key={b}>{b}</option>)}</select></label>
          <label className="text-sm font-medium">New provider tariff CSV (optional)<input className="mt-1 block w-full text-sm" type="file" accept=".csv" onChange={e => setTariff(e.target.files?.[0])} /></label>
        </div>
        <Button variant="primary" loading={busy} onClick={analyse}>Run analysis</Button>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </section>
      {result && <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"><div className="grid sm:grid-cols-4 gap-4">{[['Tariff index', result.tariff_index?.toFixed(3)], ['Tariff band', result.tariff_band], ['Coverage', `${(result.coverage * 100).toFixed(1)}%`], ['Credibility', `${(result.credibility * 100).toFixed(1)}%`]].map(([label,value]) => <div key={label as string} className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-bold mt-1">{value}</p></div>)}</div><div className="flex flex-wrap gap-4 text-sm"><span>Realized index: {result.realized_index?.toFixed(3) ?? '—'}</span><span>Integrity: {result.integrity_score?.toFixed(3) ?? '—'}</span><span className={result.exception ? 'text-rose-600 font-bold' : 'text-emerald-600'}>{result.exception ? 'Manual review required' : 'Eligible for confirmation'}</span></div><details><summary className="cursor-pointer font-semibold">Outlier lines ({result.outliers?.length ?? 0})</summary><pre className="mt-3 max-h-64 overflow-auto text-xs bg-slate-50 p-3 rounded">{JSON.stringify(result.outliers, null, 2)}</pre></details></section>}
    </main>
  </>
}
