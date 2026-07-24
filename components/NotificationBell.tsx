'use client'
import { useEffect, useRef, useState } from 'react'
import { getEscalations } from '@/lib/klaire-api'
import { getPharmacyOrders } from '@/lib/pharmacy-api'

interface NotifItem {
  id: string
  title: string
  body: string
  url: string
  at: string
}

async function fetchNotifs(): Promise<NotifItem[]> {
  const items: NotifItem[] = []

  try {
    const { escalations } = await getEscalations('open')
    for (const e of escalations.slice(0, 5)) {
      items.push({
        id: `esc-${e.id}`,
        title: `Escalation L${e.level}`,
        body: `${e.enrollee_name} — ${e.complaint?.slice(0, 60) ?? ''}`,
        url: '/escalations',
        at: e.created_at,
      })
    }
  } catch (_) {}

  try {
    const { orders } = await getPharmacyOrders()
    const pending = orders.filter((o) => o.status === 'pending_review').slice(0, 5)
    for (const o of pending) {
      items.push({
        id: `ord-${o.id}`,
        title: 'Pharmacy Order',
        body: `${o.enrollee?.fullName ?? 'Enrollee'} — ${o.medications?.length ?? 0} med(s) pending review`,
        url: `/pharmacy/orders/${o.id}`,
        at: o.createdAt ?? '',
      })
    }
  } catch (_) {}

  return items.sort((a, b) => (b.at > a.at ? 1 : -1))
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifItem[]>([])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifs().then(setItems).catch(() => {})
    const id = setInterval(() => fetchNotifs().then(setItems).catch(() => {}), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const count = items.length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 text-slate-500"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined text-xl">notifications</span>
        {count > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">Notifications</span>
            <button
              className="text-xs text-[#137fec] hover:underline"
              onClick={() => fetchNotifs().then(setItems)}
            >
              Refresh
            </button>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No open items</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-slate-50">
              {items.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    className="flex flex-col gap-0.5 px-4 py-3 hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    <span className="text-xs font-semibold text-[#137fec]">{item.title}</span>
                    <span className="text-sm text-slate-700 leading-snug">{item.body}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
