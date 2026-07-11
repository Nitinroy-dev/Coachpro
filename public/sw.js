const CACHE_NAME = 'batchdesk-v2'
const STATIC_CACHE = 'batchdesk-static-v2'
const API_CACHE = 'batchdesk-api-v2'

const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/students',
  '/fees',
  '/attendance',
  '/schedule',
  '/offline.html',
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]

// INSTALL: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// ACTIVATE: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE 
                      && key !== API_CACHE)
          .map(key => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// FETCH: network first, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET and external API calls
  if (request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return
  if (url.hostname.includes('razorpay.com')) return

  // Network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful requests for offline use
        if (response.ok) {
          const clone = response.clone()
          caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, clone)
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached
          // If offline and request is page load, show offline fallback page
          if (request.mode === 'navigate') {
            return caches.match('/offline.html')
          }
        })
      })
  )
})

// PUSH NOTIFICATIONS
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'Batch Desk',
      {
        body: data.body || 'New notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        data: { url: data.url || '/dashboard' }
      }
    )
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(
      event.notification.data.url || '/dashboard'
    )
  )
})
