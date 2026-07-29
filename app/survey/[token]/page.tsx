'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'

const KLAIRE_URL = process.env.NEXT_PUBLIC_KLAIRE_API_URL || 'https://klaire-whatsapp.onrender.com'

type SurveyContext = {
  hospital: string
  first_name: string
  visit_date: string
  already_submitted: boolean
}

function StarRating({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string
  sublabel: string
  value: number | null
  onChange: (v: number) => void
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value

  return (
    <div className="question-block">
      <p className="question-label">{label}</p>
      <p className="question-sublabel">{sublabel}</p>
      <div className="stars">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            className={`star ${display !== null && n <= display ? 'active' : ''}`}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      {value !== null && (
        <p className="rating-label">
          {value === 1 ? 'Poor' : value === 2 ? 'Fair' : value === 3 ? 'Good' : value === 4 ? 'Very Good' : 'Excellent'}
        </p>
      )}
    </div>
  )
}

function NpsRating({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value

  const getColor = (n: number) => {
    if (display !== null && n <= display) {
      if (display <= 6) return '#ef4444'
      if (display <= 8) return '#f59e0b'
      return '#10b981'
    }
    return '#e5e7eb'
  }

  return (
    <div className="question-block">
      <p className="question-label">Would you recommend Clearline HMO?</p>
      <p className="question-sublabel">How likely are you to recommend Clearline HMO to a friend or family member?</p>
      <div className="nps-row">
        {Array.from({ length: 11 }, (_, i) => i).map(n => (
          <button
            key={n}
            type="button"
            className="nps-btn"
            style={{ backgroundColor: getColor(n), color: (display !== null && n <= display) ? '#fff' : '#6b7280' }}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onChange(n)}
            aria-label={`${n}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="nps-labels">
        <span>Not likely</span>
        <span>Extremely likely</span>
      </div>
      {value !== null && (
        <p className="rating-label">
          {value <= 6 ? 'Detractor — we will work to do better' : value <= 8 ? 'Passive — thank you for your feedback' : 'Promoter — we are glad you had a great experience'}
        </p>
      )}
    </div>
  )
}

export default function SurveyPage({ params }: { params: { token: string } }) {
  const { token } = params

  const [ctx, setCtx] = useState<SurveyContext | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [csat, setCsat] = useState<number | null>(null)
  const [providerRating, setProviderRating] = useState<number | null>(null)
  const [clearlineRating, setClearlineRating] = useState<number | null>(null)
  const [nps, setNps] = useState<number | null>(null)
  const [comments, setComments] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${KLAIRE_URL}/api/survey/${token}`)
      .then(r => {
        if (r.status === 404) throw new Error('not_found')
        if (r.status === 410) throw new Error('expired')
        if (!r.ok) throw new Error('error')
        return r.json()
      })
      .then(data => {
        setCtx(data)
        if (data.already_submitted) setSubmitted(true)
      })
      .catch(e => setLoadError(e.message))
  }, [token])

  const canSubmit = csat !== null && providerRating !== null && clearlineRating !== null && nps !== null

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const r = await fetch(`${KLAIRE_URL}/api/survey/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csat,
          provider_rating: providerRating,
          clearline_rating: clearlineRating,
          nps,
          comments: comments || null,
        }),
      })
      if (!r.ok) throw new Error('submit_failed')
      setSubmitted(true)
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; }
        .page { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 24px 16px 48px; }
        .logo-wrap { margin-bottom: 28px; }
        .card { background: #fff; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06); width: 100%; max-width: 520px; overflow: hidden; }
        .card-header { background: linear-gradient(135deg, #00c896 0%, #0095d4 60%, #1b2f8a 100%); padding: 28px 28px 24px; color: #fff; }
        .card-header h1 { font-size: 20px; font-weight: 700; line-height: 1.3; }
        .card-header p { font-size: 14px; opacity: .85; margin-top: 6px; }
        .card-body { padding: 28px; display: flex; flex-direction: column; gap: 28px; }
        .question-block { display: flex; flex-direction: column; gap: 6px; }
        .question-label { font-size: 15px; font-weight: 600; color: #1e293b; }
        .question-sublabel { font-size: 13px; color: #64748b; }
        .stars { display: flex; gap: 8px; margin-top: 8px; }
        .star { font-size: 36px; background: none; border: none; cursor: pointer; color: #e5e7eb; transition: color .15s, transform .1s; line-height: 1; padding: 0; }
        .star.active { color: #f59e0b; }
        .star:hover { transform: scale(1.15); }
        .rating-label { font-size: 12px; color: #64748b; margin-top: 2px; font-style: italic; }
        .nps-row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
        .nps-btn { width: 40px; height: 40px; border-radius: 8px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: transform .1s, background-color .15s; }
        .nps-btn:hover { transform: scale(1.1); }
        .nps-labels { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin-top: 6px; }
        .comments { width: 100%; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 14px; resize: vertical; font-family: inherit; color: #1e293b; outline: none; transition: border-color .2s; }
        .comments:focus { border-color: #0095d4; }
        .submit-btn { width: 100%; padding: 15px; border-radius: 10px; border: none; background: linear-gradient(135deg, #00c896, #0095d4); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; transition: opacity .2s, transform .1s; }
        .submit-btn:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
        .submit-btn:disabled { opacity: .5; cursor: not-allowed; }
        .error-msg { color: #ef4444; font-size: 13px; text-align: center; }
        .divider { height: 1px; background: #f1f5f9; }
        .success-card { text-align: center; padding: 48px 28px; }
        .success-icon { font-size: 56px; margin-bottom: 16px; }
        .success-card h2 { font-size: 22px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
        .success-card p { color: #64748b; font-size: 15px; line-height: 1.6; }
        .expired-card { text-align: center; padding: 48px 28px; }
        .expired-icon { font-size: 48px; margin-bottom: 16px; }
        .expired-card h2 { font-size: 20px; font-weight: 600; color: #1e293b; margin-bottom: 8px; }
        .expired-card p { color: #64748b; font-size: 14px; }
        @media (max-width: 400px) {
          .star { font-size: 30px; }
          .nps-btn { width: 32px; height: 32px; font-size: 12px; }
        }
      `}</style>

      <div className="page">
        <div className="logo-wrap">
          <Image src="/clearline-logo.png" alt="Clearline HMO" width={160} height={44} style={{ objectFit: 'contain' }} priority />
        </div>

        <div className="card">
          {loadError === 'expired' ? (
            <div className="expired-card">
              <div className="expired-icon">⏰</div>
              <h2>This survey link has expired</h2>
              <p>Survey links are valid for 5 days after your visit.<br />If you have feedback or a concern, please contact Clearline HMO directly.</p>
            </div>
          ) : loadError === 'not_found' ? (
            <div className="expired-card">
              <div className="expired-icon">🔍</div>
              <h2>Survey not found</h2>
              <p>This link doesn't match any survey. Please check the link sent to you on WhatsApp.</p>
            </div>
          ) : loadError ? (
            <div className="expired-card">
              <div className="expired-icon">⚠️</div>
              <h2>Something went wrong</h2>
              <p>Please try again in a moment.</p>
            </div>
          ) : !ctx ? (
            <div className="success-card">
              <p style={{ color: '#94a3b8' }}>Loading your survey...</p>
            </div>
          ) : submitted ? (
            <div className="success-card">
              <div className="success-icon">🙏</div>
              <h2>Thank you, {ctx.first_name}!</h2>
              <p>
                Your feedback has been received and will help us improve care for you and all Clearline members.
                <br /><br />
                If you have any questions or need help, just reply to Klaire on WhatsApp — she's always available.
              </p>
            </div>
          ) : (
            <>
              <div className="card-header">
                <h1>How was your visit to {ctx.hospital}?</h1>
                <p>Hi {ctx.first_name}! Your honest feedback helps us serve you better. Takes about 2 minutes.</p>
              </div>
              <div className="card-body">
                <StarRating
                  label="Overall care experience"
                  sublabel={`How would you rate your overall experience at ${ctx.hospital}?`}
                  value={csat}
                  onChange={setCsat}
                />
                <div className="divider" />
                <StarRating
                  label={`${ctx.hospital} rating`}
                  sublabel="How would you rate the care and attention from the hospital staff?"
                  value={providerRating}
                  onChange={setProviderRating}
                />
                <div className="divider" />
                <StarRating
                  label="Clearline HMO service"
                  sublabel="How would you rate Clearline HMO's overall service as your health insurance provider?"
                  value={clearlineRating}
                  onChange={setClearlineRating}
                />
                <div className="divider" />
                <NpsRating value={nps} onChange={setNps} />
                <div className="divider" />
                <div className="question-block">
                  <p className="question-label">Any additional comments? <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></p>
                  <textarea
                    className="comments"
                    rows={3}
                    placeholder="Tell us more about your experience..."
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                  />
                </div>
                {submitError && <p className="error-msg">{submitError}</p>}
                <button
                  className="submit-btn"
                  disabled={!canSubmit || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
