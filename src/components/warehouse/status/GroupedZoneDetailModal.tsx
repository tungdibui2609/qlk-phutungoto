import React, { useMemo } from 'react'
import { X, Package, Hash } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { getProductColorStyle } from '@/lib/warehouseUtils'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface GroupedZoneDetailModalProps {
    zone: Zone
    allPositions: PositionWithZone[]
    zones: Zone[]
    occupiedIds: Set<string>
    lotInfo: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[], internal_code?: string, internal_name?: string, product_color?: string | null }>,
        inbound_date?: string,
        created_at?: string,
        tags?: string[]
    }>
    displayInternalInfo?: boolean
    onClose: () => void
}

export function GroupedZoneDetailModal({
    zone,
    allPositions,
    zones,
    occupiedIds,
    lotInfo,
    onClose,
    displayInternalInfo
}: GroupedZoneDetailModalProps) {
    const occupiedCount = allPositions.filter(p => occupiedIds.has(p.id)).length

    // Group positions by Level
    const positionsByLevel = useMemo(() => {
        const groups = new Map<string, { zone: Zone, positions: PositionWithZone[] }>()
        
        allPositions.forEach(pos => {
            const zid = pos.zone_id || 'unknown'
            if (!groups.has(zid)) {
                const lvlZone = zones.find(z => z.id === zid)
                groups.set(zid, { 
                    zone: lvlZone || { name: 'Không rõ tầng', id: zid } as any, 
                    positions: [] as PositionWithZone[]
                })
            }
            groups.get(zid)!.positions.push(pos)
        })

        // Sort groups by display_order
        return Array.from(groups.values()).sort((a, b) => {
            const oa = (a.zone as any).display_order ?? 0
            const ob = (b.zone as any).display_order ?? 0
            if (oa !== ob) return oa - ob
            return (a.zone.name || '').localeCompare(b.zone.name || '', undefined, { numeric: true })
        })
    }, [allPositions, zones])

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Chi tiết {zone.name}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Tổng quan các vị trí trong khu vực (Nhóm theo tầng)
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
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 grid grid-cols-12 gap-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                    <div className="col-span-2">VỊ TRÍ</div>
                    <div className="col-span-3">MÃ LÔ (LOT)</div>
                    <div className="col-span-5">SẢN PHẨM / CHI TIẾT</div>
                    <div className="col-span-2 text-right">SỐ LƯỢNG</div>
                </div>

                {/* Content Container (Scrollable) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {positionsByLevel.map(group => (
                        <div key={group.zone.id} className="mb-6">
                            {/* Level Header Separator */}
                            <div className="sticky top-0 z-10 px-6 py-2 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm border-y border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">
                                    {group.zone.name} ({group.positions.length} vị trí)
                                </span>
                            </div>

                            <div className="p-2 sm:p-4 space-y-2">
                                {group.positions
                                    .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
                                    .map(pos => {
                                        const isOccupied = occupiedIds.has(pos.id)
                                        const lot = pos.lot_id ? lotInfo[pos.lot_id] : null

                                        // Get quantity and unit string
                                        let displayProduct = ''
                                        let displayQty = ''

                                        if (lot && lot.items && lot.items.length > 0) {
                                            if (lot.items.length === 1) {
                                                const item = lot.items[0]
                                                displayProduct = displayInternalInfo && item.internal_name ? item.internal_name : item.product_name
                                                displayQty = `${item.quantity} ${item.unit}`
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
                                                <div className="col-span-2 flex items-center gap-3">
                                                    {(() => {
                                                        const pColor = lot?.items?.find((item: any) => item.product_color)?.product_color;
                                                        const colorStyle = getProductColorStyle(pColor);
                                                        const hasColor = !!pColor;
                                                        const isBright = pColor && !pColor.includes(',') ? false : true; // Simple logic for gradient as "bright" or special

                                                        return (
                                                            <div 
                                                                className={`p-1.5 rounded-md shadow-sm border ${isOccupied ? '' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                                                                style={isOccupied ? { 
                                                                    ...colorStyle,
                                                                    color: hasColor ? 'white' : undefined,
                                                                    borderColor: 'rgba(0,0,0,0.1)'
                                                                } : {}}
                                                            >
                                                                <Package size={14} className={isOccupied && hasColor ? 'drop-shadow-sm' : ''} />
                                                            </div>
                                                        );
                                                    })()}
                                                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 truncate" title={pos.code}>
                                                        {pos.code?.split('.').pop() || pos.code}
                                                    </span>
                                                </div>

                                                <div className="col-span-3 min-w-0">
                                                    {isOccupied && lot ? (
                                                        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors group cursor-default">
                                                            <Hash size={12} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                                            <span className="text-xs font-mono font-black text-slate-900 dark:text-slate-100 tracking-tight">{lot.code}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Trống</span>
                                                    )}
                                                </div>

                                                <div className="col-span-5">
                                                    {isOccupied && lot ? (
                                                        <div className="flex flex-col gap-1.5">
                                                            {lot.items.length === 1 ? (
                                                                <>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[10px] font-black text-white bg-indigo-600 dark:bg-indigo-500 px-1.5 py-0.5 rounded shadow-sm">
                                                                                {displayInternalInfo && lot.items[0].internal_code ? lot.items[0].internal_code : lot.items[0].sku}
                                                                            </span>
                                                                            {displayInternalInfo && lot.items[0].internal_code && lot.items[0].internal_code !== lot.items[0].sku && (
                                                                                <span className="text-[9px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                                                                                    SKU: {lot.items[0].sku}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {lot.items[0].tags?.map((tag: string, ti: number) => (
                                                                            <span key={ti} className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-100 dark:border-amber-800 uppercase tracking-tighter shadow-sm">{tag}</span>
                                                                        ))}
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={displayProduct}>
                                                                            {displayProduct}
                                                                        </div>
                                                                        {displayInternalInfo && lot.items[0].internal_name && lot.items[0].internal_name !== lot.items[0].product_name && (
                                                                            <div className="text-[10px] text-slate-400 italic leading-none mt-0.5">
                                                                                Gốc: {lot.items[0].product_name}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
                                                                    {`Nhiều sản phẩm (${lot.items.length})`}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-400 tracking-widest opacity-30">---</div>
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
                    ))}
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
