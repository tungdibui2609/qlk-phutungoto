import React, { useMemo, useState } from 'react'
import { ChevronDown, CheckSquare, Square, Eye } from 'lucide-react'

interface ExportItemProps {
    id?: string
    lot_code: string
    lot_inbound_date?: string | null
    position_name: string
    product_name: string
    sku: string
    quantity: number
    unit: string
    status: string
    display_status?: string
    current_position_name?: string
    onPositionSelect?: (id: string) => void
    isSelected?: boolean
}

interface ExportMapListProps {
    items: ExportItemProps[]
    onPositionSelect?: (id: string) => void
    selectedIds?: Set<string>
    onBulkSelect?: (ids: string[], shouldSelect: boolean) => void
    onViewLotDetails?: (lotCode: string) => void
    readOnly?: boolean
}

export function parsePositionPrefix(prefix: string): string {
    const parts = prefix.split('.')
    if (parts.length === 0) return prefix

    const result: string[] = []

    // First part: NK1 -> NHÀ KHO 1
    if (parts[0].startsWith('NK')) {
        result.push(`NHÀ KHO ${parts[0].replace('NK', '')}`)
    } else {
        result.push(parts[0].toUpperCase())
    }

    if (parts.length > 1) {
        let details = parts[1]

        const nMatch = details.match(/N(\d+)/)
        if (nMatch) result.push(`NGĂN ${nMatch[1]}`)

        const kMatch = details.match(/K([A-Z]+?)(?=(?:D\d|T\d|VT\d|$))/)
        if (kMatch) result.push(`KHU ${kMatch[1]}`)

        const dMatch = details.match(/D(\d+)/)
        if (dMatch) result.push(`DÃY ${dMatch[1]}`)

        const tMatch = details.match(/T(\d+)/)
        if (tMatch) result.push(`TẦNG ${tMatch[1]}`)
    }

    if (result.length > 1) {
        return result.join(' • ')
    }

    return prefix
}

