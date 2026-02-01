'use client'

import { useState } from 'react'
import { Boxes, PackageCheck } from 'lucide-react'

export default function ExportScanPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-slate-50 dark:bg-slate-900">
            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mb-6 text-orange-500">
                <PackageCheck size={40} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Quét Xuất Kho (Đang phát triển)</h1>
            <p className="text-slate-500 max-w-md">
                Tính năng này cho phép quét mã LOT để tạo phiếu xuất kho nhanh chóng.
                <br />
                Đang được xây dựng...
            </p>
        </div>
    )
}
