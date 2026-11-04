'use client'

import { InventoryCheck } from '../_hooks/useAudit'
import { ArrowLeft, CheckCircle, Zap, ShieldCheck, XCircle, PlusCircle, MinusCircle, FileText, Printer, Boxes, Trash2 } from 'lucide-react'
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
    onConfirmLot?: () => void
    onToggleShowLot?: () => void
    onQuickFillLot?: () => void
    onDelete?: () => void
}

export function AuditSessionHeader({
    session, onSubmit, onApprove, onReject, onQuickFill,
    hasSurplus, hasLoss, onOpenInbound, onOpenOutbound, onConfirmLot, onToggleShowLot, onQuickFillLot,
    onDelete
}: AuditSessionHeaderProps) {
    const router = useRouter()
    const { hasPermission } = useUser()
    const canEdit = session.status === 'IN_PROGRESS' || session.status === 'DRAFT' || session.status === 'REJECTED'
    const isPendingApproval = session.status === 'WAITING_FOR_APPROVAL'
    // Simple permission check: Assume 'system.full_access' or 'audit.approve' (if exists) is needed.
    const canApprove = hasPermission('system.full_access') || hasPermission('audit.approve')
    const isRejected = session.status === 'REJECTED'

    return (
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                                {session.code}
                            </h1>
                            <StatusBadge status={session.status} />
                            {onToggleShowLot && (
                                <button
                                    onClick={onToggleShowLot}
                                    type="button"
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                                        session.show_lot_quantity
                                            ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 shadow-sm'
                                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:border-slate-300'
                                    }`}
                                    title={session.show_lot_quantity ? "Đang hiện tồn LOT. Nhấp để ẩn" : "Đang ẩn tồn LOT. Nhấp để hiện"}
                                >
                                    <Boxes size={13} />
                                    <span>{session.show_lot_quantity ? 'Hiện tồn LOT' : 'Ẩn tồn LOT'}</span>
                                </button>
                            )}
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
                        <div className="flex items-center gap-3">
                            <p className="text-sm text-slate-500 font-medium">
                                {session.warehouse_name || 'Toàn hệ thống'}
                            </p>
                            {session.stats && (
                                <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 pl-3">
                                    <div className="flex items-center gap-2">
                                        <div className="h-2 w-48 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500 ease-out"
                                                style={{ width: `${session.stats.progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-black text-slate-500 whitespace-nowrap">
                                            {session.stats.counted}/{session.stats.total} ({session.stats.progress}%)
                                        </span>
                                    </div>

                                    {/* Balancing Progress (For WAITING_FOR_APPROVAL or COMPLETED) */}
                                    {['WAITING_FOR_APPROVAL', 'COMPLETED'].includes(session.status) && session.stats.balancing && (
                                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-slate-100/50 dark:border-slate-800/50">
                                            <div className="h-2 w-48 bg-blue-50 dark:bg-blue-900/20 rounded-full overflow-hidden border border-blue-100/30 dark:border-blue-800/30">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out shadow-sm"
                                                    style={{ width: `${session.stats.balancing.percent}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-black text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                                {session.stats.balancing.completed}/{session.stats.balancing.total} ({session.stats.balancing.percent}%)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {session.note && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 w-fit">
                                <FileText size={12} className="shrink-0" />
                                <span className="italic">"{session.note}"</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => window.open(`/print/audit?id=${session.id}`, '_blank')}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="In phiếu kiểm kê"
                    >
                        <Printer size={20} />
                    </button>

                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/50 dark:text-slate-400 dark:hover:text-red-400 transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                            title={session.status === 'COMPLETED' ? "Xóa phiếu kiểm kê đã hoàn thành" : "Xóa phiếu kiểm kê"}
                        >
                            <Trash2 size={18} />
                        </button>
                    )}

                    {canEdit && (
                        <>
                            <button
                                onClick={onQuickFill}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                title="Tự động điền số lượng sổ sách hệ thống cho các mục chưa kiểm"
                            >
                                <Zap size={20} />
                            </button>
                            {onQuickFillLot && (
                                <button
                                    onClick={onQuickFillLot}
                                    className="h-10 px-3 flex items-center gap-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all font-bold text-xs shadow-sm cursor-pointer active:scale-95"
                                    title="Tự động điền số lượng tồn LOT vào chỗ số lượng kiểm kê"
                                >
                                    <Boxes size={16} />
                                    <span>Điền tồn LOT</span>
                                </button>
                            )}
                            <button
                                onClick={onSubmit}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={18} />
                                <span className="hidden sm:inline">
                                    {isRejected ? 'Gửi duyệt lại' : 'Gửi duyệt'}
                                </span>
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

                    {['WAITING_FOR_APPROVAL', 'COMPLETED'].includes(session.status) && (
                        <>
                            {hasSurplus && !session.adjustment_inbound_order_id && session.status === 'COMPLETED' && (
                                <button
                                    onClick={onOpenInbound}
                                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-emerald-200"
                                >
                                    <PlusCircle size={18} />
                                    <span className="hidden sm:inline">Tạo phiếu nhập</span>
                                </button>
                            )}
                            {hasLoss && !session.adjustment_outbound_order_id && session.status === 'COMPLETED' && (
                                <button
                                    onClick={onOpenOutbound}
                                    className="bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-orange-200"
                                >
                                    <MinusCircle size={18} />
                                    <span className="hidden sm:inline">Tạo phiếu xuất</span>
                                </button>
                            )}
                            {session.stats?.balancing?.lotMismatchCount && session.stats.balancing.lotMismatchCount > 0 && !session.lot_adjusted_at && (
                                <button
                                    onClick={onConfirmLot}
                                    className="bg-purple-50 text-purple-600 hover:bg-purple-100 px-3 py-2 rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-purple-200 animate-pulse"
                                >
                                    <ShieldCheck size={18} />
                                    <span className="hidden sm:inline text-xs">Xác nhận rà soát LOT</span>
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
            return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-slate-100 text-slate-500 border border-slate-200">Nháp</span>
        case 'IN_PROGRESS':
            return (
                <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-sm shadow-blue-500/5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                    </span>
                    Đang kiểm
                </span>
            )
        case 'WAITING_FOR_APPROVAL':
            return (
                <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-100 dark:border-orange-800 shadow-sm shadow-orange-500/5">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    Chờ duyệt
                </span>
            )
        case 'COMPLETED':
            return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">Hoàn thành</span>
        case 'REJECTED':
            return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-100 dark:border-red-800">Từ chối</span>
        case 'CANCELLED':
            return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-slate-100 text-slate-500 border border-slate-200">Đã hủy</span>
        default:
            return <span className="px-2.5 py-1 text-xs font-bold uppercase rounded-full bg-slate-100 text-slate-500 border border-slate-200">{status}</span>
    }
}
