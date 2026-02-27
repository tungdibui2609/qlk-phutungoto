import React, { useMemo } from 'react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { format } from 'date-fns'

interface ExportOrderItem {
    id?: string
    quantity: number
    unit: string | null
    status: string | null
    lots: {
        code: string
        lot_tags?: { tag: string; lot_item_id: string | null }[] | null
        inbound_date?: string | null
        notes?: string | null
    } | null
    positions: {
        code: string
    } | null
    products: {
        name: string
        sku: string
    } | null
}

interface ExportMapDiagramProps {
    items: ExportOrderItem[]
}

export function ExportMapDiagram({ items }: ExportMapDiagramProps) {
    // Layout Processing for Diagram
    const diagramData = useMemo(() => {
        type GridItem = {
            data: ExportOrderItem
            tier: number
            slot: number
        }

        type GridGroup = {
            name: string
            items: GridItem[]
            tiers: number[]
            slots: number[]
            key: string
            grid: {
                tiers: number[]
                slots: number[]
            }
        }

        const groups: Record<string, Omit<GridGroup, 'key' | 'grid'>> = {}

        items.forEach(item => {
            if (!item.positions?.code) return

            const code = item.positions.code
            const parts = code.split(/[-.]/)

            let zone = '?'
            let rack = '?'
            let tier = 1
            let slot = 1

            if (parts.length >= 2) {
                zone = parts[0]
                const rackTierPart = parts[1] // K1D1T1

                // Extract Tier
                const tierMatch = rackTierPart.match(/T(\d+)$/)
                if (tierMatch) {
                    tier = parseInt(tierMatch[1])
                    rack = rackTierPart.replace(/T\d+$/, '') // K1D1
                } else {
                    rack = rackTierPart
                }

                // Extract Slot
                const slotPart = parts[2] || ''
                const slotMatch = slotPart.match(/(\d+)/)
                if (slotMatch) {
                    slot = parseInt(slotMatch[1])
                }
            } else {
                rack = code
            }

            const groupKey = `${zone}-${rack}`

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    name: `${zone} - ${rack}`,
                    items: [],
                    tiers: [],
                    slots: []
                }
            }

            groups[groupKey].items.push({ data: item, tier, slot })
            if (!groups[groupKey].tiers.includes(tier)) groups[groupKey].tiers.push(tier)
            if (!groups[groupKey].slots.includes(slot)) groups[groupKey].slots.push(slot)
        })

        return Object.entries(groups).map(([key, group]) => {
            const sortedTiers = group.tiers.sort((a, b) => a - b)
            const sortedSlots = group.slots.sort((a, b) => a - b)

            // Determine actual range with buffer
            const minSlotRaw = sortedSlots.length ? Math.min(...sortedSlots) : 1
            const maxSlotRaw = sortedSlots.length ? Math.max(...sortedSlots) : 1

            const displayMinSlot = Math.max(1, minSlotRaw)
            const displayMaxSlot = maxSlotRaw

            // Generate arrays for the grid
            // Tiers from Max to Min (Top to Bottom), only include tiers that have items
            const tiers = [...sortedTiers].reverse()

            const slots = []
            for (let i = displayMinSlot; i <= displayMaxSlot; i++) {
                slots.push(i)
            }

            return {
                ...group,
                key,
                grid: {
                    tiers,
                    slots
                }
            }
        })
    }, [items])

    const groupedByZone = useMemo(() => {
        const zones: Record<string, { groups: typeof diagramData, maxSlot: number }> = {}
        diagramData.forEach(group => {
            const zone = group.key.split('-')[0]
            if (!zones[zone]) zones[zone] = { groups: [], maxSlot: 1 }
            zones[zone].groups.push(group)

            const groupMaxSlot = Math.max(...group.grid.slots, 1)
            if (groupMaxSlot > zones[zone].maxSlot) {
                zones[zone].maxSlot = groupMaxSlot
            }
        })
        return zones
    }, [diagramData])

    if (items.length === 0 || diagramData.length === 0) return null

    return (
        <div className="w-full">
            {Object.entries(groupedByZone).map(([zone, zoneData]) => {
                const totalItemsInZone = zoneData.groups.reduce((sum, g) => sum + g.items.length, 0)
                const maxSlotInZone = Math.max(zoneData.maxSlot, 4) // Ensure at least 4 columns so 1-item zones aren't huge

                return (
                    <div key={zone} className="mb-12 print:mb-8 pt-4 page-break-inside-avoid">
                        <div className="font-bold text-lg mb-6 border-b-2 border-stone-800 dark:border-zinc-700 pb-2 print:border-black uppercase">
                            {zone.startsWith('NK') ? `NHÀ KHO ${zone.replace('NK', '')}` : `KHO ${zone}`} • {totalItemsInZone} vị trí
                        </div>

                        {zoneData.groups.map(group => {
                            const rackCode = group.key.split('-').slice(1).join('-')
                            let parsedRack = rackCode

                            const result = []
                            const nMatch = rackCode.match(/N(\d+)/)
                            if (nMatch) result.push(`NGĂN ${nMatch[1]}`)

                            const kMatch = rackCode.match(/K([A-Z]+?)(?=(?:D\d|T\d|VT\d|$))/)
                            if (kMatch) result.push(`KHU ${kMatch[1]}`)

                            const dMatch = rackCode.match(/D(\d+)/)
                            if (dMatch) result.push(`DÃY ${dMatch[1]}`)

                            if (result.length > 0) {
                                parsedRack = result.join(' - ')
                            } else {
                                parsedRack = `Dãy ${rackCode}`
                            }

                            return (
                                <div key={group.key} className="mb-8 break-inside-avoid w-full overflow-x-auto">
                                    <div className="font-bold text-[15px] mb-3 text-stone-700 dark:text-stone-300 print:text-black">
                                        {parsedRack} • {group.items.length} vị trí
                                    </div>

                                    {/* Grid Render */}
                                    <div className="space-y-2 min-w-max">
                                        {group.grid.tiers.map(tier => (
                                            <div key={tier} className="flex gap-2">
                                                <div className="w-16 flex items-center font-bold shrink-0 text-sm">
                                                    Tầng {tier}
                                                </div>
                                                <div
                                                    className="grid gap-2 w-full"
                                                    style={{ gridTemplateColumns: `repeat(${maxSlotInZone}, minmax(0, 1fr))` }}
                                                >
                                                    {group.grid.slots.map(slot => {
                                                        // Find all items at this Tier/Slot
                                                        const slotItems = group.items.filter(i => i.tier === tier && i.slot === slot).map(i => i.data)

                                                        const hasItem = slotItems.length > 0
                                                        const firstItem = slotItems[0]

                                                        return (
                                                            <div key={slot} style={{ gridColumnStart: slot }} className={`
                                                            border border-black dark:border-stone-600 rounded min-w-[80px] min-h-[100px] p-1 flex flex-col justify-between relative
                                                            ${hasItem ? 'bg-white dark:bg-stone-800' : 'bg-stone-50 dark:bg-stone-900 print:bg-white'}
                                                        `}>
                                                                {hasItem ? (
                                                                    <div className="flex flex-col h-full justify-start items-center gap-1.5 pt-1">
                                                                        <div className="text-[10px] text-center font-bold text-stone-700 dark:text-stone-300 print:text-black break-all leading-tight px-0.5 shrink-0">
                                                                            {firstItem.positions?.code}
                                                                        </div>
                                                                        <div className="text-[9px] text-center w-full flex flex-col items-center flex-1 pb-0.5">
                                                                            <div className="font-bold truncate px-0.5 dark:text-stone-300 w-full shrink-0" title={firstItem.products?.name}>
                                                                                {firstItem.products?.sku}
                                                                            </div>
                                                                            <div className="font-bold text-black dark:text-white scale-90 origin-bottom mt-0.5 shrink-0">
                                                                                {slotItems.length > 1 ? `${slotItems.length} items` : `${formatQuantityFull(firstItem.quantity)} ${firstItem.unit}`}
                                                                            </div>
                                                                            {firstItem.lots?.lot_tags && firstItem.lots.lot_tags.length > 0 && (
                                                                                <div className="w-full flex justify-center scale-90 -my-0.5 mt-0.5 shrink-0">
                                                                                    <TagDisplay
                                                                                        tags={firstItem.lots.lot_tags
                                                                                            .filter(t => !t.tag.startsWith('SPLIT_TO:') && !t.tag.startsWith('MERGED_TO:'))
                                                                                            .map(t => t.tag)}
                                                                                        variant="compact"
                                                                                        placeholderMap={{ '@': firstItem.products?.sku || 'SẢN PHẨM' }}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                            {firstItem.lots?.inbound_date && (
                                                                                <div className="text-[9px] text-stone-500 font-medium scale-90 -my-0.5 mt-auto">
                                                                                    {format(new Date(firstItem.lots.inbound_date), 'dd/MM/yy')}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-full"></div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )
}
