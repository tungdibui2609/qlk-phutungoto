'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { X, BarChart3, Loader2, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

export interface ExportItemInfo {
    item_id: string        // export_task_item.id (for DB updates)
    lot_code: string
    product_name: string
    sku: string
    quantity: number
    unit: string
    display_status?: string
    priority?: number      // 1-4 or undefined
}

interface ExportOrderStatsModalProps {
    isOpen: boolean
    taskCode: string
    exportPositionIds: Set<string>
    exportItemStatuses: Record<string, string>
    exportItemInfoMap: Record<string, ExportItemInfo>
    onClose: () => void
    onPrioritiesChanged?: () => void  // callback to refresh parent after save
}

// Priority config
const PRIORITY_COLORS = [
    { level: 1, label: 'Đỏ', bgCell: 'bg-red-500', bgDot: 'bg-red-500', bgDotInactive: 'bg-red-200', border: 'border-red-300', bgLight: 'bg-red-50', borderLight: 'border-red-200', text: 'text-red-700', ring: 'ring-red-400' },
    { level: 2, label: 'Vàng', bgCell: 'bg-yellow-500', bgDot: 'bg-yellow-500', bgDotInactive: 'bg-yellow-200', border: 'border-yellow-300', bgLight: 'bg-yellow-50', borderLight: 'border-yellow-200', text: 'text-yellow-700', ring: 'ring-yellow-400' },
    { level: 3, label: 'Nâu', bgCell: 'bg-amber-700', bgDot: 'bg-amber-700', bgDotInactive: 'bg-amber-200', border: 'border-amber-300', bgLight: 'bg-amber-50', borderLight: 'border-amber-200', text: 'text-amber-800', ring: 'ring-amber-400' },
    { level: 4, label: 'Tím', bgCell: 'bg-purple-400', bgDot: 'bg-purple-400', bgDotInactive: 'bg-purple-200', border: 'border-purple-300', bgLight: 'bg-purple-50', borderLight: 'border-purple-200', text: 'text-purple-700', ring: 'ring-purple-400' },
]

function getPriorityConfig(level: number) {
    return PRIORITY_COLORS.find(p => p.level === level)
}

