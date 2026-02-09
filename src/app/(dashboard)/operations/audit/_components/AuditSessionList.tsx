'use client'

import { InventoryCheck } from '../_hooks/useAudit'
import { Calendar, User, FileText, ChevronRight, ClipboardCheck, Trash2, Users, Layers, Target } from 'lucide-react'
import Link from 'next/link'

interface AuditSessionListProps {
    sessions: InventoryCheck[]
    loading: boolean
    onDelete: (id: string) => void
}

export function AuditSessionList({ sessions, loading, onDelete }: AuditSessionListProps) {
    if (loading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-28 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 text-slate-300">
                    <ClipboardCheck size={40} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Chưa có phiếu kiểm kê</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-2 text-sm">
                    Tạo phiếu mới để bắt đầu quy trình kiểm kê và cân bằng kho hàng.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {sessions.map(session => (
                <Link
                    key={session.id}
                    href={`/operations/audit/${session.id}`}
                    className="block group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-300 relative overflow-hidden"
                >
                    {/* Hover status indicator line */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        {/* Col 1: Core Identity */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-sm border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                                    {session.code}
                                </span>
                                <StatusBadge status={session.status} />

                                {['DRAFT', 'IN_PROGRESS', 'CANCELLED', 'REJECTED'].includes(session.status) && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onDelete(session.id)
                                        }}
                                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 ml-auto md:ml-0"
                                        title="Xóa phiếu"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold ml-1 tracking-wider">
                                <Calendar size={12} className="text-slate-400" />
                                <span className="text-slate-400 uppercase">Ngày lập phiếu:</span>
                                <span className="text-slate-900 dark:text-slate-100">{new Date(session.created_at).toLocaleDateString('vi-VN')}</span>
                            </div>
                        </div>

                        {/* Col 2: Context & Scope */}
                        <div className="flex flex-col gap-3 md:border-x border-slate-100 dark:border-slate-800 md:px-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Phạm vi</p>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        <Target size={14} className="text-orange-500" />
                                        {session.scope === 'ALL' ? 'Toàn bộ kho' : 'Một phần'}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Người kiểm</p>
                                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        <Users size={14} className="text-blue-500" />
                                        {Array.isArray(session.participants) ? session.participants.length : 1} thành viên
                                    </div>
                                </div>
                            </div>

                            {/* Context & Metadata info consolidated */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-slate-100 dark:border-slate-800/50 pt-3">
                                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-[0_0_5px_rgba(251,146,60,0.5)]" />
                                    {session.warehouse_name || 'Toàn hệ thống'}
                                </div>
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                                    <User size={11} />
                                    <span>{session.user_profiles?.full_name || 'Hệ thống'}</span>
                                </div>
                            </div>

                            {session.note && (
                                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg flex items-start gap-2 max-w-full overflow-hidden">
                                    <FileText size={12} className="text-slate-400 mt-0.5" />
                                    <p className="text-[11px] text-slate-500 line-clamp-2 italic leading-tight">
                                        {session.note}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Col 3: Progress & Date */}
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3">
                                {session.stats && (
                                    <div className="space-y-3">
                                        {/* Main Progress Bar */}
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between items-center text-[10px] font-bold">
                                                <span className="text-slate-500 uppercase tracking-tighter">Tiến độ kiểm</span>
                                                <span className="text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                    <Layers size={10} className="text-orange-400" />
                                                    {session.stats.counted}/{session.stats.total}
                                                    <span className="text-orange-500 ml-1">{session.stats.progress}%</span>
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50 p-0.5">
                                                <div
                                                    className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500 shadow-sm"
                                                    style={{ width: `${session.stats.progress}%` }}
                                                />
                                            </div>
                                        </div>

                                        {/* Balancing Progress Bar */}
                                        {session.status === 'COMPLETED' && session.stats.balancing && (
                                            <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/50">
                                                <div className="flex justify-end items-center text-[10px] font-bold">
                                                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                                                        {session.stats.balancing.completed}/{session.stats.balancing.total}
                                                        <span className="ml-1">({session.stats.balancing.percent}%)</span>
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-blue-50 dark:bg-blue-900/20 rounded-full overflow-hidden border border-blue-100/30 dark:border-blue-800/30 p-0.5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500 shadow-sm"
                                                        style={{ width: `${session.stats.balancing.percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </Link>
            ))}
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
