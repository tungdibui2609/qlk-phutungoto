'use client'

import MobileLotLabelsTab from '../_tabs/MobileLotLabelsTab'
import { useSystem } from '@/contexts/SystemContext'
import { Smartphone } from 'lucide-react'

export default function MobileLotLabelsPage() {
    const { currentSystem, hasModule } = useSystem()

    if (currentSystem && !hasModule('qr_lot_labels_mobile')) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-6">
                    <Smartphone size={40} className="text-stone-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">Liên kết Tem (Mobile)</h2>
                <p className="text-stone-500 max-w-md">Tính năng chưa được kích hoạt cho kho này. Vui lòng vào Cài đặt → Cấu hình Phân hệ để bật.</p>
            </div>
        )
    }

    return <MobileLotLabelsTab />
}
