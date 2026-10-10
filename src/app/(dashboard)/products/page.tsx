'use client'
import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Package, Search, Edit, Trash2, Eye, Filter, FileSpreadsheet } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { exportProductsToExcel } from '@/lib/productExcelExport'
import Protected from '@/components/auth/Protected'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import ProductDetailModal from '@/components/inventory/ProductDetailModal'
import ProductImportModal from '@/components/inventory/ProductImportModal'
import { Database } from '@/lib/database.types'
import MobileProductList from '@/components/inventory/MobileProductList'
import { ProductWithCategory } from '@/components/inventory/types'
import { getProductDisplayImage } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import EmptyState from '@/components/ui/EmptyState'
import { useListingData } from '@/hooks/useListingData'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Product = Database['public']['Tables']['products']['Row']

export default function InventoryPage() {
    const { showToast, showConfirm } = useToast()
    const { systemType } = useSystem()
    const { companyInfo } = usePrintCompanyInfo()
    const [categories, setCategories] = useState<any[]>([])
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [unitsMap, setUnitsMap] = useState<Record<string, string>>({})
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const pathname = usePathname()
    const isSanxuat = pathname.startsWith('/sanxuat')
    const [exporting, setExporting] = useState(false)

    // Multi-select & Bulk Delete State
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false)
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)

    // Excel Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false)

    const handleExportExcel = async () => {
        if (displayedProducts.length === 0) return
        setExporting(true)
        try {
            await exportProductsToExcel({
                products: displayedProducts,
                unitsMap,
                companyInfo,
                systemType: 'dashboard'
            })
            showToast('Xuất Excel danh sách sản phẩm thành công', 'success')
        } catch (error: any) {
            showToast('Lỗi khi xuất Excel: ' + error.message, 'error')
        } finally {
            setExporting(false)
        }
    }

    // Load Units dictionary & Categories
    useEffect(() => {
        if (!systemType) return
        async function fetchCommonData() {
            const [unitsRes, catsRes] = await Promise.all([
                supabase.from('units').select('id, name'),
                supabase.from('categories').select('id, name').eq('system_type', systemType).order('name')
            ])

            if (unitsRes.data) {
                const uMap: Record<string, string> = {}
                unitsRes.data.forEach((u: any) => uMap[u.id] = u.name)
                setUnitsMap(uMap)
            }
            if (catsRes.data) {
                setCategories(catsRes.data)
            }
        }
        fetchCommonData()
    }, [systemType])

    const {
        filteredData: products,
        loading,
        searchTerm,
        setSearchTerm,
        refresh
    } = useListingData<ProductWithCategory>('products', {
        select: `*, categories(id, name), product_category_rel(category_id, is_primary, categories(id, name)), product_media ( url, type ), product_units ( conversion_rate, unit_id )`,
        orderBy: { column: 'created_at', ascending: false }
    })

    const displayedProducts = React.useMemo(() => {
        if (selectedCategory === 'all') return products
        return products.filter(p => {
             // Check if product is in selected category via n-n relation or legacy field
             const rels = p.product_category_rel || []
             const matchesRel = rels.some(r => r.category_id === selectedCategory || r.categories?.id === selectedCategory)
             return matchesRel || p.category_id === selectedCategory
        })
    }, [products, selectedCategory])

    const handleViewProduct = (product: ProductWithCategory) => {
        setSelectedProduct(product as any)
        setIsModalOpen(true)
    }

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id)
    }

    const executeDelete = async () => {
        if (!deleteConfirmId) return
        try {
            await supabase.from('product_category_rel').delete().eq('product_id', deleteConfirmId)
            await (supabase.from('product_units') as any).delete().eq('product_id', deleteConfirmId)
            await (supabase.from('product_media') as any).delete().eq('product_id', deleteConfirmId)
            // Ngắt liên kết ràng buộc khóa ngoại trước khi xóa
            await (supabase.from('production_loans') as any).update({ product_id: null }).eq('product_id', deleteConfirmId)
            await (supabase.from('lots') as any).update({ product_id: null }).eq('product_id', deleteConfirmId)

            const { error } = await supabase.from('products').delete().eq('id', deleteConfirmId)
            if (error) throw error

            showToast('Đã xóa thành công', 'success')
            selectedProductIds.delete(deleteConfirmId)
            setSelectedProductIds(new Set(selectedProductIds))
            refresh()
        } catch (error: any) {
            console.warn('Delete error:', error)
            const msg = error?.message?.includes('foreign key constraint')
                ? 'Không thể xóa vì sản phẩm này đang có dữ liệu nghiệp vụ ràng buộc.'
                : (error?.message || 'Không thể xóa sản phẩm')
            showToast('Lỗi khi xóa: ' + msg, 'error')
        } finally {
            setDeleteConfirmId(null)
        }
    }

    const isAllSelected = displayedProducts.length > 0 && displayedProducts.every(p => selectedProductIds.has(p.id))
    const isSomeSelected = displayedProducts.some(p => selectedProductIds.has(p.id)) && !isAllSelected

    const toggleSelectAll = () => {
        if (isAllSelected) {
            setSelectedProductIds(new Set())
        } else {
            const next = new Set<string>()
            displayedProducts.forEach(p => next.add(p.id))
            setSelectedProductIds(next)
        }
    }

    const toggleSelectProduct = (id: string) => {
        setSelectedProductIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const clearSelection = () => {
        setSelectedProductIds(new Set())
    }

    const executeBulkDelete = async () => {
        if (selectedProductIds.size === 0) return
        setIsBulkDeleting(true)
        const idList = Array.from(selectedProductIds)

        try {
            const CHUNK_SIZE = 50
            for (let i = 0; i < idList.length; i += CHUNK_SIZE) {
                const chunk = idList.slice(i, i + CHUNK_SIZE)
                // 1. Dọn dẹp liên kết trực tiếp
                await supabase.from('product_category_rel').delete().in('product_id', chunk)
                await (supabase.from('product_units') as any).delete().in('product_id', chunk)
                await (supabase.from('product_media') as any).delete().in('product_id', chunk)

                // 2. Ngắt liên kết khóa ngoại với các bảng nghiệp vụ (phiếu mượn sản xuất, lô kho...)
                await (supabase.from('production_loans') as any).update({ product_id: null }).in('product_id', chunk)
                await (supabase.from('lots') as any).update({ product_id: null }).in('product_id', chunk)

                // 3. Xóa sản phẩm
                const { error } = await supabase.from('products').delete().in('id', chunk)
                if (error) throw error
            }

            showToast(`Đã xóa thành công ${idList.length} sản phẩm!`, 'success')
            clearSelection()
            refresh()
        } catch (error: any) {
            console.warn('Bulk delete error:', error)
            const msg = error?.message?.includes('foreign key constraint')
                ? 'Một số sản phẩm không thể xóa do có dữ liệu nghiệp vụ ràng buộc.'
                : (error?.message || 'Không thể xóa các sản phẩm đã chọn')
            showToast('Lỗi khi xóa sản phẩm: ' + msg, 'error')
        } finally {
            setIsBulkDeleting(false)
            setIsBulkDeleteConfirmOpen(false)
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Sản phẩm"
                subtitle="Products"
                description="Quản lý danh mục và thông tin linh kiện, phụ tùng"
                icon={Package}
                actionLink={!isSanxuat ? "/products/new" : undefined}
                actionText={!isSanxuat ? "Thêm Sản phẩm" : undefined}
                permission="product.manage"
            />

            {/* FILTERS & SEARCH */}
            <div className="bg-white p-5 rounded-[24px] flex flex-col sm:flex-row gap-4 border border-stone-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                    <input
                        type="text"
                        placeholder="Tìm kiếm theo Tên, SKU, Mã phụ tùng..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all font-medium"
                    />
                </div>

                <div className="relative min-w-[200px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Filter size={18} className="text-stone-400" />
                    </div>
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="w-full pl-10 pr-8 py-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-800 focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100 transition-all font-bold appearance-none cursor-pointer"
                    >
                        <option value="all">Tất cả danh mục</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                <Protected permission="product.manage">
                    {!isSanxuat && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            className="px-6 py-3 rounded-2xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 active:scale-95 transition-all font-bold flex items-center justify-center gap-2 shadow-sm min-w-[140px]"
                        >
                            <FileSpreadsheet size={20} className="text-orange-500" />
                            <span>Nạp Excel</span>
                        </button>
                    )}
                </Protected>

                <button
                    onClick={handleExportExcel}
                    disabled={exporting || displayedProducts.length === 0}
                    className="px-6 py-3 rounded-2xl bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 active:scale-95 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm min-w-[140px]"
                >
                    <FileSpreadsheet size={20} className="text-green-600" />
                    {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                </button>
            </div>

            {/* TABLE (Desktop) */}
            <div className="hidden md:block bg-white rounded-[32px] overflow-hidden border border-stone-200 shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-stone-50/50 border-b border-stone-200">
                                <th className="p-5 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        ref={el => {
                                            if (el) el.indeterminate = isSomeSelected;
                                        }}
                                        onChange={toggleSelectAll}
                                        aria-label="Chọn tất cả sản phẩm"
                                        className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                                    />
                                </th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 w-16">#</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Thông tin Sản phẩm</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400">Danh mục</th>
                                <th className="p-5 text-xs font-black uppercase tracking-widest text-stone-400 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-20 text-center">
                                        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                        <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Đang tải...</p>
                                    </td>
                                </tr>
                            ) : displayedProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10">
                                        <EmptyState
                                            icon={Package}
                                            title="Không tìm thấy sản phẩm"
                                            description={searchTerm || selectedCategory !== 'all' ? `Không có kết quả nào phù hợp` : "Hãy bắt đầu thêm sản phẩm của bạn."}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                displayedProducts.map((item, index) => {
                                    const isSelected = selectedProductIds.has(item.id);
                                    return (
                                        <tr
                                            key={item.id}
                                            onClick={() => handleViewProduct(item)}
                                            className={`group border-b border-stone-100 transition-colors cursor-pointer ${
                                                isSelected
                                                    ? 'bg-orange-50/70 hover:bg-orange-100/60'
                                                    : 'hover:bg-orange-50/30'
                                            }`}
                                        >
                                            <td className="p-5 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectProduct(item.id)}
                                                    aria-label={`Chọn sản phẩm ${item.name}`}
                                                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 cursor-pointer accent-orange-600"
                                                />
                                            </td>
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
                                                                    1 {unitsMap[u.unit_id] || '---'} = {parseFloat(Number(u.conversion_rate).toFixed(3))} {item.unit}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-wrap gap-1">
                                                    {(item.product_category_rel && item.product_category_rel.length > 0) ? (
                                                        item.product_category_rel
                                                            .sort((a: any, b: any) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
                                                            .map((rel: any, idx: number) => (
                                                                <span 
                                                                    key={idx} 
                                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${
                                                                        rel.is_primary 
                                                                            ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                                                            : 'bg-stone-100 text-stone-500 border-stone-200'
                                                                    }`}
                                                                    title={rel.is_primary ? 'Danh mục chính' : 'Danh mục phụ'}
                                                                >
                                                                    {rel.categories?.name}
                                                                </span>
                                                            ))
                                                    ) : item.categories?.name ? (
                                                        <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wider border border-orange-200">
                                                            {item.categories.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-stone-400 text-[10px] italic">Chưa phân loại</span>
                                                    )}
                                                </div>
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
                                                        {!isSanxuat && (
                                                            <Link
                                                                href={`/products/${item.id}`}
                                                                className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-orange-600 hover:shadow-sm border border-stone-100 hover:border-orange-100 transition-all font-bold"
                                                                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                                                            >
                                                                <Edit size={18} />
                                                            </Link>
                                                        )}
                                                        {!isSanxuat && (
                                                            <button
                                                                onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDelete(item.id); }}
                                                                className="p-2.5 rounded-xl bg-white text-stone-400 hover:text-red-600 hover:shadow-sm border border-stone-100 hover:border-red-100 transition-all font-bold"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </Protected>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-8 py-5 flex justify-between items-center bg-stone-50/50 border-t border-stone-200">
                    <div className="text-[11px] font-black uppercase tracking-widest text-stone-400 bg-stone-100 px-3 py-1 rounded-full">
                        {displayedProducts.length} Kết quả
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
                        products={displayedProducts}
                        unitsMap={unitsMap}
                        onView={handleViewProduct}
                        onDelete={!isSanxuat ? handleDelete : () => { }}
                        showActions={!isSanxuat}
                        selectedIds={selectedProductIds}
                        onToggleSelect={toggleSelectProduct}
                    />
                )}
            </div>

            {/* Floating Bulk Action Bar */}
            {selectedProductIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-stone-900/95 backdrop-blur text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 border border-stone-700/60 max-w-[92vw]">
                    <div className="flex items-center gap-2 font-bold text-sm">
                        <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs flex items-center justify-center font-black">
                            {selectedProductIds.size}
                        </span>
                        <span className="whitespace-nowrap">Đã chọn {selectedProductIds.size}</span>
                    </div>
                    <div className="h-4 w-px bg-stone-700" />
                    <button
                        onClick={clearSelection}
                        className="text-xs font-bold text-stone-300 hover:text-white transition-colors px-2 py-1 whitespace-nowrap"
                    >
                        Bỏ chọn
                    </button>
                    <Protected permission="product.manage">
                        {!isSanxuat && (
                            <button
                                onClick={() => setIsBulkDeleteConfirmOpen(true)}
                                disabled={isBulkDeleting}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-red-600/30 active:scale-95 disabled:opacity-50 whitespace-nowrap"
                            >
                                <Trash2 size={15} />
                                {isBulkDeleting ? 'Đang xóa...' : `Xóa (${selectedProductIds.size})`}
                            </button>
                        )}
                    </Protected>
                </div>
            )}

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

            <ConfirmDialog
                isOpen={isBulkDeleteConfirmOpen}
                title="Xóa nhiều sản phẩm"
                message={`Bạn có chắc chắn muốn xóa ${selectedProductIds.size} sản phẩm đã chọn không? Toàn bộ quy đổi đơn vị và liên kết danh mục của các sản phẩm này cũng sẽ bị xóa vĩnh viễn.`}
                confirmText={isBulkDeleting ? "ĐANG XÓA..." : `XÓA ${selectedProductIds.size} SẢN PHẨM`}
                cancelText="HỦY BỎ"
                variant="danger"
                onConfirm={executeBulkDelete}
                onCancel={() => {
                    if (!isBulkDeleting) setIsBulkDeleteConfirmOpen(false);
                }}
            />

            <ProductImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    refresh();
                    clearSelection();
                }}
            />

            <ProductDetailModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                product={selectedProduct}
            />
        </div>
    )
}
