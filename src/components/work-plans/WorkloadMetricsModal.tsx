'use client'

import React, { useState, useEffect } from 'react'
import { X, Scale, CheckCircle2, RotateCcw } from 'lucide-react'
import { WorkPlanItem, WorkloadMetrics, WorkPlanAssigneeEvaluation } from './types'
import WorkloadMetricsSection from './WorkloadMetricsSection'
import AssigneeEvaluationSection from './AssigneeEvaluationSection'

interface WorkloadMetricsModalProps {
    item: WorkPlanItem | null
    isOpen: boolean
    onClose: () => void
    onSaveWorkload: (itemId: string, workloadMetrics: WorkloadMetrics) => Promise<void>
}

export default function WorkloadMetricsModal({
    item,
    isOpen,
    onClose,
    onSaveWorkload,
}: WorkloadMetricsModalProps) {
    const [workloadMetrics, setWorkloadMetrics] = useState<WorkloadMetrics>({})
    const [assigneeEvaluations, setAssigneeEvaluations] = useState<WorkPlanAssigneeEvaluation[]>([])
    const [saving, setSaving] = useState<boolean>(false)

    useEffect(() => {
        if (!item) return
        const wl = item.workload_metrics || {}
        setWorkloadMetrics(wl)
        setAssigneeEvaluations(wl.assignee_evaluations || item.assignee_evaluations || [])
    }, [item])

    if (!isOpen || !item) return null

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        try {
            const nextMetrics: WorkloadMetrics = {
                ...workloadMetrics,
                assignee_evaluations: assigneeEvaluations,
            }
            await onSaveWorkload(item.id, nextMetrics)
            onClose()
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-2 sm:p-4 md:p-6 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-6xl 2xl:max-w-7xl overflow-hidden flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="px-6 py-4.5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                            <Scale size={22} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-extrabold tracking-tight truncate">
                                Số Liệu & Chứng Từ Chứng Minh Công Việc
                            </h3>
                            <p className="text-xs text-stone-300 truncate">
                                #{item.sort_order}. {item.content}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <form
                    onSubmit={handleSave}
                    className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5"
                >
                    <WorkloadMetricsSection
                        systemCode={item.system_code}
                        planDate={item.plan_date}
                        value={workloadMetrics}
                        onChange={setWorkloadMetrics}
                        defaultCollapsed={false}
                        workNature={item.work_nature || 'labor'}
                    />

                    {/* NEW: Phân bổ sản lượng cá nhân & Ghi nhận vi phạm / lỗi xét KPI */}
                    <AssigneeEvaluationSection
                        assignees={item.assignees || []}
                        workloadMetrics={workloadMetrics}
                        progressPercent={item.progress_percent || 100}
                        taskStatus={item.status}
                        value={assigneeEvaluations}
                        onChange={setAssigneeEvaluations}
                    />

                    {/* Footer Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-stone-200">
                        <button
                            type="button"
                            onClick={() => {
                                setWorkloadMetrics({})
                                setAssigneeEvaluations([])
                            }}
                            className="px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-stone-600 text-xs font-bold flex items-center gap-1.5 transition-colors"
                        >
                            <RotateCcw size={14} />
                            Xóa trắng số liệu
                        </button>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-sm font-semibold hover:bg-stone-100 transition-colors"
                            >
                                Đóng
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold shadow-sm flex items-center gap-2 transition-all"
                            >
                                <CheckCircle2 size={16} />
                                {saving ? 'Đang lưu...' : 'Lưu số liệu & Phân bổ KPI'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}

