'use client'

import React from 'react'
import { BarChart3, ChevronDown, ChevronRight, Clock, Layers } from 'lucide-react'

interface SummaryTabProps {
    allJobJournals: any[]
    subShifts: any[]
    activeShift: any
    currentJobName: string
    expandedDoneSubShifts: Set<string>
    toggleExpandDoneSubShift: (id: string) => void
    isTwoWayExpanded: boolean
    setIsTwoWayExpanded: (v: boolean) => void
    isUnitsExpanded: boolean
    setIsUnitsExpanded: (v: boolean) => void
    isProductsExpanded: boolean
    setIsProductsExpanded: (v: boolean) => void
    buildEffectiveSubShifts: (subShifts: any[], sortedLines: any[], activeShift: any) => any[]
    summarizeLines: (lines: any[]) => any[]
    formatDateTime: (dateStr: string) => string
    formatCompactRange: (from: string, to: string, isAutoFinal?: boolean) => string
}

/** Tab 2: Báo cáo chi tiết các đợt chốt tạm & Tổng hợp đối soát toàn công việc. */
export default function SummaryTab({
    allJobJournals,
    subShifts,
    activeShift,
    currentJobName,
    expandedDoneSubShifts,
    toggleExpandDoneSubShift,
    isTwoWayExpanded,
    setIsTwoWayExpanded,
    isUnitsExpanded,
    setIsUnitsExpanded,
    isProductsExpanded,
    setIsProductsExpanded,
    buildEffectiveSubShifts,
    summarizeLines,
    formatDateTime,
    formatCompactRange,
}: SummaryTabProps) {
    const sortedAllLines = [...allJobJournals].sort((a, b) => a.sent_at.localeCompare(b.sent_at))
    const activeEffectiveSubShifts = buildEffectiveSubShifts(subShifts, sortedAllLines, activeShift)
    const fullSummaryRows = summarizeLines(sortedAllLines)

    const unitsMap: Record<string, { unit: string; in_qty: number; out_qty: number; in_count: number; out_count: number }> = {}
    let totalInCount = 0
    let totalOutCount = 0
    sortedAllLines.forEach(l => {
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
    const unitsSummaryList = Object.values(unitsMap)

    return (
        <div className="p-3 sm:p-5 space-y-3.5 sm:space-y-5">
            <div className="pb-2.5 sm:pb-3 border-b border-stone-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2 text-[11px] sm:text-xs">
                <span className="text-stone-500">
                    Công việc: <strong className="text-stone-900 dark:text-white font-bold">{currentJobName}</strong>
                </span>
                <span className="text-stone-400">
                    Bắt đầu: {formatDateTime(activeShift.opened_at)} • Tổng: <strong className="text-stone-700 dark:text-stone-200">{sortedAllLines.length} đợt</strong>
                </span>
            </div>

            {/* 1. CHI TIẾT CÁC LẦN CHỐT CA TẠM (ĐỔI CA) */}
            <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-sm min-w-0">
                        <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                        <span className="truncate">Chi tiết các lần chốt ca tạm (đổi ca)</span>
                    </h4>
                    <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold shrink-0 whitespace-nowrap">
                        {subShifts.length} lần chốt tạm
                    </span>
                </div>

                {activeEffectiveSubShifts.length === 0 ? (
                    <div className="bg-amber-50/40 dark:bg-amber-950/10 border border-dashed border-amber-200 dark:border-amber-900/40 rounded-xl px-3 py-2.5 sm:px-3.5 sm:py-3 text-[11px] sm:text-xs text-stone-500">
                        Chưa có lần bấm <strong>Chốt tạm</strong> nào trong công việc này. Khi đổi ca hoặc nghỉ giữa ca, bấm nút <strong>Chốt tạm</strong> ở góc trên để lưu mốc từng đợt.
                    </div>
                ) : (
                    <div className="space-y-2 sm:space-y-3 relative sm:border-l-2 sm:border-amber-200 dark:sm:border-amber-800/60 sm:ml-2.5 sm:pl-5">
                        {activeEffectiveSubShifts.map((ss: any) => {
                            const isExpanded = expandedDoneSubShifts.has(ss.id)
                            const subLines: any[] = ss._subLines || []
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
                                                <span>{ss.is_auto_final ? `Đợt #${ss.sub_shift_number} (Đang nhập)` : `Lần chốt ca tạm #${ss.sub_shift_number}`}</span>
                                                {ss.is_auto_final && (
                                                    <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 whitespace-nowrap">
                                                        Chưa chốt tạm
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <div className="text-[10px] sm:text-xs bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg font-medium text-stone-600 dark:text-stone-300 whitespace-nowrap">
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
                                            <span className="truncate">{formatCompactRange(ss.from_time, ss.to_time, ss.is_auto_final)}</span>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-2.5 sm:px-4 pb-3 pt-2 border-t border-stone-100 dark:border-zinc-800/80 space-y-2 bg-stone-50/40 dark:bg-zinc-900/30">
                                            {subProds.length > 0 ? (
                                                <div className="bg-white dark:bg-zinc-900 rounded-xl p-2 sm:p-3 border border-stone-200 dark:border-zinc-800">
                                                    <div className="text-[9px] sm:text-[11px] font-bold text-stone-400 uppercase mb-1.5 sm:mb-2">
                                                        Hàng hóa trong đợt #{ss.sub_shift_number}
                                                    </div>

                                                    {/* Mobile: Danh sách thẻ gọn */}
                                                    <div className="sm:hidden divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                        {subProds.map((p, pIdx) => (
                                                            <div key={pIdx} className="py-1.5 first:pt-0 last:pb-0 space-y-0.5">
                                                                <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 leading-snug">
                                                                    {p.product_name}
                                                                </div>
                                                                <div className="flex items-center justify-between text-[10px]">
                                                                    <span className="text-stone-500">
                                                                        ĐVT: <strong className="text-stone-700 dark:text-stone-300">{p.unit}</strong> • {p.count || 0} đợt
                                                                    </span>
                                                                    <div className="flex items-center gap-1.5 font-black">
                                                                        <span className="text-emerald-600">+{p.in_qty}</span>
                                                                        <span className="text-stone-300 dark:text-zinc-700">|</span>
                                                                        <span className="text-rose-600">-{p.out_qty}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Desktop: Bảng 5 cột */}
                                                    <table className="hidden sm:table w-full text-left text-xs">
                                                        <thead>
                                                            <tr className="border-b border-stone-100 dark:border-zinc-800 text-stone-400">
                                                                <th className="pb-1.5 font-semibold">Sản phẩm</th>
                                                                <th className="pb-1.5 font-semibold">ĐVT</th>
                                                                <th className="pb-1.5 font-semibold text-right text-emerald-600">Nhập (+)</th>
                                                                <th className="pb-1.5 font-semibold text-right text-rose-600">Xuất (-)</th>
                                                                <th className="pb-1.5 font-semibold text-right">Số đợt</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                            {subProds.map((p, pIdx) => (
                                                                <tr key={pIdx}>
                                                                    <td className="py-2 font-bold text-stone-800 dark:text-stone-200 pr-2">{p.product_name}</td>
                                                                    <td className="py-2 text-stone-500 whitespace-nowrap">{p.unit}</td>
                                                                    <td className="py-2 text-right font-bold text-emerald-600">+{p.in_qty}</td>
                                                                    <td className="py-2 text-right font-bold text-rose-600">-{p.out_qty}</td>
                                                                    <td className="py-2 text-right text-stone-400">{p.count || 0} đợt</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] sm:text-xs text-stone-400 italic py-1">
                                                    Không có phát sinh hàng hóa trong đợt này.
                                                </div>
                                            )}

                                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-xs text-stone-500 bg-stone-100/70 dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg">
                                                <span>👤 Người thực hiện: <strong className="text-stone-700 dark:text-stone-200">{ss.closed_by_name || 'Nhân viên'}</strong></span>
                                                {ss.notes && <span className="italic">💬 "{ss.notes}"</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* 2. TỔNG HỢP ĐỐI SOÁT CẢ CA (CỘNG DỒN TẤT CẢ CÁC ĐỢT CHỐT TẠM + ĐỢT HIỆN TẠI) */}
            <div className="space-y-2 sm:space-y-3 pt-2.5 sm:pt-3 border-t border-stone-100 dark:border-zinc-800">
                <h4 className="font-bold text-stone-800 dark:text-stone-100 flex items-center gap-1.5 text-[11px] sm:text-sm">
                    <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500 shrink-0" />
                    <span>Tổng hợp đối soát cả ca (Sum tổng)</span>
                </h4>

                {/* 2.1. Tổng hợp 2 hướng */}
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
                            <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                Tổng {sortedAllLines.length} đợt
                            </span>
                            {isTwoWayExpanded ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />}
                        </div>
                    </button>
                    {isTwoWayExpanded && (
                        <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-stone-50/40 dark:bg-zinc-900/30">
                            <div className="bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
                                <div className="flex items-center justify-between border-b border-emerald-200/60 dark:border-emerald-800/50 pb-1">
                                    <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase">1. Nhập kho (SX → Kho)</span>
                                    <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">{totalInCount} đợt</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {unitsSummaryList.filter(u => u.in_qty > 0).length === 0 ? (
                                        <span className="text-[11px] sm:text-xs text-stone-400 italic">Chưa phát sinh nhập</span>
                                    ) : (
                                        unitsSummaryList.filter(u => u.in_qty > 0).map(u => (
                                            <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                                +{u.in_qty} {u.unit}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200/70 dark:border-rose-900/40 rounded-xl p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
                                <div className="flex items-center justify-between border-b border-rose-200/60 dark:border-rose-800/50 pb-1">
                                    <span className="text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">2. Xuất kho (Kho → SX)</span>
                                    <span className="text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300">{totalOutCount} đợt</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {unitsSummaryList.filter(u => u.out_qty > 0).length === 0 ? (
                                        <span className="text-[11px] sm:text-xs text-stone-400 italic">Chưa phát sinh xuất</span>
                                    ) : (
                                        unitsSummaryList.filter(u => u.out_qty > 0).map(u => (
                                            <span key={u.unit} className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-300">
                                                -{u.out_qty} {u.unit}
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2.2. Chi tiết theo đơn vị hàng hóa */}
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
                            <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                {unitsSummaryList.length} Đơn vị
                            </span>
                            {isUnitsExpanded ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />}
                        </div>
                    </button>
                    {isUnitsExpanded && (
                        <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 bg-stone-50/40 dark:bg-zinc-900/30 overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
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
                                            <td className="py-1.5 sm:py-2 font-bold text-stone-800 dark:text-stone-100">{u.unit}</td>
                                            <td className="py-1.5 sm:py-2 text-right font-black text-emerald-600">+{u.in_qty}</td>
                                            <td className="py-1.5 sm:py-2 text-right font-black text-rose-600">-{u.out_qty}</td>
                                            <td className="py-1.5 sm:py-2 text-right text-stone-500">{u.in_count + u.out_count} đợt</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 2.3. Bảng tổng hợp theo sản phẩm (toàn công việc) */}
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
                            <span className="text-[10px] sm:text-[11px] bg-stone-100 dark:bg-zinc-800 px-1.5 sm:px-2 py-0.5 rounded font-medium text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                {fullSummaryRows.length} SP
                            </span>
                            {isProductsExpanded ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-stone-400" />}
                        </div>
                    </button>
                    {isProductsExpanded && (
                        <div className="p-2.5 sm:p-4 border-t border-stone-100 dark:border-zinc-800/80 bg-stone-50/40 dark:bg-zinc-900/30">
                            {fullSummaryRows.length === 0 ? (
                                <div className="py-5 text-center text-[11px] sm:text-xs text-stone-400">
                                    Chưa có dữ liệu thống kê cho công việc này.
                                </div>
                            ) : (
                                <>
                                    {/* Mobile: Hiển thị dạng danh sách thẻ rõ ràng, không gãy cột */}
                                    <div className="sm:hidden divide-y divide-stone-200/70 dark:divide-zinc-800">
                                        {fullSummaryRows.map((row, idx) => (
                                            <div key={idx} className="py-2 first:pt-0 last:pb-0 space-y-1">
                                                <div className="text-[11px] font-bold text-stone-900 dark:text-white leading-snug">
                                                    {row.product_name}
                                                </div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="text-stone-500">
                                                        ĐVT: <strong className="text-stone-700 dark:text-stone-300">{row.unit}</strong> • {row.count} đợt
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-black">
                                                            +{row.in_qty}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-black">
                                                            -{row.out_qty}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop: Bảng 5 cột */}
                                    <table className="hidden sm:table w-full text-left text-xs">
                                        <thead>
                                            <tr className="border-b border-stone-200 dark:border-zinc-800 text-stone-400 font-semibold uppercase">
                                                <th className="pb-2">Sản phẩm</th>
                                                <th className="pb-2">ĐVT</th>
                                                <th className="pb-2 text-right text-emerald-600">Tổng Nhập (+)</th>
                                                <th className="pb-2 text-right text-rose-600">Tổng Xuất (-)</th>
                                                <th className="pb-2 text-right">Số đợt chốt</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                            {fullSummaryRows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-zinc-800/40">
                                                    <td className="py-2.5 font-bold text-stone-900 dark:text-white pr-2">
                                                        {row.product_name}
                                                    </td>
                                                    <td className="py-2.5 text-stone-500 whitespace-nowrap">{row.unit}</td>
                                                    <td className="py-2.5 text-right font-black text-emerald-600">
                                                        +{row.in_qty}
                                                    </td>
                                                    <td className="py-2.5 text-right font-black text-rose-600">
                                                        -{row.out_qty}
                                                    </td>
                                                    <td className="py-2.5 text-right text-stone-400 whitespace-nowrap">
                                                        {row.count} đợt
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
