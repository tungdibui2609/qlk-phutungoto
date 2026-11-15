'use client'

import React from 'react'
import { Plus, Users, X } from 'lucide-react'
import { WorkPlan, WorkPlanItem, WorkPlanAssignee, WorkPlanPriority, WORK_CATEGORIES, WorkPlanWorkNature, WORK_NATURE_CONFIG } from '../types'
import type { WorkPlanTopTab } from '../WorkPlansView'

interface QuickAssignFormProps {
    activeTab: WorkPlanTopTab
    plan: WorkPlan | null
    items: WorkPlanItem[]
    newContent: string
    setNewContent: React.Dispatch<React.SetStateAction<string>>
    newCategory: string
    setNewCategory: React.Dispatch<React.SetStateAction<string>>
    newPriority: WorkPlanPriority
    setNewPriority: React.Dispatch<React.SetStateAction<WorkPlanPriority>>
    newWorkNature: WorkPlanWorkNature
    setNewWorkNature: React.Dispatch<React.SetStateAction<WorkPlanWorkNature>>
    newAssignees: WorkPlanAssignee[]
    setNewAssignees: React.Dispatch<React.SetStateAction<WorkPlanAssignee[]>>
    assigneeInput: string
    setAssigneeInput: React.Dispatch<React.SetStateAction<string>>
    availableAssignees: { id?: string; name: string; type: 'member' | 'team' }[]
    addingItem: boolean
    handleAddSingleItem: (e?: React.FormEvent) => Promise<void>
    handleToggleNewAssigneeTaskType: (assigneeName: string) => void
}

