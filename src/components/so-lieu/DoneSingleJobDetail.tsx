'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
    ArrowDownLeft,
    ArrowUpRight,
    BarChart3,
    Camera,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    ExternalLink,
    FileText,
    History,
    Layers,
    Pencil,
    RefreshCw,
    RotateCcw,
    Trash2,
    User,
} from 'lucide-react'
import { DeliveryJournalRecord } from './types'
import { cleanUserNotes, formatCompactRange, formatDateTime } from './utils'

interface DoneSingleJobDetailProps {
    doneSelectedShift: any
    doneLines: DeliveryJournalRecord[]
    doneSubShifts: any[]
    doneLinesLoading: boolean
    doneTab: 'summary' | 'lines'
    setDoneTab: (t: 'summary' | 'lines') => void
    journalTypeFilter: 'all' | 'in' | 'out'
    setJournalTypeFilter: (f: 'all' | 'in' | 'out') => void
    isMainSummaryExpanded: boolean
    setIsMainSummaryExpanded: (v: boolean) => void
    isTwoWayExpanded: boolean
    setIsTwoWayExpanded: (v: boolean) => void
    isUnitsExpanded: boolean
    setIsUnitsExpanded: (v: boolean) => void
    isProductsExpanded: boolean
    setIsProductsExpanded: (v: boolean) => void
    isDoneSubShiftsSectionExpanded: boolean
    setIsDoneSubShiftsSectionExpanded: (v: boolean) => void
    isInfoExpanded: boolean
    setIsInfoExpanded: (v: boolean) => void
    expandedDoneSubShifts: Set<string>
    toggleExpandDoneSubShift: (id: string) => void
    summarizeLines: (lines: DeliveryJournalRecord[], shift?: any) => any[]
    buildEffectiveSubShifts: (subShifts: any[], lines: DeliveryJournalRecord[], shift: any) => any[]
    onBackMobile: () => void
    onOpenImagesModal: () => void
    onExportExcel: (shift: any, lines: DeliveryJournalRecord[]) => void
    onReopenShift: (shift: any) => void
    onContinueActiveShift: (shiftId: string) => void
    onDeleteDoneShift: (shiftId: string) => void
    onOpenInboundModal: (shift: any, summaryRows: any[]) => void
    onOpenOutboundModal: (shift: any, summaryRows: any[]) => void
    onNavigateToSettlementPage: (shift: any, summaryRows: any[], type: 'in' | 'out') => void
    onStartEdit: (record: DeliveryJournalRecord) => void
    onDeleteJournal: (id: string) => void
    onUpdateShiftOpenedAt: (shift: any) => void
}

