'use client'

import React, { useState } from 'react'
import {
    Trash2,
    AlertTriangle,
    Info,
    CheckCircle2,
    X,
    Loader2
} from 'lucide-react'

export interface TaskConfirmModalProps {
    isOpen: boolean
    title: string
    message?: string
    taskSnippet?: {
        code?: string
        title?: string
    }
    confirmText?: string
    cancelText?: string
    variant?: 'danger' | 'warning' | 'info' | 'success'
    isDanger?: boolean
    hideCancel?: boolean
    onConfirm: () => void | Promise<void>
    onClose: () => void
}

export default function TaskConfirmModal({
    isOpen,
    title,
    message,
    taskSnippet,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy bỏ',
    variant = 'danger',
    isDanger = true,
    hideCancel = false,
    onConfirm,
    onClose,
}: TaskConfirmModalProps) {
    const [submitting, setSubmitting] = useState(false)

    if (!isOpen) return null

    const handleConfirm = async () => {
        try {
            setSubmitting(true)
            await onConfirm()
        } catch (err) {
            console.error('Confirm modal action error:', err)
        } finally {
            setSubmitting(false)
            onClose()
        }
    }

    const effectiveVariant = isDanger ? 'danger' : variant

    const getIconBadge = () => {
        switch (effectiveVariant) {
            case 'danger':
                return (
                    <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto ring-8 ring-rose-50/60 shadow-sm">
                        <Trash2 className="w-7 h-7 stroke-[2.2]" />
                    </div>
                )
            case 'warning':
                return (
                    <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto ring-8 ring-amber-50/60 shadow-sm">
                        <AlertTriangle className="w-7 h-7 stroke-[2.2]" />
                    </div>
                )
            case 'success':
                return (
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/60 shadow-sm">
                        <CheckCircle2 className="w-7 h-7 stroke-[2.2]" />
                    </div>
                )
            case 'info':
            default:
                return (
                    <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-200 text-purple-600 flex items-center justify-center mx-auto ring-8 ring-purple-50/60 shadow-sm">
                        <Info className="w-7 h-7 stroke-[2.2]" />
                    </div>
                )
        }
    }

    const getConfirmBtnClass = () => {
        switch (effectiveVariant) {
            case 'danger':
                return 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white shadow-lg shadow-rose-600/25 border-rose-500'
            case 'warning':
                return 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/25 border-amber-500'
            case 'success':
                return 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/25 border-emerald-500'
            case 'info':
            default:
                return 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-600/25 border-purple-500'
        }
    }

    return (
        <div 
            className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-stone-950/60 backdrop-blur-xs transition-opacity duration-300"
                onClick={() => {
                    if (!submitting) onClose()
                }}
            />

            {/* Modal Card */}
            <div 
                className="bg-white rounded-t-[28px] sm:rounded-3xl border border-stone-200/90 shadow-2xl max-w-md w-full p-5 sm:p-6 relative z-10 transform transition-all duration-300 animate-in slide-in-from-bottom sm:zoom-in-95 ease-out pb-8 sm:pb-6"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile Handle Bar */}
                <div className="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-3 sm:hidden" />

                {/* Close X Button */}
                <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition disabled:opacity-40"
                    aria-label="Đóng"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon & Title */}
                <div className="flex flex-col items-center text-center space-y-3 pt-1">
                    {getIconBadge()}

                    <div className="space-y-1.5 max-w-xs">
                        <h3 className="text-lg font-black text-stone-900 tracking-tight">
                            {title}
                        </h3>
                        {message && (
                            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                                {message}
                            </p>
                        )}
                    </div>
                </div>

                {/* Task Snippet Card */}
                {taskSnippet && (taskSnippet.code || taskSnippet.title) && (
                    <div className="mt-3.5 p-3 rounded-2xl bg-stone-50 border border-stone-200/80 text-left flex items-start gap-2.5">
                        {taskSnippet.code && (
                            <span className="text-[11px] font-mono font-bold bg-white border border-stone-200 text-stone-700 px-2 py-0.5 rounded-lg flex-shrink-0 shadow-2xs">
                                #{taskSnippet.code}
                            </span>
                        )}
                        {taskSnippet.title && (
                            <span className="text-xs font-semibold text-stone-800 line-clamp-2 leading-snug">
                                {taskSnippet.title}
                            </span>
                        )}
                    </div>
                )}

                {/* Danger Notice */}
                {effectiveVariant === 'danger' && (
                    <div className="mt-2 text-[11.5px] text-rose-700 bg-rose-50/80 border border-rose-200/80 rounded-xl px-3 py-1.5 text-center font-medium">
                        ⚠️ Dữ liệu sẽ bị xóa hoàn toàn và không thể khôi phục lại.
                    </div>
                )}

                {/* Action Buttons */}
                <div className="mt-5 flex gap-2.5">
                    {!hideCancel && (
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 py-3 px-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs sm:text-sm font-bold active:scale-95 transition cursor-pointer disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={submitting}
                        className={`flex-1 py-3 px-4 rounded-2xl text-xs sm:text-sm font-black active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5 ${getConfirmBtnClass()} disabled:opacity-50`}
                    >
                        {submitting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Đang xử lý...</span>
                            </>
                        ) : (
                            <span>{confirmText}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
