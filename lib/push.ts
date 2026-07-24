'use client'

const KLAIRE_API = process.env.NEXT_PUBLIC_KLAIRE_API_URL ?? ''
const PHARMACY_API = process.env.NEXT_PUBLIC_PHARMACY_API_URL ?? ''
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function getOrCreateSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription()
  if (existing) return existing
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
}

async function postSubscription(url: string, sub: PushSubscription, headers: HeadersInit = {}): Promise<void> {
  const body = sub.toJSON()
  await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

export async function registerPush(userName?: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID_PUBLIC_KEY) return

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return

    const sub = await getOrCreateSubscription(reg)

    const klaireHeaders: HeadersInit = userName ? { 'X-Service-User': userName } : {}
    await Promise.allSettled([
      postSubscription(`${KLAIRE_API}/team/api/push/subscribe`, sub, klaireHeaders),
      postSubscription(`${PHARMACY_API}/api/push/subscribe`, sub),
    ])
  } catch (err) {
    console.warn('[push] registration failed', err)
  }
}

export async function unregisterPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (!reg) return
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return
    const body = sub.toJSON()
    await sub.unsubscribe()
    await Promise.allSettled([
      fetch(`${KLAIRE_API}/team/api/push/unsubscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      fetch(`${PHARMACY_API}/api/push/unsubscribe`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    ])
  } catch (err) {
    console.warn('[push] unregister failed', err)
  }
}
