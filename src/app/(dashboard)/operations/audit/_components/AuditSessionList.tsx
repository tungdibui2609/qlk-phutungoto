'use client'

import { InventoryCheck } from '../_hooks/useAudit'
import { Calendar, User, FileText, ChevronRight, ClipboardCheck, Trash2 } from 'lucide-react'
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
                    <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <ClipboardCheck size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Chưa có phiếu kiểm kê</h3>
                <p className="text-slate-500 max-w-xs mx-auto mt-1">
                    Tạo phiếu mới để bắt đầu quy trình kiểm kê kho hàng.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {sessions.map(session => (
                <Link
                    key={session.id}
                    href={`/operations/audit/${session.id}`}
                    className="block group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:border-orange-500/50 hover:shadow-lg transition-all duration-200"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-sm">
                                {session.code}
                            </span>
                            <StatusBadge status={session.status} />
                        </div>
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Calendar size={12} />
                            {new Date(session.created_at).toLocaleDateString('vi-VN')}
                        </span>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            {session.warehouse_name ? (
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Kho: {session.warehouse_name}
                                </div>
                            ) : (
                                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                    Toàn hệ thống
                                </div>
                            )}

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                    <User size={12} />
                                    {session.user_profiles?.full_name || 'N/A'}
                                </span>
                                {session.note && (
                                    <span className="flex items-center gap-1 max-w-[200px] truncate">
                                        <FileText size={12} />
                                        {session.note}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {['DRAFT', 'IN_PROGRESS', 'CANCELLED', 'REJECTED'].includes(session.status) && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        onDelete(session.id)
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                    title="Xóa phiếu"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                            <ChevronRight className="text-slate-300 group-hover:text-orange-500 transition-colors" size={20} />
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
        case 'COMPLETED':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">Hoàn thành</span>
        case 'CANCELLED':
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Đã hủy</span>
        default:
            return <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-slate-100 text-slate-500">{status}</span>
    }
}
