'use client'
import React, { useState, useMemo } from 'react'
import { Sparkles, Search, Edit2, Tag, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { Database } from '@/lib/database.types'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import ProductAliasModal from '@/components/inventory/product-aliases/ProductAliasModal'

type Product = Database['public']['Tables']['products']['Row'] & {
    aliases?: string | null
    part_number?: string | null
    internal_code?: string | null
    internal_name?: string | null
    categories?: { name: string } | null
}

export default function ProductAliasesPage() {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [filterStatus, setFilterStatus] = useState<'all' | 'has_alias' | 'no_alias'>('all')

    const {
        data: allProducts,
        filteredData: products,
        loading,
        searchTerm,
        setSearchTerm,
        refresh
    } = useListingData<Product>('products', {
        select: `*, categories ( name )`,
        orderBy: { column: 'created_at', ascending: false }
    })

    const handleEdit = (product: Product) => {
        setSelectedProduct(product)
        setIsModalOpen(true)
    }

    // Thống kê nhanh
    const stats = useMemo(() => {
        const total = allProducts.length
        const hasAlias = allProducts.filter(p => !!p.aliases && p.aliases.trim().length > 0).length
        const noAlias = total - hasAlias
        return { total, hasAlias, noAlias }
    }, [allProducts])

    // Lọc theo trạng thái đã cài / chưa cài gõ tắt
    const displayedProducts = useMemo(() => {
        if (filterStatus === 'has_alias') {
            return products.filter(p => !!p.aliases && p.aliases.trim().length > 0)
        }
        if (filterStatus === 'no_alias') {
            return products.filter(p => !p.aliases || p.aliases.trim().length === 0)
        }
        return products
    }, [products, filterStatus])

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            <PageHeader
                title="Tên gõ tắt sản phẩm"
                subtitle="Product Aliases & Shortcuts"
                description="Cài đặt từ khóa gõ tắt để tìm kiếm siêu tốc trên toàn hệ thống (Sơ đồ kho, Lô hàng, Nhập/Xuất kho)"
                icon={Sparkles}
                permission="product.manage"
            />

            {/* STATS OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        filterStatus === 'all'
                            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 shadow-sm'
                            : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                >
                    <div className="text-[11px] font-black uppercase tracking-wider text-stone-500">Tổng sản phẩm</div>
                    <div className="text-2xl font-black text-stone-900 mt-1">{stats.total}</div>
                    <div className="text-xs text-stone-400 mt-0.5 font-medium">Toàn bộ danh mục</div>
                </button>

                <button
                    type="button"
                    onClick={() => setFilterStatus('has_alias')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        filterStatus === 'has_alias'
                            ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/20 shadow-sm'
                            : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                >
                    <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                        <CheckCircle2 size={13} />
                        Đã có tên gõ tắt
                    </div>
                    <div className="text-2xl font-black text-emerald-800 mt-1">{stats.hasAlias}</div>
                    <div className="text-xs text-emerald-600/80 mt-0.5 font-medium">
                        {stats.total > 0 ? `${Math.round((stats.hasAlias / stats.total) * 100)}% danh mục` : '0%'}
                    </div>
                </button>

                <button
                    type="button"
                    onClick={() => setFilterStatus('no_alias')}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                        filterStatus === 'no_alias'
                            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/20 shadow-sm'
                            : 'bg-white border-stone-200 hover:bg-stone-50'
                    }`}
                >
                    <div className="text-[11px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                        <AlertCircle size={13} />
                        Chưa thiết lập
                    </div>
                    <div className="text-2xl font-black text-amber-800 mt-1">{stats.noAlias}</div>
                    <div className="text-xs text-amber-600/80 mt-0.5 font-medium">Cần bổ sung thêm</div>
                </button>
            </div>

            {/* SEARCH & FILTERS */}
            <div className="bg-white p-4 sm:p-5 rounded-[24px] flex flex-col sm:flex-row items-center gap-4 border border-stone-200 shadow-sm">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo Tên sản phẩm, Mã SKU, Mã nội bộ hoặc Từ gõ tắt..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all font-medium text-sm"
                    />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => refresh()}
                        className="px-4 py-3 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors font-bold text-xs flex items-center gap-1.5"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw size={15} />
                        <span>Làm mới</span>
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-stone-50/70 border-b border-stone-200">
                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-stone-400 w-14">#</th>
                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Sản phẩm gốc</th>
                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-stone-400">Mã Nội Bộ</th>
                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-amber-700">Tên gõ tắt đã cài (Aliases)</th>
                                <th className="p-4 text-[11px] font-black uppercase tracking-widest text-stone-400 text-right w-24">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-16 text-center">
                                        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                                        <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Đang tải danh sách sản phẩm...</p>
                                    </td>
                                </tr>
                            ) : displayedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12">
                                        <EmptyState
                                            icon={Tag}
                                            title="Không tìm thấy sản phẩm"
                                            description="Không có sản phẩm nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm."
                                        />
                                    </td>
                                </tr>
                            ) : (
                                displayedProducts.map((item, index) => {
                                    const aliasList = item.aliases
                                        ? item.aliases.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
                                        : []

                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => handleEdit(item)}
                                            className="group hover:bg-amber-50/20 transition-colors cursor-pointer"
                                        >
                                            <td className="p-4 text-stone-400 text-xs font-black">
                                                {(index + 1).toString().padStart(2, '0')}
                                            </td>
                                            <td className="p-4">
                                                <div>
                                                    <p className="font-bold text-stone-900 text-sm leading-snug line-clamp-2">
                                                        {item.name}
                                                    </p>
                                                    <div className="flex gap-2 mt-1.5 flex-wrap items-center">
                                                        <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-stone-100 text-stone-600 border border-stone-200">
                                                            {item.sku || 'Chưa có SKU'}
                                                        </span>
                                                        {item.part_number && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded-md font-medium text-stone-500 bg-stone-50 border border-stone-200">
                                                                NSX: {item.part_number}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {(item as any).internal_code || (item as any).internal_name ? (
                                                    <div>
                                                        <p className="font-bold text-indigo-700 text-xs truncate max-w-[200px]">
                                                            {(item as any).internal_name || '---'}
                                                        </p>
                                                        {(item as any).internal_code && (
                                                            <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                                {(item as any).internal_code}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-stone-300 font-bold italic">---</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                {aliasList.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5 max-w-xl">
                                                        {aliasList.map((al, alIdx) => (
                                                            <span
                                                                key={alIdx}
                                                                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 font-bold text-xs"
                                                            >
                                                                {al}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-bold text-stone-400 italic">
                                                        Chưa thiết lập (Bấm để gán)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                <Protected permission="product.manage">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEdit(item)
                                                        }}
                                                        className="p-2 rounded-xl bg-white text-stone-400 hover:text-amber-700 hover:bg-amber-50 border border-stone-200 hover:border-amber-200 transition-all font-bold group-hover:border-amber-300 shadow-xs"
                                                        title="Chỉnh sửa tên gõ tắt"
                                                    >
                                                        <Edit2 size={16} />
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

                <div className="px-6 py-4 flex justify-between items-center bg-stone-50/70 border-t border-stone-200 text-xs">
                    <div className="font-bold text-stone-500">
                        Hiển thị {displayedProducts.length} trên tổng số {stats.total} sản phẩm
                    </div>
                </div>
            </div>

            <ProductAliasModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={selectedProduct}
                onSuccess={refresh}
            />
        </div>
    )
}
