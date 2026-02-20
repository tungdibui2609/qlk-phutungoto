import React, { useMemo } from 'react'
import { formatQuantityFull } from '@/lib/numberUtils'

interface ExportOrderItem {
    id?: string
    quantity: number
    unit: string | null
    status: string | null
    lots: {
        code: string
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
        const zones: Record<string, typeof diagramData> = {}
        diagramData.forEach(group => {
            const zone = group.key.split('-')[0]
            if (!zones[zone]) zones[zone] = []
            zones[zone].push(group)
        })
        return zones
    }, [diagramData])

    if (items.length === 0 || diagramData.length === 0) return null

    return (
        <div className="w-full">
            {Object.entries(groupedByZone).map(([zone, groups]) => {
                const totalItemsInZone = groups.reduce((sum, g) => sum + g.items.length, 0)

                return (
                    <div key={zone} className="mb-12">
                        <div className="font-bold text-lg mb-6 border-b-2 border-stone-800 dark:border-zinc-700 pb-2 print:border-black uppercase">
                            Kho {zone} • {totalItemsInZone} vị trí
                        </div>

                        {groups.map(group => (
                            <div key={group.key} className="mb-8 break-inside-avoid w-full overflow-x-auto">
                                <div className="font-bold text-[15px] mb-3 text-stone-700 dark:text-stone-300 print:text-black">
                                    Dãy {group.key.split('-').slice(1).join('')} • {group.items.length} vị trí
                                </div>

                                {/* Grid Render */}
                                <div className="space-y-2 min-w-max">
                                    {group.grid.tiers.map(tier => (
                                        <div key={tier} className="flex gap-2">
                                            <div className="w-16 flex items-center font-bold shrink-0 text-sm">
                                                Tầng {tier}
                                            </div>
                                            <div className="flex gap-2">
                                                {group.grid.slots.map(slot => {
                                                    // Find all items at this Tier/Slot
                                                    const slotItems = group.items.filter(i => i.tier === tier && i.slot === slot).map(i => i.data)

                                                    const hasItem = slotItems.length > 0
                                                    const firstItem = slotItems[0]

                                                    return (
                                                        <div key={slot} className={`
                                                            border border-black dark:border-stone-600 rounded w-28 h-20 p-1 flex flex-col justify-between relative shrink-0
                                                            ${hasItem ? 'bg-white dark:bg-stone-800' : 'bg-stone-50 dark:bg-stone-900 print:bg-white'}
                                                        `}>
                                                            {/* Slot Label (PL1) */}
                                                            <div className="text-[10px] text-center font-bold text-stone-500 mb-0.5">PL{slot}</div>

                                                            {hasItem ? (
                                                                <div className="flex flex-col h-full justify-between items-center pb-1">
                                                                    <div className="text-[9px] text-center font-bold break-all leading-tight px-0.5 dark:text-stone-300">
                                                                        {firstItem.positions?.code}
                                                                    </div>
                                                                    <div className="text-[9px] text-center w-full">
                                                                        <div className="font-bold truncate px-0.5 dark:text-stone-300" title={firstItem.products?.name}>
                                                                            {firstItem.products?.sku}
                                                                        </div>
                                                                        <div className="font-bold text-black dark:text-white scale-90 origin-bottom">
                                                                            {slotItems.length > 1 ? `${slotItems.length} items` : `${formatQuantityFull(firstItem.quantity)} ${firstItem.unit}`}
                                                                        </div>
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
                        ))}
                    </div>
                )
            })}
        </div>
    )
}
