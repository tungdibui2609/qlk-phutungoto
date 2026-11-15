'use client'

import React from 'react'
import Link from 'next/link'
import { Briefcase, Check, CheckCircle2, History, Layers, Plus, RefreshCw, StopCircle, Trash2 } from 'lucide-react'

interface MobileJobSheetProps {
    isOpen: boolean
    openShifts: any[]
    activeShift: any
    formatTimeOnly: (dateStr: string | null | undefined) => string
    onClose: () => void
    onSelectShift: (shift: any) => void
    onDeleteShift: (shiftId: string, title: string) => void
    onOpenCreateShift: () => void
}

export function MobileJobSheet({
    isOpen,
    openShifts,
    activeShift,
    formatTimeOnly,
    onClose,
    onSelectShift,
    onDeleteShift,
    onOpenCreateShift,
}: MobileJobSheetProps) {
    if (!isOpen) return null

    return (
        <div className="sm:hidden fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-8 duration-200">
                <div className="w-9 h-1 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-2.5" />
                <h3 className="text-xs font-bold text-stone-500 mb-2 px-1">Chọn công việc</h3>
                <div className="flex-1 overflow-y-auto space-y-1.5">
                    {openShifts.map((shift, idx) => {
                        const isSelected = activeShift?.id === shift.id
                        const title = shift.summary_data?.job_name || shift.notes || `Công việc ${idx + 1}`
                        return (
                            <div key={shift.id} className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectShift(shift)
                                        onClose()
                                    }}
                                    className={`flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left border transition ${
                                        isSelected
                                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-800'
                                            : 'bg-white dark:bg-zinc-900 border-stone-200 dark:border-zinc-800'
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-stone-300'}`}>
                                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-xs font-bold text-stone-900 dark:text-white leading-snug">{title}</span>
                                        <span className="block text-[10px] text-stone-400">Mở lúc {formatTimeOnly(shift.opened_at)}</span>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDeleteShift(shift.id, title)
                                    }}
                                    title={`Xóa "${title}"`}
                                    className="w-10 h-10 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-stone-600 flex items-center justify-center shrink-0 active:scale-95 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => { onClose(); onOpenCreateShift() }}
                    className="mt-2.5 h-10 rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                    <Plus className="w-3.5 h-3.5" /> Thêm công việc mới
                </button>
            </div>
        </div>
    )
}

interface MobileMenuSheetProps {
    isOpen: boolean
    activeShift: any
    currentJobName: string
    subShiftsCount: number
    pastShiftsCount: number
    pinnedProductsCount: number
    formatTimeOnly: (dateStr: string | null | undefined) => string
    onClose: () => void
    onOpenInterimClose: () => void
    onShowSubShifts: () => void
    onOpenCloseShift: () => void
    onDeleteShift: () => void
    onOpenDoneView: () => void
    onReloadData: () => void
    onClearAllPins: () => void
}

export function MobileMenuSheet({
    isOpen,
    activeShift,
    currentJobName,
    subShiftsCount,
    pastShiftsCount,
    pinnedProductsCount,
    formatTimeOnly,
    onClose,
    onOpenInterimClose,
    onShowSubShifts,
    onOpenCloseShift,
    onDeleteShift,
    onOpenDoneView,
    onReloadData,
    onClearAllPins,
}: MobileMenuSheetProps) {
    if (!isOpen) return null

    return (
        <div className="sm:hidden fixed inset-0 z-[60] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative bg-white dark:bg-zinc-900 rounded-t-3xl shadow-2xl px-3.5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 duration-200">
                <div className="w-9 h-1 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-2.5" />
                {activeShift && (
                    <p className="text-[11px] text-stone-500 px-1 mb-1.5">
                        <strong className="text-stone-800 dark:text-stone-200">{currentJobName}</strong> • mở lúc {formatTimeOnly(activeShift.opened_at)}
                        {subShiftsCount > 0 && ` • ${subShiftsCount} lần chốt tạm`}
                    </p>
                )}
                <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                    {activeShift && (
                        <>
                            <button
                                type="button"
                                onClick={() => { onClose(); onOpenInterimClose() }}
                                className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                            >
                                <CheckCircle2 className="w-4 h-4 text-amber-500" /> Chốt tạm (Đợt {subShiftsCount + 1})
                            </button>
                            {subShiftsCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { onClose(); onShowSubShifts() }}
                                    className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                                >
                                    <Layers className="w-4 h-4 text-indigo-500" /> Xem các đợt chốt tạm
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { onClose(); onOpenCloseShift() }}
                                className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-rose-600"
                            >
                                <StopCircle className="w-4 h-4" /> Hoàn thành công việc
                            </button>
                            <button
                                type="button"
                                onClick={() => { onClose(); onDeleteShift() }}
                                className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-rose-600"
                            >
                                <Trash2 className="w-4 h-4 text-rose-600" /> Xóa công việc này
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={() => { onClose(); onOpenDoneView() }}
                        className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                    >
                        <History className="w-4 h-4 text-stone-500" /> Xem công việc đã hoàn thành ({pastShiftsCount})
                    </button>
                    <Link
                        href="/so-lieu/mau-cong-viec"
                        onClick={onClose}
                        className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-indigo-600 dark:text-indigo-400"
                    >
                        <Briefcase className="w-4 h-4" /> Quản lý công việc mẫu
                    </Link>
                    <button
                        type="button"
                        onClick={() => { onClose(); onReloadData() }}
                        className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold"
                    >
                        <RefreshCw className="w-4 h-4 text-stone-500" /> Tải lại số liệu
                    </button>
                    {pinnedProductsCount > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                onClose()
                                if (confirm(`Bỏ ghim toàn bộ sản phẩm của "${currentJobName}"?`)) onClearAllPins()
                            }}
                            className="w-full py-3 flex items-center gap-2.5 text-left text-xs font-semibold text-stone-400"
                        >
                            <Trash2 className="w-4 h-4" /> Xóa hết ghim ({pinnedProductsCount})
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
