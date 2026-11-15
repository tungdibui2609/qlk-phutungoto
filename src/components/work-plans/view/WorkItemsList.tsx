'use client'

import React from 'react'
import { ChevronRight, ClipboardPaste, Trash2, ArrowUp, ArrowDown, ClipboardCheck, MessageSquare, Check, X, UserPlus, Edit3, Award, Scale, BookmarkPlus, FileText } from 'lucide-react'
import { WorkPlan, WorkPlanItem, ITEM_STATUS_CONFIG, RATING_CONFIG, PRIORITY_CONFIG, DIFFICULTY_CONFIG, WorkPlanWorkNature, WORK_NATURE_CONFIG, getWarehouseBadge, formatVNDate, hasWorkloadData, getStatisticsDocumentCounts, getEvaluationHours } from '../types'
import type { WorkPlanTopTab } from '../WorkPlansView'

interface WorkItemsListProps {
    activeTab: WorkPlanTopTab
    loading: boolean
    plan: WorkPlan | null
    items: WorkPlanItem[]
    selectedDate: string
    templatesMap: Map<string, string>
    editingItemId: string | null
    setEditingItemId: React.Dispatch<React.SetStateAction<string | null>>
    editingContent: string
    setEditingContent: React.Dispatch<React.SetStateAction<string>>
    editingDescription: string
    setEditingDescription: React.Dispatch<React.SetStateAction<string>>
    editingLocation: string
    setEditingLocation: React.Dispatch<React.SetStateAction<string>>
    addingAssigneeForItemId: string | null
    setAddingAssigneeForItemId: React.Dispatch<React.SetStateAction<string | null>>
    inlineAssigneeText: string
    setInlineAssigneeText: React.Dispatch<React.SetStateAction<string>>
    startEditingItem: (item: WorkPlanItem) => void
    handleSaveInlineEdit: (item: WorkPlanItem) => Promise<void>
    handleMoveItem: (idx: number, direction: -1 | 1) => Promise<void>
    handleDeleteItem: (item: WorkPlanItem) => Promise<void>
    handleToggleWorkNature: (item: WorkPlanItem) => Promise<void>
    handleSaveItemAsTemplate: (item: WorkPlanItem) => void
    handleAddAssigneeToRow: (item: WorkPlanItem, rawName: string) => Promise<void>
    handleRemoveAssigneeFromRow: (item: WorkPlanItem, name: string) => Promise<void>
    handleToggleAssigneeTaskType: (item: WorkPlanItem, assigneeName: string) => Promise<void>
    setShowBulkModal: React.Dispatch<React.SetStateAction<boolean>>
    setItemForWorkloadModal: React.Dispatch<React.SetStateAction<WorkPlanItem | null>>
    setItemToEvaluate: React.Dispatch<React.SetStateAction<WorkPlanItem | null>>
    setLightboxImages: React.Dispatch<React.SetStateAction<string[]>>
    setLightboxIndex: React.Dispatch<React.SetStateAction<number>>
    setShowLightbox: React.Dispatch<React.SetStateAction<boolean>>
}

