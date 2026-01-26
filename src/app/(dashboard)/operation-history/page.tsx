'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { getGlobalAuditLogs } from '@/lib/audit'
import { supabase } from '@/lib/supabaseClient'
import HistoryCard from '@/components/history/HistoryCard'
import { RefreshCw, Calendar as CalendarIcon, Tag, Box, CheckSquare, Clock } from 'lucide-react'

export default function OperationHistoryPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getGlobalAuditLogs(supabase, 200)
            setLogs(data)
            setLastUpdated(new Date())
        } catch (error) {
            console.error('Failed to fetch logs', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    useEffect(() => {
        if (!autoRefresh) return
        const interval = setInterval(fetchLogs, 60000)
        return () => clearInterval(interval)
    }, [autoRefresh, fetchLogs])

    const groups = {
        importExport: logs.filter(l => ['inbound_orders', 'outbound_orders'].includes(l.table_name)),
        lots: logs.filter(l => ['lots', 'lot_items'].includes(l.table_name)),
        warehouse: logs.filter(l => ['positions', 'locations', 'warehouses'].includes(l.table_name)),
        others: logs.filter(l => !['inbound_orders', 'outbound_orders', 'lots', 'lot_items', 'positions', 'locations', 'warehouses'].includes(l.table_name))
    }

    return (
        <div className="p-4 md:p-6 h-[calc(100vh-64px)] flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-stone-100">
                <div>
                    <h1 className="text-xl font-bold text-stone-800 flex items-center gap-2">
                        <Clock className="text-green-600" />
                        Lịch sử thao tác - Theo dõi đồng thời
                    </h1>
                    <p className="text-sm text-stone-500 mt-1">
                        Tổng {logs.length} thao tác • Cập nhật lúc {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button className="hidden md:flex items-center gap-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100">
                        <CalendarIcon size={16} />
                        <span>Hôm nay</span>
                    </button>

                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                        <span>Làm mới</span>
                    </button>

                     <button
                        onClick={() => setAutoRefresh(!autoRefresh)}
                        className={`hidden md:flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                            autoRefresh
                                ? 'bg-orange-50 text-orange-700 border-orange-200'
                                : 'bg-stone-50 text-stone-600 border-stone-200'
                        }`}
                    >
                        <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-orange-500 animate-pulse' : 'bg-stone-300'}`} />
                        <span>Auto (1 phút)</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full min-w-[300px] md:min-w-0">
                    <Column
                        title="Nhập/Xuất tạm"
                        count={groups.importExport.length}
                        color="blue"
                        icon={<RefreshCw size={18} className="text-blue-600" />}
                    >
                        {groups.importExport.map(log => <HistoryCard key={log.id} log={log} />)}
                    </Column>

                    <Column
                        title="LOT (Nhập/Xuất)"
                        count={groups.lots.length}
                        color="orange"
                        icon={<Tag size={18} className="text-orange-600" />}
                    >
                         {groups.lots.map(log => <HistoryCard key={log.id} log={log} />)}
                    </Column>

                    <Column
                        title="Thao tác trong kho"
                        count={groups.warehouse.length}
                        color="amber"
                        icon={<Box size={18} className="text-amber-600" />}
                    >
                         {groups.warehouse.map(log => <HistoryCard key={log.id} log={log} />)}
                    </Column>

                    <Column
                        title="Công việc / Khác"
                        count={groups.others.length}
                        color="stone"
                        icon={<CheckSquare size={18} className="text-stone-600" />}
                    >
                         {groups.others.map(log => <HistoryCard key={log.id} log={log} />)}
                    </Column>
                </div>
            </div>
        </div>
    )
}

function Column({ title, count, children, color = 'blue', icon }: { title: string, count: number, children: React.ReactNode, color?: string, icon?: React.ReactNode }) {
    return (
        <div className="flex flex-col h-full bg-stone-50/50 rounded-xl border border-stone-200/60 overflow-hidden">
            <div className="p-3 border-b border-stone-100 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="font-bold text-stone-700 text-sm md:text-base">{title}</h3>
                </div>
                <span className="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full text-xs font-bold">
                    {count}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-stone-200 scrollbar-track-transparent">
                {children}
                {React.Children.count(children) === 0 && (
                     <div className="flex flex-col items-center justify-center h-40 text-stone-400 text-sm italic">
                        <span>Chưa có dữ liệu</span>
                     </div>
                )}
            </div>
        </div>
    )
}
