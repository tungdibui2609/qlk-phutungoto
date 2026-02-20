import { useMemo, useState } from 'react'
import { ChevronDown, MoreHorizontal, Eye, CheckSquare, Square } from 'lucide-react'
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
}

export function MapSearchStats({
    filteredPositions,
    zones,
    lotInfo,
    searchTerm,
    onPositionSelect,
    onPositionMenu,
    onViewDetails,
    selectedPositionIds = new Set(),
    onBulkSelect
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

        const zoneStats: Record<string, { id: string; count: number; quantity: number; name: string }> = {}
        let totalQty = 0

        filteredPositions.forEach(pos => {
            // Calculate Quantity
            let qty = 0
            if (pos.lot_id && lotInfo[pos.lot_id]) {
                const lot = lotInfo[pos.lot_id]
                const items = lot.items || []
                qty = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
            }
            totalQty += qty

            // Group by Zone
            if (pos.zone_id) {
                if (!zoneStats[pos.zone_id]) {
                    zoneStats[pos.zone_id] = {
                        id: pos.zone_id,
                        count: 0,
                        quantity: 0,
                        name: getZonePath(pos.zone_id)
                    }
                }
                zoneStats[pos.zone_id].count++
                zoneStats[pos.zone_id].quantity += qty
            }
        })

        // Sort zones by count descending
        const sortedZones = Object.values(zoneStats).sort((a, b) => b.count - a.count)

        return {
            totalPositions: filteredPositions.length,
            totalQuantity: totalQty,
            zoneBreakdown: sortedZones
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
                key={pos.id}
                className={`relative group flex flex-col p-1 rounded border ${bgClass} ${borderClass} aspect-square text-[10px] transition-all hover:shadow-md`}
            >
                {/* Selection Checkbox */}
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

                {/* View Details Eye Icon */}
                {hasLot && onViewDetails && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onViewDetails(pos.lot_id!)
                        }}
                        className="absolute top-1 left-1 z-10 p-0.5 rounded bg-white/80 dark:bg-gray-800/80 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-all"
                        title="Xem chi tiết"
                    >
                        <Eye size={14} />
                    </button>
                )}

                {/* Context Menu Icon */}
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

                <div className="font-bold text-center text-slate-700 dark:text-slate-200 mb-0.5 border-b border-slate-100 dark:border-slate-700/50 pb-0.5 truncate text-[10px] pt-4" title={pos.code}>
                    {pos.code}
                </div>
                {lot ? (
                    <div className="flex flex-col gap-0.5 flex-1 justify-center overflow-hidden">
                        <div className="font-medium text-center text-purple-600 dark:text-purple-400 truncate text-[9px]" title={lot.code}>{lot.code}</div>
                        {lot.items?.[0] && (
                            <>
                                <div className="text-[9px] text-slate-500 line-clamp-2 text-center" title={lot.items[0].product_name}>
                                    {lot.items[0].product_name}
                                </div>
                                <div className="font-mono text-[9px] text-blue-600 dark:text-blue-400 mt-auto font-bold text-center">
                                    {lot.items[0].quantity} {lot.items[0].unit}
                                </div>
                            </>
                        )}
                        {!lot.items?.[0] && lot.products && (
                            <>
                                <div className="text-[9px] text-slate-500 line-clamp-2 text-center" title={lot.products.name}>
                                    {lot.products.name}
                                </div>
                                <div className="font-mono text-[9px] text-blue-600 dark:text-blue-400 mt-auto font-bold text-center">
                                    {lot.quantity} {lot.products.unit}
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="text-slate-400 italic mt-auto text-[10px] text-center mb-auto pt-2">Trống</div>
                )}
            </div>
        )
    }

    if (!stats || !searchTerm) return null

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span>Kết quả tìm kiếm:</span>
                <span className="text-orange-600 dark:text-orange-400">"{searchTerm}"</span>
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

                                {/* Expanded Position Grid */}
                                {isExpanded && (
                                    <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50">
                                        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                                            {zonePositions.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })).map(pos => renderPositionCard(pos))}
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
