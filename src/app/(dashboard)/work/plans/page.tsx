'use client'

import React from 'react'
import WorkPlansView from '@/components/work-plans/WorkPlansView'
import TaskErrorBoundary from '@/components/tasks/TaskErrorBoundary'
import { useSystem } from '@/contexts/SystemContext'
import { Lock } from 'lucide-react'
import Link from 'next/link'

export default function WorkPlansPage() {
    const { hasModule } = useSystem()

    if (!hasModule('work_plan')) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 border border-indigo-200">
                    <Lock size={32} />
                </div>
                <h2 className="text-xl font-bold text-stone-800 mb-2">
                    Tính năng Kế Hoạch Công Việc & Đánh Giá đang tắt
                </h2>
                <p className="text-stone-500 text-sm max-w-md mb-6 leading-relaxed">
                    Module &ldquo;Kế hoạch Công việc & Đánh giá&rdquo; chưa được kích hoạt cho phân hệ kho này. Vui lòng bật module trong Cài đặt hệ thống để sử dụng.
                </p>
                <Link
                    href="/settings?tab=system_config"
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
                >
                    Đi đến Cài đặt Phân hệ
                </Link>
            </div>
        )
    }

    return (
        <TaskErrorBoundary>
            <WorkPlansView />
        </TaskErrorBoundary>
    )
}

