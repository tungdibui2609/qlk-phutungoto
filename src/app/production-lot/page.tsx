'use client'

import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'
import MobileCreateLotTab from '@/app/mobile/_tabs/MobileCreateLotTab'

export default function ProductionLotPage() {
    const { profile, isLoading } = useUser()
    const router = useRouter()

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !profile) {
            router.push('/login')
        }
    }, [profile, isLoading, router])

    if (isLoading) {
        return (
            <div className="mobile-app" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
                <p style={{ color: '#a1a1aa', marginTop: 12, fontWeight: 600, fontSize: 14 }}>Đang tải...</p>
            </div>
        )
    }

    return (
        <div className="mobile-content">
            <MobileCreateLotTab />
        </div>
    )
}
