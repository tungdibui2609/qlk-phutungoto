'use client'

import { Hash, Trash2, Edit3, Eye, Tag, Users, Calendar, Target, CheckCircle2 } from 'lucide-react'
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
    production_lots?: Array<{
        id: string
        lot_code: string
        product_id: string
        weight_per_unit: number
        planned_quantity: number | null
        products: { name: string, sku: string, unit: string }
        actual_quantity?: number
    }>
}

interface ProductionTableProps {
    data: Production[]
    onEdit: (item: Production) => void
    onDelete: (id: string) => void
    onStatusToggle?: (id: string, currentStatus: string) => void
    onView?: (item: any) => void
}

const getStatusConfig = (status: string) => {
    switch (status) {
        case 'DRAFT': return { label: 'Bản nháp', color: 'bg-zinc-100/80 text-zinc-500 border-zinc-200/50' }
        case 'IN_PROGRESS': return { label: 'Đang chạy', color: 'bg-blue-50/80 text-blue-600 border-blue-200/50' }
        case 'DONE': return { label: 'Hoàn thành', color: 'bg-emerald-50/80 text-emerald-600 border-emerald-200/50' }
        case 'CANCELED': return { label: 'Đã hủy', color: 'bg-rose-50/80 text-rose-600 border-rose-200/50' }
        default: return { label: status, color: 'bg-zinc-100 text-zinc-600' }
    }
}

