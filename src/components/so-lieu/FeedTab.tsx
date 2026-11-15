'use client'

import React from 'react'
import {
    ArrowDownLeft,
    ArrowUpRight,
    Camera,
    ChevronDown,
    ChevronRight,
    Clock,
    Layers,
    Pencil,
    Trash2,
} from 'lucide-react'

interface FeedTabProps {
    journalTypeFilter: 'all' | 'in' | 'out'
    allJobJournals: any[]
    journalList: any[]
    currentJobName: string
    subShifts: any[]
    expandedFeedSubShifts: Set<string>
    toggleExpandFeedSubShift: (id: string) => void
    allProducts: any[]
    journalImageCounts: Record<string, number>
    cleanUserNotes: (notes?: string | null) => string
    formatDateTime: (dateStr: string) => string
    formatCompactRange: (from: string, to: string, isAutoFinal?: boolean) => string
    onOpenImageModal: (target: {
        journalId: string
        itemName: string
        itemSku: string | null
        direction: 'in' | 'out'
        quantity: number
        unit: string
    }) => void
    onStartEdit: (record: any) => void
    onDeleteJournal: (id: string) => void
}

/** Tab 1: Realtime Feed (Lịch sử vừa bấm & các lần chốt tạm). */
export default function FeedTab({
    journalTypeFilter,
    allJobJournals,
    journalList,
    currentJobName,
    subShifts,
    expandedFeedSubShifts,
    toggleExpandFeedSubShift,
    allProducts,
    journalImageCounts,
    cleanUserNotes,
    formatDateTime,
    formatCompactRange,
    onOpenImageModal,
    onStartEdit,
    onDeleteJournal,
}: FeedTabProps) {
    const filterLines = (lines: any[]) => {
        if (journalTypeFilter === 'in') return lines.filter(l => l.to_department === 'Kho')
        if (journalTypeFilter === 'out') return lines.filter(l => l.to_department !== 'Kho')
        return lines
    }

    const renderJournalRow = (record: any) => {
        const isImport = record.to_department === 'Kho'
        const userNote = cleanUserNotes(record.notes)
        return (
            <div
                key={record.id}
                className="px-2.5 sm:px-4 py-2 sm:py-3 flex items-start gap-2 sm:gap-2.5 hover:bg-stone-50 dark:hover:bg-zinc-800/40 transition text-[11px] sm:text-xs"
            >
                <div
                    className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                        isImport
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400'
                    }`}
                >
                    {isImport ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                </div>

                <div className="min-w-0 flex-1 space-y-1 sm:space-y-1.5">
                    {/* Hàng 1: Tên sản phẩm + Nút Sửa/Xóa (không đè lên badge số lượng) */}
                    <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-stone-900 dark:text-white break-words leading-snug min-w-0 flex-1">
                            {record.item_name}
                        </span>
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                            <span
                                className={`hidden sm:inline-flex px-2 py-0.5 rounded-md font-black text-[11px] whitespace-nowrap ${
                                    isImport
                                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                                }`}
                            >
                                {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    const matchedProduct = allProducts.find(p => p.name === record.item_name)
                                    onOpenImageModal({
                                        journalId: record.id,
                                        itemName: record.item_name,
                                        itemSku: matchedProduct?.sku || null,
                                        direction: isImport ? 'in' : 'out',
                                        quantity: record.quantity_sent,
                                        unit: record.unit,
                                    })
                                }}
                                title={
                                    (journalImageCounts[record.id] || 0) > 0
                                        ? `Xem / bổ sung ảnh (${journalImageCounts[record.id]} ảnh)`
                                        : 'Bổ sung ảnh cho đợt này'
                                }
                                className={`h-6 sm:h-8 px-1.5 sm:px-2 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 active:scale-90 transition shrink-0 text-[10px] sm:text-xs font-bold ${
                                    (journalImageCounts[record.id] || 0) > 0
                                        ? 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800'
                                        : 'bg-stone-100 hover:bg-sky-50 dark:bg-zinc-800 dark:hover:bg-sky-950/50 text-stone-500 hover:text-sky-600 dark:text-stone-400 dark:hover:text-sky-300'
                                }`}
                            >
                                <Camera className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span>
                                    {(journalImageCounts[record.id] || 0) > 0
                                        ? journalImageCounts[record.id]
                                        : '+'}
                                </span>
                            </button>
                            <button
                                onClick={() => onStartEdit(record)}
                                title="Chỉnh sửa dòng này"
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-950/50 text-stone-500 hover:text-indigo-600 dark:text-stone-400 dark:hover:text-indigo-300 flex items-center justify-center active:scale-90 transition shrink-0"
                            >
                                <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </button>
                            <button
                                onClick={() => onDeleteJournal(record.id)}
                                title="Xóa lượt bấm này nếu bấm nhầm"
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-stone-100 hover:bg-rose-50 dark:bg-zinc-800 dark:hover:bg-rose-950/50 text-stone-500 hover:text-rose-600 dark:text-stone-400 dark:hover:text-rose-300 flex items-center justify-center active:scale-90 transition shrink-0"
                            >
                                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Hàng 2 (Mobile): Badge số lượng */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                            className={`sm:hidden px-1.5 py-0.5 rounded-md font-black text-[10px] whitespace-nowrap ${
                                isImport
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60'
                                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60'
                            }`}
                        >
                            {isImport ? `+${record.quantity_sent}` : `-${record.quantity_sent}`} {record.unit}
                        </span>
                        <span className="hidden sm:inline text-[11px] text-stone-400">
                            {formatDateTime(record.sent_at)} • {record.sent_by_name || 'Nhân viên'}
                            {userNote ? ` • 💬 ${userNote}` : ''}
                        </span>
                    </div>

                    {/* Hàng 3 (Mobile): Thời gian • Người nhập trên 1 dòng thoáng */}
                    <div className="sm:hidden text-[10px] text-stone-400 flex items-center gap-1.5 flex-wrap">
                        <span>{formatDateTime(record.sent_at)}</span>
                        <span>•</span>
                        <span>{record.sent_by_name || 'Nhân viên'}</span>
                        {userNote && <span>• 💬 {userNote}</span>}
                    </div>
                </div>
            </div>
        )
    }

    if (allJobJournals.length === 0 && journalList.length === 0) {
        return (
            <div className="p-6 sm:p-8 text-center text-[11px] sm:text-xs text-stone-400">
                Chưa có đợt ghi nhận nào trong công việc "{currentJobName}".
            </div>
        )
    }

    // Nếu chưa có lần chốt tạm nào: hiển thị danh sách phẳng thông thường
    if (subShifts.length === 0) {
        const linesToShow = filterLines(allJobJournals.length > 0 ? allJobJournals : journalList)
        if (linesToShow.length === 0) {
            return (
                <div className="p-6 sm:p-8 text-center text-[11px] sm:text-xs text-stone-400">
                    Không có đợt {journalTypeFilter === 'in' ? 'Nhập' : 'Xuất'} nào khớp với bộ lọc.
                </div>
            )
        }
        return (
            <div className="divide-y divide-stone-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
                {linesToShow.map(record => renderJournalRow(record))}
            </div>
        )
    }

    // Nếu đã có các lần chốt tạm: phân chia thành Đợt hiện tại và Khung các lần chốt tạm (có thể thu lại / mở rộng)
    const latestSub = subShifts[subShifts.length - 1]
    const rawCurrentBatchLines = allJobJournals.filter(l => l.sent_at > latestSub.to_time)
    const currentBatchLines = filterLines(rawCurrentBatchLines)

    return (
        <div className="p-2.5 sm:p-4 space-y-3.5 sm:space-y-4 max-h-[560px] overflow-y-auto">
            {/* 1. Đợt hiện tại đang nhập */}
            <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between px-1 text-[11px] sm:text-xs">
                    <span className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Đang nhập: Đợt #{subShifts.length + 1}
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-stone-400">
                        {currentBatchLines.length} đợt phát sinh
                    </span>
                </div>

                {currentBatchLines.length === 0 ? (
                    <div className="p-3 text-center text-[11px] sm:text-xs text-stone-400 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-dashed border-stone-200 dark:border-zinc-700/60">
                        {rawCurrentBatchLines.length === 0
                            ? 'Chưa có phát sinh số liệu mới sau lần chốt tạm gần nhất.'
                            : `Không có đợt ${journalTypeFilter === 'in' ? 'Nhập' : 'Xuất'} nào trong đợt hiện tại.`}
                    </div>
                ) : (
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800 overflow-hidden shadow-xs">
                        {currentBatchLines.map(record => renderJournalRow(record))}
                    </div>
                )}
            </div>

            {/* 2. Khung các lần chốt tạm đã lưu (bao bọc trong khung có thể mở rộng / thu lại) */}
            <div className="space-y-2 sm:space-y-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
                <div className="text-[10px] sm:text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        Các lần chốt ca tạm đã lưu ({subShifts.length})
                    </span>
                    <span className="hidden sm:inline text-[10px] text-stone-400 normal-case font-normal">
                        Bấm vào khung để mở rộng / thu lại
                    </span>
                </div>

                <div className="space-y-2 sm:space-y-2.5">
                    {[...subShifts].reverse().map((ss: any) => {
                        const isExpanded = expandedFeedSubShifts.has(ss.id)
                        const originalIdx = subShifts.findIndex(s => s.id === ss.id)
                        const prevToTime = originalIdx > 0 ? subShifts[originalIdx - 1].to_time : ss.from_time
                        const rawSubLines = allJobJournals.filter(l =>
                            originalIdx === 0
                                ? (l.sent_at >= ss.from_time && l.sent_at <= ss.to_time)
                                : (l.sent_at > prevToTime && l.sent_at <= ss.to_time)
                        )
                        const subLines = filterLines(rawSubLines)
                        const totalIn = rawSubLines.filter(l => l.to_department === 'Kho').reduce((s, l) => s + (Number(l.quantity_sent) || 0), 0)
                        const totalOut = rawSubLines.filter(l => l.to_department !== 'Kho').reduce((s, l) => s + (Number(l.quantity_sent) || 0), 0)

                        return (
                            <div
                                key={ss.id}
                                className="bg-white dark:bg-zinc-950 border border-amber-200/80 dark:border-amber-900/50 rounded-xl overflow-hidden shadow-xs transition"
                            >
                                {/* Header khung chốt tạm: Gọn 2 hàng trên Mobile, không bao giờ gãy chữ */}
                                <button
                                    type="button"
                                    onClick={() => toggleExpandFeedSubShift(ss.id)}
                                    className="w-full p-2.5 sm:p-3 text-left bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/35 transition space-y-1"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-[11px] sm:text-sm font-bold text-amber-800 dark:text-amber-400 truncate">
                                                Lần chốt ca tạm #{ss.sub_shift_number}
                                            </span>
                                            <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold shrink-0 whitespace-nowrap">
                                                {subLines.length} đợt
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className="bg-white dark:bg-zinc-900 px-1.5 sm:px-2 py-0.5 rounded-lg border border-amber-200/60 dark:border-amber-900/40 font-medium text-stone-600 dark:text-stone-300 text-[10px] sm:text-[11px] whitespace-nowrap">
                                                <strong className="text-emerald-600">+{totalIn}</strong>
                                                <span className="mx-1 text-stone-300 dark:text-zinc-700">|</span>
                                                <strong className="text-rose-600">-{totalOut}</strong>
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

                                {/* Nội dung danh sách các đợt khi mở rộng khung */}
                                {isExpanded && (
                                    <div className="border-t border-amber-100 dark:border-amber-900/40 divide-y divide-stone-100 dark:divide-zinc-800/80">
                                        {subLines.length === 0 ? (
                                            <div className="p-3 sm:p-4 text-center text-[11px] sm:text-xs text-stone-400 italic">
                                                {rawSubLines.length === 0
                                                    ? 'Không có đợt ghi nhận nào trong lần chốt này.'
                                                    : `Không có đợt ${journalTypeFilter === 'in' ? 'Nhập' : 'Xuất'} nào trong lần chốt này.`}
                                            </div>
                                        ) : (
                                            subLines.map(record => renderJournalRow(record))
                                        )}

                                        <div className="p-2 sm:p-2.5 bg-stone-50/70 dark:bg-zinc-900/60 text-[10px] sm:text-[11px] text-stone-500 flex flex-wrap items-center justify-between gap-2 px-2.5 sm:px-3">
                                            <span>👤 Người chốt tạm: <strong className="text-stone-700 dark:text-stone-200">{ss.closed_by_name || 'Nhân viên'}</strong></span>
                                            {ss.notes && <span className="italic">💬 "{ss.notes}"</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
