'use client'
import React, { useMemo } from 'react'
import { ChevronDown, ChevronRight, Package, Settings, Eye, Info, BarChart3, Layout } from 'lucide-react'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

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
    onToggleCollapse: (zoneId: string) => void
    onConfigureZone?: (zone: Zone) => void
    lotInfo?: Record<string, {
        code: string,
        items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>,
        inbound_date?: string,
        created_at?: string,
        tags?: string[]
    }>
}

export default function WarehouseStatusMap({
    zones,
    positions,
    layouts,
    occupiedIds,
    collapsedZones,
    isDesignMode = false,
    onToggleCollapse,
    onConfigureZone,
    lotInfo = {}
}: WarehouseStatusMapProps) {

    // Build zone tree (copied structure logic from FlexibleZoneGrid)
    const zoneTree = useMemo(() => {
        const map = new Map<string, Zone & { children: Zone[], positions: PositionWithZone[] }>()
        zones.forEach(z => map.set(z.id, { ...z, children: [], positions: [] }))
        positions.forEach(p => {
            if (p.zone_id && map.has(p.zone_id)) map.get(p.zone_id)!.positions.push(p)
        })
        zones.forEach(z => {
            if (z.parent_id && map.has(z.parent_id)) map.get(z.parent_id)!.children.push(map.get(z.id)!)
        })
        map.forEach(node => {
            node.children.sort((a, b) => (a.code || '').localeCompare(b.code || ''))
            node.positions.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
        })
        return zones
            .filter(z => !z.parent_id || !map.has(z.parent_id))
            .map(z => map.get(z.id)!)
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [zones, positions])

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
        const displayType = layout?.display_type ?? 'auto'

        const currentBreadcrumb = [...breadcrumb, zone.name]

        // Handle hidden/ghost logic for design mode
        if (displayType === 'hidden') {
            if (!isDesignMode) {
                return (
                    <div key={zone.id} className="contents">
                        {hasPositions && (
                            <div className="grid mb-4" style={{ gridTemplateColumns: `repeat(${positionColumns}, minmax(0, 1fr))`, gap: `${layout?.layout_gap ?? 16}px` }}>
                                {zone.positions.map(pos => renderStatusCell(pos, cellHeight))}
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
                        <div className="grid mb-2" style={{ gridTemplateColumns: `repeat(${positionColumns}, minmax(0, 1fr))`, gap: `${layout?.layout_gap ?? 4}px` }}>
                            {zone.positions.map(pos => renderStatusCell(pos, cellHeight))}
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
            <div key={zone.id} className={`mb-4 ${depth === 0 ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800' : ''} overflow-hidden`}>
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
                                {zone.positions.map(pos => renderStatusCell(pos, cellHeight))}
                            </div>
                        )}
                        {hasChildren && (
                            <div
                                className={
                                    childLayout === 'horizontal'
                                        ? 'flex overflow-x-auto pb-4 custom-scrollbar'
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

    function renderGroupedZone(
        zone: Zone & { children: Zone[], positions: PositionWithZone[] },
        depth: number,
        breadcrumb: string[]
    ): React.ReactNode {
        const allPositions = getAllPositions(zone)
        if (allPositions.length === 0) return null

        const occupiedCount = allPositions.filter(p => occupiedIds.has(p.id)).length
        const totalCount = allPositions.length

        const isCollapsed = collapsedZones.has(zone.id)
        const layout = layouts[zone.id]
        const collapsible = layout?.collapsible ?? true
        const cellWidth = layout?.cell_width ?? 0
        const cellHeight = layout?.cell_height ?? 0
        const containerHeight = layout?.container_height ?? 0

        // Use zone code as title if available, otherwise use last part of name
        const compactTitle = zone.code || zone.name

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
                    className="flex items-center justify-between mb-2 cursor-pointer select-none"
                    onClick={() => collapsible && onToggleCollapse(zone.id)}
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
                        {collapsible && (
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                        )}
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
                            if (isOccupied) {
                                segmentColor = (lotDetail?.items?.length || 1) > 1 ? 'bg-indigo-500' : 'bg-emerald-500'
                            }

                            return (
                                <div
                                    key={pos.id}
                                    className={`flex-1 h-full relative group/seg ${segmentColor} transition-colors hover:brightness-110 cursor-help`}
                                    title={`${pos.code}${lotDetail ? `\nLOT: ${lotDetail.code}` : '\n(Trống)'}`}
                                >
                                    {/* Tooltip for segments */}
                                    <div className="absolute opacity-0 group-hover/seg:opacity-100 pointer-events-none bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-slate-900 text-white text-[9px] px-3 py-1.5 shadow-2xl z-[60] transition-opacity">
                                        <div className="font-bold border-b border-white/10 mb-1 pb-1">{pos.code}</div>
                                        {lotDetail ? (
                                            <div className="text-indigo-300">{lotDetail.code}</div>
                                        ) : (
                                            <div className="text-slate-400 italic">Vị trí trống</div>
                                        )}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-900"></div>
                                    </div>
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

    function renderStatusCell(pos: PositionWithZone, cellHeight: number): React.ReactNode {
        const isOccupied = occupiedIds.has(pos.id)
        const lotDetail = pos.lot_id ? lotInfo[pos.lot_id] : null

        // Heatmap style colors
        let bgClass = 'bg-slate-50 dark:bg-slate-800'
        let borderClass = 'border-slate-100 dark:border-slate-700'
        let iconColor = 'text-slate-300'

        if (isOccupied) {
            const itemCount = lotDetail?.items?.length || 1
            if (itemCount > 1) {
                // Multi-product lot
                bgClass = 'bg-indigo-50 dark:bg-indigo-900/30'
                borderClass = 'border-indigo-300 dark:border-indigo-800'
                iconColor = 'text-indigo-500'
            } else {
                // Single product lot
                bgClass = 'bg-emerald-50 dark:bg-emerald-900/30'
                borderClass = 'border-emerald-300 dark:border-emerald-800'
                iconColor = 'text-emerald-500'
            }
        }

        return (
            <div
                key={pos.id}
                style={{ height: cellHeight > 0 ? `${cellHeight}px` : '42px' }}
                className={`
                    relative border text-center transition-all p-1 group
                    flex flex-col items-center justify-center
                    ${bgClass} ${borderClass}
                    hover:scale-105 hover:z-10 hover:shadow-lg cursor-help
                `}
                title={`${pos.code}${lotDetail ? `\nLOT: ${lotDetail.code}\n${lotDetail.items.map(i => `${i.sku}: ${i.quantity}`).join(', ')}` : '\n(Trống)'}`}
            >
                {/* Minimalist content for "Status" view */}
                <span className={`text-[8px] font-bold leading-none ${isOccupied ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                    {pos.code.split('-').pop()}
                </span>

                {isOccupied ? (
                    <div className="mt-0.5 flex items-center justify-center">
                        <div className={`w-1.5 h-1.5 rounded-full ${lotDetail?.items && lotDetail.items.length > 1 ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                    </div>
                ) : (
                    <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                )}

                {/* Hover Details Popover (Simplified) */}
                <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-slate-800 text-white text-[9px] p-2 rounded shadow-xl z-50 transition-opacity whitespace-pre-wrap text-center">
                    <div className="font-bold border-b border-white/10 pb-1 mb-1">{pos.code}</div>
                    {lotDetail ? (
                        <>
                            <div className="text-indigo-300 mb-1">{lotDetail.code}</div>
                            {lotDetail.items.slice(0, 2).map((it, i) => (
                                <div key={i} className="truncate">{it.product_name}</div>
                            ))}
                            {lotDetail.items.length > 2 && <div>+{lotDetail.items.length - 2} sản phẩm khác</div>}
                        </>
                    ) : (
                        <div className="text-slate-400">Trống</div>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-slate-800"></div>
                </div>
            </div>
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {zoneTree.map(zone => renderZone(zone))}
        </div>
    )
}
