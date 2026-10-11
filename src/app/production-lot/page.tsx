'use client'

import { useEffect } from 'react'
import { Loader2, Boxes } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { useRouter } from 'next/navigation'
import MobileCreateLotTab from '@/app/mobile/_tabs/MobileCreateLotTab'

export default function ProductionLotPage() {
    const { profile, isLoading } = useUser()
    const { currentSystem, hasModule } = useSystem()
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

    if (currentSystem && !hasModule('qr_production_lot')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-6">
                    <Boxes size={40} className="text-stone-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">LOT Sản Xuất</h2>
                <p className="text-stone-500 max-w-md">Tính năng chưa được kích hoạt cho kho này. Vui lòng vào Cài đặt → Cấu hình Phân hệ để bật.</p>
            </div>
        )
    }

    return (
        <div className="mobile-content">
            <MobileCreateLotTab />
        </div>
    )
}
