'use client'
import React, { useMemo } from 'react'
import { Loader2, Printer, Download, Search, Check, ChevronDown, ChevronRight, MapPin, X, Settings, Layout, Monitor, Layers, Maximize2, MoreHorizontal, Eye, Package, Scissors, Copy } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { InView } from 'react-intersection-observer'
import { sortPositionsByBinPriority } from '@/lib/warehouseUtils'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

import PositionCell from './PositionCell'
import MergedBigCell from './MergedBigCell'
import { EditableText } from '@/components/print/PrintHelpers'

interface PositionWithZone extends Position {
    zone_id?: string | null
}

type ZoneTreeNode = Zone & { 
    children: ZoneTreeNode[], 
    positions: PositionWithZone[], 
    totalPositions: number, 
    descendantIds: string[] 
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
    lotInfo?: Record<string, { id: string, code: string, items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags?: string[] }>, inbound_date?: string, created_at?: string, packaging_date?: string, peeling_date?: string, tags?: string[], productions?: { code: string, name: string }, production_lot_code?: string }>
    pageBreakIds?: Set<string>
    onTogglePageBreak?: (zoneId: string) => void
    onPrintZone?: (zoneId: string) => void
    displayInternalCode?: boolean
    isGrouped?: boolean
    mergedZones?: Set<string>
    onToggleMergeZone?: (zoneId: string) => void
    isCapturing?: boolean
    isPrintPage?: boolean
    isEmptyMode?: boolean
    checkedZoneIds?: Set<string>
    onToggleCheckedZone?: (zoneId: string, isChecked: boolean) => void
    searchTerm?: string
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
    isPrintPage = false,
    isEmptyMode = false,
    checkedZoneIds = new Set(),
    onToggleCheckedZone,
    searchTerm = ''
}: FlexibleZoneGridProps) {
    const [isMobile, setIsMobile] = React.useState(false)
    const [localNotes, setLocalNotes] = React.useState<Record<string, string>>({})
    const [copiedZoneId, setCopiedZoneId] = React.useState<string | null>(null)

    const getZonePositionCodes = React.useCallback((node: ZoneTreeNode): string[] => {
        const codes: string[] = []
        if (node.positions && node.positions.length > 0) {
            node.positions.forEach(p => {
                const code = p.code || (p as any).name
                if (code && typeof code === 'string' && code.trim() !== '') {
                    codes.push(code.trim())
                }
            })
        }
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => {
                codes.push(...getZonePositionCodes(child))
            })
        }
        return codes
    }, [])

    const handleCopyPositions = React.useCallback((e: React.MouseEvent, zone: ZoneTreeNode) => {
        e.stopPropagation()
        const codes = getZonePositionCodes(zone)
        if (codes.length === 0) return

        const textToCopy = codes.join('\n')

        const onSuccess = () => {
            setCopiedZoneId(zone.id)
            setTimeout(() => {
                setCopiedZoneId(curr => (curr === zone.id ? null : curr))
            }, 2000)
        }

        if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy)
                .then(onSuccess)
                .catch(err => {
                    console.error('Clipboard writeText failed, trying fallback:', err)
                    try {
                        const textarea = document.createElement('textarea')
                        textarea.value = textToCopy
                        textarea.style.position = 'fixed'
                        textarea.style.left = '-9999px'
                        textarea.style.top = '-9999px'
                        textarea.style.opacity = '0'
                        document.body.appendChild(textarea)
                        textarea.focus()
                        textarea.select()
                        const success = document.execCommand('copy')
                        document.body.removeChild(textarea)
                        if (success) onSuccess()
                    } catch (fbErr) {
                        console.error('Fallback copy failed:', fbErr)
                    }
                })
        } else {
            try {
                const textarea = document.createElement('textarea')
                textarea.value = textToCopy
                textarea.style.position = 'fixed'
                textarea.style.left = '-9999px'
                textarea.style.top = '-9999px'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                const success = document.execCommand('copy')
                document.body.removeChild(textarea)
                if (success) onSuccess()
            } catch (fbErr) {
                console.error('Fallback copy failed:', fbErr)
            }
        }
    }, [getZonePositionCodes])

    const renderCopyButton = React.useCallback((zone: ZoneTreeNode, isLevelUnderBin: boolean, isDarkHeader: boolean) => {
        const count = zone.totalPositions
        if (count === 0) return null

        const isCopied = copiedZoneId === zone.id

        return (
            <button
                type="button"
                onClick={(e) => handleCopyPositions(e, zone)}
                className={`flex items-center justify-center transition-all cursor-pointer shadow-xs rounded-md ${
                    isLevelUnderBin
                        ? 'w-5 h-5 p-0.5'
                        : 'w-6 h-6 p-1'
                } ${
                    isCopied
                        ? 'bg-emerald-600 text-white font-bold animate-pulse ring-1 ring-emerald-400'
                        : isDarkHeader
                            ? 'bg-white/15 hover:bg-white/30 text-white border border-white/20 hover:border-white/40'
                            : 'bg-white/90 hover:bg-emerald-50 text-emerald-700 border border-emerald-300 hover:border-emerald-400 dark:bg-gray-800 dark:text-emerald-300 dark:border-emerald-700'
                }`}
                title={isCopied ? `Đã sao chép ${count} mã vị trí!` : `Sao chép ${count} mã vị trí (${zone.name || 'khu vực này'})`}
                aria-label="Copy mã vị trí"
            >
                {isCopied ? (
                    <Check size={isLevelUnderBin ? 11 : 13} className="text-white shrink-0" />
                ) : (
                    <Copy size={isLevelUnderBin ? 11 : 13} className={`${isDarkHeader ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'} shrink-0`} />
                )}
            </button>
        )
    }, [copiedZoneId, handleCopyPositions])

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const zoneTree = useMemo(() => {
        const map = new Map<string, ZoneTreeNode>()

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
            node.children.sort((a: ZoneTreeNode, b: ZoneTreeNode) => {
                const oa = (a as any).display_order ?? 0
                const ob = (b as any).display_order ?? 0
                if (oa !== ob) return oa - ob
                
                const nameA = (a.name || a.code || '').toUpperCase()
                const nameB = (b.name || b.code || '').toUpperCase()
                
                return nameA.localeCompare(nameB, undefined, { numeric: true })
            })
            node.positions = sortPositionsByBinPriority(node.positions)

            let totalPos = node.positions.length
            let descIds: string[] = []

            node.children.forEach((child: ZoneTreeNode) => {
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
            .sort((a: ZoneTreeNode, b: ZoneTreeNode) => {
                const oa = (a as any).display_order ?? 0
                const ob = (b as any).display_order ?? 0
                if (oa !== ob) return oa - ob
                return (a.code || '').localeCompare(b.code || '')
            })
    }, [zones, positions])

    function renderPositionCell(pos: PositionWithZone | any, cellHeight: number, cellWidth: number, isSanh?: boolean) {
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
            const cellLots = realIds.map((id: string) => {
                const p = positions.find(posItem => posItem.id === id)
                return p?.lot_id ? lotInfo[p.lot_id] : null
            }).filter(Boolean)

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
                    isEmptyMode={isEmptyMode}
                    searchTerm={searchTerm}
                    lots={cellLots}
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
                isEmptyMode={isEmptyMode}
                searchTerm={searchTerm}
            />
        )
    }

    // Build a virtual merged position from an array of positions
    function buildMergedPosition(positions: PositionWithZone[] | any[], mergedLevels?: string[]) {
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
    function renderPositionsGrid(zone: ZoneTreeNode, cellHeight: number, cellWidth: number, positionColumns: number, breadcrumb?: string[]) {
        const nameUpper = zone.name.toUpperCase()
        const isSanh = nameUpper.startsWith('SẢNH') || nameUpper.startsWith('SÀNH') || nameUpper.startsWith('SANH')
        const isBigBin = isGrouped && (zone.id.startsWith('v-bin-') || nameUpper.startsWith('Ô ') || isSanh)
        const isBinMerged = mergedZones.has(zone.id) || (isGrouped && isSanh && isPrintPage)
        
        let targetPositions = zone.positions || []
        if (isBinMerged && isBigBin) {
            // Collect all positions from all descendant levels
            const allPositions: any[] = [...zone.positions]
            const collectFromChildren = (node: ZoneTreeNode) => {
                node.children.forEach((child: ZoneTreeNode) => {
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
                const collectFromChildren = (node: ZoneTreeNode) => {
                    node.children.forEach((child: ZoneTreeNode) => {
                        levelNames.push(child.name)
                        
                        // Collect items for this level
                        const levelItemMap = new Map<string, any>()
                        child.positions.forEach((p: PositionWithZone) => {
                            const lot = p.lot_id ? lotInfo[p.lot_id] : null
                            if (lot?.items) {
                                lot.items.forEach((item: any) => {
                                    const key = `${item.sku || ''}_${item.unit || ''}`
                                    const existing = levelItemMap.get(key)
                                    if (existing) {
                                        existing.quantity += (item.quantity || 0)
                                        if (lot.code && !existing.lotCodes.includes(lot.code)) {
                                            existing.lotCodes.push(lot.code)
                                        }
                                    } else {
                                        levelItemMap.set(key, { ...item, quantity: item.quantity || 0, lotCodes: lot.code ? [lot.code] : [] })
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
            const itemMap = new Map<string, { product_name: string, sku: string, unit: string, quantity: number, internal_name?: string, internal_code?: string, production_name?: string, production_code?: string, production_lot_code?: string, lotCodes: string[] }>()
            targetPositions.forEach((p: PositionWithZone) => {
                const lot = lotInfo[p.lot_id!]
                if (p.lot_id && lot?.items) {
                    const prodName = lot.productions?.name
                    const prodCode = lot.productions?.code
                    const prodLotCode = lot.production_lot_code
                    lot.items.forEach((item: any) => {
                        const key = `${item.sku || ''}_${item.unit || ''}_${prodName || ''}_${prodLotCode || ''}`
                        const existing = itemMap.get(key)
                        if (existing) {
                            existing.quantity += (item.quantity || 0)
                            if (lot.code && !existing.lotCodes.includes(lot.code)) {
                                existing.lotCodes.push(lot.code)
                            }
                        } else {
                            itemMap.set(key, { ...item, quantity: item.quantity || 0, production_name: prodName, production_code: prodCode, production_lot_code: prodLotCode, lotCodes: lot.code ? [lot.code] : [] })
                        }
                    })
                }
            })
            const aggregatedItems = Array.from(itemMap.values())
            const cellLots = targetPositions.map((p: any) => p.lot_id ? lotInfo[p.lot_id] : null).filter(Boolean)

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
                        isEmptyMode={isEmptyMode}
                        searchTerm={searchTerm}
                        lots={cellLots}
                    />
                </div>
            )
        }

        return (
            <div
                className={`w-full flex-1 ${mergedZones?.has(zone.id) ? 'h-full min-h-0' : 'h-auto'} ${isEmptyMode ? 'grid gap-1' : 'flex flex-col gap-2'} print:gap-1.5 overflow-visible`}
                style={{
                    display: 'grid',
                    gridTemplateColumns: isEmptyMode 
                        ? (cellWidth > 0 ? `repeat(auto-fill, ${cellWidth}px)` : `repeat(3, minmax(0, 1fr))`)
                        : (!isEmptyMode && cellWidth > 0
                            ? `repeat(${positionColumns}, ${cellWidth}px)`
                            : `repeat(${positionColumns}, minmax(0, 1fr))`),
                    width: isEmptyMode ? '100%' : '100%',
                    minWidth: isEmptyMode ? '70px' : '0',
                    gap: isEmptyMode ? '2px' : '6px'
                }}
            >
                {zone.positions.map((pos: PositionWithZone) => renderPositionCell(pos, cellHeight, cellWidth, isSanh))}
            </div>
        )
    }

    function renderZone(
        zone: ZoneTreeNode,
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

        if (isEmptyMode) {
            positionColumns = 10 // Giảm số cột để dễ chia hàng
        }

        let cellWidth = layout?.cell_width ?? 0
        let cellHeight = layout?.cell_height ?? 0

        if (isLevelUnderBin) {
            positionColumns = 3
            cellWidth = 0
            cellHeight = 0
            if (isEmptyMode) {
                // Header tầng cực nhỏ khi in sơ đồ trống
            }
        }
        const childLayout = layout?.child_layout ?? 'vertical'
        const childColumns = layout?.child_columns ?? 0
        const childWidth = layout?.child_width ?? 0
        const collapsible = layout?.collapsible ?? true
        let displayType = layout?.display_type ?? 'auto'
        const alternatingRows = layout?.alternating_rows ?? false
        const headerColor = layout?.header_color ?? null
        const headerTextColor = layout?.header_text_color ?? null

        // Tự động chuyển đổi các màu đỏ/cam cũ hoặc áp dụng phong cách Xanh sầu riêng Emerald Green
        const isRedOrOrange = headerColor && ['#ef4444', '#dc2626', '#b91c1c', '#f87171', '#f97316', '#ea580c', '#c2410c', '#e11d48'].includes(headerColor.toLowerCase());
        
        let headerBgStyle: React.CSSProperties | undefined = undefined;
        let effectiveHeaderTextColor = headerTextColor;
        let isDarkHeader = false;
        let statHighlightColor = 'text-emerald-700 dark:text-emerald-400 font-bold';
        let accentColor = '#10b981';

        if (depth === 0) {
            // Kho cấp cao nhất (KHO 1, KHO 2, KHO 3, KHO 4, KHO TẠM...): Nền Emerald Green đậm chất sầu riêng
            headerBgStyle = {
                background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
                borderColor: '#065f46'
            };
            effectiveHeaderTextColor = '#ffffff';
            isDarkHeader = true;
            statHighlightColor = 'text-amber-300 font-black drop-shadow-sm';
            accentColor = '#34d399';
        } else if (isRedOrOrange) {
            // Zone con trước đây lưu màu đỏ/cam: Chuyển sang xanh ngọc dịu
            headerBgStyle = {
                background: 'linear-gradient(to right, rgb(236 253 245), rgb(240 253 244))',
                borderColor: '#a7f3d0'
            };
            effectiveHeaderTextColor = '#065f46';
            isDarkHeader = false;
            statHighlightColor = 'text-emerald-700 font-bold';
            accentColor = '#10b981';
        } else if (headerColor) {
            headerBgStyle = { backgroundColor: headerColor, borderColor: headerColor };
            effectiveHeaderTextColor = headerTextColor || '#ffffff';
            isDarkHeader = true;
            statHighlightColor = 'text-amber-300 font-bold';
            accentColor = '#ffffff';
        } else {
            headerBgStyle = { background: 'linear-gradient(to right, rgb(236 253 245), white)' };
            effectiveHeaderTextColor = headerTextColor || undefined;
            statHighlightColor = 'text-emerald-700 dark:text-emerald-400 font-semibold';
            accentColor = '#10b981';
        }

        let effectiveChildCols = childColumns > 0 ? childColumns : 3
        if (isEmptyMode && depth <= 1) {
            effectiveChildCols = 4
        }

        if (depth === 0 && displayType === 'hidden') {
            displayType = 'auto'
        }

        const currentBreadcrumb = [...breadcrumb, zone.name]

        // --- Select All Logic ---
        // Exclude virtual/empty positions from being selectable if not in assignment mode
        const selectablePositions = isAssignmentMode
            ? zone.positions
            : zone.positions.filter((p: PositionWithZone) => occupiedIds.has(p.id))

        // Find all selectable IDs in this zone + descendants
        const allSelectableDescendantIds: string[] = []

        // Quick extraction to get all positions in descendant zones
        const exploreSelectableIds = (z: ZoneTreeNode) => {
            const zSelectable = isAssignmentMode
                ? z.positions.map((p: PositionWithZone) => p.id)
                : z.positions.filter((p: PositionWithZone) => occupiedIds.has(p.id)).map((p: PositionWithZone) => p.id)
            allSelectableDescendantIds.push(...zSelectable)
            z.children.forEach((child: ZoneTreeNode) => exploreSelectableIds(child))
        }
        exploreSelectableIds(zone as ZoneTreeNode)

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
                                    {zone.positions.map((pos: PositionWithZone) => renderPositionCell(pos, cellHeight, cellWidth, isSanh))}
                                </div>
                            )}
                            {zone.children.map((child: ZoneTreeNode) => renderZone(child, depth + 1, currentBreadcrumb))}
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
                            {zone.positions.map((pos: PositionWithZone) => renderPositionCell(pos, cellHeight, cellWidth, isSanh))}
                        </div>
                    )}
                    {zone.children.map((child: ZoneTreeNode) => renderZone(child, depth, currentBreadcrumb))}
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
                        className={`flex flex-col ${mergedZones.has(zone.id) ? 'h-full flex-1 min-h-0' : 'h-auto'} rounded-xl border border-gray-200 dark:border-gray-700 print:rounded-none print:border-stone-300 overflow-hidden print:overflow-visible bg-white dark:bg-gray-800 print:break-inside-avoid ${pageBreakIds.has(zone.id) ? 'print-break-before-page pt-4 print:pt-0' : ''}`}
                    >
                        {pageBreakIds.has(zone.id) && (
                            <div className="hidden print:block text-center border-b border-dashed border-gray-300 mb-4 pb-2 text-[10px] text-gray-400 italic">
                                -- Tiếp theo từ trang trước --
                            </div>
                        )}
                        <div
                            className={`flex items-center justify-between px-4 border-b print:py-1 ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-3'} ${collapsible ? 'cursor-pointer hover:opacity-95' : ''}`}
                            style={headerBgStyle}
                            onClick={() => collapsible && onToggleCollapse(zone.id)}
                        >
                            <div className="flex items-center gap-3">
                                {isEmptyMode && onToggleCheckedZone && (
                                    <div className="flex items-center justify-center shrink-0 mr-1 print:hidden" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer shadow-sm transition-all"
                                            checked={checkedZoneIds.has(zone.id)}
                                            onChange={(e) => onToggleCheckedZone(zone.id, e.target.checked)}
                                            title="Chọn vùng này để in"
                                        />
                                    </div>
                                )}
                                {collapsible && (
                                    isCollapsed
                                        ? <ChevronRight size={isLevelUnderBin ? 12 : 16} style={{ color: effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined) }} className={`print:hidden ${effectiveHeaderTextColor || isDarkHeader ? '' : 'text-emerald-500'}`} />
                                        : <ChevronDown size={isLevelUnderBin ? 12 : 16} style={{ color: effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined) }} className={`print:hidden ${effectiveHeaderTextColor || isDarkHeader ? '' : 'text-emerald-500'}`} />
                                )}
                                {!isAssignmentMode && !isEmptyMode && totalSelectableCount > 0 && onBulkSelect && (
                                    <div className="flex items-center justify-center shrink-0 print:hidden" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            checked={isAllSelected}
                                            ref={el => {
                                                if (el) el.indeterminate = isIndeterminate
                                            }}
                                            onChange={handleZoneCheckboxChange}
                                            title={`Chọn tất cả ${totalSelectableCount} vị trí có hàng`}
                                        />
                                    </div>
                                )}
                                <div
                                    className={`rounded-full shrink-0 print:hidden ${isLevelUnderBin ? 'w-0.5 h-3' : isBigBin ? 'w-1 h-5' : 'w-1 h-8'}`}
                                    style={{ backgroundColor: accentColor }}
                                />
                                <div>
                                    <div className="flex items-center gap-2 print-break-after-avoid">
                                        <h2
                                            className={`font-bold tracking-tight whitespace-nowrap shrink-0 ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-sm' : 'text-lg'} ${isEmptyMode ? 'print:text-[10px] print:font-medium print:text-gray-500' : ''}`}
                                            style={{ color: (isEmptyMode && isPrintPage) ? 'inherit' : (effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined)) }}
                                        >
                                            {isLevelUnderBin || isPrintPage
                                                ? (isGrouped ? (zone.name.includes('|') ? zone.name.split('|')[0].trim() : currentBreadcrumb.join(' - ')) : currentBreadcrumb.join(' - '))
                                                : (isMobile || isGrouped ? zone.name : currentBreadcrumb.join(' - '))
                                            }
                                        </h2>
                                        {isPrintPage && (
                                            <div className="ml-2 flex items-center shrink-0">
                                                <EditableText
                                                    value={localNotes[zone.id] || ''}
                                                    onChange={(val: string) => setLocalNotes(prev => ({ ...prev, [zone.id]: val }))}
                                                    placeholder=""
                                                    className="text-red-600! font-bold italic text-sm print:text-red-600 border-b-stone-300!"
                                                    isSnapshot={isCapturing}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {!isLevelUnderBin && totalPositions > 0 && (
                                        <p
                                            className="text-xs whitespace-nowrap shrink-0 print:hidden"
                                            style={{ color: effectiveHeaderTextColor ? `${effectiveHeaderTextColor}cc` : (isDarkHeader ? 'rgba(255,255,255,0.85)' : undefined) }}
                                        >
                                            {totalPositions} ô / <span className={statHighlightColor}>{totalSelectableCount} có hàng</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 print:hidden ${isCapturing ? "hidden" : ""}`}>
                                {renderCopyButton(zone, isLevelUnderBin, isDarkHeader)}
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
                                                    descendantIds.forEach((id: string) => next.add(id))
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
                                                    descendantIds.forEach((id: string) => next.delete(id))
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

                        <div className={`p-1 flex-1 flex flex-col ${mergedZones.has(zone.id) ? 'h-full flex-1' : 'h-auto'} print:flex print:flex-col print:h-auto`}>
                            {!isCollapsed && (
                                <div className={`p-1.5 flex-1 flex flex-col bg-white/50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 print:border-t-none print:flex print:flex-col ${mergedZones.has(zone.id) ? 'h-full flex-1' : 'h-auto'} print:h-auto`}>
                                    {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                    {hasChildren && !mergedZones.has(zone.id) && (
                                        <div className="mt-2 print:mt-0 space-y-1.5 px-1 pb-1 print:block">
                                            {zone.children.map((child: ZoneTreeNode, idx: number) => (
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
                            className={`flex items-center justify-between px-4 border-b cursor-pointer print-break-after-avoid print:py-1 ${isLevelUnderBin ? 'py-1' : isBigBin ? 'py-1.5' : 'py-3'} ${collapsible ? 'hover:opacity-95' : ''}`}
                            style={headerBgStyle}
                            onClick={() => collapsible && onToggleCollapse(zone.id)}
                        >
                            <div className="flex items-center gap-3">
                                {isEmptyMode && onToggleCheckedZone && (
                                    <div className="flex items-center justify-center shrink-0 mr-1 print:hidden" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer shadow-sm transition-all"
                                            checked={checkedZoneIds.has(zone.id)}
                                            onChange={(e) => onToggleCheckedZone(zone.id, e.target.checked)}
                                            title="Chọn vùng này để in"
                                        />
                                    </div>
                                )}
                                {collapsible && (
                                    isCollapsed
                                        ? <ChevronRight size={isLevelUnderBin ? 12 : 16} style={{ color: effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined) }} className={`print:hidden ${effectiveHeaderTextColor || isDarkHeader ? '' : 'text-emerald-500'}`} />
                                        : <ChevronDown size={isLevelUnderBin ? 12 : 16} style={{ color: effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined) }} className={`print:hidden ${effectiveHeaderTextColor || isDarkHeader ? '' : 'text-emerald-500'}`} />
                                )}
                                <div
                                    className={`rounded-full shrink-0 print:hidden ${isLevelUnderBin ? 'w-0.5 h-3' : isBigBin ? 'w-1 h-5' : 'w-1 h-8'}`}
                                    style={{ backgroundColor: accentColor }}
                                />
                                <div>
                                    <div className="flex items-center gap-2">
                                        {!isAssignmentMode && !isEmptyMode && totalSelectableCount > 0 && onBulkSelect && (
                                            <div className="flex items-center justify-center shrink-0 print:hidden" onClick={e => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
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
                                            className={`font-bold tracking-tight whitespace-nowrap shrink-0 ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-sm' : 'text-lg'} ${isEmptyMode ? 'print:text-[10px] print:font-medium print:text-gray-500' : ''}`}
                                            style={{ color: (isEmptyMode && isPrintPage) ? 'inherit' : (effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined)) }}
                                        >
                                            {isLevelUnderBin || isPrintPage
                                                ? currentBreadcrumb.join(' - ')
                                                : (isMobile || isGrouped ? currentBreadcrumb.slice(-1) : currentBreadcrumb.join(' - '))
                                            }
                                        </h2>
                                        {isPrintPage && (
                                            <div className="ml-2 flex items-center shrink-0">
                                                <EditableText
                                                    value={localNotes[zone.id] || ''}
                                                    onChange={(val: string) => setLocalNotes(prev => ({ ...prev, [zone.id]: val }))}
                                                    placeholder=""
                                                    className="text-red-600! font-bold italic text-sm print:text-red-600 border-b-stone-300!"
                                                    isSnapshot={isCapturing}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    {!isLevelUnderBin && totalPositions > 0 && (
                                        <p
                                            className="text-xs whitespace-nowrap shrink-0 print:hidden"
                                            style={{ color: effectiveHeaderTextColor ? `${effectiveHeaderTextColor}cc` : (isDarkHeader ? 'rgba(255,255,255,0.85)' : undefined) }}
                                        >
                                            {totalPositions} ô / <span className={statHighlightColor}>{totalSelectableCount} có hàng</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className={`flex items-center gap-2 print:hidden ${isCapturing ? "hidden" : ""}`}>
                                {renderCopyButton(zone, isLevelUnderBin, isDarkHeader)}
                                {/* Hide manual merge button in print view */}
                                {false && isPrintPage && isGrouped && (isLevelUnderBin || isBigBin) && (zone.positions.length > 1 || zone.totalPositions > 1) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onToggleMergeZone?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                            mergedZones.has(zone.id)
                                                ? (headerColor ? 'bg-white text-black' : 'bg-emerald-600 text-white shadow-sm')
                                                : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-white/80 text-emerald-700 border border-emerald-200 hover:bg-emerald-50')
                                        }`}
                                        title={mergedZones.has(zone.id) ? "Tắt gộp ô lớn" : "Gộp thành ô lớn (hàng cồng kềnh)"}
                                    >
                                        <Maximize2 size={11} />
                                        {mergedZones.has(zone.id) ? 'Đang gộp' : 'Gộp ô'}
                                    </button>
                                )}
                                {depth === 0 && onUpdateCollapsedZones && (
                                    <div className="flex items-center gap-1 mr-2 bg-emerald-950/40 border border-emerald-400/25 rounded-lg overflow-hidden shadow-inner">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                const descendantIds = zone.descendantIds
                                                onUpdateCollapsedZones(prev => {
                                                    const next = new Set(prev)
                                                    next.delete(zone.id)
                                                    descendantIds.forEach((id: string) => next.add(id))
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-white/10 text-white transition-colors"
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
                                                    descendantIds.forEach((id: string) => next.delete(id))
                                                    return next
                                                })
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-white/10 text-white transition-colors"
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
                                            className="px-2 py-1 text-[10px] font-bold sm:text-xs bg-transparent hover:bg-white/10 text-white transition-colors"
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
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm ${
                                            isDarkHeader
                                                ? 'bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-100'
                                                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                        }`}
                                        title="In sơ đồ zone này"
                                    >
                                        <Printer size={12} className="text-emerald-700" />
                                        In sơ đồ
                                    </button>
                                )}
                                {isDesignMode && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onConfigureZone?.(zone)
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                                    >
                                        <Settings size={12} />
                                        Cấu hình
                                    </button>
                                )}
                            </div>
                        </div>

                        {!isCollapsed && (
                            <div className={`${isEmptyMode ? 'p-0' : 'p-2'} ${mergedZones.has(zone.id) ? 'flex-1 flex flex-col h-full min-h-0' : 'flex flex-col h-auto'} bg-emerald-50/10 dark:bg-gray-900/10 ${isEmptyMode ? '' : 'border-t border-gray-100 dark:border-gray-800'} print:border-t-none print:flex print:flex-col print:overflow-visible print:h-auto`}>
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
                                                            ? `flex ${isEmptyMode ? 'gap-1' : 'gap-1.5'} overflow-x-auto pb-2 print:flex print:flex-wrap print:gap-1.5`
                                                            : childLayout === 'grid'
                                                                ? `grid items-stretch ${isEmptyMode ? 'gap-1' : 'gap-1.5'} ${mergedZones.has(zone.id) ? 'flex-1 h-full' : 'h-auto'} print:flex print:flex-wrap print:gap-[2%]`
                                                                : `${isEmptyMode ? 'space-y-0.5' : 'space-y-1.5'} print:space-y-1 ${mergedZones.has(zone.id) ? 'flex-1 h-full' : 'h-auto'} print:block`
                                                    }
                                                    style={
                                                        childLayout === 'grid' && (childColumns > 0 || (isEmptyMode && depth <= 1))
                                                            ? { gridTemplateColumns: `repeat(${isEmptyMode && depth <= 1 ? 4 : (childColumns > 0 ? childColumns : effectiveChildCols)}, minmax(0, 1fr))` }
                                                            : childLayout === 'grid'
                                                                ? { gridTemplateColumns: `repeat(auto-fill, minmax(${isEmptyMode ? '150px' : '300px'}, 1fr))` }
                                                                : undefined
                                                    }
                                                >
                                                    {zone.children.map((child: ZoneTreeNode, idx: number) => {
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
                            className={`flex items-center justify-between px-4 border-b cursor-pointer transition-colors print:py-1 ${isLevelUnderBin ? 'py-1' : isBigBin ? (isEmptyMode ? 'py-0.5 px-2' : 'py-1.5') : 'py-2'} ${collapsible ? 'hover:opacity-95' : ''}`}
                            style={headerBgStyle}
                            onClick={() => collapsible && onToggleCollapse(zone.id)}
                        >
                            <div className="flex items-center gap-2">
                                {isEmptyMode && onToggleCheckedZone && (
                                    <div className="flex items-center justify-center shrink-0 mr-1 print:hidden" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer shadow-sm transition-all"
                                            checked={checkedZoneIds.has(zone.id)}
                                            onChange={(e) => onToggleCheckedZone(zone.id, e.target.checked)}
                                            title="Chọn vùng này để in"
                                        />
                                    </div>
                                )}
                                {collapsible && (hasChildren || hasPositions) && (
                                    isCollapsed
                                        ? <ChevronRight size={isLevelUnderBin ? 12 : 16} style={{ color: effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined) }} className={`print:hidden ${effectiveHeaderTextColor || isDarkHeader ? '' : 'text-emerald-500'}`} />
                                        : <ChevronDown size={isLevelUnderBin ? 12 : 16} style={{ color: effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined) }} className={`print:hidden ${effectiveHeaderTextColor || isDarkHeader ? '' : 'text-emerald-500'}`} />
                                )}
                                {!isAssignmentMode && !isEmptyMode && totalSelectableCount > 0 && onBulkSelect && (
                                    <div className="flex items-center justify-center shrink-0 mr-1 print:hidden" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            checked={isAllSelected}
                                            ref={el => {
                                                if (el) el.indeterminate = isIndeterminate
                                            }}
                                            onChange={handleZoneCheckboxChange}
                                            title={`Chọn tất cả ${totalSelectableCount} vị trí có hàng`}
                                        />
                                    </div>
                                )}
                                <div
                                    className={`rounded-full shrink-0 print:hidden ${isLevelUnderBin ? 'w-0.5 h-3' : isBigBin ? 'w-1 h-5' : 'w-1 h-8'}`}
                                    style={{ backgroundColor: accentColor }}
                                />
                                <span
                                    className={`font-bold tracking-tight whitespace-nowrap shrink-0 ${isBigBin ? 'text-base' : isLevelUnderBin ? 'text-[11px] uppercase opacity-80' : isMobile ? 'text-base' : depth === 0 ? 'text-base' : 'text-sm'} ${isEmptyMode ? 'print:text-[10px] print:font-medium print:text-gray-500' : ''}`}
                                    style={{ color: (isEmptyMode && isPrintPage) ? 'inherit' : (effectiveHeaderTextColor || (isDarkHeader ? 'white' : undefined)) }}
                                >
                                    {isLevelUnderBin || isPrintPage
                                        ? (isGrouped ? (zone.name.includes('|') ? zone.name.split('|')[0].trim() : currentBreadcrumb.join(' - ')) : currentBreadcrumb.join(' - '))
                                        : (isMobile || isGrouped ? zone.name : currentBreadcrumb.join(' - '))
                                    }
                                </span>
                                {isPrintPage && (
                                    <div className="ml-2 flex items-center shrink-0">
                                        <EditableText
                                            value={localNotes[zone.id] || ''}
                                            onChange={(val: string) => setLocalNotes(prev => ({ ...prev, [zone.id]: val }))}
                                            placeholder=""
                                            className="text-red-600! font-bold italic text-sm print:text-red-600 border-b-stone-300!"
                                            isSnapshot={isCapturing}
                                        />
                                    </div>
                                )}
                                {!isLevelUnderBin && totalPositions > 0 && (
                                    <span
                                        className={`px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 print:hidden ${isLevelUnderBin ? 'text-[10px]' : 'text-xs'}`}
                                        style={{
                                            backgroundColor: isDarkHeader ? 'rgba(255,255,255,0.2)' : '#d1fae5',
                                            color: isDarkHeader ? '#ffffff' : '#047857'
                                        }}
                                    >
                                        {totalPositions} vị trí
                                    </span>
                                )}
                            </div>

                            <div className={`flex items-center gap-2 print:hidden ${isCapturing ? 'hidden' : ''}`}>
                                {renderCopyButton(zone, isLevelUnderBin, isDarkHeader)}
                                {/* Hide manual merge button in print view */}
                                {false && isPrintPage && isGrouped && (isLevelUnderBin || isBigBin) && (zone.positions.length > 1 || zone.totalPositions > 1) && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onToggleMergeZone?.(zone.id)
                                        }}
                                        className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                                            (mergedZones.has(zone.id) || (isGrouped && isSanh))
                                                ? (headerColor ? 'bg-white text-black' : 'bg-emerald-600 text-white shadow-sm')
                                                : (headerColor ? 'bg-black/20 text-white border border-white/30' : 'bg-white/80 text-emerald-700 border border-emerald-200 hover:bg-emerald-50')
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
                                                    descendantIds.forEach((id: string) => next.add(id))
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
                                                    descendantIds.forEach((id: string) => next.delete(id))
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
                            <div className={`${isEmptyMode ? 'p-0' : 'p-1.5'} ${isBinMerged ? 'flex-1 flex flex-col h-full print:h-auto' : 'flex flex-col h-auto'} bg-emerald-50/5 dark:bg-gray-900/10 ${isEmptyMode ? '' : 'border-t border-gray-100 dark:border-gray-800'} print:border-t-none print:flex print:flex-col print:overflow-visible`}>
                                {shouldRenderGrid && renderPositionsGrid(zone, cellHeight, cellWidth, positionColumns, currentBreadcrumb)}
                                {hasChildren && !isBinMerged && (
                                    <div className={`${isEmptyMode ? 'space-y-0.5' : 'space-y-1.5'} print:space-y-1 print:block`}>
                                        {zone.children.map((child: ZoneTreeNode, idx: number) => (
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
            {zoneTree.map((root: ZoneTreeNode) => renderZone(root))}
        </div>
    )
}



