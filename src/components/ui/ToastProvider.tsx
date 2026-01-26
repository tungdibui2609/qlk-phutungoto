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
            case 'success': return <div className="p-2 bg-emerald-500 rounded-full text-white shadow-lg shadow-emerald-500/20"><CheckCircle size={18} /></div>
            case 'error': return <div className="p-2 bg-rose-500 rounded-full text-white shadow-lg shadow-rose-500/20"><AlertCircle size={18} /></div>
            case 'warning': return <div className="p-2 bg-amber-500 rounded-full text-white shadow-lg shadow-amber-500/20"><AlertTriangle size={18} /></div>
            default: return <div className="p-2 bg-blue-500 rounded-full text-white shadow-lg shadow-blue-500/20"><Info size={18} /></div>
        }
    }

    const getBgColor = (type: ToastType) => {
        switch (type) {
            case 'success': return 'bg-white/80 dark:bg-zinc-900/80 border-emerald-500/10'
            case 'error': return 'bg-white/80 dark:bg-zinc-900/80 border-rose-500/10'
            case 'warning': return 'bg-white/80 dark:bg-zinc-900/10 border-amber-500/10'
            default: return 'bg-white/80 dark:bg-zinc-900/80 border-blue-500/10'
        }
    }

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toast Container - Floating and Glassmorphism */}
            <div className="fixed top-8 right-8 z-[10001] space-y-4 max-w-sm w-full">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`relative group flex items-center gap-4 p-5 rounded-[24px] border shadow-[0_30px_60px_rgba(0,0,0,0.12)] backdrop-blur-3xl animate-in slide-in-from-right-10 duration-500 overflow-hidden ${getBgColor(toast.type)}`}
                    >
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-200 dark:bg-slate-800 opacity-20">
                            <div className="h-full bg-current opacity-60 animate-[toast-progress_3s_linear_forwards]" />
                        </div>

                        <div className="shrink-0">
                            {getIcon(toast.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-none mb-1">
                                {toast.type === 'success' ? 'Thành công' : toast.type === 'error' ? 'Lỗi' : toast.type === 'warning' ? 'Cảnh báo' : 'Thông báo'}
                            </p>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                                {toast.message}
                            </p>
                        </div>

                        <button
                            onClick={() => removeToast(toast.id)}
                            className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirm Dialog - High Impact Professional Design */}
            {confirmDialog && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-white/95 dark:bg-zinc-950/95 rounded-[40px] shadow-[0_60px_100px_-20px_rgba(0,0,0,0.5)] border border-white/20 p-8 max-w-sm w-full animate-in zoom-in-95 slide-in-from-bottom-5 duration-700">
                        <div className="flex flex-col items-center text-center">
                            <div className="relative mb-8 group">
                                <div className="absolute inset-0 bg-orange-500 blur-[40px] opacity-20 animate-pulse" />
                                <div className="relative w-28 h-28 bg-gradient-to-br from-amber-100 via-orange-50 to-amber-100 dark:from-amber-900/40 dark:via-orange-900/20 dark:to-amber-900/40 rounded-[40px] flex items-center justify-center rotate-6 shadow-[inset_0_2px_10px_rgba(255,255,255,0.5)] border border-white dark:border-slate-800 transition-transform group-hover:rotate-12 duration-500">
                                    <AlertTriangle className="text-orange-600 dark:text-orange-400 drop-shadow-2xl" size={60} />
                                </div>
                            </div>

                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tighter leading-none">
                                Chờ chút!
                            </h3>

                            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-2">
                                {confirmDialog.message}
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 mt-8">
                            <button
                                onClick={() => handleConfirm(true)}
                                className="w-full py-4.5 bg-blue-600 hover:bg-blue-500 text-white rounded-[28px] font-black text-lg shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-3 group"
                            >
                                <CheckCircle size={24} className="group-hover:rotate-12 transition-transform" />
                                Tuyệt vời, tiếp tục
                            </button>
                            <button
                                onClick={() => handleConfirm(false)}
                                className="w-full py-4.5 text-slate-400 hover:text-slate-900 dark:hover:text-white font-bold transition-all rounded-[28px] hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            >
                                Quay lại sau
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                @keyframes toast-progress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </ToastContext.Provider>
    )
}
