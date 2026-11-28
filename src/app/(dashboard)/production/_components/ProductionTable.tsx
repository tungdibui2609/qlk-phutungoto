'use client'

import { Trash2, Edit3, Eye, CheckCircle2, TrendingUp, Printer, RotateCcw, ChevronRight } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { formatQuantityFull } from '@/lib/numberUtils'

interface Production {
    id: string
    code: string
    name: string
    description: string
    status: string
    start_date: string | null
    end_date: string | null
    created_at: string
    weight_per_unit?: number
    target_system_code?: string
    products?: { name: string, sku: string }
    customers?: { name: string }
    input_products?: { name: string }
    input_quantity?: number
    input_unit?: string
    production_lots?: Array<{
        id: string
        lot_code: string
        product_id: string
        weight_per_unit: number
        planned_quantity: number | null
        products: { name: string, sku: string, unit: string }
        actual_quantity?: number
        is_locked?: boolean
    }>
}

interface ProductionTableProps {
    data: Production[]
    onEdit: (item: Production) => void
    onDelete: (id: string) => void
    onStatusToggle?: (id: string, currentStatus: string) => void
    onLotLockToggle?: (id: string, isLocked: boolean) => void
    onView?: (item: any) => void
}

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'DRAFT': return { label: 'Bản nháp', color: 'bg-stone-100 text-stone-600 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' }
        case 'IN_PROGRESS': return { label: 'Đang chạy', color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/60' }
        case 'DONE': return { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60' }
        case 'CANCELED': return { label: 'Đã hủy', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60' }
        default: return { label: status, color: 'bg-stone-100 text-stone-600 border-stone-200' }
    }
}

export default function ProductionTable({ data, onEdit, onDelete, onStatusToggle, onView }: ProductionTableProps) {
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('vi-VN')
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                    <tr className="bg-stone-50/80 dark:bg-zinc-800/60 border-b border-stone-200 dark:border-zinc-800">
                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">Lệnh Sản Xuất</th>
                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">Đầu vào</th>
                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">Đầu ra (Lots)</th>
                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">Trạng thái</th>
                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400">Thời gian</th>
                        <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-stone-500 dark:text-zinc-400 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-zinc-800/70">
                    {data.map((item) => {
                        const statusConfig = getStatusConfig(item.status)
                        const totalActualKg = (item.production_lots || []).reduce((acc: number, lot: any) => acc + (lot.actual_quantity || 0), 0)

                        return (
                            <tr
                                key={item.id}
                                onClick={() => onView?.(item)}
                                className="group hover:bg-stone-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                            >
                                <td className="px-3.5 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50 flex items-center justify-center shrink-0">
                                            <TrendingUp size={14} strokeWidth={2.2} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-stone-800 dark:text-zinc-100 text-xs font-mono">
                                                    {item.code}
                                                </span>
                                                {item.customers && (
                                                    <span className="text-[10px] font-medium text-stone-400 truncate max-w-[140px]">
                                                        • {item.customers.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-stone-600 dark:text-zinc-400 truncate max-w-[260px]">
                                                {item.name}
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-3.5 py-2.5">
                                    {(item.input_products || (item.input_quantity && item.input_quantity > 0)) ? (
                                        <div className="flex flex-col">
                                            <span className="font-medium text-stone-700 dark:text-stone-200 text-xs truncate max-w-[180px]">
                                                {item.input_products?.name || 'Nguyên liệu'}
                                            </span>
                                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                {Number(item.input_quantity || 0).toLocaleString('vi-VN')}{' '}
                                                <span className="text-[10px] font-medium text-stone-400 uppercase">
                                                    {item.input_unit || 'KG'}
                                                </span>
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-stone-400">-</span>
                                    )}
                                </td>

                                <td className="px-3.5 py-2.5">
                                    {(item.production_lots && item.production_lots.length > 0) ? (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="px-2 py-0.5 bg-stone-100 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 rounded-md text-[11px] font-semibold border border-stone-200 dark:border-zinc-700 whitespace-nowrap">
                                                {item.production_lots.length} Lot
                                            </span>
                                            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md text-[11px] font-semibold border border-blue-200/60 dark:border-blue-900/50 whitespace-nowrap">
                                                {formatQuantityFull(totalActualKg)} kg
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] text-stone-400 italic">Đang khởi tạo...</span>
                                    )}
                                </td>

                                <td className="px-3.5 py-2.5">
                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap inline-block ${statusConfig.color}`}>
                                        {statusConfig.label}
                                    </span>
                                </td>

                                <td className="px-3.5 py-2.5">
                                    <div className="text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap">
                                        {formatDate(item.start_date)}
                                        {item.end_date && item.end_date !== item.start_date && (
                                            <span className="text-stone-400"> → {formatDate(item.end_date)}</span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-3.5 py-2.5">
                                    <div className="flex items-center justify-end gap-1 opacity-75 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(`/sanxuat/print-labels?mo_id=${item.id}`, '_blank');
                                            }}
                                            className="p-1.5 rounded-md text-stone-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors cursor-pointer"
                                            title="Trạm in tem thùng"
                                        >
                                            <Printer size={14} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onView?.(item); }}
                                            className="p-1.5 rounded-md text-stone-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors cursor-pointer"
                                            title="Xem chi tiết"
                                        >
                                            <Eye size={14} />
                                        </button>
                                        <Protected permission="warehouse.manage">
                                            {onStatusToggle && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onStatusToggle(item.id, item.status);
                                                    }}
                                                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${item.status === 'DONE' ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30' : 'text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'}`}
                                                    title={item.status === 'DONE' ? "Mở lại lệnh sản xuất" : "Hoàn thành lệnh sản xuất"}
                                                >
                                                    {item.status === 'DONE' ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                                className="p-1.5 rounded-md text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                                className="p-1.5 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                                                title="Xóa"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </Protected>
                                        <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 ml-0.5" />
                                    </div>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
