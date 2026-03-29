'use client'
import React, { useState } from 'react'
import { FileText, Search, Plus, Edit2, Trash2, Box, RefreshCw, Calendar, Settings, Eye } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { supabase } from '@/lib/supabaseClient'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import { useToast } from '@/components/ui/ToastProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import Link from 'next/link'
import { getProductDisplayImage } from '@/lib/utils'
import { useUser } from '@/contexts/UserContext'

const STATUS_COLORS: Record<string, string> = {
    'DRAFT': 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
    'PLANNED': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'IN_PROGRESS': 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    'DONE': 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    'CANCELED': 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
}

const STATUS_LABELS: Record<string, string> = {
    'DRAFT': 'Nháp',
    'PLANNED': 'Đã lên kế hoạch',
    'IN_PROGRESS': 'Đang thực hiện',
    'DONE': 'Hoàn thành',
    'CANCELED': 'Đã hủy',
}

export default function ManufacturingOrdersPage() {
    const { profile, hasPermission } = useUser()
    const canManage = hasPermission('production.manage')
    const { showToast } = useToast()
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    const {
        filteredData: mos,
        loading,
        searchTerm,
        setSearchTerm,
        refresh
    } = useListingData<any>('manufacturing_orders' as any, {
        select: `*, products!manufacturing_orders_product_id_fkey(name, sku, unit, product_media(url, type)), boms(name, code)`,
        orderBy: { column: 'created_at', ascending: false }
    })

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id)
    }

    const executeDelete = async () => {
        if (!deleteConfirmId) return
        const { error } = await supabase.from('manufacturing_orders' as any).delete().eq('id', deleteConfirmId)
        if (error) {
            showToast('Lỗi khi xóa Lệnh sản xuất: ' + error.message, 'error')
        } else {
            showToast('Đã xóa Lệnh sản xuất thành công', 'success')
            refresh()
        }
        setDeleteConfirmId(null)
    }

    return (
        <div className="space-y-6 animate-fade-in pl-4 pr-4 pt-4">
            <PageHeader
                title="Lệnh Sản Xuất (MO)"
                subtitle="Manufacturing Orders"
                description="Quản lý các lệnh thực hiện sản xuất, theo dõi tiến độ và đối chiếu với Định mức (BOM)."
                icon={Settings}
                actionLink={canManage ? "/sanxuat/mo/new" : undefined}
                actionText={canManage ? "Tạo Lệnh (MO)" : undefined}
                permission="production.view"
            />

            {/* FILTERS & SEARCH */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] flex flex-col sm:flex-row gap-4 border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo Mã MO, Tên sản phẩm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 transition-all font-medium"
                    />
                </div>
                <button
                    onClick={refresh}
                    className="p-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition border border-transparent"
                    title="Làm mới dữ liệu"
                >
                    <RefreshCw size={20} className={loading ? "animate-spin text-emerald-600" : "text-emerald-600"} />
                </button>
            </div>

            {/* TABLE */}
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">Mã Lệnh (MO)</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">Sản phẩm Cần Làm</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">SL Cần Sản Xuất</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">Thời gian</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">Trạng thái</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-20 text-center">
                                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Đang tải...</p>
                                    </td>
                                </tr>
                            ) : mos.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-10">
                                        <EmptyState
                                            icon={Settings}
                                            title="Chưa có Lệnh Sản Xuất nào"
                                            description="Hãy bắt đầu khởi tạo Lệnh Sản Xuất (MO) để theo dõi vật tư."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                mos.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors cursor-pointer"
                                    >
                                        <td className="p-5">
                                            <Link href={`/sanxuat/mo/${item.id}/detail`} className="hover:underline">
                                                <p className="font-bold text-zinc-800 dark:text-zinc-100 text-base">{item.code}</p>
                                            </Link>
                                            {item.boms && (
                                                <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
                                                    <FileText size={12} />
                                                    <span className="truncate max-w-[120px]">{item.boms.name}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            {item.products ? (
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                                        {getProductDisplayImage(item.products) ? (
                                                            <img src={getProductDisplayImage(item.products)!} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Box size={16} className="text-zinc-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200 line-clamp-1">{item.products.name}</p>
                                                        <p className="text-xs text-zinc-500">{item.products.sku || '---'}</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400 italic text-sm">Sản phẩm bị xóa</span>
                                            )}
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                                                    {item.target_quantity} {item.products?.unit || ''}
                                                </span>
                                                <span className="text-[11px] text-zinc-500 font-medium">
                                                    Đã SX: {item.produced_quantity || 0}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                                <Calendar size={14} className="text-zinc-400" />
                                                <span>
                                                    {new Date(item.created_at).toLocaleDateString('vi-VN')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full border ${STATUS_COLORS[item.status || 'DRAFT']}`}>
                                                {STATUS_LABELS[item.status || 'DRAFT']}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    href={`/sanxuat/mo/${item.id}/detail`}
                                                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-400 hover:text-blue-600 hover:shadow-sm border border-zinc-100 dark:border-zinc-700 transition-all font-bold"
                                                    title="Chi tiết"
                                                >
                                                    <Eye size={18} />
                                                </Link>
                                                {canManage && (
                                                    <>
                                                        <Link
                                                            href={`/sanxuat/mo/${item.id}`}
                                                            className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-400 hover:text-emerald-600 hover:shadow-sm border border-zinc-100 dark:border-zinc-700 transition-all font-bold"
                                                            title="Sửa"
                                                        >
                                                            <Edit2 size={18} />
                                                        </Link>
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-400 hover:text-rose-600 hover:shadow-sm border border-zinc-100 dark:border-zinc-700 transition-all font-bold"
                                                            title="Xóa"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmDialog
                isOpen={!!deleteConfirmId}
                title="Xóa Lệnh Sản Xuất"
                message="Bạn có chắc chắn muốn xóa Lệnh Sản Xuất (MO) này không? Hành động này không thể hoàn tác."
                confirmText="XÓA NGAY"
                cancelText="HỦY BỎ"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </div>
    )
}
