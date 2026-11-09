'use client'

import React, { useState } from 'react'
import {
    AlertTriangle,
    Award,
    Plus,
    X,
    UserCheck,
    ChevronDown,
    ChevronUp,
    ShieldAlert,
    HelpCircle,
    Info,
    Clock,
    Zap,
} from 'lucide-react'
import {
    WorkPlanAssignee,
    WorkPlanAssigneeEvaluation,
    WorkPlanAssigneeIncident,
    WorkloadMetrics,
    DEFAULT_INCIDENT_TEMPLATES,
    IncidentSeverity,
    DIFFICULTY_CONFIG,
    getProductivityScoreByDifficulty,
    calculateAssigneeTaskStandardKpi,
    calculateWorkSpeed,
    WorkPlanTaskType,
    WorkPlanItemStatus,
} from './types'

interface AssigneeEvaluationSectionProps {
    assignees: WorkPlanAssignee[]
    workloadMetrics: WorkloadMetrics
    progressPercent?: number
    taskStatus?: WorkPlanItemStatus
    ratingStars?: number | null
    value: WorkPlanAssigneeEvaluation[]
    onChange: (next: WorkPlanAssigneeEvaluation[]) => void
    activeAssigneeName?: string | null
    onSelectAssignee?: (name: string) => void
}

