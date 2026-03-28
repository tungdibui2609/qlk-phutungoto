'use client'

import React from 'react'
import { Briefcase, Package, LayoutGrid, UploadCloud, Settings, PlusSquare } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
    { id: 'work', label: 'Công Việc', icon: Briefcase, activeColor: '#2563eb', href: '/mobile/work' },
    { id: 'create-lot', label: 'LOT', icon: PlusSquare, activeColor: '#84cc16', href: '/mobile/create-lot' },
    { id: 'assign', label: 'Gán Vị Trí', icon: Package, activeColor: '#059669', href: '/mobile/assign' },
    { id: 'warehouse', label: 'Kho', icon: LayoutGrid, activeColor: '#d97706', href: '/mobile/warehouse' },
    { id: 'export', label: 'Xuất Kho', icon: UploadCloud, activeColor: '#e11d48', href: '/mobile/export' },
    { id: 'settings', label: 'Cài Đặt', icon: Settings, activeColor: '#27272a', href: '/mobile/settings' },
]

export default function MobileBottomNav() {
    const pathname = usePathname()

    return (
        <nav className="mobile-tab-bar">
            {TABS.map(tab => {
                const isActive = pathname === tab.href || (tab.id === 'work' && pathname === '/mobile')
                const Icon = tab.icon
                return (
                    <Link
                        key={tab.id}
                        href={tab.href}
                        className={`mobile-tab-item ${isActive ? 'mobile-tab-item--active' : 'mobile-tab-item--inactive'}`}
                    >
                        <span className="mobile-tab-icon" style={isActive ? { color: tab.activeColor } : undefined}>
                            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                        </span>
                        <span className="mobile-tab-label" style={isActive ? { color: tab.activeColor } : undefined}>
                            {tab.label}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
