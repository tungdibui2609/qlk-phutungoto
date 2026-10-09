import { X } from 'lucide-react'

interface OrderFormLayoutProps {
    title: React.ReactNode
    subtitle?: string
    onClose: () => void
    children: React.ReactNode
    maxWidth?: string
    footer?: React.ReactNode
    headerActions?: React.ReactNode
}

export function OrderFormLayout({ title, subtitle, onClose, children, footer, headerActions, maxWidth = 'max-w-7xl' }: OrderFormLayoutProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full ${maxWidth} h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className="px-6 py-3.5 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50/80 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-base font-bold flex items-center gap-2 text-stone-900 dark:text-white">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="text-xs text-stone-500 mt-0.5">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        {headerActions}
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-stone-200 dark:bg-zinc-800 rounded-lg transition-colors text-stone-400 hover:text-stone-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-3 border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-end gap-2.5 items-center">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}
