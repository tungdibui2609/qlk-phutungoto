'use client'
import React, { useState } from 'react'
import { FileUp, FileText, Search, Plus, Edit2, Trash2, Box, RefreshCw } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { supabase } from '@/lib/supabaseClient'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import { useToast } from '@/components/ui/ToastProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import Link from 'next/link'
import { useSystem } from '@/contexts/SystemContext'
import { getProductDisplayImage } from '@/lib/utils'

export default function BomsPage() {
    const { showToast } = useToast()
    const { systemType } = useSystem()
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    const {
        filteredData: boms,
        loading,
        searchTerm,
        setSearchTerm,
        refresh
    } = useListingData<any>('boms' as any, {
        select: `*, products!boms_product_id_fkey(name, sku, unit, product_media(url, type))`,
        orderBy: { column: 'created_at', ascending: false }
    })

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id)
    }

    const executeDelete = async () => {
        if (!deleteConfirmId) return
        const { error } = await supabase.from('boms' as any).delete().eq('id', deleteConfirmId)
        if (error) {
            showToast('Lỗi khi xóa Định mức: ' + error.message, 'error')
        } else {
            showToast('Đã xóa Định mức thành công', 'success')
            refresh()
        }
        setDeleteConfirmId(null)
    }

    return (
        <div className="space-y-6 animate-fade-in pl-4 pr-4 pt-4">
            <PageHeader
                title="Định mức Vật tư (BOM)"
                subtitle="Bill of Materials"
                description="Quản lý công thức/định mức nguyên liệu để sản xuất ra thành phẩm."
                icon={FileText}
                actionLink="/sanxuat/boms/new"
                actionText="Thêm Định mức"
                permission="sanxuat.manage" // Assuming a generic permission for now
            />

            {/* FILTERS & SEARCH */}
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-[24px] flex flex-col sm:flex-row gap-4 border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo Tên định mức, Mã định mức..."
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
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400 w-16">#</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">Tên Định Mức</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">Thành Phẩm</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400">Số lượng (Base)</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-zinc-400 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Đang tải...</p>
                                    </td>
                                </tr>
                            ) : boms.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10">
                                        <EmptyState
                                            icon={FileText}
                                            title="Không có định mức nào"
                                            description="Hãy bắt đầu tạo Định mức (BOM) đầu tiên cho sản phẩm của bạn."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                boms.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition-colors"
                                    >
                                        <td className="p-5 text-zinc-400 text-xs font-black">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </td>
                                        <td className="p-5">
                                            <p className="font-bold text-zinc-800 dark:text-zinc-100 text-base">{item.name}</p>
                                            {item.code && (
                                                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                                                    {item.code}
                                                </span>
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
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                {item.quantity} {item.products?.unit || ''}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    href={`/sanxuat/boms/${item.id}`}
                                                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-400 hover:text-emerald-600 hover:shadow-sm border border-zinc-100 dark:border-zinc-700 transition-all font-bold"
                                                >
                                                    <Edit2 size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 text-zinc-400 hover:text-red-600 hover:shadow-sm border border-zinc-100 dark:border-zinc-700 transition-all font-bold"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
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
                title="Xóa Định Mức (BOM)"
                message="Bạn có chắc chắn muốn xóa định mức này không? Các lệnh sản xuất đang dùng định mức này có thể bị ảnh hưởng."
                confirmText="XÓA NGAY"
                cancelText="HỦY BỎ"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />
        </div>
    )
}
