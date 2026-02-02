'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Package, Search, Edit, Trash2, Eye, Filter } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import Protected from '@/components/auth/Protected'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import ProductDetailModal from '@/components/inventory/ProductDetailModal'
import { Database } from '@/lib/database.types'
import MobileProductList from '@/components/inventory/MobileProductList'
import { ProductWithCategory } from '@/components/inventory/types'
import { getProductDisplayImage } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import Link from 'next/link'

type Product = Database['public']['Tables']['products']['Row']

export default function InventoryPage() {
    const { showToast, showConfirm } = useToast()
    const [unitsMap, setUnitsMap] = useState<Record<string, string>>({})
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Load Units dictionary
    useEffect(() => {
        async function fetchUnits() {
            const { data } = await supabase.from('units').select('id, name')
            if (data) {
                const uMap: Record<string, string> = {}
                data.forEach((u: any) => uMap[u.id] = u.name)
                setUnitsMap(uMap)
            }
        }
        fetchUnits()
    }, [])

    const {
        filteredData: products,
        loading,
        searchTerm,
        setSearchTerm,
        refresh
    } = useListingData<ProductWithCategory>('products', {
        select: `*, categories ( name ), product_media ( url, type ), product_units ( conversion_rate, unit_id )`,
        orderBy: { column: 'created_at', ascending: false }
    })

    const handleViewProduct = (product: ProductWithCategory) => {
        setSelectedProduct(product as any)
        setIsModalOpen(true)
    }

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id)
    }

    const executeDelete = async () => {
        if (!deleteConfirmId) return
        const { error } = await supabase.from('products').delete().eq('id', deleteConfirmId)
        if (error) {
            showToast('Lỗi khi xóa: ' + error.message, 'error')
        } else {
            showToast('Đã xóa thành công', 'success')
            refresh()
        }
        setDeleteConfirmId(null)
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sản phẩm"
                subtitle="Products"
                description="Quản lý danh mục và thông tin linh kiện, phụ tùng"
                icon={Package}
                actionLink="/products/new"
                actionText="Thêm Sản phẩm"
                permission="product.manage"
            />

            {/* FILTERS & SEARCH */}
            <div className="bg-white p-5 rounded-[24px] flex flex-col sm:flex-row gap-4 border border-stone-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo Tên, SKU, Mã phụ tùng, danh mục..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all font-medium"
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-stone-600 font-bold bg-stone-50 border border-stone-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-600 transition-all">
                    <Filter size={18} />
                    BỘ LỌC
                </button>
            </div>

            {/* TABLE (Desktop) */}
            <div className="hidden md:block bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-stone-50/50 border-b border-stone-200">
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 w-16">#</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Thông tin Sản phẩm</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Danh mục</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Đang tải...</p>
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-10">
                                        <EmptyState
                                            icon={Package}
                                            title="Không tìm thấy sản phẩm"
                                            description={searchTerm ? `Không có kết quả nào cho "${searchTerm}"` : "Hãy bắt đầu thêm sản phẩm của bạn."}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                products.map((item, index) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => handleViewProduct(item)}
                                        className="group border-b border-stone-100 hover:bg-orange-50/30 transition-colors cursor-pointer"
                                    >
                                        <td className="p-5 text-stone-400 text-xs font-black">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-5">
                                                <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center bg-stone-100 overflow-hidden border border-stone-200/50 shadow-inner">
                                                    {getProductDisplayImage(item) ? (
                                                        <img
                                                            src={getProductDisplayImage(item)!}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <Package className="text-stone-300" size={30} />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-stone-800 text-base line-clamp-1">{item.name}</p>
                                                    <div className="flex gap-2 mt-2 flex-wrap">
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-orange-100 text-orange-700 border border-orange-200 shadow-sm shadow-orange-500/5">
                                                            {item.sku}
                                                        </span>
                                                        {item.part_number && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-stone-100 text-stone-500 border border-stone-200">
                                                                {item.part_number}
                                                            </span>
                                                        )}
                                                        {item.unit && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100">
                                                                1 {item.unit}
                                                            </span>
                                                        )}
                                                        {item.product_units?.slice(0, 2).map((u, idx) => (
                                                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-indigo-50 text-indigo-500 border border-indigo-100">
                                                                1 {unitsMap[u.unit_id] || '---'} = {u.conversion_rate} {item.unit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <span className="px-3 py-1 rounded-full bg-stone-100 text-stone-600 text-[11px] font-bold uppercase tracking-wider">
                                                {item.categories?.name || 'Chưa phân loại'}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleViewProduct(item); }}
                                                    className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-blue-600 hover:shadow-sm border border-stone-100 hover:border-blue-100 transition-all font-bold"
                                                    title="Xem chi tiết"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                                <Protected permission="product.manage">
                                                    <Link
                                                        href={`/products/${item.id}`}
                                                        className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-orange-600 hover:shadow-sm border border-stone-100 hover:border-orange-100 transition-all font-bold"
                                                        onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                    >
                                                        <Edit size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(item.id); }}
                                                        className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-red-600 hover:shadow-sm border border-stone-100 hover:border-red-100 transition-all font-bold"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </Protected>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-8 py-5 flex justify-between items-center bg-stone-50/50 border-t border-stone-200">
                    <div className="text-[11px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
                        {products.length} Kết quả
                    </div>
                    <div className="flex gap-2">
                        <button className="px-5 py-2 rounded-xl bg-white text-stone-300 border border-stone-200 text-xs font-bold uppercase cursor-not-allowed" disabled>Trước</button>
                        <button className="px-5 py-2 rounded-xl bg-white text-stone-300 border border-stone-200 text-xs font-bold uppercase cursor-not-allowed" disabled>Sau</button>
                    </div>
                </div>
            </div>

            {/* LIST (Mobile) */}
            <div className="md:hidden">
                {loading ? (
                    <div className="p-20 text-center">
                        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    </div>
                ) : (
                    <MobileProductList
                        products={products}
                        unitsMap={unitsMap}
                        onView={handleViewProduct}
                        onDelete={handleDelete}
                    />
                )}
            </div>

            <ConfirmDialog
                isOpen={!!deleteConfirmId}
                title="Xóa sản phẩm"
                message="Bạn có chắc chắn muốn xóa sản phẩm này không? Hành động này không thể hoàn tác."
                confirmText="XÓA NGAY"
                cancelText="HỦY BỎ"
                variant="danger"
                onConfirm={executeDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />

            <ProductDetailModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={selectedProduct}
            />
        </div>
    )
}
