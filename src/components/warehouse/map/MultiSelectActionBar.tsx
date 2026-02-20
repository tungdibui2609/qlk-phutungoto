'use client'
import { useMemo } from 'react'
import { FileOutput, ArrowDownToLine, ArrowRightLeft, PackageMinus, X, Tag } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']

interface MultiSelectActionBarProps {
    selectedPositionIds: Set<string>
    positions: Position[]
    lotInfo: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>,
        inbound_date?: string,
        created_at?: string,
        packaging_date?: string,
        peeling_date?: string,
        tags?: string[]
    }>
    onClear: () => void
    onTag: (lotId: string) => void
    onBulkExport: () => void
    onExportOrder: (positionIds: string[], lotIds: string[]) => void
    onOpenSelectHall?: () => void
    onOpenMove?: () => void
}

export default function MultiSelectActionBar({
    selectedPositionIds,
    positions,
    lotInfo,
    onClear,
    onTag,
    onBulkExport,
    onExportOrder,
    onOpenSelectHall,
    onOpenMove
}: MultiSelectActionBarProps) {

    // Get selected positions data
    const selectedPositions = useMemo(() => {
        return positions.filter(p => selectedPositionIds.has(p.id))
    }, [positions, selectedPositionIds])

    // Get unique LOT IDs from selected positions
    const selectedLotIds = useMemo(() => {
        const lotIds = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIds.add(p.lot_id)
        })
        return lotIds
    }, [selectedPositions])

    // Aggregate selected items for display
    const aggregatedItems = useMemo(() => {
        const groups: Record<string, {
            sku: string,
            productName: string,
            unit: string,
            totalQuantity: number,
            positionCount: number,
            lotCodes: Set<string>,
            lotId: string // Representative ID
        }> = {}

        selectedPositions.forEach((pos: Position) => {
            const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
            if (!lot || !lot.items) return

            lot.items.forEach(item => {
                const sku = item.sku || ''
                const productName = item.product_name || lot.code
                const unit = item.unit || ''
                const qty = item.quantity || 0

                // Group by SKU, Product Name, and Unit
                const key = `${sku}|${productName}|${unit}`

                if (!groups[key]) {
                    groups[key] = {
                        sku,
                        productName,
                        unit,
                        totalQuantity: 0,
                        positionCount: 0,
                        lotCodes: new Set(),
                        lotId: pos.lot_id!
                    }
                }

                groups[key].totalQuantity += qty
                groups[key].lotCodes.add(lot.code)
            })

            // Increment position count for each group associated with this lot
            // (Strictly speaking, one position can contain multiple items, 
            // but for the UI badge we just need to know how many slots are occupied)
            const uniqueKeysInLot = new Set(lot.items.map(i => `${i.sku || ''}|${i.product_name || lot.code}|${i.unit || ''}`))
            uniqueKeysInLot.forEach(key => {
                if (groups[key]) groups[key].positionCount += 1
            })
        })

        return Object.values(groups)
    }, [selectedPositions, lotInfo])

    // Calculate higher level summary (Total by Unit)
    const totalByUnit = useMemo(() => {
        const units: Record<string, number> = {}
        aggregatedItems.forEach(item => {
            units[item.unit] = (units[item.unit] || 0) + item.totalQuantity
        })
        return units
    }, [aggregatedItems])

    if (selectedPositionIds.size === 0) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5">
            <div className="mx-auto w-fit min-w-[320px] max-w-[95vw] px-4 pb-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Action buttons and Selection Info */}
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                        {/* Selection count */}
                        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                            <span className="text-xs font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                Đã chọn {selectedPositionIds.size}
                            </span>
                        </div>

                        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

                        {/* Action buttons group */}
                        <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => onExportOrder(Array.from(selectedPositionIds), Array.from(selectedLotIds))}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                title="Lệnh xuất kho"
                            >
                                <FileOutput size={14} className="text-blue-500 group-hover:scale-110 transition-transform" />
                                <span>Lệnh xuất kho</span>
                            </button>

                            <button
                                onClick={onOpenSelectHall}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                title="Hạ sảnh"
                            >
                                <ArrowDownToLine size={14} className="text-orange-500 group-hover:scale-110 transition-transform" />
                                <span>Hạ sảnh</span>
                            </button>

                            <button
                                onClick={onOpenMove}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                title="Di chuyển"
                            >
                                <ArrowRightLeft size={14} className="text-indigo-500 group-hover:scale-110 transition-transform" />
                                <span>Di chuyển</span>
                            </button>

                            <button
                                onClick={() => {
                                    const firstLotId = Array.from(selectedLotIds)[0]
                                    if (firstLotId) onTag(firstLotId)
                                }}
                                disabled={selectedLotIds.size === 0}
                                className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all active:scale-95 disabled:opacity-50 group whitespace-nowrap"
                                title="Gán mã phụ"
                            >
                                <Tag size={14} className="text-teal-500 group-hover:scale-110 transition-transform" />
                                <span>Gán mã phụ</span>
                            </button>

                            <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />

                            <button
                                onClick={onBulkExport}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all active:scale-95 border border-transparent hover:border-rose-100 dark:hover:border-rose-900/50 group whitespace-nowrap"
                                title="Xuất toàn bộ khỏi kho (Hàng loạt)"
                            >
                                <PackageMinus size={16} className="group-hover:scale-110 transition-transform" />
                                <span>Xuất khỏi kho</span>
                            </button>
                        </div>

                        {/* Close button */}
                        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
                        <button
                            onClick={onClear}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Bỏ chọn tất cả"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Selected items list */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 max-h-40 overflow-y-auto">
                        {/* Summary Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100 dark:border-gray-800">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tổng hợp số lượng:</span>
                            <div className="flex flex-wrap gap-3">
                                {Object.entries(totalByUnit).map(([unit, qty], i) => (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums">
                                            {qty}
                                        </span>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">
                                            {unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-[minmax(180px,auto)_110px_90px_minmax(120px,1fr)] gap-y-1">
                            {aggregatedItems.map((item, idx) => {
                                const codesArray = Array.from(item.lotCodes)

                                return (
                                    <div key={`${item.lotId}-${idx}`} className="contents group">
                                        {/* Column 1: SKU & Product Name */}
                                        <div className="flex items-center gap-1.5 min-w-0 py-1.5 pl-3 bg-white dark:bg-gray-800 rounded-l-lg border-y border-l border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            {item.sku && (
                                                <span className="shrink-0 px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-[10px] text-gray-500 dark:text-gray-400 rounded font-mono font-bold">
                                                    {item.sku.slice(0, 2)}
                                                </span>
                                            )}
                                            <span className="font-bold text-gray-900 dark:text-white truncate" title={item.productName}>
                                                {item.productName}
                                            </span>
                                        </div>

                                        {/* Column 2: Quantity */}
                                        <div className="flex items-center justify-end py-1.5 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
                                                {item.totalQuantity} {item.unit}
                                            </span>
                                        </div>

                                        {/* Column 3: Position Count */}
                                        <div className="flex items-center justify-end py-1.5 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            <span className="text-gray-400 whitespace-nowrap">
                                                ({item.positionCount} vị trí)
                                            </span>
                                        </div>

                                        {/* Column 4: Lot Code */}
                                        <div className="flex items-center justify-end py-1.5 pr-3 bg-white dark:bg-gray-800 rounded-r-lg border-y border-r border-gray-200 dark:border-gray-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                            <div className="flex items-center gap-1 min-w-0">
                                                {codesArray.length === 1 ? (
                                                    <span className="text-gray-400 font-mono truncate text-[11px]">
                                                        {codesArray[0]}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic truncate text-[11px]">
                                                        {codesArray.length} lô
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
