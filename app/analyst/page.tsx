'use client'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export default function AnalystPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages, busy, error])

  async function send() {
    const content = input.trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Analyst unavailable')
      setMessages([...next, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyst unavailable')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)]">
      <PageHeader title="Analyst" right={<span>MLR Data access · live MediCloud lookups</span>} />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500 max-w-xl">
            Ask for cash and debit collections, medical cost, active lives, or plan census. Example:
            “Air Peace lives on APN BRONZE 25 this year” or “Outsourced Drivers cash January 2026 to date”.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-2xl whitespace-pre-wrap text-sm rounded-lg px-4 py-3 ${
              m.role === 'user' ? 'ml-auto bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800'
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy && <p className="text-xs text-slate-400">Looking up live figures…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div ref={bottom} />
      </div>
      <form
        className="border-t border-slate-200 bg-white p-4 md:px-8 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <textarea
          className="flex-1 min-h-[44px] max-h-32 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Ask about a company…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <Button type="submit" disabled={busy || !input.trim()}>Send</Button>
      </form>
    </div>
  )
}
