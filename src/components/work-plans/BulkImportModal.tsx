'use client'

import React, { useState, useMemo } from 'react'
import {
    X,
    Sparkles,
    ClipboardPaste,
    Check,
    UserPlus,
    MapPin,
    Tag,
    ListPlus,
    Trash2,
} from 'lucide-react'
import {
    WorkPlanAssignee,
    WorkPlanPriority,
    WORK_CATEGORIES,
    PRIORITY_CONFIG,
    parseRawPlanLine,
} from './types'

interface BulkImportModalProps {
    isOpen: boolean
    onClose: () => void
    planDateFormatted: string
    availableAssignees: { id?: string; name: string; type: 'member' | 'team' }[]
    onConfirmImport: (
        items: {
            content: string
            category: string
            location_note: string
            priority: WorkPlanPriority
            assignees: WorkPlanAssignee[]
        }[]
    ) => Promise<void>
}

const SAMPLE_LINES = `1. Ướp đào tạo, hỗ trợ hướng dẫn Uy và Trôi chạy xe nâng xanh và xe nâng cao
2. Hạ hàng, đưa hàng ra đai hàng C hạt chuẩn bị xuất cont
3. Vệ sinh dàn lạnh, quét tuyết và đập đá kho 1
4. Đưa hàng ra cho sx làm hàng khay
5. Dọn dẹp, quét bụi kho bao bì mới ( bụi, cát rất nhiều )
6. Ghép hàng và đưa vào kho`

