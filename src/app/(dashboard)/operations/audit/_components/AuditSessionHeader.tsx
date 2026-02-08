'use client'

import { InventoryCheck } from '../_hooks/useAudit'
import { ArrowLeft, CheckCircle, Zap, ShieldCheck, XCircle, PlusCircle, MinusCircle, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

interface AuditSessionHeaderProps {
    session: InventoryCheck
    onSubmit: () => void
    onApprove: () => void
    onReject: () => void
    onQuickFill: () => void
    hasSurplus?: boolean
    hasLoss?: boolean
    onOpenInbound?: () => void
    onOpenOutbound?: () => void
}

export function AuditSessionHeader({
    session, onSubmit, onApprove, onReject, onQuickFill,
    hasSurplus, hasLoss, onOpenInbound, onOpenOutbound
}: AuditSessionHeaderProps) {
    const router = useRouter()
    const { hasPermission } = useUser()
    const canEdit = session.status === 'IN_PROGRESS' || session.status === 'DRAFT'
    const isPendingApproval = session.status === 'WAITING_FOR_APPROVAL'
    // Simple permission check: Assume 'system.full_access' or 'audit.approve' (if exists) is needed.
    const canApprove = hasPermission('system.full_access') || hasPermission('audit.approve')

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
                            {session.adjustment_inbound_order && (
                                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-100 dark:border-emerald-800">
                                    NHẬP: {session.adjustment_inbound_order.code}
                                </div>
                            )}
                            {session.adjustment_outbound_order && (
                                <div className="flex items-center gap-1 text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-orange-100 dark:border-orange-800">
                                    XUẤT: {session.adjustment_outbound_order.code}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                            {session.warehouse_name || 'Toàn hệ thống'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canEdit && (
                        <>
                            <button
                                onClick={onQuickFill}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                title="Tự động điền số lượng hệ thống cho các mục chưa kiểm"
                            >
                                <Zap size={20} />
                            </button>
                            <button
                                onClick={onSubmit}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={18} />
                                <span className="hidden sm:inline">Gửi duyệt</span>
                            </button>
                        </>
                    )}

                    {isPendingApproval && canApprove && (
                        <>
                            <button
                                onClick={onReject}
                                className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2"
                            >
                                <XCircle size={18} />
                                <span className="hidden sm:inline">Từ chối</span>
                            </button>
                            <button
                                onClick={onApprove}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2 animate-pulse"
                            >
                                <ShieldCheck size={18} />
                                <span className="hidden sm:inline">Duyệt & Cân bằng</span>
                            </button>
                        </>
                    )}

                    {session.status === 'COMPLETED' && (
                        <>
                            {hasSurplus && !session.adjustment_inbound_order_id && (
                                <button
                                    onClick={onOpenInbound}
                                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-emerald-200"
                                >
                                    <PlusCircle size={18} />
                                    <span className="hidden sm:inline">Tạo phiếu nhập</span>
                                </button>
                            )}
                            {hasLoss && !session.adjustment_outbound_order_id && (
                                <button
                                    onClick={onOpenOutbound}
                                    className="bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-orange-200"
                                >
                                    <MinusCircle size={18} />
                                    <span className="hidden sm:inline">Tạo phiếu xuất</span>
                                </button>
                            )}
                        </>
                    )}
                </div>
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
        case 'WAITING_FOR_APPROVAL':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">Chờ duyệt</span>
        case 'COMPLETED':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Hoàn thành</span>
        case 'REJECTED':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Từ chối</span>
        case 'CANCELLED':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">Đã hủy</span>
        default:
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">{status}</span>
    }
}
