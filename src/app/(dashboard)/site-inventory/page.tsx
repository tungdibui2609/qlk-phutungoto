'use client'

import React, { useState, useEffect } from 'react'
import { HardHat, History, Hammer } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { LoanDashboard } from './_components/LoanDashboard'
import { LoanHistory } from './_components/LoanHistory'

export default function SiteInventoryPage() {
    const { currentSystem } = useSystem()
    const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard')

    // Check if module is enabled
    const isModuleEnabled = () => {
        if (!currentSystem?.modules) return false
        const modules = typeof currentSystem.modules === 'string'
            ? JSON.parse(currentSystem.modules)
            : currentSystem.modules
        return Array.isArray(modules?.utility_modules) && modules.utility_modules.includes('site_inventory_manager')
    }

    if (!currentSystem) return null

    if (!isModuleEnabled()) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                    <HardHat size={40} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                    Cấp phát hàng hóa
                </h2>
                <p className="text-stone-500 max-w-md">
                    Tính năng "Cấp phát hàng hóa" chưa được bật cho kho này.
                    Vui lòng vào Cài đặt {'>'} Tiện ích hệ thống để kích hoạt.
                </p>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-100 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-3">
                        <HardHat className="text-orange-600" size={32} />
                        Cấp phát hàng hóa
                    </h1>
                    <p className="text-stone-500 dark:text-gray-400 mt-1">
                        Theo dõi mượn trả công cụ dụng cụ và cấp phát vật tư công trình.
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-6 border-b border-stone-200 dark:border-zinc-800">
                <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'dashboard'
                        ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <Hammer size={18} />
                    Sổ Mượn Đồ
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history'
                        ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <History size={18} />
                    Lịch sử Trả / Mất
                </button>
            </div>

            {/* Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'dashboard' && <LoanDashboard />}
                {activeTab === 'history' && <LoanHistory />}
            </div>
        </div>
    )
}
