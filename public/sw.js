// Chánh Thu PWA Service Worker for Web Push Notifications & App Badge

self.addEventListener('install', (event) => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim())
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
