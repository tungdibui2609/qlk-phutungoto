'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
    X,
    CheckCircle2,
    Star,
    Camera,
    Image as ImageIcon,
    Loader2,
    MessageSquare,
    ArrowRight,
    ClipboardList,
    Users,
    RotateCcw,
    BookOpen,
} from 'lucide-react'
import {
    WorkPlanItem,
    WorkPlanItemStatus,
    WorkPlanRating,
    WorkloadMetrics,
    WorkPlanAssignee,
    WorkPlanAssigneeEvaluation,
    ITEM_STATUS_CONFIG,
    RATING_CONFIG,
    QUICK_EVALUATION_NOTES,
    hasWorkloadData,
    formatWorkloadSummaryText,
    calculateAssigneeTaskStandardKpi,
    DIFFICULTY_CONFIG,
} from './types'
import { uploadTaskImage } from '@/components/tasks/taskUtils'
import AssigneeEvaluationSection from './AssigneeEvaluationSection'

interface EvaluateItemModalProps {
    item: WorkPlanItem | null
    isOpen: boolean
    onClose: () => void
    onSaveEvaluation: (
        itemId: string,
        updates: {
            status: WorkPlanItemStatus
            progress_percent: number
            rating: WorkPlanRating | null
            rating_stars: number | null
            evaluation_note: string | null
            completion_images: string[]
            workload_metrics: WorkloadMetrics
        },
        carryOverTomorrow?: boolean
    ) => Promise<void>
}

const RATING_KEYS: WorkPlanRating[] = [
    'excellent',
    'good',
    'satisfactory',
    'needs_improvement',
    'poor',
]

// Người được giao việc mặc định có ca chuẩn 8h, OT 0h — khởi tạo sẵn để lần đánh giá nào
// cũng lưu được giờ làm, kể cả khi Quản lý không mở bảng chia % / giờ từng người.
function buildDefaultAssigneeEvaluations(
    assignees: WorkPlanAssignee[]
): WorkPlanAssigneeEvaluation[] {
    if (assignees.length === 0) return []
    const defaultShare = Math.round(100 / assignees.length)
    return assignees.map((a, idx) => ({
        assignee_id: a.id,
        assignee_name: a.name,
        share_percent:
            idx === assignees.length - 1
                ? 100 - defaultShare * (assignees.length - 1)
                : defaultShare,
        role: assignees.length === 1 ? 'equal' : idx === 0 ? 'main' : 'support',
        task_type: a.task_type || 'primary',
        regular_hours: a.regular_hours ?? 8,
        overtime_hours: a.overtime_hours ?? 0,
        incidents: [],
        bonus_points: 0,
    }))
}

