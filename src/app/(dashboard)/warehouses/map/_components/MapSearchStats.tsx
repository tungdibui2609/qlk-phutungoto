import { useMemo } from 'react'
import { Database } from '@/lib/database.types'
import { PositionWithZone } from '../_hooks/useWarehouseData'

type Zone = Database['public']['Tables']['zones']['Row']

interface MapSearchStatsProps {
    filteredPositions: PositionWithZone[]
    zones: Zone[]
    lotInfo: Record<string, any>
    searchTerm: string
}

export function MapSearchStats({ filteredPositions, zones, lotInfo, searchTerm }: MapSearchStatsProps) {
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

        const zoneStats: Record<string, { count: number; quantity: number; name: string }> = {}
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
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                    {stats.zoneBreakdown.map((zone, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-300 mr-2 flex-1 break-words" title={zone.name}>
                                {zone.name}
                            </span>
                            <div className="flex items-center gap-3 text-xs shrink-0">
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
                    ))}
                </div>
            </div>
        </div>
    )
}
