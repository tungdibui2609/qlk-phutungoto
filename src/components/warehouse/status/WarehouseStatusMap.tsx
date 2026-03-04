import React, { useMemo, useState } from 'react'
import { Package, ChevronRight, ChevronDown, Check, Columns, MousePointer2, Copy, Trash2, ArrowRight, Settings, BarChart3, Grid3X3, Layout, Warehouse, Eye, Info } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { InView } from 'react-intersection-observer'
import { GroupedZoneDetailModal } from './GroupedZoneDetailModal'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface WarehouseStatusMapProps {
    zones: Zone[]
    positions: PositionWithZone[]
    layouts: Record<string, any>
    occupiedIds: Set<string>
    collapsedZones: Set<string>
    isDesignMode?: boolean
    isCompactMode?: boolean
    onToggleCollapse: (zoneId: string) => void
    onUpdateCollapsedWarehouses?: (setter: (prev: Set<string>) => Set<string>) => void
    onConfigureZone?: (zone: Zone) => void
    onViewDetails?: (lotId: string) => void
    lotInfo?: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, product_color?: string | null, tags?: string[] }>,
        inbound_date?: string,
        created_at?: string,
        tags?: string[]
    }>
    displayInternalCode?: boolean
}

interface StatusCellProps {
    pos: PositionWithZone
    cellHeight: number
    cellWidth: number
    isOccupied: boolean
    lotDetail: any
    onViewDetails?: (lotId: string) => void
}

const MemoizedStatusCell = React.memo(function StatusCell({
    pos,
    cellHeight,
    cellWidth,
    isOccupied,
    lotDetail,
    onViewDetails
}: StatusCellProps) {
    // Heatmap style colors
    let bgClass = 'bg-slate-50 dark:bg-slate-800'
    let borderClass = 'border-slate-100 dark:border-slate-700'
    let iconColor = 'text-slate-300'

    let customBgStyle = {}
    let dotStyle = {}

    if (isOccupied) {
        // Find if there's any valid configured product color
        const pColor = lotDetail?.items?.find((item: any) => item.product_color)?.product_color;

        if (pColor) {
            // Apply dynamic color with some transparency for background and full color for dot/border
            customBgStyle = {
                backgroundColor: `${pColor}20`, // 20 hex = 12% opacity approx
                borderColor: `${pColor}80`
            }
            dotStyle = { backgroundColor: pColor }
            bgClass = ''
            borderClass = ''
            iconColor = ''
        } else {
            // Default Dark Brown
            bgClass = 'bg-stone-50 dark:bg-stone-900/30'
            borderClass = 'border-stone-400 dark:border-stone-600'
            iconColor = 'text-stone-600'
            dotStyle = { backgroundColor: '#5c4033' } // Dark brown
        }
    }

    return (
        <InView triggerOnce={false} rootMargin="200px 0px">
            {({ inView, ref }: any) => (
                <div
                    ref={ref}
                    style={{
                        height: cellHeight > 0 ? `${cellHeight}px` : '42px',
                        ...customBgStyle
                    }}
                    className={`
                        relative border text-center transition-all p-1 group
                        flex flex-col items-center justify-center
                        ${bgClass} ${borderClass}
                        hover:scale-105 hover:z-10 hover:shadow-lg ${lotDetail ? 'cursor-pointer' : 'cursor-default'}
                    `}
                    onClick={(e) => {
                        if (lotDetail && onViewDetails) {
                            e.stopPropagation()
                            onViewDetails(pos.lot_id!)
                        }
                    }}
                >
                    {inView && (
                        <>
                            <span className={`text-[8px] font-bold leading-none ${isOccupied ? 'text-slate-900 dark:text-white' : 'text-slate-400'} ${cellWidth === 0 ? 'whitespace-nowrap px-0.5' : ''}`}>
                                {pos.code.split('-').pop()}
                            </span>

                            {isOccupied ? (
                                <div className="mt-0.5 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full" style={dotStyle}></div>
                                </div>
                            ) : (
                                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                            )}
                        </>
                    )}
                </div>
            )}
        </InView>
    )
}, (prev, next) => {
    return prev.pos.id === next.pos.id &&
        prev.pos.lot_id === next.pos.lot_id &&
        prev.isOccupied === next.isOccupied &&
        prev.cellHeight === next.cellHeight &&
        prev.cellWidth === next.cellWidth &&
        prev.lotDetail === next.lotDetail
})