export function ExportMapList({ items, onPositionSelect, selectedIds = new Set(), onBulkSelect, onViewLotDetails, readOnly = false }: ExportMapListProps) {
    // Group items by zone prefix (e.g. "NK1.N1KAD1T1" from "NK1.N1KAD1T1.VT1")
    const groupedItems = useMemo(() => {
        const groups: Record<string, ExportItemProps[]> = {}
        items.forEach(item => {
            let prefix = item.position_name
            const lastDotIdx = item.position_name.lastIndexOf('.')
            // Typically VT is the last dot part
            if (lastDotIdx > 0 && item.position_name.toUpperCase().includes('VT')) {
                prefix = item.position_name.substring(0, lastDotIdx)
            }
            if (!groups[prefix]) {
                groups[prefix] = []
            }
            groups[prefix].push(item)
        })

        // Format and sort
        return Object.entries(groups).map(([prefix, currentItems]) => {
            // Sort items numerically by VT number roughly
            currentItems.sort((a, b) => a.position_name.localeCompare(b.position_name, undefined, { numeric: true }))

            return {
                prefix,
                name: parsePositionPrefix(prefix),
                items: currentItems
            }
        }).sort((a, b) => a.prefix.localeCompare(b.prefix)) // Sort alphabetically so NK1 comes before NK2, etc.
    }, [items])

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(groupedItems.map(g => g.prefix)) // Expand all by default
    )

    const toggleGroup = (prefix: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev)
            if (next.has(prefix)) next.delete(prefix)
            else next.add(prefix)
            return next
        })
    }

    if (items.length === 0) return null

    const parentGroups = useMemo(() => {
        const pGroups: Record<string, {
            name: string,
            prefix: string,
            subGroups: typeof groupedItems
        }> = {}

        groupedItems.forEach(group => {
            const parts = group.prefix.split('.')
            const parentPrefix = parts[0]

            let formattedParentZone = parentPrefix
            if (parentPrefix.startsWith('NK')) {
                formattedParentZone = `NHÀ KHO ${parentPrefix.replace('NK', '')}`
            } else {
                formattedParentZone = parentPrefix.toUpperCase()
            }

            if (!pGroups[parentPrefix]) {
                pGroups[parentPrefix] = {
                    name: formattedParentZone,
                    prefix: parentPrefix,
                    subGroups: []
                }
            }
            pGroups[parentPrefix].subGroups.push(group)
        })

        return Object.values(pGroups).sort((a, b) => a.prefix.localeCompare(b.prefix))
    }, [groupedItems])

    const [expandedParents, setExpandedParents] = useState<Set<string>>(
        new Set(parentGroups.map(g => g.prefix)) // Expand all by default
    )

    const toggleParentGroup = (prefix: string) => {
        setExpandedParents(prev => {
            const next = new Set(prev)
            if (next.has(prefix)) next.delete(prefix)
            else next.add(prefix)
            return next
        })
    }

    return (
        <div className="space-y-6 w-full">
            {/* Top Summaries */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Tổng vị trí xuất</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
                        {items.length} <span className="text-sm font-medium text-slate-500">vị trí</span>
                    </div>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">Tổng xuất kho</div>
                    <div className="text-xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2">
                        {items.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
                        <span className="text-sm font-medium text-slate-500">{Array.from(new Set(items.map(i => i.unit))).join(', ')}</span>
                    </div>
                </div>
            </div>

            {parentGroups.map((parentGroup) => {
                const isParentExpanded = expandedParents.has(parentGroup.prefix)
                let parentTotalPositions = 0
                let parentTotalQuantity = 0
                const parentUnits = new Set<string>()

                parentGroup.subGroups.forEach(subG => {
                    parentTotalPositions += subG.items.length
                    parentTotalQuantity += subG.items.reduce((sum, item) => sum + item.quantity, 0)
                    subG.items.forEach(i => parentUnits.add(i.unit))
                })

                return (
                    <div key={parentGroup.prefix} className="flex flex-col bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                        {/* Parent Group Header */}
                        <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-50 dark:hover:bg-zinc-700/50 transition-colors select-none"
                            onClick={() => toggleParentGroup(parentGroup.prefix)}
                        >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {onBulkSelect && (() => {
                                    const selectableItems = parentGroup.subGroups.flatMap(sg => sg.items.filter(item => item.id && item.status !== 'Exported'))
                                    if (selectableItems.length === 0) return null

                                    const allSelected = selectableItems.every(item => selectedIds.has(item.id!))

                                    return (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onBulkSelect(
                                                    selectableItems.map(item => item.id!),
                                                    !allSelected
                                                )
                                            }}
                                            className={`p-0.5 rounded transition-colors ${allSelected
                                                ? 'text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                                : 'text-stone-400 hover:text-stone-600 hover:bg-stone-200 dark:hover:bg-zinc-700'
                                                }`}
                                            title={allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                        >
                                            {allSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </button>
                                    )
                                })()}
                                <ChevronDown size={20} className={`text-stone-400 dark:text-zinc-500 transition-transform ${isParentExpanded ? 'rotate-180' : ''}`} />
                                <span className="font-black text-stone-800 dark:text-stone-200 text-base uppercase tracking-wider">
                                    {parentGroup.name}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm shrink-0 ml-4">
                                <span className="bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-stone-300 px-3 py-1.5 rounded-lg font-bold">
                                    {parentTotalPositions} vị trí
                                </span>
                                <span className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg font-bold">
                                    {parentTotalQuantity.toLocaleString()} {Array.from(parentUnits).join(', ')}
                                </span>
                            </div>
                        </div>

                        {/* Child Groups Container */}
                        {isParentExpanded && (
                            <div className="p-4 pt-0 space-y-3 bg-stone-50/50 dark:bg-zinc-900/20 border-t border-stone-100 dark:border-zinc-800">
                                <div className="mt-4 space-y-3">
                                    {parentGroup.subGroups.map((group) => {
                                        const isExpanded = expandedGroups.has(group.prefix)
                                        const totalQuantity = group.items.reduce((sum, item) => sum + item.quantity, 0)
                                        const units = Array.from(new Set(group.items.map(i => i.unit))).join(', ')

                                        return (
                                            <div key={group.prefix} className="flex flex-col bg-slate-50 dark:bg-zinc-800/30 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                                                {/* Group Header */}
                                                <div
                                                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700/50 transition-colors select-none"
                                                    onClick={() => toggleGroup(group.prefix)}
                                                >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {onBulkSelect && !readOnly && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    // Filter out items without IDs or already exported (if you want to prevent selecting exported items)
                                                                    const selectableItems = group.items.filter(item => item.id && item.status !== 'Exported')
                                                                    if (selectableItems.length === 0) return

                                                                    const allSelected = selectableItems.every(item => selectedIds.has(item.id!))
                                                                    onBulkSelect(
                                                                        selectableItems.map(item => item.id!),
                                                                        !allSelected
                                                                    )
                                                                }}
                                                                className={`p-0.5 rounded transition-colors ${group.items.filter(item => item.id && item.status !== 'Exported').length > 0 && group.items.filter(item => item.id && item.status !== 'Exported').every(item => selectedIds.has(item.id!))
                                                                    ? 'text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                                                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                                    }`}
                                                                title={group.items.filter(item => item.id && item.status !== 'Exported').length > 0 && group.items.filter(item => item.id && item.status !== 'Exported').every(item => selectedIds.has(item.id!)) ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                                            >
                                                                {group.items.filter(item => item.id && item.status !== 'Exported').length > 0 && group.items.filter(item => item.id && item.status !== 'Exported').every(item => selectedIds.has(item.id!)) ? <CheckSquare size={16} /> : <Square size={16} />}
                                                            </button>
                                                        )}
                                                        <ChevronDown size={18} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                        <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                                                            {group.name}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs shrink-0 ml-2">
                                                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-md font-bold">
                                                            {group.items.length} vt
                                                        </span>
                                                        <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md font-bold">
                                                            {totalQuantity.toLocaleString()} {units}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Group Items Grid */}
                                                {isExpanded && (
                                                    <div className="p-2 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2">
                                                            {group.items.map((item, idx) => {
                                                                const isExported = item.status === 'Exported'
                                                                const isSelected = item.id ? selectedIds.has(item.id) : false
                                                                const hasLot = !!item.lot_code

                                                                let bgClass = "bg-white dark:bg-slate-800"
                                                                let borderClass = "border-slate-200 dark:border-slate-700"

                                                                if (isSelected) {
                                                                    bgClass = "bg-blue-50 dark:bg-blue-900/30"
                                                                    borderClass = "border-blue-500"
                                                                } else if (hasLot) {
                                                                    bgClass = "bg-amber-50 dark:bg-amber-900/10"
                                                                    borderClass = "border-amber-200 dark:border-amber-800"
                                                                }

                                                                // Override styles for exported mode
                                                                if (isExported) {
                                                                    bgClass = "bg-slate-50 dark:bg-slate-800/30 opacity-60"
                                                                    borderClass = "border-slate-200 dark:border-slate-700"
                                                                }

                                                                return (
                                                                    <div
                                                                        key={item.id || idx}
                                                                        className={`relative group flex flex-col p-1 rounded border ${bgClass} ${borderClass} aspect-square text-[10px] transition-all ${readOnly ? 'opacity-80' : 'hover:shadow-md'} ${!isExported && hasLot && !readOnly ? 'hover:border-blue-300' : ''}`}
                                                                    >
                                                                        {onPositionSelect && item.id && !isExported && !readOnly && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    onPositionSelect(item.id!)
                                                                                }}
                                                                                className={`absolute bottom-1 left-1 z-10 p-0.5 rounded bg-white/80 dark:bg-gray-800/80 hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}
                                                                                title={isSelected ? "Bỏ chọn" : "Chọn vị trí"}
                                                                            >
                                                                                {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                                                            </button>
                                                                        )}

                                                                        {hasLot && onViewLotDetails && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    onViewLotDetails(item.lot_code)
                                                                                }}
                                                                                className="absolute left-1 top-1 text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400 transition-colors z-20"
                                                                                title="Xem chi tiết LOT"
                                                                            >
                                                                                <Eye size={12} />
                                                                            </button>
                                                                        )}

                                                                        {item.display_status && ['Moved to Hall', 'Changed Position'].includes(item.display_status) && (
                                                                            <div className="absolute left-5 top-1 flex items-center z-20 max-w-[calc(100%-24px)]">
                                                                                <span className={`text-[8px] leading-[12px] font-bold px-1.5 py-[0.5px] rounded truncate ${item.display_status === 'Moved to Hall' ? 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30' : 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'}`} title={item.current_position_name}>
                                                                                    ➔ {item.current_position_name}
                                                                                </span>
                                                                            </div>
                                                                        )}

                                                                        <div className="font-bold text-center text-slate-700 dark:text-slate-200 mb-0.5 border-b border-slate-100 dark:border-slate-700/50 pb-0.5 truncate text-[10px] pt-4">
                                                                            {item.position_name}
                                                                        </div>

                                                                        <div className="flex flex-col gap-0.5 flex-1 justify-center overflow-hidden">
                                                                            <div className="font-bold text-center text-teal-700 dark:text-teal-400 truncate text-[9px]">{item.sku}</div>
                                                                            <div className="text-[9px] text-slate-500 line-clamp-2 text-center">
                                                                                {item.product_name}
                                                                            </div>
                                                                            <div className={`font-mono text-[9px] mt-auto font-bold text-center ${isExported ? 'text-slate-500 dark:text-slate-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                                                {item.quantity} {item.unit}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                        }
                    </div >
                )
            })}
        </div >
    )
}
