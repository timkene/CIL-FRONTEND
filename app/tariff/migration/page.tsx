'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, KPICard, Modal, PageHeader } from '@/components/ui'
import { getSession } from '@/lib/auth'
import {
  STATUSES, migrationJson, migrationRequest, originalValue, post, reviewerName, suggestion,
  type BatchStatus, type Candidate, type MigrationRow, type RowsResult, type UploadResult,
} from '@/lib/tariff-migration'

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm'
const cellClass = 'p-3 text-left align-top whitespace-pre-wrap break-words'
const label = (value: string) => value.replaceAll('_', ' ')
const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Please try again.'
const PAGE_SIZE = 50

export default function TariffMigrationPage() {
  const [file, setFile] = useState<File>()
  const [upload, setUpload] = useState<UploadResult | null>(null)
  const [sheet, setSheet] = useState('')
  const [itemColumn, setItemColumn] = useState('')
  const [priceColumn, setPriceColumn] = useState('')
  const [batch, setBatch] = useState<BatchStatus | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [rows, setRows] = useState<RowsResult | null>(null)
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsError, setRowsError] = useState('')
  const [detail, setDetail] = useState<MigrationRow | null>(null)
  const [reviewError, setReviewError] = useState('')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selected, setSelected] = useState<Candidate | null>(null)
  const [catalog, setCatalog] = useState<Record<string, Candidate>>({})
  const actionLock = useRef(false)
  const batchId = upload?.batch_id
  const workspace = batch?.state === 'MATCHED' || batch?.state === 'FINALIZED'
  const finalized = batch?.state === 'FINALIZED'
  const preview = upload?.preview[sheet]

  // Serialize writes and detail/search actions so a slow response cannot target another row.
  async function run(name: string, action: () => Promise<void>, inReview = false) {
    if (actionLock.current) return
    actionLock.current = true
    setBusy(name)
    if (inReview) setReviewError(''); else setError('')
    try { await action() } catch (e) { if (inReview) setReviewError(message(e)); else setError(message(e)) }
    finally { actionLock.current = false; setBusy('') }
  }

  const refreshStatus = useCallback(async () => {
    if (!batchId) return
    const result = await migrationJson<BatchStatus>(`/${batchId}/status`)
    setBatch(result)
    setRevision(v => v + 1)
    return result
  }, [batchId])

  useEffect(() => {
    if (!batchId || !workspace) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setRowsLoading(true); setRowsError(''); setRows(null)
      try {
        const params = new URLSearchParams({ q: query, limit: String(PAGE_SIZE), offset: String(offset) })
        if (filter) params.set('status', filter)
        const result = await migrationJson<RowsResult>(`/${batchId}/rows?${params}`, { signal: controller.signal })
        if (!controller.signal.aborted) {
          if (offset > 0 && !result.rows.length) setOffset(Math.max(0, Math.floor((result.total - 1) / PAGE_SIZE) * PAGE_SIZE))
          else setRows(result)
        }
      } catch (e) { if (!controller.signal.aborted) setRowsError(message(e)) }
      finally { if (!controller.signal.aborted) setRowsLoading(false) }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [batchId, workspace, filter, query, offset, revision])

  function chooseSheet(result: UploadResult, name: string) {
    setSheet(name)
    setItemColumn(result.preview[name]?.suggested_column_mapping.item_column ?? '')
    setPriceColumn(result.preview[name]?.suggested_column_mapping.price_column ?? '')
  }

  function uploadFile() {
    void run('Uploading tariff…', async () => {
      if (!file) throw new Error('Choose a CSV or XLSX file.')
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('Only CSV and XLSX files are supported.')
      if (file.size > 10 * 1024 * 1024) throw new Error('Upload must be 10 MiB or smaller.')
      const form = new FormData(); form.append('file', file)
      const result = await migrationJson<UploadResult>('/upload', { method: 'POST', body: form })
      setUpload(result); setBatch(null); setRows(null); setOffset(0); setFilter(''); setQuery(''); setCatalog({})
      chooseSheet(result, result.sheets.find(s => !result.preview[s].error) ?? result.sheets[0])
    })
  }

  function start() {
    void run('Processing tariff…', async () => {
      if (!batchId) return
      // Recover a completed start after a lost response before attempting another write.
      const current = await refreshStatus()
      if (current?.state === 'MATCHED' || current?.state === 'FINALIZED') return
      await migrationJson(`/${batchId}/configure`, post({ sheet, item_column: itemColumn, price_column: priceColumn }))
      setBatch(await migrationJson<BatchStatus>(`/${batchId}/start`, post()))
      setRevision(v => v + 1)
    })
  }

  function openReview(row: MigrationRow) {
    void run('Loading item…', async () => {
      const result = await migrationJson<MigrationRow>(`/${batchId}/rows/${row.id}`)
      setDetail(result); setReviewError(''); setSearch(''); setCandidates([]); setSelected(null)
    })
  }

  function decide(action: 'accept' | 'change' | 'reject') {
    void run('Saving decision…', async () => {
      if (!detail || finalized) return
      const who = reviewerName(getSession())
      if (!who) throw new Error('Your session has no staff name or email. Sign in again before reviewing.')
      if (action === 'change' && !selected) throw new Error('Search and select a Clearline item first.')
      const body = action === 'change' ? { who, procedure_code: selected!.procedure_code } : { who }
      await migrationJson<MigrationRow>(`/${batchId}/rows/${detail.id}/${action}`, post(body))
      if (selected && action === 'change') setCatalog(c => ({ ...c, [selected.procedure_code]: selected }))
      setDetail(null)
      setRevision(v => v + 1)
      try { await refreshStatus() } catch (e) { setError(`Decision saved. Could not refresh totals: ${message(e)}`) }
    }, true)
  }

  function searchCandidates() {
    void run('Searching catalog…', async () => {
      setCandidates([]); setSelected(null)
      const result = await migrationJson<{ candidates: Candidate[] }>(`/candidates?${new URLSearchParams({ q: search.trim() })}`)
      setCandidates(result.candidates.slice(0, 5))
    }, true)
  }

  function finalize() {
    void run('Finalizing…', async () => {
      await migrationJson(`/${batchId}/finalize`, post())
      setBatch(b => b ? { ...b, state: 'FINALIZED' } : b)
      setRevision(v => v + 1)
    })
  }

  function download() {
    void run('Preparing download…', async () => {
      const response = await migrationRequest(`/${batchId}/export`)
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = url; anchor.download = 'standardized_tariff.csv'
      document.body.appendChild(anchor); anchor.click(); anchor.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }

  const counts = batch?.counts ?? {}
  const kpis: [string, number][] = [
    ['Total items', batch?.total ?? 0], ['Auto matched', counts.AUTO_MATCHED ?? 0],
    ['Review required', counts.REVIEW_REQUIRED ?? 0], ['Missing strength', counts.MISSING_STRENGTH ?? 0],
    ['Ambiguous', counts.AMBIGUOUS ?? 0], ['Unmatched', counts.NO_MATCH ?? 0],
    ['Reviewed / completed', (counts.ACCEPTED ?? 0) + (counts.CHANGED ?? 0) + (counts.REJECTED ?? 0)],
  ]

  return <>
    <PageHeader title="Tariff Migration" right={<Link href="/tariff" className="text-blue-700">Tariff Banding</Link>} />
    <main className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-6">
      <p className="text-sm text-slate-600">Upload → Map columns → Process → Review → Finalize and export</p>
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-rose-700">{error}</p>}
      {busy && <p role="status" className="text-sm text-blue-700">{busy}</p>}
      {!workspace && <Card className="space-y-4">
        <h2 className="text-lg font-bold">Upload hospital tariff</h2>
        <label className="block text-sm font-medium">CSV or XLSX (up to 10 MiB)
          <input type="file" accept=".csv,.xlsx" disabled={!!busy} onChange={e => setFile(e.target.files?.[0])} className="mt-2 block w-full" />
        </label>
        <Button disabled={!file || !!busy} onClick={uploadFile}>{upload ? 'Replace upload' : 'Upload'}</Button>
      </Card>}
      {upload && !workspace && <Card className="space-y-4">
        <h2 className="text-lg font-bold">Map sheet and columns</h2>
        <p className="text-sm text-slate-500">Confirm the suggested columns. Hospital item and price values will be kept as uploaded.</p>
        <div className="grid md:grid-cols-3 gap-4">
          <label>Sheet<select className={inputClass} disabled={!!busy} value={sheet} onChange={e => chooseSheet(upload, e.target.value)}>{upload.sheets.map(s => <option key={s}>{s}</option>)}</select></label>
          <label>Hospital item column<select className={inputClass} disabled={!!busy || !!preview?.error} value={itemColumn} onChange={e => setItemColumn(e.target.value)}><option value="">Select column</option>{preview?.columns.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>Price column<select className={inputClass} disabled={!!busy || !!preview?.error} value={priceColumn} onChange={e => setPriceColumn(e.target.value)}><option value="">Select column</option>{preview?.columns.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
        {preview?.error ? <p role="alert" className="text-rose-700">{preview.error} Select another sheet.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left text-slate-500">Preview (first five rows)</caption><thead><tr>{preview?.columns.map(c => <th key={c} className={cellClass}>{c}</th>)}</tr></thead><tbody>{preview?.rows.map((row, i) => <tr key={i} className="border-t">{preview.columns.map(c => <td className={cellClass} key={c}>{originalValue(row[c])}</td>)}</tr>)}</tbody></table></div>}
        {itemColumn && itemColumn === priceColumn && <p className="text-rose-700">Select two different columns.</p>}
        <Button disabled={!!busy || !itemColumn || !priceColumn || itemColumn === priceColumn || !!preview?.error} onClick={start}>Confirm mapping and process</Button>
        {batchId && <Button variant="ghost" disabled={!!busy} onClick={() => void run('Checking batch…', async () => { await refreshStatus() })}>Check processing status</Button>}
      </Card>}
      {workspace && batch && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{kpis.map(([name, value]) => <KPICard key={name} label={name} value={value} />)}</div>
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold">{finalized ? 'Finalized tariff' : 'Review workspace'}</h2><p className="text-sm text-slate-500">{batch.remaining} pending reviews · Batch {batch.batch_id}</p></div>
            <div className="flex gap-2"><Button variant="secondary" disabled={!!busy} onClick={() => void run('Refreshing…', async () => { await refreshStatus() })}>Refresh</Button>{finalized ? <Button disabled={!!busy} onClick={download}>Download CSV</Button> : <Button disabled={!!busy} onClick={finalize}>Finalize tariff</Button>}</div>
          </div>
          <p className="text-sm text-slate-600">{finalized ? 'This batch is locked. Only mapped items are included in the export.' : 'Resolve pending reviews before finalizing. Auto matches count as complete; No Match and rejected items are excluded. Finalizing locks all decisions.'}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">Status<select className={inputClass} value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); setRows(null) }}><option value="">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{label(s)}</option>)}</select></label>
            <label className="text-sm">Search hospital item<input className={inputClass} value={query} onChange={e => { setQuery(e.target.value); setOffset(0); setRows(null) }} placeholder="Hospital item text" /></label>
          </div>
          {rowsError && <p role="alert" className="text-rose-700">{rowsError} Use Refresh to retry.</p>}
          {rowsLoading && <p role="status">Loading rows…</p>}
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50"><tr>{['Hospital Item', 'Price', 'Suggested Clearline Code', 'Clearline Name', 'Confidence', 'Method', 'Flag/Status', 'Action'].map(h => <th key={h} className={cellClass}>{h}</th>)}</tr></thead><tbody>
            {rows?.rows.map(row => {
              const candidate = suggestion(row, catalog)
              return <tr key={row.id} className="border-t border-slate-200">
                <td className={cellClass}>{originalValue(row.original_item)}</td><td className={cellClass}>{originalValue(row.original_price)}</td>
                <td className={cellClass}>{row.procedure_code ?? candidate?.procedure_code ?? '—'}</td><td className={cellClass}>{candidate?.procedure_name ?? (row.procedure_code ? 'Name unavailable' : '—')}</td>
                <td className={cellClass}>{candidate?.score ?? '—'}</td><td className={cellClass}>{candidate?.source ?? '—'}</td>
                <td className={cellClass}><Badge variant={['REVIEW_REQUIRED', 'MISSING_STRENGTH', 'AMBIGUOUS'].includes(row.status) ? 'warning' : 'neutral'}>{label(row.status)}</Badge></td>
                <td className={cellClass}><Button size="sm" variant="secondary" disabled={!!busy} onClick={() => openReview(row)}>{finalized ? 'View' : 'Review'}</Button></td>
              </tr>
            })}
          </tbody></table></div>
          {rows && !rows.rows.length && <p className="text-slate-500">No items match these filters.</p>}
          <div className="flex items-center justify-between gap-3 text-sm"><span>{rows ? `${rows.total ? offset + 1 : 0}–${Math.min(offset + PAGE_SIZE, rows.total)} of ${rows.total}` : '—'}</span><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={offset === 0 || rowsLoading || !rows} onClick={() => { setOffset(v => Math.max(0, v - PAGE_SIZE)); setRows(null) }}>Previous</Button><Button variant="secondary" size="sm" disabled={!rows || rowsLoading || offset + PAGE_SIZE >= rows.total} onClick={() => { setOffset(v => v + PAGE_SIZE); setRows(null) }}>Next</Button></div></div>
        </Card>
      </>}
      <Modal open={!!detail} onClose={() => { if (!busy) setDetail(null) }} title={finalized ? 'Tariff item' : 'Review tariff item'} size="xl" showCloseButton={!busy} closeOnEscape={!busy} closeOnBackdropClick={!busy}>
        {detail && <div className="space-y-4">
          {reviewError && <p role="alert" className="text-rose-700">{reviewError}</p>}
          {busy && <p role="status">{busy}</p>}
          <dl className="grid sm:grid-cols-2 gap-3 text-sm"><div><dt className="font-semibold">Hospital item</dt><dd className="whitespace-pre-wrap">{originalValue(detail.original_item)}</dd></div><div><dt className="font-semibold">Original price</dt><dd className="whitespace-pre-wrap">{originalValue(detail.original_price)}</dd></div><div><dt className="font-semibold">Status</dt><dd>{label(detail.status)}</dd></div><div><dt className="font-semibold">Selected code</dt><dd>{detail.procedure_code ?? 'None'}</dd></div></dl>
          <p className="text-sm">{detail.reason}</p>
          <details><summary className="cursor-pointer text-sm font-semibold">Parsed medication</summary><pre className="mt-2 whitespace-pre-wrap text-xs bg-slate-50 p-3">{JSON.stringify(detail.parsed_medication, null, 2)}</pre></details>
          <h3 className="font-semibold">Suggested candidates</h3>
          {detail.candidates.length ? <ul className="space-y-2">{detail.candidates.slice(0, 5).map(c => <li key={c.procedure_code} className="rounded-lg border p-3 text-sm">{c.procedure_code} · {c.procedure_name}<span className="block text-slate-500">Score: {c.score ?? '—'} · Source: {c.source ?? '—'}</span></li>)}</ul> : <p className="text-sm text-slate-500">No suggested candidates. Search the catalog to change the mapping, or choose No Match.</p>}
          {!finalized && <>
            <div className="flex flex-wrap gap-2"><Button disabled={!!busy || (!detail.procedure_code && !detail.candidates.length)} onClick={() => decide('accept')}>Accept {detail.procedure_code ? 'current mapping' : 'top suggestion'}</Button><Button variant="danger" disabled={!!busy} onClick={() => decide('reject')}>No Match</Button></div>
            <form onSubmit={e => { e.preventDefault(); if (search.trim()) searchCandidates() }} className="space-y-2"><label className="block text-sm font-semibold">Change mapping — search Clearline name<input className={inputClass} maxLength={500} value={search} disabled={!!busy} onChange={e => { setSearch(e.target.value); setSelected(null); setCandidates([]) }} /></label><Button type="submit" variant="secondary" disabled={!!busy || !search.trim()}>Search catalog</Button></form>
            <fieldset className="space-y-2"><legend className="text-sm font-semibold">Choose a replacement</legend>{candidates.map(c => <label key={c.procedure_code} className="block rounded-lg border p-3 text-sm"><input type="radio" name="replacement" disabled={!!busy} checked={selected?.procedure_code === c.procedure_code} onChange={() => setSelected(c)} className="mr-2" />{c.procedure_code} · {c.procedure_name}<span className="block text-slate-500">Score: {c.score ?? '—'} · Source: {c.source ?? '—'}</span></label>)}</fieldset>
            <Button disabled={!!busy || !selected} onClick={() => decide('change')}>Save changed mapping</Button>
          </>}
          <details><summary className="cursor-pointer text-sm font-semibold">Decision audit ({detail.audit.length})</summary><ul className="mt-2 space-y-2 text-xs">{detail.audit.map((a, i) => <li key={i}>{a.when} · {a.who} · {a.action} · {a.from_status} → {a.to_status} · {a.selected_code ?? 'No Match'}</li>)}</ul></details>
        </div>}
      </Modal>
    </main>
  </>
}
