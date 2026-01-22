import React from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/Dialog'
import { AlertTriangle, Info, AlertCircle, CheckCircle2 } from 'lucide-react'

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onCancel: () => void
    variant?: 'danger' | 'warning' | 'info' | 'success'
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
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onCancel()
        }
    }

    const getVariantStyles = () => {
        switch (variant) {
            case 'danger':
                return {
                    icon: <AlertCircle className="w-6 h-6 text-red-600" />,
                    bgIcon: 'bg-red-100 dark:bg-red-900/30',
                    confirmBtn: 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                }
            case 'info':
                return {
                    icon: <Info className="w-6 h-6 text-blue-600" />,
                    bgIcon: 'bg-blue-100 dark:bg-blue-900/30',
                    confirmBtn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                }
            case 'success':
                return {
                    icon: <CheckCircle2 className="w-6 h-6 text-green-600" />,
                    bgIcon: 'bg-green-100 dark:bg-green-900/30',
                    confirmBtn: 'bg-green-600 hover:bg-green-700 shadow-green-500/20'
                }
            case 'warning':
            default:
                return {
                    icon: <AlertTriangle className="w-6 h-6 text-orange-600" />,
                    bgIcon: 'bg-orange-100 dark:bg-orange-900/30',
                    confirmBtn: 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/20'
                }
        }
    }

    const styles = getVariantStyles()

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="z-[99999] sm:max-w-[425px] p-0 overflow-hidden gap-0 border-0 shadow-2xl">
                <div className="p-6 bg-white dark:bg-zinc-900">
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-full flex-shrink-0 ${styles.bgIcon}`}>
                            {styles.icon}
                        </div>
                        <div className="flex-1 pt-1">
                            <DialogTitle className="text-lg font-bold text-stone-900 dark:text-gray-100 mb-2">
                                {title}
                            </DialogTitle>
                            <DialogDescription className="text-stone-600 dark:text-stone-300 text-sm whitespace-pre-line leading-relaxed">
                                {message}
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-stone-50 dark:bg-zinc-900/50 flex justify-end gap-3 border-t border-stone-100 dark:border-zinc-800">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-700 dark:text-gray-300 rounded-lg font-medium hover:bg-stone-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-white rounded-lg font-bold shadow-lg transition-all hover:scale-105 active:scale-95 ${styles.confirmBtn}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
