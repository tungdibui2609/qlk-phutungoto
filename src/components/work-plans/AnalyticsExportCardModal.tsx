'use client'

import React, { useState, useRef } from 'react'
import {
    X,
    Download,
    Copy,
    Check,
    Camera,
    Trophy,
    Award,
    Calendar,
    Target,
    ListFilter,
    CheckCircle2,
    AlertTriangle,
    Layers,
    FileText,
    Star,
    Sparkles,
} from 'lucide-react'
import { toPng, toBlob } from 'html-to-image'
import { saveAs } from 'file-saver'
import {
    WorkPlanItem,
    ITEM_STATUS_CONFIG,
    RATING_CONFIG,
    DIFFICULTY_CONFIG,
    formatVNDateSlash,
    formatWorkloadSummaryText,
    calculateAssigneeTaskStandardKpi,
    getDayOfWeekVN,
} from './types'
import { useToast } from '@/components/ui/ToastProvider'
import { EmployeeIncidentItem } from './WorkPlanAnalyticsTab'

export interface EmployeeStatExportRow {
    name: string
    type: 'member' | 'team' | string
    totalAssigned: number
    completed: number
    partial?: number
    uncompleted?: number
    primaryTasksAssigned: number
    primaryTasksCompleted: number
    secondaryTasksAssigned: number
    secondaryTasksCompleted: number
    statisticsTasksAssigned?: number
    statisticsTasksCompleted?: number
    primaryKpiScore: number
    secondaryBonusPoints: number
    productivityScore: number
    qualityScore: number
    safetyScore: number
    safetyMax?: number
    disciplineScore: number
    productivityMax?: number
    qualityMax?: number
    disciplineMax?: number
    netKpiScore: number
    totalPositions: number
    totalWeightKg: number
    totalContainers: number
    totalDocuments?: number
    totalPenaltyPoints?: number
    totalBonusPoints?: number
    incidentsCount?: number
    incidentsList?: EmployeeIncidentItem[]
    totalRegularHours?: number
    totalOvertimeHours?: number
    totalWorkHours?: number
    speedPositionsPerHour?: number | null
    speedWeightTonsPerHour?: number | null
    speedPackagesPerHour?: number | null
    speedSummaryText?: string
    grade: 'A+' | 'A' | 'B' | 'C'
    gradeLabel: string
    items?: WorkPlanItem[]
}

interface AnalyticsExportCardModalProps {
    isOpen: boolean
    onClose: () => void
    systemName: string
    companyName?: string | null
    dateFrom: string
    dateTo: string
    rows: EmployeeStatExportRow[]
    kpis: {
        total: number
        completed: number
        partial: number
        uncompleted: number
        avgProgress: number
        totalPositions: number
        totalDocuments?: number
        avgStars: string | number | null
    }
}

export type ExportCardMode = 'comprehensive' | 'ranking' | 'detail'

