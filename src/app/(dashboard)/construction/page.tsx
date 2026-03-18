'use client'

import React, { useState, useEffect } from 'react'
import {
    Construction,
    TrendingUp,
    AlertTriangle,
    Clock,
    Package,
    ClipboardCheck,
    LayoutDashboard,
    ArrowUpFromLine,
    ArrowDownToLine
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { loanService } from '@/services/site-inventory/loanService'
import { projectService } from '@/services/site-inventory/projectService'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

export default function ConstructionDashboard() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        activeProjects: 0,
        activeLoans: 0,
        pendingTasks: 0,
        totalIssuedItems: 0
    })
    const [activities, setActivities] = useState<any[]>([])

    useEffect(() => {
        if (!systemType) return
        fetchData()
    }, [systemType])

    async function fetchData() {
        setLoading(true)
        try {
            const [pStats, lStats, recentActivities] = await Promise.all([
                projectService.getProjectStats(supabase, systemType),
                loanService.getLoanStats(supabase, systemType),
                loanService.getRecentActivities(supabase, systemType, 6)
            ])

            setStats({
                activeProjects: pStats.activeProjects,
                activeLoans: lStats.activeLoans,
                pendingTasks: pStats.pendingTasks,
                totalIssuedItems: lStats.totalIssuedItems
            })
            setActivities(recentActivities || [])
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const statCards = [
        {
            title: 'Công trình thực hiện',
            value: stats.activeProjects,
            icon: Construction,
            color: 'bg-blue-100 text-blue-600',
            loading: loading
        },
        {
            title: 'Lượt mượn hoạt động',
            value: stats.activeLoans,
            icon: ClipboardCheck,
            color: 'bg-orange-100 text-orange-600',
            loading: loading
        },
        {
            title: 'Nhiệm vụ cần làm',
            value: stats.pendingTasks,
            icon: AlertTriangle,
            color: 'bg-red-100 text-red-600',
            loading: loading
        },
        {
            title: 'Vật tư cấp phát',
            value: stats.totalIssuedItems,
            icon: Package,
            color: 'bg-purple-100 text-purple-600',
            loading: loading
        }
    ]

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card, i) => (
                    <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-[24px] border border-stone-100 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-2 ${card.color} rounded-xl`}>
                                <card.icon size={20} />
                            </div>
                        </div>
                        {card.loading ? (
                            <div className="h-8 w-16 bg-stone-100 dark:bg-zinc-800 animate-pulse rounded mb-1"></div>
                        ) : (
                            <h3 className="text-3xl font-bold text-stone-900 dark:text-white mb-1 tracking-tight">
                                {card.value.toLocaleString()}
                            </h3>
                        )}
                        <p className="text-sm font-medium text-stone-500 dark:text-zinc-400">{card.title}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-[32px] border border-stone-100 dark:border-zinc-800 p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-stone-900 dark:text-white flex items-center gap-2">
                            Tiến độ cấp phát vật tư
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-wider">
                            Real-time data
                        </div>
                    </div>
                    <div className="h-64 flex flex-col items-center justify-center bg-stone-50 dark:bg-zinc-950/50 rounded-2xl border border-dashed border-stone-200 dark:border-zinc-800 text-stone-400">
                        <TrendingUp size={48} className="mb-4 opacity-20" />
                        <p className="font-medium">Biểu đồ đang được cập nhật dữ liệu...</p>
                        <p className="text-xs mt-1">Dữ liệu sẽ hiển thị khi có đủ lịch sử mượn trả</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-stone-100 dark:border-zinc-800 p-8 shadow-sm flex flex-col">
                    <h3 className="text-xl font-bold text-stone-900 dark:text-white mb-6">Hoạt động gần đây</h3>
                    <div className="space-y-6 flex-1">
                        {loading ? (
                            [1, 2, 3, 4].map(i => (
                                <div key={i} className="flex gap-4 animate-pulse">
                                    <div className="w-10 h-10 rounded-full bg-stone-100 dark:bg-zinc-800"></div>
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-stone-100 dark:bg-zinc-800 rounded w-3/4"></div>
                                        <div className="h-3 bg-stone-100 dark:bg-zinc-800 rounded w-1/2"></div>
                                    </div>
                                </div>
                            ))
                        ) : activities.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center py-12">
                                <Clock size={40} className="text-stone-300 mb-3" />
                                <p className="text-stone-500 font-medium">Chưa có hoạt động nào</p>
                                <p className="text-xs text-stone-400 mt-1">Các lượt mượn trả sẽ xuất hiện tại đây</p>
                            </div>
                        ) : (
                            activities.map((activity, i) => (
                                <div key={activity.id} className="relative flex gap-4 group">
                                    {i !== activities.length - 1 && (
                                        <div className="absolute left-5 top-10 bottom-0 w-px bg-stone-100 dark:bg-zinc-800 -mb-6"></div>
                                    )}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                                        activity.status === 'active' 
                                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' 
                                        : 'bg-green-50 text-green-600 dark:bg-green-900/20'
                                    }`}>
                                        {activity.status === 'active' ? <ArrowUpFromLine size={18} /> : <ArrowDownToLine size={18} />}
                                    </div>
                                    <div className="flex-1 pb-2">
                                        <p className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                                            {activity.status === 'active' ? 'Cấp phát' : 'Thu hồi'} {activity.products?.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 text-stone-500 dark:text-zinc-400">
                                                {activity.quantity} {activity.unit}
                                            </span>
                                            <span className="text-xs text-stone-400">•</span>
                                            <span className="text-xs text-stone-500 dark:text-zinc-400">
                                                {activity.worker_name}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-stone-400 mt-1 uppercase font-bold tracking-wider">
                                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: vi })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
