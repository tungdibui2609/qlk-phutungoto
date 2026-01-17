'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void
    showConfirm: (message: string) => Promise<boolean>
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider')
    }
    return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; resolve: (value: boolean) => void } | null>(null)

    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = crypto.randomUUID()
        setToasts(prev => [...prev, { id, message, type }])

        // Auto dismiss after 3 seconds
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3000)
    }, [])

    const showConfirm = useCallback((message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirmDialog({ message, resolve })
        })
    }, [])

    const handleConfirm = (value: boolean) => {
        confirmDialog?.resolve(value)
        setConfirmDialog(null)
    }

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    const getIcon = (type: ToastType) => {
        switch (type) {
            case 'success': return <CheckCircle className="text-green-500" size={20} />
            case 'error': return <AlertCircle className="text-red-500" size={20} />
            case 'warning': return <AlertTriangle className="text-yellow-500" size={20} />
            default: return <Info className="text-blue-500" size={20} />
        }
    }

    const getBgColor = (type: ToastType) => {
        switch (type) {
            case 'success': return 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800'
            case 'error': return 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800'
            case 'warning': return 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800'
            default: return 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
        }
    }

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`flex items-center gap-3 p-4 rounded-xl border shadow-lg animate-in slide-in-from-right-5 ${getBgColor(toast.type)}`}
                    >
                        {getIcon(toast.type)}
                        <p className="flex-1 text-sm text-gray-800 dark:text-gray-200">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm Dialog */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full mx-4 animate-in zoom-in-95">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                                <AlertTriangle className="text-yellow-600 dark:text-yellow-400" size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Xác nhận</h3>
                                <p className="text-gray-600 dark:text-gray-300">{confirmDialog.message}</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => handleConfirm(false)}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => handleConfirm(true)}
                                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold shadow-md transition-all"
                            >
                                Xác nhận
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ToastContext.Provider>
    )
}
