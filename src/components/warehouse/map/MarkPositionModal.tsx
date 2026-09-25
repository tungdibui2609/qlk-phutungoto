'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bookmark, X, Check, Trash2, AlertCircle } from 'lucide-react'

export interface MarkTargetPosition {
    id: string
    code: string
    zone_name?: string
    lot_id?: string | null
    lotDetail?: any
}

interface MarkPositionModalProps {
    isOpen: boolean
    onClose: () => void
    positions: MarkTargetPosition[]
    currentNote?: string
    isAlreadyMarked?: boolean
    onConfirm: (note: string) => void
    onUnmark?: () => void
}

const QUICK_REASONS = [
    '🔍 Cần kiểm đếm lại',
    '⚠️ Hàng rách / hỏng bao',
    '💧 Bao bì ẩm / ướt',
    '⏳ Chờ xuất / xử lý',
    '❌ Sai lệch số lượng',
    '🔄 Cần chuyển vị trí',
    '📋 Kiểm tra định kỳ',
    '🏷️ Thiếu nhãn mác',
]

export function MarkPositionModal({
    isOpen,
    onClose,
    positions,
    currentNote = '',
    isAlreadyMarked = false,
    onConfirm,
    onUnmark
}: MarkPositionModalProps) {
    const [note, setNote] = useState(currentNote)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (isOpen) {
            setNote(currentNote || '')
            // Auto focus textarea
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus()
                    textareaRef.current.select()
                }
            }, 100)
        }
    }, [isOpen, currentNote])

    if (!isOpen || positions.length === 0) return null

    const isSingle = positions.length === 1
    const singlePos = positions[0]

    const handleQuickReasonClick = (reason: string) => {
        // If empty, set reason. If already has content, append
        if (!note.trim()) {
            setNote(reason)
        } else if (!note.includes(reason)) {
            setNote(prev => `${prev.trim()}; ${reason}`)
        }
        textareaRef.current?.focus()
    }

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        onConfirm(note.trim())
        onClose()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
            e.preventDefault()
            handleSubmit()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
        }
    }

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/70 dark:bg-amber-950/20">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                            <Bookmark size={20} className="fill-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight">
                                {isAlreadyMarked ? 'Cập nhật ghi chú đánh dấu' : 'Đánh dấu vị trí kiểm tra'}
                            </h3>
                            <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-0.5 font-medium">
                                {isSingle ? `Vị trí: ${singlePos.code}` : `Đang chọn ${positions.length} vị trí`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Đóng (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Position Information */}
                    {isSingle ? (
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-800 dark:text-slate-100">
                                    Mã ô: <span className="text-amber-600 dark:text-amber-400 font-bold">{singlePos.code}</span>
                                </span>
                                {singlePos.zone_name && (
                                    <span className="text-slate-500 text-[11px]">Khu vực: {singlePos.zone_name}</span>
                                )}
                            </div>
                            <div className="mt-1 pt-1 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                                <span>Trạng thái hàng:</span>
                                {singlePos.lotDetail ? (
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                        LOT: {singlePos.lotDetail.code}
                                        {singlePos.lotDetail.product_name && ` (${singlePos.lotDetail.product_name})`}
                                    </span>
                                ) : singlePos.lot_id ? (
                                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Có LOT lưu kho</span>
                                ) : (
                                    <span className="italic text-slate-400">Vị trí trống</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3">
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                                <span>Danh sách {positions.length} vị trí áp dụng:</span>
                            </div>
                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                {positions.map(p => (
                                    <span
                                        key={p.id}
                                        className="px-2 py-0.5 text-[11px] font-bold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-200"
                                    >
                                        {p.code}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Note input */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                            Lý do / Ghi chú vì sao đánh dấu:
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={3}
                            placeholder="Nhập lý do đánh dấu (ví dụ: Hàng rách bao, cần kiểm đếm, bao ướt, kiểm tra định kỳ...)"
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:border-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none transition shadow-xs"
                        />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <AlertCircle size={12} />
                            Ghi chú này sẽ hiển thị khi rê chuột vào ô, trong danh sách lọc và khi xuất Excel / in sơ đồ.
                        </p>
                    </div>

                    {/* Quick Reasons Chips */}
                    <div className="space-y-1.5">
                        <span className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            Gợi ý lý do nhanh (bấm để chèn):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {QUICK_REASONS.map(reason => (
                                <button
                                    key={reason}
                                    type="button"
                                    onClick={() => handleQuickReasonClick(reason)}
                                    className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 hover:text-amber-800 dark:hover:text-amber-300 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer text-left active:scale-95"
                                >
                                    {reason}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-2">
                    <div>
                        {isAlreadyMarked && onUnmark && (
                            <button
                                type="button"
                                onClick={() => {
                                    onUnmark()
                                    onClose()
                                }}
                                className="px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                                title="Gỡ đánh dấu vị trí này"
                            >
                                <Trash2 size={14} />
                                <span>Bỏ đánh dấu</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSubmit()}
                            className="px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/20 active:scale-95 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Check size={15} />
                            <span>{isAlreadyMarked ? 'Lưu ghi chú' : 'Xác nhận đánh dấu'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
