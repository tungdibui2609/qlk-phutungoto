'use client'

import { InventoryCheck } from '../_hooks/useAudit'
import { ArrowLeft, CheckCircle, Zap, MoreVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AuditSessionHeaderProps {
    session: InventoryCheck
    onComplete: () => void
    onQuickFill: () => void
}

export function AuditSessionHeader({ session, onComplete, onQuickFill }: AuditSessionHeaderProps) {
    const router = useRouter()
    const canEdit = session.status === 'IN_PROGRESS' || session.status === 'DRAFT'

    return (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
            <div className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                {session.code}
                            </h1>
                            <StatusBadge status={session.status} />
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            {session.warehouse_name || 'Toàn hệ thống'}
                        </p>
                    </div>
                </div>

                {canEdit && (
                    <div className="flex items-center gap-2">
                         <button
                            onClick={onQuickFill}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            title="Tự động điền số lượng hệ thống cho các mục chưa kiểm"
                        >
                            <Zap size={20} />
                        </button>
                        <button
                            onClick={onComplete}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <CheckCircle size={18} />
                            <span className="hidden sm:inline">Hoàn thành</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case 'DRAFT':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">Nháp</span>
        case 'IN_PROGRESS':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">Đang kiểm</span>
        case 'COMPLETED':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Hoàn thành</span>
        case 'CANCELLED':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Đã hủy</span>
        default:
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">{status}</span>
    }
}
