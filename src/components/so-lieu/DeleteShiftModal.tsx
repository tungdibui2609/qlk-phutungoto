'use client'

import React from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { DeleteTargetShift } from './types'

interface DeleteShiftModalProps {
    targetShift: DeleteTargetShift | null
    isDeleting: boolean
    onClose: () => void
    onConfirm: () => void
}

export default function DeleteShiftModal({
    targetShift,
    isDeleting,
    onClose,
    onConfirm,
}: DeleteShiftModalProps) {
    if (!targetShift) return null

    return (
        <div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            onClick={() => { if (!isDeleting) onClose() }}
        >
            <div
                className="bg-white dark:bg-zinc-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border-t sm:border border-stone-200 dark:border-zinc-800 animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Thanh handle bar vuốt chạm trên Mobile */}
                <div className="w-12 h-1.5 bg-stone-300 dark:bg-zinc-700 rounded-full mx-auto mb-3 sm:hidden shrink-0" />

                <div className="flex items-start gap-3.5 mb-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-100 dark:border-rose-900/50">
                        <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-stone-900 dark:text-white leading-snug">
                            Xác nhận xóa công việc?
                        </h3>
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed break-words">
                            Bạn có chắc chắn muốn xóa công việc <strong className="text-stone-800 dark:text-stone-200 font-bold">"{targetShift.title}"</strong> không?
                        </p>
                    </div>
                </div>

                {targetShift.recordCount > 0 && (
                    <div className="p-3 mb-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span className="leading-relaxed">
                            Công việc này đang có <strong className="font-bold text-amber-900 dark:text-amber-200">{targetShift.recordCount} đợt số liệu</strong> đã ghi nhận. Khi xóa, toàn bộ số liệu của công việc này sẽ bị xóa vĩnh viễn khỏi hệ thống!
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="h-10 text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl transition disabled:opacity-50"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="h-10 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                        {isDeleting ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Đang xóa...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xác Nhận Xóa</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
