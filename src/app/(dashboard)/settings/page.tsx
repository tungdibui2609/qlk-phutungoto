'use client'
import { useState } from 'react'
import { Building2, Settings as SettingsIcon, Store } from 'lucide-react'
import CompanyInfoSection from '@/components/settings/CompanyInfoSection'
import BranchManagerSection from '@/components/settings/BranchManagerSection'

type Tab = 'company' | 'branches'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('company')

    const tabs = [
        { id: 'company' as Tab, label: 'Thông tin công ty', icon: Building2 },
        { id: 'branches' as Tab, label: 'Quản lý Chi nhánh', icon: Store },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <SettingsIcon className="text-orange-500" />
                    Cài đặt hệ thống
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">
                    Quản lý thông tin công ty và cấu hình chi nhánh
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${isActive
                                ? 'border-orange-500 text-orange-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>

            {/* Content */}
            <div className="min-h-[500px]">
                {activeTab === 'company' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300">
                        <CompanyInfoSection />
                    </div>
                )}

                {activeTab === 'branches' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <BranchManagerSection />
                    </div>
                )}
            </div>
        </div>
    )
}
