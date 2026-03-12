'use client'
import React, { useMemo } from 'react'
import { Loader2, Printer, Download, Search, Check, ChevronDown, ChevronRight, MapPin, X, Settings, Layout, Monitor, Layers, Maximize2, MoreHorizontal, Eye, Package, Scissors } from 'lucide-react'
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
    onPositionSelect?: (id: string | string[]) => void,
    onViewDetails?: (lotId: string) => void,
    onPositionMenu?: (pos: any, event: React.MouseEvent) => void,
    isPrintPage?: boolean
}>(({
    pos, cellHeight, cellWidth, isMobile, isOccupied, isSelected,
    isTargetLot, lotDetail, isAssignmentMode, isHighlightBlinking, displayInternalCode, isGrouped,
    onPositionSelect, onViewDetails, onPositionMenu, isPrintPage
}) => {
    const ids = (pos as any).realIds || [pos.id]
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
        <div
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
            onClick={() => isAssignmentMode && onPositionSelect?.(ids)}
        >
            {!isAssignmentMode && !isPrintPage && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onPositionSelect?.(ids)
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
                {!isAssignmentMode && isOccupied && lotDetail && !isPrintPage && (
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

                {!isAssignmentMode && !isPrintPage && (
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

                <div className={`flex gap-0.5 absolute ${!isAssignmentMode && !isPrintPage ? 'right-5' : 'right-0'} top-0`}>
                    {isTargetLot && (
                        <div title="Đang chọn" className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    )}
                    {isOccupied && !isTargetLot && !isPrintPage && (
                        <div title="Có hàng">
                            <Package size={10} className="text-amber-500 dark:text-amber-400" />
                        </div>
                    )}
                </div>
            </div>

            {lotDetail && isOccupied ? (
                <div className="flex flex-col items-center w-full flex-1 min-h-0 gap-0.5 mt-0.5">
                    <div className={`${isGrouped ? 'text-[8px]' : 'text-[10px]'} font-bold leading-tight w-full text-center shrink-0 ${isTargetLot ? 'text-purple-700 dark:text-purple-300' : 'text-gray-900 dark:text-gray-100'} ${isGrouped ? 'break-all' : 'truncate'}`}>
                        {lotDetail.code}
                    </div>

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
        </div>
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
        prev.isGrouped === next.isGrouped &&
        prev.isPrintPage === next.isPrintPage
})

const MergedBigCell = React.memo<{
    pos: any,
    isMobile: boolean,
    isOccupied: boolean,
    isSelected: boolean,
    isTargetLot: boolean,
    aggregatedItems: Array<{ product_name: string, sku: string, unit: string, quantity: number, internal_name?: string, internal_code?: string }>,
    isAssignmentMode: boolean,
    isHighlightBlinking: boolean,
    displayInternalCode?: boolean,
    zoneBreadcrumb?: string[],
    onPositionSelect?: (id: string | string[]) => void,
    onViewDetails?: (lotId: string) => void,
    onPositionMenu?: (pos: any, event: React.MouseEvent) => void,
    mergedLevels?: string[],
    levelGroups?: Array<{ name: string, items: Array<{ product_name: string, sku: string, unit: string, quantity: number, internal_name?: string, internal_code?: string }> }>,
    isPrintPage?: boolean
}>(({ pos, isMobile, isOccupied, isSelected, isTargetLot, aggregatedItems, isAssignmentMode, isHighlightBlinking, displayInternalCode, zoneBreadcrumb, onPositionSelect, onViewDetails, onPositionMenu, mergedLevels, levelGroups, isPrintPage }) => {
    const ids = pos.realIds || [pos.id]
    const mergedCount = pos.mergedCount || ids.length
    const originalCodes = pos.originalCodes || [pos.code]

    let bgClass = 'bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20'
    let borderClass = 'border-indigo-300 dark:border-indigo-700'
    let ringClass = ''

    if (isSelected) {
        bgClass = 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30'
        borderClass = 'border-blue-500'
        ringClass = 'ring-2 ring-blue-300'
    } else if (isTargetLot) {
        bgClass = 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30'
        borderClass = 'border-purple-500'
        ringClass = 'ring-2 ring-purple-300'
    } else if (isOccupied) {
        bgClass = 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10'
        borderClass = 'border-amber-300 dark:border-amber-700'
    }

    return (
        <div
            style={{ gridColumn: '1 / -1', minHeight: isMobile ? '110px' : '150px' }}
            className={`
                relative ${isAssignmentMode ? 'cursor-pointer' : ''} p-2.5 print:p-1.5 rounded-xl border-2 transition-all
                flex flex-col h-full print:h-auto overflow-hidden print:overflow-visible print:!min-h-0
                ${bgClass} ${borderClass} ${ringClass}
                ${isAssignmentMode ? 'hover:shadow-lg hover:scale-[1.01] hover:z-10' : ''}
                ${isHighlightBlinking ? 'animate-highlight-blink' : ''}
            `}
            onClick={() => isAssignmentMode && onPositionSelect?.(ids)}
        >
            {/* Top row: badge + code + actions */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    {/* Checkbox */}
                    {!isAssignmentMode && !isPrintPage && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPositionSelect?.(ids) }}
                            className={`w-5 h-5 rounded shrink-0 border-2 transition-all flex items-center justify-center
                                ${isSelected
                                    ? 'bg-blue-500 border-blue-500 text-white shadow-md'
                                    : 'bg-white/90 dark:bg-gray-800/90 border-gray-300 dark:border-gray-500 hover:border-blue-400'
                                }
                            `}
                            title={isSelected ? "Bỏ chọn" : "Chọn vị trí"}
                        >
                            {isSelected && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Big Position Title */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Maximize2 size={14} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
                        <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                            {zoneBreadcrumb && zoneBreadcrumb.length > 0
                                ? zoneBreadcrumb.join(' • ')
                                : pos.code
                            }
                        </span>
                        <span className="text-[9px] bg-indigo-100 dark:bg-indigo-800/50 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded-full font-bold shrink-0 whitespace-nowrap">
                            {mergedLevels && mergedLevels.length > 0 
                                ? `Gộp ${mergedLevels.length} tầng`
                                : `${mergedCount} ô gộp`
                            }
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {!isAssignmentMode && isOccupied && aggregatedItems.length > 0 && !isPrintPage && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onViewDetails?.(pos.lot_id!) }}
                            className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors"
                            title="Xem chi tiết LOT"
                        >
                            <Eye size={14} />
                        </button>
                    )}
                    {isOccupied && !isPrintPage && (
                        <Package size={14} className="text-amber-500 dark:text-amber-400" />
                    )}
                    {isTargetLot && (
                        <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                    )}
                    {!isAssignmentMode && !isPrintPage && (
                        <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPositionMenu?.(pos, e) }}
                            className="text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-300 transition-colors p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            title="Tùy chọn"
                        >
                            <MoreHorizontal size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content: Aggregated product summary */}
            {aggregatedItems.length > 0 || (levelGroups && levelGroups.length > 0) ? (
                <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                    {levelGroups && levelGroups.length > 0 ? (
                        <div className="space-y-2">
                            {levelGroups.map((group, gIdx) => (
                                <div key={gIdx} className="border-l-2 border-indigo-200 dark:border-indigo-800 pl-2 py-0.5 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-r">
                                    <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1">
                                        <Layers size={10} /> {group.name}
                                    </div>
                                    <div className="grid gap-y-0.5 items-start" style={{ gridTemplateColumns: '1fr auto', columnGap: '6px' }}>
                                        {group.items.length > 0 ? (
                                            group.items.map((item, idx) => {
                                                const nameObj = displayInternalCode && item.internal_name ? item.internal_name : item.product_name;
                                                const codeObj = displayInternalCode && item.internal_code ? item.internal_code : item.sku;
                                                return (
                                                    <React.Fragment key={idx}>
                                                        <span className="text-[10px] text-gray-600 dark:text-gray-300 line-clamp-1">{nameObj}{nameObj ? ` (${codeObj || '-'})` : (codeObj || '-')}</span>
                                                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap text-right">
                                                            : {item.quantity} {item.unit || '-'}
                                                        </span>
                                                    </React.Fragment>
                                                )
                                            })
                                        ) : (
                                            <span className="text-[10px] text-gray-400 dark:text-gray-500 italic col-span-2">Trống</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid gap-y-0.5 items-start" style={{ gridTemplateColumns: '1fr auto', columnGap: '6px' }}>
                            {aggregatedItems.slice(0, isMobile ? 3 : 5).map((item, idx) => {
                                const nameObj = displayInternalCode && item.internal_name ? item.internal_name : item.product_name;
                                const codeObj = displayInternalCode && item.internal_code ? item.internal_code : item.sku;
                                return (
                                    <React.Fragment key={idx}>
                                        <span className="text-[10px] text-gray-600 dark:text-gray-300">{nameObj}{nameObj ? ` (${codeObj || '-'})` : (codeObj || '-')}</span>
                                        <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap text-right">
                                            : {item.quantity} {item.unit || '-'}
                                        </span>
                                    </React.Fragment>
                                )
                            })}

                            {aggregatedItems.length > (isMobile ? 3 : 5) && (() => {
                                const others = aggregatedItems.slice(isMobile ? 3 : 5);
                                const unitSums = others.reduce((acc: any, curr: any) => {
                                    const unit = curr.unit || '-';
                                    acc[unit] = (acc[unit] || 0) + curr.quantity;
                                    return acc;
                                }, {} as Record<string, number>);

                                const summaryText = Object.entries(unitSums)
                                    .map(([unit, qty]) => `${qty} ${unit}`)
                                    .join(' và ');

                                return (
                                    <React.Fragment>
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400 italic">Các mặt hàng khác</span>
                                        <span className="text-[10px] font-mono text-blue-500 dark:text-blue-500 font-bold whitespace-nowrap text-right">
                                            : {summaryText}
                                        </span>
                                    </React.Fragment>
                                );
                            })()}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-[10px] text-gray-400 font-medium italic">Ô lớn trống — gán LOT để sử dụng</span>
                </div>
            )}

            {/* Footer: original position codes - Hide in print view */}
            {!isPrintPage && (
                <div className="flex items-center gap-1 mt-1 pt-1 border-t border-indigo-200/50 dark:border-indigo-700/30 overflow-hidden">
                    <span className="text-[7px] text-gray-400 dark:text-gray-500 shrink-0">Gồm:</span>
                    <div className="flex gap-0.5 overflow-hidden whitespace-nowrap">
                        {originalCodes.map((code: string, i: number) => (
                            <span key={i} className="text-[7px] px-0.5 bg-white/60 dark:bg-gray-800/40 rounded text-gray-500 dark:text-gray-400 font-mono">
                                {code}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}, (prev, next) => {
    return prev.pos.id === next.pos.id &&
        prev.pos.lot_id === next.pos.lot_id &&
        prev.isMobile === next.isMobile &&
        prev.isOccupied === next.isOccupied &&
        prev.isSelected === next.isSelected &&
        prev.isTargetLot === next.isTargetLot &&
        prev.aggregatedItems === next.aggregatedItems &&
        prev.isAssignmentMode === next.isAssignmentMode &&
        prev.isHighlightBlinking === next.isHighlightBlinking &&
        prev.displayInternalCode === next.displayInternalCode &&
        prev.isPrintPage === next.isPrintPage
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
    onPositionSelect?: (positionIds: string | string[]) => void
    onBulkSelect?: (positionIds: string[], shouldSelect: boolean) => void
    onViewDetails?: (lotId: string) => void
    onPositionMenu?: (pos: any, e: React.MouseEvent) => void
    onConfigureZone?: (zone: Zone) => void
    highlightLotId?: string | null
    highlightingPositionIds?: Set<string>
    lotInfo?: Record<string, { code: string, items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>, inbound_date?: string, created_at?: string, packaging_date?: string, peeling_date?: string, tags?: string[] }>
    pageBreakIds?: Set<string>
    onTogglePageBreak?: (zoneId: string) => void
    onPrintZone?: (zoneId: string) => void
    displayInternalCode?: boolean
    isGrouped?: boolean
    mergedZones?: Set<string>
    onToggleMergeZone?: (zoneId: string) => void
    isCapturing?: boolean
    isPrintPage?: boolean
}

export default function FlexibleZoneGrid({
    zones,
    positions,
    layouts,
    occupiedIds,
    collapsedZones,
    selectedPositionIds,
    isDesignMode = false,
    isAssignmentMode = false,
    onUpdateCollapsedZones,
    onToggleCollapse,
    onPositionSelect,
    onBulkSelect,
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
    isGrouped = false,
    mergedZones = new Set(),
    onToggleMergeZone,
    isCapturing = false,
    isPrintPage = false
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
            node.positions.sort((a, b) => {
                const codeA = a.code || ''
                const codeB = b.code || ''

                // Extract numeric suffix (e.g., "01" from "A01")
                const matchA = codeA.match(/\d+$/)
                const matchB = codeB.match(/\d+$/)

                const numA = matchA ? parseInt(matchA[0], 10) : -1
                const numB = matchB ? parseInt(matchB[0], 10) : -1

                // 1. Sort by numeric suffix DESCENDING (02 above 01)
                if (numA !== numB) {
                    return numB - numA
                }

                // 2. Sort by prefix ABC ASCENDING
                return codeA.localeCompare(codeB, undefined, { numeric: true })
            })

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

    function renderPositionCell(pos: any, cellHeight: number, cellWidth: number) {
        const realIds = pos.realIds || [pos.id]
        const isOccupied = realIds.some((id: string) => occupiedIds.has(id)) || !!pos.lot_id
        const isSelected = realIds.some((id: string) => selectedPositionIds.has(id))
        const isTargetLot = highlightLotId ? realIds.some((id: string) => {
            const lotId = (pos.lot_id)
            return lotId === highlightLotId
        }) : false
        const isHighlightBlinking = realIds.some((id: string) => highlightingPositionIds.has(id))

        // Render merged big cell for virtual positions
        if (pos.isVirtual && pos.mergedCount > 1) {
            return (
                <MergedBigCell
                    key={pos.id}
                    pos={pos}
                    isMobile={isMobile}
                    isOccupied={isOccupied}
                    isSelected={isSelected}
                    isTargetLot={isTargetLot}
                    aggregatedItems={pos.lot_id && lotInfo[pos.lot_id]?.items ? lotInfo[pos.lot_id].items : []}
                    isAssignmentMode={isAssignmentMode}
                    isHighlightBlinking={isHighlightBlinking}
                    displayInternalCode={displayInternalCode}
                    onPositionSelect={onPositionSelect}
                    onViewDetails={onViewDetails}
                    onPositionMenu={onPositionMenu}
                    isPrintPage={isPrintPage}
                />
            )
        }

        return (
            <MemoizedPositionCell
                key={pos.id}
                pos={pos}
                cellHeight={cellHeight}
                cellWidth={cellWidth}
                isMobile={isMobile}
                isOccupied={isOccupied}
                isSelected={isSelected}
                isTargetLot={isTargetLot}
                lotDetail={pos.lot_id ? lotInfo[pos.lot_id] : null}
                isAssignmentMode={isAssignmentMode}
                isHighlightBlinking={isHighlightBlinking}
                displayInternalCode={displayInternalCode}
                onPositionSelect={onPositionSelect}
                onViewDetails={onViewDetails}
                onPositionMenu={onPositionMenu}
                isPrintPage={isPrintPage}
            />
        )
    }

    // Build a virtual merged position from an array of positions
    function buildMergedPosition(positions: any[], mergedLevels?: string[]) {
        const sorted = [...positions].sort((a, b) =>
            (a.code || '').localeCompare(b.code || '', undefined, { numeric: true })
        )
        const codes = sorted.map((p: any) => p.code || p.id.slice(0, 6))
        const mergedCode = codes.length <= 3
            ? codes.join(' + ')
            : `${codes[0]} ~ ${codes[codes.length - 1]}`

        // Determine lot_id: use the most common lot_id
        const lotIdCounts = new Map<string, number>()
        sorted.forEach((p: any) => {
            if (p.lot_id) lotIdCounts.set(p.lot_id, (lotIdCounts.get(p.lot_id) || 0) + 1)
        })
        let bestLotId: string | null = null
        let bestCount = 0
        lotIdCounts.forEach((count, lotId) => {
            if (count > bestCount) { bestLotId = lotId; bestCount = count }
        })

        return {
            ...sorted[0],
            id: `v-pos-merged-${sorted.map((p: any) => p.id).join('-').slice(0, 40)}`,
            code: mergedCode,
            lot_id: bestLotId,
            realIds: sorted.map((p: any) => p.id),
            isVirtual: true,
            mergedCount: sorted.length,
            originalCodes: codes,
            mergedLevels: mergedLevels
        }
    }

    // Render positions grid — if zone is merged, render as single big cell
    function renderPositionsGrid(zone: any, cellHeight: number, cellWidth: number, positionColumns: number, breadcrumb?: string[]) {
        const nameUpper = zone.name.toUpperCase()
        const isSanh = nameUpper.startsWith('SẢNH') || nameUpper.startsWith('SÀNH') || nameUpper.startsWith('SANH')
        const isBinMerged = mergedZones.has(zone.id) || (isGrouped && isSanh)
        
        const isBigBin = isGrouped && (zone.id.startsWith('v-bin-') || zone.name.startsWith('Ô ') || isSanh)
        
        let targetPositions = zone.positions || []
        if (isBinMerged && isBigBin) {
            // Collect all positions from all descendant levels
            const allPositions: any[] = [...zone.positions]
            const collectFromChildren = (node: any) => {
                node.children.forEach((child: any) => {
                    allPositions.push(...child.positions)
                    collectFromChildren(child)
                })
            }
            collectFromChildren(zone)
            targetPositions = allPositions
        }

        const isMerged = isBinMerged && targetPositions.length > 1

        if (isMerged) {
            const levelNames: string[] = []
            const levelGroups: Array<{ name: string, items: any[] }> = []

            if (isBinMerged && isBigBin) {
                const collectFromChildren = (node: any) => {
                    node.children.forEach((child: any) => {
                        levelNames.push(child.name)
                        
                        // Collect items for this level
                        const levelItemMap = new Map<string, any>()
                        child.positions.forEach((p: any) => {
                            if (p.lot_id && lotInfo[p.lot_id]?.items) {
                                lotInfo[p.lot_id].items.forEach((item: any) => {
                                    const key = `${item.sku || ''}_${item.unit || ''}`
                                    const existing = levelItemMap.get(key)
                                    if (existing) {
                                        existing.quantity += (item.quantity || 0)
                                    } else {
                                        levelItemMap.set(key, { ...item, quantity: item.quantity || 0 })
                                    }
                                })
                            }
                        })
                        
                        // Always push level, if size is 0 and it's print page, it will show "Trống"
                        if (levelItemMap.size > 0 || isPrintPage) {
                            levelGroups.push({
                                name: child.name,
                                items: Array.from(levelItemMap.values())
                            })
                        }

                        collectFromChildren(child)
                    })
                }
                collectFromChildren(zone)
            }

            const mergedPos = buildMergedPosition(targetPositions, levelNames)
            const realIds = mergedPos.realIds
            const isOccupied = realIds.some((id: string) => occupiedIds.has(id)) || !!mergedPos.lot_id
            const isSelected = realIds.some((id: string) => selectedPositionIds.has(id))
            const isTargetLot = highlightLotId ? mergedPos.lot_id === highlightLotId : false
            const isHighlightBlinking = realIds.some((id: string) => highlightingPositionIds.has(id))

            // Aggregate all lot items from all real positions
            const itemMap = new Map<string, { product_name: string, sku: string, unit: string, quantity: number, internal_name?: string, internal_code?: string }>()
            targetPositions.forEach((p: any) => {
                if (p.lot_id && lotInfo[p.lot_id]?.items) {
                    lotInfo[p.lot_id].items.forEach((item: any) => {
                        const key = `${item.sku || ''}_${item.unit || ''}`
                        const existing = itemMap.get(key)
                        if (existing) {
                            existing.quantity += (item.quantity || 0)
                        } else {
                            itemMap.set(key, { ...item, quantity: item.quantity || 0 })
                        }
                    })
                }
            })
            const aggregatedItems = Array.from(itemMap.values())

            return (
                <div className="grid gap-1.5 print:gap-0.5 h-full print:h-auto" style={{ gridTemplateColumns: '1fr' }}>
                    <MergedBigCell
                        key={mergedPos.id}
                        pos={mergedPos}
                        isMobile={isMobile}
                        isOccupied={isOccupied}
                        isSelected={isSelected}
                        isTargetLot={isTargetLot}
                        aggregatedItems={aggregatedItems}
                        isAssignmentMode={isAssignmentMode}
                        isHighlightBlinking={isHighlightBlinking}
                        displayInternalCode={displayInternalCode}
                        zoneBreadcrumb={breadcrumb}
                        onPositionSelect={onPositionSelect}
                        onViewDetails={onViewDetails}
                        onPositionMenu={onPositionMenu}
                        mergedLevels={levelNames}
                        levelGroups={levelGroups}
                        isPrintPage={isPrintPage}
                    />
                </div>
            )
        }

        return (
            <div
                className="grid gap-1.5 print:gap-0.5"
                style={{
                    gridTemplateColumns: cellWidth > 0
                        ? `repeat(${positionColumns}, ${cellWidth}px)`
                        : `repeat(${positionColumns}, minmax(0, 1fr))`
                }}
            >
                {zone.positions.map((pos: any) => renderPositionCell(pos, cellHeight, cellWidth))}
            </div>
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

        const nameUpper = zone.name.toUpperCase()
        const isSanh = nameUpper.startsWith('SẢNH') || nameUpper.startsWith('SÀNH') || nameUpper.startsWith('SANH')
        const isBigBin = isGrouped && (zone.id.startsWith('v-bin-') || zone.name.toUpperCase().startsWith('Ô ') || isSanh)
        const isLevelUnderBin = isGrouped && (zone.id.startsWith('v-lvl-') || zone.name.toUpperCase().startsWith('TẦNG '))
        const shouldRenderGrid = hasPositions || (mergedZones.has(zone.id) && isBigBin)

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

        // --- Select All Logic ---
        // Exclude virtual/empty positions from being selectable if not in assignment mode
        const selectablePositions = isAssignmentMode
            ? zone.positions
            : zone.positions.filter(p => occupiedIds.has(p.id))

        // Find all selectable IDs in this zone + descendants
        const allSelectableDescendantIds: string[] = []

        // Quick extraction to get all positions in descendant zones
        const exploreSelectableIds = (z: typeof zone) => {
            const zSelectable = isAssignmentMode
                ? z.positions.map(p => p.id)
                : z.positions.filter(p => occupiedIds.has(p.id)).map(p => p.id)
            allSelectableDescendantIds.push(...zSelectable)
            z.children.forEach(child => exploreSelectableIds(child as any))
        }
        exploreSelectableIds(zone)

        const selectedCount = allSelectableDescendantIds.filter(id => selectedPositionIds.has(id)).length
        const totalSelectableCount = allSelectableDescendantIds.length

        const isAllSelected = totalSelectableCount > 0 && selectedCount === totalSelectableCount
        const isIndeterminate = selectedCount > 0 && selectedCount < totalSelectableCount

        const handleZoneCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!onBulkSelect || totalSelectableCount === 0) return
            e.stopPropagation()
            onBulkSelect(allSelectableDescendantIds, e.target.checked)
        }
        // -----------------------

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
                        className={`flex flex-col print:block rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:overflow-visible bg-white dark:bg-gray-800  print:break-inside-auto ${pageBreakIds.has(zone.id) ? 'print-break-before-page pt-4 print:pt-0' : ''}`}
                    >
                        {pageBreakIds.has(zone.id) && (
                            <div className="hidden print:block text-center border-b border-dashed border-gray-300 mb-4 pb-2 text-[10px] text-gray-400 italic">
                                -- Tiếp theo từ trang trước --
                            </div>
                        )}
                        <div
                            className={`flex items-center justify-between px-4 border-b print:py-1 ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-3'} ${collapsible ? 'cursor-pointer hover:bg-emerald-50/50' : ''}`}
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
                                    <div className="flex items-center gap-2 print-break-after-avoid">
                                        {!isAssignmentMode && totalSelectableCount > 0 && onBulkSelect && (
                                            <div className="flex items-center justify-center shrink-0" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={isAllSelected}
                                                    ref={el => {
                                                        if (el) el.indeterminate = isIndeterminate
                                                    }}
                                                    onChange={handleZoneCheckboxChange}
                                                    title={`Chọn tất cả ${totalSelectableCount} vị trí có hàng`}
                                                />
                                            </div>
                                        )}
                                        <h2
                                            className={`font-bold tracking-tight ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-sm' : 'text-lg'}`}
                                            style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }}
                                        >
                                            {isLevelUnderBin
                                                ? (isGrouped ? (zone.name.includes('|') ? zone.name : `${zone.name} | ${totalPositions} vị trí`) : `${currentBreadcrumb.join(' • ')} | ${totalPositions} vị trí`)
                                                : (isMobile || isGrouped ? zone.name : currentBreadcrumb.join(' • '))
                                            }
                                        </h2>
                                    </div>
                                    {!isLevelUnderBin && totalPositions > 0 && (
                                        <p
                                            className="text-xs"
                                            style={{ color: headerTextColor ? `${headerTextColor}cc` : (headerColor ? 'rgba(255,255,255,0.8)' : undefined) }}
                                        >
                                            {totalPositions} ô / <span className="font-semibold text-blue-600 dark:text-blue-400">{totalSelectableCount} có hàng</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 print:hidden ${isCapturing ? "hidden" : ""}`}>
                                {/* Hide manual merge button in print view */}
                                {false && isPrintPage && isGrouped && (isLevelUnderBin || isBigBin) && (zone.positions.length > 1 || zone.totalPositions > 1) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onToggleMergeZone?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                            mergedZones.has(zone.id)
                                                ? (headerColor ? 'bg-white text-black' : 'bg-indigo-600 text-white shadow-sm')
                                                : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-white/80 text-indigo-600 border border-indigo-200 hover:bg-indigo-50')
                                        }`}
                                        title={mergedZones.has(zone.id) ? "Tắt gộp ô lớn" : "Gộp thành ô lớn (hàng cồng kềnh)"}
                                    >
                                        <Maximize2 size={11} />
                                        {mergedZones.has(zone.id) ? 'Đang gộp' : 'Gộp ô'}
                                    </button>
                                )}
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
                                {false && isPrintPage && onTogglePageBreak && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onTogglePageBreak?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${pageBreakIds.has(zone.id)
                                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                                            : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200')
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
                                {!isPrintPage && onPrintZone && depth <= 1 && (
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

                        <div className="p-2 flex-1 flex flex-col print:flex-none print:h-auto">
                            {!isCollapsed && (
                                <div className="p-3 flex-1 flex flex-col bg-white/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 print:flex-none print:h-auto">
                                    {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                    {hasChildren && !mergedZones.has(zone.id) && (
                                        <div className="mt-2 print:mt-0 space-y-1.5 px-1 pb-1">
                                            {zone.children.map((child, idx) => (
                                                <React.Fragment key={child.id}>
                                                    {isPrintPage && onTogglePageBreak && idx > 0 && (
                                                        <>
                                                            <div className="hide-on-real-print w-full flex items-center justify-center">
                                                                <button
                                                                    onClick={() => onTogglePageBreak(child.id)}
                                                                    className={`w-full flex items-center justify-center gap-1.5 text-[10px] transition-all cursor-pointer rounded ${pageBreakIds.has(child.id) ? 'py-1 bg-blue-100 border-y-2 border-dashed border-blue-500 opacity-100' : 'h-2 py-0 opacity-0 hover:opacity-100 hover:bg-blue-100 hover:h-6'}`}
                                                                >
                                                                    <Scissors size={10} className={pageBreakIds.has(child.id) ? 'text-blue-600' : 'text-stone-400'} />
                                                                    <span className={pageBreakIds.has(child.id) ? 'text-blue-600 font-bold' : 'text-stone-400'}>{pageBreakIds.has(child.id) ? '✂ Ngắt trang' : 'Ngắt trang'}</span>
                                                                </button>
                                                            </div>
                                                            {pageBreakIds.has(child.id) && <div className="hidden print:block print-break-before-page" />}
                                                        </>
                                                    )}
                                                    {renderZone(child as any, depth + 1, currentBreadcrumb)}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )

            case 'section':
                return (
                    <div
                        key={zone.id}
                        className={`flex flex-col print:block rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:overflow-visible bg-white dark:bg-gray-800  print:break-inside-auto ${pageBreakIds.has(zone.id) ? 'print-break-before-page pt-4 print:pt-0' : ''}`}
                        style={overrideBgStyle}
                    >
                        {pageBreakIds.has(zone.id) && (
                            <div className="hidden print:block text-center border-b border-dashed border-gray-300 mb-4 pb-2 text-[10px] text-gray-400 italic">
                                -- Tiếp theo từ trang trước --
                            </div>
                        )}
                        <div
                            className={`flex items-center justify-between px-4 border-b cursor-pointer print-break-after-avoid print:py-1 ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-3'}`}
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
                                    <div className="flex items-center gap-2">
                                        {!isAssignmentMode && totalSelectableCount > 0 && onBulkSelect && (
                                            <div className="flex items-center justify-center shrink-0" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    checked={isAllSelected}
                                                    ref={el => {
                                                        if (el) el.indeterminate = isIndeterminate
                                                    }}
                                                    onChange={handleZoneCheckboxChange}
                                                    title={`Chọn tất cả ${totalSelectableCount} vị trí có hàng`}
                                                />
                                            </div>
                                        )}
                                        <h2
                                            className={`font-bold tracking-tight ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-sm' : 'text-lg'}`}
                                            style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }}
                                        >
                                            {isLevelUnderBin
                                                ? `${currentBreadcrumb.join(' • ')} | ${totalPositions} vị trí`
                                                : (isMobile || isGrouped ? currentBreadcrumb.slice(-1) : currentBreadcrumb.join(' • '))
                                            }
                                        </h2>
                                    </div>
                                    {!isLevelUnderBin && totalPositions > 0 && (
                                        <p
                                            className="text-xs"
                                            style={{ color: headerTextColor ? `${headerTextColor}cc` : (headerColor ? 'rgba(255,255,255,0.8)' : undefined) }}
                                        >
                                            {totalPositions} ô / <span className="font-semibold text-blue-600 dark:text-blue-400">{totalSelectableCount} có hàng</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 print:hidden ${isCapturing ? "hidden" : ""}`}>
                                {/* Hide manual merge button in print view */}
                                {false && isPrintPage && isGrouped && (isLevelUnderBin || isBigBin) && (zone.positions.length > 1 || zone.totalPositions > 1) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onToggleMergeZone?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                            mergedZones.has(zone.id)
                                                ? (headerColor ? 'bg-white text-black' : 'bg-indigo-600 text-white shadow-sm')
                                                : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-white/80 text-indigo-600 border border-indigo-200 hover:bg-indigo-50')
                                        }`}
                                        title={mergedZones.has(zone.id) ? "Tắt gộp ô lớn" : "Gộp thành ô lớn (hàng cồng kềnh)"}
                                    >
                                        <Maximize2 size={11} />
                                        {mergedZones.has(zone.id) ? 'Đang gộp' : 'Gộp ô'}
                                    </button>
                                )}
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
                                {false && isPrintPage && onTogglePageBreak && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onTogglePageBreak?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${pageBreakIds.has(zone.id)
                                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                                            : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200')
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
                                {!isPrintPage && onPrintZone && depth <= 1 && (
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
                            <div className="p-2 flex flex-col bg-emerald-50/10 dark:bg-gray-900/10 border-t border-gray-100 dark:border-gray-800 print:block print:flex-none print:h-auto print:overflow-visible">
                                {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                {hasChildren && !mergedZones.has(zone.id) && (
                                    <div
                                        className={
                                            childLayout === 'horizontal'
                                                ? 'flex gap-1.5 overflow-x-auto pb-2'
                                                : childLayout === 'grid'
                                                    ? `grid gap-1.5 print:gap-0.5`
                                                    : 'space-y-1.5 print:space-y-0.5'
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
                                            
                                            const isNewRow = childLayout === 'grid' ? (idx > 0 && idx % effectiveChildCols === 0) : (idx > 0)
                                            return (
                                                <React.Fragment key={child.id}>
                                                    {isPrintPage && onTogglePageBreak && isNewRow && (
                                                        <>
                                                            <div 
                                                                className="hide-on-real-print w-full flex items-center justify-center"
                                                                style={childLayout === 'grid' ? { gridColumn: '1 / -1' } : undefined}
                                                            >
                                                                <button
                                                                    onClick={() => onTogglePageBreak(child.id)}
                                                                    className={`w-full flex items-center justify-center gap-1.5 text-[10px] transition-all cursor-pointer rounded ${pageBreakIds.has(child.id) ? 'py-1 bg-blue-100 border-y-2 border-dashed border-blue-500 opacity-100' : 'h-2 py-0 opacity-0 hover:opacity-100 hover:bg-blue-100 hover:h-6'}`}
                                                                >
                                                                    <Scissors size={10} className={pageBreakIds.has(child.id) ? 'text-blue-600' : 'text-stone-400'} />
                                                                    <span className={pageBreakIds.has(child.id) ? 'text-blue-600 font-bold' : 'text-stone-400'}>{pageBreakIds.has(child.id) ? '✂ Ngắt trang' : 'Ngắt trang'}</span>
                                                                </button>
                                                            </div>
                                                            {pageBreakIds.has(child.id) && (
                                                                <div 
                                                                    className="hidden print:block print-break-before-page" 
                                                                    style={childLayout === 'grid' ? { gridColumn: '1 / -1', height: 0, padding: 0 } : { height: 0, padding: 0 }}
                                                                />
                                                            )}
                                                        </>
                                                    )}
                                                    <div
                                                        className={childLayout === 'horizontal' ? 'shrink-0 grow flex flex-col print:block' : (childLayout === 'grid' ? 'h-auto flex flex-col print:block print:h-auto print:flex-none' : 'print:block print:h-auto print:flex-none flex flex-col')}
                                                        style={childLayout === 'horizontal' && childWidth > 0 ? { width: `${childWidth}px` } : undefined}
                                                    >
                                                        {renderZone(child as any, depth + 1, currentBreadcrumb, rowStyle)}
                                                    </div>
                                                </React.Fragment>
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
                        className={`group flex flex-col h-auto print:block print:h-auto rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden print:overflow-visible ${depth === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}
                        style={overrideBgStyle}
                    >
                        <div
                            className={`flex items-center justify-between px-4 border-b cursor-pointer transition-colors print:py-1 ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-2'} ${headerColor ? '' : `border-gray-100 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 ${depth === 0 ? 'bg-gray-50 dark:bg-gray-900/50' : ''}`}`}
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
                                {!isAssignmentMode && totalSelectableCount > 0 && onBulkSelect && (
                                    <div className="flex items-center justify-center shrink-0 mr-1" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            checked={isAllSelected}
                                            ref={el => {
                                                if (el) el.indeterminate = isIndeterminate
                                            }}
                                            onChange={handleZoneCheckboxChange}
                                            title={`Chọn tất cả ${totalSelectableCount} vị trí có hàng`}
                                        />
                                    </div>
                                )}
                                <span
                                    className={`font-bold tracking-tight ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-base' : depth === 0 ? 'text-base' : 'text-sm'}`}
                                    style={{ color: headerTextColor || (headerColor ? 'white' : undefined) }}
                                >
                                    {isLevelUnderBin
                                        ? (isGrouped ? (zone.name.includes('|') ? zone.name : `${zone.name} | ${totalPositions} vị trí`) : `${currentBreadcrumb.join(' • ')} | ${totalPositions} vị trí`)
                                        : (isMobile || isGrouped ? zone.name : currentBreadcrumb.join(' • '))
                                    }
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

                            <div className={`flex items-center gap-2 print:hidden ${isCapturing ? 'hidden' : ''}`}>
                                {/* Hide manual merge button in print view */}
                                {false && isPrintPage && isGrouped && (isLevelUnderBin || isBigBin) && (zone.positions.length > 1 || zone.totalPositions > 1) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onToggleMergeZone?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                            (mergedZones.has(zone.id) || (isGrouped && isSanh))
                                                ? (headerColor ? 'bg-white text-black' : 'bg-indigo-600 text-white shadow-sm')
                                                : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-white/80 text-indigo-600 border border-indigo-200 hover:bg-indigo-50')
                                        }`}
                                        title={mergedZones.has(zone.id) ? "Tắt gộp ô lớn" : "Gộp thành ô lớn (hàng cồng kềnh)"}
                                    >
                                        <Maximize2 size={11} />
                                        { (mergedZones.has(zone.id) || (isGrouped && isSanh)) ? 'Đang gộp' : 'Gộp ô'}
                                    </button>
                                )}

                                {false && isPrintPage && onTogglePageBreak && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onTogglePageBreak?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${pageBreakIds.has(zone.id)
                                            ? 'bg-orange-500 text-white hover:bg-orange-600'
                                            : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200')
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

                                {!isPrintPage && onPrintZone && depth <= 1 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onPrintZone(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                                            headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                        }`}
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
                            <div className="p-1.5 flex flex-col bg-emerald-50/5 dark:bg-gray-900/10 border-t border-gray-100 dark:border-gray-800 print:block print:flex-none print:h-auto print:overflow-visible">
                                {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                {hasChildren && !mergedZones.has(zone.id) && (
                                    <div className="space-y-1.5">
                                        {zone.children.map((child, idx) => (
                                            <React.Fragment key={child.id}>
                                                {isPrintPage && onTogglePageBreak && idx > 0 && (
                                                    <>
                                                        <div className="hide-on-real-print w-full flex items-center justify-center">
                                                            <button
                                                                onClick={() => onTogglePageBreak(child.id)}
                                                                className={`w-full flex items-center justify-center gap-1.5 text-[10px] transition-all cursor-pointer rounded ${pageBreakIds.has(child.id) ? 'py-1 bg-blue-100 border-y-2 border-dashed border-blue-500 opacity-100' : 'h-2 py-0 opacity-0 hover:opacity-100 hover:bg-blue-100 hover:h-6'}`}
                                                            >
                                                                <Scissors size={10} className={pageBreakIds.has(child.id) ? 'text-blue-600' : 'text-stone-400'} />
                                                                <span className={pageBreakIds.has(child.id) ? 'text-blue-600 font-bold' : 'text-stone-400'}>{pageBreakIds.has(child.id) ? '✂ Ngắt trang' : 'Ngắt trang'}</span>
                                                            </button>
                                                        </div>
                                                        {pageBreakIds.has(child.id) && <div className="hidden print:block print-break-before-page" />}
                                                    </>
                                                )}
                                                {renderZone(child as any, depth + 1, currentBreadcrumb)}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
        }
    }

    return (
        <div className="space-y-2 print:space-y-0">
            {zoneTree.map(root => renderZone(root as any))}
        </div>
    )
}



