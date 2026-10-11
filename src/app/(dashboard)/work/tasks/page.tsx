'use client'

import React from 'react'
import ShiftTasksView from '@/components/tasks/ShiftTasksView'
import TaskErrorBoundary from '@/components/tasks/TaskErrorBoundary'
import { useSystem } from '@/contexts/SystemContext'
import { Lock } from 'lucide-react'
import Link from 'next/link'

export default function WorkTasksPage() {
    const { hasModule } = useSystem()

    if (!hasModule('shift_tasks')) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4 border border-amber-200">
                    <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">Tính năng Sổ Giao Việc đang tắt</h2>
                <p className="text-stone-500 text-sm max-w-md mb-6 leading-relaxed">
                    Module "Sổ Giao Việc & Nhắc Nhở Bàn Giao" chưa được kích hoạt cho kho này. Vui lòng bật module trong Cài đặt hệ thống để sử dụng.
                </p>
                <Link
                    href="/settings?tab=system_config"
                    className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
                >
                    Đi đến Cài đặt Phân hệ
                </Link>
            </div>
        )
    }

    return (
        <TaskErrorBoundary>
            <ShiftTasksView isSanxuat={false} />
        </TaskErrorBoundary>
    )
}
