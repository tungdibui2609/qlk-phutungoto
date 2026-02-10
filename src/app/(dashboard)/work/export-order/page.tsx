'use client'

import React from 'react'
import { FileText, Hammer } from 'lucide-react'

export default function ExportOrderPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-2xl border border-stone-200 shadow-sm m-6">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                <FileText size={40} className="text-orange-500" />
            </div>

            <h1 className="text-3xl font-bold text-stone-800 mb-4">Lệnh Xuất Kho</h1>

            <div className="bg-orange-50 px-4 py-2 rounded-full flex items-center gap-2 mb-6">
                <Hammer size={18} className="text-orange-600" />
                <span className="text-orange-700 font-semibold text-sm">Đang trong quá trình phát triển</span>
            </div>

            <p className="text-stone-500 max-w-md mx-auto leading-relaxed">
                Module lệnh xuất kho đang được xây dựng. Đây là nơi bạn sẽ quản lý, điều phối và theo dõi các lệnh xuất kho trong tương lai.
            </p>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                {[
                    { label: 'Tạo lệnh mới', icon: FileText },
                    { label: 'Phê duyệt lệnh', icon: Hammer },
                    { label: 'Lịch sử điều phối', icon: FileText }
                ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl border border-stone-100 bg-stone-50 text-stone-400 flex flex-col items-center gap-2 opacity-60">
                        <item.icon size={20} />
                        <span className="text-xs font-medium">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
