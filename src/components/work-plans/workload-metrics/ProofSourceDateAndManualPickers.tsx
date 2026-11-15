'use client'

import React from 'react'
import Link from 'next/link'
import { ExternalLink, Check, Loader2, Calendar } from 'lucide-react'
import { WorkloadMetrics, LinkedLotDateSummary, LinkedApprovedAssignmentSummary, formatVNDateSlash } from '../types'
import type { ProofSourceTab } from './helpers'

interface ProofSourceDateAndManualPickersProps {
    activeSourceTab: ProofSourceTab
    value: WorkloadMetrics
    isStatistics: boolean
    quickDatePills: { date: string; label: string }[]
    lotDates: string[]
    lotDateInput: string
    setLotDateInput: React.Dispatch<React.SetStateAction<string>>
    handleToggleLotDate: (dateStr: string) => void
    handleAddLotDate: (dateStr: string) => void
    handleRemoveLotDate: (dateStr: string) => void
    loadingLotSummaries: boolean
    lotDateSummaries: LinkedLotDateSummary[]
    handleToggleLotSummary: (summary: LinkedLotDateSummary) => void
    assignDates: string[]
    assignDateInput: string
    setAssignDateInput: React.Dispatch<React.SetStateAction<string>>
    handleToggleAssignDate: (dateStr: string) => void
    handleAddAssignDate: (dateStr: string) => void
    handleRemoveAssignDate: (dateStr: string) => void
    loadingAssignSummaries: boolean
    assignSummaries: LinkedApprovedAssignmentSummary[]
    handleToggleApprovedAssignment: (summary: LinkedApprovedAssignmentSummary) => void
    manualMetricInputs: React.ReactNode
}

