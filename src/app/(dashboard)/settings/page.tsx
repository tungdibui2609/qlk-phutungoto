'use client'
import { useState } from 'react'
import CompanyInfoSection from '@/components/settings/CompanyInfoSection'
import BranchManagerSection from '@/components/settings/BranchManagerSection'
import SystemManagerSection from '@/components/settings/SystemManagerSection'
import ProductConfigSection from '@/components/settings/ProductConfigSection'
import OrderConfigSection from '@/components/settings/OrderConfigSection'
import MenuManagerSection from '@/components/settings/MenuManagerSection'
import { Building2, Settings as SettingsIcon, Store, LayoutGrid, List, FileText } from 'lucide-react'

type Tab = 'company' | 'branches' | 'systems' | 'product_config' | 'order_config' | 'menus'

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('company')

    const tabs = [
        { id: 'company' as Tab, label: 'Thông tin công ty', icon: Building2 },
        { id: 'branches' as Tab, label: 'Quản lý Chi nhánh', icon: Store },
        { id: 'systems' as Tab, label: 'Phân hệ Kho', icon: LayoutGrid },

        { id: 'product_config' as Tab, label: 'Cấu hình sản phẩm', icon: SettingsIcon },
        { id: 'order_config' as Tab, label: 'Cấu hình phiếu', icon: FileText },
        { id: 'menus' as Tab, label: 'Menu Sidebar', icon: List },
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

                {activeTab === 'systems' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <SystemManagerSection />
                    </div>
                )}

                {activeTab === 'product_config' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <ProductConfigSection />
                    </div>
                )}

                {activeTab === 'order_config' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <OrderConfigSection />
                    </div>
                )}

                {activeTab === 'menus' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <MenuManagerSection />
                    </div>
                )}
            </div>
        </div>
    )
}
