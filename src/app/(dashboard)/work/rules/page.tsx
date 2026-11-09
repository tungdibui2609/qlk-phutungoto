'use client'

import React from 'react'
import KpiRulesHandbookTab from '@/components/work-plans/KpiRulesHandbookTab'
import { useSystem } from '@/contexts/SystemContext'
import Link from 'next/link'
import { ArrowLeft, ClipboardCheck } from 'lucide-react'

export default function WorkKpiRulesPage() {
    const { currentSystem } = useSystem()

    return (
        <div className="p-3 sm:p-5 md:p-6 max-w-7xl mx-auto space-y-5">
            {/* Navigation back bar */}
            <div className="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-stone-200 shadow-xs print:hidden">
                <Link
                    href="/work/plans"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-indigo-600 transition-colors"
                >
                    <ArrowLeft size={16} />
                    <span>Quay lại Quản lý Công việc & Kế hoạch Ca</span>
                </Link>

                <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                    <span>Phân hệ:</span>
                    <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        {currentSystem?.name || 'Kho Đông Lạnh'}
                    </span>
                </div>
            </div>

            {/* Cẩm Nang Quy Chế Chấm Điểm */}
            <KpiRulesHandbookTab systemName={currentSystem?.name || 'Kho Đông Lạnh'} />
        </div>
    )
}

