// BatchDesk Custom Service Worker
// Handles: Workbox precache + notification click + local notification display

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Take control of all clients immediately
self.skipWaiting()
clientsClaim()

// Precache all Vite-built assets (injected by VitePWA at build time)
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ── Runtime caching ─────────────────────────────────────────────────────────

// Supabase API: network first, 5-min cache
registerRoute(
  ({ url }) => url.hostname.includes('supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 })],
    networkTimeoutSeconds: 5,
  })
)

// Images: cache first
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 })],
  })
)

// JS/CSS: stale while revalidate
registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new StaleWhileRevalidate({ cacheName: 'static-cache' })
)

// ── Push Notifications (from server, future use) ────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'Batch Desk', {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data: { url: data.url || '/notifications' },
      vibrate: [200, 100, 200],
    })
  )
})

// ── Notification Click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/notifications'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.navigate(targetUrl)
          return
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})

// ── Message handler: trigger notification from page JS ──────────────────────
// The page sends a message: { type: 'SHOW_NOTIFICATION', title, body, url }
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url } = event.data
    event.waitUntil(
      self.registration.showNotification(title || 'Batch Desk', {
        body: body || 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        tag: `batchdesk-${Date.now()}`,
        renotify: true,
        data: { url: url || '/notifications' },
        vibrate: [200, 100, 200],
      })
    )
  }
})
