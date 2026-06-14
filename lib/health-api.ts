const API_BASE = process.env.NEXT_PUBLIC_HEALTH_API_URL ?? 'http://localhost:8000'
const API_KEY  = process.env.NEXT_PUBLIC_HEALTH_API_KEY ?? ''

const authHeaders = (): HeadersInit => ({ 'X-API-Key': API_KEY })

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UploadResult {
  batch_id:     string
  company_name: string
  count:        number
  preview:      EnrolleeRow[]
}

export interface EnrolleeRow {
  enrollee_id:   string
  name:          string
  age:           number
  gender:        string
  systolic:      number | null
  diastolic:     number | null
  blood_glucose: number | null
  bmi:           number | null
  cholesterol:   number | null
  email:         string | null
  phone:         string | null
  company_name:  string | null
}

export interface EnrolleeWithStatus extends EnrolleeRow {
  health_score: number | null
  urgency:      string | null
  has_pdf:      boolean
  email_sent:   boolean
}

export interface MetricScore {
  metric: string
  score:  number
  flag:   string | null
}

export interface KlaireAnalysis {
  enrollee_id:   string
  health_score:  number
  urgency:       'routine' | 'watch' | 'urgent' | 'critical'
  metric_scores: MetricScore[]
  dominant_risk: string | null
  next_steps:    string[]
  klaire_flags:  string
}

export interface EmailResult {
  enrollee_id: string
  sent:        boolean
  method:      string
}

// ── API Calls ──────────────────────────────────────────────────────────────────

export async function uploadBatch(file: File, companyName: string): Promise<UploadResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('company_name', companyName)
  const res = await fetch(`${API_BASE}/api/reports/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })
  if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`)
  return res.json()
}

export async function listEnrollees(batchId: string): Promise<EnrolleeWithStatus[]> {
  const res = await fetch(`${API_BASE}/api/reports/batch/${batchId}/enrollees`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to load enrollees: ${await res.text()}`)
  return res.json()
}

export async function analyseEnrollee(enrolleeId: string): Promise<KlaireAnalysis> {
  const res = await fetch(`${API_BASE}/api/klaire/analyse/${enrolleeId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Analysis failed: ${await res.text()}`)
  return res.json()
}

export async function generateAndDownloadPdf(enrolleeId: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/${enrolleeId}/generate-sync`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`PDF generation failed: ${await res.text()}`)
  const blob = await res.blob()
  _triggerDownload(blob, `${name}_health_report.pdf`)
}

export async function downloadExistingPdf(enrolleeId: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/${enrolleeId}/pdf`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`PDF not found — generate the report first`)
  const blob = await res.blob()
  _triggerDownload(blob, `${name}_health_report.pdf`)
}

export async function sendEmail(enrolleeId: string): Promise<EmailResult> {
  const res = await fetch(`${API_BASE}/api/email/send/${enrolleeId}`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Email failed: ${await res.text()}`)
  return res.json()
}

// ── SSE Streaming ──────────────────────────────────────────────────────────────

export async function streamNarrative(
  enrolleeId: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/klaire/stream/${enrolleeId}`, {
      headers: authHeaders(),
    })
  } catch (e) {
    onError(String(e))
    return
  }
  if (!res.ok) {
    onError(`Stream error: ${await res.text()}`)
    return
  }
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') { onDone(); return }
        try { onChunk(JSON.parse(payload) as string) } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock()
  }
  onDone()
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function _triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