/** Sub-modal for marking priorities on positions */
function ZoneDetailSubModal({
    title,
    positions,
    exportPositionIds,
    exportItemInfoMap,
    priorities,
    onSave,
    onClose
}: {
    title: string
    positions: PositionWithZone[]
    exportPositionIds: Set<string>
    exportItemInfoMap: Record<string, ExportItemInfo>
    priorities: Record<string, number>
    onSave: (updatedPriorities: Record<string, number>) => void
    onClose: () => void
}) {
    // Only positions that are in the export order
    const exportPositions = positions.filter(p => exportPositionIds.has(p.id))
        .sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))

    // Local priority state for editing
    const [localPriorities, setLocalPriorities] = useState<Record<string, number>>(() => {
        const init: Record<string, number> = {}
        exportPositions.forEach(p => {
            if (priorities[p.id]) init[p.id] = priorities[p.id]
        })
        return init
    })

    const togglePriority = (posId: string, level: number) => {
        setLocalPriorities(prev => {
            const next = { ...prev }
            if (next[posId] === level) {
                delete next[posId]  // toggle off
            } else {
                next[posId] = level
            }
            return next
        })
    }

    const selectAllPriority = (level: number) => {
        setLocalPriorities(prev => {
            const next = { ...prev }
            exportPositions.forEach(p => {
                next[p.id] = level
            })
            return next
        })
    }

    const clearAll = () => {
        setLocalPriorities({})
    }

    const countByPriority = (level: number) => {
        return exportPositions.filter(p => localPriorities[p.id] === level).length
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8">
                {/* Header */}
                <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white">
                            {title}
                        </h2>
                        <p className="text-sm text-slate-500 mt-0.5">
                            {exportPositions.length} vị trí
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Quick Select Buttons */}
                <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Chọn nhanh tất cả
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {PRIORITY_COLORS.map(pc => (
                            <button
                                key={pc.level}
                                onClick={() => selectAllPriority(pc.level)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all active:scale-95 ${pc.bgLight} ${pc.borderLight} ${pc.text} hover:shadow-md`}
                            >
                                Tất cả {pc.label} ({countByPriority(pc.level)})
                            </button>
                        ))}
                        <button
                            onClick={clearAll}
                            className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-slate-200 text-slate-500 hover:bg-slate-100 transition-all active:scale-95"
                        >
                            Bỏ chọn hết
                        </button>
                    </div>
                </div>

                {/* Table Header */}
                <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 grid grid-cols-12 gap-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <div className="col-span-3">Vị trí</div>
                    <div className="col-span-2">Mã LOT</div>
                    <div className="col-span-3">Mã SP</div>
                    <div className="col-span-2 text-center">SL</div>
                    <div className="col-span-2 text-center">Ưu tiên</div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {exportPositions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                            <Package size={40} strokeWidth={1} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium">Không có vị trí xuất trong khu vực này</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {exportPositions.map(pos => {
                                const info = exportItemInfoMap[pos.id]
                                const currentPriority = localPriorities[pos.id]

                                return (
                                    <div
                                        key={pos.id}
                                        className="grid grid-cols-12 gap-3 items-center px-5 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                                    >
                                        {/* Position Code */}
                                        <div className="col-span-3 flex flex-col justify-center min-w-0 pr-1">
                                            {(() => {
                                                const sep = pos.code.includes('-') ? '-' : pos.code.includes('.') ? '.' : null;
                                                const hasParent = sep && pos.code.lastIndexOf(sep) > 0;
                                                const parentPath = hasParent ? pos.code.substring(0, pos.code.lastIndexOf(sep)) : '';
                                                const leaf = sep ? pos.code.split(sep).pop() : pos.code;

                                                return (
                                                    <>
                                                        {hasParent && (
                                                            <span className="font-bold text-[9px] text-slate-500 dark:text-slate-400 truncate" title={parentPath}>
                                                                {parentPath}
                                                            </span>
                                                        )}
                                                        <span className="font-black text-sm text-slate-800 dark:text-white truncate" title={pos.code}>
                                                            {leaf}
                                                        </span>
                                                    </>
                                                )
                                            })()}
                                        </div>

                                        {/* Lot Code */}
                                        <div className="col-span-2 min-w-0">
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 truncate max-w-full">
                                                {info?.lot_code || 'N/A'}
                                            </span>
                                        </div>

                                        {/* Product */}
                                        <div className="col-span-3 min-w-0">
                                            {info ? (
                                                <div>
                                                    <span className="font-bold text-xs text-slate-800 dark:text-white">{info.sku}</span>
                                                    <span className="text-xs text-slate-400 ml-1 truncate">{info.product_name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">N/A</span>
                                            )}
                                        </div>

                                        {/* Quantity */}
                                        <div className="col-span-2 text-center">
                                            {info ? (
                                                <span className="text-sm font-bold text-slate-800 dark:text-white">
                                                    {info.quantity} <span className="text-[10px] text-slate-400">{info.unit}</span>
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </div>

                                        {/* Priority Dots */}
                                        <div className="col-span-2 flex items-center justify-center gap-2">
                                            {PRIORITY_COLORS.map(pc => {
                                                const isActive = currentPriority === pc.level
                                                return (
                                                    <button
                                                        key={pc.level}
                                                        onClick={() => togglePriority(pos.id, pc.level)}
                                                        className={`
                                                            rounded-full transition-all active:scale-90
                                                            ${isActive
                                                                ? `w-7 h-7 ${pc.bgDot} ring-2 ${pc.ring} ring-offset-2 shadow-md`
                                                                : `w-6 h-6 ${pc.bgDotInactive} hover:${pc.bgDot} hover:scale-110 opacity-60 hover:opacity-100`
                                                            }
                                                        `}
                                                        title={`Ưu tiên ${pc.level} (${pc.label})`}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer with Save/Cancel */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={() => onSave(localPriorities)}
                        className="px-5 py-2 text-sm font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm active:scale-95"
                    >
                        Lưu Thay Đổi
                    </button>
                </div>
            </div>
        </div>
    )
}

export function ExportOrderStatsModal({
    isOpen,
    taskCode,
    exportPositionIds,
    exportItemStatuses,
    exportItemInfoMap,
    onClose,
    onPrioritiesChanged
}: ExportOrderStatsModalProps) {
    const [loading, setLoading] = useState(true)
    const [zones, setZones] = useState<Zone[]>([])
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [layouts, setLayouts] = useState<Record<string, any>>({})
    const [viewingZoneDetail, setViewingZoneDetail] = useState<{ title: string, positions: PositionWithZone[] } | null>(null)

    // Priority state: position_id -> priority level (1-4)
    const [priorities, setPriorities] = useState<Record<string, number>>({})
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchData()
            // Initialize priorities from exportItemInfoMap
            const initPriorities: Record<string, number> = {}
            Object.entries(exportItemInfoMap).forEach(([posId, info]) => {
                if (info.priority && info.priority > 0) {
                    initPriorities[posId] = info.priority
                }
            })
            setPriorities(initPriorities)
        }
    }, [isOpen])

    async function fetchData() {
        setLoading(true)

        async function fetchAll(table: string, filter?: (query: any) => any, customSelect = '*', limit = 1000) {
            let allRecs: any[] = []
            let from = 0
            while (true) {
                let query = supabase.from(table as any).select(customSelect).range(from, from + limit - 1)
                if (filter) query = filter(query)
                const { data, error } = await query
                if (error) throw error
                if (!data || data.length === 0) break
                allRecs = [...allRecs, ...data]
                if (data.length < limit) break
                from += limit
            }
            return allRecs
        }

        try {
            const [rawPos, rawZones, rawZp, rawLayouts] = await Promise.all([
                fetchAll('positions', q => q.order('code')),
                fetchAll('zones', q => q.order('level').order('code')),
                fetchAll('zone_positions'),
                fetchAll('zone_status_layouts')
            ])

            // Deduplicate to prevent duplicate keys
            const posData = Array.from(new Map(rawPos.map(r => [r.id, r])).values())
            const zoneData = Array.from(new Map(rawZones.map(r => [r.id, r])).values())
            const zpData = Array.from(new Map(rawZp.map(r => [`${r.position_id}-${r.zone_id}`, r])).values())
            const layoutData = Array.from(new Map(rawLayouts.map(r => [r.zone_id, r])).values())

            const zpLookup = new Map<string, string>()
            zpData.forEach((zp: any) => {
                if (zp.position_id && zp.zone_id) zpLookup.set(zp.position_id, zp.zone_id)
            })

            const posWithZone: PositionWithZone[] = posData.map((pos: any) => ({
                ...pos,
                zone_id: zpLookup.get(pos.id) || null
            }))

            const finalLayoutData = [...layoutData]
            if (finalLayoutData.length === 0) {
                const local = localStorage.getItem('local_status_layouts')
                if (local) finalLayoutData.push(...Object.values(JSON.parse(local)))
            }

            const layoutsMap: Record<string, any> = {}
            finalLayoutData.forEach((l: any) => { if (l.zone_id) layoutsMap[l.zone_id] = l })

            setPositions(posWithZone)
            setZones(zoneData)
            setLayouts(layoutsMap)
        } catch (error: any) {
            console.error('Error fetching stats data:', error)
        } finally {
            setLoading(false)
        }
    }

    /** Save priorities to database */
    async function handleSavePriorities(updatedPriorities: Record<string, number>) {
        setSaving(true)
        try {
            // Build updates: map position_id -> export_task_item.id -> priority
            const updates: { id: string, priority: number | null }[] = []

            // Get all export position IDs
            exportPositionIds.forEach(posId => {
                const info = exportItemInfoMap[posId]
                if (!info?.item_id) return
                const newPriority = updatedPriorities[posId] || null
                updates.push({ id: info.item_id, priority: newPriority })
            })

            // Batch update
            if (updates.length > 0) {
                const updatePromises = updates.map(u =>
                    supabase.from('export_task_items').update({ priority: u.priority } as any).eq('id', u.id)
                )
                await Promise.all(updatePromises)
            }

            setPriorities(updatedPriorities)
            setViewingZoneDetail(null)
            onPrioritiesChanged?.()
        } catch (error: any) {
            console.error('Error saving priorities:', error)
            // Still update locally even if DB fails
            setPriorities(updatedPriorities)
            setViewingZoneDetail(null)
        } finally {
            setSaving(false)
        }
    }

    // Build zone tree
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
            node.children.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
            node.positions.sort((a, b) => (a.code || '').localeCompare(b.code || '', undefined, { numeric: true }))
        })
        return zones
            .filter(z => !z.parent_id || !map.has(z.parent_id))
            .map(z => map.get(z.id)!)
            .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
    }, [zones, positions])

    // Stats
    const exportCount = exportPositionIds.size

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        Object.values(exportItemStatuses).forEach(status => {
            counts[status] = (counts[status] || 0) + 1
        })
        return counts
    }, [exportItemStatuses])

    function getAllPositions(zone: any): PositionWithZone[] {
        let result = [...zone.positions]
        zone.children.forEach((c: any) => {
            result = [...result, ...getAllPositions(c)]
        })
        return result
    }

    function countExportPositions(zone: any): number {
        const allPos = getAllPositions(zone)
        return allPos.filter(p => exportPositionIds.has(p.id)).length
    }

    function openZoneDetail(title: string, allPositions: PositionWithZone[]) {
        setViewingZoneDetail({ title, positions: allPositions })
    }

    /** Check if a position belongs to a hall zone (or any ancestor zone has is_hall) */
    function isPositionInHall(posId: string): boolean {
        // Find the zone this position belongs to
        const pos = positions.find(p => p.id === posId)
        if (!pos?.zone_id) return false

        // Walk up the zone tree to check if any zone has is_hall
        const zoneMap = new Map<string, Zone>()
        zones.forEach(z => zoneMap.set(z.id, z))

        let currentZoneId: string | null = pos.zone_id
        while (currentZoneId) {
            const zone = zoneMap.get(currentZoneId)
            if (!zone) break
            if ((zone as any).is_hall) return true
            currentZoneId = zone.parent_id
        }
        return false
    }

    /** Compute summary stats for a zone's export positions */
    function computeZoneStats(allPositions: PositionWithZone[]) {
        const exportPos = allPositions.filter(p => exportPositionIds.has(p.id))
        let totalQty = 0
        let totalUnit = ''
        let shelfCount = 0
        let hallCount = 0

        exportPos.forEach(p => {
            const info = exportItemInfoMap[p.id]
            if (info) {
                totalQty += info.quantity || 0
                if (!totalUnit && info.unit) totalUnit = info.unit
            }
            if (isPositionInHall(p.id)) {
                hallCount++
            } else {
                shelfCount++
            }
        })

        return {
            totalPositions: exportPos.length,
            totalQty,
            totalUnit,
            shelfCount,
            hallCount
        }
    }

    /** Get cell color based on priority or export status */
    function getCellColors(posId: string) {
        const priority = priorities[posId]
        const isExport = exportPositionIds.has(posId)

        if (priority) {
            const pc = getPriorityConfig(priority)
            if (pc) return {
                bg: `${pc.bgLight} dark:bg-opacity-30`,
                border: `${pc.borderLight} dark:${pc.border}`,
                dot: pc.bgDot,
                barSegment: pc.bgCell,
                textBold: true
            }
        }

        if (isExport) {
            return {
                bg: 'bg-blue-50 dark:bg-blue-900/30',
                border: 'border-blue-300 dark:border-blue-800',
                dot: 'bg-blue-500',
                barSegment: 'bg-blue-500',
                textBold: true
            }
        }

        return {
            bg: 'bg-slate-50 dark:bg-slate-800',
            border: 'border-slate-100 dark:border-slate-700',
            dot: 'bg-slate-200 dark:bg-slate-700',
            barSegment: 'bg-slate-200 dark:bg-slate-700',
            textBold: false
        }
    }

    const getZoneFullName = (zoneId: string) => {
        const parts: string[] = []
        let curr: string | null | undefined = zoneId
        const seen = new Set()
        while (curr && !seen.has(curr)) {
            seen.add(curr)
            const z = zones.find(x => x.id === curr)
            if (!z) break
            parts.unshift(z.name)
            curr = z.parent_id
        }
        return parts.join(' - ') || 'N/A'
    }

    function renderZone(
        zone: Zone & { children: Zone[], positions: PositionWithZone[] },
        depth: number = 0,
        breadcrumb: string[] = []
    ): React.ReactNode {
        const layout = layouts[zone.id]
        const hasChildren = zone.children.length > 0
        const hasPositions = zone.positions.length > 0
        const positionColumns = layout?.position_columns ?? 10
        const cellWidth = layout?.cell_width ?? 0
        const cellHeight = layout?.cell_height ?? 0
        const displayType = layout?.display_type ?? 'auto'
        const childLayout = layout?.child_layout ?? 'vertical'
        const childColumns = layout?.child_columns ?? 0
        const childWidth = layout?.child_width ?? 0

        const currentBreadcrumb = [...breadcrumb, zone.name]
        const exportCountInZone = countExportPositions(zone)
        if (exportCountInZone === 0) return null

        if (displayType === 'hidden') {
            return (
                <div key={zone.id} className="contents">
                    {hasPositions && (
                        <div className="grid mb-4" style={{
                            gridTemplateColumns: cellWidth > 0
                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                : `repeat(${positionColumns}, minmax(auto, 1fr))`,
                            gap: `${layout?.layout_gap ?? 4}px`
                        }}>
                            {zone.positions.map(pos => renderCell(pos, zone.id, cellHeight, cellWidth))}
                        </div>
                    )}
                    {zone.children.map(child => renderZone(child as any, depth, currentBreadcrumb))}
                </div>
            )
        }

        const effectiveDisplayType = displayType === 'auto'
            ? (hasPositions && !hasChildren ? 'grid' : 'header')
            : displayType

        if (effectiveDisplayType === 'grouped') {
            return renderGroupedZone(zone, depth, currentBreadcrumb)
        }

        const zoneTitle = effectiveDisplayType === 'grid' || effectiveDisplayType === 'section'
            ? currentBreadcrumb.join(' - ')
            : zone.name

        // Compute stats for root zones
        const zoneStats = depth === 0 ? computeZoneStats(getAllPositions(zone)) : null

        return (
            <div key={zone.id} className={`mb-4 ${depth === 0 ? 'bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-xl' : ''} overflow-hidden`}>
                {/* Root zone header with stats */}
                {depth === 0 && zoneStats ? (
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">
                                {getZoneFullName(zone.id)}
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <span>Tổng: <strong className="text-slate-800 dark:text-white">{zoneStats.totalPositions}</strong> vị trí</span>
                                    {zoneStats.totalQty > 0 && (
                                        <span className="text-slate-400">({zoneStats.totalQty.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} {zoneStats.totalUnit})</span>
                                    )}
                                </div>
                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                                <span>Trên kệ: <strong className="text-slate-800 dark:text-white">{zoneStats.shelfCount}</strong></span>
                                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                                <span>Dưới sảnh: <strong className="text-slate-800 dark:text-white">{zoneStats.hallCount}</strong></span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors ${effectiveDisplayType === 'grid' || effectiveDisplayType === 'section' ? 'bg-slate-50/50 dark:bg-slate-800/30' : ''}`}
                        onClick={() => openZoneDetail(zoneTitle, getAllPositions(zone))}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-6 rounded-full bg-slate-300 dark:bg-slate-700"></div>
                            <div>
                                <h3 className="font-bold tracking-tight text-slate-600 dark:text-slate-300 text-sm">
                                    {zoneTitle}
                                </h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                                        {exportCountInZone} vị trí xuất
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className={`${depth === 0 ? 'p-4' : 'pl-4 pt-1 pb-2'}`}>
                    {hasPositions && (
                        <div className="grid mb-4" style={{
                            gridTemplateColumns: cellWidth > 0
                                ? `repeat(${positionColumns}, ${cellWidth}px)`
                                : `repeat(${positionColumns}, minmax(auto, 1fr))`,
                            gap: `${layout?.layout_gap ?? 4}px`
                        }}>
                            {zone.positions.map(pos => renderCell(pos, zone.id, cellHeight, cellWidth))}
                        </div>
                    )}
                    {hasChildren && (
                        <div
                            className={
                                childLayout === 'horizontal' ? 'flex overflow-x-auto pb-4 custom-scrollbar'
                                    : childLayout === 'grid' ? 'grid' : 'flex flex-col'
                            }
                            style={{
                                gap: `${layout?.layout_gap ?? 16}px`,
                                ...(childLayout === 'grid' && childColumns > 0
                                    ? { gridTemplateColumns: `repeat(${childColumns}, minmax(auto, 1fr))` }
                                    : childLayout === 'grid'
                                        ? { gridTemplateColumns: `repeat(auto-fill, minmax(280px, 1fr))` }
                                        : {})
                            }}
                        >
                            {zone.children.map(child => {
                                const node = renderZone(child as any, depth + 1, currentBreadcrumb)
                                if (!node) return null
                                return (
                                    <div
                                        key={child.id}
                                        className={childLayout === 'horizontal' ? 'shrink-0 grow' : ''}
                                        style={childLayout === 'horizontal' && childWidth > 0 ? { width: `${childWidth}px` } : undefined}
                                    >
                                        {node}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
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

        const exportCountInGroup = allPositions.filter(p => exportPositionIds.has(p.id)).length
        if (exportCountInGroup === 0) return null

        const totalCount = allPositions.length
        const layout = layouts[zone.id]
        const cellWidth = layout?.cell_width ?? 0
        const cellHeight = layout?.cell_height ?? 0
        const containerHeight = layout?.container_height ?? 0
        const compactTitle = layout?.use_full_title ? zone.name : (zone.code || zone.name)
        const fullTitle = [...breadcrumb, zone.name].join(' - ')

        return (
            <div
                key={zone.id}
                className="mb-3 pt-0.5 px-3 pb-3 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden rounded-lg cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
                style={{
                    width: cellWidth > 0 ? `${cellWidth}px` : '100%',
                    height: containerHeight > 0 ? `${containerHeight}px` : 'auto',
                }}
                onClick={() => openZoneDetail(fullTitle, allPositions)}
            >
                <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight truncate mr-2" title={compactTitle}>
                        {compactTitle}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 px-1.5 py-0.5 shadow-sm rounded">
                        {exportCountInGroup}/{totalCount}
                    </span>
                </div>

                <div
                    className="flex"
                    style={{
                        height: cellHeight > 0 ? `${cellHeight}px` : '6px',
                        gap: `${Math.max(1, (layout?.layout_gap ?? 16) / 8)}px`
                    }}
                >
                        {allPositions.map(pos => {
                            const colors = getCellColors(pos.id)
                            return (
                                <div
                                    key={`${zone.id}-${pos.id}`}
                                    className={`flex-1 h-full ${colors.barSegment} transition-colors rounded-sm`}
                                />
                            )
                        })}
                </div>
            </div>
        )
    }

    function renderCell(pos: PositionWithZone, zoneId: string, cellHeight: number, cellWidth: number): React.ReactNode {
        const colors = getCellColors(pos.id)

        return (
            <div
                key={`${zoneId}-${pos.id}`}
                style={{ height: cellHeight > 0 ? `${cellHeight}px` : '42px' }}
                className={`
                    relative border text-center transition-all p-1
                    flex flex-col items-center justify-center rounded-sm
                    ${colors.bg} ${colors.border}
                `}
            >
                <span className={`text-[8px] font-bold leading-none ${colors.textBold ? 'text-slate-900 dark:text-white' : 'text-slate-400'} ${cellWidth === 0 ? 'whitespace-nowrap px-0.5' : ''}`}>
                    {pos.code.split('-').pop()}
                </span>
                <div className={`mt-0.5 w-1.5 h-1.5 rounded-full ${colors.dot}`}></div>
            </div>
        )
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-8">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
                            <BarChart3 size={14} />
                            THỐNG KÊ CHI TIẾT
                        </div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white">
                            {taskCode}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Legend */}
                <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                Vị trí xuất: <strong className="text-blue-600">{exportCount}</strong>
                            </span>
                        </div>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                        {PRIORITY_COLORS.map(pc => {
                            const count = Object.values(priorities).filter(v => v === pc.level).length
                            return (
                                <div key={pc.level} className="flex items-center gap-1.5">
                                    <div className={`w-3 h-3 rounded-full ${pc.bgDot}`}></div>
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                        {pc.label} ({pc.level}): <strong className={pc.text}>{count}</strong>
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cấp độ ưu tiên:</span>
                        <span className="text-[10px] text-slate-500">
                            <strong className="text-red-600">1-Đỏ</strong> Lấy trước &nbsp;→&nbsp;
                            <strong className="text-yellow-600">2-Vàng</strong> Lấy sau &nbsp;→&nbsp;
                            <strong className="text-amber-700">3-Nâu</strong> Lấy cuối &nbsp;→&nbsp;
                            <strong className="text-blue-600">Xanh</strong> Mặc định &nbsp;→&nbsp;
                            <strong className="text-purple-600">4-Tím</strong> Tạm giữ
                        </span>
                        <span className="text-[10px] text-slate-400 italic ml-auto">Bấm vào zone để đánh dấu</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-4">
                            <Loader2 className="animate-spin text-blue-500" size={32} />
                            <p className="text-slate-400 font-bold text-sm tracking-widest">ĐANG TẢI SƠ ĐỒ...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {zoneTree.map(zone => renderZone(zone))}
                        </div>
                    )}
                </div>
            </div>

            {/* Zone Detail Sub-Modal for Priority Marking */}
            {viewingZoneDetail && (
                <ZoneDetailSubModal
                    title={viewingZoneDetail.title}
                    positions={viewingZoneDetail.positions}
                    exportPositionIds={exportPositionIds}
                    exportItemInfoMap={exportItemInfoMap}
                    priorities={priorities}
                    onSave={handleSavePriorities}
                    onClose={() => setViewingZoneDetail(null)}
                />
            )}
        </div>
    )
}
