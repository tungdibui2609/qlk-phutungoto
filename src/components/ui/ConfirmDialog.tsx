import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel: () => void
    variant?: 'danger' | 'warning' | 'info'
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmText = 'Xác nhận',
    cancelText = 'Hủy bỏ',
    onConfirm,
    onCancel,
    variant = 'warning'
}: ConfirmDialogProps) {
    if (!isOpen) return null

    const colors = {
        danger: {
            icon: 'text-red-500',
            bg: 'bg-red-50 dark:bg-red-900/20',
            button: 'bg-red-600 hover:bg-red-700'
        },
        warning: {
            icon: 'text-orange-500',
            bg: 'bg-orange-50 dark:bg-orange-900/20',
            button: 'bg-orange-600 hover:bg-orange-700'
        },
        info: {
            icon: 'text-blue-500',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            button: 'bg-blue-600 hover:bg-blue-700'
        }
    }

    const color = colors[variant]

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-stone-200 dark:border-zinc-800">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full ${color.bg} flex-shrink-0`}>
                            <AlertTriangle className={color.icon} size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-stone-900 dark:text-white mb-2">
                                {title}
                            </h3>
                            <div className="text-stone-600 dark:text-stone-300 text-sm whitespace-pre-line leading-relaxed">
                                {message}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-stone-50 dark:bg-zinc-800/50 flex justify-end gap-3 border-t border-stone-100 dark:border-zinc-800">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-600 text-stone-700 dark:text-gray-300 rounded-lg font-medium hover:bg-stone-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white rounded-lg font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95 ${color.button}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}