export default function BulkImportModal({
    isOpen,
    onClose,
    planDateFormatted,
    availableAssignees,
    onConfirmImport,
}: BulkImportModalProps) {
    const [rawText, setRawText] = useState('')
    const [defaultAssigneeName, setDefaultAssigneeName] = useState('')
    const [overrides, setOverrides] = useState<
        Record<
            number,
            Partial<{
                content: string
                category: string
                location_note: string
                priority: WorkPlanPriority
                assignees: WorkPlanAssignee[]
                excluded: boolean
            }>
        >
    >({})
    const [submitting, setSubmitting] = useState(false)

    const parsedItems = useMemo(() => {
        const lines = rawText
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => {
                if (!l) return false
                // Bỏ qua dòng tiêu đề nếu người dùng copy cả dòng "Kế hoạch làm việc kho ngày..."
                if (/^kế\s*hoạch\s*làm\s*việc/i.test(l)) return false
                return true
            })

        return lines.map((line, index) => {
            const auto = parseRawPlanLine(line, availableAssignees)
            const ov = overrides[index] || {}

            let finalAssignees = ov.assignees ?? auto.assignees
            if (defaultAssigneeName.trim() && finalAssignees.length === 0) {
                const found = availableAssignees.find(
                    a => a.name.toLowerCase() === defaultAssigneeName.trim().toLowerCase()
                )
                finalAssignees = [
                    {
                        id: found?.id,
                        name: found?.name || defaultAssigneeName.trim(),
                        type: found?.type || 'custom',
                    },
                ]
            }

            return {
                index,
                content: ov.content ?? auto.content,
                category: ov.category ?? auto.category,
                location_note: ov.location_note ?? auto.location_note,
                priority: ov.priority ?? auto.priority,
                assignees: finalAssignees,
                excluded: ov.excluded ?? false,
            }
        })
    }, [rawText, availableAssignees, overrides, defaultAssigneeName])

    const activeItems = useMemo(
        () => parsedItems.filter(item => !item.excluded && item.content.trim().length > 0),
        [parsedItems]
    )

    if (!isOpen) return null

    const handleInsertSample = () => {
        setRawText(SAMPLE_LINES)
        setOverrides({})
    }

    const handleAddCustomAssigneeToItem = (idx: number, rawName: string) => {
        const trimmed = rawName.trim()
        if (!trimmed) return
        const item = parsedItems[idx]
        if (!item) return
        if (item.assignees.some(a => a.name.toLowerCase() === trimmed.toLowerCase())) return

        const matched = availableAssignees.find(
            a => a.name.toLowerCase() === trimmed.toLowerCase()
        )
        const nextAssignees: WorkPlanAssignee[] = [
            ...item.assignees,
            {
                id: matched?.id,
                name: matched?.name || trimmed,
                type: matched?.type || 'custom',
            },
        ]
        setOverrides(prev => ({
            ...prev,
            [idx]: { ...(prev[idx] || {}), assignees: nextAssignees },
        }))
    }

    const handleRemoveAssigneeFromItem = (idx: number, nameToRemove: string) => {
        const item = parsedItems[idx]
        if (!item) return
        const nextAssignees = item.assignees.filter(a => a.name !== nameToRemove)
        setOverrides(prev => ({
            ...prev,
            [idx]: { ...(prev[idx] || {}), assignees: nextAssignees },
        }))
    }

    const handleSubmit = async () => {
        if (activeItems.length === 0) return
        setSubmitting(true)
        try {
            await onConfirmImport(
                activeItems.map(i => ({
                    content: i.content.trim(),
                    category: i.category,
                    location_note: i.location_note.trim(),
                    priority: i.priority,
                    assignees: i.assignees,
                }))
            )
            setRawText('')
            setOverrides({})
            onClose()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 md:p-6">
            <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs">
                            <ClipboardPaste size={22} />
                        </div>
                        <div>
                            <h3 className="text-base md:text-lg font-bold">
                                Nhập Nhanh Kế Hoạch Nhiều Dòng (Zalo / Excel)
                            </h3>
                            <p className="text-xs text-blue-100">
                                Dán danh sách đầu việc ngày {planDateFormatted} — Tự động tách mục 1, 2, 3, nhận diện khu vực & nhân viên
                            </p>
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
                    {/* Input Area */}
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-stone-600 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-indigo-600" />
                                1. Dán nội dung kế hoạch (mỗi dòng 1 công việc)
                            </label>
                            <button
                                type="button"
                                onClick={handleInsertSample}
                                className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-all flex items-center gap-1.5"
                            >
                                <Sparkles size={13} />
                                Chèn mẫu 6 đầu việc kho thực tế
                            </button>
                        </div>
                        <textarea
                            value={rawText}
                            onChange={e => {
                                setRawText(e.target.value)
                                setOverrides({})
                            }}
                            rows={6}
                            placeholder={`Ví dụ:\n1. Ướp đào tạo, hỗ trợ hướng dẫn Uy và Trôi chạy xe nâng xanh và xe nâng cao\n2. Hạ hàng, đưa hàng ra đai hàng C hạt chuẩn bị xuất cont\n3. Vệ sinh dàn lạnh, quét tuyết và đập đá kho 1\n4. Đưa hàng ra cho sx làm hàng khay...`}
                            className="w-full rounded-xl border border-stone-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 p-3.5 text-sm text-stone-800 font-medium leading-relaxed outline-hidden transition-all"
                        />
                    </div>

                    {/* Quick Default Assignee */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                        <div className="flex items-center gap-2 text-xs text-stone-600">
                            <UserPlus size={16} className="text-indigo-600 shrink-0" />
                            <span>
                                <strong>Gán mặc định</strong> cho các dòng chưa ghi tên người phụ trách:
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                list="bulk-default-assignees"
                                value={defaultAssigneeName}
                                onChange={e => setDefaultAssigneeName(e.target.value)}
                                placeholder="Chọn Đội/Nhân viên (tùy chọn)..."
                                className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-stone-800 w-60 outline-hidden focus:border-indigo-500"
                            />
                            <datalist id="bulk-default-assignees">
                                {availableAssignees.map((a, i) => (
                                    <option key={i} value={a.name}>
                                        {a.type === 'team' ? 'Đội / Tổ' : 'Nhân viên'}
                                    </option>
                                ))}
                            </datalist>
                        </div>
                    </div>

                    {/* Preview Table */}
                    {parsedItems.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                                    2. Xem trước & Tinh chỉnh ({activeItems.length} đầu việc sẽ được tạo)
                                </span>
                            </div>

                            <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 bg-white">
                                {parsedItems.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3.5 transition-colors ${
                                            item.excluded ? 'bg-stone-50 opacity-50' : 'hover:bg-indigo-50/20'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* STT */}
                                            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                                {idx + 1}
                                            </div>

                                            <div className="flex-1 min-w-0 space-y-2">
                                                <input
                                                    type="text"
                                                    value={item.content}
                                                    onChange={e =>
                                                        setOverrides(prev => ({
                                                            ...prev,
                                                            [idx]: {
                                                                ...(prev[idx] || {}),
                                                                content: e.target.value,
                                                            },
                                                        }))
                                                    }
                                                    className="w-full text-sm font-semibold text-stone-800 bg-transparent border-b border-transparent focus:border-indigo-400 outline-hidden pb-0.5"
                                                />

                                                <div className="flex flex-wrap items-center gap-2">
                                                    {/* Category */}
                                                    <div className="flex items-center gap-1 bg-stone-100 px-2 py-1 rounded-lg border border-stone-200">
                                                        <Tag size={12} className="text-stone-500" />
                                                        <select
                                                            value={item.category}
                                                            onChange={e =>
                                                                setOverrides(prev => ({
                                                                    ...prev,
                                                                    [idx]: {
                                                                        ...(prev[idx] || {}),
                                                                        category: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            className="text-xs font-medium text-stone-700 bg-transparent outline-hidden"
                                                        >
                                                            {WORK_CATEGORIES.map(c => (
                                                                <option key={c} value={c}>
                                                                    {c}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Priority */}
                                                    <select
                                                        value={item.priority}
                                                        onChange={e =>
                                                            setOverrides(prev => ({
                                                                ...prev,
                                                                [idx]: {
                                                                    ...(prev[idx] || {}),
                                                                    priority: e.target
                                                                        .value as WorkPlanPriority,
                                                                },
                                                            }))
                                                        }
                                                        className={`text-xs font-semibold px-2 py-1 rounded-lg border outline-hidden ${PRIORITY_CONFIG[item.priority].bgClass} ${PRIORITY_CONFIG[item.priority].textClass} ${PRIORITY_CONFIG[item.priority].borderClass}`}
                                                    >
                                                        <option value="normal">Bình thường</option>
                                                        <option value="important">Quan trọng</option>
                                                        <option value="urgent">Khẩn cấp</option>
                                                    </select>

                                                    {/* Location */}
                                                    <div className="flex items-center gap-1 bg-stone-50 px-2 py-1 rounded-lg border border-stone-200">
                                                        <MapPin size={12} className="text-stone-400" />
                                                        <input
                                                            type="text"
                                                            value={item.location_note}
                                                            onChange={e =>
                                                                setOverrides(prev => ({
                                                                    ...prev,
                                                                    [idx]: {
                                                                        ...(prev[idx] || {}),
                                                                        location_note: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            placeholder="Khu vực (VD: Kho 1)"
                                                            className="text-xs text-stone-700 bg-transparent outline-hidden w-28"
                                                        />
                                                    </div>

                                                    {/* Assignees Tags */}
                                                    {item.assignees.map(a => (
                                                        <span
                                                            key={a.name}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                                        >
                                                            {a.name}
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleRemoveAssigneeFromItem(
                                                                        idx,
                                                                        a.name
                                                                    )
                                                                }
                                                                className="hover:text-rose-600"
                                                            >
                                                                <X size={11} />
                                                            </button>
                                                        </span>
                                                    ))}

                                                    {/* Quick add assignee input */}
                                                    <input
                                                        type="text"
                                                        list="bulk-default-assignees"
                                                        placeholder="+ Giao người/đội (Enter)"
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault()
                                                                handleAddCustomAssigneeToItem(
                                                                    idx,
                                                                    (e.target as HTMLInputElement).value
                                                                )
                                                                ;(e.target as HTMLInputElement).value = ''
                                                            }
                                                        }}
                                                        onBlur={e => {
                                                            if (e.target.value.trim()) {
                                                                handleAddCustomAssigneeToItem(
                                                                    idx,
                                                                    e.target.value
                                                                )
                                                                e.target.value = ''
                                                            }
                                                        }}
                                                        className="text-xs px-2 py-0.5 rounded-lg border border-dashed border-stone-300 focus:border-indigo-500 outline-hidden w-36 text-stone-700"
                                                    />
                                                </div>
                                            </div>

                                            {/* Exclude Toggle */}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setOverrides(prev => ({
                                                        ...prev,
                                                        [idx]: {
                                                            ...(prev[idx] || {}),
                                                            excluded: !item.excluded,
                                                        },
                                                    }))
                                                }
                                                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                title={item.excluded ? 'Khôi phục dòng này' : 'Bỏ qua dòng này'}
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
                    <span className="text-xs text-stone-500">
                        Mẹo: Gõ tên nhân viên (VD: <b>Uy</b>, <b>Trôi</b>) rồi nhấn <b>Enter</b> để gắn người phụ trách
                    </span>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            disabled={activeItems.length === 0 || submitting}
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                        >
                            <ListPlus size={16} />
                            {submitting
                                ? 'Đang thêm...'
                                : `Thêm ${activeItems.length} công việc vào Kế hoạch`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