export default function WarehouseStatusMap({
    zones,
    positions,
    layouts,
    occupiedIds,
    collapsedZones,
    isDesignMode = false,
    isCompactMode = false,
    onToggleCollapse,
    onUpdateCollapsedWarehouses,
    onConfigureZone,
    onViewDetails,
    lotInfo = {},
    displayInternalCode = false
}: WarehouseStatusMapProps) {
    const [viewingZone, setViewingZone] = React.useState<{ zone: Zone, allPositions: PositionWithZone[] } | null>(null)
    const [collapsedWarehouses, setCollapsedWarehouses] = useState<Set<string>>(() => {
        const rootNames = new Set<string>()
        zones.filter(z => !z.parent_id).forEach(z => rootNames.add(z.name))
        return rootNames
    })

    // Build zone tree (copied structure logic from FlexibleZoneGrid)
    const zoneTree = useMemo(() => {
        const map = new Map<string, Zone & { children: Zone[], positions: PositionWithZone[] }>()
        zones.forEach(z => map.set(z.id, { ...z, children: [], positions: [] }))
        positions.forEach(p => {
            if (p.zone_id && map.has(p.zone_id)) {
                const parentZone = map.get(p.zone_id)!
                if (!parentZone.positions.some(existing => existing.id === p.id)) {
                    parentZone.positions.push(p)
                }
            }
        })
        zones.forEach(z => {
            if (z.parent_id && map.has(z.parent_id)) {
                const parentZone = map.get(z.parent_id)!
                if (!parentZone.children.some(existing => existing.id === z.id)) {
                    parentZone.children.push(map.get(z.id)!)
                }
            }
        })
        map.forEach(node => {
            node.children.sort((a, b) => {
                const oa = a.display_order ?? 0
                const ob = b.display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
            })
            node.positions.sort((a, b) => {
                const oa = a.display_order ?? 0
                const ob = b.display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
            })
        })

        const rootsMap = new Map()
        zones
            .filter(z => !z.parent_id || !map.has(z.parent_id))
            .forEach(z => rootsMap.set(z.id, map.get(z.id)!))

        return Array.from(rootsMap.values())
            .sort((a, b) => {
                const oa = a.display_order ?? 0
                const ob = b.display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
            })
    }, [zones, positions])

    const getAllDescendantIds = React.useCallback((zone: Zone & { children: Zone[] }): string[] => {
        let ids: string[] = []
        zone.children.forEach(child => {
            ids.push(child.id)
            ids = ids.concat(getAllDescendantIds(child as any))
        })
        return ids
    }, [])

    function renderZone(
        zone: Zone & { children: Zone[], positions: PositionWithZone[] },
        depth: number = 0,
        breadcrumb: string[] = []
    ): React.ReactNode {
        const layout = layouts[zone.id]
        const isCollapsed = collapsedZones.has(zone.id)
        const hasChildren = zone.children.length > 0
        const hasPositions = zone.positions.length > 0
        const positionColumns = layout?.position_columns ?? 10
        const cellWidth = layout?.cell_width ?? 0
        const cellHeight = layout?.cell_height ?? 0
        const childLayout = layout?.child_layout ?? 'vertical'
        const childColumns = layout?.child_columns ?? 0
        const childWidth = layout?.child_width ?? 0
        const collapsible = layout?.collapsible ?? true
        let displayType = layout?.display_type ?? 'auto'

        // Force Root Zones (Warehouses) to ALWAYS show, overriding user's 'hidden' layout settings
        // because we want Warehouses to wrap their children in the Map view now.
        if (depth === 0 && displayType === 'hidden') {
            displayType = 'auto' // fallback to normal header wrapper
        }

        const currentBreadcrumb = [...breadcrumb, zone.name]

        // Handle hidden/ghost logic for design mode
        if (displayType === 'hidden') {
            if (!isDesignMode) {
                return (
                    <div key={zone.id} className="contents">
                        {hasPositions && (
                            <div className="grid mb-4" style={{
                                gridTemplateColumns: cellWidth > 0
                                    ? `repeat(${positionColumns}, ${cellWidth}px)`
                                    : `repeat(${positionColumns}, minmax(0, 1fr))`,
                                gap: `${layout?.layout_gap ?? 16}px`
                            }}>
                                {zone.positions.map(pos => renderStatusCell(pos, cellHeight, layout))}
                            </div>
                        )}
                        {zone.children.map(child => renderZone(child as any, depth, currentBreadcrumb))}
                    </div>
                )
            }
            // In Design Mode, show a subtle ghost container
            return (
                <div key={zone.id} className="border-2 border-dashed border-slate-200 dark:border-slate-800 p-2 bg-slate-50/10 mb-4">
                    <div className="flex items-center justify-between mb-2 px-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">ẨN • {zone.name}</span>
                        <button onClick={() => onConfigureZone?.(zone)} className="p-1 bg-slate-200 dark:bg-slate-800 rounded-sm text-slate-500 hover:text-indigo-500 transition-colors">
                            <Settings size={12} />
                        </button>
                    </div>
                    {hasPositions && (
                        <div className="grid mb-2" style={{
                            gridTemplateColumns: cellWidth > 0
                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                : `repeat(${positionColumns}, minmax(0, 1fr))`,
                            gap: `${layout?.layout_gap ?? 4}px`
                        }}>
                            {zone.positions.map(pos => renderStatusCell(pos, cellHeight, layout))}
                        </div>
                    )}
                    {zone.children.map(child => renderZone(child as any, depth + 1, currentBreadcrumb))}
                </div>
            )
        }

        const effectiveDisplayType = displayType === 'auto'
            ? (hasPositions && !hasChildren ? 'grid' : 'header')
            : displayType

        const totalPos = countAllPositions(zone)

        if (effectiveDisplayType === 'grouped') {
            return renderGroupedZone(zone, depth, currentBreadcrumb)
        }

        return (
            <div key={zone.id} className={`group mb-4 ${depth === 0 ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800' : ''} overflow-hidden`}>
                {/* Status Header */}
                {(effectiveDisplayType !== 'hidden') && (
                    <div
                        className={`flex items-center justify-between px-4 py-3 transition-colors ${effectiveDisplayType === 'grid' || effectiveDisplayType === 'section'
                            ? 'bg-slate-50/50 dark:bg-slate-800/30'
                            : ''
                            }`}
                        onClick={() => collapsible && onToggleCollapse(zone.id)}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-1.5 h-6 rounded-full ${depth === 0 ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                            <div>
                                <h3 className={`font-bold tracking-tight ${depth === 0 ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300 text-sm'}`}>
                                    {effectiveDisplayType === 'grid' || effectiveDisplayType === 'section' ? currentBreadcrumb.join(' / ') : zone.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] items-center flex gap-1 font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">
                                        <BarChart3 size={10} /> {totalPos} VỊ TRÍ
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Nút bấm Gập/Mở cục bộ */}
                            {depth === 0 && onUpdateCollapsedWarehouses && (
                                <div className="flex items-center gap-1 mr-2 bg-indigo-50/50 dark:bg-indigo-900/20 p-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const descendantIds = getAllDescendantIds(zone as any)
                                            onUpdateCollapsedWarehouses(prev => {
                                                const next = new Set(prev)
                                                next.delete(zone.id)
                                                descendantIds.forEach(id => next.add(id))
                                                return next
                                            })
                                        }}
                                        className="px-2 py-1 text-[10px] sm:text-xs rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800"
                                        title="Bung Dãy/Sảnh (Giấu Vị trí)"
                                    >
                                        Mở Dãy
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const descendantIds = getAllDescendantIds(zone as any)
                                            onUpdateCollapsedWarehouses(prev => {
                                                const next = new Set(prev)
                                                next.delete(zone.id)
                                                descendantIds.forEach(id => next.delete(id))
                                                return next
                                            })
                                        }}
                                        className="px-2 py-1 text-[10px] sm:text-xs rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800"
                                        title="Mở bung toàn bộ lưới Vị trí"
                                    >
                                        Mở Hết
                                    </button>
                                    <div className="w-px h-3 bg-slate-200 dark:bg-slate-700 mx-0.5"></div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onUpdateCollapsedWarehouses(prev => {
                                                const next = new Set(prev)
                                                next.add(zone.id)
                                                return next
                                            })
                                        }}
                                        className="px-2 py-1 text-[10px] sm:text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        title="Gập gọn Kho này lại"
                                    >
                                        Thu Gọn
                                    </button>
                                </div>
                            )}

                            {isDesignMode && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onConfigureZone?.(zone); }}
                                    className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-sm hover:bg-indigo-100 transition-all border border-indigo-100 dark:border-indigo-800"
                                >
                                    <Settings size={14} />
                                </button>
                            )}
                            {collapsible && (hasChildren || hasPositions) && (
                                <div className={`p-1 rounded-full transition-transform ${isCollapsed ? '' : 'rotate-90'}`}>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Status Content */}
                {!isCollapsed && (
                    <div className={`${depth === 0 ? 'p-4' : 'pl-4 pt-1 pb-2'}`}>
                        {hasPositions && (
                            <div
                                className="grid mb-4"
                                style={{
                                    gridTemplateColumns: cellWidth > 0
                                        ? `repeat(${positionColumns}, ${cellWidth}px)`
                                        : `repeat(${positionColumns}, minmax(0, 1fr))`,
                                    gap: `${layout?.layout_gap ?? 4}px`
                                }}
                            >
                                {zone.positions.map(pos => renderStatusCell(pos, cellHeight, layout))}
                            </div>
                        )}
                        {hasChildren && (
                            <div
                                className={
                                    childLayout === 'horizontal'
                                        ? 'flex flex-wrap custom-scrollbar'
                                        : childLayout === 'grid'
                                            ? `grid`
                                            : 'flex flex-col'
                                }
                                style={{
                                    gap: `${layout?.layout_gap ?? 16}px`,
                                    ...(childLayout === 'grid' && childColumns > 0
                                        ? { gridTemplateColumns: `repeat(${childColumns}, minmax(0, 1fr))` }
                                        : childLayout === 'grid'
                                            ? { gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))` }
                                            : {})
                                }}
                            >
                                {zone.children.map(child => (
                                    <div
                                        key={child.id}
                                        className={childLayout === 'horizontal' ? 'flex-shrink-0' : ''}
                                        style={
                                            childLayout === 'horizontal'
                                                ? {
                                                    width: childWidth > 0 ? `${childWidth}px` : 'auto',
                                                    flexBasis: childWidth > 0 ? `${childWidth}px` : 'auto',
                                                    flexGrow: childWidth > 0 ? 0 : 1,
                                                }
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

    function renderGroupedZone(
        zone: Zone & { children: Zone[], positions: PositionWithZone[] },
        depth: number,
        breadcrumb: string[]
    ): React.ReactNode {
        const allPositions = getAllPositions(zone)
        // Removed early return allowing empty grouped zones to render
        // if (allPositions.length === 0) return null

        const occupiedCount = allPositions.filter(p => occupiedIds.has(p.id)).length
        const totalCount = allPositions.length

        const isCollapsed = collapsedZones.has(zone.id)
        const layout = layouts[zone.id]
        const collapsible = layout?.collapsible ?? true
        const cellWidth = layout?.cell_width ?? 0
        const cellHeight = layout?.cell_height ?? 0
        const containerHeight = layout?.container_height ?? 0

        // Use zone code as title if available, otherwise use last part of name
        // If use_full_title is enabled, use full name
        const compactTitle = layout?.use_full_title ? zone.name : (zone.code || zone.name)

        return (
            <div
                key={zone.id}
                className={`mb-3 pt-0.5 px-3 pb-3 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm transition-all group overflow-hidden`}
                style={{
                    width: cellWidth > 0 ? `${cellWidth}px` : '100%',
                    height: containerHeight > 0 ? `${containerHeight}px` : 'auto',
                }}
            >
                {/* Header Info */}
                <div
                    className={`flex items-center justify-between mb-2 ${totalCount > 0 ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50' : ''} select-none -mx-1 px-1 transition-colors`}
                    onClick={() => {
                        if (totalCount > 0) setViewingZone({ zone, allPositions })
                    }}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                            {compactTitle}
                        </span>
                        {isDesignMode && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onConfigureZone?.(zone); }}
                                className="p-1 opacity-0 group-hover:opacity-100 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:scale-110 transition-all border border-indigo-100 dark:border-indigo-800"
                            >
                                <Settings size={12} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 px-1.5 py-0.5 shadow-sm">
                            {occupiedCount}/{totalCount}
                        </span>
                    </div>
                </div>

                {/* Status Fragments */}
                {!isCollapsed && (
                    <div
                        className="flex"
                        style={{
                            height: cellHeight > 0 ? `${cellHeight}px` : '6px',
                            gap: `${Math.max(1, (layout?.layout_gap ?? 16) / 8)}px`
                        }}
                    >
                        {allPositions.map(pos => {
                            const isOccupied = occupiedIds.has(pos.id)
                            const lotDetail = pos.lot_id ? lotInfo[pos.lot_id] : null

                            let segmentColor = 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600'
                            let customDynamicColor = {}
                            if (isOccupied) {
                                const pColor = lotDetail?.items?.find((item: any) => item.product_color)?.product_color;
                                if (pColor) {
                                    segmentColor = '';
                                    customDynamicColor = { backgroundColor: pColor };
                                } else {
                                    segmentColor = '';
                                    customDynamicColor = { backgroundColor: '#5c4033' }; // Dark brown
                                }
                            }

                            return (
                                <div
                                    key={pos.id}
                                    style={customDynamicColor}
                                    className={`flex-1 h-full relative group/seg ${segmentColor} transition-colors hover:brightness-110 ${lotDetail ? 'cursor-pointer' : 'cursor-default'}`}
                                    onClick={(e) => {
                                        if (lotDetail && onViewDetails) {
                                            e.stopPropagation()
                                            onViewDetails(pos.lot_id!)
                                        }
                                    }}
                                >
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        )
    }

    function getAllPositions(zone: any): PositionWithZone[] {
        let result = [...zone.positions]
        zone.children.forEach((c: any) => {
            result = [...result, ...getAllPositions(c)]
        })
        return result
    }

    function renderStatusCell(pos: PositionWithZone, cellHeight: number, layout: any): React.ReactNode {
        const isOccupied = occupiedIds.has(pos.id)
        const lotDetail = pos.lot_id ? lotInfo[pos.lot_id] : null

        return (
            <MemoizedStatusCell
                key={pos.id}
                pos={pos}
                cellHeight={cellHeight}
                cellWidth={layout?.cell_width ?? 0}
                isOccupied={isOccupied}
                lotDetail={lotDetail}
                onViewDetails={onViewDetails}
            />
        )
    }

    function countAllPositions(zone: any): number {
        let count = zone.positions.length
        zone.children.forEach((c: any) => count += countAllPositions(c))
        return count
    }

    if (zoneTree.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                <Layout size={64} strokeWidth={1} className="mb-4 opacity-20" />
                <p className="text-lg font-medium">Chưa có dữ liệu sơ đồ kho</p>
                <p className="text-sm opacity-60 mt-1">Vui lòng thiết lập Zone và Vị trí trước.</p>
            </div>
        )
    }

    // Compact mode: group by parent zones (Dãy/Sảnh), children shown horizontally
    // Collect groups: { parentZone, breadcrumb, children: [{ zone, positions }] }
    interface CompactGroup {
        parent: Zone & { children: any[], positions: PositionWithZone[] }
        breadcrumb: string[]
        leafChildren: Array<{ zone: any, positions: PositionWithZone[] }>
    }

    function collectCompactGroups(node: any, breadcrumb: string[] = []): CompactGroup[] {
        const childrenWithPositions = node.children.filter((c: any) => countAllPositions(c) > 0)

        if (childrenWithPositions.length === 0) {
            // No children with positions - check if this node has direct positions
            if (node.positions.length > 0) {
                return [{ parent: node, breadcrumb, leafChildren: [{ zone: node, positions: node.positions }] }]
            }
            return []
        }

        // Check if children's grandchildren have THEIR OWN children with positions
        // If yes → need to recurse deeper (we're too high in the tree)
        // If no → THIS node is the group parent, children become columns
        const childrenHaveDeepDescendants = childrenWithPositions.some((c: any) =>
            c.children.some((gc: any) =>
                gc.children.length > 0 && gc.children.some((ggc: any) => countAllPositions(ggc) > 0)
            )
        )

        const currentBreadcrumb = [...breadcrumb, node.name]

        if (childrenHaveDeepDescendants) {
            // Recurse: we're too high (e.g. at Kho level, need to go to Dãy level)
            const groups: CompactGroup[] = []
            for (const child of node.children) {
                // When recursing, pass the name of this node as part of breadcrumb
                groups.push(...collectCompactGroups(child, currentBreadcrumb))
            }
            return groups
        }

        // This node is the group parent (Dãy/Sảnh), children (Ô) become columns
        return [{
            parent: node,
            breadcrumb, // The breadcrumb up to THIS node
            leafChildren: childrenWithPositions.map((c: any) => ({
                zone: c,
                positions: getAllPositions(c)
            }))
        }]
    }

    if (isCompactMode) {
        // Collect grouped structure from all roots
        let allGroups: CompactGroup[] = []
        for (const root of zoneTree) {
            allGroups = [...allGroups, ...collectCompactGroups(root)]
        }

        // Group the groups by Warehouse (the first element of breadcrumb, or parent.name if breadcrumb empty)
        const groupsByWarehouse = new Map<string, CompactGroup[]>()
        allGroups.forEach(g => {
            const whName = g.breadcrumb.length > 0 ? g.breadcrumb[0] : g.parent.name
            if (!groupsByWarehouse.has(whName)) groupsByWarehouse.set(whName, [])
            groupsByWarehouse.get(whName)!.push(g)
        })

        const toggleWarehouse = (whName: string) => {
            const next = new Set(collapsedWarehouses)
            if (next.has(whName)) next.delete(whName)
            else next.add(whName)
            setCollapsedWarehouses(next)
        }

        return (
            <div className="animate-in fade-in duration-500 space-y-6 pb-10">
                {Array.from(groupsByWarehouse.entries()).map(([whName, groups]) => {
                    const isCollapsed = collapsedWarehouses.has(whName)

                    return (
                        <div key={whName} className="space-y-3">
                            {/* Warehouse Header Wrapper */}
                            <div
                                className="flex items-center justify-between px-3 py-2 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors group"
                                onClick={() => toggleWarehouse(whName)}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="p-1 bg-indigo-500 rounded text-white">
                                        <Warehouse className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                                        {whName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors">
                                        {groups.length} khu vực
                                    </span>
                                    {isCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                </div>
                            </div>

                            {!isCollapsed && (
                                <div className="space-y-3 pl-2 border-l-2 border-slate-100 dark:border-slate-800 ml-5">
                                    {groups.map(group => {
                                        const groupTotalPos = group.leafChildren.reduce((sum, c) => sum + c.positions.length, 0)
                                        const groupOccupied = group.leafChildren.reduce((sum, c) => sum + c.positions.filter(p => occupiedIds.has(p.id)).length, 0)
                                        const groupPercent = groupTotalPos > 0 ? (groupOccupied / groupTotalPos) * 100 : 0

                                        const isHall = !!(group.parent as any).is_hall

                                        // Path minus the warehouse name
                                        const relativePath = group.breadcrumb.length > 1
                                            ? group.breadcrumb.slice(1).join(' / ')
                                            : ''

                                        const displayTitle = relativePath
                                            ? `${relativePath} / ${group.parent.name}`
                                            : group.parent.name

                                        return (
                                            <div key={group.parent.id} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden rounded-md">
                                                {/* Group Header (Dãy/Sảnh) */}
                                                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-1 h-3 rounded-full ${isHall ? 'bg-amber-400' : 'bg-indigo-400'}`}></div>
                                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tight">
                                                            {displayTitle}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-mono font-bold text-slate-400 bg-white dark:bg-slate-900 px-1.5 py-0.5 border border-slate-100 dark:border-slate-700 rounded-sm">
                                                            {groupOccupied}/{groupTotalPos}
                                                        </span>
                                                        <span className="text-[9px] font-bold" style={{ color: groupPercent > 80 ? '#ef4444' : groupPercent > 50 ? '#f59e0b' : '#22c55e' }}>
                                                            {groupPercent.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Children as columns - each Ô is a column, layout depends on is_hall */}
                                                <div className="flex items-start w-full overflow-hidden">
                                                    {group.leafChildren.map(({ zone: childZone, positions: childPositions }) => {
                                                        const childOccupied = childPositions.filter(p => occupiedIds.has(p.id)).length
                                                        const childTotal = childPositions.length

                                                        return (
                                                            <div
                                                                key={childZone.id}
                                                                className="flex-1 min-w-0 border-r last:border-r-0 border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer"
                                                                onClick={() => {
                                                                    if (childTotal > 0) setViewingZone({ zone: childZone, allPositions: childPositions })
                                                                }}
                                                            >
                                                                {/* Column Header - zone name */}
                                                                <div className="text-center px-0.5 py-1 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                                                                    <span className="text-[7px] font-bold text-slate-500 dark:text-slate-400 uppercase leading-none block truncate" title={childZone.name}>
                                                                        {(childZone.code || childZone.name).replace(/^Ô\s*/i, '')}
                                                                    </span>
                                                                </div>

                                                                {/* Positions: vertical grid for Dãy, horizontal bar for Sảnh */}
                                                                {isHall ? (
                                                                    /* Sảnh: horizontal bar filling full width */
                                                                    <div className="flex h-[8px] gap-[1px] mx-1 my-1.5">
                                                                        {childPositions.map(pos => {
                                                                            const isOccupied = occupiedIds.has(pos.id)
                                                                            const lotDetail = pos.lot_id ? lotInfo[pos.lot_id] : null
                                                                            let dotColor = {}

                                                                            if (isOccupied) {
                                                                                const pColor = lotDetail?.items?.find((item: any) => item.product_color)?.product_color
                                                                                dotColor = { backgroundColor: pColor || '#5c4033' }
                                                                            }

                                                                            return (
                                                                                <div
                                                                                    key={pos.id}
                                                                                    className={`flex-1 h-full rounded-[1px] ${isOccupied ? '' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                                                    style={dotColor}
                                                                                    title={`${pos.code}${isOccupied && lotDetail ? ` • ${lotDetail.code}` : ''}`}
                                                                                />
                                                                            )
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    /* Dãy: columns of positions using grid (2 per row for visual equivalence to tiers) */
                                                                    <div className="grid grid-cols-2 gap-[1px] py-1 px-[2px] justify-items-center">
                                                                        {childPositions.map(pos => {
                                                                            const isOccupied = occupiedIds.has(pos.id)
                                                                            const lotDetail = pos.lot_id ? lotInfo[pos.lot_id] : null
                                                                            let dotColor = {}

                                                                            if (isOccupied) {
                                                                                const pColor = lotDetail?.items?.find((item: any) => item.product_color)?.product_color
                                                                                dotColor = { backgroundColor: pColor || '#5c4033' }
                                                                            }

                                                                            return (
                                                                                <div
                                                                                    key={pos.id}
                                                                                    className={`w-[6px] h-[6px] rounded-[1px] ${isOccupied ? '' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                                                    style={dotColor}
                                                                                    title={`${pos.code}${isOccupied && lotDetail ? ` • ${lotDetail.code}` : ''}`}
                                                                                />
                                                                            )
                                                                        })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}

                {viewingZone && (
                    <GroupedZoneDetailModal
                        zone={viewingZone.zone}
                        allPositions={viewingZone.allPositions}
                        occupiedIds={occupiedIds}
                        lotInfo={lotInfo}
                        displayInternalCode={displayInternalCode}
                        onClose={() => setViewingZone(null)}
                    />
                )}
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {zoneTree.map(zone => renderZone(zone))}

            {viewingZone && (
                <GroupedZoneDetailModal
                    zone={viewingZone.zone}
                    allPositions={viewingZone.allPositions}
                    occupiedIds={occupiedIds}
                    lotInfo={lotInfo}
                    displayInternalCode={displayInternalCode}
                    onClose={() => setViewingZone(null)}
                />
            )}
        </div>
    )
}
