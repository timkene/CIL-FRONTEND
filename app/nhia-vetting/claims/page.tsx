'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Button, Badge, useToast } from '@/components/ui'
import { claimSelectionKey, selectableClaims, claimsQuery, mergeEligibleSelection,
  removeSelectedClaim, selectionSummary, createLatestRequestGate,
  mergeConfirmedBulkSelection, clearSelectionForScopeChange, reversalReasonValid,
  normalizeBatchFilter, paymentError, withClaimsRefresh } from '@/lib/claims-selection'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface Claim {
  batch_id: string
  request_id?: string | null
  batch_name: string
  encounter_date: string
  accepted_at: string
  enrollee_id: string
  procedure_code: string
  procedure_name: string
  diagnosis_code: string
  diagnosis_name: string
  decision: string
  confidence: number | null
  reasoning: string | null
  drop_reason: string | null
  total_amount: number | null
  pipeline_stage: string | null
  encounter_date_from: string | null
  encounter_date_to: string | null
  date_submitted: string | null
  pa_number: string | null
  provider_id: string | null
  provider_name: string | null
  stated_price: number | null
  stated_quantity: number | null
  adjusted_price: number | null
  adjusted_quantity: number | null
  approved_quantity?: number | null
  approved_total?: number | null
  paid: boolean
  paid_date: string | null
  legacy_ambiguous?: boolean
  eligible_for_pay?: boolean
}

interface EligibilitySummary {
  claims: Claim[]
  eligibleCount: number
  excludedCount: number
  recordedAmount: number
  missingAmountCount: number
  selectionLimit: number
  selectionLimitExceeded: boolean
}

interface BatchOption { batch_id: string; batch_name?: string }

interface BatchSelectionConfirmation {
  snapshot: EligibilitySummary
  batchId: string
  originFilterScope: string
}

interface ClaimsMetrics {
  totalApprovedAmount: number
  paidAmount: number
  outstandingApprovedAmount: number
  deniedAmount: number
  approvedCount: number
  paidCount: number
  outstandingApprovedCount: number
  deniedCount: number
  approvalRate: number
  paymentProgress: number
  missingApprovedAmountCount: number
  missingPaidAmountCount: number
  ambiguousPaymentCount: number
  ambiguousPaymentAmount: number
  missingDeniedAmountCount: number
  deniedLinesWithRecordedAmountCount: number
  deniedLinesWithRecordedAmountValue: number
  unrecognizedDecisionCount: number
}

type ClaimKey = { batch_id: string; request_id?: string; enrollee_id: string; procedure_code: string }

