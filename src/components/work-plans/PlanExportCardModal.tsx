'use client'

import React, { useState, useRef } from 'react'
import {
    X,
    Download,
    Copy,
    Check,
    FileText,
    CheckCircle2,
    Calendar,
} from 'lucide-react'
import { toPng, toBlob } from 'html-to-image'
import { saveAs } from 'file-saver'
import {
    WorkPlan,
    WorkPlanItem,
    ITEM_STATUS_CONFIG,
    RATING_CONFIG,
    DIFFICULTY_CONFIG,
    formatVNDate,
    getDayOfWeekVN,
    hasWorkloadData,
    formatWorkloadSummaryText,
} from './types'
import { useToast } from '@/components/ui/ToastProvider'

interface PlanExportCardModalProps {
    isOpen: boolean
    onClose: () => void
    plan: WorkPlan | null
    items: WorkPlanItem[]
    planDate: string
    systemName: string
    companyName?: string | null
    defaultMode?: 'plan' | 'evaluation'
}

export default function PlanExportCardModal({
    isOpen,
    onClose,
    plan,
    items,
    planDate,
    systemName,
    companyName,
    defaultMode = 'plan',
}: PlanExportCardModalProps) {
    const { showToast } = useToast()
    const [cardMode, setCardMode] = useState<'plan' | 'evaluation'>(defaultMode)
    const [styleTheme, setStyleTheme] = useState<'modern' | 'classic_sheet'>('classic_sheet')
    const [exporting, setExporting] = useState(false)
    const [copiedImg, setCopiedImg] = useState(false)
    const [copiedText, setCopiedText] = useState(false)

    const cardRef = useRef<HTMLDivElement>(null)

    if (!isOpen) return null

    const vnDate = formatVNDate(planDate)
    const dayOfWeek = getDayOfWeekVN(planDate)
    const headerTitle =
        plan?.title?.trim() || `Kế hoạch làm việc kho ngày ${vnDate}`

    // Stats for Evaluation mode
    const activeItems = items.filter(i => i.status !== 'cancelled')
    const completedCount = activeItems.filter(i => i.status === 'completed').length
    const partialCount = activeItems.filter(i => i.status === 'partial').length
    const uncompletedCount = activeItems.filter(
        i => i.status === 'uncompleted' || i.status === 'pending' || i.status === 'in_progress'
    ).length
    const avgProgress =
        activeItems.length > 0
            ? Math.round(
                  activeItems.reduce((sum, i) => sum + (i.progress_percent || 0), 0) /
                      activeItems.length
              )
            : 0

    const ratedItems = activeItems.filter(i => i.rating_stars && i.rating_stars > 0)
    const avgStars =
        ratedItems.length > 0
            ? (
                  ratedItems.reduce((sum, i) => sum + (i.rating_stars || 0), 0) /
                  ratedItems.length
              ).toFixed(1)
            : null

    const totalPositions = activeItems.reduce(
        (sum, i) => sum + (Number(i.workload_metrics?.positions_count) || 0),
        0
    )

    const handleDownloadPng = async () => {
        if (!cardRef.current) return
        setExporting(true)
        try {
            const dataUrl = await toPng(cardRef.current, {
                pixelRatio: 2.5,
                backgroundColor: '#ffffff',
                cacheBust: true,
            })
            const prefix = cardMode === 'plan' ? 'KeHoachLamViec' : 'BaoCaoDanhGiaCV'
            saveAs(dataUrl, `${prefix}_${vnDate.replace(/\./g, '-')}.png`)
            showToast('Đã tải ảnh phiếu sắc nét thành công!', 'success')
        } catch (err) {
            console.error('Export PNG error:', err)
            showToast('Không thể xuất ảnh, vui lòng thử lại', 'error')
        } finally {
            setExporting(false)
        }
    }

    const handleCopyImageToClipboard = async () => {
        if (!cardRef.current) return
        setExporting(true)
        try {
            const blob = await toBlob(cardRef.current, {
                pixelRatio: 2.5,
                backgroundColor: '#ffffff',
                cacheBust: true,
            })
            if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob }),
                ])
                setCopiedImg(true)
                showToast(
                    'Đã copy ảnh vào bộ nhớ tạm! Bạn có thể nhấn Ctrl+V dán thẳng vào Zalo.',
                    'success'
                )
                setTimeout(() => setCopiedImg(false), 3000)
            } else {
                await handleDownloadPng()
            }
        } catch (err) {
            console.error('Copy image error:', err)
            await handleDownloadPng()
        } finally {
            setExporting(false)
        }
    }

    const handleCopyZaloText = async () => {
        const lines: string[] = []
        if (cardMode === 'plan') {
            lines.push(`📋 *${headerTitle.toUpperCase()}* (${dayOfWeek})`)
            if (plan?.shift_name && plan.shift_name !== 'Cả ngày') {
                lines.push(`⏰ Ca làm việc: ${plan.shift_name}`)
            }
            lines.push(`-----------------------------------`)
            items.forEach((item, idx) => {
                const assigneeStr =
                    Array.isArray(item.assignees) && item.assignees.length > 0
                        ? ` 👉 [${item.assignees.map(a => a.name).join(', ')}]`
                        : ''
                const locStr = item.location_note ? ` (${item.location_note})` : ''
                const wlText = formatWorkloadSummaryText(item.workload_metrics)
                const wlLine = wlText ? `\n   📊 Khối lượng: ${wlText}` : ''
                lines.push(`${idx + 1}. ${item.content}${locStr}${assigneeStr}${wlLine}`)
            })
            if (plan?.general_note) {
                lines.push(`-----------------------------------`)
                lines.push(`📌 Ghi chú: ${plan.general_note}`)
            }
            lines.push(`\nEm gửi kế hoạch làm việc ngày (${vnDate}) ạ!`)
        } else {
            lines.push(`✅ *BÁO CÁO & ĐÁNH GIÁ CÔNG VIỆC CUỐI NGÀY ${vnDate}*`)
            lines.push(
                `📊 Tiến độ chung: *${avgProgress}%* (${completedCount}/${activeItems.length} hoàn thành${totalPositions > 0 ? ` • 📍 Tổng ${totalPositions} vị trí` : ''}${avgStars ? ` • ⭐ ${avgStars}/5.0` : ''})`
            )
            lines.push(`-----------------------------------`)
            items.forEach((item, idx) => {
                const st = ITEM_STATUS_CONFIG[item.status]
                const icon =
                    item.status === 'completed'
                        ? '✅'
                        : item.status === 'partial'
                        ? '⏳'
                        : item.status === 'cancelled'
                        ? '⚪'
                        : '❌'
                const assigneeStr =
                    Array.isArray(item.assignees) && item.assignees.length > 0
                        ? ` [${item.assignees.map(a => a.name).join(', ')}]`
                        : ''
                const ratingStr = item.rating
                    ? ` • ${RATING_CONFIG[item.rating].label} (${item.rating_stars}⭐)`
                    : ''
                const wlText = formatWorkloadSummaryText(item.workload_metrics)
                const wlLine = wlText ? `\n   📦 Số liệu: ${wlText}` : ''
                const noteStr = item.evaluation_note
                    ? `\n   ↳ Nhận xét: ${item.evaluation_note}`
                    : ''
                lines.push(
                    `${idx + 1}. ${icon} ${item.content}${assigneeStr} — *${st.shortLabel} (${item.progress_percent}%)*${ratingStr}${wlLine}${noteStr}`
                )
            })
            if (plan?.end_of_day_summary) {
                lines.push(`-----------------------------------`)
                lines.push(`📝 Tổng kết cuối ngày: ${plan.end_of_day_summary}`)
            }
        }

        try {
            await navigator.clipboard.writeText(lines.join('\n'))
            setCopiedText(true)
            showToast('Đã copy văn bản báo cáo Zalo!', 'success')
            setTimeout(() => setCopiedText(false), 3000)
        } catch {
            showToast('Không thể copy văn bản', 'error')
        }
    }

    const anyHasWorkload = items.some(i => hasWorkloadData(i.workload_metrics))

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 md:p-6">
            <div className="bg-stone-100 rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[93vh] flex flex-col overflow-hidden">
                {/* Top Control Bar */}
                <div className="px-5 py-3.5 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCardMode('plan')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                cardMode === 'plan'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                        >
                            <Calendar size={14} />
                            1. Phiếu Kế Hoạch Ngày (Gửi đầu ngày)
                        </button>
                        <button
                            type="button"
                            onClick={() => setCardMode('evaluation')}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                cardMode === 'evaluation'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                        >
                            <CheckCircle2 size={14} />
                            2. Báo Cáo Đánh Giá Cuối Ngày
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
                            <button
                                type="button"
                                onClick={() => setStyleTheme('classic_sheet')}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                    styleTheme === 'classic_sheet'
                                        ? 'bg-white text-stone-800 shadow-xs'
                                        : 'text-stone-500'
                                }`}
                            >
                                Kiểu Bảng Chuẩn
                            </button>
                            <button
                                type="button"
                                onClick={() => setStyleTheme('modern')}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                                    styleTheme === 'modern'
                                        ? 'bg-white text-stone-800 shadow-xs'
                                        : 'text-stone-500'
                                }`}
                            >
                                Kiểu Hiện Đại
                            </button>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Preview Canvas Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center items-start">
                    <div
                        ref={cardRef}
                        className="bg-white w-full max-w-[850px] rounded-xl shadow-md border border-stone-300 overflow-hidden text-stone-900"
                    >
                        {styleTheme === 'classic_sheet' ? (
                            <div className="p-6 bg-white">
                                {/* Top Brand Strip */}
                                <div className="flex items-center justify-between border-b-2 border-stone-800 pb-3 mb-4">
                                    <div className="flex items-center gap-2.5">
                                        <div
                                            className={`px-2.5 py-1 rounded-md text-white font-black text-xs uppercase tracking-wider ${
                                                cardMode === 'plan'
                                                    ? 'bg-indigo-700'
                                                    : 'bg-emerald-700'
                                            }`}
                                        >
                                            {systemName || 'KHO VẬN'}
                                        </div>
                                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                                            {companyName || 'HỆ THỐNG QUẢN LÝ KHO'} • {dayOfWeek} (
                                            {vnDate})
                                        </span>
                                    </div>
                                    <div className="text-xs font-semibold text-stone-500">
                                        {plan?.shift_name || 'Cả ngày'}
                                    </div>
                                </div>

                                {/* Main Bold Title */}
                                <div className="text-center py-2.5 mb-4 bg-stone-50 border border-stone-300 rounded-lg">
                                    <h2 className="text-xl md:text-2xl font-black text-stone-900 tracking-tight">
                                        {cardMode === 'plan'
                                            ? headerTitle
                                            : `Báo cáo & Đánh giá công việc kho ngày ${vnDate}`}
                                    </h2>
                                    {cardMode === 'evaluation' && (
                                        <div className="flex flex-wrap items-center justify-center gap-4 mt-1.5 text-xs font-bold">
                                            <span className="text-emerald-700">
                                                Hoàn thành: {completedCount}/{activeItems.length} việc (
                                                {avgProgress}%)
                                            </span>
                                            {totalPositions > 0 && (
                                                <span className="text-indigo-700">
                                                    📍 Tổng số vị trí: {totalPositions} vị trí
                                                </span>
                                            )}
                                            {partialCount > 0 && (
                                                <span className="text-amber-700">
                                                    Đạt một phần: {partialCount}
                                                </span>
                                            )}
                                            {uncompletedCount > 0 && (
                                                <span className="text-rose-700">
                                                    Chưa xong: {uncompletedCount}
                                                </span>
                                            )}
                                            {avgStars && (
                                                <span className="text-amber-600">
                                                    ⭐ Chất lượng TB: {avgStars}/5.0
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Spreadsheet Table */}
                                <table className="w-full border-collapse border border-stone-300 text-sm">
                                    <thead>
                                        <tr className="bg-stone-100 text-stone-800 text-xs font-bold uppercase">
                                            <th className="border border-stone-300 px-2.5 py-2 w-11 text-center">
                                                STT
                                            </th>
                                            <th className="border border-stone-300 px-3 py-2 text-left">
                                                Nội dung công việc & Số liệu khối lượng
                                            </th>
                                            {(items.some(i => i.assignees?.length > 0) ||
                                                cardMode === 'evaluation') && (
                                                <th className="border border-stone-300 px-3 py-2 w-36 text-left">
                                                    Nhân sự / Đội
                                                </th>
                                            )}
                                            {cardMode === 'plan' &&
                                                items.some(i => i.location_note) && (
                                                    <th className="border border-stone-300 px-3 py-2 w-28 text-left">
                                                        Khu vực
                                                    </th>
                                                )}
                                            {cardMode === 'evaluation' && (
                                                <>
                                                    <th className="border border-stone-300 px-2.5 py-2 w-28 text-center">
                                                        Kết quả
                                                    </th>
                                                    <th className="border border-stone-300 px-2.5 py-2 w-28 text-center">
                                                        Đánh giá
                                                    </th>
                                                    <th className="border border-stone-300 px-3 py-2 w-44 text-left">
                                                        Nhận xét cuối ngày
                                                    </th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            const st = ITEM_STATUS_CONFIG[item.status]
                                            const rt = item.rating
                                                ? RATING_CONFIG[item.rating]
                                                : null
                                            const wl = item.workload_metrics
                                            const diffCfg =
                                                wl?.difficulty &&
                                                DIFFICULTY_CONFIG[wl.difficulty]
                                                    ? DIFFICULTY_CONFIG[wl.difficulty]
                                                    : null
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="even:bg-stone-50/60"
                                                >
                                                    <td className="border border-stone-300 px-2.5 py-2.5 text-center font-bold text-stone-800">
                                                        {idx + 1}.
                                                    </td>
                                                    <td className="border border-stone-300 px-3 py-2.5 font-medium text-stone-900 leading-snug">
                                                        <div>
                                                            <span>{item.content}</span>
                                                            {item.priority === 'urgent' && (
                                                                <span className="ml-2 inline-block px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-sm">
                                                                    KHẨN
                                                                </span>
                                                            )}
                                                        </div>
                                                        {hasWorkloadData(wl) && (
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                                                                {diffCfg && (
                                                                    <span
                                                                        className={`px-1.5 py-0.5 rounded-sm font-bold border ${diffCfg.bgClass} ${diffCfg.textClass} ${diffCfg.borderClass}`}
                                                                    >
                                                                        {diffCfg.badgeEmoji}{' '}
                                                                        {diffCfg.label} (x
                                                                        {diffCfg.multiplier})
                                                                    </span>
                                                                )}
                                                                {wl?.positions_count ? (
                                                                    <span className="px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                                                                        📍 {wl.positions_count} Vị trí
                                                                    </span>
                                                                ) : null}
                                                                {wl?.packages_count ? (
                                                                    <span className="px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                                                        📦{' '}
                                                                        {wl.packages_count.toLocaleString(
                                                                            'vi-VN'
                                                                        )}{' '}
                                                                        {wl.package_unit ||
                                                                            'Thùng'}
                                                                    </span>
                                                                ) : null}
                                                                {wl?.weight_kg ? (
                                                                    <span className="text-stone-600 font-semibold">
                                                                        (~
                                                                        {wl.weight_kg >= 1000
                                                                            ? `${(
                                                                                  wl.weight_kg /
                                                                                  1000
                                                                              ).toFixed(1)} tấn`
                                                                            : `${wl.weight_kg} kg`}
                                                                        )
                                                                    </span>
                                                                ) : null}
                                                                {Array.isArray(
                                                                    wl?.linked_export_orders
                                                                ) &&
                                                                    wl.linked_export_orders
                                                                        .length > 0 && (
                                                                        <span className="text-indigo-700 font-bold">
                                                                            [Lệnh:{' '}
                                                                            {wl.linked_export_orders
                                                                                .map(o => o.code)
                                                                                .join(', ')}
                                                                            ]
                                                                        </span>
                                                                    )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {(items.some(
                                                        i => i.assignees?.length > 0
                                                    ) ||
                                                        cardMode === 'evaluation') && (
                                                        <td className="border border-stone-300 px-3 py-2.5 text-xs font-semibold text-indigo-900">
                                                            {Array.isArray(item.assignees) &&
                                                            item.assignees.length > 0
                                                                ? item.assignees
                                                                      .map(a => a.name)
                                                                      .join(', ')
                                                                : 'Toàn đội kho'}
                                                        </td>
                                                    )}
                                                    {cardMode === 'plan' &&
                                                        items.some(
                                                            i => i.location_note
                                                        ) && (
                                                            <td className="border border-stone-300 px-3 py-2.5 text-xs text-stone-600">
                                                                {item.location_note || '-'}
                                                            </td>
                                                        )}
                                                    {cardMode === 'evaluation' && (
                                                        <>
                                                            <td className="border border-stone-300 px-2.5 py-2.5 text-center">
                                                                <span
                                                                    className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${st.bgClass} ${st.textClass}`}
                                                                >
                                                                    {st.shortLabel} (
                                                                    {item.progress_percent}%)
                                                                </span>
                                                            </td>
                                                            <td className="border border-stone-300 px-2.5 py-2.5 text-center">
                                                                {rt ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <span className="text-[11px] font-bold text-amber-600">
                                                                            {'★'.repeat(rt.stars)}
                                                                        </span>
                                                                        <span className="text-[11px] font-semibold text-stone-700">
                                                                            {rt.label}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-stone-400">
                                                                        -
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="border border-stone-300 px-3 py-2.5 text-xs text-stone-700">
                                                                {item.evaluation_note || '-'}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>

                                {/* Footer Note / Summary */}
                                {(cardMode === 'plan'
                                    ? plan?.general_note
                                    : plan?.end_of_day_summary) && (
                                    <div className="mt-4 p-3 rounded-lg bg-stone-50 border border-stone-300 text-xs text-stone-700">
                                        <span className="font-bold text-stone-900">
                                            {cardMode === 'plan'
                                                ? '📌 Ghi chú điều phối: '
                                                : '📝 Nhận xét tổng kết cuối ngày: '}
                                        </span>
                                        {cardMode === 'plan'
                                            ? plan?.general_note
                                            : plan?.end_of_day_summary}
                                    </div>
                                )}

                                <div className="mt-4 pt-2 border-t border-stone-200 flex items-center justify-between text-[11px] text-stone-500">
                                    <span>
                                        Người lập:{' '}
                                        <b className="text-stone-700">
                                            {plan?.created_by_name || 'Quản lý kho'}
                                        </b>
                                    </span>
                                    {cardMode === 'evaluation' &&
                                        plan?.evaluated_by_name && (
                                            <span>
                                                Người đánh giá:{' '}
                                                <b className="text-stone-700">
                                                    {plan.evaluated_by_name}
                                                </b>
                                            </span>
                                        )}
                                    <span>Ngày: {vnDate}</span>
                                </div>
                            </div>
                        ) : (
                            /* MODERN EXECUTIVE CARD STYLE */
                            <div>
                                <div
                                    className={`px-6 py-5 text-white ${
                                        cardMode === 'plan'
                                            ? 'bg-gradient-to-r from-indigo-700 via-blue-700 to-cyan-700'
                                            : 'bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between text-xs text-white/80 font-semibold uppercase tracking-wider mb-1">
                                        <span>
                                            {systemName} • {dayOfWeek} ({vnDate})
                                        </span>
                                        <span>{plan?.shift_name || 'Cả ngày'}</span>
                                    </div>
                                    <h2 className="text-xl md:text-2xl font-extrabold">
                                        {cardMode === 'plan'
                                            ? headerTitle
                                            : `Báo cáo & Đánh giá công việc ngày ${vnDate}`}
                                    </h2>
                                    {cardMode === 'evaluation' && (
                                        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-white/20 text-xs font-bold">
                                            <span className="px-2.5 py-1 rounded-lg bg-white/20">
                                                Tiến độ TB: {avgProgress}%
                                            </span>
                                            <span className="px-2.5 py-1 rounded-lg bg-white/20">
                                                Hoàn thành: {completedCount}/{activeItems.length}
                                            </span>
                                            {totalPositions > 0 && (
                                                <span className="px-2.5 py-1 rounded-lg bg-white/20">
                                                    📍 Tổng vị trí: {totalPositions}
                                                </span>
                                            )}
                                            {avgStars && (
                                                <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-stone-900">
                                                    ★ Đánh giá TB: {avgStars}/5.0
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="p-6 space-y-2.5 bg-white">
                                    {items.map((item, idx) => {
                                        const st = ITEM_STATUS_CONFIG[item.status]
                                        const rt = item.rating
                                            ? RATING_CONFIG[item.rating]
                                            : null
                                        const wlSummary = formatWorkloadSummaryText(
                                            item.workload_metrics
                                        )
                                        return (
                                            <div
                                                key={item.id}
                                                className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex items-start justify-between gap-4"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="w-7 h-7 rounded-lg bg-stone-800 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                                        {idx + 1}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-stone-900">
                                                            {item.content}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-stone-600">
                                                            {item.location_note && (
                                                                <span>📍 {item.location_note}</span>
                                                            )}
                                                            {Array.isArray(item.assignees) &&
                                                                item.assignees.length > 0 && (
                                                                    <span className="text-indigo-700 font-semibold">
                                                                        👤{' '}
                                                                        {item.assignees
                                                                            .map(a => a.name)
                                                                            .join(', ')}
                                                                    </span>
                                                                )}
                                                        </div>
                                                        {wlSummary && (
                                                            <div className="mt-1 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 inline-block">
                                                                📊 {wlSummary}
                                                            </div>
                                                        )}
                                                        {cardMode === 'evaluation' &&
                                                            item.evaluation_note && (
                                                                <div className="mt-1.5 text-xs text-stone-700 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
                                                                    💬 {item.evaluation_note}
                                                                </div>
                                                            )}
                                                    </div>
                                                </div>

                                                {cardMode === 'evaluation' && (
                                                    <div className="text-right shrink-0 space-y-1">
                                                        <span
                                                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${st.bgClass} ${st.textClass}`}
                                                        >
                                                            {st.shortLabel} ({item.progress_percent}
                                                            %)
                                                        </span>
                                                        {rt && (
                                                            <div className="text-xs font-bold text-amber-600">
                                                                {'★'.repeat(rt.stars)} {rt.label}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="px-5 py-3.5 bg-white border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleCopyZaloText}
                        className="px-4 py-2 rounded-xl border border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                        {copiedText ? (
                            <Check size={15} className="text-emerald-600" />
                        ) : (
                            <FileText size={15} />
                        )}
                        {copiedText ? 'Đã copy văn bản Zalo!' : 'Copy dạng Văn bản Zalo'}
                    </button>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            disabled={exporting}
                            onClick={handleCopyImageToClipboard}
                            className="px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                            {copiedImg ? <Check size={15} /> : <Copy size={15} />}
                            {copiedImg
                                ? 'Đã copy Ảnh! (Nhấn Ctrl+V vào Zalo)'
                                : 'Copy Ảnh (Dán thẳng vào Zalo)'}
                        </button>
                        <button
                            type="button"
                            disabled={exporting}
                            onClick={handleDownloadPng}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                        >
                            <Download size={15} />
                            {exporting ? 'Đang tạo ảnh...' : 'Tải Ảnh PNG Sắc Nét'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
