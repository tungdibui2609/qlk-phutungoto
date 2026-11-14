'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { format, subDays, parseISO } from 'date-fns'
import {
    Activity, Calendar, Search, Filter, RefreshCw, Download,
    TrendingUp, TrendingDown, ArrowUpRight, Trash2, MapPin,
    PlusCircle, MinusCircle, ArrowRightLeft, User, Loader2,
    ChevronDown, ChevronUp, Package, Boxes
} from 'lucide-react'
import {
    fetchDailyFluctuation,
    buildProductSummaries,
    FluctuationEvent,
    FluctuationCategory,
    FluctuationPerformer,
    formatLotSttLabel
} from '@/lib/lotDailyFluctuation'
import { exportDailyFluctuationToExcel } from '@/lib/lotDailyFluctuationExcelExport'

type QuickPreset = 'today' | 'yesterday' | '7days' | 'single_day' | 'range'

const CATEGORY_META: Record<FluctuationCategory, { label: string; badgeClass: string; icon: React.ReactNode }> = {
    create: {
        label: 'Tạo LOT mới',
        badgeClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        icon: <Boxes size={12} />
    },
    adjust_up: {
        label: 'Bỏ thêm / Tăng SL',
        badgeClass: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
        icon: <PlusCircle size={12} />
    },
    adjust_down: {
        label: 'Bớt ra / Giảm SL',
        badgeClass: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        icon: <MinusCircle size={12} />
    },
    adjust_mixed: {
        label: 'Điều chỉnh hỗn hợp',
        badgeClass: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
        icon: <ArrowRightLeft size={12} />
    },
    export: {
        label: 'Đã xuất bán',
        badgeClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        icon: <ArrowUpRight size={12} />
    },
    delete: {
        label: 'Đã xóa LOT',
        badgeClass: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        icon: <Trash2 size={12} />
    },
    position_assign: {
        label: 'Xếp vào vị trí',
        badgeClass: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        icon: <MapPin size={12} />
    },
    position_unassign: {
        label: 'Gỡ khỏi vị trí',
        badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        icon: <MapPin size={12} />
    },
    position_replace: {
        label: 'Đổi LOT tại vị trí',
        badgeClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        icon: <ArrowRightLeft size={12} />
    },
    edit_info: {
        label: 'Cập nhật thông tin',
        badgeClass: 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-slate-700',
        icon: <Activity size={12} />
    }
}

function formatQty(val: number): string {
    if (Math.abs(val) < 0.000001) return '0'
    return Number(val.toFixed(3)).toLocaleString('vi-VN')
}