export default function AnalyticsExportCardModal({
    isOpen,
    onClose,
    systemName,
    companyName,
    dateFrom,
    dateTo,
    rows,
    kpis,
}: AnalyticsExportCardModalProps) {
    const { showToast } = useToast()
    const [exportMode, setExportMode] = useState<ExportCardMode>('comprehensive')
    const [exporting, setExporting] = useState<boolean>(false)
    const [copiedImg, setCopiedImg] = useState<boolean>(false)
    const [copiedText, setCopiedText] = useState<boolean>(false)

    const cardRef = useRef<HTMLDivElement>(null)

    if (!isOpen) return null

    const isSingleDay = dateFrom === dateTo
    const vnFrom = formatVNDateSlash(dateFrom)
    const vnTo = formatVNDateSlash(dateTo)
    const dayOfWeek = isSingleDay ? getDayOfWeekVN(dateFrom) : ''

    const dateTitle = isSingleDay
        ? `Ngày ${vnFrom} (${dayOfWeek})`
        : `Từ ${vnFrom} đến ${vnTo}`

    // Chụp toàn bộ thẻ bất kể chiều cao dài bao nhiêu (chuẩn Full-width 1280px đảm bảo đủ 100% các cột)
    const getRenderOptions = (node: HTMLElement) => {
        const width = 1280
        const height = node.scrollHeight || node.offsetHeight

        return {
            pixelRatio: 2.0,
            backgroundColor: '#ffffff',
            cacheBust: true,
            width,
            height,
            style: {
                transform: 'none',
                margin: '0',
                maxHeight: 'none',
                height: `${height}px`,
                width: `${width}px`,
                overflow: 'visible',
            },
        }
    }

    const handleDownloadPng = async () => {
        if (!cardRef.current) return
        setExporting(true)
        try {
            const options = getRenderOptions(cardRef.current)
            const dataUrl = await toPng(cardRef.current, options)
            const modeName =
                exportMode === 'comprehensive'
                    ? 'BaoCao_ToanDien'
                    : exportMode === 'ranking'
                    ? 'BangXepHang_KPI'
                    : 'NhatKy_CongViec'
            const fileName = `${modeName}_${dateFrom}_${dateTo}.png`
            saveAs(dataUrl, fileName)
            showToast('Đã tải ảnh báo cáo đầy đủ, sắc nét thành công!', 'success')
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
            const options = getRenderOptions(cardRef.current)
            const blob = await toBlob(cardRef.current, options)
            if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob }),
                ])
                setCopiedImg(true)
                showToast(
                    'Đã sao chép ảnh toàn diện vào bộ nhớ tạm! Bạn chỉ cần mở Zalo và nhấn Ctrl+V để gửi.',
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
        lines.push(`🏆 *BÁO CÁO HIỆU SUẤT & XẾP HẠNG KPI NHÂN SỰ*`)
        lines.push(`🏢 Phân hệ: ${systemName}${companyName ? ` • ${companyName}` : ''}`)
        lines.push(`📅 Thời gian: ${dateTitle}`)
        lines.push(`📊 Tổng việc: ${kpis.total} việc (Hoàn thành ${kpis.avgProgress}%) • Sản lượng: ${kpis.totalPositions} vị trí${(kpis.totalDocuments || 0) > 0 ? ` • 📄 ${kpis.totalDocuments} phiếu thống kê` : ''}`)
        lines.push(`===================================`)

        lines.push(`🏅 *BẢNG XẾP HẠNG TOP THI ĐUA:*`)
        rows.forEach((r, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`
            const statsStr = (r.statisticsTasksAssigned || 0) > 0
                ? ` • 📊 ${r.statisticsTasksCompleted || 0}/${r.statisticsTasksAssigned} thống kê`
                : ''
            const taskStr = `Việc: ${r.primaryTasksCompleted}/${r.primaryTasksAssigned} chính${r.secondaryTasksCompleted > 0 ? ` +${r.secondaryTasksCompleted} phụ` : ''}${statsStr}`
            const totalH = r.totalWorkHours || 0
            const otH = r.totalOvertimeHours || 0
            const hourStr = totalH > 0 ? ` • ⏱️ ${totalH}h${otH > 0 ? ` (+${otH}h OT)` : ''}` : ''
            const statsOnly = (r.statisticsTasksAssigned || 0) > 0 && r.totalPositions === 0 && r.totalWeightKg === 0 && totalH === 0
            const prodStr = statsOnly
                ? ((r.totalDocuments || 0) > 0 ? `📄 ${r.totalDocuments} phiếu đã tạo (thống kê)` : `📊 Không ghi sản lượng/giờ (thống kê)`)
                : `${r.totalPositions} vt • ${(r.totalWeightKg / 1000).toFixed(1)} tấn${hourStr}${(r.statisticsTasksAssigned || 0) > 0 && (r.totalDocuments || 0) > 0 ? ` • 📄 ${r.totalDocuments} phiếu (TK)` : ''}`
            lines.push(`${medal} *${r.name}*: *${r.netKpiScore}đ* (${r.gradeLabel})`)
            lines.push(`   ├ ${taskStr} • SL: ${prodStr}`)
            const safetyStr = r.safetyMax === 0 ? '' : ` 🛡️${r.safetyScore}`
            lines.push(`   └ Điểm các nhóm: ${r.primaryKpiScore}/100đ (⚡${r.productivityScore} ⭐${r.qualityScore}${safetyStr} 📋${r.disciplineScore})${r.secondaryBonusPoints > 0 ? ` • Việc phụ: +${r.secondaryBonusPoints}đ` : ''}`)
        })

        if (exportMode === 'comprehensive' || exportMode === 'detail') {
            lines.push(`\n📋 *CHI TIẾT CÔNG VIỆC TỪNG NHÂN SỰ TRONG NGÀY:*`)
            rows.forEach((r, idx) => {
                lines.push(`\n👤 *#${idx + 1}. ${r.name}* (Tổng KPI: *${r.netKpiScore}đ* • ${r.gradeLabel})`)
                const items = r.items || []
                if (items.length === 0) {
                    lines.push(`   (Không có dữ liệu chi tiết công việc)`)
                } else {
                    items.forEach(item => {
                        const evals = item.workload_metrics?.assignee_evaluations || []
                        const myEval = evals.find(
                            e => e.assignee_name?.trim().toLowerCase() === r.name.trim().toLowerCase()
                        )
                        const isStatisticsTask = item.work_nature === 'statistics'
                        const itemMult = isStatisticsTask
                            ? 1.0
                            : DIFFICULTY_CONFIG[item.workload_metrics?.difficulty || 'medium']?.multiplier || 1.0
                        const itemTotalPos = isStatisticsTask ? 0 : Number(item.workload_metrics?.positions_count) || 0
                        const itemTotalKg = isStatisticsTask ? 0 : Number(item.workload_metrics?.weight_kg) || 0
                        const itemShare = myEval?.share_percent ?? 100
                        const userPos = Math.round(((itemTotalPos * itemShare) / 100) * 10) / 10
                        const userKg = Math.round((itemTotalKg * itemShare) / 100)
                        const isSecondaryTask = myEval?.task_type === 'secondary' || item.workload_metrics?.task_type === 'secondary'

                        const taskKpi = calculateAssigneeTaskStandardKpi({
                            userPositions: userPos,
                            diffMultiplier: itemMult,
                            difficulty: item.workload_metrics?.difficulty,
                            progressPercent: item.progress_percent || 0,
                            ratingStars: item.rating_stars,
                            incidents: myEval?.incidents || [],
                            bonusPoints: myEval?.bonus_points || 0,
                            taskType: isSecondaryTask ? 'secondary' : 'primary',
                            taskStatus: item.status,
                            customProductivityScore: myEval?.custom_productivity_score,
                            customQualityScore: myEval?.custom_quality_score,
                            sharePercent: itemShare,
                            workNature: item.work_nature,
                        })

                        const typeTag = isSecondaryTask ? '[Việc phụ]' : '[Việc chính]'
                        const prodTag = userPos > 0 ? ` • ${userPos} vt (${userKg}kg)` : ''
                        const scoreTag = isSecondaryTask
                            ? `+${taskKpi.bonusOverTargetPoints}đ Thưởng`
                            : `KPI: ${taskKpi.totalKpi}/100đ`

                        lines.push(`   - ${typeTag} ${item.content} (${item.progress_percent}%)${prodTag} ➔ ${scoreTag}`)
                    })
                }

                if (Array.isArray(r.incidentsList) && r.incidentsList.length > 0) {
                    lines.push(`   ⚠️ Lỗi vi phạm:`)
                    r.incidentsList.forEach(inc => {
                        lines.push(`      • ${inc.name}: -${inc.penalty_points}đ${inc.note ? ` (${inc.note})` : ''}`)
                    })
                }
            })
        }

        lines.push(`\n-----------------------------------`)
        lines.push(`💡 *Modular WMS - Hệ Thống Đánh Giá & Xếp Hạng KPI Tự Động*`)

        try {
            await navigator.clipboard.writeText(lines.join('\n'))
            setCopiedText(true)
            showToast('Đã sao chép đầy đủ nội dung báo cáo Zalo!', 'success')
            setTimeout(() => setCopiedText(false), 3000)
        } catch (err) {
            console.error('Copy text error:', err)
            showToast('Không thể sao chép văn bản', 'error')
        }
    }

    const exportTime = new Date().toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    })

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
            <div className="bg-stone-100 rounded-3xl shadow-2xl border border-stone-300 w-full max-w-[1360px] overflow-hidden flex flex-col my-auto max-h-[96vh]">
                {/* Header Toolbar */}
                <div className="px-5 py-3.5 bg-white border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                            <Trophy size={18} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                                <span>Xuất Phiếu Báo Cáo & Ảnh Gửi Zalo</span>
                                <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                                    Đầy đủ chi tiết
                                </span>
                            </h3>
                            <p className="text-[11px] text-stone-500">
                                {dateTitle} • Phân hệ: {systemName}
                            </p>
                        </div>
                    </div>

                    {/* Mode Selector Tabs */}
                    <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs">
                        <button
                            type="button"
                            onClick={() => setExportMode('comprehensive')}
                            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                                exportMode === 'comprehensive'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                            title="Báo cáo đầy đủ: Gồm Bảng Xếp Hạng VÀ Chi Tiết Công Việc của từng người"
                        >
                            <Sparkles size={13} className="text-amber-500" />
                            Toàn diện (Khuyên dùng)
                        </button>
                        <button
                            type="button"
                            onClick={() => setExportMode('ranking')}
                            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                                exportMode === 'ranking'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                            title="Chỉ bảng xếp hạng và điểm số KPI"
                        >
                            <Trophy size={13} className="text-purple-600" />
                            Bảng Xếp Hạng
                        </button>
                        <button
                            type="button"
                            onClick={() => setExportMode('detail')}
                            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                                exportMode === 'detail'
                                    ? 'bg-white text-indigo-700 shadow-xs'
                                    : 'text-stone-600 hover:text-stone-900'
                            }`}
                            title="Chi tiết từng công việc ai làm gì, sản lượng bao nhiêu"
                        >
                            <FileText size={13} className="text-emerald-600" />
                            Chi Tiết Việc
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={exporting}
                            onClick={handleCopyImageToClipboard}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
                            title="Sao chép ảnh vào clipboard, qua Zalo bấm Ctrl+V để gửi"
                        >
                            {copiedImg ? <Check size={14} /> : <Copy size={14} />}
                            {copiedImg ? 'Đã copy ảnh! (Dán Ctrl+V)' : 'Copy ảnh Zalo'}
                        </button>

                        <button
                            type="button"
                            disabled={exporting}
                            onClick={handleDownloadPng}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-xs"
                            title="Tải file ảnh PNG sắc nét về máy"
                        >
                            <Download size={14} />
                            Tải ảnh PNG
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyZaloText}
                            className="px-3 py-1.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                        >
                            {copiedText ? <Check size={14} /> : <Copy size={14} />}
                            {copiedText ? 'Đã copy text' : 'Copy Text'}
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors ml-1"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Preview Area (Chứa card xuất ảnh - cố định chuẩn Full 1280px bao trọn vẹn 100% các cột) */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 flex justify-start xl:justify-center bg-stone-200/60">
                    <div
                        ref={cardRef}
                        className="shrink-0 bg-white rounded-3xl p-6 sm:p-8 space-y-6 text-stone-900 shadow-xl border border-stone-200"
                        style={{ width: '1280px', minWidth: '1280px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
                    >
                        {/* 1. TOP HEADER CARD */}
                        <div className="border-b-2 border-indigo-600 pb-4 flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="text-[11px] font-black uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                                    <span>🏢 {companyName || 'HỆ THỐNG QUẢN LÝ KHO (MODULAR WMS)'}</span>
                                    <span>•</span>
                                    <span>{systemName}</span>
                                </div>
                                <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                                    <span>
                                        {exportMode === 'comprehensive'
                                            ? '🌸 PHIẾU BÉ KHỎE BÉ NGOAN TRONG NGÀY'
                                            : exportMode === 'ranking'
                                            ? '🏆 BẢNG PHONG THẦN BÉ KHỎE BÉ NGOAN'
                                            : '📋 NHẬT KÝ & CHI TIẾT CÔNG VIỆC NHÂN SỰ'}
                                    </span>
                                </h1>
                                <div className="text-xs font-bold text-stone-600 flex items-center gap-2">
                                    <span className="bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200">
                                        📅 {dateTitle}
                                    </span>
                                    <span className="text-stone-400">•</span>
                                    <span className="text-stone-500 font-medium text-[11px]">
                                        Đo lường năng suất (Bé Khỏe ⚡) & An toàn, kỷ luật 5S (Bé Ngoan 🛡️)
                                    </span>
                                </div>
                            </div>

                            <div className="text-right shrink-0">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white flex items-center justify-center font-black shadow-md mx-auto">
                                    <Trophy size={28} className="text-amber-300" />
                                </div>
                                <div className="text-[10px] font-extrabold text-stone-500 uppercase tracking-widest mt-1">
                                    TOP BÉ NGOAN 🌸
                                </div>
                            </div>
                        </div>

                        {/* 2. STATS OVERVIEW CARDS */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-0.5">
                                <div className="text-[10px] font-bold uppercase text-stone-500">Tổng đầu việc</div>
                                <div className="text-lg font-black text-stone-900">
                                    {kpis.total} <span className="text-xs text-stone-500 font-bold">việc</span>
                                </div>
                                <div className="text-[10px] text-emerald-700 font-bold">
                                    Đạt {kpis.avgProgress}% (Xong: {kpis.completed})
                                </div>
                            </div>

                            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-0.5">
                                <div className="text-[10px] font-bold uppercase text-stone-500">Sản lượng đã xử lý</div>
                                <div className="text-lg font-black text-amber-800">
                                    {kpis.totalPositions} <span className="text-xs text-amber-600 font-bold">vị trí</span>
                                </div>
                                <div className="text-[10px] text-stone-500">
                                    Tương đương pallet / LOT hạ xếp
                                    {(kpis.totalDocuments || 0) > 0 && (
                                        <span className="block text-sky-700 font-bold mt-0.5">
                                            📄 {(kpis.totalDocuments || 0).toLocaleString('vi-VN')} phiếu thống kê đã tạo
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-0.5">
                                <div className="text-[10px] font-bold uppercase text-stone-500">Chất lượng TB</div>
                                <div className="text-lg font-black text-amber-700">
                                    {kpis.avgStars || '4.0'} / 5.0 ⭐
                                </div>
                                <div className="text-[10px] text-stone-500">
                                    Nghiệm thu sao thực tế
                                </div>
                            </div>

                            <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-0.5">
                                <div className="text-[10px] font-bold uppercase text-stone-500">Nhân sự thi đua</div>
                                <div className="text-lg font-black text-indigo-700">
                                    {rows.length} <span className="text-xs text-indigo-500 font-bold">nhân viên</span>
                                </div>
                                <div className="text-[10px] text-stone-500">
                                    Xét theo 4 nhóm điểm chuẩn
                                </div>
                            </div>
                        </div>

                        {/* 3. PHẦN A: BẢNG XẾP HẠNG TOP THI ĐUA (HIỂN THỊ ĐẦY ĐỦ 100% NHÂN VIÊN) */}
                        {(exportMode === 'comprehensive' || exportMode === 'ranking') && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xs font-black uppercase text-stone-700 tracking-wider flex items-center gap-1.5">
                                        <Trophy size={14} className="text-amber-500" />
                                        <span>🌸 I. BẢNG PHONG THẦN THI ĐUA BÉ KHỎE BÉ NGOAN</span>
                                    </h2>
                                    <span className="text-[10px] text-stone-500 font-semibold">
                                        {rows.length} nhân sự tham gia thi đua
                                    </span>
                                </div>

                                <div className="overflow-hidden rounded-2xl border border-stone-200 shadow-2xs">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-stone-100/90 text-stone-600 border-b border-stone-200 text-[10px] font-black uppercase tracking-wider">
                                            <tr>
                                                <th className="w-[50px] px-3 py-2.5 text-center whitespace-nowrap">Hạng</th>
                                                <th className="w-[170px] px-3.5 py-2.5 whitespace-nowrap">Nhân viên</th>
                                                <th className="w-[95px] px-3 py-2.5 text-center whitespace-nowrap">Tiến độ việc</th>
                                                <th className="w-[125px] px-3 py-2.5 text-right whitespace-nowrap">Sản lượng & Giờ làm</th>
                                                <th className="w-[65px] px-2 py-2.5 text-center whitespace-nowrap">⚡ N.Suất</th>
                                                <th className="w-[65px] px-2 py-2.5 text-center whitespace-nowrap">⭐ C.Lượng</th>
                                                <th className="w-[65px] px-2 py-2.5 text-center whitespace-nowrap">🛡️ A.Toàn</th>
                                                <th className="w-[65px] px-2 py-2.5 text-center whitespace-nowrap">📋 K.Luật</th>
                                                <th className="w-[95px] px-3 py-2.5 text-center whitespace-nowrap">⭐ Điểm chính</th>
                                                <th className="w-[85px] px-3 py-2.5 text-center whitespace-nowrap">➕ Việc phụ</th>
                                                <th className="w-[115px] px-3.5 py-2.5 text-center bg-indigo-50 text-indigo-900 font-black whitespace-nowrap">
                                                    🎯 Tổng KPI
                                                </th>
                                                <th className="w-[150px] px-3.5 py-2.5 text-center whitespace-nowrap">
                                                    Xếp loại
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 bg-white">
                                            {rows.map((r, idx) => {
                                                const isTop1 = idx === 0
                                                const isTop2 = idx === 1
                                                const isTop3 = idx === 2

                                                return (
                                                    <tr
                                                        key={r.name}
                                                        className={`transition-colors ${
                                                            isTop1 ? 'bg-amber-50/40 font-semibold' : ''
                                                        }`}
                                                    >
                                                        {/* Cột Hạng */}
                                                        <td className="w-[50px] px-3 py-2.5 text-center font-black whitespace-nowrap">
                                                            {isTop1 ? (
                                                                <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white inline-flex items-center justify-center font-black shadow-xs text-xs">
                                                                    🥇
                                                                </span>
                                                            ) : isTop2 ? (
                                                                <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-slate-300 to-slate-500 text-white inline-flex items-center justify-center font-black shadow-xs text-xs">
                                                                    🥈
                                                                </span>
                                                            ) : isTop3 ? (
                                                                <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-white inline-flex items-center justify-center font-black shadow-xs text-xs">
                                                                    🥉
                                                                </span>
                                                            ) : (
                                                                <span className="text-stone-500 font-bold">#{idx + 1}</span>
                                                            )}
                                                        </td>

                                                        {/* Tên Nhân Viên */}
                                                        <td className="w-[170px] px-3.5 py-2.5 whitespace-nowrap">
                                                            <div className="font-extrabold text-stone-900 text-xs whitespace-nowrap">
                                                                {r.name}
                                                            </div>
                                                        </td>

                                                        {/* Tiến độ việc */}
                                                        <td className="w-[95px] px-3 py-2.5 text-center text-[11px] whitespace-nowrap">
                                                            <span className="font-bold text-stone-800">
                                                                {r.primaryTasksCompleted}/{r.primaryTasksAssigned}
                                                            </span>
                                                            {r.secondaryTasksAssigned > 0 && (
                                                                <span className="text-purple-700 font-bold ml-1 text-[10px]">
                                                                    (+{r.secondaryTasksCompleted})
                                                                </span>
                                                            )}
                                                        </td>

                                                        {/* Sản lượng & Giờ làm / Tốc độ */}
                                                        <td className="w-[125px] px-3 py-2.5 text-right font-extrabold text-amber-800 text-[11px] whitespace-nowrap">
                                                            {(r.statisticsTasksAssigned || 0) > 0 && r.totalPositions === 0 && r.totalWeightKg === 0 && (r.totalWorkHours || 0) === 0 ? (
                                                                <div className="text-sky-700 text-[10px]">
                                                                    {(r.totalDocuments || 0) > 0
                                                                        ? `📄 ${(r.totalDocuments || 0).toLocaleString('vi-VN')} phiếu đã tạo`
                                                                        : '📊 Không ghi (thống kê)'}
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div>{r.totalPositions > 0 ? `${r.totalPositions} vt` : `${(r.totalWeightKg / 1000).toFixed(1)} tấn`}</div>
                                                                    {(r.totalWorkHours || 0) > 0 && (
                                                                        <div className="text-[10px] text-indigo-700 font-bold">
                                                                            ⏱️ {r.totalWorkHours}h{(r.totalOvertimeHours || 0) > 0 ? ` (+${r.totalOvertimeHours}h OT)` : ''}
                                                                        </div>
                                                                    )}
                                                                    {r.totalPositions > 0 && r.totalWeightKg > 0 && (
                                                                        <div className="text-[10px] text-stone-400 font-normal">
                                                                            {(r.totalWeightKg / 1000).toFixed(1)} tấn
                                                                        </div>
                                                                    )}
                                                                    {(r.statisticsTasksAssigned || 0) > 0 && (r.totalDocuments || 0) > 0 && (
                                                                        <div className="text-[10px] text-sky-700 font-bold">
                                                                            📄 {r.totalDocuments} phiếu (TK)
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </td>

                                                        {/* 4 Trụ Cột */}
                                                        <td className="w-[65px] px-2 py-2.5 text-center font-bold text-stone-900 whitespace-nowrap">
                                                            {r.productivityScore}
                                                            <span className="text-[10px] text-stone-400 font-normal">/{r.productivityMax ?? 45}</span>
                                                        </td>
                                                        <td className="w-[65px] px-2 py-2.5 text-center font-bold text-amber-700 whitespace-nowrap">
                                                            {r.qualityScore}
                                                            <span className="text-[10px] text-amber-400 font-normal">/{r.qualityMax ?? 20}</span>
                                                        </td>
                                                        <td className={`w-[65px] px-2 py-2.5 text-center font-bold whitespace-nowrap ${r.safetyMax === 0 ? 'text-stone-300' : r.safetyScore < (r.safetyMax ?? 20) ? 'text-rose-600' : 'text-emerald-700'}`}>
                                                            {r.safetyMax === 0 ? '—' : r.safetyScore}
                                                            <span className="text-[10px] text-stone-400 font-normal">{r.safetyMax === 0 ? '' : `/${r.safetyMax ?? 20}`}</span>
                                                        </td>
                                                        <td className="w-[65px] px-2 py-2.5 text-center font-bold text-indigo-700 whitespace-nowrap">
                                                            {r.disciplineScore}
                                                            <span className="text-[10px] text-indigo-300 font-normal">/{r.disciplineMax ?? 15}</span>
                                                        </td>

                                                        {/* Điểm việc chính */}
                                                        <td className="w-[95px] px-3 py-2.5 text-center font-black text-stone-800 whitespace-nowrap">
                                                            {r.primaryKpiScore}
                                                            <span className="text-[10px] text-stone-400 font-normal">/100</span>
                                                        </td>

                                                        {/* Việc phụ */}
                                                        <td className="w-[85px] px-3 py-2.5 text-center whitespace-nowrap">
                                                            {r.secondaryBonusPoints > 0 ? (
                                                                <span className="font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[11px]">
                                                                    +{r.secondaryBonusPoints}đ
                                                                </span>
                                                            ) : (
                                                                <span className="text-stone-300 text-xs">-</span>
                                                            )}
                                                        </td>

                                                        {/* Tổng KPI */}
                                                        <td className="w-[115px] px-3.5 py-2.5 text-center bg-indigo-50/70 whitespace-nowrap">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-2xs whitespace-nowrap">
                                                                <Target size={11} />
                                                                {r.netKpiScore} đ
                                                            </span>
                                                        </td>

                                                        {/* Xếp Loại - Danh hiệu Bé Khỏe Bé Ngoan */}
                                                        <td className="w-[170px] px-3.5 py-2.5 text-center whitespace-nowrap">
                                                            <span
                                                                className={`px-3 py-1 rounded-xl text-xs font-black border whitespace-nowrap inline-flex items-center justify-center gap-1 shadow-2xs ${
                                                                    r.grade === 'A+'
                                                                        ? 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-200'
                                                                        : r.grade === 'A'
                                                                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                                                                        : r.grade === 'B'
                                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                        : 'bg-stone-100 text-stone-600 border-stone-300'
                                                                }`}
                                                            >
                                                                {r.gradeLabel || (r.grade === 'A+' ? '🌸 Bé Khỏe Bé Ngoan (A+)' : r.grade === 'A' ? '⭐ Bé Ngoan (A)' : r.grade === 'B' ? '🌱 Cần Cố Gắng (B)' : '⚠️ Chưa Ngoan (C)')}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 4. PHẦN B: CHI TIẾT CÔNG VIỆC TỪNG NHÂN SỰ TRONG NGÀY (CỰC KỲ MINH BẠCH & ĐẦY ĐỦ) */}
                        {(exportMode === 'comprehensive' || exportMode === 'detail') && (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-between border-t border-stone-200 pt-4">
                                    <h2 className="text-xs font-black uppercase text-stone-700 tracking-wider flex items-center gap-1.5">
                                        <FileText size={14} className="text-indigo-600" />
                                        <span>
                                            {exportMode === 'comprehensive' ? 'II. ' : ''}
                                            Chi Tiết Nhật Ký & Công Việc Từng Nhân Viên
                                        </span>
                                    </h2>
                                    <span className="text-[10px] text-stone-500 font-medium">
                                        Minh bạch sản lượng, đóng góp %, điểm 4 nhóm và vi phạm
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    {rows.map((emp, empIdx) => {
                                        const items = emp.items || []
                                        const initials = emp.name
                                            .split(' ')
                                            .map(p => p[0])
                                            .slice(-2)
                                            .join('')
                                            .toUpperCase()

                                        return (
                                            <div
                                                key={emp.name}
                                                className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5"
                                            >
                                                {/* Header Nhân Viên */}
                                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/80 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                                            {empIdx === 0
                                                                ? '🥇'
                                                                : empIdx === 1
                                                                ? '🥈'
                                                                : empIdx === 2
                                                                ? '🥉'
                                                                : initials}
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                                                                <span>#{empIdx + 1}. {emp.name}</span>
                                                                <span className="text-[10px] font-bold text-stone-500">
                                                                    ({emp.primaryTasksCompleted}/{emp.primaryTasksAssigned} việc chính
                                                                    {emp.secondaryTasksAssigned > 0 ? ` +${emp.secondaryTasksCompleted} phụ` : ''})
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-stone-500 flex items-center gap-2">
                                                                {(emp.statisticsTasksAssigned || 0) > 0 && emp.totalPositions === 0 && emp.totalWeightKg === 0 && (emp.totalWorkHours || 0) === 0 ? (
                                                                    <span className="text-sky-700 font-bold">
                                                                        {(emp.totalDocuments || 0) > 0
                                                                            ? `📄 ${(emp.totalDocuments || 0).toLocaleString('vi-VN')} phiếu đã tạo (thống kê)`
                                                                            : '📊 Việc thống kê — không ghi sản lượng & giờ làm'}
                                                                    </span>
                                                                ) : (
                                                                    <span>Sản lượng: <b className="text-amber-800">{emp.totalPositions} vị trí</b> • {(emp.totalWeightKg / 1000).toFixed(1)} tấn
                                                                        {(emp.statisticsTasksAssigned || 0) > 0 && (emp.totalDocuments || 0) > 0 && (
                                                                            <b className="text-sky-700"> • 📄 {emp.totalDocuments} phiếu (TK)</b>
                                                                        )}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-stone-600">
                                                            Chính: <b>{emp.primaryKpiScore}/100đ</b>
                                                        </span>
                                                        {emp.secondaryBonusPoints > 0 && (
                                                            <span className="text-[11px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                                                +{emp.secondaryBonusPoints}đ phụ
                                                            </span>
                                                        )}
                                                        <span className="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-2xs">
                                                            {emp.netKpiScore} điểm
                                                        </span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-white text-stone-700 border-stone-200">
                                                            {emp.gradeLabel}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Danh Sách Công Việc Cụ Thể Của Nhân Viên Này */}
                                                <div className="space-y-1.5">
                                                    {items.length === 0 ? (
                                                        <div className="text-[11px] text-stone-400 italic py-1">
                                                            Chưa có chi tiết công việc cụ thể.
                                                        </div>
                                                    ) : (
                                                        items.map((item, itemIdx) => {
                                                            const st = ITEM_STATUS_CONFIG[item.status]
                                                            const evals = item.workload_metrics?.assignee_evaluations || []
                                                            const myEval = evals.find(
                                                                e => e.assignee_name?.trim().toLowerCase() === emp.name.trim().toLowerCase()
                                                            )
                                                            const isStatisticsTask = item.work_nature === 'statistics'
                                                            const itemMult = isStatisticsTask
                                                                ? 1.0
                                                                : DIFFICULTY_CONFIG[item.workload_metrics?.difficulty || 'medium']?.multiplier || 1.0
                                                            const itemTotalPos = isStatisticsTask ? 0 : Number(item.workload_metrics?.positions_count) || 0
                                                            const itemTotalKg = isStatisticsTask ? 0 : Number(item.workload_metrics?.weight_kg) || 0
                                                            const itemShare = myEval?.share_percent ?? 100
                                                            const userPos = Math.round(((itemTotalPos * itemShare) / 100) * 10) / 10
                                                            const userKg = Math.round((itemTotalKg * itemShare) / 100)
                                                            const isSecondaryTask = myEval?.task_type === 'secondary' || item.workload_metrics?.task_type === 'secondary'

                                                            const taskKpi = calculateAssigneeTaskStandardKpi({
                                                                userPositions: userPos,
                                                                diffMultiplier: itemMult,
                                                                difficulty: item.workload_metrics?.difficulty,
                                                                progressPercent: item.progress_percent || 0,
                                                                ratingStars: item.rating_stars,
                                                                incidents: myEval?.incidents || [],
                                                                bonusPoints: myEval?.bonus_points || 0,
                                                                taskType: isSecondaryTask ? 'secondary' : 'primary',
                                                                taskStatus: item.status,
                                                                customProductivityScore: myEval?.custom_productivity_score,
                                                                customQualityScore: myEval?.custom_quality_score,
                                                                sharePercent: itemShare,
                                                                workNature: item.work_nature,
                                                            })

                                                            return (
                                                                <div
                                                                    key={item.id || itemIdx}
                                                                    className="bg-white rounded-xl p-2.5 border border-stone-200 text-xs space-y-1 shadow-2xs"
                                                                >
                                                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                                                        <div className="font-bold text-stone-900 flex items-center gap-1.5">
                                                                            {isSecondaryTask ? (
                                                                                <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-black">
                                                                                    ➕ Phụ
                                                                                </span>
                                                                            ) : (
                                                                                <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 text-[10px] font-black border border-amber-200">
                                                                                    ⭐ Chính
                                                                                </span>
                                                                            )}
                                                                            <span className="text-stone-900 font-extrabold">
                                                                                {item.content}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${st.bgClass} ${st.textClass}`}>
                                                                                {st.shortLabel} ({item.progress_percent}%)
                                                                            </span>
                                                                            {isSecondaryTask ? (
                                                                                <span className="font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200 text-[11px]">
                                                                                    Thưởng: +{taskKpi.bonusOverTargetPoints}đ
                                                                                </span>
                                                                            ) : (
                                                                                <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 text-[11px]">
                                                                                    KPI: {taskKpi.totalKpi}/100đ
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600 pt-0.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <span>Đóng góp: <b>{itemShare}%</b></span>
                                                                            {userPos > 0 && (
                                                                                <span className="text-amber-800 font-bold">
                                                                                    • {userPos} vị trí ({userKg} kg)
                                                                                </span>
                                                                            )}
                                                                            {item.rating_stars ? (
                                                                                <span className="text-amber-600 font-bold">
                                                                                    • {item.rating_stars}⭐
                                                                                </span>
                                                                            ) : null}
                                                                        </div>

                                                                        <div className="flex items-center gap-2 text-[10px] font-semibold text-stone-600">
                                                                            <span>⚡ {taskKpi.productivityScore}/{taskKpi.productivityMax}đ</span>
                                                                            <span>⭐ {taskKpi.qualityScore}/{taskKpi.qualityMax}đ</span>
                                                                            {taskKpi.safetyMax > 0 && (
                                                                                <span className={taskKpi.safetyScore < taskKpi.safetyMax ? 'text-rose-600 font-bold' : ''}>🛡️ {taskKpi.safetyScore}/{taskKpi.safetyMax}đ</span>
                                                                            )}
                                                                            <span>📋 {taskKpi.disciplineScore}/{taskKpi.disciplineMax}đ</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>

                                                {/* Lỗi vi phạm hoặc Ghi nhận an toàn */}
                                                {Array.isArray(emp.incidentsList) && emp.incidentsList.length > 0 ? (
                                                    <div className="bg-rose-50 rounded-xl p-2 border border-rose-200 text-xs space-y-1">
                                                        <div className="text-[10px] font-black uppercase text-rose-800 flex items-center gap-1">
                                                            <AlertTriangle size={12} />
                                                            <span>Ghi nhận lỗi vi phạm trong ngày:</span>
                                                        </div>
                                                        <div className="space-y-0.5">
                                                            {emp.incidentsList.map((inc, iIdx) => (
                                                                <div
                                                                    key={iIdx}
                                                                    className="flex items-center justify-between text-[11px] text-rose-900"
                                                                >
                                                                    <span>• {inc.name}{inc.note ? ` (${inc.note})` : ''}</span>
                                                                    <span className="font-black text-rose-700">-{inc.penalty_points}đ</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50/70 px-2.5 py-1 rounded-lg border border-emerald-100">
                                                        <CheckCircle2 size={12} />
                                                        <span>
                                                            {emp.safetyMax === 0
                                                                ? 'Kỷ luật 5S đạt tối đa 20/20đ (Không có vi phạm hay sự cố)'
                                                                : 'An toàn & 5S đạt tối đa 35/35đ (Không có vi phạm hay sự cố)'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 5. FOOTER CARD */}
                        <div className="pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                            <div>
                                🌸 <b>Bảng Vinh Danh Bé Khỏe Bé Ngoan:</b> Bé Khỏe = Năng suất cao ⚡ • Bé Ngoan = An toàn & 5S sạch sẽ 🛡️ • Hoàn thành tốt ca nhận ngay Bông Hoa Đỏ!
                            </div>
                            <div className="italic text-stone-400">
                                Xuất từ Modular WMS lúc {exportTime}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
