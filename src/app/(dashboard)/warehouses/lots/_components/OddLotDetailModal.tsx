'use client'

import React, { useState, useMemo } from 'react'
import {
    X,
    FileSpreadsheet,
    Combine,
    ArrowRight,
    Package,
    Search,
    Filter,
    CheckSquare,
    Square,
    AlertCircle,
    Warehouse,
    Tag,
    Copy,
    Check
} from 'lucide-react'
import { Lot } from '../_hooks/useLotManagement'
import { decodeSTT } from '@/lib/numberUtils'
import { exportSingleProductOddLotsToExcel, getLotTagsString } from '@/lib/oddLotExcelExport'
import { useSystem } from '@/contexts/SystemContext'

export interface OddLotItem {
    id: string
    code: string
    daily_seq: number | null
    quantity: number
    lot: Lot
    location: string
    unit: string
    lotItemId: string
}

export interface OddLotSuggestionData {
    productId: string
    productName: string
    productSku: string
    quantityPerPallet: number
    productUnit: string
    suggestedLots: OddLotItem[]
}

interface OddLotDetailModalProps {
    isOpen: boolean
    onClose: () => void
    suggestion: OddLotSuggestionData | null
    checkedItemIds: string[]
    onToggleItem: (productId: string, lotItemId: string) => void
    onToggleAll: (productId: string, itemIds: string[]) => void
    onMerge: (targetLot: Lot, sourceLotIds: string[], sourceLots: Lot[]) => void
}

