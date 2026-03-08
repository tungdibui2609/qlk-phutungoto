import { Database } from './database.types'

type Zone = Database['public']['Tables']['zones']['Row']
type Position = Database['public']['Tables']['positions']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

/**
 * Groups zones and positions based on common numeric suffixes in bin names.
 * This is used for the "Gom ô" (Merge Cells) feature in the warehouse map.
 */
export function groupWarehouseData(zones: Zone[], positions: PositionWithZone[]) {
    // 1. Build lookup maps
    const parentToChildren = new Map<string, Zone[]>()
    zones.forEach(z => {
        if (z.parent_id && z.parent_id !== '') {
            const list = parentToChildren.get(z.parent_id) || []
            list.push(z)
            parentToChildren.set(z.parent_id, list)
        }
    })

    const finalZones: Zone[] = []
    const zoneIdMap = new Map<string, string>() // Old ID -> New Virtual ID
    const processedOldZoneIds = new Set<string>()

    // Recursive helper to find DIRECT children
    const getChildren = (parentId: string): Zone[] => {
        return parentToChildren.get(parentId) || []
    }

    // 2. Recursive function to process zones level by level
    const processZoneRecursively = (zone: Zone) => {
        if (processedOldZoneIds.has(zone.id)) return

        finalZones.push(zone)
        processedOldZoneIds.add(zone.id)

        const children = getChildren(zone.id)
        if (children.length === 0) return

        // Should we group the children of this zone? (Containers like Dãy, Sảnh, Kệ, Khu...)
        // Using a more robust regex for Vietnamese characters
        const isGroupingContainer = /D[ÃãYy]|S[Ảả]nh|K[Ệệ]|KHU|S[Àà]NH|CH[Ũũ]|PH[Òò]NG/i.test(zone.name) || zone.name.toUpperCase().includes('DÃY')

        if (isGroupingContainer) {
            const binGroups: Record<string, Zone[]> = {}
            children.forEach(c => {
                // Extract numeric suffix or standard pattern like A01, B01 -> 01
                const match = c.name.match(/\d+$/)
                const suffix = match ? match[0] : c.name
                binGroups[suffix] = binGroups[suffix] || []
                binGroups[suffix].push(c)
            })

            Object.entries(binGroups).forEach(([suffix, members]) => {
                // Modified: Group if multiple members OR if the name looks like a bin (Ô A01, etc.)
                // This ensures "Ô A01" becomes "Ô 01" even if it's the only one for consistency
                const isBinPattern = members[0].name.toUpperCase().startsWith('Ô ') || members.length > 1

                if (isBinPattern) {
                    // MERGE BIN CASE: Create a virtual bin ("Ô suffix")
                    const vBinId = `v-bin-${zone.id}-${suffix}`
                    finalZones.push({
                        ...members[0],
                        id: vBinId,
                        parent_id: zone.id,
                        name: members.length > 1 || !members[0].name.startsWith('Ô ') ? `Ô ${suffix}` : members[0].name,
                        code: `G${suffix}`
                    })

                    // Now group the "Levels" (Tầng) inside these merged bins
                    const levelGroups: Record<string, Zone[]> = {}
                    members.forEach(m => {
                        const mChildren = getChildren(m.id)
                        mChildren.forEach(lvl => {
                            const key = lvl.name.trim().toUpperCase()
                            levelGroups[key] = levelGroups[key] || []
                            levelGroups[key].push(lvl)
                        })
                        // Also mark original bin as processed
                        processedOldZoneIds.add(m.id)
                        zoneIdMap.set(m.id, vBinId)
                    })

                    // Create Virtual Levels under the Virtual Bin
                    Object.entries(levelGroups).forEach(([lvlName, lMembers]) => {
                        const vLvlId = `v-lvl-${vBinId}-${lvlName}`
                        finalZones.push({
                            ...lMembers[0],
                            id: vLvlId,
                            parent_id: vBinId,
                            name: lMembers[0].name // Keep original name like "Tầng 1"
                        })

                        lMembers.forEach(lm => {
                            zoneIdMap.set(lm.id, vLvlId)
                            processedOldZoneIds.add(lm.id)
                        })
                    })
                } else {
                    // Single bin -> process normally
                    processZoneRecursively(members[0])
                }
            })
        } else {
            // Not a grouping container -> process children normally
            children.forEach(c => processZoneRecursively(c))
        }
    }

    // Process from roots
    const roots = zones.filter(z => !z.parent_id || z.parent_id === '')
    roots.forEach(processZoneRecursively)

    // Safety: any zones missed by recursion
    zones.forEach(z => {
        if (!processedOldZoneIds.has(z.id)) finalZones.push(z)
    })

    // 3. Process Positions — keep each position as an individual cell,
    //    just remap zone_id to the virtual level zone.
    const finalPositions: any[] = []

    positions.forEach(p => {
        const targetZoneId = (p.zone_id && zoneIdMap.get(p.zone_id)) || p.zone_id
        finalPositions.push({
            ...p,
            zone_id: targetZoneId || p.zone_id,
            realIds: [p.id],
            isVirtual: false
        })
    })

    return { zones: finalZones, positions: finalPositions }
}
