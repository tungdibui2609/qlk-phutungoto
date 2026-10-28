// Chánh Thu PWA Service Worker for Web Push Notifications, App Badge & Offline Scanner

const CACHE_NAME = 'chanhthu-scanner-cache-v3'
const PRECACHE_URLS = [
    '/scanner',
    '/logoanywarehouse.png',
    '/manifest.webmanifest',
    '/tessdata/worker.min.js',
    '/tessdata/eng.traineddata'
]

self.addEventListener('install', (event) => {
    self.skipWaiting()
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS).catch((err) => {
                console.warn('[SW] Precache failed (will cache dynamically):', err)
            })
        })
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Clean up old caches
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                )
            })
        ])
    )
})

// Fetch strategy: Cache First for static chunks, Network-First with Cache Fallback for scanner navigation
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url)

    // Only intercept GET requests
    if (event.request.method !== 'GET') return
    if (!url.protocol.startsWith('http')) return

    // Do NOT cache APIs (IndexedDB handles data offline)
    if (url.pathname.startsWith('/api/')) return
    if (url.hostname.includes('supabase.co')) return

    // 1. Navigation requests for /scanner (allow app to open even when completely offline)
    if (event.request.mode === 'navigate' && (url.pathname === '/scanner' || url.pathname.startsWith('/scanner/') || url.pathname === '/mobile/pallet-scanner')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    }
                    return networkResponse
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(event.request)
                    if (cachedResponse) return cachedResponse
                    const fallback = await caches.match('/scanner')
                    if (fallback) return fallback
                    return new Response('Offline: Vui lòng kết nối mạng để tải dữ liệu lần đầu.', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                    })
                })
        )
        return
    }

    // 2. Next.js Static Assets, OCR Tessdata & Images (Cache-First with Network Fallback)
    if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/tessdata/') || url.pathname.endsWith('.wasm') || url.pathname.endsWith('.wasm.js') || url.pathname.endsWith('.traineddata') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg') || url.pathname.endsWith('.ico') || url.pathname.endsWith('.woff2')) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // Return cached and optionally refresh in background
                    fetch(event.request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse))
                        }
                    }).catch(() => {})
                    return cachedResponse
                }
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const clone = networkResponse.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    }
                    return networkResponse
                })
            })
        )
        return
    }
})

// Listen to incoming push notifications
self.addEventListener('push', (event) => {
    let payload = {}
    if (event.data) {
        try {
            payload = event.data.json()
        } catch (e) {
            payload = { body: event.data.text() }
        }
    }

    const title = payload.title || 'Thông Báo Việc Mới - Chánh Thu'
    const targetUrl = payload.url || '/work/tasks'
    const badgeCount = typeof payload.badgeCount === 'number' ? payload.badgeCount : 1

    const options = {
        body: payload.body || 'Bạn có nhiệm vụ mới được phân công.',
        icon: payload.icon || '/logoanywarehouse.png',
        badge: payload.badge || '/logoanywarehouse.png',
        vibrate: [250, 100, 250, 100, 250],
        data: {
            url: targetUrl,
            taskId: payload.taskId || null,
            badgeCount: badgeCount,
        },
        tag: payload.tag || `chanhthu-task-${payload.taskId || Date.now()}`,
        renotify: true,
        requireInteraction: true,
        actions: [
            {
                action: 'open_task',
                title: 'Xem ngay',
            }
        ]
    }

    // Set app badge counter on device home screen icon
    const promiseBadge = (navigator.setAppBadge && badgeCount > 0)
        ? navigator.setAppBadge(badgeCount).catch(() => {})
        : Promise.resolve()

    const promiseNotification = self.registration.showNotification(title, options)

    event.waitUntil(Promise.all([promiseNotification, promiseBadge]))
})

// Listen to notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const targetUrl = (event.notification.data && event.notification.data.url) || '/work/tasks'

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // If already open in a tab, focus it and navigate
            for (const client of windowClients) {
                if (client.url && client.url.includes('/work/tasks') && 'focus' in client) {
                    client.navigate(targetUrl)
                    return client.focus()
                }
            }
            // Otherwise open a new window
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl)
            }
        })
    )
})

// Listen to messages from clients (e.g. to update badge directly)
self.addEventListener('message', (event) => {
    if (!event.data) return

    if (event.data.type === 'SET_BADGE') {
        const count = event.data.count || 0
        if (navigator.setAppBadge) {
            if (count > 0) {
                navigator.setAppBadge(count).catch(() => {})
            } else {
                navigator.clearAppBadge ? navigator.clearAppBadge().catch(() => {}) : null
            }
        }
    } else if (event.data.type === 'CLEAR_BADGE') {
        if (navigator.clearAppBadge) {
            navigator.clearAppBadge().catch(() => {})
        }
    }
})
