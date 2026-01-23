import { X } from 'lucide-react'

interface OrderFormLayoutProps {
    title: React.ReactNode
    subtitle?: string
    onClose: () => void
    children: React.ReactNode
    maxWidth?: string
}

export function OrderFormLayout({ title, subtitle, onClose, children, maxWidth = 'max-w-7xl' }: OrderFormLayoutProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full ${maxWidth} h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}>
                {/* Header */}
                <div className="p-6 border-b border-stone-200 dark:border-zinc-800 flex justify-between items-center bg-stone-50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2 text-stone-900 dark:text-white">
                            {title}
                        </h2>
                        {subtitle && (
                            <p className="text-sm text-stone-500 mt-1">
                                {subtitle}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-200 dark:hover:bg-zinc-800 rounded-lg transition-colors text-stone-500 hover:text-stone-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-60">
                    {children}
                </div>
            </div>
        </div>
    )
}
