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
export function groupWarehouseData(zones: Zone[] = [], positions: PositionWithZone[] = []) {
    try {
        if (!zones) zones = []
        if (!positions) positions = []
        // 1. Build lookup maps
        const parentToChildren = new Map<string, Zone[]>()
        zones.forEach(z => {
            if (z && z.parent_id && z.parent_id !== '') {
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
            if (!zone || processedOldZoneIds.has(zone.id)) return

            finalZones.push(zone)
            processedOldZoneIds.add(zone.id)

            const children = getChildren(zone.id)
            if (children.length === 0) return

            // Should we group the children of this zone? (Containers like Dãy, Sảnh, Kệ, Khu...)
            // Using a more robust regex for Vietnamese characters
            const zoneName = zone.name || ''
            const isGroupingContainer = /D[ÃãYy]|S[Ảả]nh|K[Ệệ]|KHU|S[Àà]NH|CH[Ũũ]|PH[Òò]NG/i.test(zoneName) || zoneName.toUpperCase().includes('DÃY')

            if (isGroupingContainer) {
                const binGroups: Record<string, Zone[]> = {}
                children.forEach(c => {
                    // Extract numeric suffix or standard pattern like A01, B01 -> 01
                    const cName = c.name || ''
                    const match = cName.match(/\d+$/)
                    const suffix = match ? match[0] : cName
                    binGroups[suffix] = binGroups[suffix] || []
                    binGroups[suffix].push(c)
                })

                Object.entries(binGroups).forEach(([suffix, members]) => {
                    // Modified: Group if multiple members OR if the name looks like a bin (Ô A01, etc.)
                    // This ensures "Ô A01" becomes "Ô 01" even if it's the only one for consistency
                    const firstMember = members[0]
                    if (!firstMember) return

                    const firstMemberName = firstMember.name || ''
                    const isBinPattern = firstMemberName.toUpperCase().startsWith('Ô ') || members.length > 1

                    if (isBinPattern) {
                        // MERGE BIN CASE: Create a virtual bin ("Ô suffix")
                        const safeSuffix = suffix.replace(/[^a-zA-Z0-9]/g, '_')
                        const vBinId = `v-bin-${zone.id}-${safeSuffix}`
                        
                        finalZones.push({
                            ...firstMember,
                            id: vBinId,
                            parent_id: zone.id,
                            name: members.length > 1 || !firstMemberName.startsWith('Ô ') ? `Ô ${suffix}` : firstMemberName,
                            code: `Ô ${suffix}`
                        })

                        // Now group the "Levels" (Tầng) inside these merged bins
                        const levelGroups: Record<string, Zone[]> = {}
                        members.forEach(m => {
                            const mChildren = getChildren(m.id)
                            mChildren.forEach(lvl => {
                                const lvlName = lvl.name || ''
                                const key = lvlName.trim().toUpperCase()
                                levelGroups[key] = levelGroups[key] || []
                                levelGroups[key].push(lvl)
                            })
                            // Also mark original bin as processed
                            processedOldZoneIds.add(m.id)
                            zoneIdMap.set(m.id, vBinId)
                        })

                        // Create Virtual Levels under the Virtual Bin
                        Object.entries(levelGroups).forEach(([lvlName, lMembers]) => {
                            const firstLvl = lMembers[0]
                            if (!firstLvl) return

                            const safeLvlName = lvlName.replace(/[^a-zA-Z0-9]/g, '_')
                            const vLvlId = `v-lvl-${vBinId}-${safeLvlName}`
                            finalZones.push({
                                ...firstLvl,
                                id: vLvlId,
                                parent_id: vBinId,
                                name: firstLvl.name // Keep original name like "Tầng 1"
                            })

                            lMembers.forEach(lm => {
                                zoneIdMap.set(lm.id, vLvlId)
                                processedOldZoneIds.add(lm.id)
                            })
                        })
                    } else {
                        // Single bin -> process normally
                        processZoneRecursively(firstMember)
                    }
                })
            } else {
                // Not a grouping container -> process children normally
                children.forEach(c => processZoneRecursively(c))
            }
        }

        // Process from roots
        const roots = zones.filter(z => z && (!z.parent_id || z.parent_id === ''))
        roots.forEach(processZoneRecursively)

        // Safety: any zones missed by recursion
        zones.forEach(z => {
            if (z && !processedOldZoneIds.has(z.id)) finalZones.push(z)
        })

        // 3. Process Positions — keep each position as an individual cell,
        //    just remap zone_id to the virtual level zone.
        const finalPositions: any[] = []

        positions.forEach(p => {
            if (!p) return
            const targetZoneId = (p.zone_id && zoneIdMap.get(p.zone_id)) || p.zone_id
            finalPositions.push({
                ...p,
                zone_id: targetZoneId || p.zone_id,
                realIds: [p.id],
                isVirtual: false
            })
        })

        return { zones: finalZones, positions: finalPositions }
    } catch (error) {
        console.error('Error in groupWarehouseData:', error)
        // If it fails, at least return original data so it doesn't break the whole app
        return { zones, positions }
    }
}
/**
 * Utility to generate CSS styles for product colors (supports multiple colors with gradients)
 */
export function getProductColorStyle(pColor: string | null | undefined, opacity: string = '') {
    if (!pColor) return { backgroundColor: '#5c4033', backgroundImage: 'none' }; // Default brown

    const colors = pColor.split(',').map((c: string) => c.trim()).filter(Boolean);
    
    if (colors.length > 1) {
        // Generate automatic stops based on number of colors
        const stops = colors.map((c, i) => {
            const start = (i / colors.length) * 100;
            const end = ((i + 1) / colors.length) * 100;
            const finalC = opacity && c.startsWith('#') && c.length === 7 ? `${c}${opacity}` : c;
            return `${finalC} ${start}%, ${finalC} ${end}%`;
        }).join(', ');
        
        return {
            backgroundImage: `linear-gradient(135deg, ${stops})`,
            backgroundColor: colors[0] // Fallback
        };
    }
    
    const finalColor = opacity && pColor.startsWith('#') && pColor.length === 7 ? `${pColor}${opacity}` : pColor;
    return {
        backgroundColor: finalColor,
        backgroundImage: 'none'
    };
}

/**
 * Parses a position code like "K1D1A10T101" into hierarchical parts.
 * Structure: K[Kho] D[Dãy] [Ô] T[Tầng][Index]
 * Example: K1D1A10T101 -> { warehouse: "Kho 1", row: "Dãy 1", bin: "Ô A10", level: "Tầng 1" }
 */
export function parsePositionCodeFallback(code: string) {
    if (!code) return null;
    
    // Pattern: K(\d+)D(\d+)([A-Z]\d+)T(\d+)
    const match = code.match(/^K(\d+)D(\d+)([A-Z]\d+|[\u00C0-\u1EF9A-Z]+\d+)T(\d+)/i);
    if (!match) return null;

    const [_, k, d, bin, t] = match;
    
    // T101 -> Tầng 1 (first digit), 01 (last 1-2 digits)
    const levelDigit = t.charAt(0);
    const subPos = t.length >= 2 ? t.slice(-2) : t.padStart(2, '0');

    return {
        warehouse: `Kho ${k}`,
        row: `Dãy ${d}`,
        bin: `Ô ${bin.toUpperCase()}`,
        level: `Tầng ${levelDigit}`,
        subPosition: subPos
    };
}
