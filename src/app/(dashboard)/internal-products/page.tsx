'use client'
import React, { useState, useMemo } from 'react'
import {
    PackageSearch,
    Search,
    Edit2,
    Trash2,
    List,
    Settings,
    CheckSquare,
    Square,
    MinusSquare
} from 'lucide-react'
import Protected from '@/components/auth/Protected'
import { Database } from '@/lib/database.types'
import { ProductWithCategory } from '@/components/inventory/types'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import InternalProductModal from '@/components/inventory/internal-products/InternalProductModal'
import { usePathname } from 'next/navigation'
import CodeRulesSettings from '@/components/inventory/internal-products/CodeRulesSettings'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type Product = Database['public']['Tables']['products']['Row']

export default function InternalProductsPage() {
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'list' | 'settings'>('list')
    const [filterStatus, setFilterStatus] = useState<'all' | 'configured' | 'unconfigured'>('all')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [singleDeleteProduct, setSingleDeleteProduct] = useState<ProductWithCategory | null>(null)
    const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const { showToast } = useToast()
    const pathname = usePathname()
    const isSanxuat = pathname?.startsWith('/sanxuat') || false

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

    // Counts for filter pills
    const configuredCount = useMemo(() => {
        return products.filter(p => !!(p.internal_code || p.internal_name)).length
    }, [products])

    const unconfiguredCount = useMemo(() => {
        return products.length - configuredCount
    }, [products, configuredCount])

    // Filter displayed products by status
    const displayedProducts = useMemo(() => {
        return products.filter(item => {
            const hasInternal = !!(item.internal_code || item.internal_name)
            if (filterStatus === 'configured') return hasInternal
            if (filterStatus === 'unconfigured') return !hasInternal
            return true
        })
    }, [products, filterStatus])

    // Products in view that have internal codes configured (can be deleted)
    const selectableInView = useMemo(() => {
        return displayedProducts.filter(item => !!(item.internal_code || item.internal_name))
    }, [displayedProducts])

    const isAllSelected = selectableInView.length > 0 && selectableInView.every(p => selectedIds.has(p.id))
    const isSomeSelected = selectableInView.some(p => selectedIds.has(p.id)) && !isAllSelected

    // Selection handlers
    const handleToggleSelectAll = () => {
        const next = new Set(selectedIds)
        if (isAllSelected) {
            selectableInView.forEach(p => next.delete(p.id))
        } else {
            selectableInView.forEach(p => next.add(p.id))
        }
        setSelectedIds(next)
    }

    const handleToggleSelect = (id: string) => {
        const next = new Set(selectedIds)
        if (next.has(id)) {
            next.delete(id)
        } else {
            next.add(id)
        }
        setSelectedIds(next)
    }

    const handleClearSelection = () => {
        setSelectedIds(new Set())
    }

    // Single delete handler
    const handleConfirmSingleDelete = async () => {
        if (!singleDeleteProduct) return

        setIsDeleting(true)
        try {
            const { error } = await (supabase as any)
                .from('products')
                .update({
                    internal_code: null,
                    internal_name: null,
                    internal_lvl1_id: null,
                    internal_lvl2_id: null,
                    internal_lvl3_id: null,
                    internal_lvl4_id: null
                })
                .eq('id', singleDeleteProduct.id)

            if (error) throw error

            showToast(`Đã xóa mã nội bộ của sản phẩm "${singleDeleteProduct.name}"`, 'success')

            if (selectedIds.has(singleDeleteProduct.id)) {
                const next = new Set(selectedIds)
                next.delete(singleDeleteProduct.id)
                setSelectedIds(next)
            }

            refresh()
        } catch (error: any) {
            console.error('Delete internal code error:', error)
            showToast('Lỗi khi xóa mã nội bộ: ' + error.message, 'error')
        } finally {
            setIsDeleting(false)
            setSingleDeleteProduct(null)
        }
    }

    // Bulk delete handler
    const handleConfirmBulkDelete = async () => {
        if (selectedIds.size === 0) return

        setIsDeleting(true)
        const count = selectedIds.size
        try {
            const idsToUpdate = Array.from(selectedIds)
            const { error } = await (supabase as any)
                .from('products')
                .update({
                    internal_code: null,
                    internal_name: null,
                    internal_lvl1_id: null,
                    internal_lvl2_id: null,
                    internal_lvl3_id: null,
                    internal_lvl4_id: null
                })
                .in('id', idsToUpdate)

            if (error) throw error

            showToast(`Đã xóa mã nội bộ của ${count} sản phẩm thành công`, 'success')
            setSelectedIds(new Set())
            refresh()
        } catch (error: any) {
            console.error('Bulk delete internal code error:', error)
            showToast('Lỗi khi xóa hàng loạt: ' + error.message, 'error')
        } finally {
            setIsDeleting(false)
            setIsBulkConfirmOpen(false)
        }
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

            {/* TABS */}
            <div className="flex border-b border-stone-200">
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'list' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}
                >
                    <List size={18} />
                    Danh sách sản phẩm
                </button>
                <Protected permission="product.manage">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'settings' ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-stone-400 hover:text-stone-600 hover:bg-stone-50'}`}
                    >
                        <Settings size={18} />
                        Cài đặt quy tắc mã
                    </button>
                </Protected>
            </div>

            {activeTab === 'list' ? (
                <div className="space-y-6 animate-fade-in pb-16">
                    {/* FILTERS & SEARCH */}
                    <div className="bg-white p-5 rounded-[24px] flex flex-col md:flex-row gap-4 border border-stone-200 shadow-sm items-stretch md:items-center justify-between">
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

                        {/* Filter by status */}
                        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-2xl shrink-0 self-start md:self-auto overflow-x-auto max-w-full">
                            <button
                                onClick={() => setFilterStatus('all')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    filterStatus === 'all'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-stone-500 hover:text-stone-800'
                                }`}
                            >
                                Tất cả ({products.length})
                            </button>
                            <button
                                onClick={() => setFilterStatus('configured')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    filterStatus === 'configured'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-stone-500 hover:text-stone-800'
                                }`}
                            >
                                Đã cài đặt ({configuredCount})
                            </button>
                            <button
                                onClick={() => setFilterStatus('unconfigured')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                                    filterStatus === 'unconfigured'
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-stone-500 hover:text-stone-800'
                                }`}
                            >
                                Chưa thiết lập ({unconfiguredCount})
                            </button>
                        </div>
                    </div>

                    {/* TABLE (Desktop & Mobile Scroll) */}
                    <div className="bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-stone-50/50 border-b border-stone-200">
                                        {!isSanxuat && (
                                            <th className="p-4 w-12 text-center">
                                                <Protected permission="product.manage">
                                                    <button
                                                        type="button"
                                                        onClick={handleToggleSelectAll}
                                                        disabled={selectableInView.length === 0}
                                                        className="p-1 rounded-md text-stone-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                        title={isAllSelected ? "Bỏ chọn tất cả" : `Chọn tất cả ${selectableInView.length} sản phẩm có mã nội bộ`}
                                                    >
                                                        {isAllSelected ? (
                                                            <CheckSquare size={18} className="text-indigo-600" />
                                                        ) : isSomeSelected ? (
                                                            <MinusSquare size={18} className="text-indigo-600" />
                                                        ) : (
                                                            <Square size={18} />
                                                        )}
                                                    </button>
                                                </Protected>
                                            </th>
                                        )}
                                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 w-16">#</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Thông tin Sản phẩm Gốc</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest text-indigo-400">Thông tin Nội bộ</th>
                                        <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={!isSanxuat ? 5 : 4} className="p-20 text-center">
                                                <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                                <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Đang tải...</p>
                                            </td>
                                        </tr>
                                    ) : displayedProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan={!isSanxuat ? 5 : 4} className="p-10">
                                                <EmptyState
                                                    icon={PackageSearch}
                                                    title="Không tìm thấy sản phẩm"
                                                    description="Không có kết quả tìm kiếm nào phù hợp."
                                                />
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedProducts.map((item, index) => {
                                            const hasInternal = !!(item.internal_code || item.internal_name)
                                            const isSelected = selectedIds.has(item.id)
                                            return (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => {
                                                        if (!isSanxuat) handleEdit(item)
                                                    }}
                                                    className={`group border-b border-stone-100 transition-colors ${
                                                        isSelected
                                                            ? 'bg-indigo-50/60'
                                                            : !isSanxuat
                                                            ? 'hover:bg-indigo-50/30 cursor-pointer'
                                                            : 'hover:bg-stone-50/30'
                                                    }`}
                                                >
                                                    {!isSanxuat && (
                                                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <Protected permission="product.manage">
                                                                {hasInternal ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleSelect(item.id)}
                                                                        className="p-1 rounded-md text-stone-400 hover:text-indigo-600 transition-colors"
                                                                        title={isSelected ? "Bỏ chọn" : "Chọn để xóa mã nội bộ"}
                                                                    >
                                                                        {isSelected ? (
                                                                            <CheckSquare size={18} className="text-indigo-600" />
                                                                        ) : (
                                                                            <Square size={18} />
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    <span
                                                                        className="p-1 inline-block text-stone-300 opacity-30 cursor-not-allowed"
                                                                        title="Chưa thiết lập mã nội bộ"
                                                                    >
                                                                        <Square size={18} />
                                                                    </span>
                                                                )}
                                                            </Protected>
                                                        </td>
                                                    )}
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
                                                    <td className="p-5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Protected permission="product.manage">
                                                                {!isSanxuat && (
                                                                    <>
                                                                        <button
                                                                            onClick={(e: React.MouseEvent) => {
                                                                                e.stopPropagation()
                                                                                handleEdit(item)
                                                                            }}
                                                                            className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 hover:shadow-sm border border-stone-100 hover:border-indigo-100 transition-all font-bold opacity-0 group-hover:opacity-100"
                                                                            title="Cập nhật mã nội bộ"
                                                                        >
                                                                            <Edit2 size={18} />
                                                                        </button>
                                                                        {hasInternal && (
                                                                            <button
                                                                                onClick={(e: React.MouseEvent) => {
                                                                                    e.stopPropagation()
                                                                                    setSingleDeleteProduct(item)
                                                                                }}
                                                                                className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-red-600 hover:bg-red-50 hover:shadow-sm border border-stone-100 hover:border-red-100 transition-all font-bold opacity-0 group-hover:opacity-100"
                                                                                title="Xóa mã nội bộ"
                                                                            >
                                                                                <Trash2 size={18} />
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </Protected>
                                                        </div>
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
                                {displayedProducts.length} Kết quả
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <CodeRulesSettings />
            )}

            {/* FLOATING BULK ACTIONS BAR */}
            {!isSanxuat && selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 backdrop-blur-md text-white px-6 py-3.5 rounded-full shadow-2xl border border-stone-700/50 flex items-center gap-6 animate-slide-up max-w-[90vw]">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-400 animate-pulse" />
                        <span className="text-xs sm:text-sm font-bold text-stone-200 whitespace-nowrap">
                            Đã chọn <strong className="text-white font-black text-sm sm:text-base">{selectedIds.size}</strong> mã nội bộ
                        </span>
                    </div>

                    <div className="h-4 w-px bg-stone-700" />

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleClearSelection}
                            className="px-3 py-1.5 text-xs font-bold text-stone-400 hover:text-white hover:bg-stone-800 rounded-xl transition-colors whitespace-nowrap"
                        >
                            Bỏ chọn
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsBulkConfirmOpen(true)}
                            disabled={isDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 active:scale-95 transition-all whitespace-nowrap disabled:opacity-50"
                        >
                            <Trash2 size={15} />
                            Xóa {selectedIds.size} mã đã chọn
                        </button>
                    </div>
                </div>
            )}

            {/* Single Delete Confirm Dialog */}
            <ConfirmDialog
                isOpen={!!singleDeleteProduct}
                title="Xác nhận xóa mã nội bộ"
                message={`Bạn có chắc chắn muốn xóa mã nội bộ của sản phẩm "${singleDeleteProduct?.name}"?\n\n• Mã nội bộ: ${singleDeleteProduct?.internal_code || '---'}\n• Tên nội bộ: ${singleDeleteProduct?.internal_name || '---'}\n\nSau khi xóa, sản phẩm này sẽ trở về trạng thái "Chưa thiết lập".`}
                confirmText="Xóa mã nội bộ"
                cancelText="Hủy bỏ"
                variant="danger"
                onConfirm={handleConfirmSingleDelete}
                onCancel={() => setSingleDeleteProduct(null)}
            />

            {/* Bulk Delete Confirm Dialog */}
            <ConfirmDialog
                isOpen={isBulkConfirmOpen}
                title={`Xác nhận xóa ${selectedIds.size} mã nội bộ`}
                message={`Bạn có chắc chắn muốn xóa mã nội bộ của ${selectedIds.size} sản phẩm đã chọn không?\n\nSau khi xóa, mã nội bộ và tên hiển thị nội bộ của các sản phẩm này sẽ bị xóa bỏ và trở về trạng thái "Chưa thiết lập". Thao tác này không thể hoàn tác.`}
                confirmText={`Xóa ${selectedIds.size} mã nội bộ`}
                cancelText="Hủy bỏ"
                variant="danger"
                onConfirm={handleConfirmBulkDelete}
                onCancel={() => setIsBulkConfirmOpen(false)}
            />

            <InternalProductModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={selectedProduct}
                onSuccess={refresh}
            />
        </div>
    )
}

