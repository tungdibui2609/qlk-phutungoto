'use client'

import { useState, useEffect, useCallback } from 'react'

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export interface UsePushNotificationsProps {
    userId?: string | null
    userName?: string | null
    teamNames?: string[]
    systemCode?: string | null
    companyId?: string | null
}

export function usePushNotifications({
    userId,
    userName,
    teamNames = [],
    systemCode = 'sanxuat',
    companyId,
}: UsePushNotificationsProps = {}) {
    const [isSupported, setIsSupported] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [loading, setLoading] = useState(false)
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

    // Check support and register Service Worker on mount
    useEffect(() => {
        if (typeof window === 'undefined') return

        const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
        setIsSupported(supported)

        if (!supported) return

        setPermission(Notification.permission)

        navigator.serviceWorker
            .register('/sw.js')
            .then(async (reg) => {
                setRegistration(reg)
                const sub = await reg.pushManager.getSubscription()
                if (sub) {
                    setIsSubscribed(true)
                    // Auto-sync team names & user if already subscribed
                    if (userId) {
                        fetch('/api/notifications/subscribe', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                subscription: sub.toJSON(),
                                user_id: userId,
                                user_name: userName || 'Nhân viên',
                                team_names: teamNames,
                                system_code: systemCode,
                                company_id: companyId,
                            }),
                        }).catch(() => {})
                    }
                }
            })
            .catch((err) => {
                console.warn('Service Worker registration failed:', err)
            })
    }, [userId, userName, JSON.stringify(teamNames), systemCode, companyId])

    // Subscribe to push notifications
    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported) {
            alert('Trình duyệt trên thiết bị này chưa hỗ trợ nhận thông báo đẩy. Bạn hãy mở trang web trên Chrome (Android) hoặc thêm vào màn hình chính trên iOS 16.4+ nhé!')
            return false
        }

        setLoading(true)
        try {
            const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!vapidKey) {
                console.error('VAPID public key is missing')
                return false
            }

            const perm = await Notification.requestPermission()
            setPermission(perm)

            if (perm !== 'granted') {
                return false
            }

            let reg = registration
            if (!reg) {
                reg = await navigator.serviceWorker.ready
            }

            const existingSub = await reg.pushManager.getSubscription()
            const sub = existingSub || await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(vapidKey),
            })

            // Save to database
            const res = await fetch('/api/notifications/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: sub.toJSON(),
                    user_id: userId,
                    user_name: userName || 'Nhân viên',
                    team_names: teamNames,
                    system_code: systemCode,
                    company_id: companyId,
                }),
            })

            if (!res.ok) throw new Error('Không thể lưu thông tin đăng ký nhận thông báo')

            setIsSubscribed(true)
            return true
        } catch (err: any) {
            console.error('Error subscribing to push:', err)
            return false
        } finally {
            setLoading(false)
        }
    }, [isSupported, registration, userId, userName, teamNames, systemCode, companyId])

    // Unsubscribe
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setLoading(true)
        try {
            if (!registration) return false
            const sub = await registration.pushManager.getSubscription()
            if (sub) {
                await fetch('/api/notifications/subscribe', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: sub.endpoint }),
                })
                await sub.unsubscribe()
            }
            setIsSubscribed(false)
            return true
        } catch (err) {
            console.error('Error unsubscribing:', err)
            return false
        } finally {
            setLoading(false)
        }
    }, [registration])

    // Sync App Badge counter on device icon
    const updateAppBadge = useCallback((count: number) => {
        if (typeof window === 'undefined') return

        if ('setAppBadge' in navigator) {
            if (count > 0) {
                navigator.setAppBadge(count).catch(() => {})
            } else {
                if ('clearAppBadge' in navigator) {
                    navigator.clearAppBadge().catch(() => {})
                }
            }
        }
    }, [])

    return {
        isSupported,
        permission,
        isSubscribed,
        loading,
        subscribe,
        unsubscribe,
        updateAppBadge,
    }
}