export default function DoneSingleJobDetail({
    doneSelectedShift,
    doneLines,
    doneSubShifts,
    doneLinesLoading,
    doneTab,
    setDoneTab,
    journalTypeFilter,
    setJournalTypeFilter,
    isMainSummaryExpanded,
    setIsMainSummaryExpanded,
    isTwoWayExpanded,
    setIsTwoWayExpanded,
    isUnitsExpanded,
    setIsUnitsExpanded,
    isProductsExpanded,
    setIsProductsExpanded,
    isDoneSubShiftsSectionExpanded,
    setIsDoneSubShiftsSectionExpanded,
    isInfoExpanded,
    setIsInfoExpanded,
    expandedDoneSubShifts,
    toggleExpandDoneSubShift,
    summarizeLines,
    buildEffectiveSubShifts,
    onBackMobile,
    onOpenImagesModal,
    onExportExcel,
    onReopenShift,
    onContinueActiveShift,
    onDeleteDoneShift,
    onOpenInboundModal,
    onOpenOutboundModal,
    onNavigateToSettlementPage,
    onStartEdit,
    onDeleteJournal,
    onUpdateShiftOpenedAt,
}: DoneSingleJobDetailProps) {
    const [shiftImages, setShiftImages] = useState<any[]>([])
    const [previewContext, setPreviewContext] = useState<{
        urls: string[]
        items?: { url: string; direction?: 'in' | 'out' | null }[]
        index: number
        title?: string
        showDirectionFilter?: boolean
        directionFilter?: 'all' | 'in' | 'out'
    } | null>(null)

    const resolveImgUrl = (img: any) =>
        img?.public_url ||
        (img?.drive_file_id ? `https://lh3.googleusercontent.com/d/${img.drive_file_id}=w1600` : '')

    const resolveImgDirection = (img: any): 'in' | 'out' | null => {
        if (img?.direction === 'in' || img?.direction === 'out') return img.direction
        if (img?.journal_id) {
            const matched = doneLines.find(l => l.id === img.journal_id)
            if (matched) return matched.to_department === 'Kho' ? 'in' : 'out'
        }
        return null
    }

    const getProductImages = (productName: string) => {
        const target = (productName || '').trim().toLowerCase()
        if (!target) return []
        const matchingJournalIds = new Set(
            doneLines
                .filter(l => (l.item_name || '').trim().toLowerCase() === target)
                .map(l => l.id)
        )
        return shiftImages.filter(img => {
            const imgItem = (img.item_name || '').trim().toLowerCase()
            return imgItem === target || (img.journal_id && matchingJournalIds.has(img.journal_id))
        })
    }

    const getSubShiftProductImages = (
        productName: string,
        subLines: DeliveryJournalRecord[],
        fromTime: string,
        toTime: string
    ) => {
        const target = (productName || '').trim().toLowerCase()
        if (!target) return []
        const matchingSubIds = new Set(
            (subLines || [])
                .filter(l => (l.item_name || '').trim().toLowerCase() === target)
                .map(l => l.id)
        )
        return shiftImages.filter(img => {
            if (img.journal_id && subLines.length > 0) {
                return matchingSubIds.has(img.journal_id)
            }
            const imgItem = (img.item_name || '').trim().toLowerCase()
            if (imgItem !== target) return false
            const cap = img.captured_at || ''
            return (!fromTime || cap >= fromTime) && (!toTime || cap <= toTime)
        })
    }

    useEffect(() => {
        const shiftId = doneSelectedShift?.id
        if (!shiftId) {
            setShiftImages([])
            return
        }
        let cancelled = false
        ;(supabase.from('operation_images') as any)
            .select('id, journal_id, direction, public_url, drive_file_id, item_name, captured_at')
            .eq('shift_id', shiftId)
            .order('captured_at', { ascending: false })
            .then(({ data }: any) => {
                if (!cancelled) setShiftImages(data || [])
            })
            .catch(() => {
                if (!cancelled) setShiftImages([])
            })
        return () => {
            cancelled = true
        }
    }, [doneSelectedShift?.id])

    if (!doneSelectedShift) {
        return (
            <div className="bg-white dark:bg-zinc-900 border border-dashed border-stone-300 dark:border-zinc-800 rounded-2xl p-12 text-center text-sm text-stone-400">
                Chọn một công việc bên trái để xem chi tiết các lần chốt ca tạm và báo cáo đối soát cả ca
            </div>
        )
    }

    const jobTitle = doneSelectedShift.summary_data?.job_name || doneSelectedShift.notes || 'Công việc'
    const isClosed = doneSelectedShift.status === 'closed'
    const summaryRows = doneLines.length > 0
        ? summarizeLines(doneLines, doneSelectedShift)
        : Object.values(doneSelectedShift.summary_data?.products_summary || {}).map((p: any) => {
            const pinnedList: any[] = doneSelectedShift.summary_data?.pinned_products || []
            const matched = pinnedList.find((pinned: any) => pinned.name === p.product_name)
            return {
                product_id: matched?.id,
                sku: matched?.sku,
                product_name: p.product_name,
                unit: p.unit,
                in_qty: p.in_qty || 0,
                out_qty: p.out_qty || 0,
                count: (p.in_count || 0) + (p.out_count || 0)
            }
        })

    // Tổng hợp theo Đơn vị tính & 2 hướng (Nhập kho / Xuất kho)
    const unitsMap: Record<string, { unit: string; in_qty: number; out_qty: number; in_count: number; out_count: number }> = {}
    let totalInCount = 0
    let totalOutCount = 0
    if (doneLines.length > 0) {
        doneLines.forEach(l => {
            const u = l.unit || 'ĐVT'
            if (!unitsMap[u]) unitsMap[u] = { unit: u, in_qty: 0, out_qty: 0, in_count: 0, out_count: 0 }
            const qty = Number(l.quantity_sent) || 0
            if (l.to_department === 'Kho') {
                unitsMap[u].in_qty += qty
                unitsMap[u].in_count += 1
                totalInCount += 1
            } else {
                unitsMap[u].out_qty += qty
                unitsMap[u].out_count += 1
                totalOutCount += 1
            }
        })
    } else {
        summaryRows.forEach(r => {
            const u = r.unit || 'ĐVT'
            if (!unitsMap[u]) unitsMap[u] = { unit: u, in_qty: 0, out_qty: 0, in_count: 0, out_count: 0 }
            unitsMap[u].in_qty += Number(r.in_qty) || 0
            unitsMap[u].out_qty += Number(r.out_qty) || 0
            unitsMap[u].in_count += r.in_qty > 0 ? (r.count || 1) : 0
            unitsMap[u].out_count += r.out_qty > 0 ? (r.count || 1) : 0
        })
    }
    const unitsSummaryList = Object.values(unitsMap)
    const totalBatchesCount = doneLines.length > 0
        ? doneLines.length
        : (doneSelectedShift.summary_data?.total_records ?? summaryRows.reduce((s, r) => s + (r.count || 0), 0))

    const cleanShiftNotes = (doneSelectedShift.notes || '')
        .replace(/\[CV:\s*[^\]]+\]\s*/gi, '')
        .trim()

    const effectiveSubShifts = buildEffectiveSubShifts(doneSubShifts, doneLines, doneSelectedShift)

    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Nút quay lại danh sách trên Mobile */}
            <button
                type="button"
                onClick={onBackMobile}
                className="sm:hidden inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 py-0.5"
            >
                <ChevronLeft className="w-3.5 h-3.5" /> Danh sách công việc
            </button>

            {/* KHỐI CHÍNH BÁO CÁO ĐỐI SOÁT CA */}
            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-3.5 sm:p-6 shadow-xs space-y-4 sm:space-y-6">
                {/* 1. Header: Tên công việc + Nút thao tác */}
                <div className="border-b border-stone-100 dark:border-zinc-800 pb-3 sm:pb-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-xl font-black text-stone-900 dark:text-white tracking-tight">
                                    {jobTitle}
                                </h2>
                                {isClosed ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0 whitespace-nowrap">
                                        ✓ Đã hoàn thành
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        Đang diễn ra
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                            <button
                                type="button"
                                onClick={onOpenImagesModal}
                                className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold border border-sky-200 dark:border-sky-800 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 flex items-center gap-1.5 whitespace-nowrap"
                            >
                                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Ảnh / Chụp thêm
                            </button>
                            <button
                                type="button"
                                onClick={() => onExportExcel(doneSelectedShift, doneLines)}
                                className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                            >
                                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Xuất Excel
                            </button>
                            {isClosed ? (
                                <button
                                    type="button"
                                    onClick={() => onReopenShift(doneSelectedShift)}
                                    title="Mở lại công việc này để tiếp tục nhập số liệu"
                                    className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" /> Mở lại CV
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onContinueActiveShift(doneSelectedShift.id)}
                                    className="h-8 sm:h-9 px-3 sm:px-3.5 rounded-xl text-[11px] sm:text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    Tiếp tục nhập →
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => onDeleteDoneShift(doneSelectedShift.id)}
                                title="Xóa báo cáo công việc (cần mật khẩu)"
                                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0"
                            >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 1. TỔNG HỢP ĐỐI SOÁT CẢ CA (SUM TỔNG) */}
                <div className="space-y-2.5 sm:space-y-3 pt-1">
                    <button
                        type="button"
                        onClick={() => setIsMainSummaryExpanded(!isMainSummaryExpanded)}
                        className="w-full flex items-center justify-between py-1 text-left hover:opacity-80 transition group cursor-pointer"
                    >
                        <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-base">
                            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 shrink-0" />
                            <span>Tổng hợp đối soát cả ca (Sum tổng)</span>
                        </h4>
                        <div className="flex items-center gap-1.5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200 shrink-0">
                            <span className="text-[10px] sm:text-[11px] font-medium hidden sm:inline">
                                {isMainSummaryExpanded ? 'Thu lại' : 'Mở rộng'}
                            </span>
                            {isMainSummaryExpanded ? (
                                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                            ) : (
                                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                            )}
                        </div>
                    </button>

                    {isMainSummaryExpanded && (
                        <div className="space-y-2 sm:space-y-3 pt-1">
                            {/* 3.1. TỔNG HỢP SỐ LIỆU 2 HƯỚNG (NHẬP/XUẤT) */}
                            <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setIsTwoWayExpanded(!isTwoWayExpanded)}
                                    className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                >
                                    <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                        📦 TỔNG HỢP 2 HƯỚNG (NHẬP/XUẤT)
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                            Tổng {totalBatchesCount} đợt
                                        </span>
                                        {isTwoWayExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                        )}
                                    </div>
                                </button>

                                {isTwoWayExpanded && (
                                    <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-stone-50/40 dark:bg-zinc-900/30">
                                        {/* Chiều 1: Nhập kho */}
                                        <div className="bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                                            <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/50 pb-1.5">
                                                <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                                                    1. Nhập kho (SX → Kho)
                                                </span>
                                                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                                    {totalInCount} đợt
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {unitsSummaryList.filter(u => u.in_qty > 0).length === 0 ? (
                                                    <span className="text-[11px] sm:text-xs text-stone-400 italic">Không có phát sinh nhập</span>
                                                ) : (
                                                    unitsSummaryList.filter(u => u.in_qty > 0).map(u => (
                                                        <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                            +{u.in_qty} {u.unit}
                                                        </span>
                                                    ))
                                                )}
                                            </div>

                                            {unitsSummaryList.some(u => u.in_qty > 0) && (
                                                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between gap-2 flex-wrap">
                                                    {doneSelectedShift.summary_data?.settlement_inbound_code ? (
                                                        <a
                                                            href={`/inbound?editCode=${doneSelectedShift.summary_data.settlement_inbound_code}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-300 hover:underline flex items-center gap-1"
                                                        >
                                                            ✓ Đã lập: {doneSelectedShift.summary_data.settlement_inbound_code} <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenInboundModal(doneSelectedShift, summaryRows)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-xs"
                                                        >
                                                            <ArrowDownLeft className="w-3 h-3" /> Làm phiếu nhập kết toán
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onNavigateToSettlementPage(doneSelectedShift, summaryRows, 'in')}
                                                        className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
                                                    >
                                                        Mở trên /inbound <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Chiều 2: Xuất kho */}
                                        <div className="bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200/70 dark:border-rose-900/40 rounded-xl p-2.5 sm:p-3.5 space-y-1.5 sm:space-y-2">
                                            <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-800/50 pb-1.5">
                                                <span className="text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">
                                                    2. Xuất kho (Kho → SX)
                                                </span>
                                                <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">
                                                    {totalOutCount} đợt
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                {unitsSummaryList.filter(u => u.out_qty > 0).length === 0 ? (
                                                    <span className="text-[11px] sm:text-xs text-stone-400 italic">Không có phát sinh xuất</span>
                                                ) : (
                                                    unitsSummaryList.filter(u => u.out_qty > 0).map(u => (
                                                        <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-300">
                                                            -{u.out_qty} {u.unit}
                                                        </span>
                                                    ))
                                                )}
                                            </div>

                                            {unitsSummaryList.some(u => u.out_qty > 0) && (
                                                <div className="pt-2 border-t border-rose-200/60 dark:border-rose-800/50 flex items-center justify-between gap-2 flex-wrap">
                                                    {doneSelectedShift.summary_data?.settlement_outbound_code ? (
                                                        <a
                                                            href={`/outbound?editCode=${doneSelectedShift.summary_data.settlement_outbound_code}`}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-[10px] sm:text-[11px] font-bold text-rose-800 dark:text-rose-300 hover:underline flex items-center gap-1"
                                                        >
                                                            ✓ Đã lập: {doneSelectedShift.summary_data.settlement_outbound_code} <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onOpenOutboundModal(doneSelectedShift, summaryRows)}
                                                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] sm:text-[11px] flex items-center gap-1 shadow-xs"
                                                        >
                                                            <ArrowUpRight className="w-3 h-3" /> Làm phiếu xuất kết toán
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => onNavigateToSettlementPage(doneSelectedShift, summaryRows, 'out')}
                                                        className="text-[10px] sm:text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline flex items-center gap-1"
                                                    >
                                                        Mở trên /outbound <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3.2. CHI TIẾT THEO ĐƠN VỊ HÀNG HÓA */}
                            <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setIsUnitsExpanded(!isUnitsExpanded)}
                                    className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                >
                                    <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                        📊 CHI TIẾT THEO ĐƠN VỊ HÀNG HÓA
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                            {unitsSummaryList.length} Đơn vị
                                        </span>
                                        {isUnitsExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                        )}
                                    </div>
                                </button>

                                {isUnitsExpanded && (
                                    <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 bg-stone-50/40 dark:bg-zinc-900/30 overflow-x-auto">
                                        <table className="w-full text-left text-[11px] sm:text-sm">
                                            <thead>
                                                <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400 uppercase text-[10px] sm:text-[11px]">
                                                    <th className="pb-1.5 sm:pb-2">ĐVT</th>
                                                    <th className="pb-1.5 sm:pb-2 text-right text-emerald-600">Nhập (+)</th>
                                                    <th className="pb-1.5 sm:pb-2 text-right text-rose-600">Xuất (-)</th>
                                                    <th className="pb-1.5 sm:pb-2 text-right">Số đợt</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                {unitsSummaryList.map(u => (
                                                    <tr key={u.unit}>
                                                        <td className="py-2 font-bold text-stone-800 dark:text-stone-100">{u.unit}</td>
                                                        <td className="py-2 text-right font-black text-emerald-600">+{u.in_qty}</td>
                                                        <td className="py-2 text-right font-black text-rose-600">-{u.out_qty}</td>
                                                        <td className="py-2 text-right text-stone-500">{u.in_count + u.out_count} đợt</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* 3.3. ĐỐI SOÁT CHI TIẾT THEO SẢN PHẨM & TỪNG ĐỢT NHẬP/XUẤT */}
                            <div className="bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                <button
                                    type="button"
                                    onClick={() => setIsProductsExpanded(!isProductsExpanded)}
                                    className="w-full p-2.5 sm:p-3.5 flex items-center justify-between gap-2 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                                >
                                    <span className="text-[10px] sm:text-xs font-extrabold text-stone-700 dark:text-stone-300 uppercase tracking-wider truncate">
                                        📋 TỔNG HỢP THEO SẢN PHẨM (TOÀN CV)
                                    </span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                            {summaryRows.length} SP
                                        </span>
                                        {isProductsExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                        ) : (
                                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />
                                        )}
                                    </div>
                                </button>

                                {isProductsExpanded && (
                                    <div className="border-t border-stone-100 dark:border-zinc-800/80">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-zinc-800 px-2.5 sm:px-4 py-2 bg-stone-50/50 dark:bg-zinc-900/50">
                                            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-4 w-full sm:w-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => setDoneTab('summary')}
                                                    className={`text-[11px] sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 py-1.5 sm:py-0 sm:pb-1 rounded-lg sm:rounded-none sm:border-b-2 transition ${
                                                        doneTab === 'summary'
                                                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 sm:bg-transparent sm:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                                            : 'border-transparent text-stone-500 hover:text-stone-800'
                                                    }`}
                                                >
                                                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                                    <span>Tổng hợp SP ({summaryRows.length})</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDoneTab('lines')}
                                                    className={`text-[11px] sm:text-sm font-bold flex items-center justify-center sm:justify-start gap-1.5 py-1.5 sm:py-0 sm:pb-1 rounded-lg sm:rounded-none sm:border-b-2 transition ${
                                                        doneTab === 'lines'
                                                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 sm:bg-transparent sm:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                                            : 'border-transparent text-stone-500 hover:text-stone-800'
                                                    }`}
                                                >
                                                    <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                                                    <span>Từng đợt ({doneLines.length})</span>
                                                </button>
                                            </div>

                                            <div className="flex items-center justify-between sm:justify-end gap-2">
                                                {doneTab === 'lines' && (() => {
                                                    const inCount = doneLines.filter(l => l.to_department === 'Kho').length
                                                    const outCount = doneLines.filter(l => l.to_department !== 'Kho').length
                                                    return (
                                                        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 bg-stone-200/70 dark:bg-zinc-800 p-0.5 rounded-lg w-full sm:w-auto">
                                                            <button
                                                                type="button"
                                                                onClick={() => setJournalTypeFilter('all')}
                                                                className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                                    journalTypeFilter === 'all'
                                                                        ? 'bg-white dark:bg-zinc-900 text-stone-900 dark:text-white shadow-xs'
                                                                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                                                                }`}
                                                            >
                                                                <span>Tất cả ({doneLines.length})</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setJournalTypeFilter('in')}
                                                                className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                                    journalTypeFilter === 'in'
                                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40'
                                                                }`}
                                                            >
                                                                <ArrowDownLeft className="w-3 h-3 shrink-0" />
                                                                <span>Nhập ({inCount})</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setJournalTypeFilter('out')}
                                                                className={`px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-bold transition flex items-center justify-center gap-1 ${
                                                                    journalTypeFilter === 'out'
                                                                        ? 'bg-rose-600 text-white shadow-xs'
                                                                        : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50/60 dark:hover:bg-rose-950/40'
                                                                }`}
                                                            >
                                                                <ArrowUpRight className="w-3 h-3 shrink-0" />
                                                                <span>Xuất ({outCount})</span>
                                                            </button>
                                                        </div>
                                                    )
                                                })()}
                                                {doneLinesLoading && <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />}
                                            </div>
                                        </div>

                                        {doneTab === 'summary' ? (
                                            <div className="p-2.5 sm:p-4 bg-stone-50/40 dark:bg-zinc-900/30">
                                                {summaryRows.length === 0 ? (
                                                    <div className="py-6 text-center text-[11px] sm:text-xs text-stone-400">
                                                        Không có dữ liệu số liệu trong công việc này.
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="sm:hidden divide-y divide-stone-200/70 dark:divide-zinc-800">
                                                            {summaryRows.map((row, idx) => {
                                                                const prodItems = getProductImages(row.product_name)
                                                                    .map(img => ({
                                                                        url: resolveImgUrl(img),
                                                                        direction: resolveImgDirection(img),
                                                                    }))
                                                                    .filter(x => Boolean(x.url))
                                                                return (
                                                                <div key={idx} className="py-2 first:pt-0 last:pb-0 space-y-1">
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="text-[11px] font-bold text-stone-900 dark:text-white leading-snug">
                                                                            {row.product_name}
                                                                        </div>
                                                                        {prodItems.length > 0 && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    setPreviewContext({
                                                                                        urls: prodItems.map(x => x.url),
                                                                                        items: prodItems,
                                                                                        index: 0,
                                                                                        title: row.product_name,
                                                                                        showDirectionFilter: true,
                                                                                        directionFilter: 'all',
                                                                                    })
                                                                                }
                                                                                className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[10px] font-bold flex items-center gap-1 shrink-0"
                                                                            >
                                                                                <Camera className="w-3 h-3" />
                                                                                <span>{prodItems.length} ảnh</span>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[10px]">
                                                                        <span className="text-stone-500">
                                                                            ĐVT: <strong className="text-stone-700 dark:text-stone-300">{row.unit}</strong> • {row.count ? `${row.count} đợt` : '-'}
                                                                        </span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black">
                                                                                +{row.in_qty}
                                                                            </span>
                                                                            <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black">
                                                                                -{row.out_qty}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                )
                                                            })}
                                                        </div>

                                                        <table className="hidden sm:table w-full text-left text-xs sm:text-sm">
                                                            <thead>
                                                                <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400 font-semibold uppercase text-xs">
                                                                    <th className="pb-2.5">Sản phẩm</th>
                                                                    <th className="pb-2.5">ĐVT</th>
                                                                    <th className="pb-2.5 text-right text-emerald-600">Tổng Nhập (+)</th>
                                                                    <th className="pb-2.5 text-right text-rose-600">Tổng Xuất (-)</th>
                                                                    <th className="pb-2.5 text-right">Số đợt</th>
                                                                    <th className="pb-2.5 text-right">Ảnh SP</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                                                {summaryRows.map((row, idx) => {
                                                                    const prodItems = getProductImages(row.product_name)
                                                                        .map(img => ({
                                                                            url: resolveImgUrl(img),
                                                                            direction: resolveImgDirection(img),
                                                                        }))
                                                                        .filter(x => Boolean(x.url))
                                                                    return (
                                                                    <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-zinc-800/40">
                                                                        <td className="py-3 font-bold text-stone-900 dark:text-white pr-3">
                                                                            {row.product_name}
                                                                        </td>
                                                                        <td className="py-3 text-stone-500 whitespace-nowrap">{row.unit}</td>
                                                                        <td className="py-3 text-right font-black text-base text-emerald-600 tabular-nums">
                                                                            +{row.in_qty}
                                                                        </td>
                                                                        <td className="py-3 text-right font-black text-base text-rose-600 tabular-nums">
                                                                            -{row.out_qty}
                                                                        </td>
                                                                        <td className="py-3 text-right text-xs text-stone-400 whitespace-nowrap">
                                                                            {row.count ? `${row.count} đợt` : '-'}
                                                                        </td>
                                                                        <td className="py-3 text-right whitespace-nowrap">
                                                                            {prodItems.length > 0 ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        setPreviewContext({
                                                                                            urls: prodItems.map(x => x.url),
                                                                                            items: prodItems,
                                                                                            index: 0,
                                                                                            title: row.product_name,
                                                                                            showDirectionFilter: true,
                                                                                            directionFilter: 'all',
                                                                                        })
                                                                                    }
                                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-bold transition"
                                                                                >
                                                                                    <Camera className="w-3.5 h-3.5" />
                                                                                    <span>{prodItems.length} ảnh</span>
                                                                                </button>
                                                                            ) : (
                                                                                <span className="text-xs text-stone-300 dark:text-zinc-600">-</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                    )
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </>
                                                )}
                                            </div>
                                        ) : (() => {
                                            const filteredDoneLines = journalTypeFilter === 'in'
                                                ? doneLines.filter(l => l.to_department === 'Kho')
                                                : journalTypeFilter === 'out'
                                                    ? doneLines.filter(l => l.to_department !== 'Kho')
                                                    : doneLines
                                            return (
                                                <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-[520px] overflow-y-auto">
                                                    {filteredDoneLines.length === 0 ? (
                                                        <div className="p-6 text-center text-[11px] sm:text-xs text-stone-400">
                                                            Không có dòng nhật ký nào phù hợp bộ lọc.
                                                        </div>
                                                    ) : (
                                                        filteredDoneLines.map(record => {
                                                            const isImport = record.to_department === 'Kho'
                                                            const userNote = cleanUserNotes(record.notes)
                                                            return (
                                                                <div
                                                                    key={record.id}
                                                                    className="px-2.5 sm:px-4 py-2.5 sm:py-3 flex items-start gap-2 sm:gap-2.5 hover:bg-stone-50 dark:hover:bg-zinc-800/40 text-[11px] sm:text-xs"
                                                                >
                                                                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                                                                        isImport
                                                                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                                                                            : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                                                                    }`}>
                                                                        {isImport ? <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                                                                    </div>

                                                                    <div className="min-w-0 flex-1 space-y-1">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <span className="font-bold text-stone-900 dark:text-white break-words leading-snug min-w-0 flex-1">
                                                                                {record.item_name}
                                                                            </span>
                                                                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                                                                <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-md font-black text-[11px] whitespace-nowrap ${
                                                                                    isImport
                                                                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                                                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                                                }`}>
                                                                                    {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                                                </span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => onStartEdit(record)}
                                                                                    title="Chỉnh sửa dòng này"
                                                                                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 text-stone-500 hover:text-indigo-600 flex items-center justify-center shrink-0"
                                                                                >
                                                                                    <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => onDeleteJournal(record.id)}
                                                                                    title="Xóa dòng này"
                                                                                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-rose-50 dark:bg-zinc-800 text-stone-500 hover:text-rose-600 flex items-center justify-center shrink-0"
                                                                                >
                                                                                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className={`sm:hidden px-1.5 py-0.5 rounded font-black text-[10px] whitespace-nowrap ${
                                                                                isImport
                                                                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                                                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                                                            }`}>
                                                                                {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                                                                            </span>
                                                                            <span className="hidden sm:inline text-[11px] text-stone-400">
                                                                                {formatDateTime(record.sent_at)} • {record.sent_by_name || 'Nhân viên'}
                                                                                {userNote ? ` • 💬 ${userNote}` : ''}
                                                                            </span>
                                                                        </div>

                                                                        <div className="sm:hidden text-[10px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                                                                            <span>{formatDateTime(record.sent_at)}</span>
                                                                            <span>•</span>
                                                                            <span>{record.sent_by_name || 'Nhân viên'}</span>
                                                                            {userNote && <span>• 💬 {userNote}</span>}
                                                                        </div>

                                                                        {(() => {
                                                                            const rowUrls = shiftImages
                                                                                .filter(img => img.journal_id === record.id)
                                                                                .map(resolveImgUrl)
                                                                                .filter(Boolean)
                                                                            if (rowUrls.length === 0) return null
                                                                            return (
                                                                                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                                                                    {rowUrls.map((imgUrl, imgIdx) => (
                                                                                        <button
                                                                                            key={imgIdx}
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                setPreviewContext({
                                                                                                    urls: rowUrls,
                                                                                                    index: imgIdx,
                                                                                                    title: record.item_name,
                                                                                                })
                                                                                            }
                                                                                            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden border border-stone-200 dark:border-zinc-700 hover:ring-2 hover:ring-indigo-500 transition shrink-0 bg-stone-100 dark:bg-zinc-800"
                                                                                            title="Bấm để xem ảnh phóng to"
                                                                                        >
                                                                                            <img
                                                                                                src={imgUrl}
                                                                                                alt={record.item_name || 'Ảnh đợt'}
                                                                                                className="w-full h-full object-cover"
                                                                                                loading="lazy"
                                                                                            />
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                        })()}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. CHI TIẾT CÁC LẦN CHỐT CA TẠM (ĐỔI CA) — TIMELINE ACCORDION */}
                <div className="pt-2 border-t border-stone-100 dark:border-zinc-800">
                    <div className="space-y-2 sm:space-y-3">
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setIsDoneSubShiftsSectionExpanded(!isDoneSubShiftsSectionExpanded)}
                            className="flex items-center justify-between gap-2 cursor-pointer select-none group p-1 -m-1 rounded-lg hover:bg-stone-50 dark:hover:bg-zinc-900/50 transition"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                                <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-sm min-w-0">
                                    <span className="truncate">Chi tiết các lần chốt ca tạm (đổi ca)</span>
                                </h4>
                                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold shrink-0 whitespace-nowrap">
                                    {effectiveSubShifts.length} lần chốt
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200 shrink-0">
                                <span className="text-[10px] sm:text-[11px] font-medium hidden sm:inline">
                                    {isDoneSubShiftsSectionExpanded ? 'Thu lại' : 'Mở rộng'}
                                </span>
                                {isDoneSubShiftsSectionExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-stone-500" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-stone-500" />
                                )}
                            </div>
                        </div>

                        {isDoneSubShiftsSectionExpanded && (
                            effectiveSubShifts.length === 0 ? (
                                <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-dashed border-amber-200 dark:border-amber-900/40 rounded-xl px-3.5 py-2.5 text-[11px] sm:text-xs text-stone-500">
                                    Công việc này chưa có lần bấm <strong>Chốt tạm</strong> (đổi ca) nào trước khi hoàn thành.
                                </div>
                            ) : (
                                <div className="space-y-2 sm:space-y-3 relative sm:border-l-2 sm:border-amber-200 dark:sm:border-amber-800/60 sm:ml-2.5 sm:pl-5">
                                    {effectiveSubShifts.map((ss: any) => {
                                        const isExpanded = expandedDoneSubShifts.has(ss.id)
                                        const subLines: DeliveryJournalRecord[] = ss._subLines || []
                                        const subProds = subLines.length > 0
                                            ? summarizeLines(subLines)
                                            : Object.values(ss.summary_data?.products_summary || {}).map((p: any) => ({
                                                product_name: p.product_name,
                                                unit: p.unit,
                                                in_qty: p.in_qty || 0,
                                                out_qty: p.out_qty || 0,
                                                count: (p.in_count || 0) + (p.out_count || 0)
                                            }))
                                        const totalIn = subProds.reduce((s, p) => s + (Number(p.in_qty) || 0), 0)
                                        const totalOut = subProds.reduce((s, p) => s + (Number(p.out_qty) || 0), 0)
                                        const totalCount = subLines.length > 0
                                            ? subLines.length
                                            : (ss.summary_data?.total_records ?? subProds.reduce((s, p) => s + (p.count || 0), 0))

                                        return (
                                            <div key={ss.id} className="relative bg-white dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 rounded-xl shadow-xs overflow-hidden">
                                                <div className="hidden sm:block absolute -left-[27px] top-4 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-white dark:ring-zinc-900" />

                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpandDoneSubShift(ss.id)}
                                                    className="w-full p-2.5 sm:p-3.5 text-left hover:bg-stone-50 dark:hover:bg-zinc-900/60 transition space-y-1"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="text-[11px] sm:text-sm font-bold text-amber-700 dark:text-amber-500 flex items-center gap-1.5 flex-wrap min-w-0">
                                                            <span>Lần chốt ca tạm #{ss.sub_shift_number}</span>
                                                            {ss.is_auto_final && (
                                                                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                                                                    {isClosed ? 'Đợt cuối ca' : 'Đợt đang nhập'}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <div className="text-[10px] sm:text-xs bg-stone-100 dark:bg-zinc-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-medium text-stone-600 dark:text-stone-300 whitespace-nowrap">
                                                                <span className="hidden sm:inline">Nhập </span>
                                                                <strong className="text-emerald-600">+{totalIn}</strong>
                                                                <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                                <span className="hidden sm:inline">Xuất </span>
                                                                <strong className="text-rose-600">-{totalOut}</strong>
                                                                <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                                <strong>{totalCount}</strong> đợt
                                                            </div>
                                                            {isExpanded ? (
                                                                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                            ) : (
                                                                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400 shrink-0" />
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-[10px] sm:text-[11px] text-stone-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 shrink-0" />
                                                        <span className="truncate">{formatCompactRange(ss.from_time, ss.to_time)}</span>
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <div className="px-2.5 sm:px-4 pb-3 pt-2 border-t border-stone-100 dark:border-zinc-800/80 space-y-2 bg-stone-50/40 dark:bg-zinc-900/30">
                                                        {subProds.length > 0 ? (
                                                            <div className="bg-white dark:bg-zinc-900 rounded-xl p-2.5 sm:p-3 border border-stone-200 dark:border-zinc-800">
                                                                <div className="text-[9px] sm:text-[11px] font-bold text-stone-400 uppercase mb-1.5">
                                                                    Hàng hóa giao nhận trong đợt #{ss.sub_shift_number}
                                                                </div>

                                                                <div className="sm:hidden divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                    {subProds.map((p: any, pIdx: number) => {
                                                                        const subProdItems = getSubShiftProductImages(p.product_name, subLines, ss.from_time, ss.to_time)
                                                                            .map(img => ({ url: resolveImgUrl(img), direction: resolveImgDirection(img) }))
                                                                            .filter(x => Boolean(x.url))
                                                                        return (
                                                                        <div key={pIdx} className="py-1.5 first:pt-0 last:pb-0 space-y-0.5">
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 leading-snug">
                                                                                    {p.product_name}
                                                                                </div>
                                                                                {subProdItems.length > 0 && (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            setPreviewContext({
                                                                                                urls: subProdItems.map(x => x.url),
                                                                                                items: subProdItems,
                                                                                                index: 0,
                                                                                                title: `${p.product_name} (Đợt #${ss.sub_shift_number})`,
                                                                                                showDirectionFilter: true,
                                                                                                directionFilter: 'all',
                                                                                            })
                                                                                        }
                                                                                        className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[10px] font-bold flex items-center gap-1 shrink-0"
                                                                                    >
                                                                                        <Camera className="w-3 h-3" />
                                                                                        <span>{subProdItems.length} ảnh</span>
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center justify-between text-[10px]">
                                                                                <span className="text-stone-500">
                                                                                    ĐVT: <strong className="text-stone-700 dark:text-stone-300">{p.unit}</strong> • {p.count || 0} đợt
                                                                                </span>
                                                                                <div className="flex items-center gap-2 font-black">
                                                                                    <span className="text-emerald-600">+{p.in_qty}</span>
                                                                                    <span className="text-stone-300 dark:text-zinc-700">|</span>
                                                                                    <span className="text-rose-600">-{p.out_qty}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        )
                                                                    })}
                                                                </div>

                                                                <table className="hidden sm:table w-full text-left text-xs">
                                                                    <thead>
                                                                        <tr className="border-b border-stone-100 dark:border-zinc-800 text-stone-400">
                                                                            <th className="pb-1.5 font-semibold">Sản phẩm</th>
                                                                            <th className="pb-1.5 font-semibold">ĐVT</th>
                                                                            <th className="pb-1.5 font-semibold text-right text-emerald-600">Nhập (+)</th>
                                                                            <th className="pb-1.5 font-semibold text-right text-rose-600">Xuất (-)</th>
                                                                            <th className="pb-1.5 font-semibold text-right">Số đợt</th>
                                                                            <th className="pb-1.5 font-semibold text-right">Ảnh SP</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                        {subProds.map((p: any, pIdx: number) => {
                                                                            const subProdItems = getSubShiftProductImages(p.product_name, subLines, ss.from_time, ss.to_time)
                                                                                .map(img => ({ url: resolveImgUrl(img), direction: resolveImgDirection(img) }))
                                                                                .filter(x => Boolean(x.url))
                                                                            return (
                                                                            <tr key={pIdx}>
                                                                                <td className="py-2 font-bold text-stone-800 dark:text-stone-200 pr-2">{p.product_name}</td>
                                                                                <td className="py-2 text-stone-500 whitespace-nowrap">{p.unit}</td>
                                                                                <td className="py-2 text-right font-bold text-emerald-600">+{p.in_qty}</td>
                                                                                <td className="py-2 text-right font-bold text-rose-600">-{p.out_qty}</td>
                                                                                <td className="py-2 text-right text-stone-400">{p.count || 0} đợt</td>
                                                                                <td className="py-2 text-right whitespace-nowrap">
                                                                                    {subProdItems.length > 0 ? (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                setPreviewContext({
                                                                                                    urls: subProdItems.map(x => x.url),
                                                                                                    items: subProdItems,
                                                                                                    index: 0,
                                                                                                    title: `${p.product_name} (Đợt #${ss.sub_shift_number})`,
                                                                                                    showDirectionFilter: true,
                                                                                                    directionFilter: 'all',
                                                                                                })
                                                                                            }
                                                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-[11px] font-bold transition"
                                                                                        >
                                                                                            <Camera className="w-3 h-3" />
                                                                                            <span>{subProdItems.length} ảnh</span>
                                                                                        </button>
                                                                                    ) : (
                                                                                        <span className="text-stone-300 dark:text-zinc-600">-</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                            )
                                                                        })}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-stone-400 italic py-1">
                                                                Không có phát sinh hàng hóa trong đợt chốt tạm này.
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs text-stone-500 bg-stone-100/70 dark:bg-zinc-900 px-3 py-2 rounded-lg">
                                                            <span>👤 Người bàn giao: <strong className="text-stone-700 dark:text-stone-200">{ss.closed_by_name || 'Nhân viên'}</strong></span>
                                                            {ss.notes && <span className="italic">💬 "{ss.notes}"</span>}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        )}
                    </div>
                </div>

                {/* 3. THÔNG TIN CÔNG VIỆC (MỞ/CHỐT) */}
                <div className="space-y-2.5 sm:space-y-3 pt-2 border-t border-stone-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                        className="w-full flex items-center justify-between py-1 text-left hover:opacity-80 transition group cursor-pointer"
                    >
                        <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-base">
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-500 shrink-0" />
                            <span>Thông tin</span>
                        </h4>
                        <div className="flex items-center gap-1.5 text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200 shrink-0">
                            <span className="text-[10px] sm:text-[11px] font-medium hidden sm:inline">
                                {isInfoExpanded ? 'Thu lại' : 'Mở rộng'}
                            </span>
                            {isInfoExpanded ? (
                                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                            ) : (
                                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-stone-500" />
                            )}
                        </div>
                    </button>

                    {isInfoExpanded && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-[11px] sm:text-xs pt-1">
                            <div className="bg-white dark:bg-zinc-950 p-2.5 sm:p-3 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs">
                                <div className="font-bold text-stone-400 uppercase mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                        <span>Giờ mở công việc</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onUpdateShiftOpenedAt(doneSelectedShift)
                                        }}
                                        title="Chỉnh sửa ngày & giờ mở công việc"
                                        className="text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-0.5 flex items-center gap-1 font-normal lowercase text-[10px]"
                                    >
                                        <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                        <span>sửa ngày</span>
                                    </button>
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-100">
                                    {formatDateTime(doneSelectedShift.opened_at)}
                                </div>
                                <div className="text-stone-500 mt-1 flex items-center gap-1.5">
                                    <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-400" />
                                    <span>Người mở: <strong>{doneSelectedShift.opened_by_name || 'Nhân viên'}</strong></span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-950 p-2.5 sm:p-3 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-xs">
                                <div className="font-bold text-stone-400 uppercase mb-1 flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                                    <span>Giờ chốt công việc</span>
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-stone-800 dark:text-stone-100">
                                    {doneSelectedShift.closed_at ? (
                                        formatDateTime(doneSelectedShift.closed_at)
                                    ) : (
                                        <span className="text-amber-600 italic">Đang diễn ra...</span>
                                    )}
                                </div>
                                {doneSelectedShift.closed_by_name && (
                                    <div className="text-stone-500 mt-1 flex items-center gap-1.5">
                                        <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-stone-400" />
                                        <span>Người chốt: <strong>{doneSelectedShift.closed_by_name}</strong></span>
                                    </div>
                                )}
                                {doneSelectedShift.summary_data?.order_type_name && (
                                    <div className="text-stone-500 mt-1 flex items-center gap-1.5">
                                        <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-500" />
                                        <span>Loại phiếu: <strong className="text-indigo-600 dark:text-indigo-400">{doneSelectedShift.summary_data.order_type_code ? `${doneSelectedShift.summary_data.order_type_code} - ` : ''}{doneSelectedShift.summary_data.order_type_name}</strong></span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. GHI CHÚ BÀN GIAO CUỐI CA */}
                <div className="space-y-1.5 sm:space-y-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
                    <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-xs sm:text-sm">
                        <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
                        Ghi chú bàn giao cuối ca
                    </h4>
                    <div className="bg-blue-50/40 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 sm:p-3.5 text-[11px] sm:text-xs text-stone-700 dark:text-stone-300 whitespace-pre-wrap">
                        {cleanShiftNotes || <span className="italic text-stone-400">Không có ghi chú</span>}
                    </div>
                </div>
            </div>

            {previewContext && (() => {
                const { urls, items, index, title, showDirectionFilter, directionFilter = 'all' } = previewContext
                const allItems = items || urls.map(url => ({ url, direction: null as 'in' | 'out' | null }))
                const inCount = allItems.filter(x => x.direction === 'in').length
                const outCount = allItems.filter(x => x.direction === 'out').length
                const activeItems =
                    directionFilter === 'in'
                        ? allItems.filter(x => x.direction === 'in')
                        : directionFilter === 'out'
                            ? allItems.filter(x => x.direction === 'out')
                            : allItems
                const safeIdx = Math.min(index, Math.max(0, activeItems.length - 1))
                const hasPrev = safeIdx > 0
                const hasNext = safeIdx < activeItems.length - 1
                const currentItem = activeItems[safeIdx]
                return (
                <div
                    className="fixed inset-0 z-50 bg-black/92 flex flex-col items-center justify-center p-4"
                    onClick={() => setPreviewContext(null)}
                >
                    <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap pr-14" onClick={e => e.stopPropagation()}>
                        <span className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold">
                            {activeItems.length > 0 ? `${safeIdx + 1} / ${activeItems.length}` : '0 / 0'}
                        </span>
                        {currentItem?.direction === 'in' && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold">
                                NHẬP
                            </span>
                        )}
                        {currentItem?.direction === 'out' && (
                            <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold">
                                XUẤT
                            </span>
                        )}
                        {title && (
                            <span className="hidden sm:inline px-3 py-1 rounded-full bg-white/10 text-stone-200 text-xs font-semibold truncate max-w-xs">
                                {title}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setPreviewContext(null)}
                        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-lg font-bold"
                        title="Đóng"
                    >
                        ✕
                    </button>
                    {showDirectionFilter && (
                        <div
                            className="mb-3 mt-10 flex items-center gap-1.5 bg-white/10 p-1 rounded-full border border-white/15"
                            onClick={e => e.stopPropagation()}
                        >
                            {[
                                { key: 'all', label: `Tất cả (${allItems.length})` },
                                { key: 'in', label: `Nhập (${inCount})` },
                                { key: 'out', label: `Xuất (${outCount})` },
                            ].map(tab => {
                                const active = directionFilter === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        onClick={() =>
                                            setPreviewContext(prev =>
                                                prev ? { ...prev, directionFilter: tab.key as any, index: 0 } : null
                                            )
                                        }
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                                            active
                                                ? tab.key === 'in'
                                                    ? 'bg-emerald-600 text-white'
                                                    : tab.key === 'out'
                                                        ? 'bg-rose-600 text-white'
                                                        : 'bg-sky-600 text-white'
                                                : 'text-stone-300 hover:text-white'
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {hasPrev && (
                        <button
                            type="button"
                            onClick={e => {
                                e.stopPropagation()
                                setPreviewContext(prev => (prev ? { ...prev, index: Math.max(0, safeIdx - 1) } : null))
                            }}
                            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/65 hover:bg-black/85 border border-white/25 text-white flex items-center justify-center transition"
                            title="Ảnh trước"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                    )}
                    {currentItem ? (
                        <img
                            src={currentItem.url}
                            alt={title || 'Ảnh chi tiết'}
                            className="max-w-full max-h-[78vh] rounded-xl object-contain shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        />
                    ) : (
                        <div
                            className="px-6 py-12 rounded-xl bg-white/10 text-stone-300 text-sm font-semibold"
                            onClick={e => e.stopPropagation()}
                        >
                            Không có ảnh {directionFilter === 'in' ? 'Nhập' : 'Xuất'} nào cho sản phẩm này.
                        </div>
                    )}
                    {hasNext && (
                        <button
                            type="button"
                            onClick={e => {
                                e.stopPropagation()
                                setPreviewContext(prev => (prev ? { ...prev, index: safeIdx + 1 } : null))
                            }}
                            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/65 hover:bg-black/85 border border-white/25 text-white flex items-center justify-center transition"
                            title="Ảnh tiếp theo"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}
                    {title && (
                        <div className="sm:hidden mt-3 text-center text-xs font-bold text-stone-200">
                            {title}
                        </div>
                    )}
                </div>
                )
            })()}
        </div>
    )
}
