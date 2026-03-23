'use client'

import React, { useState, useEffect } from 'react'
import { Factory, History, Hammer, Plus, BarChart3, Truck } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { LoanDashboard } from './_components/LoanDashboard'
import { LoanHistory } from './_components/LoanHistory'
import { SiteDirectInboundModal } from './_components/SiteDirectInboundModal'
import { SiteStockReport } from './_components/SiteStockReport'
import { SiteInboundHistory } from './_components/SiteInboundHistory'

export default function ProductionInventoryPage() {
    const { currentSystem } = useSystem()
    const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'inbound' | 'summary'>('dashboard')
    const [isInboundOpen, setIsInboundOpen] = useState(false)

    // Check if module is enabled
    const isModuleEnabled = () => {
        if (!currentSystem?.modules) return false
        const modules = typeof currentSystem.modules === 'string'
            ? JSON.parse(currentSystem.modules)
            : currentSystem.modules
        return Array.isArray(modules?.utility_modules) && modules.utility_modules.includes('production_inventory_manager')
    }

    if (!currentSystem) return null

    if (!isModuleEnabled()) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6">
                    <Factory size={40} className="text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">
                    Cấp phát sản xuất
                </h2>
                <p className="text-stone-500 max-w-md">
                    Tính năng "Cấp phát sản xuất" chưa được bật cho kho này.
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
                        <Factory className="text-blue-600" size={32} />
                        Cấp phát sản xuất
                    </h1>
                    <p className="text-stone-500 dark:text-gray-400 mt-1">
                        Theo dõi việc cấp phát vật tư/linh kiện cho sản xuất.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsInboundOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    >
                        <Plus size={20} />
                        Nhập hàng trực tiếp
                    </button>
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
                    Sổ Cấp Phát
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'history'
                        ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <History size={18} />
                    Lịch sử Cấp phát
                </button>
                <button
                    onClick={() => setActiveTab('inbound')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'inbound'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <Truck size={18} />
                    Lịch sử Nhập hàng
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'summary'
                        ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                        : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
                        }`}
                >
                    <BarChart3 size={18} />
                    Tồn kho Tổng hợp
                </button>
            </div>

            {/* Content */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'dashboard' && (
                    <LoanDashboard 
                        isInboundOpen={isInboundOpen} 
                        setIsInboundOpen={setIsInboundOpen} 
                    />
                )}
                {activeTab === 'history' && <LoanHistory />}
                {activeTab === 'inbound' && <SiteInboundHistory />}
                {activeTab === 'summary' && <SiteStockReport />}
            </div>

            <SiteDirectInboundModal 
                isOpen={isInboundOpen} 
                onClose={() => setIsInboundOpen(false)} 
                onSuccess={() => {
                    // Refresh dashboard if needed
                    window.location.reload()
                }}
            />
        </div>
    )
}
