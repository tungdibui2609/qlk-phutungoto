'use client'

import { Leaf, Truck, Package, Edit2, Trash2, ChevronRight, Snowflake, Eye } from 'lucide-react'

interface BatchTableProps {
    data: any[]
    onEdit: (batch: any) => void
    onDelete: (id: string) => void
    onSelect: (batch: any) => void
    onViewAnalytics?: (batch: any) => void
    selectedId?: string
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    RECEIVING: { label: 'Đang nhận', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    PROCESSING: { label: 'Đang xử lý', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
    COMPLETED: { label: 'Hoàn thành', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    CANCELLED: { label: 'Đã hủy', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' },
}

export default function BatchTable({ data, onEdit, onDelete, onSelect, onViewAnalytics, selectedId }: BatchTableProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-stone-100 dark:border-zinc-800">
                            <th className="text-left px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Mã lô</th>
                            <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Nguyên liệu</th>
                            <th className="text-left px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">NCC</th>
                            <th className="text-right px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">SL ban đầu</th>
                            <th className="text-center px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Lần nhập</th>
                            <th className="text-center px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Giai đoạn</th>
                            <th className="text-center px-4 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Trạng thái</th>
                            <th className="text-right px-6 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Ngày nhận</th>
                            <th className="px-4 py-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((batch) => {
                            const status = STATUS_MAP[batch.status] || STATUS_MAP.RECEIVING
                            const isSelected = selectedId === batch.id
                            const receivingCount = batch.fresh_material_receivings?.length || 0
                            const stageCount = batch.fresh_material_stages?.length || 0
                            const completedStages = batch.fresh_material_stages?.filter((s: any) => s.status === 'DONE').length || 0

                            return (
                                <tr
                                    key={batch.id}
                                    onClick={() => onSelect(batch)}
                                    className={`border-b border-stone-50 dark:border-zinc-800/50 transition-all cursor-pointer ${
                                        isSelected
                                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 ring-2 ring-inset ring-emerald-200 dark:ring-emerald-800'
                                            : 'hover:bg-stone-50 dark:hover:bg-zinc-800/30'
                                    }`}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-emerald-200 dark:bg-emerald-800' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
                                                <Leaf size={16} className="text-emerald-600" />
                                            </div>
                                            <span className="font-black text-stone-800 dark:text-white">{batch.batch_code}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="font-bold text-stone-700 dark:text-stone-300">{batch.products?.name || '---'}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className="font-medium text-stone-500">{batch.suppliers?.name || '---'}</span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="font-black text-stone-800 dark:text-white">
                                            {Number(batch.total_initial_quantity || 0).toLocaleString('vi-VN')}
                                        </span>
                                        <span className="text-[10px] font-bold text-stone-400 ml-1 uppercase">{batch.initial_unit}</span>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Truck size={14} className="text-stone-400" />
                                            <span className="font-black text-stone-600 dark:text-stone-300">{receivingCount}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {stageCount > 0 ? (
                                            <div className="flex items-center justify-center gap-1.5">
                                                <div className="flex gap-0.5">
                                                    {Array.from({ length: stageCount }).map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-2 h-2 rounded-full ${
                                                                i < completedStages
                                                                    ? 'bg-emerald-500'
                                                                    : 'bg-stone-200 dark:bg-zinc-700'
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                                <span className="text-[10px] font-bold text-stone-400">
                                                    {completedStages}/{stageCount}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-stone-300 text-xs">---</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${status.bg} ${status.color}`}>
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="text-xs font-bold text-stone-500">
                                            {batch.received_date ? new Date(batch.received_date).toLocaleDateString('vi-VN') : '---'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onViewAnalytics?.(batch) }}
                                                className="p-2 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-stone-400 hover:text-emerald-600 transition-colors"
                                                title="Phân tích chi tiết"
                                            >
                                                <Eye size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEdit(batch) }}
                                                className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-400 hover:text-orange-600 transition-colors"
                                                title="Chỉnh sửa"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onDelete(batch.id) }}
                                                className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-600 transition-colors"
                                                title="Xóa"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                            <ChevronRight size={16} className={`text-stone-300 transition-transform ${isSelected ? 'rotate-90 text-emerald-500' : ''}`} />
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-stone-100 dark:divide-zinc-800">
                {data.map((batch) => {
                    const status = STATUS_MAP[batch.status] || STATUS_MAP.RECEIVING
                    const isSelected = selectedId === batch.id
                    const receivingCount = batch.fresh_material_receivings?.length || 0
                    const stageCount = batch.fresh_material_stages?.length || 0
                    const completedStages = batch.fresh_material_stages?.filter((s: any) => s.status === 'DONE').length || 0

                    return (
                        <div
                            key={batch.id}
                            onClick={() => onSelect(batch)}
                            className={`p-5 transition-all cursor-pointer ${
                                isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                                        <Leaf size={16} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <div className="font-black text-stone-800 dark:text-white">{batch.batch_code}</div>
                                        <div className="text-xs text-stone-500 font-medium">{batch.products?.name || '---'}</div>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${status.bg} ${status.color}`}>
                                    {status.label}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-stone-50 dark:bg-zinc-800 rounded-xl p-2">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase">SL</div>
                                    <div className="font-black text-sm text-stone-800 dark:text-white">
                                        {Number(batch.total_initial_quantity || 0).toLocaleString('vi-VN')} {batch.initial_unit}
                                    </div>
                                </div>
                                <div className="bg-stone-50 dark:bg-zinc-800 rounded-xl p-2">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase">Xe</div>
                                    <div className="font-black text-sm text-stone-800 dark:text-white">{receivingCount}</div>
                                </div>
                                <div className="bg-stone-50 dark:bg-zinc-800 rounded-xl p-2">
                                    <div className="text-[10px] font-bold text-stone-400 uppercase">Stage</div>
                                    <div className="font-black text-sm text-stone-800 dark:text-white">{completedStages}/{stageCount}</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-stone-400">{batch.suppliers?.name || '---'}</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(batch) }}
                                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(batch.id) }}
                                        className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-600"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
