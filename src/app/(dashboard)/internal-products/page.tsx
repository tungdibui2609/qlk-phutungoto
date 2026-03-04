'use client'
import React, { useState } from 'react'
import { PackageSearch, Search, Edit2 } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { Database } from '@/lib/database.types'
import { ProductWithCategory } from '@/components/inventory/types'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import InternalProductModal from '@/components/inventory/internal-products/InternalProductModal'

type Product = Database['public']['Tables']['products']['Row']

export default function InternalProductsPage() {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    const {
        filteredData: products,
        loading,
        searchTerm,
        setSearchTerm,
        refresh
    } = useListingData<ProductWithCategory>('products', {
        select: `*, categories ( name )`,
        orderBy: { column: 'created_at', ascending: false }
    })

    const handleEdit = (product: ProductWithCategory) => {
        setSelectedProduct(product as any)
        setIsModalOpen(true)
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sản phẩm nội bộ"
                subtitle="Internal Products"
                description="Ánh xạ mã và tên sản phẩm gốc sang mã nội bộ dùng riêng cho hệ thống xưởng"
                icon={PackageSearch}
                permission="product.manage"
            />

            {/* FILTERS & SEARCH */}
            <div className="bg-white p-5 rounded-[24px] flex flex-col sm:flex-row gap-4 border border-stone-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo Tên, Mã gốc, hoặc Mã nội bộ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all font-medium"
                    />
                </div>
            </div>

            {/* TABLE (Desktop & Mobile Scroll) */}
            <div className="bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-stone-50/50 border-b border-stone-200">
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 w-16">#</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Thông tin Sản phẩm Gốc</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-indigo-400">Thông tin Nội bộ</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center">
                                        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Đang tải...</p>
                                    </td>
                                </tr>
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-10">
                                        <EmptyState
                                            icon={PackageSearch}
                                            title="Không tìm thấy sản phẩm"
                                            description="Không có kết quả tìm kiếm nào phù hợp."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                products.map((item, index) => {
                                    const hasInternal = !!(item.internal_code || item.internal_name)
                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => handleEdit(item)}
                                            className="group border-b border-stone-100 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                                        >
                                            <td className="p-5 text-stone-400 text-xs font-black">
                                                {(index + 1).toString().padStart(2, '0')}
                                            </td>
                                            <td className="p-5">
                                                <div>
                                                    <p className="font-bold text-stone-800 text-base line-clamp-1">{item.name}</p>
                                                    <div className="flex gap-2 mt-2 flex-wrap">
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                                                            {item.sku}
                                                        </span>
                                                        {item.part_number && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-stone-100 text-stone-500 border border-stone-200">
                                                                {item.part_number}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                {hasInternal ? (
                                                    <div>
                                                        <p className="font-bold text-indigo-700 text-base line-clamp-1">{item.internal_name || '---'}</p>
                                                        {item.internal_code && (
                                                            <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm shadow-indigo-500/5">
                                                                {item.internal_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-stone-400 italic">Chưa thiết lập</span>
                                                )}
                                            </td>
                                            <td className="p-5 text-right flex justify-end">
                                                <Protected permission="product.manage">
                                                    <button
                                                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleEdit(item); }}
                                                        className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm border border-stone-100 hover:border-indigo-100 transition-all font-bold opacity-0 group-hover:opacity-100"
                                                        title="Cập nhật mã nội bộ"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                </Protected>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-8 py-5 flex justify-between items-center bg-stone-50/50 border-t border-stone-200">
                    <div className="text-[11px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
                        {products.length} Kết quả
                    </div>
                </div>
            </div>

            <InternalProductModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={selectedProduct}
                onSuccess={refresh}
            />
        </div>
    )
}
