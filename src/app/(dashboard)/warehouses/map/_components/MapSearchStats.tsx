import React, { useMemo, useState } from 'react'
import { ChevronDown, MoreHorizontal, CheckSquare, Square, Eye, ArrowUpDown } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { PositionWithZone } from '../_hooks/useWarehouseData'

type Zone = Database['public']['Tables']['zones']['Row']
type Position = Database['public']['Tables']['positions']['Row']

interface MapSearchStatsProps {
    filteredPositions: PositionWithZone[]
    zones: Zone[]
    lotInfo: Record<string, any>
    searchTerm: string
    onPositionSelect?: (positionId: string) => void
    onPositionMenu?: (pos: Position, e: React.MouseEvent) => void
    onViewDetails?: (lotId: string) => void
    selectedPositionIds?: Set<string>
    onBulkSelect?: (ids: string[], shouldSelect: boolean) => void
    isFifoEnabled?: boolean
    isFifoAvailable?: boolean
    onToggleFifo?: () => void
}

interface PositionCardProps {
    pos: PositionWithZone
    lot: any
    isSelected: boolean
    onPositionSelect?: (positionId: string) => void
    onPositionMenu?: (pos: Position, e: React.MouseEvent) => void
    onViewDetails?: (lotId: string) => void
}

const MemoizedPositionCard = React.memo(function PositionCard({
    pos,
    lot,
    isSelected,
    onPositionSelect,
    onPositionMenu,
    onViewDetails
}: PositionCardProps) {
    const hasLot = !!pos.lot_id
    let bgClass = "bg-white dark:bg-slate-800"
    let borderClass = "border-slate-200 dark:border-slate-700"

    if (isSelected) {
        bgClass = "bg-blue-50 dark:bg-blue-900/30"
        borderClass = "border-blue-500"
    } else if (hasLot) {
        bgClass = "bg-amber-50 dark:bg-amber-900/10"
        borderClass = "border-amber-200 dark:border-amber-800"
    }

    return (
        <div
            className={`relative group flex flex-col p-1 rounded border ${bgClass} ${borderClass} aspect-square text-[10px] transition-all hover:shadow-md ${hasLot ? 'hover:border-blue-300' : ''}`}
        >
            {onPositionSelect && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onPositionSelect(pos.id)
                    }}
                    className={`absolute bottom-1 left-1 z-10 p-0.5 rounded bg-white/80 dark:bg-gray-800/80 hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}
                    title={isSelected ? "Bỏ chọn" : "Chọn vị trí"}
                >
                    {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
            )}

            {onPositionMenu && (
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onPositionMenu(pos, e)
                    }}
                    className="absolute top-1 right-1 z-20 p-0.5 rounded bg-white/80 dark:bg-gray-800/80 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                    title="Thao tác"
                >
                    <MoreHorizontal size={14} />
                </button>
            )}

            {hasLot && lot && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onViewDetails?.(pos.lot_id!)
                    }}
                    className="absolute left-1 top-1 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 transition-colors z-20"
                    title="Xem chi tiết LOT"
                >
                    <Eye size={12} />
                </button>
            )}

            <div className="font-bold text-center text-slate-700 dark:text-slate-200 mb-0.5 border-b border-slate-100 dark:border-slate-700/50 pb-0.5 truncate text-[10px] pt-4">
                {pos.code}
            </div>
            {lot ? (
                <div className="flex flex-col gap-0.5 flex-1 justify-center overflow-hidden">
                    {lot.items?.[0] ? (
                        <>
                            <div className="font-bold text-center text-teal-700 dark:text-teal-400 truncate text-[9px]">
                                {lot.items[0].sku}
                            </div>
                            <div className="text-[9px] text-slate-500 line-clamp-2 text-center">
                                {lot.items[0].product_name}
                            </div>
                            <div className="font-mono text-[9px] text-blue-600 dark:text-blue-400 mt-auto font-bold text-center">
                                {lot.items[0].quantity} {lot.items[0].unit}
                            </div>
                        </>
                    ) : lot.products ? (
                        <>
                            <div className="font-bold text-center text-teal-700 dark:text-teal-400 truncate text-[9px]">
                                {lot.products.sku}
                            </div>
                            <div className="text-[9px] text-slate-500 line-clamp-2 text-center">
                                {lot.products.name}
                            </div>
                            <div className="font-mono text-[9px] text-blue-600 dark:text-blue-400 mt-auto font-bold text-center">
                                {lot.quantity} {lot.products.unit}
                            </div>
                        </>
                    ) : null}
                </div>
            ) : (
                <div className="text-slate-400 italic mt-auto text-[10px] text-center mb-auto pt-2">Trống</div>
            )}
            {/* Date info - same logic as FlexibleZoneGrid */}
            {lot && (() => {
                const dates: string[] = []
                if (lot.peeling_date) {
                    dates.push(`B: ${new Date(lot.peeling_date).toLocaleDateString('vi-VN')}`)
                }
                if (lot.packaging_date) {
                    dates.push(`Đ: ${new Date(lot.packaging_date).toLocaleDateString('vi-VN')}`)
                }
                if (lot.inbound_date && !lot.peeling_date && !lot.packaging_date) {
                    dates.push(`N: ${new Date(lot.inbound_date).toLocaleDateString('vi-VN')}`)
                }
                if (dates.length === 0) return null
                return (
                    <div className="text-[8px] text-orange-600 dark:text-orange-400 font-bold text-center border-t border-slate-100 dark:border-slate-700/50 pt-0.5 mt-auto leading-tight">
                        {dates.join(' | ')}
                    </div>
                )
            })()}
        </div>
    )
}, (prev, next) => {
    return prev.pos.id === next.pos.id &&
        prev.pos.lot_id === next.pos.lot_id &&
        prev.isSelected === next.isSelected &&
        prev.lot === next.lot
})

export function MapSearchStats({
    filteredPositions,
    zones,
    lotInfo,
    searchTerm,
    onPositionSelect,
    onPositionMenu,
    onViewDetails,
    selectedPositionIds = new Set(),
    onBulkSelect,
    isFifoEnabled,
    isFifoAvailable,
    onToggleFifo
}: MapSearchStatsProps) {
    // Helper to build full zone path
    const getZonePath = (zoneId: string) => {
        let currentId: string | null = zoneId
        const parts: string[] = []
        while (currentId) {
            const z = zones.find(z => z.id === currentId)
            if (z) {
                parts.unshift(z.name)
                currentId = z.parent_id
            } else {
                break
            }
        }
        return parts.join(' • ')
    }

    const stats = useMemo(() => {
        if (!searchTerm) return null

        const zoneStats: Record<string, { id: string; count: number; quantity: number; name: string; oldestDate: string | null; newestDate: string | null }> = {}
        let totalQty = 0
        let globalOldest: string | null = null
        let globalNewest: string | null = null

        filteredPositions.forEach(pos => {
            // Calculate Quantity
            let qty = 0
            let posDate: string | null = null
            if (pos.lot_id && lotInfo[pos.lot_id]) {
                const lot = lotInfo[pos.lot_id]
                const items = lot.items || []
                qty = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
                posDate = lot.inbound_date || lot.created_at || null
            }
            totalQty += qty

            // Track global oldest/newest
            if (posDate) {
                if (!globalOldest || posDate < globalOldest) globalOldest = posDate
                if (!globalNewest || posDate > globalNewest) globalNewest = posDate
            }

            // Group by Zone
            if (pos.zone_id) {
                if (!zoneStats[pos.zone_id]) {
                    zoneStats[pos.zone_id] = {
                        id: pos.zone_id,
                        count: 0,
                        quantity: 0,
                        name: getZonePath(pos.zone_id),
                        oldestDate: null,
                        newestDate: null
                    }
                }
                zoneStats[pos.zone_id].count++
                zoneStats[pos.zone_id].quantity += qty
                if (posDate) {
                    const z = zoneStats[pos.zone_id]
                    if (!z.oldestDate || posDate < z.oldestDate) z.oldestDate = posDate
                    if (!z.newestDate || posDate > z.newestDate) z.newestDate = posDate
                }
            }
        })

        // Sort zones by count descending
        const sortedZones = Object.values(zoneStats).sort((a, b) => b.count - a.count)

        return {
            totalPositions: filteredPositions.length,
            totalQuantity: totalQty,
            zoneBreakdown: sortedZones,
            oldestDate: globalOldest,
            newestDate: globalNewest
        }
    }, [filteredPositions, zones, lotInfo, searchTerm])

    // State for expanded zones
    const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null)

    // Helper to toggle expansion
    const toggleZone = (id: string) => {
        setExpandedZoneId(prev => prev === id ? null : id)
    }

    // Helper to render a simplified position card
    const renderPositionCard = (pos: PositionWithZone) => {
        const hasLot = !!pos.lot_id
        const lot = hasLot ? lotInfo[pos.lot_id!] : null
        const isSelected = selectedPositionIds.has(pos.id)

        return (
            <MemoizedPositionCard
                key={pos.id}
                pos={pos}
                lot={lot}
                isSelected={isSelected}
                onPositionSelect={onPositionSelect}
                onPositionMenu={onPositionMenu}
                onViewDetails={onViewDetails}
            />
        )
    }

    if (!stats || !searchTerm) return null

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span>Kết quả tìm kiếm:</span>
                <span className="text-orange-600 dark:text-orange-400">"{searchTerm}"</span>
                {isFifoAvailable && (
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none ml-auto">
                        <button
                            role="switch"
                            aria-checked={isFifoEnabled}
                            onClick={onToggleFifo}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${isFifoEnabled
                                ? 'bg-orange-500'
                                : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                        >
                            <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isFifoEnabled ? 'translate-x-[22px]' : 'translate-x-[2px]'
                                    }`}
                            />
                        </button>
                        <span className={`text-sm font-semibold ${isFifoEnabled
                            ? 'text-slate-800 dark:text-slate-200'
                            : 'text-slate-400 dark:text-slate-500'
                            }`}>
                            Ưu tiên FIFO
                        </span>
                    </label>
                )}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Vị trí tìm thấy</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                        {stats.totalPositions} <span className="text-sm font-normal text-slate-500">vị trí</span>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Tổng số lượng</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white">
                        {stats.totalQuantity.toLocaleString()}
                    </div>
                </div>
            </div>

            {/* FIFO Date Range Info */}
            {isFifoEnabled && (stats.oldestDate || stats.newestDate) && (
                <div className="mb-4 px-3 py-2 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/20">
                    <div className="text-xs font-bold text-orange-700 dark:text-orange-400">
                        Ngày cũ nhất: {stats.oldestDate ? new Date(stats.oldestDate).toLocaleDateString('vi-VN') : '--'}
                    </div>
                    <div className="text-xs font-bold text-orange-700 dark:text-orange-400">
                        Ngày mới nhất: {stats.newestDate ? new Date(stats.newestDate).toLocaleDateString('vi-VN') : '--'}
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phân bố theo khu vực</div>
                <div className="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
                    {stats.zoneBreakdown.map((zone, idx) => {
                        const isExpanded = expandedZoneId === zone.id
                        // Filter positions for this zone
                        const zonePositions = filteredPositions.filter(p => p.zone_id === zone.id)
                        const allSelected = zonePositions.length > 0 && zonePositions.every(p => selectedPositionIds.has(p.id))

                        return (
                            <div key={idx} className="flex flex-col bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded overflow-hidden">
                                {/* Zone Header Row */}
                                <div
                                    className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors select-none"
                                    onClick={() => toggleZone(zone.id)}
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {onBulkSelect && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onBulkSelect(
                                                        zonePositions.map(p => p.id),
                                                        !allSelected
                                                    )
                                                }}
                                                className={`p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors ${allSelected ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                title={allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                            >
                                                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                            </button>
                                        )}
                                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate text-sm" title={zone.name}>
                                            {zone.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs shrink-0 ml-2">
                                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                            {zone.count} vt
                                        </span>
                                        {zone.quantity > 0 && (
                                            <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                                                {zone.quantity.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Per-zone FIFO date info */}
                                {isFifoEnabled && (zone.oldestDate || zone.newestDate) && (
                                    <div className="px-3 pb-1.5 -mt-0.5">
                                        <div className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                            Ngày cũ nhất: {zone.oldestDate ? new Date(zone.oldestDate).toLocaleDateString('vi-VN') : '--'}
                                        </div>
                                        <div className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                            Ngày mới nhất: {zone.newestDate ? new Date(zone.newestDate).toLocaleDateString('vi-VN') : '--'}
                                        </div>
                                    </div>
                                )}

                                {/* Expanded Position Grid */}
                                {isExpanded && (
                                    <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                                        {isFifoEnabled && (
                                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                                                <ArrowUpDown size={10} />
                                                Sắp xếp theo ngày nhập kho (cũ nhất trước)
                                            </div>
                                        )}
                                        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                                            {[...zonePositions].sort((a, b) => {
                                                if (isFifoEnabled) {
                                                    const lotA = a.lot_id ? lotInfo[a.lot_id] : null
                                                    const lotB = b.lot_id ? lotInfo[b.lot_id] : null
                                                    if (!lotA && !lotB) return 0
                                                    if (!lotA) return 1
                                                    if (!lotB) return -1
                                                    const dateA = lotA.inbound_date || lotA.created_at || ''
                                                    const dateB = lotB.inbound_date || lotB.created_at || ''
                                                    return dateA.localeCompare(dateB)
                                                }
                                                return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
                                            }).map(pos => renderPositionCard(pos))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
