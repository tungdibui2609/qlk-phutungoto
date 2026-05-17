'use client'

import { Hash, Trash2, Edit3, Eye, Tag, Users, Calendar, Target, CheckCircle2, Scale, TrendingUp, Printer, FileText, QrCode, Lock } from 'lucide-react'
import Protected from '@/components/auth/Protected'

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
        case 'DRAFT': return { label: 'Bản nháp', color: 'bg-zinc-100/80 text-zinc-500 border-zinc-200/50', icon: null }
        case 'IN_PROGRESS': return { label: 'Đang chạy', color: 'bg-blue-50/80 text-blue-600 border-blue-200/50', icon: null }
        case 'DONE': return { label: 'Hoàn thành', color: 'bg-emerald-50/80 text-emerald-600 border-emerald-200/50', icon: <Lock size={12} className="mr-1.5" /> }
        case 'CANCELED': return { label: 'Đã hủy', color: 'bg-rose-50/80 text-rose-600 border-rose-200/50', icon: null }
        default: return { label: status, color: 'bg-zinc-100 text-zinc-600', icon: null }
    }
}

export default function ProductionTable({ data, onEdit, onDelete, onStatusToggle, onLotLockToggle, onView }: ProductionTableProps) {
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('vi-VN')
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200/60 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50/40 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Lệnh Sản Xuất</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Đầu vào</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Đầu ra (Lots)</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Lịch trình</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center">Trạng thái</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                    {data.map((item) => {
                        const statusConfig = getStatusConfig(item.status)
                        const lotCount = item.production_lots?.length || 0
                        
                        return (
                            <tr key={item.id} 
                                onClick={() => onView?.(item)}
                                className="group hover:bg-zinc-50/80 dark:hover:bg-white/[0.02] transition-all duration-300 cursor-pointer"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 group-hover:bg-white dark:group-hover:bg-zinc-700 shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all">
                                            <Tag size={18} className="group-hover:text-orange-500 transition-colors" />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-mono text-[10px] font-black bg-orange-50 text-orange-600 px-2 py-0.5 rounded-md border border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50 uppercase shadow-sm tracking-tight whitespace-nowrap">
                                                    {item.code}
                                                </span>
                                            </div>
                                            <div className="font-bold text-zinc-800 dark:text-zinc-100 text-sm leading-tight tracking-tight whitespace-nowrap">{item.name}</div>
                                            {item.customers && (
                                                <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-zinc-400">
                                                    <Users size={12} className="text-zinc-300" />
                                                    <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{item.customers.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="px-6 py-4">
                                    {(item.input_products || (item.input_quantity && item.input_quantity > 0)) ? (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                    {Number(item.input_quantity).toLocaleString('vi-VN')}
                                                </span>
                                                <span className="text-[10px] font-bold text-emerald-500/70 lowercase">
                                                    {item.input_unit || 'kg'}
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 line-clamp-1 max-w-[180px]" title={item.input_products?.name}>
                                                {item.input_products?.name || 'Nguyên liệu'}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-zinc-400 italic">-</span>
                                    )}
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-2">
                                        {(item.production_lots && item.production_lots.length > 0) ? (
                                            item.production_lots.map((lot: any, idx: number) => (
                                                <div key={idx} className="flex items-center justify-between gap-3 group/lot p-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${lot.is_locked ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}`}>
                                                            <Hash size={10} className={lot.is_locked ? 'text-rose-400' : 'text-zinc-400'} />
                                                            {lot.lot_code}
                                                        </div>
                                                        
                                                        {lot.quantity_by_unit && lot.quantity_by_unit.length > 0 ? (
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                    {Number(lot.quantity_by_unit[0]?.qty).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
                                                                </span>
                                                                <span className="text-[9px] text-blue-500/70 lowercase">{lot.quantity_by_unit[0]?.unit}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs font-medium text-zinc-400">0 {lot.products?.unit || 'kg'}</span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1 opacity-0 group-hover/lot:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onLotLockToggle?.(lot.id, !!lot.is_locked) }}
                                                            className={`w-6 h-6 rounded flex items-center justify-center transition-all border ${lot.is_locked ? 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-white' : 'text-zinc-400 bg-white dark:bg-zinc-800 hover:bg-zinc-100 border-zinc-200 dark:border-zinc-700'}`}
                                                            title={lot.is_locked ? 'Mở khóa mã lot này' : 'Khóa mã lot này'}
                                                        >
                                                            {lot.is_locked ? <Lock size={12} /> : <TrendingUp size={12} />}
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.open(`/print/production-lot?id=${lot.id}&type=label`, '_blank') }}
                                                            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 bg-white dark:bg-zinc-800 hover:bg-orange-50 hover:text-orange-600 transition-all border border-zinc-200 dark:border-zinc-700 hover:border-orange-200"
                                                            title={`In tem: ${lot.products?.name}`}
                                                        >
                                                            <QrCode size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); window.open(`/print/production-lot?id=${lot.id}&type=sheet`, '_blank') }}
                                                            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 bg-white dark:bg-zinc-800 hover:bg-blue-50 hover:text-blue-600 transition-all border border-zinc-200 dark:border-zinc-700 hover:border-blue-200"
                                                            title={`In phiếu: ${lot.products?.name}`}
                                                        >
                                                            <FileText size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-xs text-zinc-400 italic">Chưa có mã lot</span>
                                        )}
                                    </div>
                                </td>
                                
                                <td className="px-6 py-4">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
                                            <div className="w-5 h-5 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                <Calendar size={10} />
                                            </div>
                                            <span>{formatDate(item.start_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-zinc-500">
                                            <div className="w-5 h-5 rounded-md bg-rose-50 flex items-center justify-center text-rose-600">
                                                <Calendar size={10} />
                                            </div>
                                            <span>{formatDate(item.end_date)}</span>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onStatusToggle?.(item.id, item.status); }}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all hover:scale-105 inline-flex items-center justify-center ${statusConfig.color}`}
                                    >
                                        {statusConfig.icon}
                                        {statusConfig.label}
                                    </button>
                                </td>

                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onView?.(item); }}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                            title="Xem chi tiết"
                                        >
                                            <Eye size={15} />
                                        </button>
                                        <Protected permission="warehouse.manage">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                                                title="Sửa thông tin"
                                            >
                                                <Edit3 size={15} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-300 hover:bg-rose-50 hover:text-rose-500 transition-colors"
                                                title="Xóa lệnh"
                                            >
                                                <Trash2 size={15} />
                                            </button>
                                        </Protected>
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