export function LotDailyFluctuationView() {
    const { systemType, currentSystem } = useSystem()
    const { showToast } = useToast()

    const [preset, setPreset] = useState<QuickPreset>('today')
    const [dateFrom, setDateFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [dateTo, setDateTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))

    const [loading, setLoading] = useState(true)
    const [isExporting, setIsExporting] = useState(false)
    const [events, setEvents] = useState<FluctuationEvent[]>([])
    const [performers, setPerformers] = useState<FluctuationPerformer[]>([])

    // Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [performerFilter, setPerformerFilter] = useState<string>('all')
    const [showSummaryTable, setShowSummaryTable] = useState(true)

    const loadData = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        try {
            const res = await fetchDailyFluctuation({
                supabase,
                systemCode: systemType,
                dateFrom,
                dateTo
            })
            setEvents(res.events)
            setPerformers(res.performers)
        } catch (err: any) {
            console.error('Error loading daily fluctuation:', err)
            showToast('Lỗi khi tải biến động hàng hóa: ' + (err.message || 'Thử lại sau'), 'error')
        } finally {
            setLoading(false)
        }
    }, [systemType, dateFrom, dateTo, showToast])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handlePreset = (nextPreset: QuickPreset) => {
        setPreset(nextPreset)
        const todayStr = format(new Date(), 'yyyy-MM-dd')
        if (nextPreset === 'today') {
            setDateFrom(todayStr)
            setDateTo(todayStr)
        } else if (nextPreset === 'yesterday') {
            const yStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
            setDateFrom(yStr)
            setDateTo(yStr)
        } else if (nextPreset === '7days') {
            setDateFrom(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
            setDateTo(todayStr)
        } else if (nextPreset === 'single_day') {
            setDateTo(dateFrom)
        }
    }

    const filteredEvents = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        return events.filter(ev => {
            if (categoryFilter === 'increase') {
                if (!['create', 'adjust_up'].includes(ev.category)) return false
            } else if (categoryFilter === 'decrease') {
                if (!['adjust_down', 'export', 'delete'].includes(ev.category)) return false
            } else if (categoryFilter === 'position') {
                if (!['position_assign', 'position_unassign', 'position_replace'].includes(ev.category)) return false
            } else if (categoryFilter !== 'all') {
                if (ev.category !== categoryFilter) return false
            }

            if (performerFilter !== 'all') {
                if (performerFilter === 'system') {
                    if (ev.performedBy !== null) return false
                } else if (ev.performedBy?.id !== performerFilter) {
                    return false
                }
            }

            if (!q) return true

            const stt = formatLotSttLabel(ev.dailySeq)?.toLowerCase() || ''
            const matchLot = ev.lotCode.toLowerCase().includes(q) || stt.includes(q)
            const matchPos = ev.positions.some(p => p.toLowerCase().includes(q))
            const matchDesc = ev.description.toLowerCase().includes(q) || ev.title.toLowerCase().includes(q)
            const matchProd = ev.deltas.some(
                d => d.name.toLowerCase().includes(q) || d.sku.toLowerCase().includes(q)
            )
            return matchLot || matchPos || matchDesc || matchProd
        })
    }, [events, categoryFilter, performerFilter, searchTerm])

    const filteredSummaries = useMemo(() => {
        return buildProductSummaries(filteredEvents)
    }, [filteredEvents])

    const kpiStats = useMemo(() => {
        let upCount = 0
        let downCount = 0
        let posCount = 0
        const touchedPositions = new Set<string>()
        const touchedUsers = new Set<string>()

        for (const ev of filteredEvents) {
            if (ev.category === 'create' || ev.category === 'adjust_up') upCount++
            if (ev.category === 'adjust_down' || ev.category === 'export' || ev.category === 'delete') downCount++
            if (ev.category === 'adjust_mixed') {
                upCount++
                downCount++
            }
            if (['position_assign', 'position_unassign', 'position_replace'].includes(ev.category)) posCount++
            ev.positions.forEach(p => touchedPositions.add(p))
            if (ev.performedBy?.id) touchedUsers.add(ev.performedBy.id)
        }

        return {
            totalEvents: filteredEvents.length,
            upCount,
            downCount,
            posCount,
            touchedPositionsCount: touchedPositions.size,
            touchedUsersCount: touchedUsers.size
        }
    }, [filteredEvents])

    const handleExportExcel = async () => {
        if (filteredEvents.length === 0 && filteredSummaries.length === 0) {
            showToast('Không có dữ liệu biến động để xuất Excel', 'warning')
            return
        }
        setIsExporting(true)
        try {
            const rangeStr = dateFrom === dateTo
                ? format(parseISO(dateFrom), 'dd/MM/yyyy')
                : `${format(parseISO(dateFrom), 'dd/MM/yyyy')} - ${format(parseISO(dateTo), 'dd/MM/yyyy')}`

            await exportDailyFluctuationToExcel({
                systemName: currentSystem?.name || systemType || 'KHO',
                dateRange: rangeStr,
                summaries: filteredSummaries,
                events: filteredEvents
            })
            showToast('Đã xuất báo cáo biến động Excel thành công', 'success')
        } catch (err: any) {
            console.error('Export fluctuation excel error:', err)
            showToast('Lỗi xuất Excel: ' + (err.message || 'Thử lại sau'), 'error')
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Bộ lọc ngày & thao tác */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                            <Calendar size={14} /> Xem biến động ngày:
                        </span>
                        {[
                            { id: 'today', label: 'Hôm nay' },
                            { id: 'yesterday', label: 'Hôm qua' },
                            { id: '7days', label: '7 ngày qua' },
                            { id: 'single_day', label: 'Chọn 1 ngày' },
                            { id: 'range', label: 'Khoảng ngày' }
                        ].map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handlePreset(item.id as QuickPreset)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                    preset === item.id
                                        ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                                        : 'bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 bg-stone-50 dark:bg-slate-800/80 p-1.5 rounded-xl border border-stone-200 dark:border-slate-700">
                            {preset === 'single_day' || preset === 'today' || preset === 'yesterday' ? (
                                <>
                                    <span className="text-[11px] font-bold text-stone-500 pl-1">Ngày:</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e => {
                                            setDateFrom(e.target.value)
                                            setDateTo(e.target.value)
                                            setPreset('single_day')
                                        }}
                                        className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-orange-500"
                                    />
                                </>
                            ) : (
                                <>
                                    <span className="text-[11px] font-bold text-stone-500 pl-1">Từ:</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={e => {
                                            setDateFrom(e.target.value)
                                            setPreset('range')
                                        }}
                                        className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-orange-500"
                                    />
                                    <span className="text-[11px] font-bold text-stone-500">Đến:</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={e => {
                                            setDateTo(e.target.value)
                                            setPreset('range')
                                        }}
                                        className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-xs rounded-lg px-2 py-1 font-medium focus:outline-none focus:border-orange-500"
                                    />
                                </>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={loadData}
                            disabled={loading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-slate-700 transition-all"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin text-orange-500' : ''} />
                            <span>Tải lại</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={isExporting || loading || filteredEvents.length === 0}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm"
                        >
                            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                            <span>Xuất Excel Tóm tắt</span>
                        </button>
                    </div>
                </div>

                {/* Bộ lọc tìm kiếm, loại biến động, nhân viên */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-stone-100 dark:border-slate-800/60">
                    <div className="relative md:col-span-2">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <input
                            type="text"
                            placeholder="Tìm vị trí (vd: A1-02), mã LOT, STT, tên SP, SKU..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                    </div>

                    <div className="relative">
                        <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <select
                            value={categoryFilter}
                            onChange={e => setCategoryFilter(e.target.value)}
                            className="w-full pl-10 pr-8 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
                        >
                            <option value="all">Mọi biến động</option>
                            <option value="increase">Chỉ xem Tăng / Nhập thêm</option>
                            <option value="decrease">Chỉ xem Giảm / Xuất / Xóa</option>
                            <option value="create">Tạo LOT mới</option>
                            <option value="adjust_up">Bỏ thêm (+ số lượng)</option>
                            <option value="adjust_down">Bớt ra (- số lượng)</option>
                            <option value="export">Đã xuất bán</option>
                            <option value="delete">Đã xóa LOT</option>
                            <option value="position">Thay đổi vị trí</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={15} />
                    </div>

                    <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        <select
                            value={performerFilter}
                            onChange={e => setPerformerFilter(e.target.value)}
                            className="w-full pl-10 pr-8 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:border-orange-500 appearance-none cursor-pointer"
                        >
                            <option value="all">Tất cả nhân viên</option>
                            {performers.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                            <option value="system">Hệ thống / Xuất bán</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={15} />
                    </div>
                </div>
            </div>

            {/* 4 Thẻ KPI Tổng quan */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 shadow-sm">
                    <div className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Activity size={14} className="text-orange-500" /> Tổng lượt thao tác
                    </div>
                    <div className="mt-2 text-2xl font-black text-stone-900 dark:text-stone-100 tabular-nums">
                        {kpiStats.totalEvents}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                        {filteredSummaries.length} mặt hàng có biến động
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 shadow-sm">
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp size={14} /> Lượt tăng / Nhập mới
                    </div>
                    <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                        +{kpiStats.upCount}
                    </div>
                    <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                        Tạo LOT mới hoặc bỏ thêm hàng
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 shadow-sm">
                    <div className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingDown size={14} /> Lượt giảm / Xuất / Xóa
                    </div>
                    <div className="mt-2 text-2xl font-black text-rose-700 dark:text-rose-300 tabular-nums">
                        -{kpiStats.downCount}
                    </div>
                    <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                        Bớt hàng, xuất bán hoặc xóa LOT
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-900/50 shadow-sm">
                    <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin size={14} /> Vị trí & Nhân sự
                    </div>
                    <div className="mt-2 text-2xl font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                        {kpiStats.touchedPositionsCount} <span className="text-sm font-bold">vị trí</span>
                    </div>
                    <div className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
                        {kpiStats.posCount} lượt gán/gỡ/đổi • {kpiStats.touchedUsersCount} nhân viên
                    </div>
                </div>
            </div>

            {/* BẢNG 1: TÓM TẮT DAO ĐỘNG THEO SẢN PHẨM */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowSummaryTable(!showSummaryTable)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-stone-50/80 dark:bg-slate-800/50 border-b border-stone-200 dark:border-slate-800 hover:bg-stone-100/80 dark:hover:bg-slate-800 transition-colors"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-5 bg-orange-500 rounded-full" />
                        <Package size={18} className="text-orange-600 dark:text-orange-400" />
                        <h3 className="text-sm font-black text-stone-800 dark:text-stone-100 uppercase tracking-wider">
                            Tóm tắt dao động hàng hóa theo sản phẩm ({filteredSummaries.length})
                        </h3>
                    </div>
                    {showSummaryTable ? <ChevronUp size={18} className="text-stone-400" /> : <ChevronDown size={18} className="text-stone-400" />}
                </button>

                {showSummaryTable && (
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-10 text-center text-stone-500 text-sm">Đang tổng hợp dao động...</div>
                        ) : filteredSummaries.length === 0 ? (
                            <div className="p-10 text-center text-stone-400 text-sm">
                                Không có biến động số lượng hàng hóa nào trong khoảng thời gian đã chọn.
                            </div>
                        ) : (
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="bg-stone-50/50 dark:bg-slate-800/30 border-b border-stone-200 dark:border-slate-700 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                                        <th className="text-left px-5 py-3">Sản phẩm</th>
                                        <th className="text-center px-3 py-3">ĐVT</th>
                                        <th className="text-right px-4 py-3 text-emerald-600 dark:text-emerald-400">Nhập mới (+)</th>
                                        <th className="text-right px-4 py-3 text-teal-600 dark:text-teal-400">Bỏ thêm (+)</th>
                                        <th className="text-right px-4 py-3 text-amber-600 dark:text-amber-400">Bớt ra (-)</th>
                                        <th className="text-right px-4 py-3 text-blue-600 dark:text-blue-400">Xuất bán (-)</th>
                                        <th className="text-right px-4 py-3 text-rose-600 dark:text-rose-400">Xóa LOT (-)</th>
                                        <th className="text-right px-5 py-3">Dao động ròng</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                    {filteredSummaries.map(row => (
                                        <tr key={row.key} className="hover:bg-stone-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold font-mono">
                                                        {row.sku}
                                                    </span>
                                                    <span className="font-bold text-stone-800 dark:text-stone-200">
                                                        {row.name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 text-center text-xs font-bold text-stone-500 uppercase">
                                                {row.unit}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                {row.createdQty > 0 ? `+${formatQty(row.createdQty)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                                                {row.adjustedUpQty > 0 ? `+${formatQty(row.adjustedUpQty)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                                {row.adjustedDownQty > 0 ? `-${formatQty(row.adjustedDownQty)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                                                {row.exportedQty > 0 ? `-${formatQty(row.exportedQty)}` : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                                                {row.deletedQty > 0 ? `-${formatQty(row.deletedQty)}` : '-'}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg font-mono text-xs font-black tabular-nums ${
                                                        row.netDelta > 0
                                                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                                            : row.netDelta < 0
                                                            ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                                            : 'bg-stone-100 dark:bg-slate-800 text-stone-500'
                                                    }`}
                                                >
                                                    {row.netDelta > 0 ? '+' : ''}
                                                    {formatQty(row.netDelta)} {row.unit}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>

            {/* BẢNG 2: NHẬT KÝ DIỄN BIẾN CHI TIẾT TRONG NGÀY */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-stone-50/80 dark:bg-slate-800/50 border-b border-stone-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-1.5 h-5 bg-indigo-500 rounded-full" />
                        <Activity size={18} className="text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-sm font-black text-stone-800 dark:text-stone-100 uppercase tracking-wider">
                            Diễn biến chi tiết từng thao tác ({filteredEvents.length})
                        </h3>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-16 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent" />
                            <p className="mt-3 text-stone-500 text-sm font-medium">Đang tải diễn biến chi tiết...</p>
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="p-16 text-center text-stone-400 text-sm">
                            Không có thao tác nào được ghi nhận trong khoảng thời gian và bộ lọc này.
                        </div>
                    ) : (
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="bg-stone-50/50 dark:bg-slate-800/30 border-b border-stone-200 dark:border-slate-700 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                                    <th className="text-left px-5 py-3 w-[15%]">Thời gian & Nhân sự</th>
                                    <th className="text-left px-4 py-3 w-[12%]">Vị trí</th>
                                    <th className="text-left px-4 py-3 w-[16%]">Mã LOT & STT</th>
                                    <th className="text-left px-4 py-3 w-[16%]">Loại thao tác</th>
                                    <th className="text-left px-5 py-3 w-[41%]">Chi tiết biến đổi hàng hóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredEvents.map(ev => {
                                    const meta = CATEGORY_META[ev.category]
                                    const sttLabel = formatLotSttLabel(ev.dailySeq)
                                    return (
                                        <tr key={ev.id} className="hover:bg-orange-50/20 dark:hover:bg-slate-800/40 transition-colors align-top">
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="font-bold text-stone-800 dark:text-stone-200">
                                                    {format(new Date(ev.timestamp), 'HH:mm')}
                                                    <span className="ml-1.5 text-xs font-medium text-stone-400">
                                                        {format(new Date(ev.timestamp), 'dd/MM')}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400">
                                                    <User size={11} className="shrink-0" />
                                                    <span className="truncate max-w-[140px]" title={ev.performedBy?.email || ''}>
                                                        {ev.performedBy?.name || 'Hệ thống'}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {ev.positions.length > 0 ? (
                                                        ev.positions.map((pos, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded text-[11px] font-bold border border-emerald-200/70 dark:border-emerald-800/50"
                                                            >
                                                                <MapPin size={10} />
                                                                {pos}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-stone-400 italic">-</span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-mono text-xs font-bold text-stone-800 dark:text-stone-200">
                                                        {ev.lotCode}
                                                    </span>
                                                    {sttLabel && (
                                                        <span className="w-fit px-1.5 py-0.5 bg-orange-600 text-white rounded text-[9px] font-bold font-mono">
                                                            STT: {sttLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tight ${meta.badgeClass}`}>
                                                    {meta.icon}
                                                    {meta.label}
                                                </span>
                                            </td>

                                            <td className="px-5 py-3.5">
                                                {ev.deltas.length > 0 ? (
                                                    <div className="space-y-1.5">
                                                        {ev.deltas.map((d, idx) => (
                                                            <div key={idx} className="flex items-center justify-between gap-3 text-xs bg-stone-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-stone-200/60 dark:border-slate-700/60">
                                                                <div className="min-w-0 flex items-center gap-1.5">
                                                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold shrink-0">
                                                                        {d.sku}
                                                                    </span>
                                                                    <span className="font-semibold text-stone-800 dark:text-stone-200 truncate" title={d.name}>
                                                                        {d.name}
                                                                    </span>
                                                                </div>
                                                                <div className="shrink-0 flex items-center gap-2 font-mono">
                                                                    {ev.category !== 'create' && ev.category !== 'export' && ev.category !== 'delete' && (
                                                                        <span className="text-stone-400 text-[11px]">
                                                                            {formatQty(d.oldQty)} → {formatQty(d.newQty)}
                                                                        </span>
                                                                    )}
                                                                    <span
                                                                        className={`px-2 py-0.5 rounded font-black text-[11px] ${
                                                                            d.deltaQty > 0
                                                                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                                                                : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                                                                        }`}
                                                                    >
                                                                        {d.deltaQty > 0 ? '+' : ''}
                                                                        {formatQty(d.deltaQty)} {d.unit}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {ev.customer && (
                                                            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium pl-1">
                                                                Khách hàng: <b>{ev.customer}</b>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-stone-600 dark:text-stone-300 font-medium">
                                                        {ev.description}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
