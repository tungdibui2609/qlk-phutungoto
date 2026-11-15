'use client'

import React from 'react'
import { BarChart3, Briefcase, ChevronDown, Clock, Download, ExternalLink, Eye, Layers, RefreshCw, Tag } from 'lucide-react'
import { DeliveryJournalRecord } from './types'
import { formatDateTime } from './utils'

interface AggregatedReportViewProps {
    title: string
    systemName: string
    shifts: any[]
    lines: DeliveryJournalRecord[]
    loading: boolean
    onExport: () => void
    exportButtonText: string
    aggregateShiftsProducts: (shifts: any[], lines: DeliveryJournalRecord[]) => any[]
    summarizeLines: (lines: DeliveryJournalRecord[], shift?: any) => any[]
    findProductSku: (pName: string, pId?: string, pinnedList?: any[]) => string
    getShiftLocalDateString: (isoString?: string) => string
    expandedShiftIdsInReport: Set<string>
    setExpandedShiftIdsInReport: React.Dispatch<React.SetStateAction<Set<string>>>
    onOpenSingleShift: (shift: any) => void
}

export default function AggregatedReportView({
    title,
    systemName,
    shifts,
    lines,
    loading,
    onExport,
    exportButtonText,
    aggregateShiftsProducts,
    summarizeLines,
    findProductSku,
    getShiftLocalDateString,
    expandedShiftIdsInReport,
    setExpandedShiftIdsInReport,
    onOpenSingleShift,
}: AggregatedReportViewProps) {
    // Tính toán số liệu mặt hàng
    const prodRows = aggregateShiftsProducts(shifts, lines)

    // Tính toán số liệu đơn vị tính
    const unitMap: Record<string, { unit: string; in_qty: number; out_qty: number; count: number }> = {}
    prodRows.forEach(r => {
        const u = r.unit || 'ĐVT'
        if (!unitMap[u]) unitMap[u] = { unit: u, in_qty: 0, out_qty: 0, count: 0 }
        unitMap[u].in_qty += r.in_qty
        unitMap[u].out_qty += r.out_qty
        unitMap[u].count += r.count
    })
    const unitRows = Object.values(unitMap)

    return (
        <div className="space-y-4">
            {/* Thanh tiêu đề báo cáo & Nút Xuất Excel */}
            <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                            <BarChart3 className="w-5 h-5" />
                        </span>
                        <h2 className="text-base sm:text-lg font-bold text-stone-900 dark:text-white">
                            {title}
                        </h2>
                    </div>
                    <div className="text-xs text-stone-500 flex items-center gap-2 flex-wrap">
                        <span>Kho: <strong className="text-stone-700 dark:text-stone-300">{systemName}</strong></span>
                        <span>•</span>
                        <span>Tổng số: <strong className="text-indigo-600 dark:text-indigo-400">{shifts.length} công việc</strong></span>
                        <span>•</span>
                        <span>Phát sinh: <strong className="text-emerald-600">{prodRows.length} mặt hàng</strong></span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onExport}
                        disabled={loading || prodRows.length === 0}
                        className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        <span>{exportButtonText}</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl p-12 text-center text-xs text-stone-400 flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                    <span>Đang tổng hợp số liệu từ các công việc...</span>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* BẢNG 1: CHI TIẾT THEO MẶT HÀNG */}
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Tag className="w-4 h-4 text-sky-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                                    1. Chi tiết theo Mặt Hàng
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                                    {prodRows.length} SP
                                </span>
                            </div>
                        </div>

                        {prodRows.length === 0 ? (
                            <div className="p-8 text-center text-xs text-stone-400">
                                Chưa có phát sinh số liệu trong danh sách công việc này.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-stone-50 dark:bg-zinc-950 text-stone-500 text-[11px] uppercase border-b border-stone-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="py-2.5 px-3 font-semibold text-center w-12">STT</th>
                                            <th className="py-2.5 px-3 font-semibold">Sản phẩm</th>
                                            <th className="py-2.5 px-3 font-semibold text-center w-28">ĐVT</th>
                                            <th className="py-2.5 px-3 font-semibold text-right text-emerald-600 w-32">Nhập (+)</th>
                                            <th className="py-2.5 px-3 font-semibold text-right text-rose-600 w-32">Xuất (-)</th>
                                            <th className="py-2.5 px-3 font-semibold text-center w-24">Số đợt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                        {prodRows.map((r, idx) => (
                                            <tr key={`${r.product_name}_${r.unit}_${idx}`} className="hover:bg-stone-50/60 dark:hover:bg-zinc-800/40">
                                                <td className="py-2.5 px-3 text-center text-stone-400 font-mono text-[11px]">{idx + 1}</td>
                                                <td className="py-2.5 px-3">
                                                    <div className="font-semibold text-stone-900 dark:text-white leading-tight">
                                                        {r.product_name}
                                                    </div>
                                                    {r.jobs && r.jobs.length > 0 && (
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                                            {r.jobs.map((j: any, jIdx: number) => (
                                                                <span
                                                                    key={jIdx}
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 border border-stone-200/60 dark:border-zinc-700/60"
                                                                >
                                                                    <Briefcase className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                                                    <span>{j.name}</span>
                                                                    {r.jobs.length > 1 && (
                                                                        <span className="text-[9px] text-stone-400 font-normal">
                                                                            (N:{j.in_qty > 0 ? `+${j.in_qty}` : '0'}/X:{j.out_qty > 0 ? `-${j.out_qty}` : '0'})
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{r.unit}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                                                    {r.in_qty > 0 ? `+${r.in_qty.toLocaleString('vi-VN')}` : '0'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                                                    {r.out_qty > 0 ? `-${r.out_qty.toLocaleString('vi-VN')}` : '0'}
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-stone-500">{r.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* BẢNG 2: TỔNG HỢP THEO ĐƠN VỊ TÍNH */}
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                                    2. Tổng hợp theo Đơn Vị Tính
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                                    {unitRows.length} ĐVT
                                </span>
                            </div>
                        </div>

                        {unitRows.length === 0 ? (
                            <div className="p-8 text-center text-xs text-stone-400">
                                Chưa có phát sinh số liệu.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-stone-50 dark:bg-zinc-950 text-stone-500 text-[11px] uppercase border-b border-stone-200 dark:border-zinc-800">
                                        <tr>
                                            <th className="py-2.5 px-3 font-semibold text-center w-12">STT</th>
                                            <th className="py-2.5 px-3 font-semibold">Đơn vị tính</th>
                                            <th className="py-2.5 px-3 font-semibold text-right text-emerald-600 w-36">Nhập (+)</th>
                                            <th className="py-2.5 px-3 font-semibold text-right text-rose-600 w-36">Xuất (-)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                        {unitRows.map((u, idx) => (
                                            <tr key={`${u.unit}_${idx}`} className="hover:bg-stone-50/60 dark:hover:bg-zinc-800/40">
                                                <td className="py-2.5 px-3 text-center text-stone-400 font-mono text-[11px]">{idx + 1}</td>
                                                <td className="py-2.5 px-3 font-bold text-stone-900 dark:text-white">{u.unit}</td>
                                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                                                    {u.in_qty > 0 ? `+${u.in_qty.toLocaleString('vi-VN')}` : '0'}
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                                                    {u.out_qty > 0 ? `-${u.out_qty.toLocaleString('vi-VN')}` : '0'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* BẢNG 3: DANH SÁCH CÁC CÔNG VIỆC THAM GIA */}
                    <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                        <div className="px-4 py-3 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/60 dark:bg-zinc-950/60 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Briefcase className="w-4 h-4 text-amber-500" />
                                <span className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                                    3. Danh sách các công việc ({shifts.length})
                                </span>
                            </div>
                        </div>

                        <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                            {shifts.map((s, idx) => {
                                const jobTitle = s.summary_data?.job_name || s.notes || `Công việc #${idx + 1}`
                                const pCount = Object.keys(s.summary_data?.products_summary || {}).length
                                const rCount = s.summary_data?.total_records ?? 0
                                const isClosed = s.status === 'closed'
                                const isExpanded = expandedShiftIdsInReport.has(s.id)

                                // Lấy danh sách sản phẩm của riêng công việc này
                                const shiftLines = lines.filter(l => (l.notes || '').includes(`[CV_ID: ${s.id}]`))
                                const rawShiftProds: any[] = shiftLines.length > 0
                                    ? summarizeLines(shiftLines, s)
                                    : Object.values(s.summary_data?.products_summary || {})
                                const shiftProdList = rawShiftProds.map((p: any) => ({
                                    ...p,
                                    sku: p.sku || findProductSku(p.product_name, p.product_id, s.summary_data?.pinned_products)
                                }))

                                const toggleExpand = () => {
                                    setExpandedShiftIdsInReport(prev => {
                                        const next = new Set(prev)
                                        if (next.has(s.id)) next.delete(s.id)
                                        else next.add(s.id)
                                        return next
                                    })
                                }

                                return (
                                    <div key={s.id || idx} className="p-3.5 hover:bg-stone-50/50 dark:hover:bg-zinc-800/30 transition">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="space-y-1 flex-1 cursor-pointer" onClick={toggleExpand}>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white hover:text-indigo-600 transition">
                                                        {jobTitle}
                                                    </span>
                                                    {isClosed ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            Đã chốt
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            Đang mở
                                                        </span>
                                                    )}
                                                    {/* Chú ý: Đóng ca vào ngày hôm sau */}
                                                    {s.closed_at && getShiftLocalDateString(s.opened_at) !== getShiftLocalDateString(s.closed_at) && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            <span>🌙 Đóng ca vào ngày hôm sau ({formatDateTime(s.closed_at)})</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-stone-500 flex items-center gap-2 flex-wrap">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-stone-400" />
                                                        {formatDateTime(s.opened_at)} → {s.closed_at ? formatDateTime(s.closed_at) : 'Hiện tại'}
                                                    </span>
                                                    <span>•</span>
                                                    <span>Người chốt/mở: <strong className="text-stone-700 dark:text-stone-300">{s.closed_by_name || s.opened_by_name || 'Nhân viên'}</strong></span>
                                                    <span>•</span>
                                                    <span>{pCount} SP • {rCount} đợt</span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={toggleExpand}
                                                className={`self-start sm:self-auto h-7 px-3 rounded-lg border text-[11px] font-bold transition flex items-center gap-1.5 ${
                                                    isExpanded
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                                                        : 'border-stone-200 dark:border-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-600 dark:text-stone-300'
                                                }`}
                                            >
                                                <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                                <span>{isExpanded ? 'Thu gọn kết quả' : 'Xem chi tiết ca'}</span>
                                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-500' : 'text-stone-400'}`} />
                                            </button>
                                        </div>

                                        {/* KHU VỰC MỞ RỘNG KẾT QUẢ CHI TIẾT NGAY TẠI CHỖ */}
                                        {isExpanded && (
                                            <div className="mt-3 pt-3 border-t border-stone-200/80 dark:border-zinc-800 bg-stone-50/70 dark:bg-zinc-950/50 -mx-3.5 -mb-3.5 p-3.5 rounded-b-xl space-y-3">
                                                {/* Bảng sản phẩm của riêng công việc này */}
                                                <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
                                                    <div className="px-3 py-2 bg-stone-100/70 dark:bg-zinc-800/60 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between text-[11px] font-bold">
                                                        <div className="flex items-center gap-1.5 text-stone-700 dark:text-stone-200">
                                                            <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                                            <span>Chi tiết sản phẩm ({shiftProdList.length} SP)</span>
                                                        </div>
                                                        {shiftLines.length > 0 && (
                                                            <span className="text-stone-400 font-normal">{shiftLines.length} lượt ghi nhận</span>
                                                        )}
                                                    </div>

                                                    {shiftProdList.length === 0 ? (
                                                        <div className="p-3 text-center text-[11px] text-stone-400">
                                                            Chưa có phát sinh số liệu trong công việc này.
                                                        </div>
                                                    ) : (
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-[11px] text-left">
                                                                <thead className="bg-stone-50 dark:bg-zinc-950 text-stone-400 text-[10px] uppercase border-b border-stone-100 dark:border-zinc-800">
                                                                    <tr>
                                                                        <th className="py-2 px-3 text-center w-8">STT</th>
                                                                        <th className="py-2 px-3">Sản phẩm</th>
                                                                        <th className="py-2 px-3 text-center w-24">ĐVT</th>
                                                                        <th className="py-2 px-3 text-right text-emerald-600 w-32">Nhập (+)</th>
                                                                        <th className="py-2 px-3 text-right text-rose-600 w-32">Xuất (-)</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/60">
                                                                    {shiftProdList.map((p: any, pIdx: number) => {
                                                                        const inQ = Number(p.in_qty) || 0
                                                                        const outQ = Number(p.out_qty) || 0
                                                                        return (
                                                                            <tr key={pIdx} className="hover:bg-stone-50/50 dark:hover:bg-zinc-800/30">
                                                                                <td className="py-2 px-3 text-center text-stone-400 text-[10px]">{pIdx + 1}</td>
                                                                                <td className="py-2 px-3 font-semibold text-stone-900 dark:text-white">
                                                                                    {p.product_name}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{p.unit}</td>
                                                                                <td className="py-2 px-3 text-right font-bold text-emerald-600">
                                                                                    {inQ > 0 ? `+${inQ.toLocaleString('vi-VN')}` : '0'}
                                                                                </td>
                                                                                <td className="py-2 px-3 text-right font-bold text-rose-600">
                                                                                    {outQ > 0 ? `-${outQ.toLocaleString('vi-VN')}` : '0'}
                                                                                </td>
                                                                            </tr>
                                                                        )
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Ghi chú & Nút chuyển sang xem trang quản trị riêng nếu muốn */}
                                                <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500 pt-1">
                                                    <span className="truncate italic">
                                                        {s.notes ? s.notes.replace(/\[CV:[^\]]*\]/g, '').replace(/\[CV_ID:[^\]]*\]/g, '').trim() || 'Không có ghi chú thêm.' : 'Không có ghi chú thêm.'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            onOpenSingleShift(s)
                                                        }}
                                                        className="shrink-0 text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1"
                                                    >
                                                        <span>Mở trang chi tiết ca</span>
                                                        <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
