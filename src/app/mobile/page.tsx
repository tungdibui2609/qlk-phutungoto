'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { Loader2 } from 'lucide-react'

export default function MobilePage() {
    const { profile, isLoading } = useUser()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading) {
            if (!profile) {
                router.push('/login')
            } else {
                router.replace('/mobile/work')
            }
        }
    }, [profile, isLoading, router])

    return (
        <div className="flex flex-col items-center justify-center p-20 min-h-[60vh] gap-4">
            <Loader2 size={32} className="animate-spin text-blue-600" />
            <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest">Đang khởi tạo...</p>
        </div>
    )
}
