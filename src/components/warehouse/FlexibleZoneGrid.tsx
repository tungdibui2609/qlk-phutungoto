'use client'
import React, { useMemo } from 'react'
import { ChevronDown, ChevronRight, Package, Settings, Eye, MoreHorizontal, Printer } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { InView } from 'react-intersection-observer'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

const MemoizedPositionCell = React.memo<{
    pos: PositionWithZone,
    cellHeight: number,
    cellWidth: number,
    isMobile: boolean,
    isOccupied: boolean,
    isSelected: boolean,
    isTargetLot: boolean,
    lotDetail: any,
    isAssignmentMode: boolean,
    isHighlightBlinking: boolean,
    displayInternalCode?: boolean,
    isGrouped?: boolean,
    onPositionSelect: (id: string) => void,
    onViewDetails?: (lotId: string) => void,
    onPositionMenu?: (pos: PositionWithZone, event: React.MouseEvent) => void
}>(({
    pos, cellHeight, cellWidth, isMobile, isOccupied, isSelected,
    isTargetLot, lotDetail, isAssignmentMode, isHighlightBlinking, displayInternalCode, isGrouped,
    onPositionSelect, onViewDetails, onPositionMenu
}) => {
    let bgClass = 'bg-white dark:bg-gray-700'
    let borderClass = 'border-gray-200 dark:border-gray-600'
    let ringClass = ''

    if (isSelected) {
        bgClass = 'bg-blue-50 dark:bg-blue-900/30'
        borderClass = 'border-blue-500'
        ringClass = 'ring-2 ring-blue-300'
    } else if (isTargetLot) {
        bgClass = 'bg-purple-100 dark:bg-purple-900/40'
        borderClass = 'border-purple-500'
        ringClass = 'ring-2 ring-purple-300'
    } else if (isOccupied) {
        bgClass = 'bg-amber-50 dark:bg-amber-900/10'
        borderClass = 'border-amber-200 dark:border-amber-800'
    }

    return (
        <InView triggerOnce={false} rootMargin="200px 0px">
            {({ inView, ref }: any) => (
                <div
                    ref={ref}
                    style={{
                        height: cellHeight > 0 ? `${cellHeight}px` : (isMobile ? '100px' : '125px'),
                        width: cellWidth > 0 ? `${cellWidth}px` : '100%'
                    }}
                    className={`
                        relative ${isAssignmentMode ? 'cursor-pointer' : ''} ${isMobile ? 'p-0.5' : 'p-1'} rounded-lg border-2 transition-all
                        flex flex-col justify-between overflow-hidden
                        ${bgClass} ${borderClass} ${ringClass}
                        ${isAssignmentMode ? 'hover:shadow-lg hover:scale-[1.02] hover:z-10' : ''}
                        ${isHighlightBlinking ? 'animate-highlight-blink' : ''}
                    `}
                    onClick={() => isAssignmentMode && onPositionSelect(pos.id)}
                >
                    {inView ? (
                        <>
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
                            <div className="flex justify-center items-start w-full relative mb-1 shrink-0">
                                {!isAssignmentMode && isOccupied && lotDetail && (
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

                                <div className={`font-mono ${isGrouped ? 'text-[8px]' : 'text-[10px]'} flex justify-center items-center text-black dark:text-white font-bold leading-tight w-full text-center ${cellWidth === 0 && !isGrouped ? 'whitespace-nowrap px-1' : 'break-all px-0.5'}`} style={{ minWidth: 0 }}>
                                    {pos.code}
                                </div>

                                {!isAssignmentMode && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            onPositionMenu?.(pos, e)
                                        }}
                                        className="absolute right-0 top-0 text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors z-40 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-bl-lg"
                                        title="Tùy chọn"
                                    >
                                        <MoreHorizontal size={14} />
                                    </button>
                                )}

                                <div className={`flex gap-0.5 absolute ${!isAssignmentMode ? 'right-5' : 'right-0'} top-0`}>
                                    {isTargetLot && (
                                        <div title="Đang chọn" className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                    )}
                                    {isOccupied && !isTargetLot && (
                                        <div title="Có hàng">
                                            <Package size={10} className="text-amber-500 dark:text-amber-400" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {lotDetail ? (
                                <div className="flex flex-col items-center w-full flex-1 min-h-0 gap-0.5 mt-0.5">
                                    <div className={`${isGrouped ? 'text-[8px]' : 'text-[10px]'} font-bold leading-tight w-full text-center shrink-0 ${isTargetLot ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'} ${isGrouped ? 'break-all' : 'truncate'}`}>
                                        {lotDetail.code}
                                    </div>

                                    {/* Wrapping Logic: No scrollbars, SKU and Quantity wrap naturally */}
                                    <div className="w-full space-y-1 flex-1 min-h-0">
                                        {lotDetail.items?.map((item: any, idx: number) => {
                                            const nameObj = displayInternalCode && item.internal_name ? item.internal_name : item.product_name;
                                            const codeObj = displayInternalCode && item.internal_code ? item.internal_code : item.sku;
                                            return (
                                                <div key={idx} className="flex flex-col gap-0.5 w-full text-center border-b border-black/5 dark:border-white/5 last:border-0 pb-0.5 last:pb-0 shrink-0">
                                                    {nameObj && (
                                                        <div className="text-[9px] text-gray-600 dark:text-gray-300 leading-tight line-clamp-2" title={nameObj}>
                                                            {nameObj}
                                                        </div>
                                                    )}
                                                    <div className="text-[9px] font-mono text-blue-600 dark:text-blue-400 font-bold break-words">
                                                        {codeObj || '-'} : {item.quantity} {item.unit || '-'}
                                                    </div>
                                                    {item.tags && item.tags.length > 0 && (
                                                        <TagDisplay
                                                            tags={item.tags}
                                                            variant="compact"
                                                            placeholderMap={{ '@': codeObj || '' }}
                                                            className="mt-0.5"
                                                        />
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="flex justify-between items-center w-full px-0.5 pt-0.5 opacity-80 text-[8px] text-gray-500 dark:text-gray-400 mt-auto font-mono">
                                        {(() => {
                                            const formatDate = (dateStr: string) => {
                                                if (!dateStr) return '';
                                                const d = new Date(dateStr);
                                                const day = String(d.getDate()).padStart(2, '0');
                                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                                const year = String(d.getFullYear()).slice(-2);
                                                return `${day}/${month}/${year}`;
                                            };

                                            const peeling = lotDetail.peeling_date ? `B:${formatDate(lotDetail.peeling_date)}` : '';
                                            const packaging = lotDetail.packaging_date ? `Đ:${formatDate(lotDetail.packaging_date)}` : '';
                                            const inbound = lotDetail.inbound_date && !lotDetail.peeling_date && !lotDetail.packaging_date
                                                ? `N:${formatDate(lotDetail.inbound_date)}`
                                                : '';

                                            if (peeling && packaging) {
                                                return (
                                                    <>
                                                        <span className="shrink-0">{peeling}</span>
                                                        <span className="text-gray-300 dark:text-gray-600">|</span>
                                                        <span className="shrink-0">{packaging}</span>
                                                    </>
                                                );
                                            }

                                            // Fallback for single or other combinations
                                            const display = peeling || packaging || inbound;
                                            return <span className="w-full text-center">{display}</span>;
                                        })()}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 shrink-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                    <span className="text-[10px] text-gray-400 font-medium">Trống</span>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            )}
        </InView>
    )
}, (prev, next) => {
    return prev.pos.id === next.pos.id &&
        prev.pos.lot_id === next.pos.lot_id &&
        prev.cellHeight === next.cellHeight &&
        prev.cellWidth === next.cellWidth &&
        prev.isMobile === next.isMobile &&
        prev.isOccupied === next.isOccupied &&
        prev.isSelected === next.isSelected &&
        prev.isTargetLot === next.isTargetLot &&
        prev.lotDetail === next.lotDetail &&
        prev.isAssignmentMode === next.isAssignmentMode &&
        prev.isHighlightBlinking === next.isHighlightBlinking &&
        prev.displayInternalCode === next.displayInternalCode &&
        prev.isGrouped === next.isGrouped
})

interface FlexibleZoneGridProps {
    zones: Zone[]
    positions: PositionWithZone[]
    layouts: Record<string, ZoneLayout>
    occupiedIds: Set<string>
    collapsedZones: Set<string>
    selectedPositionIds: Set<string>
    isDesignMode?: boolean
    isAssignmentMode?: boolean
    onUpdateCollapsedZones?: (setter: (prev: Set<string>) => Set<string>) => void
    onToggleCollapse: (zoneId: string) => void
    onPositionSelect: (positionId: string) => void
    onViewDetails?: (lotId: string) => void
    onPositionMenu?: (pos: Position, e: React.MouseEvent) => void
    onConfigureZone?: (zone: Zone) => void
    highlightLotId?: string | null
    highlightingPositionIds?: Set<string>
    lotInfo?: Record<string, { code: string, items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>, inbound_date?: string, created_at?: string, packaging_date?: string, peeling_date?: string, tags?: string[] }>
    pageBreakIds?: Set<string>
    onTogglePageBreak?: (zoneId: string) => void
    onPrintZone?: (zoneId: string) => void
    displayInternalCode?: boolean
    isGrouped?: boolean
}

export default function FlexibleZoneGrid({
    zones,
    positions,
    layouts,
    occupiedIds,
    collapsedZones,
    selectedPositionIds,
    isDesignMode = false,
    onUpdateCollapsedZones,
    onToggleCollapse,
    onPositionSelect,
    onViewDetails,
    onPositionMenu,
    onConfigureZone,
    highlightLotId,
    highlightingPositionIds = new Set(),
    lotInfo = {},
    pageBreakIds = new Set(),
    onTogglePageBreak,
    onPrintZone,
    displayInternalCode = false,
    isGrouped = false
}: FlexibleZoneGridProps) {
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const zoneTree = useMemo(() => {
        const map = new Map<string, Zone & { children: Zone[], positions: PositionWithZone[], totalPositions: number, descendantIds: string[] }>()

        zones.forEach(z => {
            map.set(z.id, { ...z, children: [], positions: [], totalPositions: 0, descendantIds: [] })
        })

        positions.forEach(p => {
            if (p.zone_id && map.has(p.zone_id)) {
                map.get(p.zone_id)!.positions.push(p)
            }
        })

        zones.forEach(z => {
            if (z.parent_id && map.has(z.parent_id)) {
                map.get(z.parent_id)!.children.push(map.get(z.id)!)
            }
        })

        const computeNodeData = (nodeId: string) => {
            const node = map.get(nodeId)!
            node.children.sort((a, b) => {
                const oa = (a as any).display_order ?? 0
                const ob = (b as any).display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.code || '').localeCompare(b.code || '')
            })
            node.positions.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))

            let totalPos = node.positions.length
            let descIds: string[] = []

            node.children.forEach(child => {
                computeNodeData(child.id)
                const computedChild = map.get(child.id)!
                totalPos += computedChild.totalPositions
                descIds.push(computedChild.id)
                descIds.push(...computedChild.descendantIds)
            })

            node.totalPositions = totalPos
            node.descendantIds = descIds
        }

        const rootNodes = zones.filter(z => !z.parent_id || !map.has(z.parent_id))
        rootNodes.forEach(root => computeNodeData(root.id))

        return rootNodes
            .map(z => map.get(z.id)!)
            .sort((a, b) => {
                const oa = (a as any).display_order ?? 0
                const ob = (b as any).display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.code || '').localeCompare(b.code || '')
            })
    }, [zones, positions])

    function renderPositionCell(pos: PositionWithZone, cellHeight: number, cellWidth: number) {
        return (
            <MemoizedPositionCell
                key={pos.id}
                pos={pos}
                cellHeight={cellHeight}
                cellWidth={cellWidth}
                isMobile={isMobile}
                isOccupied={occupiedIds.has(pos.id)}
                isSelected={selectedPositionIds.has(pos.id)}
                isTargetLot={highlightLotId ? pos.lot_id === highlightLotId : false}
                lotDetail={pos.lot_id ? lotInfo[pos.lot_id] : null}
                isAssignmentMode={!!onPositionSelect}
                isHighlightBlinking={highlightingPositionIds.has(pos.id)}
                displayInternalCode={displayInternalCode}
                isGrouped={isGrouped}
                onPositionSelect={onPositionSelect}
                onViewDetails={onViewDetails}
                onPositionMenu={onPositionMenu}
            />
        )
    }

    function renderZone(
        zone: Zone & { children: Zone[], positions: PositionWithZone[], totalPositions: number, descendantIds: string[] },
        depth: number = 0,
        breadcrumb: string[] = [],
        overrideBgStyle?: React.CSSProperties
    ): React.ReactNode {
        const layout = layouts[zone.id] as any
        const isCollapsed = collapsedZones.has(zone.id)
        const hasChildren = zone.children.length > 0
        const hasPositions = zone.positions.length > 0

        const isBigBin = isGrouped && (zone.id.startsWith('v-bin-') || zone.name.startsWith('Ô '))
        const isLevelUnderBin = isGrouped && (zone.id.startsWith('v-lvl-') || zone.name.toUpperCase().startsWith('TẦNG '))

        let positionColumns = layout?.position_columns ?? 8
        if (isMobile && positionColumns > 2) {
            positionColumns = 2
        }

        let cellWidth = layout?.cell_width ?? 0
        let cellHeight = layout?.cell_height ?? 0

        if (isLevelUnderBin) {
            positionColumns = 3
            cellWidth = 0
            cellHeight = 0
        }
        const childLayout = layout?.child_layout ?? 'vertical'
        const childColumns = layout?.child_columns ?? 0
        const childWidth = layout?.child_width ?? 0
        const collapsible = layout?.collapsible ?? true
        let displayType = layout?.display_type ?? 'auto'
        const alternatingRows = layout?.alternating_rows ?? false
        const headerColor = layout?.header_color ?? null
        const headerTextColor = layout?.header_text_color ?? null
        const effectiveChildCols = childColumns > 0 ? childColumns : 3

        if (depth === 0 && displayType === 'hidden') {
            displayType = 'auto'
        }

        const currentBreadcrumb = [...breadcrumb, zone.name]

        if (displayType === 'hidden') {
            if (isDesignMode) {
                return (
                    <div
                        key={zone.id}
                        className="rounded-xl border-2 border-dashed border-orange-300 dark:border-orange-700 overflow-hidden bg-orange-50/30 dark:bg-orange-900/10"
                    >
                        <div className="flex items-center justify-between px-4 py-2 bg-orange-100/50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">ẨN</span>
                                <span className="font-mono text-xs text-gray-500">{zone.code}</span>
                                <span className="font-medium text-sm text-gray-500 dark:text-gray-400 line-through">
                                    {zone.name}
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
                        <div className="p-3 space-y-3">
                            {hasPositions && (
                                <div
                                    className="grid gap-1"
                                    style={{
                                        gridTemplateColumns: cellWidth > 0
                                            ? `repeat(${positionColumns}, ${cellWidth}px)`
                                            : `repeat(${positionColumns}, minmax(auto, 1fr))`
                                    }}
                                >
                                    {zone.positions.map(pos => renderPositionCell(pos, cellHeight, cellWidth))}
                                </div>
                            )}
                            {zone.children.map(child => renderZone(child as any, depth + 1, currentBreadcrumb))}
                        </div>
                    </div>
                )
            }

            return (
                <div key={zone.id} className="contents">
                    {hasPositions && (
                        <div
                            className="grid gap-1 mb-1.5"
                            style={{
                                gridTemplateColumns: cellWidth > 0
                                    ? `repeat(${positionColumns}, ${cellWidth}px)`
                                    : `repeat(${positionColumns}, minmax(auto, 1fr))`
                            }}
                        >
                            {zone.positions.map(pos => renderPositionCell(pos, cellHeight, cellWidth))}
                        </div>
                    )}
                    {zone.children.map(child => renderZone(child as any, depth, currentBreadcrumb))}
                </div>
            )
        }

        if (!hasChildren && !hasPositions) return null

        const totalPositions = zone.totalPositions;
        const effectiveDisplayType = displayType === 'auto'
            ? (hasPositions && !hasChildren ? 'grid' : 'header')
            : displayType

        switch (effectiveDisplayType) {
            case 'grid':
                return (
                    <div
                        key={zone.id}
                        className={`rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 ${pageBreakIds.has(zone.id) ? 'print-break-before-page pt-4 print:pt-0' : ''}`}
                    >
                        {pageBreakIds.has(zone.id) && (
                            <div className="hidden print:block text-center border-b border-dashed border-gray-300 mb-4 pb-2 text-[10px] text-gray-400 italic">
                                -- Tiếp theo từ trang trước --
                            </div>
                        )}
                        <div
                            className={`flex items-center justify-between px-4 border-b ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-3'}`}
                            style={headerColor
                                ? { backgroundColor: headerColor, borderColor: headerColor }
                                : { background: 'linear-gradient(to right, rgb(236 253 245), white)' }
                            }
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`rounded-full shrink-0 ${isLevelUnderBin ? 'w-0.5 h-3' : isBigBin ? 'w-1 h-5' : 'w-1 h-8'}`}
                                    style={{ backgroundColor: headerTextColor || (headerColor ? 'rgba(255,255,255,0.8)' : '#22c55e') }}
                                />
                                <div>
                                    <h2
                                        className={`font-bold tracking-tight ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-sm' : 'text-lg'}`}
                                        style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }}
                                    >
                                        {isLevelUnderBin
                                            ? `${currentBreadcrumb.join(' • ')} | ${totalPositions} vị trí`
                                            : (isMobile || isGrouped ? currentBreadcrumb.slice(-1) : currentBreadcrumb.join(' • '))
                                        }
                                    </h2>
                                    {!isLevelUnderBin && totalPositions > 0 && (
                                        <p
                                            className="text-xs"
                                            style={{ color: headerTextColor ? `${headerTextColor}cc` : (headerColor ? 'rgba(255,255,255,0.8)' : undefined) }}
                                        >
                                            {totalPositions} vị trí
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 print:hidden">
                                {depth === 0 && onUpdateCollapsedZones && (
                                    <div className="flex items-center gap-1 mr-2 bg-black/10 rounded overflow-hidden">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                const descendantIds = zone.descendantIds
                                                onUpdateCollapsedZones(prev => {
                                                    const next = new Set(prev)
                                                    next.delete(zone.id)
                                                    descendantIds.forEach(id => next.add(id))
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                            title="Bung Dãy/Sảnh (Giấu Vị trí)"
                                        >
                                            Mở Dãy
                                        </button>
                                        <div className="w-px h-3 bg-white/30"></div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                const descendantIds = zone.descendantIds
                                                onUpdateCollapsedZones(prev => {
                                                    const next = new Set(prev)
                                                    next.delete(zone.id)
                                                    descendantIds.forEach(id => next.delete(id))
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                            title="Mở bung toàn bộ lưới Vị trí"
                                        >
                                            Mở Hết
                                        </button>
                                        <div className="w-px h-3 bg-white/30"></div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onUpdateCollapsedZones(prev => {
                                                    const next = new Set(prev)
                                                    next.add(zone.id)
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                            title="Gập gọn Kho này lại"
                                        >
                                            Thu Gọn
                                        </button>
                                    </div>
                                )}
                                {onTogglePageBreak && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onTogglePageBreak(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${pageBreakIds.has(zone.id)
                                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                            }`}
                                        title={pageBreakIds.has(zone.id) ? "Bỏ ngắt trang" : "Ngắt trang tại đây"}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 14h18" />
                                            <path d="M3 10h18" />
                                            <path d="M12 3v4" />
                                            <path d="M12 17v4" />
                                        </svg>
                                        {pageBreakIds.has(zone.id) ? 'Đã ngắt trang' : 'Ngắt trang'}
                                    </button>
                                )}
                                {onPrintZone && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onPrintZone(zone.id)
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 rounded text-xs font-medium transition-colors"
                                        title="In sơ đồ zone này"
                                    >
                                        <Printer size={12} />
                                        In sơ đồ
                                    </button>
                                )}
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
                        </div>

                        <div className="p-2">
                            {!isCollapsed && (
                                <>
                                    <div
                                        className="grid gap-1"
                                        style={{
                                            gridTemplateColumns: cellWidth > 0
                                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                                : `repeat(${positionColumns}, minmax(auto, 1fr))`
                                        }}
                                    >
                                        {zone.positions.map(pos => renderPositionCell(pos, cellHeight, cellWidth))}
                                    </div>
                                    {hasChildren && (
                                        <div className="mt-2 space-y-1.5">
                                            {zone.children.map(child => renderZone(child as any, depth + 1, currentBreadcrumb))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )

            case 'section':
                return (
                    <div
                        key={zone.id}
                        className={`rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 ${pageBreakIds.has(zone.id) ? 'print-break-before-page pt-4 print:pt-0' : ''}`}
                        style={overrideBgStyle}
                    >
                        {pageBreakIds.has(zone.id) && (
                            <div className="hidden print:block text-center border-b border-dashed border-gray-300 mb-4 pb-2 text-[10px] text-gray-400 italic">
                                -- Tiếp theo từ trang trước --
                            </div>
                        )}
                        <div
                            className={`flex items-center justify-between px-4 border-b cursor-pointer ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-3'}`}
                            style={headerColor
                                ? { backgroundColor: headerColor, borderColor: headerColor }
                                : { background: 'linear-gradient(to right, rgb(236 253 245), white)' }
                            }
                            onClick={() => collapsible && onToggleCollapse(zone.id)}
                        >
                            <div className="flex items-center gap-3">
                                {collapsible && (
                                    isCollapsed
                                        ? <ChevronRight size={isLevelUnderBin ? 12 : 16} style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }} className={headerColor || headerTextColor ? '' : 'text-emerald-500'} />
                                        : <ChevronDown size={isLevelUnderBin ? 12 : 16} style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }} className={headerColor || headerTextColor ? '' : 'text-emerald-500'} />
                                )}
                                <div
                                    className={`rounded-full shrink-0 ${isLevelUnderBin ? 'w-0.5 h-3' : isBigBin ? 'w-1 h-5' : 'w-1 h-8'}`}
                                    style={{ backgroundColor: headerTextColor || (headerColor ? 'rgba(255,255,255,0.8)' : '#22c55e') }}
                                />
                                <div>
                                    <h2
                                        className={`font-bold tracking-tight ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-sm' : 'text-lg'}`}
                                        style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }}
                                    >
                                        {isLevelUnderBin
                                            ? `${currentBreadcrumb.join(' • ')} | ${totalPositions} vị trí`
                                            : (isMobile || isGrouped ? currentBreadcrumb.slice(-1) : currentBreadcrumb.join(' • '))
                                        }
                                    </h2>
                                    {!isLevelUnderBin && totalPositions > 0 && (
                                        <p
                                            className="text-xs"
                                            style={{ color: headerTextColor ? `${headerTextColor}cc` : (headerColor ? 'rgba(255,255,255,0.8)' : undefined) }}
                                        >
                                            {totalPositions} vị trí
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 print:hidden">
                                {depth === 0 && onUpdateCollapsedZones && (
                                    <div className="flex items-center gap-1 mr-2 bg-black/10 rounded overflow-hidden">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                const descendantIds = zone.descendantIds
                                                onUpdateCollapsedZones(prev => {
                                                    const next = new Set(prev)
                                                    next.delete(zone.id)
                                                    descendantIds.forEach(id => next.add(id))
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                            title="Bung Dãy/Sảnh (Giấu Vị trí)"
                                        >
                                            Mở Dãy
                                        </button>
                                        <div className="w-px h-3 bg-white/30"></div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                const descendantIds = zone.descendantIds
                                                onUpdateCollapsedZones(prev => {
                                                    const next = new Set(prev)
                                                    next.delete(zone.id)
                                                    descendantIds.forEach(id => next.delete(id))
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                            title="Mở bung toàn bộ lưới Vị trí"
                                        >
                                            Mở Hết
                                        </button>
                                        <div className="w-px h-3 bg-white/30"></div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onUpdateCollapsedZones(prev => {
                                                    const next = new Set(prev)
                                                    next.add(zone.id)
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                            title="Gập gọn Kho này lại"
                                        >
                                            Thu Gọn
                                        </button>
                                    </div>
                                )}
                                {onTogglePageBreak && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onTogglePageBreak(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${pageBreakIds.has(zone.id)
                                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                            }`}
                                        title={pageBreakIds.has(zone.id) ? "Bỏ ngắt trang" : "Ngắt trang tại đây"}
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 14h18" />
                                            <path d="M3 10h18" />
                                            <path d="M12 3v4" />
                                            <path d="M12 17v4" />
                                        </svg>
                                        {pageBreakIds.has(zone.id) ? 'Đã ngắt trang' : 'Ngắt trang'}
                                    </button>
                                )}
                                {onPrintZone && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onPrintZone(zone.id)
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 rounded text-xs font-medium transition-colors"
                                        title="In sơ đồ zone này"
                                    >
                                        <Printer size={12} />
                                        In sơ đồ
                                    </button>
                                )}
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
                        </div>

                        {!isCollapsed && (
                            <div className="p-2 space-y-1.5">
                                {hasPositions && (
                                    <div
                                        className="grid gap-1"
                                        style={{
                                            gridTemplateColumns: cellWidth > 0
                                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                                : `repeat(${positionColumns}, minmax(auto, 1fr))`
                                        }}
                                    >
                                        {zone.positions.map(pos => renderPositionCell(pos, cellHeight, cellWidth))}
                                    </div>
                                )}
                                {hasChildren && (
                                    <div
                                        className={
                                            childLayout === 'horizontal'
                                                ? 'flex gap-1.5 overflow-x-auto pb-2'
                                                : childLayout === 'grid'
                                                    ? `grid gap-1.5`
                                                    : 'space-y-1.5'
                                        }
                                        style={
                                            childLayout === 'grid' && childColumns > 0
                                                ? { gridTemplateColumns: `repeat(${childColumns}, minmax(0, 1fr))` }
                                                : childLayout === 'grid'
                                                    ? { gridTemplateColumns: `repeat(auto-fill, minmax(300px, 1fr))` }
                                                    : undefined
                                        }
                                    >
                                        {zone.children.map((child, idx) => {
                                            const rowIdx = childLayout === 'grid' ? Math.floor(idx / effectiveChildCols) : 0
                                            const rowStyle: React.CSSProperties | undefined = alternatingRows && childLayout === 'grid' && rowIdx % 2 !== 0
                                                ? { backgroundColor: 'rgba(219, 234, 254, 0.55)', borderColor: 'rgba(147, 197, 253, 0.4)' }
                                                : undefined
                                            return (
                                                <div
                                                    key={child.id}
                                                    className={childLayout === 'horizontal' ? 'shrink-0 grow' : ''}
                                                    style={childLayout === 'horizontal' && childWidth > 0 ? { width: `${childWidth}px` } : undefined}
                                                >
                                                    {renderZone(child as any, depth + 1, currentBreadcrumb, rowStyle)}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )

            case 'header':
            default:
                return (
                    <div
                        key={zone.id}
                        className={`group rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${depth === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}
                        style={overrideBgStyle}
                    >
                        <div
                            className={`flex items-center justify-between px-4 border-b cursor-pointer transition-colors ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-2'} ${headerColor ? '' : `border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 ${depth === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}`}
                            style={headerColor
                                ? { backgroundColor: headerColor, borderColor: headerColor }
                                : undefined
                            }
                            onClick={() => collapsible && onToggleCollapse(zone.id)}
                        >
                            <div className="flex items-center gap-2">
                                {collapsible && (hasChildren || hasPositions) && (
                                    isCollapsed
                                        ? <ChevronRight size={isLevelUnderBin ? 12 : 16} style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }} className={headerColor || headerTextColor ? '' : 'text-gray-400'} />
                                        : <ChevronDown size={isLevelUnderBin ? 12 : 16} style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }} className={headerColor || headerTextColor ? '' : 'text-gray-400'} />
                                )}
                                <span
                                    className={`font-bold tracking-tight ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-base' : depth === 0 ? 'text-base' : 'text-sm'}`}
                                    style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }}
                                >
                                    {isLevelUnderBin ? `${currentBreadcrumb.join(' • ')} | ${totalPositions} vị trí` : zone.name}
                                </span>
                                {!isLevelUnderBin && totalPositions > 0 && (
                                    <span
                                        className={`px-1.5 py-0.5 rounded-full ${isLevelUnderBin ? 'text-[10px]' : 'text-xs'} ${headerColor || headerTextColor ? '' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'}`}
                                        style={{
                                            backgroundColor: headerTextColor ? `${headerTextColor}33` : (headerColor ? 'rgba(255,255,255,0.2)' : undefined),
                                            color: headerTextColor || (headerColor ? 'white' : undefined)
                                        }}
                                    >
                                        {totalPositions} vị trí
                                    </span>
                                )}
                            </div>

                            {depth === 0 && onUpdateCollapsedZones && (
                                <div className="flex items-center gap-1 mr-2 bg-black/10 rounded overflow-hidden">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const descendantIds = zone.descendantIds
                                            onUpdateCollapsedZones(prev => {
                                                const next = new Set(prev)
                                                next.delete(zone.id)
                                                descendantIds.forEach(id => next.add(id))
                                                return next
                                            })
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                        title="Bung Dãy/Sảnh (Giấu Vị trí)"
                                    >
                                        Mở Dãy
                                    </button>
                                    <div className="w-px h-3 bg-white/30"></div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            const descendantIds = zone.descendantIds
                                            onUpdateCollapsedZones(prev => {
                                                const next = new Set(prev)
                                                next.delete(zone.id)
                                                descendantIds.forEach(id => next.delete(id))
                                                return next
                                            })
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                        title="Mở bung toàn bộ lưới Vị trí"
                                    >
                                        Mở Hết
                                    </button>
                                    <div className="w-px h-3 bg-white/30"></div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onUpdateCollapsedZones(prev => {
                                                const next = new Set(prev)
                                                next.add(zone.id)
                                                return next
                                            })
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-black/20 text-white transition-colors"
                                        title="Gập gọn Kho này lại"
                                    >
                                        Thu Gọn
                                    </button>
                                </div>
                            )}

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

                        {!isCollapsed && (
                            <div className="p-1.5">
                                {hasPositions && (
                                    <div
                                        className="grid gap-1 mb-1.5"
                                        style={{
                                            gridTemplateColumns: cellWidth > 0
                                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                                : `repeat(${positionColumns}, minmax(auto, 1fr))`
                                        }}
                                    >
                                        {zone.positions.map(pos => renderPositionCell(pos, cellHeight, cellWidth))}
                                    </div>
                                )}
                                {hasChildren && (
                                    <div className="space-y-1.5">
                                        {zone.children.map(child => renderZone(child as any, depth + 1, currentBreadcrumb))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
        }
    }

    return (
        <div className="space-y-2">
            {zoneTree.map(root => renderZone(root as any))}
        </div>
    )
}
