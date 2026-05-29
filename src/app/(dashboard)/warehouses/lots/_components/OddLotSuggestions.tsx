'use client'

import React, { useMemo, useState, useEffect } from 'react'
import { Sparkles, Combine, AlertCircle, ArrowRight, HelpCircle, Loader2, ChevronDown, Package } from 'lucide-react'
import { Lot } from '../_hooks/useLotManagement'
import { decodeSTT } from '@/lib/numberUtils'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'

interface OddLotSuggestionsProps {
    lots: Lot[]
    products: any[]
    zones: any[]
    onMerge: (targetLot: Lot, sourceLotIds: string[]) => void
    isSanxuat?: boolean
}

interface ZoneItem {
    id: string
    parent_id: string | null
    is_hall: boolean | null
}

interface OddLotSuggestion {
    productId: string
    productName: string
    productSku: string
    quantityPerPallet: number
    productUnit: string
    suggestedLots: {
        id: string
        code: string
        daily_seq: number | null
        quantity: number
        lot: Lot
        location: string
        unit: string
        lotItemId: string
    }[]
}

export function OddLotSuggestions({ lots, products, zones, onMerge, isSanxuat = false }: OddLotSuggestionsProps) {
    const { currentSystem } = useSystem()
    // Quản lý các lô hàng lẻ được tích chọn thông qua ID duy nhất của lot_item đại diện để tránh trùng lặp
    const [checkedLotItemIds, setCheckedLotItemIds] = useState<Record<string, string[]>>({})
    // Quản lý ẩn/hiện chi tiết theo sản phẩm
    const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})
    
    // State để lưu toàn bộ lot fetch từ DB (không phân trang)
    const [allLots, setAllLots] = useState<Lot[]>([])
    const [isLoadingAll, setIsLoadingAll] = useState(true)

    // Fetch toàn bộ lot trong hệ thống khi component mount
    useEffect(() => {
        if (!currentSystem?.code || isSanxuat) return

        const fetchAllLots = async () => {
            setIsLoadingAll(true)
            try {
                let allData: Lot[] = []
                let from = 0
                const batchSize = 1000

                while (true) {
                    const { data, error } = await supabase
                        .from('lots')
                        .select(`
                            *,
                            lot_items(
                                id, quantity, product_id, unit,
                                products(name, unit, sku, internal_name, internal_code)
                            ),
                            lot_tags(tag, lot_item_id),
                            positions!positions_lot_id_fkey(id, code, zone_positions!left(zone_id))
                        `)
                        .eq('system_code', currentSystem.code)
                        .neq('status', 'hidden')
                        .neq('status', 'exported')
                        .range(from, from + batchSize - 1)

                    if (error) {
                        console.error('Error fetching all lots for odd-lot scan:', error)
                        break
                    }
                    if (!data || data.length === 0) break
                    allData = [...allData, ...(data as unknown as Lot[])]
                    if (data.length < batchSize) break
                    from += batchSize
                }

                setAllLots(allData)
            } catch (err) {
                console.error('Failed to fetch all lots:', err)
            } finally {
                setIsLoadingAll(false)
            }
        }

        fetchAllLots()
    }, [currentSystem?.code, isSanxuat])

    // Re-sync khi prop lots thay đổi (ví dụ sau khi gộp lot thành công)
    useEffect(() => {
        if (!currentSystem?.code || isSanxuat || isLoadingAll) return
        
        // Cập nhật lại allLots bằng dữ liệu mới nhất từ prop lots
        setAllLots(prev => {
            const updated = [...prev]
            lots.forEach(freshLot => {
                const idx = updated.findIndex(l => l.id === freshLot.id)
                if (idx >= 0) {
                    updated[idx] = freshLot // Cập nhật lot đã thay đổi
                }
            })
            // Loại bỏ lot đã bị xóa/ẩn (không còn trong danh sách active)
            return updated.filter(l => {
                // Nếu lot này nằm trong trang hiện tại và đã bị xóa thì loại bỏ
                const inCurrentPage = lots.find(pl => pl.id === l.id)
                if (inCurrentPage) return true // Vẫn tồn tại
                // Lot không nằm trong trang hiện tại -> giữ nguyên
                return true
            })
        })
    }, [lots])

    if (isSanxuat) return null

    // 1. Tạo Map zones để tra cứu đệ quy cha con
    const zonesMap = useMemo(() => {
        const map = new Map<string, ZoneItem>()
        zones.forEach(z => {
            map.set(z.id, {
                id: z.id,
                parent_id: z.parent_id,
                is_hall: z.is_hall
            })
        })
        return map
    }, [zones])

    // 2. Hàm kiểm tra xem một zone_id có thuộc sảnh (hoặc con cháu của sảnh) hay không
    const isZoneInHall = React.useCallback((zoneId: string): boolean => {
        let currentId: string | null = zoneId
        const visited = new Set<string>()

        while (currentId && !visited.has(currentId)) {
            visited.add(currentId)
            const zone = zonesMap.get(currentId)
            if (!zone) break
            if (zone.is_hall) return true
            currentId = zone.parent_id
        }
        return false
    }, [zonesMap])

    // 3. Hàm kiểm tra xem Lot có phải là chưa lên kệ hay không (chưa gán hoặc toàn bộ ở sảnh)
    const getLotPlacementStatus = React.useCallback((lot: Lot): { isUnplaced: boolean; label: string } => {
        if (!lot.positions || lot.positions.length === 0) {
            return { isUnplaced: true, label: 'Chưa gán' }
        }

        // Kiểm tra xem tất cả các vị trí đã gán có thuộc sảnh hay không
        const allInHall = lot.positions.every(pos => {
            const zoneId = pos.zone_positions?.[0]?.zone_id
            return zoneId ? isZoneInHall(zoneId) : false
        })

        if (allInHall) {
            const locName = lot.positions.map(p => p.code).join(', ')
            return { isUnplaced: true, label: `Sảnh (${locName})` }
        }

        return { isUnplaced: false, label: '' }
    }, [isZoneInHall])

    // 4. Tính toán các gợi ý ghép lot lẻ (quét toàn bộ lot trong hệ thống)
    const suggestions = useMemo(() => {
        if (!allLots || allLots.length === 0 || !products || products.length === 0) return []

        // Lọc ra các sản phẩm có quantity_per_pallet > 0
        const prodPalletMap = new Map<string, any>()
        products.forEach(p => {
            if (p.quantity_per_pallet && p.quantity_per_pallet > 0) {
                prodPalletMap.set(p.id, p)
            }
        })

        if (prodPalletMap.size === 0) return []

        // Gom nhóm tất cả lot lẻ theo product_id và sau đó theo lot.id để tránh lặp lô hàng trên giao diện
        const oddLotsByProduct = new Map<string, Map<string, { lot: Lot; lotItemIds: string[]; quantity: number; label: string; unit: string }>>()

        allLots.forEach(lot => {
            if (!lot.lot_items || lot.lot_items.length === 0) return

            // Xác định vị trí hiện tại của lot để hiển thị (không dùng để lọc)
            const placement = getLotPlacementStatus(lot)
            const locationLabel = placement.isUnplaced
                ? placement.label // 'Chưa gán' hoặc 'Sảnh (xxx)'
                : (lot.positions?.map(p => p.code).join(', ') || 'Đã gán vị trí')

            lot.lot_items.forEach(item => {
                const product = prodPalletMap.get(item.product_id)
                if (product) {
                    // Lấy tất cả dòng sản phẩm này trong cùng một lô để tính tổng số lượng
                    const sameProductItems = lot.lot_items!.filter(i => i.product_id === item.product_id)
                    const totalQtyInLot = sameProductItems.reduce((sum, i) => sum + i.quantity, 0)

                    // Nếu tổng số lượng sản phẩm này trong lô nhỏ hơn quy cách pallet thì coi là lô lẻ
                    if (totalQtyInLot < product.quantity_per_pallet) {
                        if (!oddLotsByProduct.has(item.product_id)) {
                            oddLotsByProduct.set(item.product_id, new Map())
                        }
                        
                        const productLotsMap = oddLotsByProduct.get(item.product_id)!
                        
                        // Đảm bảo mỗi lot.id chỉ xuất hiện đúng 1 lần đại diện cho 1 pallet vật lý
                        if (!productLotsMap.has(lot.id)) {
                            productLotsMap.set(lot.id, {
                                lot,
                                lotItemIds: sameProductItems.map(i => i.id),
                                quantity: totalQtyInLot, // Gộp chung tổng số lượng (ví dụ: 12 + 3 = 15)
                                label: locationLabel,
                                unit: item.unit || product.unit || 'đơn vị'
                            })
                        }
                    }
                }
            })
        })

        // Xây dựng danh sách đề xuất cho các sản phẩm có từ 2 lot lẻ trở lên
        const result: OddLotSuggestion[] = []
        oddLotsByProduct.forEach((productLotsMap, productId) => {
            const grouped = Array.from(productLotsMap.values())
            if (grouped.length >= 2) {
                const product = prodPalletMap.get(productId)!
                result.push({
                    productId,
                    productName: product.name,
                    productSku: product.sku,
                    quantityPerPallet: product.quantity_per_pallet,
                    productUnit: product.pallet_unit || product.unit || 'đơn vị',
                    suggestedLots: grouped.map(g => ({
                        id: g.lot.id,
                        code: g.lot.code,
                        daily_seq: (g.lot as any).daily_seq,
                        quantity: g.quantity,
                        lot: g.lot,
                        location: g.label,
                        unit: g.unit,
                        lotItemId: g.lotItemIds[0] // Dùng ID dòng đầu tiên làm key chính để track checkbox
                    }))
                })
            }
        })

        return result
    }, [allLots, products, getLotPlacementStatus])

    // Effect tự động tích chọn sẵn toàn bộ lô lẻ khi load gợi ý mới
    React.useEffect(() => {
        if (suggestions.length === 0) return

        setCheckedLotItemIds(prev => {
            const updated = { ...prev }
            suggestions.forEach(s => {
                // Nếu chưa có trạng thái lưu trước đó cho sản phẩm này thì mặc định tích chọn tất cả dòng lot_item
                if (!updated[s.productId]) {
                    updated[s.productId] = s.suggestedLots.map(l => l.lotItemId)
                } else {
                    // Giữ lại các lựa chọn cũ còn hợp lệ
                    const currentValidItemIds = s.suggestedLots.map(l => l.lotItemId)
                    updated[s.productId] = updated[s.productId].filter(id => currentValidItemIds.includes(id))
                    
                    // Nếu sau khi lọc danh sách bị rỗng thì reset chọn tất cả
                    if (updated[s.productId].length === 0) {
                        updated[s.productId] = currentValidItemIds
                    }
                }
            })
            return updated
        })
    }, [suggestions])

    // Xử lý tích/bỏ tích chọn từng dòng sản phẩm của lô lẻ
    const handleToggleLotItem = (productId: string, lotItemId: string) => {
        setCheckedLotItemIds(prev => {
            const current = prev[productId] || []
            const next = current.includes(lotItemId)
                ? current.filter(id => id !== lotItemId)
                : [...current, lotItemId]
            return { ...prev, [productId]: next }
        })
    }

    // Xử lý tích/bỏ tích chọn toàn bộ dòng sản phẩm của một nhóm gợi ý
    const handleToggleAllLotItems = (productId: string, allItemIds: string[]) => {
        setCheckedLotItemIds(prev => {
            const current = prev[productId] || []
            const isAllChecked = allItemIds.every(id => current.includes(id))
            return {
                ...prev,
                [productId]: isAllChecked ? [] : [...allItemIds]
            }
        })
    }

    if (isLoadingAll) {
        return (
            <div className="bg-gradient-to-r from-indigo-50/60 to-blue-50/60 dark:from-indigo-950/20 dark:to-slate-900/40 rounded-3xl border border-indigo-100 dark:border-indigo-950/50 p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <Loader2 size={20} className="text-indigo-500 animate-spin" />
                    <div>
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Đang quét toàn bộ kho hàng...</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Hệ thống đang kiểm tra tất cả lô hàng để tìm lot lẻ có thể ghép.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (suggestions.length === 0) {
        return (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/10 dark:to-slate-900/30 rounded-3xl border border-emerald-100 dark:border-emerald-950/20 p-6 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                        <Combine size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Kho hàng rất tối ưu</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Hiện tại không có các lô hàng lẻ nào của cùng một sản phẩm cần được ghép.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-gradient-to-r from-indigo-50/60 to-blue-50/60 dark:from-indigo-950/20 dark:to-slate-900/40 rounded-3xl border border-indigo-100 dark:border-indigo-950/50 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100/50 dark:border-indigo-950/30 pb-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-500 text-white shadow-md shadow-indigo-500/20 animate-pulse">
                        <Combine size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            Gợi ý ghép Lot lẻ
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                                Đã quét {allLots.length} lot
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Phát hiện các lô chưa đầy pallet có thể ghép lại với nhau. Hãy tích chọn các lô có cùng mã phụ (tag) để ghép.
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {suggestions.map(suggestion => {
                    const allSuggestedItemIds = suggestion.suggestedLots.map(l => l.lotItemId)
                    const checkedItemIds = checkedLotItemIds[suggestion.productId] || []
                    const checkedLots = suggestion.suggestedLots.filter(l => checkedItemIds.includes(l.lotItemId))
                    
                    // Tính toán số lượng và pallet động dựa trên các dòng được checked
                    const totalQty = checkedLots.reduce((sum, l) => sum + l.quantity, 0)
                    const fullPallets = Math.floor(totalQty / suggestion.quantityPerPallet)
                    const remainder = totalQty % suggestion.quantityPerPallet
                    const isAllChecked = allSuggestedItemIds.every(id => checkedItemIds.includes(id))
                    const canMerge = checkedLots.length >= 2
                    const isExpanded = expandedProducts[suggestion.productId] || false

                    return (
                        <div key={suggestion.productId} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                            {/* Header - Luôn hiển thị, click để toggle */}
                            <div 
                                onClick={() => setExpandedProducts(prev => ({ ...prev, [suggestion.productId]: !prev[suggestion.productId] }))}
                                className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 shrink-0">
                                        <Package size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-bold text-[10px] bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50 uppercase">
                                                {suggestion.productSku}
                                            </span>
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                                                {suggestion.productName}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg border border-amber-100 dark:border-amber-900/30 hidden sm:inline-block">
                                        {suggestion.quantityPerPallet} {suggestion.productUnit}/Pallet
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                        {suggestion.suggestedLots.length} lot lẻ
                                    </span>
                                    <ChevronDown 
                                        size={16} 
                                        className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                                    />
                                </div>
                            </div>

                            {/* Chi tiết - Ẩn/hiện */}
                            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                <div className="px-4 pb-4 border-t border-slate-50 dark:border-slate-800">
                                    <div className="space-y-2 mt-3">
                                        <div className="flex items-center justify-between px-1 mb-1">
                                            <div className="text-[10px] font-black uppercase text-slate-400">Các lô hàng lẻ hiện tại:</div>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleToggleAllLotItems(suggestion.productId, allSuggestedItemIds); }}
                                                className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                            >
                                                {isAllChecked ? 'Bỏ chọn hết' : 'Tích chọn hết'}
                                            </button>
                                        </div>
                                        <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                                            {suggestion.suggestedLots.map((item) => {
                                                const isChecked = checkedItemIds.includes(item.lotItemId)
                                                return (
                                                    <div 
                                                        key={item.lotItemId}
                                                        onClick={(e) => { e.stopPropagation(); handleToggleLotItem(suggestion.productId, item.lotItemId); }}
                                                        className={`flex items-start gap-2.5 text-xs p-2 rounded-xl border transition-all cursor-pointer select-none ${
                                                            isChecked 
                                                                ? 'bg-indigo-50/40 dark:bg-indigo-950/15 border-indigo-200 dark:border-indigo-900/60' 
                                                                : 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {}}
                                                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 shrink-0 mt-0.5 pointer-events-none"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                                                    <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                                                                        STT: {decodeSTT(item.daily_seq) || '--'}
                                                                    </span>
                                                                    <span className="text-slate-400 font-mono text-[10px] truncate">({item.code})</span>
                                                                    <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 text-[9px] font-medium border border-zinc-300 dark:border-zinc-700 shrink-0">
                                                                        {item.location}
                                                                    </span>
                                                                </div>
                                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0 ml-1">
                                                                    {item.quantity} {item.unit}
                                                                </span>
                                                            </div>

                                                            {/* Hiển thị Mã Phụ (Tags) */}
                                                            {(() => {
                                                                const productItemIds = item.lot.lot_items
                                                                    ?.filter(i => i.product_id === suggestion.productId)
                                                                    ?.map(i => i.id) || [];

                                                                const itemTags = item.lot.lot_tags?.filter(t => t.lot_item_id && productItemIds.includes(t.lot_item_id)) || [];
                                                                if (itemTags.length > 0) {
                                                                    return (
                                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                                            {itemTags.map((tagObj, tIdx) => (
                                                                                <span 
                                                                                    key={tIdx} 
                                                                                    className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 text-[8.5px] font-bold rounded border border-orange-200 dark:border-orange-900/50 uppercase font-mono tracking-wide"
                                                                                >
                                                                                    {tagObj.tag}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }
                                                                return (
                                                                    <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 italic">
                                                                        Không có mã phụ
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Footer: Tổng sau gộp + Nút ghép */}
                                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                                                <span>Tổng sau gộp: {totalQty} {suggestion.productUnit}</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                                                <AlertCircle size={10} className="shrink-0" />
                                                <span>
                                                    {totalQty > 0 ? (
                                                        fullPallets > 0 
                                                            ? `Đủ ${fullPallets} Pallet${remainder > 0 ? ` và dư ${remainder} ${suggestion.productUnit}` : ''}` 
                                                            : `Vẫn là 1 lot lẻ (${totalQty}/${suggestion.quantityPerPallet})`
                                                    ) : (
                                                        'Vui lòng tích chọn lô hàng để ghép'
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (canMerge) {
                                                    const targetLot = checkedLots[0].lot
                                                    const sourceLotIds = Array.from(new Set(
                                                        checkedLots.slice(1)
                                                            .map(l => l.lot.id)
                                                            .filter(id => id !== targetLot.id)
                                                    ))
                                                    onMerge(targetLot, sourceLotIds)
                                                }
                                            }}
                                            disabled={!canMerge}
                                            className={`flex items-center justify-center gap-1.5 px-4 py-2 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer ${
                                                canMerge 
                                                    ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/10' 
                                                    : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                                            }`}
                                        >
                                            <Combine size={14} />
                                            Ghép ngay
                                            <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
