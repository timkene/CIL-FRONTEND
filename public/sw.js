/* Clearline push notification service worker */
self.addEventListener('push', (event) => {
  let data = { title: 'Clearline', body: 'New notification', url: '/' }
  try { data = { ...data, ...event.data.json() } } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const found = list.find((c) => c.url.includes(url) && 'focus' in c)
      if (found) return found.focus()
      return clients.openWindow(url)
    })
  )
})
