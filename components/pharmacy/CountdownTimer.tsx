'use client'
import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  endsAt: string
}

function formatTime(ms: number): string {
  const totalSecs = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSecs / 60).toString().padStart(2, '0')
  const s = (totalSecs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

const TWO_MINUTES_MS = 2 * 60 * 1000

function parseUtc(s: string): number {
  const utc = /[Z+\-]\d*$/.test(s) ? s : s + 'Z'
  return new Date(utc).getTime()
}

export function CountdownTimer({ endsAt }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => parseUtc(endsAt) - Date.now())

  useEffect(() => {
    const id = setInterval(() => setRemaining(parseUtc(endsAt) - Date.now()), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  const expired = remaining <= 0
  const isUrgent = remaining < TWO_MINUTES_MS && !expired

  return (
    <span className={`font-mono text-5xl font-bold tabular-nums ${isUrgent ? 'text-rose-600 animate-pulse' : 'text-white'}`}>
      {expired ? '00:00' : formatTime(remaining)}
    </span>
  )
}