export function QuickAssignForm({
    activeTab,
    plan,
    items,
    newContent,
    setNewContent,
    newCategory,
    setNewCategory,
    newPriority,
    setNewPriority,
    newWorkNature,
    setNewWorkNature,
    newAssignees,
    setNewAssignees,
    assigneeInput,
    setAssigneeInput,
    availableAssignees,
    addingItem,
    handleAddSingleItem,
    handleToggleNewAssigneeTaskType,
}: QuickAssignFormProps) {
    return (
        <>
            {activeTab === 'dispatch' && (
                <form
                    onSubmit={handleAddSingleItem}
                    className="p-4 bg-stone-50 border-b border-stone-200 space-y-3"
                >
                    <div className="flex flex-col md:flex-row gap-2.5">
                        <div className="flex items-center gap-2 flex-1">
                            <span className="w-8 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                                #{items.length + 1}
                            </span>
                            <input
                                type="text"
                                value={newContent}
                                onChange={e => setNewContent(e.target.value)}
                                placeholder="Nhập nội dung công việc mới (VD: Hạ hàng, đưa hàng ra đai hàng C hạt chuẩn bị xuất cont)..."
                                className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium text-stone-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                className="rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold text-stone-700 outline-hidden"
                            >
                                {WORK_CATEGORIES.map(c => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={newPriority}
                                onChange={e =>
                                    setNewPriority(e.target.value as WorkPlanPriority)
                                }
                                className="rounded-xl border border-stone-300 bg-white px-2.5 py-2 text-xs font-semibold text-stone-700 outline-hidden"
                            >
                                <option value="normal">Ưu tiên: Thường</option>
                                <option value="important">Ưu tiên: Quan trọng</option>
                                <option value="urgent">Ưu tiên: Khẩn cấp</option>
                            </select>

                            {/* Bản chất công việc: Lao động tay chân vs Thống kê / Ghi chép */}
                            <div
                                className="inline-flex rounded-xl border border-stone-300 bg-white overflow-hidden text-xs font-bold"
                                title="Thống kê / Ghi chép: không có tay chân, chấm độ chính xác & hoàn thành trong ngày; bước Báo cáo không ghi sản lượng & giờ làm"
                            >
                                {(['labor', 'statistics'] as WorkPlanWorkNature[]).map(nature => {
                                    const cfg = WORK_NATURE_CONFIG[nature]
                                    const active = newWorkNature === nature
                                    return (
                                        <button
                                            key={nature}
                                            type="button"
                                            onClick={() => setNewWorkNature(nature)}
                                            className={`px-2.5 py-2 transition-colors ${
                                                active
                                                    ? nature === 'statistics'
                                                        ? 'bg-sky-600 text-white'
                                                        : 'bg-emerald-600 text-white'
                                                    : 'text-stone-600 hover:bg-stone-100'
                                            }`}
                                        >
                                            {cfg.badgeEmoji} {cfg.shortLabel}
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                type="submit"
                                disabled={!newContent.trim() || addingItem}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                            >
                                <Plus size={16} />
                                Thêm việc
                            </button>
                        </div>
                    </div>

                    {/* Quick Assignee Selector for New Item */}
                    <div className="flex flex-wrap items-center gap-2 pl-10">
                        <span className="text-xs font-semibold text-stone-500 flex items-center gap-1">
                            <Users size={13} className="text-indigo-600" />
                            Giao cho:
                        </span>

                        {newAssignees.map(a => {
                            const isSec = a.task_type === 'secondary'
                            return (
                                <span
                                    key={a.name}
                                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                >
                                    <span>{a.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleNewAssigneeTaskType(a.name)}
                                        className={`px-1.5 py-0.2 rounded text-[10px] font-black border transition-colors cursor-pointer ${
                                            isSec
                                                ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                                : 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                                        }`}
                                        title="Bấm để đổi giữa ⭐ Việc chính (chấm điểm ngày, chuẩn 100đ) và ➕ Việc hỗ trợ (tích lũy điểm hỗ trợ theo kỳ, không cộng vào điểm ngày) cho người này"
                                    >
                                        {isSec ? '➕ Việc hỗ trợ' : '⭐ Việc chính'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setNewAssignees(prev =>
                                                prev.filter(x => x.name !== a.name)
                                            )
                                        }
                                        className="hover:text-rose-600"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            )
                        })}

                        <input
                            type="text"
                            list="work-plan-assignees-datalist"
                            value={assigneeInput}
                            onChange={e => setAssigneeInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    const val = assigneeInput.trim()
                                    if (!val) return
                                    const found = availableAssignees.find(
                                        a => a.name.toLowerCase() === val.toLowerCase()
                                    )
                                    if (
                                        !newAssignees.some(
                                            a =>
                                                a.name.toLowerCase() ===
                                                val.toLowerCase()
                                        )
                                    ) {
                                        setNewAssignees(prev => [
                                            ...prev,
                                            {
                                                id: found?.id,
                                                name: found?.name || val,
                                                type: found?.type || 'custom',
                                                task_type: 'primary',
                                            },
                                        ])
                                    }
                                    setAssigneeInput('')
                                }
                            }}
                            placeholder="+ Chọn hoặc gõ tên nhân viên / đội (Enter)..."
                            className="px-2.5 py-1 rounded-lg border border-dashed border-stone-300 bg-white text-xs text-stone-700 w-64 outline-hidden focus:border-indigo-500"
                        />
                        <datalist id="work-plan-assignees-datalist">
                            {availableAssignees.map((a, i) => (
                                <option key={i} value={a.name}>
                                    {a.type === 'team' ? 'Tổ / Đội' : 'Nhân viên'}
                                </option>
                            ))}
                        </datalist>
                    </div>

                    {newWorkNature === 'statistics' && (
                        <div className="flex items-start gap-1.5 pl-10 text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-2.5 py-1.5">
                            <span className="shrink-0">📊</span>
                            <span>
                                Công việc <b>Thống kê / Ghi chép</b>: không có lao động tay chân, chấm theo
                                <b> độ chính xác</b> và <b>hoàn thành trong ngày</b>. Bước Báo cáo & Xếp hạng sẽ
                                <b> không ghi sản lượng và giờ làm</b> cho việc này.
                            </span>
                        </div>
                    )}
                </form>
            )}
        </>
    )
}