export default function EvaluateItemModal({
    item,
    isOpen,
    onClose,
    onSaveEvaluation,
}: EvaluateItemModalProps) {
    const [status, setStatus] = useState<WorkPlanItemStatus>('completed')
    const [progress, setProgress] = useState<number>(100)
    const [rating, setRating] = useState<WorkPlanRating | null>('good')
    const [note, setNote] = useState<string>('')
    const [images, setImages] = useState<string[]>([])
    const [workloadMetrics, setWorkloadMetrics] = useState<WorkloadMetrics>({})
    const [assigneeEvaluations, setAssigneeEvaluations] = useState<WorkPlanAssigneeEvaluation[]>([])
    const [carryOverTomorrow, setCarryOverTomorrow] = useState<boolean>(false)
    const [uploading, setUploading] = useState<boolean>(false)
    const [saving, setSaving] = useState<boolean>(false)

    // Tab đang chọn: 'overview' hoặc tên của nhân viên phụ trách
    const [activeTab, setActiveTab] = useState<string>('overview')

    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (item && isOpen) {
            const initialStatus =
                item.status === 'pending' || item.status === 'in_progress'
                    ? 'completed'
                    : item.status
            setStatus(initialStatus)
            setProgress(
                item.status === 'pending' || item.status === 'in_progress'
                    ? 100
                    : item.progress_percent
            )
            setRating(
                item.rating || (initialStatus === 'completed' ? 'good' : 'satisfactory')
            )
            setNote(item.evaluation_note || '')
            setImages(Array.isArray(item.completion_images) ? item.completion_images : [])
            setWorkloadMetrics(item.workload_metrics || {})
            const initialEvals =
                item.workload_metrics?.assignee_evaluations?.length
                    ? item.workload_metrics.assignee_evaluations
                    : item.assignee_evaluations?.length
                        ? item.assignee_evaluations
                        : buildDefaultAssigneeEvaluations(
                              Array.isArray(item.assignees) ? item.assignees : []
                          )
            setAssigneeEvaluations(initialEvals)
            setCarryOverTomorrow(false)
            setActiveTab('overview')
        }
    }, [item, isOpen])

    if (!isOpen || !item) return null

    const handleStatusChange = (newStatus: WorkPlanItemStatus) => {
        setStatus(newStatus)
        if (newStatus === 'completed') {
            setProgress(100)
            if (!rating || rating === 'needs_improvement' || rating === 'poor') {
                setRating('good')
            }
            setCarryOverTomorrow(false)
        } else if (newStatus === 'partial') {
            setProgress(prev => (prev === 100 || prev === 0 ? 60 : prev))
            setRating('satisfactory')
        } else if (newStatus === 'uncompleted') {
            setProgress(0)
            setRating('needs_improvement')
        } else if (newStatus === 'cancelled') {
            setProgress(0)
            setRating(null)
        } else {
            setProgress(ITEM_STATUS_CONFIG[newStatus].defaultProgress)
        }
    }

    const handleUploadFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setUploading(true)
        try {
            const uploadedUrls: string[] = []
            for (let i = 0; i < files.length; i++) {
                const url = await uploadTaskImage(files[i])
                if (url) uploadedUrls.push(url)
            }
            setImages(prev => [...prev, ...uploadedUrls])
        } catch (err) {
            console.error('Upload completion proof image error:', err)
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const finalMetrics: WorkloadMetrics = {
                ...workloadMetrics,
                assignee_evaluations: assigneeEvaluations,
            }

            await onSaveEvaluation(
                item.id,
                {
                    status,
                    progress_percent: progress,
                    rating,
                    rating_stars: rating ? RATING_CONFIG[rating].stars : null,
                    evaluation_note: note.trim() || null,
                    completion_images: images,
                    workload_metrics: finalMetrics,
                },
                carryOverTomorrow && (status === 'partial' || status === 'uncompleted')
            )
            onClose()
        } finally {
            setSaving(false)
        }
    }

    const handleSetEqualShare = () => {
        const assignees = Array.isArray(item?.assignees) ? item.assignees : []
        if (assignees.length === 0) return
        const count = assignees.length
        const baseShare = Math.floor(100 / count)
        const remainder = 100 - baseShare * count
        const next = assignees.map((a, idx) => {
            const existing = assigneeEvaluations.find(
                e => e.assignee_name.trim().toLowerCase() === a.name.trim().toLowerCase()
            )
            const share = idx === 0 ? baseShare + remainder : baseShare
            return {
                ...(existing || {
                    assignee_id: a.id,
                    assignee_name: a.name,
                    role: 'equal',
                    task_type: a.task_type || 'primary',
                    incidents: [],
                    bonus_points: 0,
                }),
                share_percent: share,
            }
        })
        setAssigneeEvaluations(next)
    }

    const assignees = Array.isArray(item.assignees) ? item.assignees : []
    const diffMultiplier = DIFFICULTY_CONFIG[workloadMetrics.difficulty || 'medium']?.multiplier || 1.0
    const totalPos = Number(workloadMetrics.positions_count) || 0
    const totalShareSum = assigneeEvaluations.reduce((sum, ev) => sum + (ev.share_percent ?? 0), 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-hidden">
            <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-5xl xl:max-w-6xl h-[90vh] max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center font-extrabold text-base shrink-0">
                            #{item.sort_order}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base md:text-lg font-bold truncate">
                                Nghiệm Thu & Đánh Giá KPI Cuối Ngày
                            </h3>
                            <p className="text-xs text-emerald-100 truncate">{item.content}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <a
                            href="/work/rules"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                            title="Mở cẩm nang quy tắc chấm điểm KPI trong tab mới"
                        >
                            <BookOpen size={14} />
                            <span className="hidden sm:inline">Quy Chế KPI</span>
                        </a>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body chia 2 cột theo chiều dọc (Sidebar Menu bên trái + Nội dung bên phải) */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                    {/* CỘT TRÁI (Sidebar dọc): Menu điều hướng Tổng quan & Danh sách nhân viên */}
                    <div className="w-full md:w-72 lg:w-80 shrink-0 border-b md:border-b-0 md:border-r border-stone-200 bg-stone-50/80 p-3 md:p-4 overflow-y-auto space-y-3.5">
                        {/* Mục 1: Nút Tổng quan công việc */}
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 px-1">
                                Mục Đánh Giá
                            </span>
                            <button
                                type="button"
                                onClick={() => setActiveTab('overview')}
                                className={`w-full p-3 rounded-2xl border text-left transition-all ${
                                    activeTab === 'overview'
                                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs'
                                        : 'bg-white/70 border-stone-200 hover:bg-white text-stone-700 hover:border-stone-300'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                                                activeTab === 'overview'
                                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                                    : 'bg-stone-100 text-stone-600'
                                            }`}
                                        >
                                            <ClipboardList size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-stone-900 truncate">
                                                Tổng quan công việc
                                            </div>
                                            <div className="text-[10px] text-stone-500 truncate">
                                                Tiến độ & Sao chất lượng
                                            </div>
                                        </div>
                                    </div>
                                    <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                            activeTab === 'overview' ? 'bg-emerald-500' : 'bg-transparent'
                                        }`}
                                    />
                                </div>

                                {/* Tóm tắt nhanh trạng thái */}
                                <div className="mt-2.5 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-1 text-[11px]">
                                    <span
                                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${
                                            ITEM_STATUS_CONFIG[status].bgClass
                                        } ${ITEM_STATUS_CONFIG[status].textClass} ${
                                            ITEM_STATUS_CONFIG[status].borderClass
                                        }`}
                                    >
                                        {ITEM_STATUS_CONFIG[status].shortLabel} ({progress}%)
                                    </span>
                                    <span className="font-bold text-amber-700 text-[10px]">
                                        {rating
                                            ? `${RATING_CONFIG[rating].badgeEmoji} ${RATING_CONFIG[rating].label}`
                                            : 'Chưa chấm sao'}
                                    </span>
                                </div>
                            </button>
                        </div>

                        {/* Mục 2: Danh sách KPI nhân viên phụ trách */}
                        <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[11px] font-black uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                                    <Users size={13} className="text-indigo-600" />
                                    <span>KPI Nhân Viên</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800 font-bold">
                                        {assignees.length}
                                    </span>
                                </span>
                                {assignees.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={handleSetEqualShare}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 transition-colors"
                                        title="Chia đều lại tỷ lệ đóng góp cho tất cả nhân sự"
                                    >
                                        🔄 Chia đều
                                    </button>
                                )}
                            </div>

                            {assignees.length === 0 ? (
                                <div className="p-3 rounded-xl bg-white border border-stone-200 text-xs text-stone-400 italic text-center">
                                    Công việc này chưa gán nhân sự phụ trách
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {assignees.map(a => {
                                        const ev = assigneeEvaluations.find(
                                            e => e.assignee_name.trim().toLowerCase() === a.name.trim().toLowerCase()
                                        )
                                        const share = ev?.share_percent ?? Math.round(100 / assignees.length)
                                        const userPos = Math.round(((totalPos * share) / 100) * 10) / 10
                                        const taskType = ev?.task_type || a.task_type || 'primary'
                                        const kpi = calculateAssigneeTaskStandardKpi({
                                            userPositions: userPos,
                                            diffMultiplier,
                                            difficulty: item.workload_metrics?.difficulty,
                                            progressPercent: progress,
                                            ratingStars: rating ? RATING_CONFIG[rating]?.stars ?? null : null,
                                            incidents: ev?.incidents || [],
                                            bonusPoints: ev?.bonus_points || 0,
                                            taskType,
                                            taskStatus: status,
                                            customProductivityScore: ev?.custom_productivity_score,
                                            customQualityScore: ev?.custom_quality_score,
                                            sharePercent: share,
                                            workNature: item.work_nature,
                                        })
                                        const isActive = activeTab.trim().toLowerCase() === a.name.trim().toLowerCase()
                                        const hasIncidents = (ev?.incidents || []).length > 0

                                        return (
                                            <button
                                                key={a.name}
                                                type="button"
                                                onClick={() => setActiveTab(a.name)}
                                                className={`w-full p-2.5 rounded-2xl border text-left transition-all ${
                                                    isActive
                                                        ? 'bg-white border-indigo-500 ring-2 ring-indigo-500/30 shadow-xs'
                                                        : 'bg-white/70 border-stone-200 hover:bg-white text-stone-700 hover:border-stone-300'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-1.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div
                                                            className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                                                isActive
                                                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                                                    : 'bg-indigo-100 text-indigo-800'
                                                            }`}
                                                        >
                                                            {a.name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-xs font-black text-stone-900 truncate">
                                                                {a.name}
                                                            </div>
                                                            <div className="text-[10px] text-stone-500 flex items-center gap-1">
                                                                <span>
                                                                    {taskType === 'secondary' ? '➕ Việc phụ' : '⭐ Việc chính'}
                                                                </span>
                                                                <span>•</span>
                                                                <span className="font-bold text-stone-700">{share}%</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Điểm số & Xếp loại */}
                                                    <div className="text-right shrink-0">
                                                        {taskType === 'secondary' ? (
                                                            <div className="text-xs font-black text-indigo-600">
                                                                +{kpi.bonusOverTargetPoints}đ
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-xs font-black text-stone-900">
                                                                    {kpi.totalKpi}đ
                                                                </span>
                                                                <span
                                                                    className={`text-[9px] font-black px-1 rounded ${
                                                                        kpi.grade === 'A+'
                                                                            ? 'bg-emerald-100 text-emerald-800'
                                                                            : kpi.grade === 'A'
                                                                            ? 'bg-teal-100 text-teal-800'
                                                                            : kpi.grade === 'B'
                                                                            ? 'bg-blue-100 text-blue-800'
                                                                            : 'bg-rose-100 text-rose-800'
                                                                    }`}
                                                                >
                                                                    {kpi.grade}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Cảnh báo lỗi vi phạm (nếu có) */}
                                                {hasIncidents && (
                                                    <div className="mt-1.5 pt-1 border-t border-stone-100 flex items-center gap-1 text-[10px] text-rose-600 font-bold">
                                                        <span>
                                                            ⚠️ {ev?.incidents?.length} lỗi (-
                                                            {(ev?.incidents || []).reduce((s, i) => s + i.penalty_points, 0)}
                                                            đ)
                                                        </span>
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}

                            {assignees.length > 0 && (
                                <div className="text-[10px] text-stone-400 text-center pt-1">
                                    Tổng tỷ lệ: <b className={totalShareSum === 100 ? 'text-emerald-600' : 'text-amber-600'}>{totalShareSum}%</b>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* CỘT PHẢI (Nội dung chi tiết): Phụ thuộc vào activeTab */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 bg-white">
                        {activeTab === 'overview' ? (
                            <>
                                {/* Task Summary Box */}
                                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
                                    <div className="text-sm font-bold text-stone-800 leading-snug">
                                        {item.sort_order}. {item.content}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
                                        {item.category && (
                                            <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 font-medium">
                                                {item.category}
                                            </span>
                                        )}
                                        {item.location_note && (
                                            <span className="px-2 py-0.5 rounded-md bg-white border border-stone-200 font-medium">
                                                📍 {item.location_note}
                                            </span>
                                        )}
                                        {assignees.length > 0 && (
                                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                                                👤 Phụ trách: {assignees.map(a => a.name).join(', ')}
                                            </span>
                                        )}
                                        {hasWorkloadData(workloadMetrics) && (
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
                                                ⚖️ Số liệu: {formatWorkloadSummaryText(workloadMetrics, item.work_nature)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 1. Completion Status & Progress % */}
                                <div className="space-y-2.5">
                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                        <label className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
                                            1. Trạng thái & Tiến độ tổng quan của công việc (%)
                                        </label>
                                        <span className="text-[11px] text-stone-500 italic">
                                            (Đánh giá chung để theo dõi ca và gợi ý số liệu ban đầu)
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {(
                                            [
                                                { key: 'completed', title: 'Hoàn thành (100%)' },
                                                { key: 'partial', title: 'Đạt một phần' },
                                                { key: 'uncompleted', title: 'Chưa xong (0%)' },
                                                { key: 'cancelled', title: 'Hoãn / Hủy' },
                                            ] as { key: WorkPlanItemStatus; title: string }[]
                                        ).map(opt => {
                                            const cfg = ITEM_STATUS_CONFIG[opt.key]
                                            const isSelected = status === opt.key
                                            return (
                                                <button
                                                    key={opt.key}
                                                    type="button"
                                                    onClick={() => handleStatusChange(opt.key)}
                                                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                                        isSelected
                                                            ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ring-2 ring-offset-1 ring-emerald-500/40 shadow-xs`
                                                            : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                                                    }`}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                                                    {opt.title}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Progress Slider & Quick Pills */}
                                    <div className="flex items-center gap-3 pt-1">
                                        <span className="text-xs font-semibold text-stone-600 w-24">
                                            Tiến độ: <b className="text-emerald-700">{progress}%</b>
                                        </span>
                                        <input
                                            type="range"
                                            min={0}
                                            max={100}
                                            step={5}
                                            value={progress}
                                            onChange={e => {
                                                const val = Number(e.target.value)
                                                setProgress(val)
                                                if (val === 100) setStatus('completed')
                                                else if (val === 0 && status === 'completed') setStatus('uncompleted')
                                                else if (val > 0 && val < 100) setStatus('partial')
                                            }}
                                            className="flex-1 accent-emerald-600 cursor-pointer"
                                        />
                                        <div className="flex items-center gap-1">
                                            {[0, 50, 75, 100].map(pct => (
                                                <button
                                                    key={pct}
                                                    type="button"
                                                    onClick={() => {
                                                        setProgress(pct)
                                                        if (pct === 100) setStatus('completed')
                                                        else if (pct === 0) setStatus('uncompleted')
                                                        else setStatus('partial')
                                                    }}
                                                    className={`px-2 py-1 rounded-md text-[11px] font-bold border ${
                                                        progress === pct
                                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                                            : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                                    }`}
                                                >
                                                    {pct}%
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Quality Rating (Stars + Label) */}
                                {status !== 'cancelled' && (
                                    <div className="space-y-2.5">
                                        <div className="flex flex-wrap items-center justify-between gap-1">
                                            <label className="text-xs font-bold uppercase tracking-wider text-stone-700 block">
                                                2. Đánh giá chất lượng chung của công việc (Gợi ý tự động)
                                            </label>
                                            <span className="text-[11px] text-stone-500 italic">
                                                (Tham khảo — điểm chất lượng chấm theo lỗi thực tế bên phải)
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                            {RATING_KEYS.map(rKey => {
                                                const rCfg = RATING_CONFIG[rKey]
                                                const active = rating === rKey
                                                return (
                                                    <button
                                                        key={rKey}
                                                        type="button"
                                                        onClick={() => setRating(rKey)}
                                                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                                                            active
                                                                ? `${rCfg.bgClass} ${rCfg.textClass} ${rCfg.borderClass} ring-2 ring-amber-400 shadow-xs`
                                                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-0.5 text-amber-400">
                                                            {Array.from({ length: rCfg.stars }).map((_, i) => (
                                                                <Star
                                                                    key={i}
                                                                    size={13}
                                                                    className="fill-amber-400 text-amber-400"
                                                                />
                                                            ))}
                                                        </div>
                                                        <span className="text-xs font-bold">
                                                            {rCfg.badgeEmoji} {rCfg.label}
                                                        </span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* 3. Manager Evaluation Note + Quick Tags */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                                        <MessageSquare size={14} className="text-emerald-600" />
                                        3. Nhận xét của Quản lý cuối ngày
                                    </label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {QUICK_EVALUATION_NOTES.map((quickText, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() =>
                                                    setNote(prev =>
                                                        prev.trim() ? `${prev.trim()}. ${quickText}` : quickText
                                                    )
                                                }
                                                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-stone-200 text-[11px] font-medium text-stone-600 transition-colors"
                                            >
                                                + {quickText}
                                            </button>
                                        ))}
                                    </div>
                                    <textarea
                                        value={note}
                                        onChange={e => setNote(e.target.value)}
                                        rows={2}
                                        placeholder="Ghi nhận kết quả cụ thể, khen thưởng hoặc lưu ý nhắc nhở nhân viên..."
                                        className="w-full rounded-xl border border-stone-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 p-3 text-sm text-stone-800 outline-hidden"
                                    />
                                </div>

                                {/* 4. Completion Proof Images */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                                            <ImageIcon size={14} className="text-emerald-600" />
                                            4. Hình ảnh minh chứng cuối ngày (Tùy chọn)
                                        </label>
                                        <button
                                            type="button"
                                            disabled={uploading}
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                                        >
                                            {uploading ? (
                                                <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                                <Camera size={14} />
                                            )}
                                            {uploading ? 'Đang tải ảnh...' : 'Thêm ảnh kết quả'}
                                        </button>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={e => handleUploadFiles(e.target.files)}
                                        />
                                    </div>

                                    {images.length > 0 && (
                                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-1">
                                            {images.map((url, idx) => (
                                                <div
                                                    key={idx}
                                                    className="relative group aspect-square rounded-xl overflow-hidden border border-stone-200 bg-stone-100"
                                                >
                                                    <img
                                                        src={url}
                                                        alt={`Minh chứng ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                                                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-rose-600 transition-colors"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 5. Auto Carry-Over Option if Partial or Uncompleted */}
                                {(status === 'partial' || status === 'uncompleted') && !item.carried_to_date && (
                                    <label className="flex items-center gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={carryOverTomorrow}
                                            onChange={e => setCarryOverTomorrow(e.target.checked)}
                                            className="w-4 h-4 accent-amber-600 rounded-sm"
                                        />
                                        <div className="text-xs text-amber-900">
                                            <div className="font-bold flex items-center gap-1.5">
                                                <ArrowRight size={14} className="text-amber-600" />
                                                Tự động chuyển phần việc chưa xong sang Kế hoạch ngày hôm sau
                                            </div>
                                            <div className="text-amber-700 mt-0.5">
                                                Hệ thống sẽ tự động tạo đầu việc này trong bảng Kế hoạch ngày kế tiếp để không bị sót việc.
                                            </div>
                                        </div>
                                    </label>
                                )}
                            </>
                        ) : (
                            /* CỘT PHẢI KHI CHỌN 1 NHÂN VIÊN: Form Đánh giá KPI của nhân viên đó */
                            <div className="space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('overview')}
                                            className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-1 transition-colors"
                                        >
                                            ← Tổng quan công việc
                                        </button>
                                        <span className="text-stone-300">/</span>
                                        <span className="text-xs font-black text-indigo-900 flex items-center gap-1">
                                            <span>Chấm KPI:</span>
                                            <span className="text-sm text-indigo-700 font-extrabold">{activeTab}</span>
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-stone-400">
                                        Mọi thay đổi được lưu khi bấm nút Lưu phía dưới
                                    </div>
                                </div>

                                <AssigneeEvaluationSection
                                    assignees={assignees}
                                    workloadMetrics={workloadMetrics}
                                    progressPercent={progress}
                                    taskStatus={status}
                                    ratingStars={rating ? RATING_CONFIG[rating]?.stars ?? null : null}
                                    value={assigneeEvaluations}
                                    onChange={setAssigneeEvaluations}
                                    activeAssigneeName={activeTab}
                                    onSelectAssignee={setActiveTab}
                                    workNature={item.work_nature}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-2.5 shrink-0">
                    <div className="text-xs text-stone-500 hidden sm:block">
                        {activeTab === 'overview' ? (
                            <span>Đang ở mục: <b>Tổng quan công việc</b></span>
                        ) : (
                            <span>Đang đánh giá KPI cho: <b className="text-indigo-700">{activeTab}</b></span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            disabled={saving || uploading}
                            onClick={handleSave}
                            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                        >
                            <CheckCircle2 size={16} />
                            {saving ? 'Đang lưu...' : 'Lưu Đánh Giá & Số Liệu'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