export function WorkItemsList({
    activeTab,
    loading,
    plan,
    items,
    selectedDate,
    templatesMap,
    editingItemId,
    setEditingItemId,
    editingContent,
    setEditingContent,
    editingDescription,
    setEditingDescription,
    editingLocation,
    setEditingLocation,
    addingAssigneeForItemId,
    setAddingAssigneeForItemId,
    inlineAssigneeText,
    setInlineAssigneeText,
    startEditingItem,
    handleSaveInlineEdit,
    handleMoveItem,
    handleDeleteItem,
    handleToggleWorkNature,
    handleSaveItemAsTemplate,
    handleAddAssigneeToRow,
    handleRemoveAssigneeFromRow,
    handleToggleAssigneeTaskType,
    setShowBulkModal,
    setItemForWorkloadModal,
    setItemToEvaluate,
    setLightboxImages,
    setLightboxIndex,
    setShowLightbox,
}: WorkItemsListProps) {
    return (
        <>
            {loading ? (
                <div className="p-12 text-center text-sm text-stone-500">
                    Đang tải bảng kế hoạch ngày {formatVNDate(selectedDate)}...
                </div>
            ) : items.length === 0 ? (
                <div className="p-10 sm:p-14 text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                        <ClipboardCheck size={32} />
                    </div>
                    <div className="max-w-md mx-auto space-y-1">
                        <h3 className="text-base font-bold text-stone-800">
                            Chưa có công việc nào trong ngày {formatVNDate(selectedDate)}
                        </h3>
                        <p className="text-xs text-stone-500 leading-relaxed">
                            Bạn có thể thêm từng việc ở thanh phía trên, hoặc bấm nút{' '}
                            <b>&ldquo;Nhập nhanh nhiều dòng (Zalo/Excel)&rdquo;</b> để dán
                            toàn bộ kế hoạch 1, 2, 3... chỉ trong vài giây.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setShowBulkModal(true)}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                        >
                            <ClipboardPaste size={15} />
                            Nhập nhanh danh sách 1, 2, 3...
                        </button>
                    </div>
                </div>
            ) : (
                <div className="divide-y divide-stone-200">
                    {items.map((item, idx) => {
                        const st = ITEM_STATUS_CONFIG[item.status]
                        const rt = item.rating ? RATING_CONFIG[item.rating] : null
                        const pri = PRIORITY_CONFIG[item.priority]
                        const isEditing = editingItemId === item.id

                        return (
                            <div
                                key={item.id}
                                className={`p-3.5 sm:px-5 sm:py-4 transition-colors ${
                                    activeTab === 'evaluate'
                                        ? item.status === 'completed'
                                            ? 'bg-emerald-50/25 hover:bg-emerald-50/40'
                                            : item.status === 'uncompleted'
                                            ? 'bg-rose-50/25 hover:bg-rose-50/40'
                                            : 'hover:bg-stone-50/80'
                                        : 'hover:bg-stone-50/80'
                                }`}
                            >
                                <div className="flex flex-col lg:flex-row items-stretch gap-4 w-full">
                                    {/* NỬA BÊN TRÁI: STT + Tên việc + Mô tả + Người giao + (Dưới cùng: Đánh giá & Icon thao tác) */}
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        {/* STT Badge + Reorder Arrows */}
                                        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                                            <div
                                                className={`w-8 h-8 rounded-xl font-black text-sm flex items-center justify-center border ${
                                                    activeTab === 'evaluate' && item.status === 'completed'
                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                        : 'bg-stone-900 text-white border-stone-900'
                                                }`}
                                            >
                                                {idx + 1}.
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                                <button
                                                    type="button"
                                                    disabled={idx === 0}
                                                    onClick={() => handleMoveItem(idx, -1)}
                                                    className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-25"
                                                    title="Chuyển lên"
                                                >
                                                    <ArrowUp size={12} />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={idx === items.length - 1}
                                                    onClick={() => handleMoveItem(idx, 1)}
                                                    className="p-0.5 text-stone-400 hover:text-stone-700 disabled:opacity-25"
                                                    title="Chuyển xuống"
                                                >
                                                    <ArrowDown size={12} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content & Details */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5">
                                            <div className="space-y-2">
                                                {isEditing ? (
                                                    <div className="space-y-2">
                                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={editingContent}
                                                                onChange={e =>
                                                                    setEditingContent(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="Tên công việc..."
                                                                className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-400 text-sm font-semibold text-stone-900 outline-hidden"
                                                                autoFocus
                                                            />
                                                            <input
                                                                type="text"
                                                                value={editingLocation}
                                                                onChange={e =>
                                                                    setEditingLocation(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="Khu vực..."
                                                                className="w-36 px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs text-stone-700 outline-hidden"
                                                            />
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleSaveInlineEdit(
                                                                            item
                                                                        )
                                                                    }
                                                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                                                                >
                                                                    Lưu
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setEditingItemId(null)
                                                                    }
                                                                    className="px-2.5 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold cursor-pointer transition-colors"
                                                                >
                                                                    Hủy
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <textarea
                                                                rows={2}
                                                                value={editingDescription}
                                                                onChange={e =>
                                                                    setEditingDescription(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="Mô tả công việc thực tế hôm nay (nhập, sửa hoặc xóa lại theo ý bạn)..."
                                                                className="w-full px-3 py-1.5 rounded-lg border border-indigo-300 focus:border-indigo-500 text-xs text-stone-800 outline-hidden bg-white"
                                                            />
                                                            <div className="text-[10px] text-stone-400 italic flex items-center justify-between">
                                                                <span>💡 Sửa mô tả tại đây chỉ áp dụng cho ca hôm nay, không làm thay đổi mẫu gốc trong thư viện.</span>
                                                                {editingDescription && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingDescription('')}
                                                                        className="text-rose-500 hover:text-rose-700 font-medium hover:underline cursor-pointer"
                                                                    >
                                                                        Xóa mô tả
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center flex-wrap gap-2">
                                                                <span
                                                                    onDoubleClick={() => startEditingItem(item)}
                                                                    className={`text-sm sm:text-base font-bold leading-snug cursor-pointer ${
                                                                        item.status === 'cancelled'
                                                                            ? 'line-through text-stone-400'
                                                                            : 'text-stone-900 hover:text-indigo-900'
                                                                    }`}
                                                                    title="Nhấp đúp để sửa nhanh nội dung & mô tả"
                                                                >
                                                                    {item.content}
                                                                </span>

                                                                {/* Chip Phân Hệ Kho hiển thị ngay liền sau tiêu đề công việc */}
                                                                {item.location_note && (() => {
                                                                    const sysBadge = getWarehouseBadge(item.location_note)
                                                                    return (
                                                                        <span
                                                                            className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold inline-flex items-center gap-1 shadow-2xs ${sysBadge.badgeClass}`}
                                                                            title={`Phân hệ kho: ${item.location_note}`}
                                                                        >
                                                                            <span>{sysBadge.icon}</span>
                                                                            <span>{sysBadge.label}</span>
                                                                        </span>
                                                                    )
                                                                })()}

                                                                {/* Danh mục công việc (Vận hành kho, Bảo trì, v.v.) hiển thị ngay trên hàng tên công việc */}
                                                                {item.category && (
                                                                    <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200 text-[11px] font-semibold">
                                                                        {item.category}
                                                                    </span>
                                                                )}

                                                                {/* Bản chất công việc: bấm để đổi Lao động tay chân <-> Thống kê / Ghi chép */}
                                                                {(() => {
                                                                    const nature: WorkPlanWorkNature = item.work_nature || 'labor'
                                                                    const cfg = WORK_NATURE_CONFIG[nature]
                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleToggleWorkNature(item)}
                                                                            className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold inline-flex items-center gap-1 transition-colors cursor-pointer ${cfg.badgeClass} ${
                                                                                nature === 'statistics' ? 'ring-1 ring-sky-300' : 'opacity-80 hover:opacity-100'
                                                                            }`}
                                                                            title={`${cfg.description} — Bấm để đổi`}
                                                                        >
                                                                            <span>{cfg.badgeEmoji}</span>
                                                                            <span>{cfg.shortLabel}</span>
                                                                            {nature === 'statistics' && (
                                                                                <span className="text-[9px] font-bold opacity-75">(không sản lượng/giờ)</span>
                                                                            )}
                                                                        </button>
                                                                    )
                                                                })()}
                                                            </div>
                                                        </div>

                                                        {/* Mô tả công việc từ mẫu hoặc do người dùng tạo (Cho phép click để sửa nhanh cho ngày hôm nay) */}
                                                        {(() => {
                                                            const desc =
                                                                item.description !== null && item.description !== undefined
                                                                    ? item.description
                                                                    : templatesMap.get(item.content.trim().toLowerCase()) || ''

                                                            if (desc) {
                                                                return (
                                                                    <div
                                                                        onClick={() => startEditingItem(item)}
                                                                        className="group/desc inline-flex items-center gap-1.5 cursor-pointer rounded-md -mx-1 px-1 py-0.5 hover:bg-indigo-50/80 border border-transparent hover:border-indigo-200 transition-all text-xs text-stone-600 leading-relaxed"
                                                                        title="Nhấp để sửa hoặc xóa mô tả cho ca hôm nay (không ảnh hưởng mẫu gốc)"
                                                                    >
                                                                        <p className="line-clamp-2 group-hover/desc:text-indigo-950">
                                                                            {desc}
                                                                        </p>
                                                                        <span className="opacity-0 group-hover/desc:opacity-100 text-[10px] text-indigo-600 font-bold flex items-center gap-0.5 shrink-0 transition-opacity">
                                                                            <Edit3 size={11} /> Sửa mô tả
                                                                        </span>
                                                                    </div>
                                                                )
                                                            }

                                                            return (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => startEditingItem(item)}
                                                                    className="text-[11px] text-stone-400 hover:text-indigo-600 font-medium flex items-center gap-1 hover:underline cursor-pointer pl-0.5 pt-0.5"
                                                                    title="Nhấp để thêm mô tả hướng dẫn riêng cho ca hôm nay"
                                                                >
                                                                    <span className="text-xs">➕</span> Thêm mô tả cho ca hôm nay...
                                                                </button>
                                                            )
                                                        })()}
                                                    </>
                                                )}

                                                {/* Badges Row: Priority, Assignees (Người giao) */}
                                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                    {item.priority !== 'normal' && (
                                                        <span
                                                            className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${pri.bgClass} ${pri.textClass} ${pri.borderClass}`}
                                                        >
                                                            {pri.label}
                                                        </span>
                                                    )}

                                                    {/* Assignee Chips with Individual Task Type (Chính vs Phụ) */}
                                                    {Array.isArray(item.assignees) &&
                                                        item.assignees.map(a => {
                                                            const isSec = a.task_type === 'secondary'
                                                            return (
                                                              <span
                                                                key={a.name}
                                                                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold shadow-2xs"
                                                              >
                                                                <span>👤 {a.name}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleAssigneeTaskType(item, a.name)}
                                                                    className={`px-1.5 py-0.2 rounded text-[10px] font-black border transition-all cursor-pointer ${
                                                                        isSec
                                                                            ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200'
                                                                            : 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                                                    }`}
                                                                    title="Bấm để chuyển đổi giữa ⭐ Việc chính (chấm điểm ngày, 100đ chuẩn) và ➕ Việc hỗ trợ (tích lũy điểm hỗ trợ theo kỳ) cho nhân sự này"
                                                                >
                                                                    {isSec ? '➕ Việc hỗ trợ' : '⭐ Việc chính'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleRemoveAssigneeFromRow(
                                                                            item,
                                                                            a.name
                                                                        )
                                                                    }
                                                                    className="hover:text-rose-600 ml-0.5 cursor-pointer"
                                                                    title="Gỡ người này"
                                                                >
                                                                    <X size={11} />
                                                                </button>
                                                              </span>
                                                            )
                                                        })}

                                                    {/* Inline Add Assignee Button/Input */}
                                                    {addingAssigneeForItemId === item.id ? (
                                                        <div className="inline-flex items-center gap-1">
                                                            <input
                                                                type="text"
                                                                list="work-plan-assignees-datalist"
                                                                value={inlineAssigneeText}
                                                                onChange={e =>
                                                                    setInlineAssigneeText(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault()
                                                                        handleAddAssigneeToRow(
                                                                            item,
                                                                            inlineAssigneeText
                                                                        )
                                                                    } else if (
                                                                        e.key === 'Escape'
                                                                    ) {
                                                                        setAddingAssigneeForItemId(
                                                                            null
                                                                        )
                                                                    }
                                                                }}
                                                                placeholder="Tên NV/Đội (Enter)"
                                                                className="px-2 py-0.5 rounded-lg border border-indigo-400 text-xs w-36 outline-hidden"
                                                                autoFocus
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    handleAddAssigneeToRow(
                                                                        item,
                                                                        inlineAssigneeText
                                                                    )
                                                                }
                                                                className="p-1 rounded-md bg-indigo-600 text-white"
                                                            >
                                                                <Check size={11} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setAddingAssigneeForItemId(
                                                                    item.id
                                                                )
                                                                setInlineAssigneeText('')
                                                            }}
                                                            className="px-2 py-0.5 rounded-full border border-dashed border-stone-300 hover:border-indigo-400 text-[11px] font-semibold text-stone-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                                                        >
                                                            <UserPlus size={11} />
                                                            Giao người
                                                        </button>
                                                    )}

                                                    {item.carried_to_date && (
                                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold">
                                                            ↪ Đã chuyển sang{' '}
                                                            {formatVNDate(item.carried_to_date)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Evaluation Note & Proof Images */}
                                                {(item.evaluation_note ||
                                                    (Array.isArray(item.completion_images) &&
                                                        item.completion_images.length > 0)) && (
                                                    <div className="mt-2 p-2.5 rounded-xl bg-white border border-stone-200/90 space-y-2">
                                                        {item.evaluation_note && (
                                                            <div className="text-xs text-stone-700 flex items-start gap-1.5">
                                                                <MessageSquare
                                                                    size={13}
                                                                    className="text-emerald-600 shrink-0 mt-0.5"
                                                                />
                                                                <span>
                                                                    <b className="text-stone-900">
                                                                        Đánh giá cuối ngày:{' '}
                                                                    </b>
                                                                    {item.evaluation_note}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {Array.isArray(item.completion_images) &&
                                                            item.completion_images.length > 0 && (
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    {item.completion_images.map(
                                                                        (imgUrl, imgIdx) => (
                                                                            <button
                                                                                key={imgIdx}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setLightboxImages(
                                                                                        item.completion_images
                                                                                    )
                                                                                    setLightboxIndex(imgIdx)
                                                                                    setShowLightbox(true)
                                                                                }}
                                                                                className="w-12 h-12 rounded-lg overflow-hidden border border-stone-200 hover:ring-2 hover:ring-emerald-500 transition-all"
                                                                            >
                                                                                <img
                                                                                    src={imgUrl}
                                                                                    alt="Minh chứng"
                                                                                    className="w-full h-full object-cover"
                                                                                />
                                                                            </button>
                                                                        )
                                                                    )}
                                                                </div>
                                                            )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* DÒNG Ở DƯỚI PHẦN NGƯỜI GIAO: ĐÁNH GIÁ (Ở BƯỚC 3) & CÁC ICON THAO TÁC (Ở BƯỚC 2) */}
                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                                                <div>
                                                    {activeTab === 'evaluate' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setItemToEvaluate(item)}
                                                            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                                                            title="Đánh giá chi tiết, tiến độ %, chấm sao chất lượng, chia khối lượng & ghi nhận lỗi vi phạm xét KPI"
                                                        >
                                                            <Award size={14} className="text-emerald-600" />
                                                            <span>🏅 Đánh giá</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Các icon thao tác: Bookmark, Sửa, Xóa (Chỉ hiện ở Bước 2: Giao việc & Kế hoạch) */}
                                                {activeTab === 'dispatch' && (
                                                    <div className="flex items-center gap-1 text-stone-400 ml-auto">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSaveItemAsTemplate(item)}
                                                            className="p-1.5 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                            title="Lưu việc này vào Thư viện công việc mẫu để tái sử dụng"
                                                        >
                                                            <BookmarkPlus size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => startEditingItem(item)}
                                                            className="p-1.5 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                                            title="Sửa nội dung & mô tả hôm nay"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteItem(item)}
                                                            className="p-1.5 rounded-lg hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                            title="Xóa đầu việc"
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* NỬA BÊN PHẢI: KHỐI HIỂN THỊ SỐ LIỆU ĐẦY ĐỦ NHẤT (Ngang hàng với tên công việc) */}
                                    <div className="w-full lg:w-[320px] xl:w-[370px] shrink-0 self-stretch flex flex-col justify-center">
                                        {(() => {
                                            const wl = item.workload_metrics
                                            const hasData = hasWorkloadData(wl)

                                            // Đã nghiệm thu (chấm sao / chuyển trạng thái) nhưng chưa lưu giờ từng người
                                            // -> tạm tính ca chuẩn 8h/người, đúng mặc định của bộ đánh giá
                                            const isEvaluated = Boolean(
                                                item.evaluated_at ||
                                                item.rating_stars ||
                                                (item.status !== 'pending' && item.status !== 'cancelled')
                                            )
                                            const hoursOptions = {
                                                assigneeCount: Array.isArray(item.assignees)
                                                    ? item.assignees.length
                                                    : 0,
                                                assumeStandardShift: isEvaluated,
                                            }

                                            // Công việc Thống kê / Ghi chép: hiển thị số phiếu đã tạo, không dùng sản lượng/giờ
                                            if (item.work_nature === 'statistics') {
                                                const statsCounts = getStatisticsDocumentCounts(wl)
                                                const docs = statsCounts.documents
                                                const rows = statsCounts.rows
                                                const evalHours = getEvaluationHours(wl, hoursOptions)
                                                return (
                                                    <div
                                                        onClick={() => setItemForWorkloadModal(item)}
                                                        className="group/stats cursor-pointer rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50/80 via-white to-sky-50/40 p-3 hover:border-sky-400 hover:shadow-xs transition-all flex flex-col justify-between h-full space-y-2"
                                                        title="Bấm để nhập số phiếu / chứng từ và số dòng dữ liệu cho công việc thống kê"
                                                    >
                                                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-sky-100">
                                                            <span className="font-black text-sky-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                                                                <FileText size={13} className="text-sky-700" />
                                                                <span>Dữ liệu thống kê / ghi chép</span>
                                                            </span>
                                                            <span className="text-[11px] font-bold text-sky-700 group-hover/stats:underline flex items-center gap-0.5">
                                                                Sửa <ChevronRight size={12} />
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-1.5 text-xs">
                                                            <div className="bg-white/95 p-1.5 rounded-xl border border-sky-100 shadow-2xs flex flex-col text-center">
                                                                <span className="text-[10px] font-semibold text-stone-500">📄 Phiếu</span>
                                                                <span className="text-sm font-black text-sky-900 mt-0.5 truncate">
                                                                    {docs > 0 ? docs.toLocaleString('vi-VN') : '-'}
                                                                </span>
                                                            </div>
                                                            <div className="bg-white/95 p-1.5 rounded-xl border border-sky-100 shadow-2xs flex flex-col text-center">
                                                                <span className="text-[10px] font-semibold text-stone-500">📋 Dòng dữ liệu</span>
                                                                <span className="text-sm font-black text-sky-900 mt-0.5 truncate">
                                                                    {rows > 0 ? rows.toLocaleString('vi-VN') : '-'}
                                                                </span>
                                                            </div>
                                                            <div
                                                                className="bg-white/95 p-1.5 rounded-xl border border-sky-100 shadow-2xs flex flex-col text-center"
                                                                title={
                                                                    evalHours.isDefault
                                                                        ? 'Chưa nhập giờ đánh giá — tạm tính ca chuẩn 8h/người'
                                                                        : undefined
                                                                }
                                                            >
                                                                <span className="text-[10px] font-semibold text-stone-500">⏱️ Giờ làm</span>
                                                                <span className="text-sm font-black text-sky-900 mt-0.5 truncate">
                                                                    {evalHours.hasData && evalHours.total > 0
                                                                        ? `${evalHours.total.toLocaleString('vi-VN')}h`
                                                                        : '-'}
                                                                </span>
                                                                {evalHours.overtime > 0 && (
                                                                    <span className="text-[9px] font-bold text-amber-700">
                                                                        +{evalHours.overtime.toLocaleString('vi-VN')}h OT
                                                                    </span>
                                                                )}
                                                                {evalHours.isDefault && (
                                                                    <span className="text-[9px] font-semibold text-stone-400">
                                                                        ca chuẩn
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="bg-white/95 p-1.5 rounded-xl border border-sky-100 shadow-2xs flex flex-col text-center">
                                                                <span className="text-[10px] font-semibold text-stone-500">⭐ Chất lượng</span>
                                                                <span className="text-sm font-black text-amber-800 mt-0.5 truncate">
                                                                    {item.rating_stars ? `${item.rating_stars}/5` : '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] text-sky-800 bg-white/80 px-2 py-1 rounded-lg border border-sky-100/80">
                                                            Không ghi sản lượng ở báo cáo — chấm độ chính xác &amp; hoàn thành trong ngày. Giờ làm lấy từ phần Đánh giá sau nghiệm thu.
                                                        </div>
                                                    </div>
                                                )
                                            }

                                            if (!hasData || !wl) {
                                                return (
                                                    <button
                                                        type="button"
                                                        onClick={() => setItemForWorkloadModal(item)}
                                                        className="w-full h-full min-h-[92px] rounded-2xl border-2 border-dashed border-stone-300 hover:border-indigo-400 bg-stone-50/70 hover:bg-indigo-50/40 p-3 flex flex-col items-center justify-center gap-1.5 text-stone-500 hover:text-indigo-800 transition-all cursor-pointer group/add"
                                                        title="Bấm để gắn số liệu khối lượng: bao nhiêu tấn, bao nhiêu pallet/vị trí, bao nhiêu thùng, cont hoặc Lệnh xuất kho..."
                                                    >
                                                        <div className="w-8 h-8 rounded-full bg-white shadow-2xs border border-stone-200 group-hover/add:border-indigo-300 flex items-center justify-center text-stone-400 group-hover/add:text-indigo-600">
                                                            <Scale size={16} />
                                                        </div>
                                                        <span className="text-xs font-bold text-stone-700 group-hover/add:text-indigo-950">
                                                            + Gắn số liệu khối lượng thực tế
                                                        </span>
                                                        <span className="text-[10px] text-stone-400">
                                                            (Số tấn, số pallet/vị trí, thùng, cont...)
                                                        </span>
                                                    </button>
                                                )
                                            }

                                            const diffCfg =
                                                wl.difficulty && DIFFICULTY_CONFIG[wl.difficulty]
                                                    ? DIFFICULTY_CONFIG[wl.difficulty]
                                                    : null

                                            // Giờ làm: lấy từ đánh giá sau nghiệm thu; trước đó dùng số giờ nhập tay nếu có
                                            const evalHours = getEvaluationHours(wl, hoursOptions)
                                            const displayHours = evalHours.hasData
                                                ? evalHours.total
                                                : Number(wl.hours_spent) || 0
                                            const displayOvertime = evalHours.hasData
                                                ? evalHours.overtime
                                                : 0

                                            return (
                                                <div
                                                    onClick={() => setItemForWorkloadModal(item)}
                                                    className="group/wl cursor-pointer rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 p-3 hover:border-indigo-400 hover:shadow-xs transition-all flex flex-col justify-between h-full space-y-2"
                                                    title="Bấm để xem chứng từ liên kết hoặc chỉnh sửa số liệu khối lượng"
                                                >
                                                    {/* Header số liệu */}
                                                    <div className="flex items-center justify-between text-xs pb-1.5 border-b border-indigo-100/90">
                                                        <span className="font-black text-indigo-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                                                            <Scale size={13} className="text-indigo-600" />
                                                            <span>Số liệu khối lượng thực tế</span>
                                                        </span>
                                                        <span className="text-[11px] font-bold text-indigo-600 group-hover/wl:underline flex items-center gap-0.5">
                                                            Sửa <ChevronRight size={12} />
                                                        </span>
                                                    </div>

                                                    {/* Lưới các chỉ số khối lượng: Vị trí PL, Tấn/Kg, Thùng, Cont */}
                                                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                                                        {/* 1. Vị trí / Pallet */}
                                                        <div className="bg-white/95 p-1.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col text-center">
                                                            <span className="text-[10px] font-semibold text-stone-500">📍 Vị trí / PL</span>
                                                            <span className="text-xs font-black text-indigo-950 mt-0.5 truncate">
                                                                {wl.positions_count ? `${wl.positions_count} PL` : '-'}
                                                            </span>
                                                        </div>

                                                        {/* 2. Trọng lượng Tấn / Kg */}
                                                        <div className="bg-white/95 p-1.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col text-center">
                                                            <span className="text-[10px] font-semibold text-stone-500">⚖️ Khối lượng</span>
                                                            <span className="text-xs font-black text-emerald-800 mt-0.5 truncate">
                                                                {wl.weight_kg
                                                                    ? (wl.weight_kg >= 1000
                                                                        ? `${(wl.weight_kg / 1000).toFixed(1)} tấn`
                                                                        : `${wl.weight_kg.toLocaleString('vi-VN')} kg`)
                                                                    : '-'}
                                                            </span>
                                                        </div>

                                                        {/* 3. Số thùng / kiện */}
                                                        <div className="bg-white/95 p-1.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col text-center">
                                                            <span className="text-[10px] font-semibold text-stone-500">📦 Đóng gói</span>
                                                            <span className="text-xs font-black text-amber-900 mt-0.5 truncate">
                                                                {wl.packages_count
                                                                    ? `${wl.packages_count.toLocaleString('vi-VN')} ${wl.package_unit || 'Thùng'}`
                                                                    : '-'}
                                                            </span>
                                                        </div>

                                                        {/* 4. Số Cont */}
                                                        {Boolean(wl.containers_count) && (
                                                            <div className="bg-white/95 p-1.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col text-center">
                                                                <span className="text-[10px] font-semibold text-stone-500">🚢 Số Cont</span>
                                                                <span className="text-xs font-black text-blue-800 mt-0.5 truncate">
                                                                    {wl.containers_count} Cont
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* 5. Hệ số độ nặng */}
                                                        {diffCfg && (
                                                            <div className="bg-white/95 p-1.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col text-center">
                                                                <span className="text-[10px] font-semibold text-stone-500">⚡ Độ nặng</span>
                                                                <span className="text-xs font-black text-stone-800 mt-0.5 truncate">
                                                                    {diffCfg.badgeEmoji} {diffCfg.label} (x{diffCfg.multiplier})
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* 6. Số LOT */}
                                                        {Boolean(wl.lots_count) && (
                                                            <div className="bg-white/95 p-1.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col text-center">
                                                                <span className="text-[10px] font-semibold text-stone-500">🏷️ Số LOT</span>
                                                                <span className="text-xs font-black text-purple-800 mt-0.5 truncate">
                                                                    {wl.lots_count} LOT
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* 7. Giờ làm (từ đánh giá sau nghiệm thu) */}
                                                        <div
                                                            className="bg-white/95 p-1.5 rounded-xl border border-indigo-100 shadow-2xs flex flex-col text-center"
                                                            title={
                                                                evalHours.isDefault
                                                                    ? 'Chưa nhập giờ đánh giá — tạm tính ca chuẩn 8h/người'
                                                                    : undefined
                                                            }
                                                        >
                                                            <span className="text-[10px] font-semibold text-stone-500">⏱️ Giờ làm</span>
                                                            <span className="text-xs font-black text-indigo-800 mt-0.5 truncate">
                                                                {displayHours > 0
                                                                    ? `${displayHours.toLocaleString('vi-VN')}h`
                                                                    : '-'}
                                                            </span>
                                                            {displayOvertime > 0 && (
                                                                <span className="text-[9px] font-bold text-amber-700">
                                                                    +{displayOvertime.toLocaleString('vi-VN')}h OT
                                                                </span>
                                                            )}
                                                            {evalHours.isDefault && (
                                                                <span className="text-[9px] font-semibold text-stone-400">
                                                                    ca chuẩn
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Footer ghi chú hệ số hoặc chứng từ nếu có */}
                                                    {(wl.quantity_adjustment_note || wl.quantity_factor_label) && (
                                                        <div className="text-[10px] text-stone-600 bg-white/80 px-2 py-1 rounded-lg border border-indigo-100/60 flex items-center gap-1.5">
                                                            <span className="font-bold text-indigo-900 shrink-0">Hệ số:</span>
                                                            <span className="truncate">{wl.quantity_adjustment_note || wl.quantity_factor_label}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </>
    )
}
