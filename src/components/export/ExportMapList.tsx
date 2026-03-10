import React, { useMemo, useState, useEffect } from 'react'
import { ChevronDown, CheckSquare, Square, Eye, Printer } from 'lucide-react'
import { TagDisplay } from '@/components/lots/TagDisplay'

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
    // Grouping structure: Aisle (Dãy) -> Bin (Ô - Gom) -> Floor (Tầng)
    const aisleGroups = useMemo(() => {
        // Step 1: Flatten items into a structured map
        const data: any = {}

        items.forEach(item => {
            const path = item.zone_path || []
            const posName = item.position_name || ""
            
            let aisleKey = "AISLE_OTHER"
            let aisleName = "DÃY KHÁC"
            let binKey = "BIN_OTHER"
            let binName = "Ô KHÁC"
            let floorKey = "FLOOR_OTHER"
            let floorName = "TẦNG KHÁC"

            // Strategy 1: Extract from structured Position Name (e.g., K1D1A03T101, K1D2B05T501)
            // Matches: [K then digit] [D then digit as Aisle] [Letter then digit as Bin] [T then digit as Floor]
            const complexMatch = posName.match(/(?:K\d+)?D(\d+)([A-Z]+)(\d+)T(\d+)/i)
            
            if (complexMatch) {
                const aisleNum = complexMatch[1]
                const binLetter = complexMatch[2]
                const binNum = complexMatch[3]
                const floorVal = complexMatch[4]
                
                aisleKey = `WH-D${aisleNum}`
                aisleName = `DÃY ${aisleNum}`
                
                // Gom ô: Group by numeric part of the bin (e.g., A03, B03 -> 03)
                binKey = `${aisleKey}|Ô-${binNum}`
                binName = `Ô ${binNum}`
                
                // For floor, if it's 3 digits like 501, 101, we might want the first digit as the floor level
                const floorLevel = floorVal.length >= 3 ? floorVal[0] : floorVal
                floorKey = `${binKey}|T${floorLevel}`
                floorName = `TẦNG ${floorLevel}`
            } 
            // Strategy 2: Use zone_path as fallback or for manual overrides
            else if (path.length >= 2) {
                const warehouse = path[0]
                const aisle = path[1]
                
                if (aisleKey === "AISLE_OTHER") {
                    aisleKey = `${warehouse}|${aisle}`
                    aisleName = aisle.toUpperCase().startsWith('DÃY ') ? aisle.toUpperCase() : `DÃY ${aisle}`
                }

                if (path.length >= 3) {
                    const bin = path[2]
                    const binMatch = bin.match(/\d+$/)
                    const binSuffix = binMatch ? binMatch[0] : bin
                    
                    if (binKey === "BIN_OTHER") {
                        binKey = `${aisleKey}|Ô-${binSuffix}`
                        binName = `Ô ${binSuffix}`
                    }

                    if (path.length >= 4) {
                        const floor = path[3]
                        if (floorKey === "FLOOR_OTHER") {
                            floorKey = `${binKey}|${floor}`
                            floorName = floor.toUpperCase().startsWith('TẦNG ') ? floor.toUpperCase() : `TẦNG ${floor}`
                        }
                    }
                }
            } 
            // Strategy 3: Simple regex for basic patterns (e.g., A03T1)
            else {
                const simpleMatch = posName.match(/([A-Z])(\d+)T(\d+)/i)
                if (simpleMatch) {
                    const bNum = simpleMatch[2]
                    const fNum = simpleMatch[3]
                    
                    if (binKey === "BIN_OTHER") {
                        binKey = `${aisleKey}|Ô-${bNum}`
                        binName = `Ô ${bNum}`
                    }
                    if (floorKey === "FLOOR_OTHER") {
                        floorKey = `${binKey}|Tầng ${fNum}`
                        floorName = `TẦNG ${fNum}`
                    }
                }
            }

            // Final safety check: if still empty/other, try to default to Aisle 1 if patterned
            if (aisleName === "DÃY KHÁC" && posName.includes('K1D')) {
                 aisleName = "DÃY 1"
                 aisleKey = "WH-D1"
            }

            if (!data[aisleKey]) {
                data[aisleKey] = { name: aisleName, bins: {} }
            }
            if (!data[aisleKey].bins[binKey]) {
                data[aisleKey].bins[binKey] = { name: binName, floors: {} }
            }
            if (!data[aisleKey].bins[binKey].floors[floorKey]) {
                data[aisleKey].bins[binKey].floors[floorKey] = { name: floorName, items: [] }
            }
            data[aisleKey].bins[binKey].floors[floorKey].items.push(item)
        })

        // Step 2: Convert to sorted array
        return Object.values(data).map((aisle: any) => ({
            ...aisle,
            bins: Object.values(aisle.bins).map((bin: any) => ({
                ...bin,
                floors: Object.values(bin.floors).map((floor: any) => {
                    // Sort items: Suffix ABC
                    floor.items.sort((a: any, b: any) => a.position_name.localeCompare(b.position_name))
                    return floor
                }).sort((a: any, b: any) => {
                    // Floor sort: Level 02 before 01
                    return b.name.localeCompare(a.name, undefined, { numeric: true })
                })
            })).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        })).sort((a: any, b: any) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    }, [items])

    const [expandedAisles, setExpandedAisles] = useState<Set<string>>(new Set())

    useEffect(() => {
        // Expand first aisle by default
        if (aisleGroups.length > 0 && expandedAisles.size === 0) {
            setExpandedAisles(new Set([aisleGroups[0].name]))
        }
    }, [aisleGroups])

    const toggleAisle = (name: string) => {
        setExpandedAisles(prev => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }

    if (items.length === 0) return null

    return (
        <div className="space-y-8 w-full max-w-full overflow-hidden">
            {aisleGroups.map((aisle: any) => {
                const isExpanded = expandedAisles.has(aisle.name)
                const totalPositions = aisle.bins.reduce((sum: number, bin: any) => 
                    sum + bin.floors.reduce((fsum: number, floor: any) => fsum + floor.items.length, 0), 0)

                return (
                    <div key={aisle.name} className="flex flex-col bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden mb-6">
                        {/* Aisle Header */}
                        <div
                            className="flex items-center justify-between p-3 px-5 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors select-none bg-[#f8f9fb] dark:bg-zinc-800/80 border-b border-stone-200 dark:border-zinc-700"
                            onClick={() => toggleAisle(aisle.name)}
                        >
                            <div className="flex items-center gap-4">
                                <ChevronDown size={22} className={`text-emerald-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Square size={18} className="text-slate-400" />
                                        <span className="font-bold text-slate-800 dark:text-stone-100 text-xl uppercase">
                                            {aisle.name}
                                        </span>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 font-medium">
                                        <span>{aisle.bins.length} ô</span>
                                        <span>/</span>
                                        <span className="text-emerald-600 font-bold">{totalPositions} có hàng</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Bins Container */}
                        {isExpanded && (
                            <div className="p-5 bg-[#fafbfc] dark:bg-zinc-900/40">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {aisle.bins.map((bin: any) => {
                                        const binTotalPositions = bin.floors.reduce((sum: number, f: any) => sum + f.items.length, 0)
                                        return (
                                            <div key={bin.name} className="flex flex-col bg-white dark:bg-zinc-800 rounded-2xl border border-stone-200 dark:border-zinc-700 shadow-md transition-shadow overflow-hidden">
                                                {/* Bin Header */}
                                                <div className="flex items-center justify-between p-4 px-6 bg-slate-50/80 dark:bg-zinc-800 border-b border-slate-100 dark:border-zinc-700">
                                                    <div className="flex items-center gap-3">
                                                        <ChevronDown size={20} className="text-slate-400" />
                                                        <span className="font-bold text-slate-800 dark:text-stone-100 text-xl flex items-center gap-2">
                                                            {bin.name}
                                                            <span className="bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-3 py-0.5 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-800">
                                                                {binTotalPositions} vị trí
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Floors Container */}
                                                <div className="p-4 space-y-6">
                                                    {bin.floors.map((floor: any) => (
                                                        <div key={floor.name} className="flex flex-col bg-white dark:bg-zinc-900/20 rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                                                            {/* Floor Sub-header */}
                                                            <div className="flex items-center justify-between p-3 px-4 bg-[#f1f5f9]/50 dark:bg-zinc-800 border-b border-slate-100 dark:border-zinc-800">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-[4px] h-5 bg-emerald-500 rounded-full" />
                                                                    <span className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase flex items-center gap-2 tracking-wide">
                                                                        {floor.name} <span className="text-slate-300">|</span> <span className="text-emerald-600 font-extrabold">{floor.items.length} VỊ TRÍ</span>
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Position Grid - ABC Layout */}
                                                            <div className="p-4">
                                                                <div className="grid grid-cols-3 gap-4">
                                                                    {/* 
                                                                        We need to ensure A, B, C positions align.
                                                                        Logic: Filter items for A, B, C segments.
                                                                    */}
                                                                    {['A', 'B', 'C'].map(segment => {
                                                                        const segmentItems = floor.items.filter((i: any) => {
                                                                            // Robust segment detection: find first A, B, or C in the string
                                                                            const match = i.position_name.match(/\b[A-C]|[A-C](?=\d)/i)
                                                                            return match && match[0].toUpperCase() === segment
                                                                        })
                                                                        
                                                                        if (segmentItems.length === 0) {
                                                                            return (
                                                                                <div key={segment} className="min-h-[120px] flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-2xl bg-slate-50/20">
                                                                                    <span className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">{segment} - TRỐNG</span>
                                                                                </div>
                                                                            )
                                                                        }

                                                                        return segmentItems.map((item: any) => {
                                                                            const isSelected = selectedIds.has(item.id!)
                                                                            const isExported = item.status === 'Exported'
                                                                            
                                                                            return (
                                                                                <div
                                                                                    key={item.id}
                                                                                    onClick={() => onPositionSelect?.(item.id!)}
                                                                                    className={`relative flex flex-col p-2 pb-1 bg-white dark:bg-zinc-800 rounded-2xl border-2 transition-all cursor-pointer select-none group min-h-[120px] ${
                                                                                        isSelected 
                                                                                        ? 'bg-blue-50 border-blue-500 ring-4 ring-blue-100/50 dark:bg-blue-900/30' 
                                                                                        : 'border-slate-100 hover:border-emerald-400 dark:border-zinc-700 hover:shadow-lg'
                                                                                    } ${isExported ? 'opacity-50 grayscale' : ''} shadow-sm`}
                                                                                >
                                                                                    <div className="text-xs font-black text-slate-400 dark:text-zinc-500 text-center mb-1.5 truncate bg-slate-50 dark:bg-zinc-900/50 py-1 rounded-lg">
                                                                                        {item.position_name}
                                                                                    </div>
                                                                                    
                                                                                    <div className="flex-1 flex flex-col items-center justify-center gap-0.5 overflow-hidden px-1">
                                                                                        <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 leading-tight text-center">
                                                                                            {item.sku}
                                                                                        </div>
                                                                                        <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300 line-clamp-2 text-center leading-normal mb-1">
                                                                                            {item.product_name}
                                                                                        </div>
                                                                                        <div className="text-[10px] font-black text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-lg border border-blue-100 dark:border-blue-800 whitespace-nowrap">
                                                                                            {item.quantity} {item.unit}
                                                                                        </div>
                                                                                    </div>

                                                                                    {item.lot_tags && item.lot_tags.length > 0 && (
                                                                                        <div className="w-full text-center">
                                                                                            <span className="text-[8px] font-black text-orange-600 dark:text-orange-400 leading-none">
                                                                                                {item.lot_tags.map((t: any) => t.tag).join(', ')}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        })
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
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
    )
}
