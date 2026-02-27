'use client'

import { useState, useEffect } from 'react'
import { Briefcase, Package, LayoutGrid, UploadCloud, Settings, Loader2 } from 'lucide-react'
import { useUser } from '@/contexts/UserContext'
import { useRouter } from 'next/navigation'

import MobileWorkTab from './_tabs/MobileWorkTab'
import MobileAssignTab from './_tabs/MobileAssignTab'
import MobileWarehouseTab from './_tabs/MobileWarehouseTab'
import MobileExportTab from './_tabs/MobileExportTab'
import MobileSettingsTab from './_tabs/MobileSettingsTab'

type TabId = 'work' | 'assign' | 'warehouse' | 'export' | 'settings'

interface TabConfig {
    id: TabId
    label: string
    icon: typeof Briefcase
    activeColor: string
}

const TABS: TabConfig[] = [
    { id: 'work', label: 'Công Việc', icon: Briefcase, activeColor: '#2563eb' },
    { id: 'assign', label: 'Gán Vị Trí', icon: Package, activeColor: '#059669' },
    { id: 'warehouse', label: 'Kho', icon: LayoutGrid, activeColor: '#d97706' },
    { id: 'export', label: 'Xuất Kho', icon: UploadCloud, activeColor: '#e11d48' },
    { id: 'settings', label: 'Cài Đặt', icon: Settings, activeColor: '#27272a' },
]

export default function MobilePage() {
    const { profile, isLoading } = useUser()
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<TabId>('work')

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !profile) {
            router.push('/login')
        }
    }, [profile, isLoading, router])

    if (isLoading) {
        return (
            <div className="mobile-app" style={{ justifyContent: 'center', alignItems: 'center' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#2563eb' }} />
                <p style={{ color: '#a1a1aa', marginTop: 12, fontWeight: 600, fontSize: 14 }}>Đang tải...</p>
            </div>
        )
    }

    return (
        <>
            {/* Main Content */}
            <div className="mobile-content">
                {activeTab === 'work' && <MobileWorkTab />}
                {activeTab === 'assign' && <MobileAssignTab />}
                {activeTab === 'warehouse' && <MobileWarehouseTab />}
                {activeTab === 'export' && <MobileExportTab />}
                {activeTab === 'settings' && <MobileSettingsTab />}
            </div>

            {/* Bottom Tab Bar */}
            <nav className="mobile-tab-bar">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id
                    const Icon = tab.icon
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`mobile-tab-item ${isActive ? 'mobile-tab-item--active' : 'mobile-tab-item--inactive'}`}
                        >
                            <span className="mobile-tab-icon" style={isActive ? { color: tab.activeColor } : undefined}>
                                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                            </span>
                            <span className="mobile-tab-label" style={isActive ? { color: tab.activeColor } : undefined}>
                                {tab.label}
                            </span>
                        </button>
                    )
                })}
            </nav>
        </>
    )
}
