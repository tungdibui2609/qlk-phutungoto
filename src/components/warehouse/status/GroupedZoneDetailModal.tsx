import React from 'react'
import { X, Package, Hash } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface GroupedZoneDetailModalProps {
    zone: Zone
    allPositions: PositionWithZone[]
    occupiedIds: Set<string>
    lotInfo: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>,
        inbound_date?: string,
        created_at?: string,
        tags?: string[]
    }>
    onClose: () => void
}

export function GroupedZoneDetailModal({
    zone,
    allPositions,
    occupiedIds,
    lotInfo,
    onClose
}: GroupedZoneDetailModalProps) {
    const occupiedCount = allPositions.filter(p => occupiedIds.has(p.id)).length

    // Sort positions by code for display
    const sortedPositions = [...allPositions].sort((a, b) =>
        (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
    )

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Chi tiết {zone.name}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Tổng quan các vị trí trong khu vực
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Table Header */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 grid grid-cols-12 gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3">VỊ TRÍ</div>
                    <div className="col-span-3">MÃ LÔ (LOT)</div>
                    <div className="col-span-4">SẢN PHẨM</div>
                    <div className="col-span-2 text-right">TỒN KHO</div>
                </div>

                {/* Content Container (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-2 sm:p-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="space-y-2">
                        {sortedPositions.map(pos => {
                            const isOccupied = occupiedIds.has(pos.id)
                            const lot = pos.lot_id ? lotInfo[pos.lot_id] : null

                            // Get quantity and unit string
                            let displayProduct = ''
                            let displayQty = ''

                            if (lot && lot.items && lot.items.length > 0) {
                                if (lot.items.length === 1) {
                                    displayProduct = lot.items[0].product_name
                                    displayQty = `${lot.items[0].quantity} ${lot.items[0].unit}`
                                } else {
                                    displayProduct = `Nhiều sản phẩm (${lot.items.length})`
                                    displayQty = '...'
                                }
                            }

                            return (
                                <div
                                    key={pos.id}
                                    className={`
                                        grid grid-cols-12 gap-4 items-center p-3 rounded-lg border bg-white dark:bg-slate-800
                                        ${isOccupied ? 'border-indigo-100 dark:border-indigo-900/50 shadow-sm' : 'border-slate-100 dark:border-slate-800 opacity-60'}
                                    `}
                                >
                                    <div className="col-span-3 flex items-center gap-3">
                                        <div className={`p-1.5 rounded-md ${isOccupied ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                            <Package size={14} />
                                        </div>
                                        <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate" title={pos.code}>
                                            {pos.code}
                                        </span>
                                    </div>

                                    <div className="col-span-3 min-w-0">
                                        {isOccupied && lot ? (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 truncate max-w-full" title={lot.code}>
                                                <Hash size={10} className="text-slate-400" />
                                                <span className="truncate">{lot.code.substring(0, 12)}{lot.code.length > 12 ? '...' : ''}</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Trống</span>
                                        )}
                                    </div>

                                    <div className="col-span-4">
                                        {isOccupied && lot ? (
                                            <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2" title={displayProduct}>
                                                {displayProduct}
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400">-</div>
                                        )}
                                    </div>

                                    <div className="col-span-2 text-right">
                                        {isOccupied && lot ? (
                                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                {displayQty}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400">-</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center text-sm">
                    <div className="text-slate-500">
                        Tổng <span className="font-bold text-slate-700 dark:text-slate-300">{allPositions.length}</span> vị trí
                    </div>
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-indigo-500"></div>
                            <span className="text-slate-600 dark:text-slate-300">Đã lấp đầy: <strong>{occupiedCount}</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-sm bg-slate-200 dark:bg-slate-700"></div>
                            <span className="text-slate-600 dark:text-slate-300">Trống: <strong>{allPositions.length - occupiedCount}</strong></span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