export function OddLotDetailModal({
    isOpen,
    onClose,
    suggestion,
    checkedItemIds,
    onToggleItem,
    onToggleAll,
    onMerge
}: OddLotDetailModalProps) {
    const { currentSystem } = useSystem()
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all')
    const [isExporting, setIsExporting] = useState(false)
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    if (!isOpen || !suggestion) return null

    // Danh sách tất cả các tag xuất hiện trong các lô lẻ của sản phẩm này
    const availableTags = useMemo(() => {
        const tagSet = new Set<string>()
        let hasNoTag = false

        suggestion.suggestedLots.forEach(item => {
            const productItemIds = item.lot.lot_items
                ?.filter(i => i.product_id === suggestion.productId)
                ?.map(i => i.id) || []

            const itemTags = item.lot.lot_tags?.filter(t => t.lot_item_id && productItemIds.includes(t.lot_item_id)) || []

            if (itemTags.length > 0) {
                itemTags.forEach(t => tagSet.add(t.tag))
            } else {
                hasNoTag = true
            }
        })

        return {
            tags: Array.from(tagSet),
            hasNoTag
        }
    }, [suggestion])

    // Lọc danh sách lô theo từ khóa tìm kiếm và tag được chọn
    const filteredLots = useMemo(() => {
        return suggestion.suggestedLots.filter(item => {
            // Lọc theo tag
            if (selectedTagFilter !== 'all') {
                const productItemIds = item.lot.lot_items
                    ?.filter(i => i.product_id === suggestion.productId)
                    ?.map(i => i.id) || []
                const itemTags = item.lot.lot_tags?.filter(t => t.lot_item_id && productItemIds.includes(t.lot_item_id)) || []

                if (selectedTagFilter === '__no_tag__') {
                    if (itemTags.length > 0) return false
                } else {
                    if (!itemTags.some(t => t.tag === selectedTagFilter)) return false
                }
            }

            // Lọc theo từ khóa tìm kiếm
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim()
                const sttStr = (decodeSTT(item.daily_seq) || '').toLowerCase()
                const codeStr = (item.code || '').toLowerCase()
                const locStr = (item.location || '').toLowerCase()
                const tagsStr = getLotTagsString(item.lot, suggestion.productId).toLowerCase()

                return sttStr.includes(term) || codeStr.includes(term) || locStr.includes(term) || tagsStr.includes(term)
            }

            return true
        })
    }, [suggestion, selectedTagFilter, searchTerm])

    // Tính toán số lượng của các lô đang được chọn
    const checkedLots = useMemo(() => {
        return suggestion.suggestedLots.filter(l => checkedItemIds.includes(l.lotItemId))
    }, [suggestion, checkedItemIds])

    const totalQty = checkedLots.reduce((sum, l) => sum + l.quantity, 0)
    const fullPallets = Math.floor(totalQty / suggestion.quantityPerPallet)
    const remainder = totalQty % suggestion.quantityPerPallet
    const canMerge = checkedLots.length >= 2

    // Xử lý chọn nhanh theo tag đang lọc
    const handleSelectCurrentFiltered = () => {
        const filteredIds = filteredLots.map(l => l.lotItemId)
        const isAllFilteredChecked = filteredIds.every(id => checkedItemIds.includes(id))

        if (isAllFilteredChecked) {
            // Bỏ chọn những lô đang hiển thị trong filter
            const newChecked = checkedItemIds.filter(id => !filteredIds.includes(id))
            onToggleAll(suggestion.productId, newChecked)
        } else {
            // Thêm các lô trong filter vào danh sách chọn
            const newChecked = Array.from(new Set([...checkedItemIds, ...filteredIds]))
            onToggleAll(suggestion.productId, newChecked)
        }
    }

    // Xử lý xuất Excel cho riêng mặt hàng này
    const handleExportExcel = async () => {
        try {
            setIsExporting(true)
            await exportSingleProductOddLotsToExcel({
                suggestion,
                systemName: currentSystem?.name || 'Kho',
                checkedLotItemIds: checkedItemIds
            })
        } catch (error) {
            console.error('Lỗi xuất Excel mặt hàng:', error)
        } finally {
            setIsExporting(false)
        }
    }

    // Sao chép mã Lot
    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(code)
        setTimeout(() => setCopiedCode(null), 1500)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-5xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
                {/* 1. MODAL HEADER */}
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-indigo-50/50 via-white to-blue-50/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-blue-950/20 shrink-0">
                    <div className="flex items-start gap-3.5 min-w-0">
                        <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 shrink-0 mt-0.5">
                            <Package size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className="font-mono font-bold text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800 uppercase tracking-wide">
                                    {suggestion.productSku}
                                </span>
                                <span className="text-xs font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                                    {suggestion.quantityPerPallet} {suggestion.productUnit}/Pallet
                                </span>
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                    {suggestion.suggestedLots.length} lot lẻ hiện tại
                                </span>
                            </div>
                            <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 truncate">
                                {suggestion.productName}
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Danh sách chi tiết các lô hàng lẻ chưa đầy pallet. Tích chọn các lô phù hợp để gộp lại hoặc xuất file Excel.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer disabled:opacity-60"
                            title="Xuất file Excel cho riêng mặt hàng này"
                        >
                            <FileSpreadsheet size={15} />
                            <span className="hidden sm:inline">Xuất Excel mặt hàng</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* 2. STATS OVERVIEW CARDS */}
                <div className="px-6 py-4 bg-slate-50/60 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                    <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lô Đã Tích Chọn</div>
                        <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5 flex items-baseline gap-1">
                            <span>{checkedLots.length}</span>
                            <span className="text-xs font-normal text-slate-400">/ {suggestion.suggestedLots.length} lot</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng SL Sau Gộp</div>
                        <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-baseline gap-1">
                            <span>{totalQty}</span>
                            <span className="text-xs font-medium text-slate-500">{suggestion.productUnit}</span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs col-span-2 sm:col-span-2">
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                            <span>Ước Tính Pallet Gộp Được</span>
                            {canMerge && (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                                    Khả thi ghép
                                </span>
                            )}
                        </div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1 flex items-center gap-2">
                            {totalQty > 0 ? (
                                fullPallets > 0 ? (
                                    <>
                                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">
                                            {fullPallets} Pallet Đầy
                                        </span>
                                        {remainder > 0 && (
                                            <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-medium text-xs">
                                                Dư {remainder} {suggestion.productUnit}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium text-xs">
                                        Chưa đủ 1 Pallet ({totalQty}/{suggestion.quantityPerPallet} {suggestion.productUnit})
                                    </span>
                                )
                            ) : (
                                <span className="text-slate-400 font-normal text-xs italic">
                                    Chưa chọn lô nào để tính toán
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. TOOLBAR: SEARCH & TAG FILTERS */}
                <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <div className="relative flex-1">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Tìm theo STT, mã LOT, vị trí, tag..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tag Filters Pill */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1 mr-1">
                            <Tag size={12} />
                            Tag:
                        </span>
                        <button
                            onClick={() => setSelectedTagFilter('all')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                                selectedTagFilter === 'all'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                            }`}
                        >
                            Tất cả ({suggestion.suggestedLots.length})
                        </button>

                        {availableTags.tags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setSelectedTagFilter(tag)}
                                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer uppercase ${
                                    selectedTagFilter === tag
                                        ? 'bg-orange-500 text-white shadow-xs'
                                        : 'bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100'
                                }`}
                            >
                                {tag}
                            </button>
                        ))}

                        {availableTags.hasNoTag && (
                            <button
                                onClick={() => setSelectedTagFilter('__no_tag__')}
                                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                                    selectedTagFilter === '__no_tag__'
                                        ? 'bg-slate-600 text-white shadow-xs'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                Không tag
                            </button>
                        )}

                        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                        {/* Nút hành động chọn nhanh */}
                        <button
                            onClick={handleSelectCurrentFiltered}
                            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1 py-1 cursor-pointer"
                        >
                            {filteredLots.every(l => checkedItemIds.includes(l.lotItemId))
                                ? 'Bỏ chọn đang lọc'
                                : 'Chọn tất cả đang lọc'}
                        </button>
                    </div>
                </div>

                {/* 4. LOTS LIST TABLE */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {filteredLots.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-sm">
                            Không tìm thấy lô lẻ nào phù hợp với bộ lọc hiện tại.
                        </div>
                    ) : (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 uppercase font-black text-[10px]">
                                    <tr>
                                        <th className="py-3 px-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredLots.length > 0 && filteredLots.every(l => checkedItemIds.includes(l.lotItemId))}
                                                onChange={handleSelectCurrentFiltered}
                                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-3 px-3 w-16 text-center">STT Lô</th>
                                        <th className="py-3 px-3 w-40">Mã LOT</th>
                                        <th className="py-3 px-3">Vị Trí Hiện Tại</th>
                                        <th className="py-3 px-3">Mã Phụ (Tag)</th>
                                        <th className="py-3 px-3 text-right">Số Lượng</th>
                                        <th className="py-3 px-3 w-36 text-center">% Chiếm Pallet</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                                    {filteredLots.map(item => {
                                        const isChecked = checkedItemIds.includes(item.lotItemId)
                                        const ratioPercent = Math.min(
                                            100,
                                            Math.round((item.quantity / suggestion.quantityPerPallet) * 100)
                                        )

                                        // Lấy tags
                                        const productItemIds = item.lot.lot_items
                                            ?.filter(i => i.product_id === suggestion.productId)
                                            ?.map(i => i.id) || []
                                        const itemTags = item.lot.lot_tags?.filter(
                                            t => t.lot_item_id && productItemIds.includes(t.lot_item_id)
                                        ) || []

                                        return (
                                            <tr
                                                key={item.lotItemId}
                                                onClick={() => onToggleItem(suggestion.productId, item.lotItemId)}
                                                className={`transition-colors cursor-pointer select-none ${
                                                    isChecked
                                                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/30'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                                                }`}
                                            >
                                                <td className="py-3 px-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => onToggleItem(suggestion.productId, item.lotItemId)}
                                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                </td>

                                                {/* STT */}
                                                <td className="py-3 px-3 text-center font-bold text-slate-800 dark:text-slate-200">
                                                    #{decodeSTT(item.daily_seq) || '--'}
                                                </td>

                                                {/* Mã LOT */}
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-1.5 font-mono font-medium text-slate-600 dark:text-slate-300">
                                                        <span>{item.code}</span>
                                                        <button
                                                            onClick={e => {
                                                                e.stopPropagation()
                                                                handleCopyCode(item.code)
                                                            }}
                                                            className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                                                            title="Sao chép mã Lot"
                                                        >
                                                            {copiedCode === item.code ? (
                                                                <Check size={12} className="text-emerald-500" />
                                                            ) : (
                                                                <Copy size={12} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Vị Trí */}
                                                <td className="py-3 px-3">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700">
                                                        <Warehouse size={11} className="text-zinc-400" />
                                                        {item.location}
                                                    </span>
                                                </td>

                                                {/* Mã Phụ Tags */}
                                                <td className="py-3 px-3">
                                                    {itemTags.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {itemTags.map((tagObj, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 text-[10px] font-bold rounded-md border border-orange-200 dark:border-orange-850 uppercase font-mono tracking-wide"
                                                                >
                                                                    {tagObj.tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                                            Không có mã phụ
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Số Lượng */}
                                                <td className="py-3 px-3 text-right">
                                                    <span className="font-extrabold text-sm text-indigo-600 dark:text-indigo-400">
                                                        {item.quantity}
                                                    </span>{' '}
                                                    <span className="text-slate-400 font-medium">{item.unit}</span>
                                                </td>

                                                {/* % Chiếm Pallet */}
                                                <td className="py-3 px-3">
                                                    <div className="flex items-center gap-2 justify-center">
                                                        <div className="w-16 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full ${
                                                                    ratioPercent > 70
                                                                        ? 'bg-emerald-500'
                                                                        : ratioPercent > 40
                                                                        ? 'bg-indigo-500'
                                                                        : 'bg-amber-500'
                                                                }`}
                                                                style={{ width: `${ratioPercent}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[11px] font-mono text-slate-500 w-10 text-right">
                                                            {ratioPercent}%
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* 5. STICKY MODAL FOOTER */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                        <AlertCircle size={14} className="text-indigo-500 shrink-0" />
                        <span>
                            {canMerge ? (
                                <>
                                    Đã chọn <b>{checkedLots.length}</b> lô (tổng <b>{totalQty} {suggestion.productUnit}</b>)
                                    {' → '}
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                        Ghép thành {fullPallets} Pallet{remainder > 0 ? ` (dư ${remainder})` : ''}
                                    </span>
                                </>
                            ) : (
                                <span className="text-slate-400 italic">
                                    Vui lòng tích chọn tối thiểu 2 lô hàng để tiến hành ghép.
                                </span>
                            )}
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                        >
                            Đóng
                        </button>

                        <button
                            onClick={() => {
                                if (canMerge) {
                                    const targetLot = checkedLots[0].lot
                                    const sourceLots = checkedLots.slice(1).map(l => l.lot).filter(l => l.id !== targetLot.id)
                                    const sourceLotIds = sourceLots.map(l => l.id)
                                    onMerge(targetLot, sourceLotIds, sourceLots)
                                    onClose()
                                }
                            }}
                            disabled={!canMerge}
                            className={`flex items-center gap-1.5 px-5 py-2.5 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer ${
                                canMerge
                                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                                    : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                            }`}
                        >
                            <Combine size={15} />
                            Ghép ngay
                            <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
