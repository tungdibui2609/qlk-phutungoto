'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import CompanyInfoSection from '@/components/settings/CompanyInfoSection'
import BranchManagerSection from '@/components/settings/BranchManagerSection'
import SystemManagerSection from '@/components/settings/SystemManagerSection'
import MenuManagerSection from '@/components/settings/MenuManagerSection'
import OperationModelSection from '@/components/settings/OperationModelSection'
import UnifiedSystemConfig from '@/components/settings/UnifiedSystemConfig'
import {
    Building2,
    Settings as SettingsIcon,
    Store,
    LayoutGrid,
    List,
    ArrowLeft,
    Sparkles,
    Cpu
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'company' | 'operation_model' | 'branches' | 'systems' | 'system_config' | 'menus'

export default function SettingsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const tabs = [
        { id: 'company' as Tab, label: 'Thông tin công ty', icon: Building2 },
        { id: 'operation_model' as Tab, label: 'Mô hình Vận hành', icon: Sparkles },
        { id: 'branches' as Tab, label: 'Quản lý Chi nhánh', icon: Store },
        { id: 'systems' as Tab, label: 'Danh sách Kho', icon: LayoutGrid },
        { id: 'system_config' as Tab, label: 'Cấu hình Phân hệ', icon: Cpu },
        { id: 'menus' as Tab, label: 'Menu Sidebar', icon: List },
    ]

    // Determine active tab from URL or default to 'company'
    const tabParam = searchParams.get('tab') as Tab
    const activeTab = tabParam && tabs.some(t => t.id === tabParam) ? tabParam : 'company'

    const handleTabChange = (tabId: Tab) => {
        router.push(`/settings?tab=${tabId}`)
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Sidebar Menu */}
            <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm z-10">
                {/* Logo / Header Area */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors mb-4 text-sm font-medium"
                    >
                        <ArrowLeft size={16} />
                        Quay lại Dashboard
                    </button>
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-500">
                        <SettingsIcon size={24} className="animate-spin-slow" />
                        <h1 className="font-bold text-lg tracking-tight">Cài Đặt Hệ Thống</h1>
                    </div>
                </div>

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 shadow-sm"
                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200"
                                )}
                            >
                                <Icon size={18} className={cn(isActive ? "text-orange-600 dark:text-orange-400" : "text-gray-400 dark:text-gray-500")} />
                                {tab.label}
                            </button>
                        )
                    })}
                </nav>

                {/* Footer Area - Removed */}

            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    {activeTab !== 'system_config' && (
                        <header className="mb-8 pl-1">
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {tabs.find(t => t.id === activeTab)?.label}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">
                                Quản lý các thiết lập cho {tabs.find(t => t.id === activeTab)?.label.toLowerCase()}
                            </p>
                        </header>
                    )}

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                        {activeTab === 'company' && <CompanyInfoSection />}
                        {activeTab === 'operation_model' && <OperationModelSection />}
                        {activeTab === 'branches' && <BranchManagerSection />}
                        {activeTab === 'systems' && <SystemManagerSection />}
                        {activeTab === 'system_config' && <UnifiedSystemConfig />}
                        {activeTab === 'menus' && <MenuManagerSection />}
                    </div>
                </div>
            </div>
        </div>
    )
}
