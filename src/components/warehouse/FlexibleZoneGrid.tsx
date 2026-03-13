'use client'
import React, { useMemo } from 'react'
import { Loader2, Printer, Download, Search, Check, ChevronDown, ChevronRight, MapPin, X, Settings, Layout, Monitor, Layers, Maximize2, MoreHorizontal, Eye, Package, Scissors } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { InView } from 'react-intersection-observer'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

import PositionCell from './PositionCell'
import MergedBigCell from './MergedBigCell'

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

    function renderPositionCell(pos: any, cellHeight: number, cellWidth: number, isSanh?: boolean) {
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
                    isGrouped={isGrouped}
                    isSanh={isSanh}
                />
            )
        }

        return (
            <PositionCell
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
                isGrouped={isGrouped}
                isSanh={isSanh}
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
        const isBigBin = isGrouped && (zone.id.startsWith('v-bin-') || nameUpper.startsWith('Ô ') || isSanh)
        const isBinMerged = mergedZones.has(zone.id) || (isGrouped && isSanh && isPrintPage)
        
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
            const isManualMerge = mergedZones.has(zone.id)
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
                <div className="flex flex-col flex-1 h-full min-h-0 gap-1.5 print:gap-1">
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
                        levelGroups={isBinMerged && isBigBin ? levelGroups : undefined}
                        isPrintPage={isPrintPage}
                        isGrouped={isGrouped}
                        isSanh={isSanh}
                        isManualMerge={isManualMerge}
                    />
                </div>
            )
        }

        return (
            <div
                className={`flex flex-col flex-1 ${mergedZones?.has(zone.id) ? 'h-full min-h-0' : 'h-auto'} gap-1.5 print:gap-1.5`}
                style={{
                    display: 'grid',
                    gridTemplateColumns: cellWidth > 0
                        ? `repeat(${positionColumns}, ${cellWidth}px)`
                        : `repeat(${positionColumns}, minmax(0, 1fr))`
                }}
            >
                {zone.positions.map((pos: any) => renderPositionCell(pos, cellHeight, cellWidth, isSanh))}
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
        const isBinMerged = mergedZones.has(zone.id) || (isGrouped && isSanh && isPrintPage)
        const isLevelUnderBin = isGrouped && (zone.id.startsWith('v-lvl-') || zone.name.toUpperCase().startsWith('TẦNG '))
        const shouldRenderGrid = hasPositions || isBinMerged

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
                            {zone.positions.map(pos => renderPositionCell(pos, cellHeight, cellWidth, isSanh))}
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
                        className={`flex flex-col ${mergedZones.has(zone.id) ? 'h-full flex-1 min-h-0' : 'h-auto'} rounded-xl border border-gray-200 dark:border-gray-700 print:border-none overflow-hidden print:overflow-visible bg-white dark:bg-gray-800 print:break-inside-avoid ${pageBreakIds.has(zone.id) ? 'print-break-before-page pt-4 print:pt-0' : ''}`}
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

                        <div className={`p-2 flex-1 flex flex-col ${mergedZones.has(zone.id) ? 'h-full flex-1' : 'h-auto'} print:flex print:flex-col print:h-auto`}>
                            {!isCollapsed && (
                                <div className={`p-3 flex-1 flex flex-col bg-white/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 print:border-t-none print:flex print:flex-col ${mergedZones.has(zone.id) ? 'h-full flex-1' : 'h-auto'} print:h-auto`}>
                                    {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                    {hasChildren && !mergedZones.has(zone.id) && (
                                        <div className="mt-2 print:mt-0 space-y-1.5 px-1 pb-1 print:block">
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
                                                            {pageBreakIds.has(child.id) && <div className="hidden print:block print-break-before-page print:w-full" style={{ height: 0, padding: 0, margin: 0, border: 0 }} />}
                                                        </>
                                                    )}
                                                    <div className="print:block">
                                                        {renderZone(child as any, depth + 1, currentBreadcrumb)}
                                                    </div>
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
                        className={`flex flex-col print:block rounded-xl border border-gray-200 dark:border-gray-700 print:border-none overflow-hidden print:overflow-visible bg-white dark:bg-gray-800  print:break-inside-auto ${pageBreakIds.has(zone.id) ? 'print-break-before-page pt-4 print:pt-0' : ''}`}
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
                            <div className={`p-2 ${mergedZones.has(zone.id) ? 'flex-1 flex flex-col h-full min-h-0' : 'flex flex-col h-auto'} bg-emerald-50/10 dark:bg-gray-900/10 border-t border-gray-100 dark:border-gray-800 print:border-t-none print:flex print:flex-col print:overflow-visible print:h-auto`}>
                                {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                {hasChildren && !isBinMerged && (
                                    <div className="w-full">
                                        {(() => {
                                            const printGridWidthClass = 
                                                effectiveChildCols === 1 ? 'print:w-full print:mb-2 print:flex-none' :
                                                effectiveChildCols === 2 ? 'print:w-[48%] print:mb-2 print:flex-none' :
                                                effectiveChildCols === 3 ? 'print:w-[32%] print:mb-2 print:flex-none' :
                                                effectiveChildCols === 4 ? 'print:w-[23%] print:mb-2 print:flex-none' :
                                                effectiveChildCols === 5 ? 'print:w-[18%] print:mb-2 print:flex-none' :
                                                'print:w-[15%] print:mb-2 print:flex-none';
                                            
                                            return (
                                                <div
                                                    className={
                                                        childLayout === 'horizontal'
                                                            ? 'flex gap-1.5 overflow-x-auto pb-2 print:flex print:flex-wrap print:gap-1.5'
                                                            : childLayout === 'grid'
                                                                ? `grid items-stretch gap-1.5 ${mergedZones.has(zone.id) ? 'flex-1 h-full' : 'h-auto'} print:flex print:flex-wrap print:gap-[2%]`
                                                                : `space-y-1.5 print:space-y-1 ${mergedZones.has(zone.id) ? 'flex-1 h-full' : 'h-auto'} print:block`
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
                                                                    className="hidden print:block print-break-before-page print:w-full" 
                                                                    style={{ height: 0, padding: 0, margin: 0, border: 0 }}
                                                                />
                                                            )}
                                                        </>
                                                    )}
                                                    <div
                                                        className={childLayout === 'horizontal' ? 'shrink-0 grow flex flex-col print:flex print:w-full print:mb-2 print:flex-none' : (childLayout === 'grid' ? (mergedZones.has(child.id) || isPrintPage ? `h-full flex flex-col flex-1 min-h-0 print:h-auto ${printGridWidthClass}` : 'h-auto flex flex-col') : (mergedZones.has(child.id) ? 'h-full flex flex-col flex-1 min-h-0 print:block print:flex-none' : 'h-auto flex flex-col print:block print:flex-none'))}
                                                        style={childLayout === 'horizontal' && childWidth > 0 ? { width: `${childWidth}px` } : undefined}
                                                    >
                                                        {renderZone(child as any, depth + 1, currentBreadcrumb, rowStyle)}
                                                    </div>
                                                </React.Fragment>
                                            )
                                        })}
                                                </div>
                                            )
                                        })()}
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
                        className={`group flex flex-col ${mergedZones.has(zone.id) ? 'h-full flex-1 min-h-0' : 'h-auto'} rounded-xl border border-gray-200 dark:border-gray-700 print:border-none overflow-hidden print:overflow-visible ${depth === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/50'}`}
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
                            <div className={`p-1.5 ${isBinMerged ? 'flex-1 flex flex-col h-full print:h-auto' : 'flex flex-col h-auto'} bg-emerald-50/5 dark:bg-gray-900/10 border-t border-gray-100 dark:border-gray-800 print:border-t-none print:flex print:flex-col print:overflow-visible`}>
                                {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                {hasChildren && !isBinMerged && (
                                    <div className="space-y-1.5 print:space-y-1 print:block">
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
                                                        {pageBreakIds.has(child.id) && <div className="hidden print:block print-break-before-page print:w-full" style={{ height: 0, padding: 0, margin: 0, border: 0 }} />}
                                                    </>
                                                )}
                                                <div className="print:block">
                                                    {renderZone(child as any, depth + 1, currentBreadcrumb)}
                                                </div>
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
        <div className="space-y-2 print:space-y-2">
            {zoneTree.map(root => renderZone(root as any))}
        </div>
    )
}



