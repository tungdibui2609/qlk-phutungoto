import React, { useMemo, useState, useEffect } from 'react'
import { ChevronDown, CheckSquare, Eye } from 'lucide-react'

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
    zone_path?: string[]
    lot_tags?: { tag: string; lot_item_id: string | null }[] | null
}

interface ExportMapListProps {
    items: ExportItemProps[]
    onPositionSelect?: (id: string) => void
    selectedIds?: Set<string>
    onBulkSelect?: (ids: string[], shouldSelect: boolean) => void
    onViewLotDetails?: (lotCode: string) => void
    readOnly?: boolean
}

export function ExportMapList({ items, onPositionSelect, selectedIds = new Set(), onBulkSelect, onViewLotDetails, readOnly = false }: ExportMapListProps) {
    // Grouping structure: Warehouse -> Aisle -> Bin (Grouped) -> Floor
    const warehouseGroups = useMemo(() => {
        const data: any = {}

        items.forEach(item => {
            const path = item.zone_path || []
            const posCode = item.position_name || ""
            
            const whName = path.length > 0 ? path[0] : "KHO KHÁC"
            const aisleName = path.length > 1 ? path[1] : (posCode.match(/D(\d+)/i)?.[0] || "DÃY KHÁC")
            
            let binName = "Ô KHÁC"
            const complexMatch = posCode.match(/(?:K\d+)?D(\d+)([A-Z]+)(\d+)T(\d+)/i)
            const simpleMatch = posCode.match(/([A-Z])(\d+)T(\d+)/i)
            
            if (complexMatch) {
                binName = `Ô ${complexMatch[3]}`
            } else if (simpleMatch) {
                binName = `Ô ${simpleMatch[2]}`
            } else if (path.length > 2) {
                const bin = path[2]
                const binMatch = bin.match(/\d+$/)
                binName = binMatch ? `Ô ${binMatch[0]}` : bin
            }

            let floorName = path.length > 3 ? path[3] : "TẦNG KHÁC"
            if (complexMatch) {
                const floorVal = complexMatch[4]
                const floorLevel = floorVal.length >= 3 ? floorVal[0] : floorVal
                floorName = `TẦNG ${floorLevel}`
            } else if (simpleMatch) {
                floorName = `TẦNG ${simpleMatch[3]}`
            }

            if (!data[whName]) data[whName] = { name: whName, aisles: {} }
            if (!data[whName].aisles[aisleName]) data[whName].aisles[aisleName] = { name: aisleName, bins: {} }
            if (!data[whName].aisles[aisleName].bins[binName]) data[whName].aisles[aisleName].bins[binName] = { name: binName, floors: {} }
            if (!data[whName].aisles[aisleName].bins[binName].floors[floorName]) data[whName].aisles[aisleName].bins[binName].floors[floorName] = { name: floorName, items: [] }
            
            data[whName].aisles[aisleName].bins[binName].floors[floorName].items.push(item)
        })

        const sorted = Object.values(data).map((wh: any) => ({
            ...wh,
            aisles: Object.values(wh.aisles).map((aisle: any) => ({
                ...aisle,
                bins: Object.values(aisle.bins).map((bin: any) => ({
                    ...bin,
                    floors: Object.values(bin.floors).map((floor: any) => ({
                        ...floor,
                        items: floor.items
                    })).sort((a: any, b: any) => b.name.localeCompare(a.name, undefined, { numeric: true }))
                })).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            })).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        })).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))

        return sorted
    }, [items])

    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (warehouseGroups.length > 0 && expandedSections.size === 0) {
            const initial = new Set<string>()
            warehouseGroups.forEach((wh: any) => {
                Object.values(wh.aisles).forEach((aisle: any) => {
                    initial.add(`${wh.name}|${aisle.name}`)
                })
            })
            setExpandedSections(initial)
        }
    }, [warehouseGroups])

    const toggleSection = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    if (items.length === 0) return null

    return (
        <div className="space-y-6 w-full max-w-full">
            {warehouseGroups.map((wh: any) => (
                <div key={wh.name} className="space-y-4">
                    <div className="flex items-center gap-2 px-2">
                        <div className="w-1 h-6 bg-blue-600 rounded-full" />
                        <h3 className="text-lg font-black text-slate-800 dark:text-stone-100 uppercase tracking-tight">{wh.name}</h3>
                    </div>

                    {Object.values(wh.aisles).map((aisle: any) => {
                        const sectionId = `${wh.name}|${aisle.name}`
                        const isExpanded = expandedSections.has(sectionId)
                        const allAisleItems = Object.values(aisle.bins).flatMap((bin: any) => 
                            Object.values(bin.floors).flatMap((f: any) => f.items)
                        )
                        const aisleSelected = allAisleItems.length > 0 && allAisleItems.every((i: any) => selectedIds.has(i.id!))

                        return (
                            <div key={aisle.name} className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                                <div 
                                    className="flex items-center justify-between p-4 px-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors select-none bg-slate-50/50 dark:bg-zinc-800/50 border-b border-stone-100 dark:border-zinc-700"
                                    onClick={() => toggleSection(sectionId)}
                                >
                                    <div className="flex items-center gap-4">
                                        <ChevronDown size={20} className={`text-slate-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                        <div className="flex items-center gap-2">
                                            <span className="font-black text-slate-800 dark:text-stone-100 text-lg uppercase tracking-wider">{aisle.name}</span>
                                            <span className="text-slate-300">|</span>
                                            <span className="text-xs font-bold text-slate-500 uppercase">{Object.keys(aisle.bins).length} Ô gộp</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {!readOnly && onBulkSelect && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onBulkSelect(allAisleItems.map((i: any) => i.id!), !aisleSelected)
                                                }}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all border uppercase ${
                                                    aisleSelected 
                                                    ? 'bg-blue-600 text-white border-blue-600' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-500 hover:text-blue-600 dark:bg-zinc-900 dark:border-zinc-700'
                                                }`}
                                            >
                                                <CheckSquare size={14} />
                                                {aisleSelected ? 'Đã chọn Dãy' : 'Chọn cả Dãy'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-4 md:p-6 space-y-10">
                                        {Object.values(aisle.bins).map((bin: any) => {
                                            const allBinItems = Object.values(bin.floors).flatMap((f: any) => f.items)
                                            const binSelected = allBinItems.length > 0 && allBinItems.every((i: any) => selectedIds.has(i.id!))
                                            
                                            return (
                                            <div key={bin.name} className="relative">
                                                <div className="flex items-center gap-3 mb-6 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm p-2 rounded-xl z-20">
                                                    <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-black uppercase shadow-sm">
                                                        {bin.name}
                                                    </span>
                                                    {!readOnly && onBulkSelect && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                const ids = allBinItems.map((i: any) => i.id!).filter(Boolean)
                                                                onBulkSelect(ids, !binSelected)
                                                            }}
                                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black transition-all border uppercase ${
                                                                binSelected 
                                                                ? 'bg-blue-600 text-white border-blue-600' 
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-500 hover:text-blue-600 dark:bg-zinc-900 dark:border-zinc-700'
                                                            }`}
                                                        >
                                                            <CheckSquare size={12} />
                                                            {binSelected ? 'Đã chọn Ô' : 'Chọn cả Ô'}
                                                        </button>
                                                    )}
                                                    <div className="h-px flex-1 bg-slate-100 dark:bg-zinc-700" />
                                                </div>

                                                <div className="space-y-6">
                                                    {Object.values(bin.floors).map((floor: any) => {
                                                        // Group items by position_name within each floor
                                                        const posGroups: Record<string, any[]> = {}
                                                        floor.items.forEach((item: any) => {
                                                            if (!posGroups[item.position_name]) posGroups[item.position_name] = []
                                                            posGroups[item.position_name].push(item)
                                                        })

                                                        // Sort positions: Suffix 01 first, then 02..., then alphabetical A, B, C...
                                                        const sortedPosNames = Object.keys(posGroups).sort((a, b) => {
                                                            const suffixA = a.slice(-2)
                                                            const suffixB = b.slice(-2)
                                                            if (suffixA !== suffixB) return suffixA.localeCompare(suffixB)
                                                            return a.localeCompare(b)
                                                        })

                                                        return (
                                                            <div key={floor.name} className="space-y-3">
                                                                <div className="flex items-center gap-2 px-1">
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-zinc-900/50 px-2 py-0.5 rounded">{floor.name}</span>
                                                                    <div className="flex-1 h-px bg-slate-100 dark:bg-zinc-800" />
                                                                </div>
                                                                
                                                                <div className="flex items-stretch gap-3 overflow-x-auto pb-4 no-scrollbar">
                                                                    {sortedPosNames.map(posName => {
                                                                        const posItems = posGroups[posName]
                                                                        const firstItem = posItems[0]
                                                                        const allSelected = posItems.every(i => selectedIds.has(i.id!))
                                                                        const someSelected = posItems.some(i => selectedIds.has(i.id!))
                                                                        const anyExported = posItems.some(i => i.status === 'Exported')
                                                                        const allExported = posItems.every(i => i.status === 'Exported')
                                                                        
                                                                        return (
                                                                            <div
                                                                                key={posName}
                                                                                className={`relative flex flex-col p-3 rounded-xl border-2 transition-all select-none group flex-shrink-0 w-[calc((100%-60px)/6)] min-w-[150px] min-h-[180px] ${
                                                                                    allSelected 
                                                                                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-100 dark:bg-blue-900/30' 
                                                                                    : someSelected
                                                                                        ? 'bg-blue-50/50 border-blue-400 border-dashed dark:bg-blue-900/20'
                                                                                        : allExported
                                                                                            ? 'bg-stone-50 border-stone-200 opacity-60 dark:bg-zinc-800'
                                                                                            : 'bg-white border-slate-100 hover:border-emerald-400 dark:bg-zinc-900 dark:border-zinc-800'
                                                                                } shadow-sm overflow-hidden`}
                                                                            >
                                                                                {/* Header: Position Code */}
                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        {!readOnly && onBulkSelect && (
                                                                                            <input 
                                                                                                type="checkbox"
                                                                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
                                                                                                checked={allSelected}
                                                                                                onChange={(e) => {
                                                                                                    e.stopPropagation()
                                                                                                    const ids = posItems.map(i => i.id!).filter(Boolean)
                                                                                                    onBulkSelect(ids, e.target.checked)
                                                                                                }}
                                                                                            />
                                                                                        )}
                                                                                        <span className="text-[10px] font-black text-slate-700 dark:text-zinc-200 font-mono bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-zinc-750 cursor-pointer" onClick={(e) => {
                                                                                            if (!readOnly && onBulkSelect) {
                                                                                                e.stopPropagation()
                                                                                                const ids = posItems.map(i => i.id!).filter(Boolean)
                                                                                                onBulkSelect(ids, !allSelected)
                                                                                            }
                                                                                        }}>
                                                                                            {posName}
                                                                                        </span>
                                                                                    </div>
                                                                                    {onViewLotDetails && firstItem.lot_code && (
                                                                                        <button
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation()
                                                                                                onViewLotDetails(firstItem.lot_code)
                                                                                            }}
                                                                                            className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800"
                                                                                            title="Xem chi tiết LOT"
                                                                                        >
                                                                                            <Eye size={12} />
                                                                                        </button>
                                                                                    )}
                                                                                </div>

                                                                                {/* Product Lines Container */}
                                                                                <div className="flex-1 flex flex-col gap-2 min-w-0">
                                                                                    {posItems.map((item, idx) => {
                                                                                        const isItemSelected = selectedIds.has(item.id!)
                                                                                        const isExported = item.status === 'Exported'
                                                                                        
                                                                                        return (
                                                                                            <div 
                                                                                                key={item.id}
onClick={() => !readOnly && onPositionSelect?.(item.id!)}
    onContextMenu={(e) => {
        e.preventDefault()
        if (readOnly) return
        const lotIds = posItems.map(i => i.lot_id || '').filter(Boolean)
        if (lotIds.length === 0) return
        // Call parent context handler if provided (will add prop later)
        console.log('Context menu on position', posName, 'lotIds:', lotIds)
        // TODO: Open context menu here
    }}
                                                                                                className={`flex flex-col gap-1 p-2 rounded-lg border transition-all cursor-pointer ${
                                                                                                    isItemSelected 
                                                                                                    ? 'bg-blue-600/5 border-blue-200' 
                                                                                                    : 'bg-slate-50/50 border-slate-100 hover:border-emerald-300 dark:bg-zinc-800/50 dark:border-zinc-700'
                                                                                                }`}
                                                                                            >
                                                                                                <div className="flex items-start justify-between gap-1">
                                                                                                    <div className="text-[12px] font-black text-blue-700 dark:text-blue-400 leading-none whitespace-nowrap">
                                                                                                        {item.quantity} <span className="text-[8px] font-bold text-slate-400 uppercase">{item.unit}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="text-[10px] font-bold text-slate-700 dark:text-zinc-200 line-clamp-2 leading-tight">
                                                                                                    {item.product_name}
                                                                                                </div>
                                                                                                {isExported && (
                                                                                                    <div className="mt-1 flex items-center gap-1">
                                                                                                        <div className="w-1 h-1 bg-purple-500 rounded-full" />
                                                                                                        <span className="text-[8px] font-black text-purple-700 dark:text-purple-400 uppercase">Đã xuất</span>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )
                                                                                    })}
                                                                                </div>

                                                                                {/* Global Selection Indicator pills */}
                                                                                {someSelected && !allSelected && (
                                                                                    <div className="mt-2 flex justify-center">
                                                                                        <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 uppercase">Đã chọn {posItems.filter(i => selectedIds.has(i.id!)).length}/{posItems.length}</span>
                                                                                    </div>
                                                                                )}

                                                                                {/* Global Selection Checkmark Overlay */}
                                                                                {!readOnly && allSelected && (
                                                                                    <div className="absolute -right-4 -top-4 w-8 h-8 bg-blue-500 rotate-45 flex items-end justify-center pb-0.5 shadow-sm">
                                                                                        <CheckSquare size={10} className="text-white -rotate-45 mb-1" />
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
                                            </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}
