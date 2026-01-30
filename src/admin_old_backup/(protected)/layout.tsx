'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { Loader2, ShieldAlert } from 'lucide-react'

const SUPER_ADMIN_EMAIL = 'tungdibui2609@gmail.com'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { profile, user, isLoading } = useUser()
    const router = useRouter()
    const [isAuthorized, setIsAuthorized] = useState(false)
    const [isChecking, setIsChecking] = useState(true)


    useEffect(() => {
        // If still loading UserContext, wait.
        if (isLoading) return

        const email = user?.email || profile?.email

        if (!email) {
            // No user found, should have been caught by middleware, but enforce here
            router.push('/admin')
            return
        }

        const isSuperAdmin = email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()

        if (isSuperAdmin) {
            setIsAuthorized(true)
        } else {
            setIsAuthorized(false)
        }

        setIsChecking(false)

    }, [user, profile, isLoading, router])

    if (isLoading || isChecking) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-stone-50 dark:bg-zinc-900">
                <Loader2 className="animate-spin text-orange-600" size={48} />
                <p className="text-stone-500 animate-pulse">Verifying Access...</p>
            </div>
        )
    }

    if (!isAuthorized) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-stone-900 text-white p-4 text-center">
                <ShieldAlert className="text-red-500" size={64} />
                <h1 className="text-2xl font-bold">Access Denied</h1>
                <p className="text-stone-400">Your account does not have Super Admin privileges.</p>
                <div className="flex gap-4 mt-6">
                    <button
                        onClick={() => router.push('/')}
                        className="px-6 py-2 bg-stone-700 rounded-lg hover:bg-stone-600 transition-colors"
                    >
                        Go Home
                    </button>
                    <button
                        onClick={() => router.push('/admin')}
                        className="px-6 py-2 bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors"
                    >
                        Re-Login
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-900 pb-20">
            <header className="bg-white dark:bg-zinc-900 border-b border-stone-200 dark:border-zinc-800 px-8 py-4 sticky top-0 z-30 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-2">
                        <ShieldAlert className="text-orange-600" />
                        Super Admin Console
                    </h1>
                    <p className="text-xs text-stone-500">Authorized: {user?.email}</p>
                </div>
                <button
                    onClick={() => router.push('/')}
                    className="text-sm text-stone-500 hover:text-stone-800"
                >
                    Back to App
                </button>
            </header>
            <main className="max-w-7xl mx-auto p-6">
                {children}
            </main>
        </div>
    )
}