export default function ProductionTable({ data, onEdit, onDelete, onStatusToggle, onView }: ProductionTableProps) {
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-'
        return new Date(dateStr).toLocaleDateString('vi-VN')
    }

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200/60 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-50/40 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 min-w-[220px]">Thông tin Lệnh</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Lịch trình</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center">Trạng thái</th>
                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 text-center">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                    {data.map((item) => {
                        const statusConfig = getStatusConfig(item.status)
                        return (
                            <tr key={item.id} className="group hover:bg-zinc-50/40 dark:hover:bg-white/[0.02] transition-all duration-300">
                                <td className="px-8 py-7">
                                    <div className="flex items-start gap-4">
                                        <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-400 group-hover:bg-white dark:group-hover:bg-zinc-700 shadow-[0_2px_10px_rgb(0,0,0,0.02)] transition-all">
                                            <Tag size={22} className="group-hover:text-orange-500 transition-colors" />
                                        </div>
                                        <div>
                                            <div className="flex flex-col mb-2">
                                                <div className="w-fit">
                                                    <span className="font-mono text-[9px] font-black bg-orange-50 text-orange-600 px-3 py-1.5 rounded-lg border border-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/50 uppercase shadow-sm tracking-tight whitespace-nowrap inline-block">
                                                        {item.code}
                                                    </span>
                                                </div>
                                                <div className="font-bold text-zinc-800 dark:text-zinc-100 text-sm leading-tight tracking-tight mt-1 whitespace-nowrap">{item.name}</div>
                                            </div>
                                            {item.customers && (
                                                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-400">
                                                    <Users size={14} className="text-zinc-300" />
                                                    <span className="text-zinc-600 dark:text-zinc-300">{item.customers.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="px-8 py-7">
                                    <div className="flex flex-col gap-4">
                                        {(item as any).production_lots?.map((lot: any, idx: number) => (
                                            <div key={idx} className="flex flex-col gap-1.5 last:mb-0 border-l-2 border-zinc-100 dark:border-zinc-800 pl-4 py-0.5 hover:border-orange-200 transition-colors group/lot">
                                                <div className="flex items-center gap-3">
                                                    {/* Mã Lot Badge */}
                                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100/50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-extrabold text-[12px] uppercase border border-zinc-200/50 shadow-sm transition-all hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700">
                                                        <Hash size={12} className="text-zinc-400" /> {lot.lot_code}
                                                    </div>

                                                    {/* Sản lượng Thực tế (Rút gọn) */}
                                                    <div className="flex items-baseline gap-1 px-3 py-1.5 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/20 shadow-sm">
                                                        {(() => {
                                                            const extractWeight = (name?: string) => {
                                                                if (!name) return 0;
                                                                const match = name.match(/\(\s*.*?\s*(\d+(\.\d+)?)\s*[kK]?[gG]\s*\)/i);
                                                                return match ? parseFloat(match[1]) : 0;
                                                            };
                                                            
                                                            const weightFactor = lot.weight_factor || (lot.products as any)?.weight_kg || extractWeight(lot.products?.name) || 1;
                                                            const actual = lot.actual_quantity || 0;

                                                            if (weightFactor > 1) {
                                                                const fullUnits = Math.floor(actual / weightFactor);
                                                                const remainingKg = actual % weightFactor;
                                                                return (
                                                                    <>
                                                                        <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums leading-tight">
                                                                            {fullUnits}
                                                                        </span>
                                                                        <span className="text-[9px] text-blue-500/70 font-bold lowercase">thùng</span>
                                                                        {remainingKg >= 0.01 && (
                                                                            <>
                                                                                <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums leading-tight ml-1">
                                                                                    {remainingKg.toFixed(1).replace(/\.0$/, '')}
                                                                                </span>
                                                                                <span className="text-[9px] text-blue-500/70 font-bold lowercase">kg</span>
                                                                            </>
                                                                        )}
                                                                    </>
                                                                );
                                                            } else {
                                                                return (
                                                                    <>
                                                                        <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums leading-tight">
                                                                            {actual.toFixed(1).replace(/\.0$/, '')}
                                                                        </span>
                                                                        <span className="text-[9px] text-blue-500/70 font-bold lowercase">
                                                                            {lot.products?.unit || 'kg'}
                                                                        </span>
                                                                    </>
                                                                );
                                                            }
                                                        })()}
                                                    </div>
                                                </div>
                                                {/* Tên sản phẩm nhỏ gọn tinh tế */}
                                                <div className="flex items-center gap-2 group-hover/lot:translate-x-1 transition-transform">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400/30"></div>
                                                    <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider opacity-60">
                                                        {lot.products?.name}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </td>

                                <td className="px-8 py-7">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 text-[11px] font-bold text-zinc-500 group-hover:text-zinc-700 transition-colors">
                                            <div className="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                                                <Calendar size={13} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] uppercase tracking-widest text-zinc-400 leading-none mb-0.5">Bắt đầu</span>
                                                <span>{formatDate(item.start_date)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] font-bold text-zinc-500 group-hover:text-zinc-700 transition-colors">
                                            <div className="w-7 h-7 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-600 shadow-sm border border-rose-100/50">
                                                <Calendar size={13} />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] uppercase tracking-widest text-zinc-400 leading-none mb-0.5">Kết thúc</span>
                                                <span>{formatDate(item.end_date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-8 py-7 text-center">
                                    <button
                                        onClick={() => onStatusToggle?.(item.id, item.status)}
                                        className={`px-5 py-2.5 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest border transition-all active:scale-95 shadow-[0_2px_10px_rgb(0,0,0,0.02)] group-hover:shadow-[0_4px_15px_rgb(0,0,0,0.06)] ${statusConfig.color}`}
                                    >
                                        {statusConfig.label}
                                    </button>
                                </td>

                                <td className="px-8 py-7">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <button
                                            onClick={() => onView?.(item)}
                                            className="p-3.5 rounded-2xl text-zinc-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/10 transition-all border border-transparent hover:border-blue-100 shadow-sm hover:shadow-md"
                                            title="Xem chi tiết"
                                        >
                                            <Eye size={20} />
                                        </button>
                                        <Protected permission="warehouse.manage">
                                            <button
                                                onClick={() => onEdit(item)}
                                                className="p-3.5 rounded-2xl text-zinc-400 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-900/10 transition-all border border-transparent hover:border-orange-100 shadow-sm hover:shadow-md"
                                                title="Sửa thông tin"
                                            >
                                                <Edit3 size={20} />
                                            </button>
                                            <button
                                                onClick={() => onDelete(item.id)}
                                                className="p-3.5 rounded-2xl text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/10 transition-all border border-transparent hover:border-rose-100 shadow-sm hover:shadow-md"
                                                title="Xóa lệnh sản xuất"
                                            >
                                                <Trash2 size={20} />
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
