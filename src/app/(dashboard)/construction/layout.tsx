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

                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto">
                {children}
            </div>
        </div>
    )
}
