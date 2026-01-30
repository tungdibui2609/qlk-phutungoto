'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    LayoutDashboard,
    Users,
    Package,
    BarChart3,
    Construction,
    Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function ConstructionLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()

    const tabs = [
        { name: 'Tổng quan', href: '/construction', icon: LayoutDashboard, exact: true },
        { name: 'Thành viên & Đội nhóm', href: '/construction/members', icon: Users },
        { name: 'Kho Công Trình', href: '/construction/inventory', icon: Package },
        { name: 'Báo cáo', href: '/construction/reports', icon: BarChart3 },
    ]

    return (
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
            {/* Module Header */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-10">
                <div className="px-6 py-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-600 rounded-lg text-white">
                            <Construction size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                                Quản Lý Công Trình
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Phân hệ quản lý vật tư, thiết bị và nhân sự công trình
                            </p>
                        </div>
                    </div>

                    {/* Sub Navigation */}
                    <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {tabs.map((tab) => {
                            const Icon = tab.icon
                            const isActive = tab.exact
                                ? pathname === tab.href
                                : pathname?.startsWith(tab.href)

                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                                        isActive
                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900"
                                    )}
                                >
                                    <Icon size={16} />
                                    {tab.name}
                                </Link>
                            )
                        })}
                    </nav>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto">
                {children}
            </div>
        </div>
    )
}
