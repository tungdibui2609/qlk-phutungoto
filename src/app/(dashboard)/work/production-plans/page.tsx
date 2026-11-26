'use client'

import React from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import ProductionPlansView from '@/components/production-plans/ProductionPlansView'

export default function WarehouseProductionPlansPage() {
    const { hasModule } = useSystem()

    // BẢO TOÀN TUYỆT ĐỐI PHÂN HỆ KHO ĐÔNG & KIẾN TRÚC MODULAR-FIRST:
    // Chỉ hiển thị và kích hoạt khi phân hệ kho hiện hành đã bật module 'production_plan'
    if (!hasModule('production_plan')) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-orange-50 dark:bg-orange-950/30 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400 mb-4 border border-orange-200 dark:border-orange-800">
                    <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold text-stone-800 dark:text-zinc-100 mb-2">
                    Module &ldquo;Kế hoạch Sản xuất & Quyết toán&rdquo; đang tắt
                </h2>
                <p className="text-stone-500 dark:text-zinc-400 text-sm max-w-md mb-6 leading-relaxed">
                    Tính năng quản lý kế hoạch lấy hàng tồn kho đi sản xuất/gia công lại, soạn giữ LOT theo FIFO và quyết toán cân bằng vật tư - hao hụt chưa được bật cho phân hệ kho này.
                </p>
                <Link
                    href="/settings?tab=system_config"
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
                >
                    Đi đến Cài đặt Phân hệ để bật Module
                </Link>
            </div>
        )
    }

    return <ProductionPlansView isSanxuatPortal={false} />
}