function fmtMoney(n: number | null) {
  if (n == null) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(s: string | null) {
  if (!s) return '—'
  return s.slice(0, 10)
}
function claimKey(c: Claim): string {
  return claimSelectionKey(c)
}
function apiKey(c: Claim): ClaimKey {
  return { batch_id: c.batch_id, ...(c.request_id ? { request_id: c.request_id } : {}),
    enrollee_id: c.enrollee_id, procedure_code: c.procedure_code }
}

function Scorecard({ label, value, detail, prominent = false }: {
  label: string; value: string; detail?: string; prominent?: boolean
}) {
  return (
    <div className={`rounded-xl border p-4 min-w-0 ${prominent
      ? 'bg-amber-50 border-amber-300 shadow-sm md:col-span-2'
      : 'bg-white border-slate-200'}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${prominent ? 'text-amber-800' : 'text-slate-500'}`}>{label}</p>
      <p className={`mt-1 font-bold tabular-nums truncate ${prominent ? 'text-2xl text-slate-950' : 'text-xl text-slate-900'}`}
        title={value}>{value}</p>
      {detail && <p className="mt-1 text-xs text-amber-700" title={detail}>{detail}</p>}
    </div>
  )
}

function deniedDataQuality(metrics: ClaimsMetrics): string | undefined {
  const missing = metrics.missingDeniedAmountCount
  const anomalous = metrics.deniedLinesWithRecordedAmountCount
  if (!missing && !anomalous) return undefined
  const quality = missing && anomalous ? 'incomplete/anomalous data'
    : missing ? 'incomplete data' : 'anomalous data'
  const issues = [
    ...(missing ? [`${missing.toLocaleString()} missing`] : []),
    ...(anomalous ? [`${anomalous.toLocaleString()} with unexpected recorded amount`] : []),
  ]
  return `Recorded/requested amount — ${quality} (${issues.join('; ')})`
}

export default function NHIAClaimsPage() {
  const toast = useToast()

  const [claims, setClaims]         = useState<Claim[]>([])
  const [total, setTotal]           = useState(0)
  const [metrics, setMetrics]       = useState<ClaimsMetrics | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [decision, setDecision]     = useState('ALL')
  const [search, setSearch]         = useState('')
  const [dateFrom, setDateFrom]     = useState('')
  const [dateTo, setDateTo]         = useState('')
  const [batchId, setBatchId]       = useState('')
  const [page, setPage]             = useState(1)
  const limit = 50

  // Pay state
  const [selected, setSelected]   = useState<Map<string, Claim>>(new Map())
  const [eligibility, setEligibility] = useState<EligibilitySummary | null>(null)
  const [bulkSelecting, setBulkSelecting] = useState(false)
  const [batchConfirmation, setBatchConfirmation] = useState<BatchSelectionConfirmation | null>(null)
  const [showSelected, setShowSelected] = useState(false)
  const [selectionExcludedCount, setSelectionExcludedCount] = useState<number | null>(null)
  const [selectionFilterScope, setSelectionFilterScope] = useState('')
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([])
  const [showPay, setShowPay]     = useState(false)
  const [payDate, setPayDate]     = useState(new Date().toISOString().slice(0, 10))
  const [paying, setPaying]       = useState(false)
  const [showUnpay, setShowUnpay] = useState(false)
  const [unpayReason, setUnpayReason] = useState('')
  const [unpaying, setUnpaying] = useState(false)
  const [claimsAuth, setClaimsAuth] = useState<{ id: string; name: string; grants: string[] } | null>(null)
  const [showClaimsLogin, setShowClaimsLogin] = useState(false)
  const [claimsOperator, setClaimsOperator] = useState('')
  const [claimsCredential, setClaimsCredential] = useState('')
  const [claimsLoginBusy, setClaimsLoginBusy] = useState(false)
  const [reconcileRow, setReconcileRow] = useState<Claim | null>(null)
  const [conflictingLines, setConflictingLines] = useState<Claim[]>([])
  const [reconcileReason, setReconcileReason] = useState('')
  const [evidenceReference, setEvidenceReference] = useState('')
  const [confirmNoPayment, setConfirmNoPayment] = useState(false)
  const [reconcileBusy, setReconcileBusy] = useState(false)

  const filterScope = `${decision}\u0000${search}\u0000${dateFrom}\u0000${dateTo}\u0000${batchId}`
  const claimsScope = `${filterScope}\u0000${page}`
  const currentFilterScope = useRef(filterScope)
  const currentClaimsScope = useRef(claimsScope)
  currentFilterScope.current = filterScope
  currentClaimsScope.current = claimsScope
  const claimsRequestGate = useRef(createLatestRequestGate())
  const metricsRequestGate = useRef(createLatestRequestGate())
  const eligibilityRequestGate = useRef(createLatestRequestGate())
  const bulkRequestGate = useRef(createLatestRequestGate())
  const bulkSelectingRef = useRef(false)

  const refreshClaimsAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/nhia/claims/auth/session', { cache: 'no-store' })
      setClaimsAuth(response.ok ? await response.json() : null)
    } catch { setClaimsAuth(null) }
  }, [])

  useEffect(() => { void refreshClaimsAuth() }, [refreshClaimsAuth])

  async function loginClaims(e: React.FormEvent) {
    e.preventDefault()
    setClaimsLoginBusy(true)
    try {
      const response = await fetch('/api/nhia/claims/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator_id: claimsOperator, credential: claimsCredential }),
      })
      setClaimsCredential('')
      if (!response.ok) throw new Error('Claims authorization failed')
      await refreshClaimsAuth()
      setShowClaimsLogin(false)
    } catch { toast.error('Claims authorization failed') }
    finally { setClaimsLoginBusy(false) }
  }

  async function openReconcile(row: Claim) {
    if (!claimsAuth?.grants.includes('claims.reconcile')) { setShowClaimsLogin(true); return }
    setReconcileRow(row)
    setConflictingLines([])
    setReconcileReason('')
    setEvidenceReference('')
    setConfirmNoPayment(false)
    const query = new URLSearchParams({ batch_id: row.batch_id, enrollee_id: row.enrollee_id,
      procedure_code: row.procedure_code })
    try {
      const response = await fetch(`/api/nhia/claims/reconcile-candidates?${query}`, { cache: 'no-store' })
      if (response.status === 401) { setClaimsAuth(null); setShowClaimsLogin(true) }
      if (!response.ok) throw new Error('Could not load conflicting claim lines')
      const data = await response.json()
      setConflictingLines(data.claims)
    } catch { toast.error('Could not load conflicting claim lines'); setReconcileRow(null) }
  }

  async function submitReconcile() {
    const target = conflictingLines.find(line => line.request_id === reconcileRow?.request_id && line.decision === 'APPROVE')
    if (!reconcileRow || !target || !confirmNoPayment || !reconcileReason.trim() || !evidenceReference.trim()) return
    setReconcileBusy(true)
    try {
      await withClaimsRefresh(async () => {
        const response = await fetch('/api/nhia/claims/reconcile', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_id: reconcileRow.batch_id, enrollee_id: reconcileRow.enrollee_id,
            procedure_code: reconcileRow.procedure_code, target_request_id: target.request_id,
            reason: reconcileReason.trim(), evidence_reference: evidenceReference.trim(),
            confirm_no_actual_provider_payment: true }),
        })
        if (response.status === 401) { setClaimsAuth(null); setShowClaimsLogin(true) }
        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(paymentError(error.detail))
        }
        setReconcileRow(null)
        toast.success('Legacy marker marked not paid. Review the APPROVE claim before Pay.')
      }, refreshClaims)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Reconciliation failed; review refreshed Claims') }
    finally { setReconcileBusy(false); await refreshClaimsAuth() }
  }

  const loadClaims = useCallback(async () => {
    const requestScope = `${decision}\u0000${search}\u0000${dateFrom}\u0000${dateTo}\u0000${batchId}\u0000${page}`
    const ticket = claimsRequestGate.current.begin(requestScope)
    setLoading(true)
    setError('')
    try {
      const params = claimsQuery(decision, search, dateFrom, dateTo, batchId)
      params.set('page', String(page))
      params.set('limit', String(limit))
      const res = await fetch(`${API}/api/v1/nhia/claims?${params}`)
      if (!res.ok) throw new Error('Claims request failed')
      const data = await res.json()
      if (!claimsRequestGate.current.isCurrent(ticket, currentClaimsScope.current)) return
      setClaims(data.claims || [])
      setTotal(data.total || 0)
    } catch {
      if (!claimsRequestGate.current.isCurrent(ticket, currentClaimsScope.current)) return
      const msg = 'Failed to load claims'
      setError(msg)
      toast.error(msg)
    } finally {
      if (claimsRequestGate.current.isCurrent(ticket, currentClaimsScope.current)) setLoading(false)
    }
  }, [decision, search, dateFrom, dateTo, batchId, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMetrics = useCallback(async () => {
    const requestScope = `${decision}\u0000${search}\u0000${dateFrom}\u0000${dateTo}\u0000${batchId}`
    const ticket = metricsRequestGate.current.begin(requestScope)
    try {
      const params = claimsQuery(decision, search, dateFrom, dateTo, batchId)
      const response = await fetch(`${API}/api/v1/nhia/claims/metrics?${params}`)
      if (!response.ok) throw new Error('Claims metrics request failed')
      const data = await response.json()
      if (!metricsRequestGate.current.isCurrent(ticket, currentFilterScope.current)) return
      setMetrics(data)
    } catch {
      if (!metricsRequestGate.current.isCurrent(ticket, currentFilterScope.current)) return
      setError('Failed to load Claims scorecards')
      toast.error('Failed to load Claims scorecards')
    }
  }, [decision, search, dateFrom, dateTo, batchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadEligibility = useCallback(async () => {
    const requestScope = `${decision}\u0000${search}\u0000${dateFrom}\u0000${dateTo}\u0000${batchId}`
    const ticket = eligibilityRequestGate.current.begin(requestScope)
    try {
      const params = claimsQuery(decision, search, dateFrom, dateTo, batchId)
      const response = await fetch(`${API}/api/v1/nhia/claims/eligibility?${params}`)
      if (!response.ok) throw new Error('Eligibility request failed')
      const data = await response.json()
      if (!eligibilityRequestGate.current.isCurrent(ticket, currentFilterScope.current)) return
      setEligibility(data)
    } catch {
      if (!eligibilityRequestGate.current.isCurrent(ticket, currentFilterScope.current)) return
      setEligibility(null)
      toast.error('Failed to load Claims payment eligibility')
    }
  }, [decision, search, dateFrom, dateTo, batchId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshClaims = useCallback(async () => {
    await Promise.all([loadClaims(), loadMetrics(), loadEligibility()])
  }, [loadClaims, loadMetrics, loadEligibility])

  useEffect(() => { void loadClaims() }, [loadClaims])
  useEffect(() => { void loadMetrics() }, [loadMetrics])
  useEffect(() => { void loadEligibility() }, [loadEligibility])

  useEffect(() => {
    void fetch(`${API}/api/v1/nhia/claims/batches?limit=200`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(data => setBatchOptions(data.batches || []))
      .catch(() => setBatchOptions([]))
  }, [])

  const priorFilterScope = useRef(filterScope)
  useEffect(() => {
    if (priorFilterScope.current !== filterScope) {
      priorFilterScope.current = filterScope
      bulkRequestGate.current.invalidate()
      bulkSelectingRef.current = false
      setBulkSelecting(false)
      setBatchConfirmation(null)
      setSelected(current => {
        if (current.size) toast.info('Selection cleared because Claims filters changed.')
        return clearSelectionForScopeChange()
      })
      setSelectionExcludedCount(null)
      setSelectionFilterScope('')
      setShowSelected(false)
      setShowPay(false)
    }
  }, [filterScope, toast])

  function handleSearch(e: React.SyntheticEvent) {
    e.preventDefault()
    setPage(1)
  }

  function updateFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
  }

  function toggleSelect(row: Claim) {
    const key = claimKey(row)
    setSelected(prev => {
      if (prev.has(key)) return removeSelectedClaim(prev, key)
      return new Map(prev).set(key, row)
    })
    setSelectionFilterScope(filterScope)
  }

  const selectableOnPage = selectableClaims(claims, decision)

  function selectAllOnPage() {
    setSelected(current => decision === 'PAID'
      ? new Map([...current, ...selectableOnPage.map(row => [claimKey(row), row] as const)])
      : mergeEligibleSelection(current, selectableOnPage))
    setSelectionFilterScope(filterScope)
  }

  function deselectPage() {
    setSelected(current => {
      let next = current
      for (const row of selectableOnPage) next = removeSelectedClaim(next, claimKey(row))
      return next
    })
  }

  async function selectAllMatching(wholeBatch = false) {
    if (wholeBatch && !batchId) return
    const originFilterScope = filterScope
    const requestScope = wholeBatch ? `batch:${batchId}` : `filter:${filterScope}`
    const ticket = bulkRequestGate.current.begin(requestScope)
    bulkSelectingRef.current = true
    setBatchConfirmation(null)
    setBulkSelecting(true)
    let awaitingConfirmation = false
    try {
      const params = wholeBatch
        ? claimsQuery('ALL', '', '', '', batchId)
        : claimsQuery(decision, search, dateFrom, dateTo, batchId)
      params.set('include_claims', 'true')
      const response = await fetch(`${API}/api/v1/nhia/claims/eligibility?${params}`)
      if (!response.ok) throw new Error('Eligibility request failed')
      const data: EligibilitySummary = await response.json()
      if (!bulkRequestGate.current.isCurrent(ticket, requestScope) ||
          currentFilterScope.current !== originFilterScope) return
      if (data.selectionLimitExceeded) {
        toast.warning(`${wholeBatch ? 'This batch' : 'This selection'} exceeds the ${data.selectionLimit.toLocaleString()} claim payment limit. Narrow the filters and handle it in smaller scopes.`)
        return
      }
      if (data.claims.length !== data.eligibleCount) throw new Error('Incomplete eligibility snapshot')
      if (wholeBatch) {
        awaitingConfirmation = true
        setBatchConfirmation({ snapshot: data, batchId, originFilterScope })
        return
      }
      setSelected(current => mergeEligibleSelection(current, data.claims))
      setSelectionFilterScope(originFilterScope)
      setSelectionExcludedCount(data.excludedCount)
      toast.success(`${data.eligibleCount.toLocaleString()} eligible claims selected.`)
    } catch {
      if (!bulkRequestGate.current.isCurrent(ticket, requestScope) ||
          currentFilterScope.current !== originFilterScope) return
      toast.error('Could not select all eligible claims. No claims were added.')
    } finally {
      if (bulkRequestGate.current.isCurrent(ticket, requestScope)) {
        if (!awaitingConfirmation) bulkSelectingRef.current = false
        setBulkSelecting(false)
      }
    }
  }

  function cancelEntireBatch() {
    bulkSelectingRef.current = false
    setBatchConfirmation(null)
  }

  function confirmEntireBatch() {
    if (!batchConfirmation || batchConfirmation.originFilterScope !== currentFilterScope.current ||
        batchConfirmation.batchId !== batchId) {
      bulkSelectingRef.current = false
      setBatchConfirmation(null)
      toast.error('Batch selection scope changed. Load the batch selection again.')
      return
    }
    const next = mergeConfirmedBulkSelection(selected, batchConfirmation.snapshot,
      batchConfirmation.originFilterScope, currentFilterScope.current)
    if (next === selected) {
      bulkSelectingRef.current = false
      setBatchConfirmation(null)
      toast.error('Batch eligibility snapshot is incomplete or stale. Nothing was selected.')
      return
    }
    setSelected(next)
    setSelectionFilterScope(filterScope)
    setSelectionExcludedCount(batchConfirmation.snapshot.excludedCount)
    toast.success(`${batchConfirmation.snapshot.eligibleCount.toLocaleString()} eligible batch claims selected.`)
    bulkSelectingRef.current = false
    setBatchConfirmation(null)
  }

  function selectedKeys(): ClaimKey[] | null {
    if (selectionFilterScope !== filterScope) return null
    const rows = [...selected.values()]
    if (rows.some(row => row.legacy_ambiguous || (decision !== 'PAID' && !row.eligible_for_pay))) return null
    return rows.map(apiKey)
  }

  const selectedSummary = selectionSummary(selected.values())
  const selectedByBatch = useMemo(() => {
    const groups = new Map<string, Claim[]>()
    for (const claim of selected.values()) {
      const rows = groups.get(claim.batch_id) || []
      rows.push(claim)
      groups.set(claim.batch_id, rows)
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [selected])

  async function submitPayment(action: 'pay' | 'unpay') {
    if (bulkSelectingRef.current) {
      toast.warning('Wait for the current selection request to finish before payment.')
      return
    }
    if (!claimsAuth?.grants.includes(`claims.${action}`)) {
      setShowClaimsLogin(true)
      return
    }
    const keys = selectedKeys()
    if (!keys || keys.length === 0) {
      toast.error('Selection is stale. Claims were refreshed; select the remaining claims again.')
      await refreshClaims()
      return
    }
    const isPay = action === 'pay'
    if (isPay) setPaying(true)
    else setUnpaying(true)
    try {
      await withClaimsRefresh(async () => {
      const res = await fetch(`/api/nhia/claims/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isPay ? { claim_keys: keys, paid_date: payDate }
                                  : { claim_keys: keys, reason: unpayReason.trim() }),
      })
      if (res.status === 401) { setClaimsAuth(null); setShowClaimsLogin(true) }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const detail = data?.detail
        const paid = detail && typeof detail === 'object' && !Array.isArray(detail)
          ? detail.paid_claims?.length || 0 : 0
        throw new Error(`${paymentError(detail)}${paid ? ` ${paid} claim(s) were paid before the failure.` : ''} Server state was refreshed. Review the remaining selected claims before retrying.`)
      }
      toast.success(isPay ? `${data.paid} claim(s) marked as paid` : `${data.reversed} payment(s) reversed`)
      setSelected(new Map())
      setSelectionExcludedCount(null)
      if (isPay) setShowPay(false)
      else { setShowUnpay(false); setUnpayReason('') }
      }, refreshClaims)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Payment operation failed. Review refreshed Claims.')
    } finally {
      await refreshClaimsAuth()
      if (isPay) setPaying(false)
      else setUnpaying(false)
    }
  }

  async function handlePay() {
    if (!payDate) { toast.error('Enter a payment date'); return }
    await submitPayment('pay')
  }

  async function handleUnpay() {
    if (!reversalReasonValid(unpayReason)) { toast.error('Enter a reversal reason'); return }
    await submitPayment('unpay')
  }

  const downloadUrl = `${API}/api/v1/nhia/claims/export?${claimsQuery(decision, search, dateFrom, dateTo, batchId)}`

  const totalPages   = Math.ceil(total / limit)
  const denialReason = (c: Claim) => c.decision === 'DENY' ? (c.drop_reason || c.reasoning || '—') : null

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">NHIA Claims</h1>
          <p className="text-sm text-slate-500 mt-0.5">All individual claim lines from accepted batches</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && decision !== 'PAID' && (!claimsAuth || claimsAuth.grants.includes('claims.pay')) && (
            <Button variant="primary" size="md" onClick={() => claimsAuth?.grants.includes('claims.pay') ? setShowPay(true) : setShowClaimsLogin(true)}
              disabled={bulkSelecting || Boolean(batchConfirmation)}
              className="bg-emerald-600 hover:bg-emerald-700">
              Pay Selected ({selected.size})
            </Button>
          )}
          {selected.size > 0 && decision === 'PAID' && (!claimsAuth || claimsAuth.grants.includes('claims.unpay')) && (
            <Button variant="primary" size="md" onClick={() => claimsAuth?.grants.includes('claims.unpay') ? setShowUnpay(true) : setShowClaimsLogin(true)}>
              Unpay Selected ({selected.size})
            </Button>
          )}
          {selectableOnPage.length > 0 && selected.size === 0 && (
            <Button variant="outline" size="md" onClick={selectAllOnPage}>
              Select All {decision === 'PAID' ? 'Paid' : 'Approved'} ({selectableOnPage.length})
            </Button>
          )}
          <a href={downloadUrl} className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Download All
          </a>
          {claimsAuth ? <button type="button" className="text-xs text-slate-600 underline" onClick={async () => {
            try {
              const response = await fetch('/api/nhia/claims/auth/logout', { method: 'POST' })
              if (!response.ok) throw new Error('Claims sign-out could not be verified')
              setClaimsAuth(null)
            } catch { toast.error('Claims sign-out could not be verified') }
          }}>Exit payment mode ({claimsAuth.name})</button>
            : <button type="button" className="text-xs text-slate-600 underline" onClick={() => setShowClaimsLogin(true)}>Enter payment mode</button>}
          <Link href="/nhia-vetting/learning"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Learning DB
          </Link>
          <Link href="/nhia-vetting/supervisor"
            className="px-3 py-2 text-sm font-semibold text-[#137fec] border border-[#137fec] rounded-lg hover:bg-[#137fec]/5 transition-colors">
            Supervisor
          </Link>
          <Link href="/nhia-vetting"
            className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            ← Batches
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {(['ALL', 'APPROVE', 'DENY', 'PAID'] as const).map(d => (
              <Button key={d} variant={decision === d ? 'primary' : 'ghost'} size="sm"
                type="button"
                onClick={() => updateFilter(setDecision, d)}
                className={`rounded-none ${
                  decision === d && d === 'APPROVE' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  decision === d && d === 'DENY'    ? 'bg-rose-500 hover:bg-rose-600'       :
                  decision === d && d === 'PAID'    ? 'bg-[#137fec] hover:bg-[#137fec]/90' : ''
                }`}>
                {d}
              </Button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px]">
            <input type="text" placeholder="Search enrollee ID or procedure…"
              value={search} onChange={e => updateFilter(setSearch, e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
          </div>
          <div className="min-w-[220px]">
            <label htmlFor="claims-batch-filter" className="block text-xs font-semibold text-slate-500 mb-1">Batch Number</label>
            <input id="claims-batch-filter" list="claims-batch-options" type="text"
              placeholder="All batches" value={batchId}
              onChange={e => updateFilter(setBatchId, normalizeBatchFilter(e.target.value))}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
            <datalist id="claims-batch-options">
              {batchOptions.map(batch => <option key={batch.batch_id} value={batch.batch_id}>{batch.batch_name || batch.batch_id}</option>)}
            </datalist>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => updateFilter(setDateFrom, e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={e => updateFilter(setDateTo, e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
          </div>
          <Button type="submit" variant="primary" size="md">Search</Button>
          {(search || dateFrom || dateTo || batchId) && (
            <Button type="button" variant="ghost" size="md"
              onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setBatchId(''); setPage(1) }}>
              Clear
            </Button>
          )}
        </div>
      </form>

      {metrics && (
        <section aria-label="Claims scorecards" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
          <Scorecard label="Total Approved" value={fmtMoney(metrics.totalApprovedAmount)}
            detail={metrics.missingApprovedAmountCount > 0
              ? `Recorded amount — incomplete data (${metrics.missingApprovedAmountCount.toLocaleString()} missing)` : undefined} />
          <Scorecard label="Paid" value={fmtMoney(metrics.paidAmount)}
            detail={metrics.missingPaidAmountCount > 0
              ? `Recorded amount — incomplete data (${metrics.missingPaidAmountCount.toLocaleString()} missing)` : undefined} />
          <Scorecard label="Outstanding to Pay" value={fmtMoney(metrics.outstandingApprovedAmount)} prominent
            detail={metrics.missingApprovedAmountCount > metrics.missingPaidAmountCount || metrics.ambiguousPaymentCount > 0
              ? `Recorded amount — ${metrics.missingApprovedAmountCount - metrics.missingPaidAmountCount} missing; ${metrics.ambiguousPaymentCount} ambiguous (${fmtMoney(metrics.ambiguousPaymentAmount)})`
              : undefined} />
          <Scorecard label="Denied" value={fmtMoney(metrics.deniedAmount)}
            detail={deniedDataQuality(metrics)} />
          <Scorecard label="Approved Claims" value={metrics.approvedCount.toLocaleString()}
            detail={`${metrics.approvalRate.toFixed(2)}% approval rate${metrics.unrecognizedDecisionCount
              ? ` · ${metrics.unrecognizedDecisionCount.toLocaleString()} unrecognized decisions` : ''}`} />
          <Scorecard label="Payment Progress" value={`${metrics.paymentProgress.toFixed(2)}%`}
            detail={`${metrics.paidCount.toLocaleString()} paid · ${metrics.outstandingApprovedCount.toLocaleString()} outstanding`} />
        </section>
      )}

      {decision !== 'PAID' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <Button variant="outline" size="sm" onClick={selectAllOnPage} disabled={selectableOnPage.length === 0}>
            Select page ({selectableOnPage.length})
          </Button>
          <Button variant="outline" size="sm" onClick={() => selectAllMatching(false)} loading={bulkSelecting}
            disabled={!eligibility?.eligibleCount || eligibility.selectionLimitExceeded}>
            Select all {eligibility?.eligibleCount?.toLocaleString() || 0} eligible claims
          </Button>
          {batchId && <Button variant="outline" size="sm" onClick={() => selectAllMatching(true)} loading={bulkSelecting}>
            Select entire batch {batchId}
          </Button>}
          {eligibility?.selectionLimitExceeded && <span className="text-xs text-amber-700">
            More than {eligibility.selectionLimit.toLocaleString()} eligible claims; narrow the filters.
          </span>}
        </div>
      )}

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">{error}</div>
      )}

      {!loading && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {total.toLocaleString()} claim{total !== 1 ? 's' : ''}
            {decision !== 'ALL' && ` · ${decision}`}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </span>
          {totalPages > 1 && <span>Page {page} of {totalPages}</span>}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Loading…</div>
      ) : claims.length === 0 ? (
        <div className="text-center py-20 text-slate-400 text-sm">No claims found</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-3 w-8">
                  <input type="checkbox"
                    checked={selectableOnPage.length > 0 && selectableOnPage.every(c => selected.has(claimKey(c)))}
                    onChange={e => e.target.checked ? selectAllOnPage() : deselectPage()}
                    className="rounded border-slate-300" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">PA #</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Enrollee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Procedure</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Diagnosis</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Provider</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Enc. From</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Enc. To</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Date Submitted</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-50/50">Stated Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap bg-slate-50/50">Stated Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap bg-emerald-50/30">Approved Price</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap bg-emerald-50/30">Approved Qty</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap bg-emerald-50/30">Approved Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Stated Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-rose-500 uppercase tracking-wide whitespace-nowrap bg-rose-50/30">Denied Amt</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Decision</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Paid</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Denial Reason</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Batch</th>
              </tr>
            </thead>
            <tbody>
              {claims.map((c, i) => {
                const key        = claimKey(c)
                const isSelected = selected.has(key)
                const canSelect  = decision === 'PAID'
                  ? !c.legacy_ambiguous && c.paid
                  : c.eligible_for_pay === true
                const reason     = denialReason(c)
                const statedTotal = c.stated_price != null
                  ? Math.round((c.stated_price * (c.stated_quantity ?? 1)) * 100) / 100
                  : null
                const deniedAmt = statedTotal != null && c.total_amount != null
                  ? Math.round((statedTotal - c.total_amount) * 100) / 100
                  : statedTotal
                return (
                  <tr key={`${key}-${i}`}
                    className={`border-b border-slate-50 hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-emerald-50/40' : i % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-3 py-3 text-center">
                      {c.legacy_ambiguous && <span title="Multiple historical claim lines share this old identifier; manual reconciliation is required." className="text-xs text-amber-700">Reconciliation required</span>}
                      {c.legacy_ambiguous && c.decision === 'APPROVE' && c.request_id && claimsAuth?.grants.includes('claims.reconcile') &&
                        <button type="button" className="block text-xs underline text-amber-800" onClick={() => openReconcile(c)}>Reconcile</button>}
                      {canSelect && (
                        <input type="checkbox" checked={isSelected}
                          onChange={() => toggleSelect(c)}
                          className="rounded border-slate-300 accent-emerald-600" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{c.pa_number || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 whitespace-nowrap">{c.enrollee_id || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-800 text-xs">{c.procedure_code}</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate" title={c.procedure_name ?? undefined}>{c.procedure_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-semibold text-slate-800 text-xs">{c.diagnosis_code || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-[160px] truncate" title={c.diagnosis_name ?? undefined}>{c.diagnosis_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-slate-700">{c.provider_id || '—'}</p>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-[160px] truncate" title={c.provider_name ?? undefined}>{c.provider_name || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{fmtDate(c.encounter_date_from)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{fmtDate(c.encounter_date_to)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(c.date_submitted)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap bg-slate-50/30">{fmtMoney(c.stated_price)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap bg-slate-50/30">{c.stated_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap bg-emerald-50/20">
                      {c.adjusted_price != null ? (
                        <span className={c.adjusted_price !== c.stated_price ? 'text-amber-600' : 'text-slate-800'}>
                          {fmtMoney(c.adjusted_price)}
                          {c.adjusted_price !== c.stated_price && c.stated_price != null && (
                            <span className="block text-[10px] font-normal text-slate-400 line-through">{fmtMoney(c.stated_price)}</span>
                          )}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap bg-emerald-50/20">
                      {c.adjusted_quantity != null ? (
                        <span className={c.adjusted_quantity !== c.stated_quantity ? 'text-amber-600' : 'text-slate-800'}>
                          {c.adjusted_quantity}
                          {c.adjusted_quantity !== c.stated_quantity && c.stated_quantity != null && (
                            <span className="block text-[10px] font-normal text-slate-400 line-through">{c.stated_quantity}</span>
                          )}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-slate-900 whitespace-nowrap bg-emerald-50/20">{fmtMoney(c.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400 whitespace-nowrap">{fmtMoney(statedTotal)}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap bg-rose-50/20">
                      {deniedAmt != null && deniedAmt > 0
                        ? <span className="text-rose-600">{fmtMoney(deniedAmt)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={c.decision === 'APPROVE' ? 'success' : c.decision === 'DENY' ? 'error' : 'neutral'} size="sm">
                        {c.decision}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {c.paid ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700">PAID</span>
                          {c.paid_date && <p className="text-[10px] text-slate-400 mt-0.5">{c.paid_date}</p>}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      {reason
                        ? <p className="text-xs text-rose-600 leading-relaxed">{reason}</p>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-xs font-medium text-slate-700">{c.batch_name || c.batch_id}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ← Prev
          </Button>
          <span className="text-sm text-slate-500 px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next →
          </Button>
        </div>
      )}

      {selectedSummary.count > 0 && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-300 bg-white p-4 shadow-xl">
          <div className="min-w-[210px] flex-1">
            <p className="font-bold text-slate-900">{selectedSummary.count.toLocaleString()} claims selected</p>
            <p className="text-sm font-semibold text-emerald-700">{fmtMoney(selectedSummary.recordedAmount)}</p>
            {selectedSummary.missingAmountCount > 0 && <p className="text-xs text-amber-700">
              Recorded total is incomplete: {selectedSummary.missingAmountCount.toLocaleString()} selected claim(s) have no amount.
            </p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSelected(true)}>Review selected</Button>
          <Button variant="ghost" size="sm" onClick={() => { setSelected(new Map()); setSelectionExcludedCount(null) }}>Clear selection</Button>
          {decision === 'PAID'
            ? <Button variant="primary" size="sm" onClick={() => claimsAuth?.grants.includes('claims.unpay') ? setShowUnpay(true) : setShowClaimsLogin(true)}>Unpay selected</Button>
            : <Button variant="primary" size="sm" disabled={bulkSelecting || Boolean(batchConfirmation)}
                onClick={() => claimsAuth?.grants.includes('claims.pay') ? setShowPay(true) : setShowClaimsLogin(true)}
                className="bg-emerald-600 hover:bg-emerald-700">Pay selected</Button>}
        </div>
      )}

      {batchConfirmation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div role="dialog" aria-modal="true" aria-labelledby="batch-selection-title"
          className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
          <div>
            <h2 id="batch-selection-title" className="text-lg font-bold text-slate-900">
              Select entire batch {batchConfirmation.batchId}?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This will select every eligible unpaid APPROVE claim in this batch, including claims hidden by your current search, date, or decision filters. Your current filters will be ignored for this selection.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div><dt className="text-slate-500">Eligible claims</dt><dd className="font-bold">{batchConfirmation.snapshot.eligibleCount.toLocaleString()}</dd></div>
            <div><dt className="text-slate-500">Recorded total</dt><dd className="font-bold">{fmtMoney(batchConfirmation.snapshot.recordedAmount)}</dd></div>
            <div><dt className="text-slate-500">Missing amounts</dt><dd className="font-bold text-amber-700">{batchConfirmation.snapshot.missingAmountCount.toLocaleString()}</dd></div>
            <div><dt className="text-slate-500">Excluded/ineligible</dt><dd className="font-bold">{batchConfirmation.snapshot.excludedCount.toLocaleString()}</dd></div>
          </dl>
          {batchConfirmation.snapshot.missingAmountCount > 0 && <p className="text-xs text-amber-700">
            The recorded total is incomplete because some eligible claims have no recorded amount.
          </p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="md" onClick={cancelEntireBatch}>Cancel</Button>
            <Button variant="primary" size="md" onClick={confirmEntireBatch}>Select entire batch</Button>
          </div>
        </div>
      </div>}

      {showSelected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-auto">
          <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Review selected claims</h2>
            <button onClick={() => setShowSelected(false)} className="text-2xl text-slate-400">×</button></div>
          <p className="text-sm text-slate-600">{selectedSummary.count.toLocaleString()} eligible claims · {fmtMoney(selectedSummary.recordedAmount)}</p>
          {selectedSummary.missingAmountCount > 0 && <p className="text-sm text-amber-700">Total is incomplete because {selectedSummary.missingAmountCount} claim(s) have no recorded amount.</p>}
          {selectionExcludedCount != null && <p className="text-sm text-slate-600">{selectionExcludedCount.toLocaleString()} ineligible claim(s) were excluded from the bulk selection.</p>}
          {selectedByBatch.map(([batch, rows]) => <section key={batch} className="space-y-2">
            <h3 className="font-semibold text-slate-900">Batch {batch} · {rows.length.toLocaleString()} selected</h3>
            <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left border-b">
              <th className="py-2">Request</th><th>Member</th><th>Provider</th><th>Procedure</th><th className="text-right">Amount</th><th>Status</th><th></th>
            </tr></thead><tbody>{rows.map(row => <tr key={claimKey(row)} className="border-b border-slate-100">
              <td className="py-2">{row.request_id || '—'}</td><td>{row.enrollee_id}</td><td>{row.provider_name || row.provider_id || '—'}</td>
              <td>{row.procedure_code} {row.procedure_name}</td><td className="text-right">{fmtMoney(row.total_amount)}</td>
              <td>{row.eligible_for_pay ? 'Eligible' : row.paid ? 'Paid' : 'Review required'}</td>
              <td><button className="text-rose-600 underline" onClick={() => setSelected(current => removeSelectedClaim(current, claimKey(row)))}>Remove</button></td>
            </tr>)}</tbody></table></div>
          </section>)}
          <div className="flex justify-end"><Button variant="primary" size="md" onClick={() => setShowSelected(false)}>Done</Button></div>
        </div>
      </div>}

      {/* ── Pay Modal ── */}
      {showClaimsLogin && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <form onSubmit={loginClaims} className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
          <h2 className="text-lg font-bold">Claims payment authorization</h2>
          <p className="text-sm text-slate-600">Enter your separately issued Claims operator credential.</p>
          <label className="block text-sm">Operator ID<input required maxLength={128} value={claimsOperator}
            onChange={e => setClaimsOperator(e.target.value)} className="block w-full border rounded p-2 mt-1" /></label>
          <label className="block text-sm">Claims credential<input required type="password" autoComplete="current-password"
            value={claimsCredential} onChange={e => setClaimsCredential(e.target.value)} className="block w-full border rounded p-2 mt-1" /></label>
          <div className="flex gap-3"><Button variant="ghost" size="md" onClick={() => { setShowClaimsLogin(false); setClaimsCredential('') }}>Cancel</Button>
            <Button variant="primary" size="md" type="submit" loading={claimsLoginBusy}>Authorize</Button></div>
        </form>
      </div>}
      {reconcileRow && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-auto">
          <h2 className="text-lg font-bold">Reconcile legacy payment marker</h2>
          <p className="text-sm text-amber-900">This does NOT change APPROVE/DENY decisions and does NOT pay any claim. After reconciliation, the APPROVE claim can be selected and paid normally.</p>
          <table className="w-full text-xs"><thead><tr><th>Request ID</th><th>Procedure</th><th>Diagnosis</th><th>Decision</th><th>Approved qty</th><th>Approved total</th></tr></thead>
            <tbody>{conflictingLines.map(line => <tr key={line.request_id}><td>{line.request_id}</td><td>{line.procedure_code} {line.procedure_name}</td>
              <td>{line.diagnosis_code}</td><td>{line.decision}</td><td>{line.approved_quantity ?? '—'}</td><td>{fmtMoney(line.approved_total ?? null)}</td></tr>)}</tbody></table>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmNoPayment} onChange={e => setConfirmNoPayment(e.target.checked)} />
            I confirm no actual provider payment was made for this legacy payment record.</label>
          <label className="block text-sm">Reason<textarea required value={reconcileReason} onChange={e => setReconcileReason(e.target.value)}
            className="block w-full border rounded p-2 mt-1" /></label>
          <label className="block text-sm">Evidence or ledger reference<input required maxLength={256} value={evidenceReference}
            onChange={e => setEvidenceReference(e.target.value)} className="block w-full border rounded p-2 mt-1" /></label>
          <div className="flex gap-3"><Button variant="ghost" size="md" onClick={() => setReconcileRow(null)}>Cancel</Button>
            <Button variant="primary" size="md" onClick={submitReconcile} loading={reconcileBusy}
              disabled={!confirmNoPayment || !reconcileReason.trim() || !evidenceReference.trim() || conflictingLines.length < 2}>
              Mark legacy payment as not paid</Button></div>
        </div>
      </div>}
      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Mark as Paid</h2>
              <button onClick={() => setShowPay(false)} className="text-slate-400 hover:text-slate-700 text-2xl leading-none">×</button>
            </div>
            <p className="text-sm text-slate-600">
              Marking <span className="font-bold text-emerald-700">{selectedSummary.count}</span> claim{selectedSummary.count !== 1 ? 's' : ''} as paid.
            </p>
            <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
              <p><span className="font-semibold">Recorded total:</span> {fmtMoney(selectedSummary.recordedAmount)}</p>
              <p><span className="font-semibold">Batches:</span> {selectedSummary.batches.join(', ')}</p>
              {selectedSummary.missingAmountCount > 0 && <p className="text-amber-700">Incomplete total: {selectedSummary.missingAmountCount} missing amount(s).</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Payment Date</label>
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="ghost" size="md" onClick={() => setShowPay(false)} className="flex-1">Cancel</Button>
              <Button variant="primary" size="md" onClick={handlePay} loading={paying}
                disabled={bulkSelecting || Boolean(batchConfirmation)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
      {showUnpay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Reverse payment</h2>
            <p className="text-sm text-slate-600">Unpay {selected.size} selected claim{selected.size !== 1 ? 's' : ''}. The adjudication decision will remain unchanged.</p>
            <label className="block text-sm font-semibold">Reason
              <textarea value={unpayReason} onChange={e => setUnpayReason(e.target.value)}
                className="mt-2 w-full border rounded-lg p-2" required rows={3} />
            </label>
            <div className="flex gap-3">
              <Button variant="ghost" size="md" onClick={() => setShowUnpay(false)}>Cancel</Button>
              <Button variant="primary" size="md" onClick={handleUnpay} disabled={!reversalReasonValid(unpayReason)} loading={unpaying}>Confirm Unpay</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
