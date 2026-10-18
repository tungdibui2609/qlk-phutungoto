'use client'

import { useEffect } from 'react'

export default function SwRegister() {
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((registration) => {
                    // Pre-cache current scanner URL
                    if (window.caches) {
                        window.caches.open('chanhthu-scanner-cache-v2').then((cache) => {
                            cache.add(window.location.href).catch(() => {})
                        })
                    }
                })
                .catch((err) => {
                    console.warn('[PWA] Service Worker registration failed:', err)
                })
        }
    }, [])

    return null
}