export default function AssigneeEvaluationSection({
    assignees,
    workloadMetrics,
    progressPercent = 100,
    taskStatus = 'completed',
    ratingStars = null,
    value,
    onChange,
    activeAssigneeName = null,
    onSelectAssignee,
}: AssigneeEvaluationSectionProps) {
    // State popover thêm lỗi cho từng nhân viên
    const [activeIncidentPickerAssignee, setActiveIncidentPickerAssignee] = useState<string | null>(null)
    const [customIncidentName, setCustomIncidentName] = useState<string>('')
    const [customPenalty, setCustomPenalty] = useState<number>(10)
    const [customSeverity, setCustomSeverity] = useState<IncidentSeverity>('moderate')

    // State popover thêm thưởng
    const [activeBonusPickerAssignee, setActiveBonusPickerAssignee] = useState<string | null>(null)
    const [bonusPointsInput, setBonusPointsInput] = useState<number>(10)
    const [bonusReasonInput, setBonusReasonInput] = useState<string>('')

    // Tập hợp tên các nhân viên đã được chỉnh tay % đóng góp (để cố định không bị nhảy lại)
    const [manuallyEditedAssignees, setManuallyEditedAssignees] = useState<Set<string>>(new Set())

    // Đảm bảo mỗi assignee trong công việc đều có 1 bản ghi evaluation tương ứng
    const ensureEvaluations = (): WorkPlanAssigneeEvaluation[] => {
        if (!Array.isArray(assignees) || assignees.length === 0) {
            return value || []
        }

        const map = new Map<string, WorkPlanAssigneeEvaluation>()
        ;(value || []).forEach(v => {
            const k = (v.assignee_name || '').trim().toLowerCase()
            if (k) map.set(k, v)
        })

        const defaultShare = Math.round(100 / assignees.length)
        return assignees.map((a, idx) => {
            const k = (a.name || '').trim().toLowerCase()
            const existing = map.get(k)
            if (existing) {
                return {
                    ...existing,
                    regular_hours: existing.regular_hours ?? a.regular_hours ?? 8,
                    overtime_hours: existing.overtime_hours ?? a.overtime_hours ?? 0,
                }
            }

            // Người cuối cùng nhận phần còn lại để tổng là 100%
            const share = idx === assignees.length - 1 ? 100 - defaultShare * (assignees.length - 1) : defaultShare
            return {
                assignee_id: a.id,
                assignee_name: a.name,
                share_percent: share,
                role: assignees.length === 1 ? 'equal' : idx === 0 ? 'main' : 'support',
                task_type: a.task_type || 'primary',
                regular_hours: a.regular_hours ?? 8,
                overtime_hours: a.overtime_hours ?? 0,
                incidents: [],
                bonus_points: 0,
            }
        })
    }

    const currentEvaluations = ensureEvaluations()

    const updateEvaluation = (assigneeName: string, updater: (prev: WorkPlanAssigneeEvaluation) => WorkPlanAssigneeEvaluation) => {
        const next = currentEvaluations.map(ev => {
            if (ev.assignee_name.trim().toLowerCase() === assigneeName.trim().toLowerCase()) {
                return updater(ev)
            }
            return ev
        })
        onChange(next)
    }

    // Phân bổ tỷ lệ % đóng góp thông minh:
    // Khi tăng người này -> người kia tự giảm bù trừ
    // Khi chỉnh tiếp người thứ 2 -> chỉ số người đầu tiên ĐÃ CHỈNH được giữ nguyên không đổi!
    const handleSharePercentChange = (targetName: string, rawValue: number) => {
        const val = Math.max(0, Math.min(100, Math.round(rawValue)))
        const normTarget = targetName.trim().toLowerCase()

        // Ghi nhận người này vào tập đã chỉnh tay
        const nextEdited = new Set(manuallyEditedAssignees)
        nextEdited.add(normTarget)
        setManuallyEditedAssignees(nextEdited)

        const totalAssignees = currentEvaluations.length
        if (totalAssignees <= 1) {
            updateEvaluation(targetName, prev => ({ ...prev, share_percent: 100 }))
            return
        }

        if (totalAssignees === 2) {
            // Trường hợp 2 người: người này tăng thì người kia giảm chính xác phần bù (100 - val)
            const otherVal = Math.max(0, 100 - val)
            const next = currentEvaluations.map(ev => {
                if (ev.assignee_name.trim().toLowerCase() === normTarget) {
                    return { ...ev, share_percent: val }
                }
                return { ...ev, share_percent: otherVal }
            })
            onChange(next)
            return
        }

        // Trường hợp 3 người trở lên:
        // 1. Những người đã chỉnh trước đó (ngoại trừ người hiện tại) được GIỮ NGUYÊN HOÀN TOÀN
        const otherEditedNames = Array.from(nextEdited).filter(name => name !== normTarget)
        const lockedSum = currentEvaluations
            .filter(ev => otherEditedNames.includes(ev.assignee_name.trim().toLowerCase()))
            .reduce((sum, ev) => sum + (ev.share_percent ?? 0), 0)

        // Đảm bảo val không vượt quá phần còn lại sau khi trừ những người đã khóa
        const maxAllowedForTarget = Math.max(0, 100 - lockedSum)
        const clampedVal = Math.min(val, maxAllowedForTarget)

        // 2. Phân bổ số % còn lại cho những người CHƯA chỉnh
        const uneditedAssignees = currentEvaluations.filter(
            ev => !nextEdited.has(ev.assignee_name.trim().toLowerCase())
        )

        let nextEvaluations: WorkPlanAssigneeEvaluation[] = []

        if (uneditedAssignees.length > 0) {
            const remainingToDistribute = Math.max(0, 100 - lockedSum - clampedVal)
            const countUnedited = uneditedAssignees.length
            const baseSharePerUnedited = Math.floor(remainingToDistribute / countUnedited)
            let remainder = remainingToDistribute - baseSharePerUnedited * countUnedited

            nextEvaluations = currentEvaluations.map(ev => {
                const k = ev.assignee_name.trim().toLowerCase()
                if (k === normTarget) {
                    return { ...ev, share_percent: clampedVal }
                }
                if (otherEditedNames.includes(k)) {
                    // Người đã chỉnh trước đó: GIỮ NGUYÊN!
                    return ev
                }
                // Người chưa chỉnh: nhận phần phân bổ còn lại
                const extra = remainder > 0 ? 1 : 0
                if (remainder > 0) remainder--
                return { ...ev, share_percent: baseSharePerUnedited + extra }
            })
        } else {
            // Tất cả mọi người đều đã từng chỉnh:
            // Cập nhật người này, và bù trừ vào người cuối cùng trong danh sách (khác người đang chỉnh)
            const otherPersons = currentEvaluations.filter(
                ev => ev.assignee_name.trim().toLowerCase() !== normTarget
            )
            const lastOther = otherPersons[otherPersons.length - 1]
            const remainingForLast = Math.max(
                0,
                100 - lockedSum - clampedVal + (lastOther?.share_percent ?? 0)
            )

            nextEvaluations = currentEvaluations.map(ev => {
                const k = ev.assignee_name.trim().toLowerCase()
                if (k === normTarget) {
                    return { ...ev, share_percent: clampedVal }
                }
                if (lastOther && k === lastOther.assignee_name.trim().toLowerCase()) {
                    return { ...ev, share_percent: remainingForLast }
                }
                return ev
            })
        }

        onChange(nextEvaluations)
    }

    // Chia đều 50-50 (hoặc 33-33-34)
    const handleSetEqualShare = () => {
        setManuallyEditedAssignees(new Set())
        const count = assignees.length
        if (count === 0) return
        const def = Math.round(100 / count)
        const next = currentEvaluations.map((ev, idx) => ({
            ...ev,
            share_percent: idx === count - 1 ? 100 - def * (count - 1) : def,
            role: 'equal',
        }))
        onChange(next)
    }

    // Chia Lái chính (70%) - Phụ (30%)
    const handleSetMainSupportShare = () => {
        setManuallyEditedAssignees(new Set())
        if (assignees.length !== 2) return
        const next = currentEvaluations.map((ev, idx) => ({
            ...ev,
            share_percent: idx === 0 ? 70 : 30,
            role: idx === 0 ? 'main' : 'support',
        }))
        onChange(next)
    }

    // Thêm lỗi từ template
    const handleAddIncident = (
        assigneeName: string,
        template: { type: string; name: string; severity: IncidentSeverity; penalty: number; group: any }
    ) => {
        const newIncident: WorkPlanAssigneeIncident = {
            id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: template.type,
            name: template.name,
            group: template.group,
            severity: template.severity,
            penalty_points: template.penalty,
            created_at: new Date().toISOString(),
        }

        updateEvaluation(assigneeName, prev => ({
            ...prev,
            incidents: [...(prev.incidents || []), newIncident],
        }))
        setActiveIncidentPickerAssignee(null)
    }

    // Thêm lỗi tùy chỉnh
    const handleAddCustomIncident = (assigneeName: string) => {
        if (!customIncidentName.trim()) return
        const newIncident: WorkPlanAssigneeIncident = {
            id: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'custom',
            name: customIncidentName.trim(),
            group: 'other',
            severity: customSeverity,
            penalty_points: Math.abs(customPenalty),
            created_at: new Date().toISOString(),
        }

        updateEvaluation(assigneeName, prev => ({
            ...prev,
            incidents: [...(prev.incidents || []), newIncident],
        }))
        setCustomIncidentName('')
        setActiveIncidentPickerAssignee(null)
    }

    // Xóa lỗi
    const handleRemoveIncident = (assigneeName: string, incidentId: string) => {
        updateEvaluation(assigneeName, prev => ({
            ...prev,
            incidents: (prev.incidents || []).filter(i => i.id !== incidentId),
        }))
    }

    // Thêm thưởng
    const handleAddBonus = (assigneeName: string) => {
        if (bonusPointsInput <= 0) return
        updateEvaluation(assigneeName, prev => ({
            ...prev,
            bonus_points: (prev.bonus_points || 0) + bonusPointsInput,
            bonus_reason: bonusReasonInput.trim() || prev.bonus_reason || null,
        }))
        setBonusPointsInput(10)
        setBonusReasonInput('')
        setActiveBonusPickerAssignee(null)
    }

    // Xóa thưởng
    const handleResetBonus = (assigneeName: string) => {
        updateEvaluation(assigneeName, prev => ({
            ...prev,
            bonus_points: 0,
            bonus_reason: null,
        }))
    }

    // Hệ số độ nặng công việc
    const diffMultiplier =
        workloadMetrics.difficulty && DIFFICULTY_CONFIG[workloadMetrics.difficulty]
            ? DIFFICULTY_CONFIG[workloadMetrics.difficulty].multiplier
            : 1.0

    const totalPos = Number(workloadMetrics.positions_count) || 0
    const totalKg = Number(workloadMetrics.weight_kg) || 0
    const totalConts = Number(workloadMetrics.containers_count) || 0
    const totalPkgs = Number(workloadMetrics.packages_count) || 0

    if (!Array.isArray(assignees) || assignees.length === 0) {
        return (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 text-xs text-amber-900">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                        <UserCheck size={18} />
                    </div>
                    <div>
                        <div className="font-bold text-stone-900">
                            Chưa phân công nhân sự phụ trách cho đầu việc này
                        </div>
                        <div className="text-[11px] text-stone-600 mt-0.5 leading-relaxed">
                            Mục <b>Phân bổ sản lượng & Xét KPI cá nhân</b> sẽ tự động kích hoạt ngay khi đầu việc có nhân sự. Hãy bấm nút <b>"👤 Giao người"</b> trên dòng công việc để chỉ định người thực hiện.
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const displayedEvaluations = activeAssigneeName
        ? currentEvaluations.filter(
              ev => ev.assignee_name.trim().toLowerCase() === activeAssigneeName.trim().toLowerCase()
          )
        : currentEvaluations
    const effectiveEvaluations = displayedEvaluations.length > 0 ? displayedEvaluations : currentEvaluations.slice(0, 1)

    const currentActiveIdx = currentEvaluations.findIndex(
        ev => ev.assignee_name.trim().toLowerCase() === (activeAssigneeName || '').trim().toLowerCase()
    )
    const prevAssignee = currentActiveIdx > 0 ? currentEvaluations[currentActiveIdx - 1] : null
    const nextAssignee = currentActiveIdx >= 0 && currentActiveIdx < currentEvaluations.length - 1 ? currentEvaluations[currentActiveIdx + 1] : null

    return (
        <div className={`space-y-4 ${activeAssigneeName ? '' : 'rounded-2xl border border-rose-200/90 bg-rose-50/20 p-4'}`}>
            {/* Header khi ở chế độ hiển thị toàn bộ */}
            {!activeAssigneeName && (
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-rose-100">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs">
                            <UserCheck size={15} />
                        </div>
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">
                                Đánh Giá Cá Nhân & Ghi Nhận Lỗi Vi Phạm (Xét KPI)
                            </h4>
                            <p className="text-[11px] text-stone-500">
                                Phân chia khối lượng cho từng người, trừ điểm vi phạm khi xảy ra sự cố và cộng điểm thưởng
                            </p>
                        </div>
                    </div>

                    {/* Badge Tổng % & Nút chia nhanh */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {(() => {
                            const totalShareSum = currentEvaluations.reduce((sum, ev) => sum + (ev.share_percent ?? 0), 0)
                            return (
                                <span
                                    className={`px-2 py-0.5 rounded-lg text-[11px] font-black border shadow-2xs ${
                                        totalShareSum === 100
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                            : 'bg-amber-50 text-amber-800 border-amber-300'
                                    }`}
                                    title="Tổng tỷ lệ đóng góp của tất cả nhân sự"
                                >
                                    Tổng: {totalShareSum}% {totalShareSum === 100 ? '✓' : '(Chưa đủ 100%)'}
                                </span>
                            )
                        })()}

                        {assignees.length === 2 && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSetEqualShare}
                                    className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-[11px] font-bold text-stone-700 shadow-2xs"
                                >
                                    🔄 50% - 50%
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSetMainSupportShare}
                                    className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-[11px] font-bold text-indigo-700"
                                >
                                    Chính 70% • Phụ 30%
                                </button>
                            </>
                        )}

                        {assignees.length > 2 && (
                            <button
                                type="button"
                                onClick={handleSetEqualShare}
                                className="px-2 py-0.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-[11px] font-bold text-stone-700 shadow-2xs"
                                title="Đặt lại chia đều cho tất cả mọi người"
                            >
                                🔄 Chia đều lại ({Math.round(100 / assignees.length)}%)
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Thanh điều hướng chuyển nhanh nhân sự khi ở chế độ chi tiết 1 người */}
            {activeAssigneeName && assignees.length > 1 && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-stone-100/90 border border-stone-200 text-xs">
                    <button
                        type="button"
                        disabled={!prevAssignee}
                        onClick={() => prevAssignee && onSelectAssignee?.(prevAssignee.assignee_name)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors shadow-2xs flex items-center gap-1"
                    >
                        ← {prevAssignee ? prevAssignee.assignee_name : 'Đầu danh sách'}
                    </button>
                    <span className="text-[11px] font-bold text-stone-600">
                        Nhân sự {currentActiveIdx + 1} / {currentEvaluations.length}
                    </span>
                    <button
                        type="button"
                        disabled={!nextAssignee}
                        onClick={() => nextAssignee && onSelectAssignee?.(nextAssignee.assignee_name)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-stone-200 text-stone-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 transition-colors shadow-2xs flex items-center gap-1"
                    >
                        {nextAssignee ? nextAssignee.assignee_name : 'Cuối danh sách'} →
                    </button>
                </div>
            )}

            {/* Chú thích quy chế đánh giá công bằng (chỉ hiện khi xem toàn bộ) */}
            {!activeAssigneeName && (
                <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <span className="text-sm shrink-0">💡</span>
                    <div className="space-y-0.5 leading-relaxed text-[11px]">
                        <span className="font-bold">Quy chế tiến độ & năng suất:</span> Trạng thái (Xong / Một phần) chỉ mang tính đánh dấu theo dõi ca làm việc, <b>không tự động trừ điểm năng suất</b> để tránh phạt oan nhân viên khi làm công việc lớn kéo dài 2–3 ngày. Nếu việc dở dang do nguyên nhân <i>chủ quan</i>, Quản lý hãy gán lỗi <b>"Chưa xong việc trong ca (chủ quan)"</b> (-5đ) trong danh sách lỗi bên dưới.
                    </div>
                </div>
            )}

            {/* Danh sách từng nhân viên phụ trách */}
            <div className="space-y-3">
                {effectiveEvaluations.map((ev, idx) => {
                    const share = ev.share_percent ?? (assignees.length > 0 ? Math.round(100 / assignees.length) : 100)
                    const userPos = Math.round((totalPos * share) / 100 * 10) / 10
                    const userKg = Math.round((totalKg * share) / 100)
                    const userConts = Math.round((totalConts * share) / 100 * 10) / 10
                    const userPkgs = Math.round((totalPkgs * share) / 100)

                    const speedInfo = calculateWorkSpeed({
                        positions: userPos,
                        weightKg: userKg,
                        packages: userPkgs,
                        regularHours: ev.regular_hours ?? 8,
                        overtimeHours: ev.overtime_hours ?? 0,
                    })

                    const bonus = ev.bonus_points || 0
                    const matchingAssignee = assignees.find(
                        a => (a.name || '').trim().toLowerCase() === ev.assignee_name.trim().toLowerCase()
                    )
                    const assigneeTaskType: WorkPlanTaskType = ev.task_type || matchingAssignee?.task_type || 'primary'

                    // Tính điểm KPI chuẩn theo mô hình 4 Trụ Cột (Hỗ trợ việc chính vs việc phụ mở trần 150đ)
                    const standardKpi = calculateAssigneeTaskStandardKpi({
                        userPositions: userPos,
                        diffMultiplier,
                        difficulty: workloadMetrics.difficulty,
                        progressPercent,
                        ratingStars,
                        incidents: ev.incidents || [],
                        bonusPoints: bonus,
                        taskType: assigneeTaskType,
                        taskStatus,
                        customProductivityScore: ev.custom_productivity_score,
                        customQualityScore: ev.custom_quality_score,
                        sharePercent: share,
                    })

                    const totalPenalty = (ev.incidents || []).reduce((s, i) => s + (i.penalty_points || 0), 0)

                    const isPickerOpen = activeIncidentPickerAssignee === ev.assignee_name
                    const isBonusOpen = activeBonusPickerAssignee === ev.assignee_name

                    return (
                        <div
                            key={ev.assignee_name}
                            className="bg-white rounded-xl border border-stone-200 p-3.5 space-y-3 shadow-xs"
                        >
                            {/* Dòng tiêu đề nhân viên & Phân chia khối lượng */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 font-black flex items-center justify-center text-xs">
                                        {ev.assignee_name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                                            <span>{ev.assignee_name}</span>
                                            {/* Nút chuyển Việc chính vs Việc phụ riêng cho người này */}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const nextType =
                                                        assigneeTaskType === 'primary' ? 'secondary' : 'primary'
                                                    updateEvaluation(ev.assignee_name, prev => ({
                                                        ...prev,
                                                        task_type: nextType,
                                                    }))
                                                }}
                                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold border transition-colors ${
                                                    assigneeTaskType === 'secondary'
                                                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                }`}
                                                title="Bấm để chuyển đổi giữa Việc chính (chuẩn 100đ) và Việc phụ (cộng thêm điểm lên 150đ)"
                                            >
                                                {assigneeTaskType === 'secondary' ? '➕ Việc phụ (+điểm)' : '⭐ Việc chính'}
                                            </button>
                                        </div>
                                        <div className="text-[10px] text-stone-400">
                                            Quy đổi: {userPos > 0 && <b>{userPos} vị trí</b>}
                                            {userKg > 0 && <span> • <b>{userKg.toLocaleString('vi-VN')} kg</b></span>}
                                            {userConts > 0 && <span> • <b>{userConts} Cont</b></span>}
                                        </div>
                                    </div>
                                </div>

                                {/* Thanh chỉnh % đóng góp thông minh */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                                        <span>Đóng góp:</span>
                                        {manuallyEditedAssignees.has(ev.assignee_name.trim().toLowerCase()) && (
                                            <span className="text-[10px]" title="Chỉ số người này đã được bạn nhập và cố định">
                                                🔒
                                            </span>
                                        )}
                                    </span>
                                    <div className="flex items-center gap-1 bg-stone-50 p-1 rounded-lg border border-stone-200">
                                        <input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={share}
                                            onChange={e => {
                                                const val = Number(e.target.value) || 0
                                                handleSharePercentChange(ev.assignee_name, val)
                                            }}
                                            className="w-12 text-center text-xs font-black text-stone-900 bg-white border border-stone-200 rounded px-1 py-0.5 outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                                            title="Nhập tỷ lệ % đóng góp (các nhân sự khác sẽ tự bù trừ để tổng luôn bằng 100%)"
                                        />
                                        <span className="text-xs font-bold text-stone-500 pr-1">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* ⏱️ KHỐI THỜI GIAN LÀM VIỆC & TĂNG CA (OT) */}
                            <div className="p-2.5 rounded-xl bg-stone-50/80 border border-stone-200/80 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-1.5">
                                    <span className="text-[10px] font-black uppercase text-stone-600 tracking-wider flex items-center gap-1">
                                        <Clock size={12} className="text-indigo-600" />
                                        <span>Giờ làm việc & Tăng ca (OT):</span>
                                    </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                                    {/* Giờ ca chuẩn */}
                                    <div className="flex items-center gap-1">
                                        <span className="text-[11px] font-bold text-stone-600">Ca chuẩn:</span>
                                        <div className="flex items-center gap-0.5 bg-white px-2 py-0.5 rounded-lg border border-stone-200 shadow-2xs">
                                            <input
                                                type="number"
                                                min={0}
                                                max={24}
                                                step={0.5}
                                                value={ev.regular_hours ?? 8}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0
                                                    updateEvaluation(ev.assignee_name, prev => ({ ...prev, regular_hours: val }))
                                                }}
                                                className="w-10 text-center text-xs font-black text-stone-900 outline-hidden focus:text-indigo-600"
                                            />
                                            <span className="text-[10px] text-stone-400 font-bold">h</span>
                                        </div>
                                    </div>

                                    {/* Giờ tăng ca (OT) */}
                                    <div className="flex items-center gap-1">
                                        <span className="text-[11px] font-bold text-stone-600 flex items-center gap-1">
                                            <span>Tăng ca (OT):</span>
                                            {(ev.overtime_hours || 0) > 0 && (
                                                <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-black text-[10px]">
                                                    +{ev.overtime_hours}h
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-0.5 bg-white px-2 py-0.5 rounded-lg border border-stone-200 shadow-2xs">
                                            <input
                                                type="number"
                                                min={0}
                                                max={24}
                                                step={0.5}
                                                value={ev.overtime_hours ?? 0}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0
                                                    updateEvaluation(ev.assignee_name, prev => ({ ...prev, overtime_hours: val }))
                                                }}
                                                className="w-10 text-center text-xs font-black text-amber-700 outline-hidden focus:text-indigo-600"
                                            />
                                            <span className="text-[10px] text-stone-400 font-bold">h</span>
                                        </div>
                                    </div>

                                    {/* Nút bấm nhanh OT */}
                                    <div className="flex items-center gap-1">
                                        {[1, 1.5, 2, 3].map(h => (
                                            <button
                                                key={h}
                                                type="button"
                                                onClick={() => updateEvaluation(ev.assignee_name, prev => ({ ...prev, overtime_hours: h }))}
                                                className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold transition-all border shadow-2xs ${
                                                    (ev.overtime_hours ?? 0) === h
                                                        ? 'bg-amber-500 text-white border-amber-600 font-black'
                                                        : 'bg-white hover:bg-amber-50 text-stone-700 border-stone-200'
                                                }`}
                                            >
                                                +{h}h
                                            </button>
                                        ))}
                                        {(ev.overtime_hours || 0) > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => updateEvaluation(ev.assignee_name, prev => ({ ...prev, overtime_hours: 0 }))}
                                                className="px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-stone-100 hover:bg-rose-50 text-stone-500 hover:text-rose-600 border border-stone-200 transition-all"
                                                title="Xóa giờ tăng ca"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* Huy hiệu tổng thời gian */}
                                    <div className="sm:ml-auto flex items-center gap-1">
                                        <span className="text-[11px] font-black text-stone-700 bg-white px-2 py-0.5 rounded-lg border border-stone-200 shadow-2xs">
                                            Tổng: <b className="text-indigo-700">{speedInfo.totalHours}h</b>
                                            {(ev.overtime_hours || 0) > 0 && (
                                                <span className="text-amber-700 font-bold ml-1">(+{ev.overtime_hours}h OT)</span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Danh sách lỗi vi phạm & thưởng của người này */}
                            <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                    <span className="text-[10px] font-black uppercase text-stone-500 tracking-wider">
                                        Vi phạm & Đánh giá cá nhân:
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveIncidentPickerAssignee(isPickerOpen ? null : ev.assignee_name)
                                                setActiveBonusPickerAssignee(null)
                                            }}
                                            className="px-2 py-0.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <AlertTriangle size={12} />
                                            <span>+ Ghi nhận lỗi vi phạm</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveBonusPickerAssignee(isBonusOpen ? null : ev.assignee_name)
                                                setActiveIncidentPickerAssignee(null)
                                            }}
                                            className="px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <Award size={12} />
                                            <span>+ Thưởng điểm</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Badges danh sách lỗi đã gắn */}
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {(ev.incidents || []).length === 0 && !ev.bonus_points && (
                                        <span className="text-[11px] text-emerald-700 font-medium bg-emerald-50/70 border border-emerald-100 px-2 py-0.5 rounded-md">
                                            ✓ Không có vi phạm nào trong công việc này
                                        </span>
                                    )}

                                    {(ev.incidents || []).map(inc => (
                                        <span
                                            key={inc.id}
                                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800"
                                        >
                                            <ShieldAlert size={12} className="text-rose-600 shrink-0" />
                                            <span>{inc.name}</span>
                                            <span className="px-1 py-0.2 rounded bg-rose-600 text-white text-[10px] font-black">
                                                -{inc.penalty_points}đ
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveIncident(ev.assignee_name, inc.id)}
                                                className="text-rose-400 hover:text-rose-700 font-black ml-0.5"
                                                title="Xóa lỗi này"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}

                                    {ev.bonus_points && ev.bonus_points > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                                            <Award size={12} className="text-emerald-600 shrink-0" />
                                            <span>Thưởng: {ev.bonus_reason || 'Xuất sắc'}</span>
                                            <span className="px-1 py-0.2 rounded bg-emerald-600 text-white text-[10px] font-black">
                                                +{ev.bonus_points}đ
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleResetBonus(ev.assignee_name)}
                                                className="text-emerald-400 hover:text-rose-700 font-black ml-0.5"
                                                title="Hủy điểm thưởng"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ) : null}
                                </div>
                            </div>

                            {/* Dropdown Menu Chọn Lỗi Vi Phạm */}
                            {isPickerOpen && (
                                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-rose-950 uppercase flex items-center gap-1.5">
                                            <ShieldAlert size={13} className="text-rose-600" />
                                            Chọn lỗi vi phạm gắn cho {ev.assignee_name}:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setActiveIncidentPickerAssignee(null)}
                                            className="text-stone-400 hover:text-stone-700 text-xs font-bold"
                                        >
                                            ✕ Đóng
                                        </button>
                                    </div>

                                    {/* 5 Nhóm Lỗi Quy Chuẩn (Thống kê, Xe nâng, Hàng hóa, Vận hành, 5S) */}
                                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                                        {DEFAULT_INCIDENT_TEMPLATES.map(grp => (
                                            <div key={grp.group} className="space-y-1">
                                                <div className="text-[10px] font-extrabold uppercase text-stone-500 flex items-center gap-1">
                                                    <span>{grp.icon}</span>
                                                    <span>{grp.groupLabel}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                    {grp.items.map(item => (
                                                        <button
                                                            key={item.type}
                                                            type="button"
                                                            onClick={() =>
                                                                handleAddIncident(ev.assignee_name, {
                                                                    ...item,
                                                                    group: grp.group,
                                                                })
                                                            }
                                                            className="p-1.5 rounded-lg border border-stone-200 bg-white hover:bg-rose-50/80 hover:border-rose-300 text-left transition-colors flex items-center justify-between gap-1.5 text-xs cursor-pointer"
                                                        >
                                                            <span className="font-semibold text-stone-800 line-clamp-1">
                                                                {item.name}
                                                            </span>
                                                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-extrabold text-[10px] shrink-0">
                                                                -{item.penalty}đ
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Nhập Lỗi Khác */}
                                    <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            value={customIncidentName}
                                            onChange={e => setCustomIncidentName(e.target.value)}
                                            placeholder="Nhập lỗi vi phạm khác..."
                                            className="flex-1 min-w-[160px] px-2.5 py-1 rounded-lg border border-stone-200 text-xs bg-white outline-hidden focus:border-rose-500"
                                        />
                                        <div className="flex items-center gap-1">
                                            <span className="text-[11px] text-stone-500 font-bold">Trừ:</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={customPenalty}
                                                onChange={e => setCustomPenalty(Number(e.target.value) || 10)}
                                                className="w-14 px-1.5 py-1 rounded-lg border border-stone-200 text-xs text-center font-bold bg-white outline-hidden"
                                            />
                                            <span className="text-[11px] text-stone-500 font-bold">điểm</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleAddCustomIncident(ev.assignee_name)}
                                            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-2xs"
                                        >
                                            Thêm lỗi
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Dropdown Menu Thêm Thưởng */}
                            {isBonusOpen && (
                                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-emerald-950 uppercase flex items-center gap-1.5">
                                            <Award size={13} className="text-emerald-600" />
                                            Cộng điểm thưởng cho {ev.assignee_name}:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setActiveBonusPickerAssignee(null)}
                                            className="text-stone-400 hover:text-stone-700 text-xs font-bold"
                                        >
                                            ✕ Đóng
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            value={bonusReasonInput}
                                            onChange={e => setBonusReasonInput(e.target.value)}
                                            placeholder="Lý do thưởng (VD: Cứu hàng kịp thời, hỗ trợ ca khác)..."
                                            className="flex-1 min-w-[180px] px-2.5 py-1 rounded-lg border border-stone-200 text-xs bg-white outline-hidden focus:border-emerald-500"
                                        />
                                        <div className="flex items-center gap-1">
                                            <span className="text-[11px] text-stone-500 font-bold">Cộng:</span>
                                            <input
                                                type="number"
                                                min={1}
                                                max={100}
                                                value={bonusPointsInput}
                                                onChange={e => setBonusPointsInput(Number(e.target.value) || 10)}
                                                className="w-14 px-1.5 py-1 rounded-lg border border-stone-200 text-xs text-center font-bold bg-white outline-hidden"
                                            />
                                            <span className="text-[11px] text-stone-500 font-bold">điểm</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleAddBonus(ev.assignee_name)}
                                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-2xs"
                                        >
                                            Xác nhận thưởng
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Tóm tắt điểm KPI theo Việc Chính vs Việc Phụ */}
                            {assigneeTaskType === 'secondary' ? (
                                <div className="pt-2 border-t border-stone-100 space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-indigo-50/90 border border-indigo-200 text-xs shadow-2xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                                            <span className="font-black text-indigo-950 uppercase tracking-wide">
                                                ➕ Điểm Việc Phụ / Tăng Cường Được Cộng Thêm:
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-indigo-900 font-black">
                                            <span className="text-base text-indigo-700 font-black">+{standardKpi.bonusOverTargetPoints}</span>
                                            <span className="text-xs font-bold text-indigo-600">điểm</span>
                                            <span className="text-[10px] text-stone-500 font-normal ml-1">(Cộng dồn mở trần 150đ)</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] px-1 text-stone-600">
                                        <div className="flex items-center gap-1.5">
                                            <span>⚡ Điểm hỗ trợ ({share}% đóng góp):</span>
                                            <input
                                                type="number"
                                                min={0}
                                                max={50}
                                                step={0.5}
                                                value={
                                                    ev.custom_productivity_score !== undefined && ev.custom_productivity_score !== null
                                                        ? ev.custom_productivity_score
                                                        : standardKpi.productivityScore
                                                }
                                                onChange={e => {
                                                    const rawVal = e.target.value
                                                    const val = rawVal === '' ? null : Number(rawVal)
                                                    updateEvaluation(ev.assignee_name, prev => ({
                                                        ...prev,
                                                        custom_productivity_score: val === null ? null : Math.max(0, Math.min(50, val))
                                                    }))
                                                }}
                                                className="w-12 px-1 py-0.5 rounded border border-indigo-200 bg-white text-center font-black text-xs text-indigo-950 shadow-2xs focus:ring-1 focus:ring-indigo-500"
                                                title="Quản lý có thể gõ trực tiếp điểm hỗ trợ mong muốn (0-50đ)"
                                            />
                                            <span className="text-stone-400 font-bold text-[10px]">
                                                đ (Chuẩn {getProductivityScoreByDifficulty(workloadMetrics.difficulty, diffMultiplier)}đ × {share}%)
                                            </span>
                                            {ev.custom_productivity_score !== undefined && ev.custom_productivity_score !== null && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        updateEvaluation(ev.assignee_name, prev => ({
                                                            ...prev,
                                                            custom_productivity_score: null
                                                        }))
                                                    }}
                                                    className="text-stone-400 hover:text-rose-600 font-black text-[11px] px-0.5"
                                                    title="Khôi phục tính tự động theo % đóng góp"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-stone-400 italic">
                                            * Điểm việc phụ / hỗ trợ được cộng thẳng vào tổng điểm KPI ngày của nhân sự
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="pt-2 border-t border-stone-100 space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                                ⭐ Điểm KPI Việc Chính (Ca Chuẩn 100đ):
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-black border ${
                                                standardKpi.grade === 'A+'
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : standardKpi.grade === 'A'
                                                    ? 'bg-teal-50 text-teal-700 border-teal-200'
                                                    : standardKpi.grade === 'B'
                                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}>
                                                {standardKpi.gradeLabel}
                                            </span>
                                        </div>
                                        <div className="text-xs font-black text-stone-900">
                                            Tổng việc chính: <span className="text-indigo-600 text-sm font-black">{standardKpi.totalKpi}</span>
                                            <span className="text-stone-400 font-normal text-[11px]"> / 100đ</span>
                                        </div>
                                    </div>

                                    {/* Chi tiết 4 Trụ Cột */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                                        <div className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 ${
                                            ev.custom_productivity_score !== undefined && ev.custom_productivity_score !== null
                                                ? 'bg-amber-50/80 border-amber-300'
                                                : 'bg-stone-50 border-stone-200'
                                        }`}>
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-stone-700 font-bold shrink-0">⚡ Năng suất:</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={50}
                                                    step={0.5}
                                                    value={
                                                        ev.custom_productivity_score !== undefined && ev.custom_productivity_score !== null
                                                            ? ev.custom_productivity_score
                                                            : standardKpi.productivityScore
                                                    }
                                                    onChange={e => {
                                                        const rawVal = e.target.value
                                                        const val = rawVal === '' ? null : Number(rawVal)
                                                        updateEvaluation(ev.assignee_name, prev => ({
                                                            ...prev,
                                                            custom_productivity_score: val === null ? null : Math.max(0, Math.min(50, val))
                                                        }))
                                                    }}
                                                    className="w-11 px-1 py-0.5 rounded border border-stone-300 bg-white text-center font-black text-xs text-stone-900 shadow-2xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                    title="Quản lý có thể chấm tay trực tiếp (0-50đ). Xóa ô để quay về tự động."
                                                />
                                                <span className="text-stone-400 font-bold text-[10px]">/40-50đ</span>
                                                {ev.custom_productivity_score !== undefined && ev.custom_productivity_score !== null && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            updateEvaluation(ev.assignee_name, prev => ({
                                                                ...prev,
                                                                custom_productivity_score: null
                                                            }))
                                                        }}
                                                        className="text-stone-400 hover:text-rose-600 font-black text-[11px] leading-none px-0.5"
                                                        title="Bỏ chấm tay, khôi phục gợi ý tự động"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`p-1.5 rounded-lg border flex items-center justify-between gap-1 ${
                                            ev.custom_quality_score !== undefined && ev.custom_quality_score !== null
                                                ? 'bg-amber-50/80 border-amber-300'
                                                : 'bg-stone-50 border-stone-200'
                                        }`}>
                                            <div className="flex items-center gap-1 min-w-0">
                                                <span className="text-stone-700 font-bold shrink-0">⭐ Chất lượng:</span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={20}
                                                    step={1}
                                                    value={
                                                        ev.custom_quality_score !== undefined && ev.custom_quality_score !== null
                                                            ? ev.custom_quality_score
                                                            : standardKpi.qualityScore
                                                    }
                                                    onChange={e => {
                                                        const rawVal = e.target.value
                                                        const val = rawVal === '' ? null : Number(rawVal)
                                                        updateEvaluation(ev.assignee_name, prev => ({
                                                            ...prev,
                                                            custom_quality_score: val === null ? null : Math.max(0, Math.min(20, val))
                                                        }))
                                                    }}
                                                    className="w-11 px-1 py-0.5 rounded border border-stone-300 bg-white text-center font-black text-xs text-amber-800 shadow-2xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                    title="Quản lý có thể chấm tay trực tiếp (0-20đ) cho riêng người này. Xóa ô để quay về tự động."
                                                />
                                                <span className="text-stone-400 font-bold text-[10px]">/20đ</span>
                                                {ev.custom_quality_score !== undefined && ev.custom_quality_score !== null ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            updateEvaluation(ev.assignee_name, prev => ({
                                                                ...prev,
                                                                custom_quality_score: null
                                                            }))
                                                        }}
                                                        className="text-stone-400 hover:text-rose-600 font-black text-[11px] leading-none px-0.5"
                                                        title="Bỏ chấm tay, khôi phục gợi ý theo sao tổng quan của công việc"
                                                    >
                                                        ✕
                                                    </button>
                                                ) : ratingStars ? (
                                                    <span className="text-[10px] text-amber-600 font-bold">({ratingStars}⭐)</span>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className={`p-1.5 rounded-lg border flex items-center justify-between ${
                                            standardKpi.safetyScore < 20 ? 'bg-rose-50 border-rose-200' : 'bg-stone-50 border-stone-200'
                                        }`}>
                                            <span className={standardKpi.safetyScore < 20 ? 'text-rose-700 font-bold' : 'text-stone-600'}>
                                                🛡️ An toàn:
                                            </span>
                                            <span className={`font-black ${standardKpi.safetyScore < 20 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                                {standardKpi.safetyScore}/20đ
                                            </span>
                                        </div>
                                        <div className="p-1.5 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-between">
                                            <span className="text-stone-600">📋 Kỷ luật 5S:</span>
                                            <span className="font-black text-indigo-700">{standardKpi.disciplineScore}/15đ</span>
                                        </div>
                                    </div>

                                    {standardKpi.hasSevereIncident && (
                                        <div className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                                            ⚠️ Có lỗi vi phạm nghiêm trọng: Tước quyền xếp loại A/A+ của công việc này.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

