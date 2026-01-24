'use client'
import { useMemo } from 'react'
import { FileOutput, ArrowDownToLine, ArrowRightLeft, Trash2, X, Tag } from 'lucide-react'
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
}

export default function MultiSelectActionBar({
    selectedPositionIds,
    positions,
    lotInfo,
    onClear,
    onTag
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

    if (selectedPositionIds.size === 0) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5">
            <div className="mx-auto max-w-6xl px-4 pb-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Action buttons */}
                    <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                        {/* Selection count */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg mr-2">
                            <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                                Đã chọn {selectedPositionIds.size}
                            </span>
                        </div>

                        <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-2" />

                        {/* Action buttons */}
                        <button
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Tạo lệnh xuất"
                        >
                            <FileOutput size={16} />
                            <span>Tạo lệnh xuất</span>
                        </button>

                        <button
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Hạ sành"
                        >
                            <ArrowDownToLine size={16} />
                            <span>Hạ sành</span>
                        </button>

                        <button
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Chuyển kho"
                        >
                            <ArrowRightLeft size={16} />
                            <span>Chuyển kho</span>
                        </button>

                        <button
                            onClick={() => {
                                // Open tag modal for first selected LOT
                                const firstLotId = Array.from(selectedLotIds)[0]
                                if (firstLotId) onTag(firstLotId)
                            }}
                            disabled={selectedLotIds.size === 0}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Gán mã phụ"
                        >
                            <Tag size={16} />
                            <span>Gán mã phụ</span>
                        </button>

                        <div className="flex-1" />

                        {/* Danger action */}
                        <button
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Xuất khỏi kho"
                        >
                            <Trash2 size={16} />
                            <span>Xuất khỏi kho</span>
                        </button>

                        {/* Close button */}
                        <button
                            onClick={onClear}
                            className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Bỏ chọn tất cả"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Selected items list */}
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 max-h-32 overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                            {selectedPositions.map(pos => {
                                const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
                                return (
                                    <div
                                        key={pos.id}
                                        className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs"
                                    >
                                        <span className="font-mono font-bold text-gray-900 dark:text-white">{pos.code}</span>
                                        {lot && (
                                            <>
                                                <span className="text-gray-400">•</span>
                                                <span className="text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                                                    {lot.items?.[0]?.product_name || lot.code}
                                                </span>
                                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                    {lot.items?.reduce((sum, i) => sum + i.quantity, 0)} {lot.items?.[0]?.unit}
                                                </span>
                                            </>
                                        )}
                                        <span className="text-gray-400">({selectedPositions.filter(p => p.lot_id === pos.lot_id).length} vị trí)</span>
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
