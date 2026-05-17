'use client'

import { Hash, Trash2, Edit3, Eye, Tag, Users, Calendar, Target, CheckCircle2, Scale, TrendingUp, Printer, FileText, QrCode, Lock } from 'lucide-react'
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
        case 'DRAFT': return { label: 'Bản nháp', color: 'bg-stone-100 text-stone-500', icon: null }
        case 'IN_PROGRESS': return { label: 'Đang chạy', color: 'bg-blue-100 text-blue-600', icon: null }
        case 'DONE': return { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-600', icon: null }
        case 'CANCELED': return { label: 'Đã hủy', color: 'bg-rose-100 text-rose-600', icon: null }
        default: return { label: status, color: 'bg-stone-100 text-stone-600', icon: null }
    }
}

export default function ProductionTable({ data, onEdit, onDelete, onStatusToggle, onLotLockToggle, onView }: ProductionTableProps) {
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('vi-VN')
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[24px] border border-stone-100 dark:border-zinc-800 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                    <tr>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-stone-400">Lệnh Sản Xuất</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-stone-400">Đầu vào</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-stone-400">Đầu ra (Lots)</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-stone-400">Trạng thái</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-stone-400">Thời gian</th>
                        <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-stone-400 text-right">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 dark:divide-zinc-800/50">
                    {data.map((item) => {
                        const statusConfig = getStatusConfig(item.status)
                        const lotCount = item.production_lots?.length || 0
                        
                        return (
                            <tr key={item.id} 
                                onClick={() => onView?.(item)}
                                className="group hover:bg-stone-50/50 dark:hover:bg-zinc-800/20 transition-all duration-200 cursor-pointer"
                            >
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                            <TrendingUp size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="font-black text-stone-800 dark:text-zinc-100 text-sm tracking-tight mb-0.5">
                                                {item.code}
                                            </div>
                                            <div className="font-bold text-stone-500 dark:text-zinc-400 text-xs">
                                                {item.name}
                                            </div>
                                            {item.customers && (
                                                <div className="text-[10px] font-medium text-stone-400 mt-0.5">
                                                    {item.customers.name}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="px-6 py-5 align-top">
                                    {(item.input_products || (item.input_quantity && item.input_quantity > 0)) ? (
                                        <div className="flex flex-col gap-1 mt-2">
                                            <div className="font-black text-stone-800 dark:text-stone-200 text-sm">
                                                {item.input_products?.name || 'Nguyên liệu'}
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                                                    {Number(item.input_quantity).toLocaleString('vi-VN')}
                                                </span>
                                                <span className="text-[10px] font-bold text-stone-400 uppercase">
                                                    {item.input_unit || 'KG'}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-stone-400 italic mt-2 block">-</span>
                                    )}
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <div className="flex flex-col gap-2 mt-1">
                                        {(item.production_lots && item.production_lots.length > 0) ? (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="px-3 py-1.5 bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-stone-300 rounded-xl text-xs font-black shadow-sm border border-stone-200 dark:border-zinc-700 whitespace-nowrap inline-block">
                                                    {item.production_lots.length} MÃ LOT
                                                </span>
                                                <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm border border-blue-100 dark:border-blue-900/30 whitespace-nowrap inline-flex">
                                                    {formatQuantityFull(item.production_lots.reduce((acc: number, lot: any) => acc + (lot.actual_quantity || 0), 0))} KG
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-stone-400 font-bold italic mt-1 block">Đang khởi tạo Lô...</span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <div className="mt-2">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap inline-block ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <div className="space-y-1 mt-2 text-xs font-bold text-stone-600 dark:text-stone-400">
                                        <div>{formatDate(item.start_date)}</div>
                                        {item.end_date && item.end_date !== item.start_date && (
                                            <div className="text-stone-400">- {formatDate(item.end_date)}</div>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-5 align-top">
                                    <div className="flex items-center justify-end gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onView?.(item); }}
                                            className="p-1.5 text-stone-400 hover:text-blue-600 transition-colors"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <Protected permission="warehouse.manage">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                                                className="p-1.5 text-stone-400 hover:text-emerald-600 transition-colors"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                                                className="p-1.5 text-stone-400 hover:text-rose-600 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </Protected>
                                        <div className="w-px h-4 bg-stone-200 mx-1"></div>
                                        <div className="p-1.5 text-stone-300 group-hover:text-stone-400">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                        </div>
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
