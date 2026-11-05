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
} from 'lucide-react'
import {
    WorkPlanItem,
    WorkPlanItemStatus,
    WorkPlanRating,
    WorkloadMetrics,
    ITEM_STATUS_CONFIG,
    RATING_CONFIG,
    QUICK_EVALUATION_NOTES,
} from './types'
import { uploadTaskImage } from '@/components/tasks/taskUtils'
import WorkloadMetricsSection from './WorkloadMetricsSection'

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
    const [carryOverTomorrow, setCarryOverTomorrow] = useState<boolean>(false)
    const [uploading, setUploading] = useState<boolean>(false)
    const [saving, setSaving] = useState<boolean>(false)

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
            setCarryOverTomorrow(false)
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
            await onSaveEvaluation(
                item.id,
                {
                    status,
                    progress_percent: progress,
                    rating,
                    rating_stars: rating ? RATING_CONFIG[rating].stars : null,
                    evaluation_note: note.trim() || null,
                    completion_images: images,
                    workload_metrics: workloadMetrics,
                },
                carryOverTomorrow && (status === 'partial' || status === 'uncompleted')
            )
            onClose()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 md:p-6">
            <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl max-h-[93vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-extrabold text-base">
                            #{item.sort_order}
                        </div>
                        <div>
                            <h3 className="text-base md:text-lg font-bold">
                                Đánh Giá & Gắn Số Liệu Công Việc Cuối Ngày
                            </h3>
                            <p className="text-xs text-emerald-100 line-clamp-1">{item.content}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
                    {/* Task Summary Box */}
                    <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-1.5">
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
                            {Array.isArray(item.assignees) && item.assignees.length > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                                    👤 Phụ trách: {item.assignees.map(a => a.name).join(', ')}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* NEW: Workload Metrics & Export Order Linker */}
                    <WorkloadMetricsSection
                        systemCode={item.system_code}
                        planDate={item.plan_date}
                        value={workloadMetrics}
                        onChange={setWorkloadMetrics}
                    />

                    {/* 1. Completion Status & Progress % */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
                            1. Trạng thái hoàn thành & Tiến độ (%)
                        </label>
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
                                    else if (val === 0 && status === 'completed')
                                        setStatus('uncompleted')
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
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
                                2. Đánh giá chất lượng thực hiện
                            </label>
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
                                            prev.trim()
                                                ? `${prev.trim()}. ${quickText}`
                                                : quickText
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
                                            onClick={() =>
                                                setImages(prev => prev.filter((_, i) => i !== idx))
                                            }
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
                    {(status === 'partial' || status === 'uncompleted') &&
                        !item.carried_to_date && (
                            <label className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer">
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
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2.5">
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
    )
}