export function ProofSourceDateAndManualPickers({
    activeSourceTab,
    value,
    isStatistics,
    quickDatePills,
    lotDates,
    lotDateInput,
    setLotDateInput,
    handleToggleLotDate,
    handleAddLotDate,
    handleRemoveLotDate,
    loadingLotSummaries,
    lotDateSummaries,
    handleToggleLotSummary,
    assignDates,
    assignDateInput,
    setAssignDateInput,
    handleToggleAssignDate,
    handleAddAssignDate,
    handleRemoveAssignDate,
    loadingAssignSummaries,
    assignSummaries,
    handleToggleApprovedAssignment,
    manualMetricInputs,
}: ProofSourceDateAndManualPickersProps) {
    return (
        <>
            {/* TAB 4: LOTs Created by Date Picker (/warehouses/lots) - Supports Selecting Arbitrary Multiple Dates */}
            {activeSourceTab === 'lots_by_date' && (() => {
                const isMulti = lotDates.length > 1
                const rangeItems = lotDateSummaries.filter(s => s.created_date.includes(','))
                const dailyItems = lotDateSummaries.filter(s => !s.created_date.includes(','))

                const renderLotCard = (sum: LinkedLotDateSummary) => {
                    const isSelected = (value.linked_lot_summaries || []).some(
                        s => s.id === sum.id
                    )
                    const isCombined = sum.created_date.includes(',')
                    return (
                        <div
                            key={sum.id}
                            onClick={() => handleToggleLotSummary(sum)}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all text-xs ${isSelected
                                ? 'bg-teal-50 border-teal-400 text-teal-950 ring-1 ring-teal-400 shadow-2xs'
                                : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                                }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                    className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${isSelected
                                        ? 'bg-teal-600 border-teal-600 text-white'
                                        : 'border-stone-300 bg-white'
                                        }`}
                                >
                                    {isSelected && <Check size={11} />}
                                </div>
                                <div className="truncate">
                                    <div className="font-extrabold flex items-center gap-1.5 text-teal-950">
                                        <span>📚 {isCombined ? `Gộp cả đợt (${sum.date_label || 'nhiều ngày'})` : `Ngày ${sum.date_label || formatVNDateSlash(sum.created_date)}`}</span>
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-teal-100 text-teal-800">
                                            Số tổng
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-stone-400">
                                        Toàn bộ các kho cộng dồn
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <span className="px-2 py-0.5 rounded-md bg-teal-100/90 text-teal-900 font-black">
                                    🏷️ {sum.lots_count} LOT
                                </span>
                                {sum.assigned_positions_count > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 font-bold text-[10px]">
                                        📍 {sum.assigned_positions_count} vị trí
                                    </span>
                                )}
                                {(sum.packages_count ?? 0) > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-[10px]">
                                        📦 {sum.packages_count?.toLocaleString('vi-VN')} {sum.package_unit || 'Thùng'}
                                    </span>
                                )}
                                {sum.estimated_weight_kg && sum.estimated_weight_kg > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                                        ⚖️ {sum.estimated_weight_kg.toLocaleString('vi-VN')} kg
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                }

                return (
                    <div className="bg-white rounded-xl border border-teal-200 p-3 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-teal-100">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                                <span className="text-xs font-black text-teal-950 uppercase tracking-wider">
                                    📚 Bảng chọn: Số LOT tạo theo ngày (/warehouses/lots)
                                </span>
                            </div>
                        </div>

                        {/* Header & Date Selector Bar */}
                        <div className="space-y-2 pb-1 border-b border-stone-100">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                                    <Calendar size={14} className="text-teal-600" />
                                    <span>Tùy chọn các ngày tạo LOT (Chọn nhiều ngày bất kỳ):</span>
                                </div>

                                <Link
                                    href="/warehouses/lots"
                                    target="_blank"
                                    className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold inline-flex items-center gap-1 shrink-0"
                                >
                                    Mở /warehouses/lots <ExternalLink size={11} />
                                </Link>
                            </div>

                            {/* Quick Toggle Pills */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-stone-500 mr-0.5">Bấm chọn nhanh:</span>
                                {quickDatePills.map(p => {
                                    const isSelected = lotDates.includes(p.date)
                                    return (
                                        <button
                                            key={p.date}
                                            type="button"
                                            onClick={() => handleToggleLotDate(p.date)}
                                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border transition-all inline-flex items-center gap-1 ${isSelected
                                                ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                                : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                                                }`}
                                        >
                                            {isSelected && <Check size={11} />}
                                            <span>{p.label}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Active Dates Chips & Date Input Adder */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-stone-600">
                                        Đã chọn ({lotDates.length} ngày):
                                    </span>
                                    {[...lotDates].sort().map(d => (
                                        <span
                                            key={d}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-teal-900 border border-teal-200 text-xs font-black"
                                        >
                                            <span>{formatVNDateSlash(d)}</span>
                                            {lotDates.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLotDate(d)}
                                                    className="text-teal-400 hover:text-rose-600 font-bold ml-0.5"
                                                    title="Bỏ ngày này"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1 ml-auto">
                                    <input
                                        type="date"
                                        value={lotDateInput}
                                        onChange={e => setLotDateInput(e.target.value)}
                                        className="px-2 py-0.5 rounded border border-stone-200 text-xs font-bold text-stone-800 outline-hidden focus:border-teal-500 bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddLotDate(lotDateInput)}
                                        className="px-2.5 py-0.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-2xs transition-colors"
                                    >
                                        + Thêm ngày
                                    </button>
                                </div>
                            </div>
                        </div>

                        {loadingLotSummaries ? (
                            <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                                <Loader2 size={15} className="animate-spin text-teal-600" />
                                Đang thống kê số LOT tạo cho {lotDates.length} ngày đã chọn...
                            </div>
                        ) : lotDateSummaries.length === 0 ? (
                            <div className="py-4 text-center text-xs text-stone-500">
                                Không có LOT nào được tạo trong các ngày đã chọn ở phân hệ này.
                            </div>
                        ) : isMulti ? (
                            <div className="space-y-3">
                                {rangeItems.length > 0 && (
                                    <div className="p-2.5 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-teal-900 uppercase flex items-center gap-1.5">
                                                <span>
                                                    📊 Gộp toàn bộ {lotDates.length} ngày đã chọn ({[...lotDates].sort().map(d => formatVNDateSlash(d).slice(0, 5)).join(' & ')})
                                                </span>
                                            </span>
                                            <span className="text-[10px] text-teal-700 font-semibold bg-teal-100/70 px-2 py-0.5 rounded-full">
                                                Chọn nhanh cả đợt
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {rangeItems.map(sum => renderLotCard(sum))}
                                        </div>
                                    </div>
                                )}

                                {dailyItems.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="text-[11px] font-extrabold uppercase text-stone-600 flex items-center gap-1">
                                            <Calendar size={12} className="text-teal-600" />
                                            <span>Số tổng theo từng ngày (Tích chọn để cộng dồn):</span>
                                        </div>
                                        <div className="space-y-2">
                                            {dailyItems.map(sum => renderLotCard(sum))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="text-[11px] text-stone-500">
                                    Số tổng LOT tạo ngày <b>{formatVNDateSlash(lotDates[0])}</b> (toàn kho):
                                </div>
                                <div className="space-y-2">
                                    {lotDateSummaries.map(sum => renderLotCard(sum))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* TAB 5: Approved Assignments Picker (/production-lot/assignments) - Supports Selecting Arbitrary Multiple Dates */}
            {activeSourceTab === 'approved_assignments' && (() => {
                const isMulti = assignDates.length > 1
                const rangeItems = assignSummaries.filter(s => s.action_date.includes(','))
                const dailyItems = assignSummaries.filter(s => !s.action_date.includes(','))

                const renderAssignCard = (sum: LinkedApprovedAssignmentSummary) => {
                    const isSelected = (value.linked_approved_assignments || []).some(
                        s => s.id === sum.id
                    )
                    const isCombined = sum.action_date.includes(',')
                    return (
                        <div
                            key={sum.id}
                            onClick={() => handleToggleApprovedAssignment(sum)}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all text-xs ${isSelected
                                ? 'bg-blue-50 border-blue-400 text-blue-950 ring-1 ring-blue-400 shadow-2xs'
                                : 'bg-white hover:bg-stone-50 border-stone-200 text-stone-800'
                                }`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                    className={`w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 ${isSelected
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-stone-300 bg-white'
                                        }`}
                                >
                                    {isSelected && <Check size={11} />}
                                </div>
                                <div className="truncate">
                                    <div className="font-extrabold flex items-center gap-1.5 text-blue-950">
                                        <span>🚜 {isCombined ? `Gộp cả đợt (${sum.date_label || 'nhiều ngày'})` : `Ngày ${sum.date_label || formatVNDateSlash(sum.action_date)}`}</span>
                                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                            Số tổng
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-stone-400">
                                        Toàn bộ các kho cộng dồn
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <span className="px-2 py-0.5 rounded-md bg-blue-100/90 text-blue-900 font-black">
                                    📍 {sum.approved_count} vị trí
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md bg-stone-50 border border-stone-200 text-stone-700 font-bold text-[10px]">
                                    🏷️ {sum.lots_count} LOT
                                </span>
                                {(sum.packages_count ?? 0) > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold text-[10px]">
                                        📦 {sum.packages_count?.toLocaleString('vi-VN')} {sum.package_unit || 'Thùng'}
                                    </span>
                                )}
                                {sum.estimated_weight_kg && sum.estimated_weight_kg > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[10px]">
                                        ⚖️ {sum.estimated_weight_kg.toLocaleString('vi-VN')} kg
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                }

                return (
                    <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-blue-100">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                <span className="text-xs font-black text-blue-950 uppercase tracking-wider">
                                    🚜 Bảng chọn: Duyệt gán vị trí xe nâng (/production-lot/assignments)
                                </span>
                            </div>
                        </div>

                        {/* Header & Date Selector Bar */}
                        <div className="space-y-2 pb-1 border-b border-stone-100">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800">
                                    <Calendar size={14} className="text-blue-600" />
                                    <span>Tùy chọn các ngày duyệt lên kệ (Chọn nhiều ngày bất kỳ):</span>
                                </div>

                                <Link
                                    href="/production-lot/assignments"
                                    target="_blank"
                                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold inline-flex items-center gap-1 shrink-0"
                                >
                                    Mở /production-lot/assignments <ExternalLink size={11} />
                                </Link>
                            </div>

                            {/* Quick Toggle Pills */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-bold text-stone-500 mr-0.5">Bấm chọn nhanh:</span>
                                {quickDatePills.map(p => {
                                    const isSelected = assignDates.includes(p.date)
                                    return (
                                        <button
                                            key={p.date}
                                            type="button"
                                            onClick={() => handleToggleAssignDate(p.date)}
                                            className={`px-2 py-0.5 rounded-lg text-[11px] font-extrabold border transition-all inline-flex items-center gap-1 ${isSelected
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                                : 'bg-white hover:bg-stone-50 text-stone-700 border-stone-200'
                                                }`}
                                        >
                                            {isSelected && <Check size={11} />}
                                            <span>{p.label}</span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* Active Dates Chips & Date Input Adder */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-bold text-stone-600">
                                        Đã chọn ({assignDates.length} ngày):
                                    </span>
                                    {[...assignDates].sort().map(d => (
                                        <span
                                            key={d}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-xs font-black"
                                        >
                                            <span>{formatVNDateSlash(d)}</span>
                                            {assignDates.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveAssignDate(d)}
                                                    className="text-blue-400 hover:text-rose-600 font-bold ml-0.5"
                                                    title="Bỏ ngày này"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </span>
                                    ))}
                                </div>

                                <div className="flex items-center gap-1 ml-auto">
                                    <input
                                        type="date"
                                        value={assignDateInput}
                                        onChange={e => setAssignDateInput(e.target.value)}
                                        className="px-2 py-0.5 rounded border border-stone-200 text-xs font-bold text-stone-800 outline-hidden focus:border-blue-500 bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddAssignDate(assignDateInput)}
                                        className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-2xs transition-colors"
                                    >
                                        + Thêm ngày
                                    </button>
                                </div>
                            </div>
                        </div>

                        {loadingAssignSummaries ? (
                            <div className="py-5 text-center text-xs text-stone-500 flex items-center justify-center gap-2">
                                <Loader2 size={15} className="animate-spin text-blue-600" />
                                Đang tổng hợp vị trí xe nâng cho {assignDates.length} ngày đã chọn...
                            </div>
                        ) : assignSummaries.length === 0 ? (
                            <div className="py-4 text-center text-xs text-stone-500">
                                Không có bản ghi gán vị trí nào được duyệt trong các ngày đã chọn ở phân hệ này.
                            </div>
                        ) : isMulti ? (
                            <div className="space-y-3">
                                {rangeItems.length > 0 && (
                                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-extrabold text-blue-900 uppercase flex items-center gap-1.5">
                                                <span>
                                                    📊 Gộp toàn bộ {assignDates.length} ngày đã chọn ({[...assignDates].sort().map(d => formatVNDateSlash(d).slice(0, 5)).join(' & ')})
                                                </span>
                                            </span>
                                            <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/70 px-2 py-0.5 rounded-full">
                                                Chọn nhanh cả đợt
                                            </span>
                                        </div>
                                        <div className="space-y-2">
                                            {rangeItems.map(sum => renderAssignCard(sum))}
                                        </div>
                                    </div>
                                )}

                                {dailyItems.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        <div className="text-[11px] font-extrabold uppercase text-stone-600 flex items-center gap-1">
                                            <Calendar size={12} className="text-blue-600" />
                                            <span>Số tổng theo từng ngày (Tích chọn để cộng dồn):</span>
                                        </div>
                                        <div className="space-y-2">
                                            {dailyItems.map(sum => renderAssignCard(sum))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="text-[11px] text-stone-500">
                                    Số tổng vị trí xe nâng đã đưa lên kệ ngày <b>{formatVNDateSlash(assignDates[0])}</b> (toàn kho):
                                </div>
                                <div className="space-y-2">
                                    {assignSummaries.map(sum => renderAssignCard(sum))}
                                </div>
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* TAB 6: Manual Entry (Tự nhập số liệu khi không có nguồn dữ liệu cụ thể) */}
            {activeSourceTab === 'manual_entry' && (
                <div className="bg-white rounded-xl border border-violet-200 p-3 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-violet-100">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-violet-600"></span>
                            <span className="text-xs font-black text-violet-950 uppercase tracking-wider">
                                ✍️ Bảng nhập tay số liệu chứng minh
                            </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                            Không cần chứng từ / nguồn dữ liệu
                        </span>
                    </div>

                    {isStatistics ? (
                        <p className="text-[11px] font-semibold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5">
                            📊 Công việc <b>Thống kê / Ghi chép</b>: nhập <b>Số phiếu / chứng từ</b> và <b>Số dòng dữ liệu</b>
                            (tổng số dòng đã nhập trong các phiếu) để chấm độ chính xác và hoàn thành trong ngày. Bước
                            Báo cáo & Xếp hạng <b>không ghi sản lượng và giờ làm</b> cho việc này.
                        </p>
                    ) : (
                        <>
                            <p className="text-[11px] text-stone-500 leading-relaxed">
                                Nhập trực tiếp số liệu thực tế đã thực hiện (vị trí hạ/xếp, LOT/pallet, thùng/kiện, khối lượng, cont, số giờ).
                                Số liệu nhập tay được dùng ngay để tính độ nặng / nhẹ và phân bổ hiệu suất cho công việc.
                            </p>
                            <p className="text-[11px] font-semibold text-violet-800 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1.5">
                                ⚖️ Tự quy đổi khối lượng theo ô vừa nhập: 1 vị trí / LOT / pallet = <b>600 kg</b>; 1 thùng / kiện = <b>20 kg</b>.
                                Nhập tay trực tiếp ô Khối lượng nếu muốn giá trị khác.
                            </p>
                        </>
                    )}

                    {manualMetricInputs}
                </div>
            )}
        </>
    )
}
