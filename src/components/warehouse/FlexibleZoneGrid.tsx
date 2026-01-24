'use client'
import React, { useMemo } from 'react'
import { ChevronDown, ChevronRight, Package, Settings, Eye, MoreHorizontal } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface FlexibleZoneGridProps {
    zones: Zone[]
    positions: PositionWithZone[]
    layouts: Record<string, ZoneLayout>
    occupiedIds: Set<string>
    collapsedZones: Set<string>
    selectedPositionIds: Set<string>
    isDesignMode?: boolean
    onToggleCollapse: (zoneId: string) => void
    onPositionSelect: (positionId: string) => void
    onViewDetails?: (lotId: string) => void
    onPositionMenu?: (pos: Position, e: React.MouseEvent) => void
    onConfigureZone?: (zone: Zone) => void
    highlightLotId?: string | null
    lotInfo?: Record<string, { code: string, items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>, inbound_date?: string, created_at?: string, packaging_date?: string, peeling_date?: string, tags?: string[] }>
}

export default function FlexibleZoneGrid({
    zones,
    positions,
    layouts,
    occupiedIds,
    collapsedZones,
    selectedPositionIds,
    isDesignMode = false,
    onToggleCollapse,
    onPositionSelect,
    onViewDetails,
    onPositionMenu,
    onConfigureZone,
    highlightLotId,
    lotInfo = {}
}: FlexibleZoneGridProps) {

    // Build zone tree with positions count
    const zoneTree = useMemo(() => {
        const map = new Map<string, Zone & { children: Zone[], positions: PositionWithZone[] }>()

        // Initialize all zones
        zones.forEach(z => {
            map.set(z.id, { ...z, children: [], positions: [] })
        })

        // Attach positions to zones
        positions.forEach(p => {
            if (p.zone_id && map.has(p.zone_id)) {
                map.get(p.zone_id)!.positions.push(p)
            }
        })

        // Build parent-child relationships
        zones.forEach(z => {
            if (z.parent_id && map.has(z.parent_id)) {
                map.get(z.parent_id)!.children.push(map.get(z.id)!)
            }
        })

        // Sort children by code
        map.forEach(node => {
            node.children.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
            node.positions.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
        })

        // Get root zones (zones with no parent OR parent not in the current list)
        return zones
            .filter(z => !z.parent_id || !map.has(z.parent_id))
            .map(z => map.get(z.id)!)
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [zones, positions])

    // Recursive render function
    function renderZone(
        zone: Zone & { children: Zone[], positions: PositionWithZone[] },
        depth: number = 0,
        breadcrumb: string[] = []
    ): React.ReactNode {
        const layout = layouts[zone.id] as any
        const isCollapsed = collapsedZones.has(zone.id)
        const hasChildren = zone.children.length > 0
        const hasPositions = zone.positions.length > 0
        const positionColumns = layout?.position_columns ?? 8
        const cellWidth = layout?.cell_width ?? 0
        const cellHeight = layout?.cell_height ?? 0
        const childLayout = layout?.child_layout ?? 'vertical'
        const childColumns = layout?.child_columns ?? 0
        const childWidth = layout?.child_width ?? 0
        const collapsible = layout?.collapsible ?? true
        const displayType = layout?.display_type ?? 'auto'

        // Build breadcrumb path (needed for all display types including hidden)
        const currentBreadcrumb = [...breadcrumb, zone.name]

        // Handle hidden display type
        if (displayType === 'hidden') {
            // In Design Mode: Show zone with ghost styling AND render children inside
            if (isDesignMode) {
                return (
                    <div
                        key={zone.id}
                        className="rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 overflow-hidden bg-orange-50/30 dark:bg-orange-900/10"
                    >
                        {/* Ghost Header - indicates hidden zone */}
                        <div className="flex items-center justify-between px-4 py-2 bg-orange-100/50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">ẨN</span>
                                <span className="font-mono text-xs text-gray-500">{zone.code}</span>
                                <span className="font-medium text-sm text-gray-500 dark:text-gray-400 line-through">
                                    {zone.name}
                                </span>
                                <span className="text-xs text-orange-500">
                                    (Zone con sẽ hiển thị trực tiếp khi thoát)
                                </span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onConfigureZone?.(zone)
                                }}
                                className="flex items-center gap-1 px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-xs font-medium transition-colors"
                            >
                                <Settings size={12} />
                                Cấu hình
                            </button>
                        </div>
                        {/* Render children so they can be configured in Design Mode */}
                        <div className="p-3 space-y-3">
                            {/* Render positions if any */}
                            {hasPositions && (
                                <div
                                    className="grid gap-2"
                                    style={{
                                        gridTemplateColumns: cellWidth > 0
                                            ? `repeat(${positionColumns}, ${cellWidth}px)`
                                            : `repeat(${positionColumns}, minmax(0, 1fr))`
                                    }}
                                >
                                    {zone.positions.map(pos => renderPositionCell(pos, cellHeight))}
                                </div>
                            )}
                            {/* Render child zones */}
                            {zone.children.map(child => renderZone(child as any, depth + 1, currentBreadcrumb))}
                        </div>
                    </div>
                )
            }

            // Normal mode: Render children directly without this zone's wrapper
            // This "bubbles up" children to take parent's place
            return (
                <div key={zone.id} className="contents">
                    {/* Render direct positions if any */}
                    {hasPositions && (
                        <div
                            className="grid gap-2 mb-3"
                            style={{
                                gridTemplateColumns: cellWidth > 0
                                    ? `repeat(${positionColumns}, ${cellWidth}px)`
                                    : `repeat(${positionColumns}, minmax(0, 1fr))`
                            }}
                        >
                            {zone.positions.map(pos => renderPositionCell(pos, cellHeight))}
                        </div>
                    )}
                    {/* Render children directly at current level - pass currentBreadcrumb to include hidden parent names */}
                    {zone.children.map(child => renderZone(child as any, depth, currentBreadcrumb))}
                </div>
            )
        }

        // Skip empty zones (no children, no positions)
        if (!hasChildren && !hasPositions) return null


        // Calculate total positions (including nested)
        const totalPositions = countAllPositions(zone)

        // Determine effective display type
        const effectiveDisplayType = displayType === 'auto'
            ? (hasPositions && !hasChildren ? 'grid' : 'header')
            : displayType

        // Render based on display type
        switch (effectiveDisplayType) {
            case 'grid':
                // Grid mode: Show breadcrumb header + positions directly
                return (
                    <div key={zone.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                        {/* QLK-style header with breadcrumb */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800 border-b border-emerald-100 dark:border-emerald-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-8 bg-emerald-500 rounded-full"></div>
                                <div>
                                    <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 tracking-tight">
                                        {currentBreadcrumb.join(' • ')}
                                    </h2>
                                    {totalPositions > 0 && (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                            {totalPositions} vị trí
                                        </p>
                                    )}
                                </div>
                            </div>
                            {isDesignMode && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onConfigureZone?.(zone)
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
                                >
                                    <Settings size={12} />
                                    Cấu hình
                                </button>
                            )}
                        </div>

                        {/* Positions grid */}
                        <div className="p-4">
                            <div
                                className="grid gap-2"
                                style={{
                                    gridTemplateColumns: cellWidth > 0
                                        ? `repeat(${positionColumns}, ${cellWidth}px)`
                                        : `repeat(${positionColumns}, minmax(0, 1fr))`
                                }}
                            >
                                {zone.positions.map(pos => renderPositionCell(pos, cellHeight))}
                            </div>

                            {/* Also render child zones if any */}
                            {hasChildren && (
                                <div className="mt-4 space-y-3">
                                    {zone.children.map(child => renderZone(child as any, depth + 1, currentBreadcrumb))}
                                </div>
                            )}
                        </div>
                    </div>
                )

            case 'section':
                // Section mode: Compact section with nice breadcrumb header like Grid
                return (
                    <div key={zone.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
                        {/* QLK-style header with breadcrumb - same as Grid mode */}
                        <div
                            className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-gray-800 border-b border-emerald-100 dark:border-emerald-900/50 cursor-pointer"
                            onClick={() => collapsible && onToggleCollapse(zone.id)}
                        >
                            <div className="flex items-center gap-3">
                                {collapsible && (
                                    isCollapsed
                                        ? <ChevronRight size={16} className="text-emerald-500" />
                                        : <ChevronDown size={16} className="text-emerald-500" />
                                )}
                                <div className="w-1 h-8 bg-emerald-500 rounded-full"></div>
                                <div>
                                    <h2 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 tracking-tight">
                                        {currentBreadcrumb.join(' • ')}
                                    </h2>
                                    {totalPositions > 0 && (
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                            {totalPositions} vị trí
                                        </p>
                                    )}
                                </div>
                            </div>
                            {isDesignMode && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onConfigureZone?.(zone)
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
                                >
                                    <Settings size={12} />
                                    Cấu hình
                                </button>
                            )}
                        </div>

                        {/* Section content */}
                        {!isCollapsed && (
                            <div className="p-4 space-y-3">
                                {hasPositions && (
                                    <div
                                        className="grid gap-2"
                                        style={{
                                            gridTemplateColumns: cellWidth > 0
                                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                                : `repeat(${positionColumns}, minmax(0, 1fr))`
                                        }}
                                    >
                                        {zone.positions.map(pos => renderPositionCell(pos, cellHeight))}
                                    </div>
                                )}
                                {hasChildren && (
                                    <div className={childLayout === 'horizontal' ? 'flex gap-3 overflow-x-auto pb-2' : 'space-y-3'}>
                                        {zone.children.map(child => renderZone(child as any, depth + 1, currentBreadcrumb))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )

            case 'header':
            default:
                // Header mode: Just header, children below (default/auto)
                return (
                    <div
                        key={zone.id}
                        className={`rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${depth === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'
                            }`}
                    >
                        {/* Zone Header */}
                        <div
                            className={`flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors ${depth === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : ''
                                }`}
                            onClick={() => collapsible && onToggleCollapse(zone.id)}
                        >
                            <div className="flex items-center gap-2">
                                {collapsible && (hasChildren || hasPositions) && (
                                    isCollapsed
                                        ? <ChevronRight size={16} className="text-gray-400" />
                                        : <ChevronDown size={16} className="text-gray-400" />
                                )}
                                <span className={`font-medium ${depth === 0 ? 'text-base' : 'text-sm'} text-gray-900 dark:text-white`}>
                                    {zone.name}
                                </span>
                                {totalPositions > 0 && (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                                        {totalPositions} vị trí
                                    </span>
                                )}
                            </div>

                            {/* Design mode: configure button */}
                            {isDesignMode && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onConfigureZone?.(zone)
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium transition-colors"
                                >
                                    <Settings size={12} />
                                    Cấu hình
                                </button>
                            )}
                        </div>

                        {/* Zone Content */}
                        {!isCollapsed && (
                            <div className="p-3">
                                {/* Render positions of this zone */}
                                {hasPositions && (
                                    <div
                                        className="grid gap-2 mb-3"
                                        style={{
                                            gridTemplateColumns: cellWidth > 0
                                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                                : `repeat(${positionColumns}, minmax(0, 1fr))`
                                        }}
                                    >
                                        {zone.positions.map(pos => renderPositionCell(pos, cellHeight))}
                                    </div>
                                )}

                                {/* Render child zones */}
                                {hasChildren && (
                                    <div
                                        className={
                                            childLayout === 'horizontal'
                                                ? 'flex gap-3 overflow-x-auto pb-2'
                                                : childLayout === 'grid'
                                                    ? `grid gap-3`
                                                    : 'space-y-3'
                                        }
                                        style={
                                            childLayout === 'grid' && childColumns > 0
                                                ? { gridTemplateColumns: `repeat(${childColumns}, minmax(0, 1fr))` }
                                                : childLayout === 'grid'
                                                    ? { gridTemplateColumns: `repeat(auto-fill, minmax(300px, 1fr))` }
                                                    : undefined
                                        }
                                    >
                                        {zone.children.map(child => (
                                            <div
                                                key={child.id}
                                                className={childLayout === 'horizontal' ? 'flex-shrink-0' : ''}
                                                style={
                                                    childLayout === 'horizontal' && childWidth > 0
                                                        ? { width: `${childWidth}px` }
                                                        : undefined
                                                }
                                            >
                                                {renderZone(child as any, depth + 1, currentBreadcrumb)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
        }
    }

    // Helper function to render a position cell
    function renderPositionCell(pos: PositionWithZone, cellHeight: number): React.ReactNode {
        const isOccupied = occupiedIds.has(pos.id)
        const isSelected = selectedPositionIds.has(pos.id)

        // LOT Visualization Logic
        const hasLot = !!pos.lot_id
        const isTargetLot = highlightLotId && pos.lot_id === highlightLotId

        // Get Lot Details
        const lotDetail = hasLot ? lotInfo[pos.lot_id!] : null

        let bgClass = 'bg-white dark:bg-gray-700'
        let borderClass = 'border-gray-200 dark:border-gray-600'
        let ringClass = ''

        if (isSelected) {
            bgClass = 'bg-blue-50 dark:bg-blue-900/30'
            borderClass = 'border-blue-500'
            ringClass = 'ring-2 ring-blue-300'
        } else if (isTargetLot) {
            // Highlight for current LOT (Assignment Mode)
            bgClass = 'bg-purple-100 dark:bg-purple-900/40'
            borderClass = 'border-purple-500'
            ringClass = 'ring-2 ring-purple-300' // Stronger ring
        } else if (hasLot) {
            // Has other LOT assigned
            bgClass = 'bg-amber-50 dark:bg-amber-900/10'
            borderClass = 'border-amber-200 dark:border-amber-800'
        } else if (isOccupied) {
            // Just occupied (no LOT or legacy)
            bgClass = 'bg-green-50 dark:bg-green-900/20'
            borderClass = 'border-green-400 hover:border-green-500'
        }

        // Determine if we are in LOT assignment mode
        const isAssignmentMode = !!highlightLotId

        return (
            <div
                key={pos.id}
                onClick={isAssignmentMode ? () => onPositionSelect(pos.id) : undefined}
                style={cellHeight > 0 ? { height: `${cellHeight}px` } : { minHeight: '80px' }} // Increased min-height for content
                className={`
                    relative ${isAssignmentMode ? 'cursor-pointer' : ''} p-1.5 rounded-lg border-2 transition-all
                    flex flex-col justify-between overflow-hidden
                    ${bgClass} ${borderClass} ${ringClass}
                    ${isAssignmentMode ? 'hover:shadow-lg hover:scale-[1.02] hover:z-10' : ''}
                `}
            >
                {/* Selection checkbox - Bottom left corner (only in non-assignment mode) */}
                {!isAssignmentMode && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onPositionSelect(pos.id)
                        }}
                        className={`
                            absolute bottom-1 left-1 z-20 w-4 h-4 rounded 
                            border-2 transition-all duration-150
                            flex items-center justify-center
                            ${isSelected
                                ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                                : 'bg-white/90 dark:bg-gray-800/90 border-gray-300 dark:border-gray-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                            }
                        `}
                        title={isSelected ? "Bỏ chọn vị trí" : "Chọn vị trí"}
                    >
                        {isSelected && (
                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                )}
                {/* Header: Pos Code */}
                <div className="flex justify-center items-start w-full relative mb-1 shrink-0">
                    {/* View Details Eye Icon - Top Left */}
                    {!isAssignmentMode && hasLot && lotDetail && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onViewDetails?.(pos.lot_id!)
                            }}
                            className="absolute left-0 top-0 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors z-20"
                            title="Xem chi tiết LOT"
                        >
                            <Eye size={12} />
                        </button>
                    )}

                    <span className="font-mono text-[10px] items-center text-black dark:text-white font-bold leading-none">
                        {pos.code}
                    </span>

                    {/* Menu Trigger - Top Right */}
                    {!isAssignmentMode && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onPositionMenu?.(pos, e)
                            }}
                            className="absolute right-0 top-0 text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors z-30 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-bl-lg"
                            title="Tùy chọn"
                        >
                            <MoreHorizontal size={14} />
                        </button>
                    )}

                    {/* Status Icons */}
                    <div className={`flex gap-0.5 absolute ${!isAssignmentMode ? 'right-5' : 'right-0'} top-0`}>
                        {isTargetLot && (
                            <div title="Đang chọn" className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        )}
                        {hasLot && !isTargetLot && (
                            <div title="Có LOT khác" className="w-2 h-2 rounded-full bg-amber-400" />
                        )}
                        {isOccupied && !hasLot && (
                            <div title="Có hàng" className="w-2 h-2 rounded-full bg-green-500" />
                        )}
                    </div>
                </div>

                {/* Content: LOT Code & Product */}
                {lotDetail ? (
                    <div className="flex flex-col items-center w-full flex-1 min-h-0 gap-1">
                        {/* 1. Mã LOT */}
                        <div className={`text-xs font-bold leading-tight w-full text-center truncate shrink-0 ${isTargetLot ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'}`}>
                            {lotDetail.code}
                        </div>

                        {/* List items - Flexible Scrollable Area */}
                        <div className="w-full flex-col gap-1.5 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                            {lotDetail.items?.map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-0.5 w-full text-center border-b border-black/5 dark:border-white/5 last:border-0 pb-1 last:pb-0 shrink-0">
                                    {/* 2. Tên sản phẩm */}
                                    {item.product_name && (
                                        <div className="text-[9px] text-gray-600 dark:text-gray-300 leading-tight line-clamp-2" title={item.product_name}>
                                            {item.product_name}
                                        </div>
                                    )}
                                    {/* 3. Mã SP : Số lượng Đơn vị */}
                                    <div className="text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
                                        {item.sku || '-'} : {item.quantity} {item.unit || '-'}
                                    </div>
                                    {/* 4. Tags (Inline for this item) */}
                                    {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-0.5 justify-center mt-0.5">
                                            {item.tags.map((tag, tIdx) => (
                                                <span key={tIdx} className="px-1 py-[1px] rounded-[3px] text-[7px] font-bold bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800 leading-none">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Removed global tags section since they are now inline */}

                        {/* Dates Footer - Priority: Peeling (B), Packaging (Đ), Inbound (N) */}
                        <div className="flex justify-center items-center gap-1 w-full px-1 pt-1 opacity-70 text-[8px] text-gray-500 dark:text-gray-400 shrink-0 mt-auto">
                            {(() => {
                                const dates = []

                                // Logic: If peeling/packaging exists, show them. Else show inbound. Or show all available?
                                // User said: "It only has peeling date and packaging date".

                                if (lotDetail.peeling_date) {
                                    dates.push(`B: ${new Date(lotDetail.peeling_date).toLocaleDateString('vi-VN')}`)
                                }
                                if (lotDetail.packaging_date) {
                                    dates.push(`Đ: ${new Date(lotDetail.packaging_date).toLocaleDateString('vi-VN')}`)
                                }
                                // Fallback: If no special dates, show inbound if available
                                if (lotDetail.inbound_date && !lotDetail.peeling_date && !lotDetail.packaging_date) {
                                    dates.push(`N: ${new Date(lotDetail.inbound_date).toLocaleDateString('vi-VN')}`)
                                }
                                // Fallback 2: Show created_at but label it properly if needed, or just hide if user doesn't want irrelevant dates.
                                // Default "Đ:" was created_at before. Now "Đ:" is Packaging.

                                return dates.map((d, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <span className="text-gray-300 dark:text-gray-600">|</span>}
                                        <span>{d}</span>
                                    </React.Fragment>
                                ))
                            })()}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1"></div>
                )}
            </div>
        )
    }

    function countAllPositions(zone: Zone & { children: Zone[], positions: PositionWithZone[] }): number {
        let count = zone.positions.length
        for (const child of zone.children) {
            count += countAllPositions(child as any)
        }
        return count
    }

    if (zoneTree.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Package size={48} className="mb-4" />
                <p className="text-sm">Chưa có zone nào</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {zoneTree.map(zone => renderZone(zone))}
        </div>
    )
}
