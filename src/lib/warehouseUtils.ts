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

        // 4. Build Virtual to Real mapping for filtering support
        const virtualToRealMap = new Map<string, string[]>()
        zoneIdMap.forEach((vId, realId) => {
            const list = virtualToRealMap.get(vId) || []
            list.push(realId)
            virtualToRealMap.set(vId, list)
        })

        return { 
            zones: finalZones, 
            positions: finalPositions, 
            virtualToRealMap 
        }
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

/**
 * Lấy 2 số cuối cùng của mã vị trí làm số thứ tự vị trí (subPosition).
 * Ví dụ: K1D1A10T101 -> "01", K1D1C10T102 -> "02", A10-1-01 -> "01", A10-1 -> "01"
 */
export function extractSubPosition(code?: string | null): string {
    if (!code) return '';
    const trimmed = code.trim();
    // Tìm cụm số ở cuối mã (hoặc trước bất kỳ ký tự không phải số nào ở đuôi)
    const match = trimmed.match(/(\d+)[^\d]*$/);
    if (match) {
        const digits = match[1];
        return digits.length >= 2 ? digits.slice(-2) : digits.padStart(2, '0');
    }
    return '';
}

/**
 * Sorts positions by Bin-priority (Tier -> Bin -> Row).
 * Pattern: K1S1A01T101
 * Priority: 1. Tier (T101), 2. Bin (01), 3. Row (A)
 */
export function sortPositionsByBinPriority<T extends { code?: string | null }>(positions: T[]): T[] {
    return [...positions].sort((a, b) => {
        const codeA = a.code || ''
        const codeB = b.code || ''

        const matchA = codeA.match(/^(.+?)([A-Z]+)(\d+)T(\d+)$/i)
        const matchB = codeB.match(/^(.+?)([A-Z]+)(\d+)T(\d+)$/i)

        if (matchA && matchB) {
            const [_a, prefA, rowA, binA, tierA] = matchA
            const [_b, prefB, rowB, binB, tierB] = matchB

            const tA = parseInt(tierA, 10), tB = parseInt(tierB, 10)
            if (tA !== tB) {
                // Split into Level and Sub-position (Assuming T[Level][SubPos] where SubPos is 2 digits)
                const lvlA = Math.floor(tA / 100), lvlB = Math.floor(tB / 100)
                if (lvlA !== lvlB) return lvlA - lvlB // Keep original level order (ascending)
                
                const subA = tA % 100, subB = tB % 100
                return subB - subA // Reverse sub-position (e.g., 02 on top, 01 on bottom)
            }

            const bA = parseInt(binA, 10), bB = parseInt(binB, 10)
            if (bA !== bB) return bA - bB

            if (rowA !== rowB) return rowA.localeCompare(rowB)
            return prefA.localeCompare(prefB)
        }

        return codeA.localeCompare(codeB, undefined, { numeric: true })
    })
}

export interface DetailedPositionInfo {
    warehouse: string
    row: string
    rowNumber: number
    bin: string
    binNumber: number
    level: string
    levelNumber: number
    side: string
    subPosition: string
    groupBinTierKey: string
    groupBinTierLabel: string
    groupBinKey: string
    groupBinLabel: string
    groupTierKey: string
    groupTierLabel: string
    slotLabel: string
}

/**
 * Phân tích mã vị trí và zone thành thông tin chi tiết có cấu trúc
 * Ví dụ: K1D1A11T201 -> Kho 1, Dãy 1, Ô 11, Tầng 2, Mặt A, Vị trí 01
 */
export function parseDetailedPositionInfo(
    code: string,
    zoneId?: string | null,
    zoneMap?: Map<string, any> | Record<string, any>
): DetailedPositionInfo {
    let warehouse = ''
    let row = ''
    let rowNumber = 9999
    let bin = ''
    let binNumber = 9999
    let level = ''
    let levelNumber = 9999
    let side = ''
    let subPosition = ''

    // 1. Phân tích phả hệ zone nếu có
    if (zoneId && zoneMap) {
        const getZone = (id: string) => zoneMap instanceof Map ? zoneMap.get(id) : zoneMap[id]
        let curr = getZone(zoneId)
        const chain: any[] = []
        const seen = new Set<string>()
        while (curr && !seen.has(curr.id)) {
            seen.add(curr.id)
            chain.unshift(curr)
            curr = curr.parent_id ? getZone(curr.parent_id) : null
        }
        if (chain.length > 0) warehouse = chain[0]?.name || ''
        if (chain.length > 1) {
            row = chain[1]?.name || ''
            const matchRow = row.match(/\d+/)
            if (matchRow) rowNumber = parseInt(matchRow[0], 10)
        }
        // Tìm Tầng và Ô trong phả hệ zone
        for (const z of chain) {
            const zName = z?.name || ''
            const matchTier = zName.match(/T[ẦAÀẢÃẠ]NG\s*(\d+)/i)
            if (matchTier) {
                levelNumber = parseInt(matchTier[1], 10)
                level = `Tầng ${levelNumber}`
            }
            const matchBin = zName.match(/Ô\s*(\d+)/i)
            if (matchBin) {
                binNumber = parseInt(matchBin[1], 10)
                bin = `Ô ${binNumber < 10 ? '0' + binNumber : binNumber}`
            }
        }
    }

    // 2. Phân tích mã vị trí
    const cleanCode = (code || '').trim()

    // Mẫu 1: K1D1A11T201 hoặc K1S1A01T101
    const p1 = cleanCode.match(/^K(\d+)([DSds])(\d+)([A-Za-z]*)(\d+)T(\d+)/i)
    if (p1) {
        const [_, k, type, d, s, b, t] = p1
        if (!warehouse) warehouse = `Kho ${k}`
        const isSanh = type.toUpperCase() === 'S'
        if (!row || row === 'Khu vực chung') {
            row = isSanh ? `Sảnh ${d}` : `Dãy ${d}`
        }
        rowNumber = parseInt(d, 10)
        binNumber = parseInt(b, 10)
        bin = `Ô ${binNumber < 10 ? '0' + binNumber : binNumber}`
        side = s ? s.toUpperCase() : ''

        const tNum = parseInt(t, 10)
        const parsedLvl = Math.floor(tNum / 100) || parseInt(t.charAt(0), 10)
        if (levelNumber === 9999) {
            levelNumber = parsedLvl
            level = `Tầng ${levelNumber}`
        }
        const sub = tNum % 100
        subPosition = String(sub).padStart(2, '0')
    } else {
        // Mẫu 2: D1A11T201 hoặc S1A11T201
        const p2 = cleanCode.match(/^([DSds])(\d+)([A-Za-z]*)(\d+)T(\d+)/i)
        if (p2) {
            const [_, type, d, s, b, t] = p2
            const isSanh = type.toUpperCase() === 'S'
            if (!row || row === 'Khu vực chung') {
                row = isSanh ? `Sảnh ${d}` : `Dãy ${d}`
            }
            rowNumber = parseInt(d, 10)
            binNumber = parseInt(b, 10)
            bin = `Ô ${binNumber < 10 ? '0' + binNumber : binNumber}`
            side = s ? s.toUpperCase() : ''
            const tNum = parseInt(t, 10)
            const parsedLvl = Math.floor(tNum / 100) || parseInt(t.charAt(0), 10)
            if (levelNumber === 9999) {
                levelNumber = parsedLvl
                level = `Tầng ${levelNumber}`
            }
            subPosition = String(tNum % 100).padStart(2, '0')
        } else {
            // Mẫu 3: A11T201
            const p3 = cleanCode.match(/^([A-Za-z]+)(\d+)T(\d+)/i)
            if (p3) {
                const [_, s, b, t] = p3
                side = s.toUpperCase()
                binNumber = parseInt(b, 10)
                bin = `Ô ${binNumber < 10 ? '0' + binNumber : binNumber}`
                const tNum = parseInt(t, 10)
                const parsedLvl = Math.floor(tNum / 100) || parseInt(t.charAt(0), 10)
                if (levelNumber === 9999) {
                    levelNumber = parsedLvl
                    level = `Tầng ${levelNumber}`
                }
                subPosition = String(tNum % 100).padStart(2, '0')
            } else {
                // Fallback trích xuất subPosition và Tầng từ chuỗi
                subPosition = extractSubPosition(cleanCode) || '01'
                const matchLvl = cleanCode.match(/T(\d+)/i)
                if (matchLvl && levelNumber === 9999) {
                    levelNumber = parseInt(matchLvl[1].charAt(0), 10)
                    level = `Tầng ${levelNumber}`
                }
            }
        }
    }

    if (!row) row = 'Khu vực chung'
    if (!bin) bin = cleanCode ? `Ô ${cleanCode.slice(0, 4)}` : 'Ô chung'
    if (!level) level = levelNumber !== 9999 ? `Tầng ${levelNumber}` : 'Tầng 1'
    if (levelNumber === 9999) levelNumber = 1

    const slotLabelParts: string[] = []
    if (side) slotLabelParts.push(`Mặt ${side}`)
    if (subPosition) slotLabelParts.push(`Vị trí ${subPosition}`)
    const slotLabel = slotLabelParts.join(' - ') || cleanCode

    const rowPrefix = row && row !== 'Khu vực chung' ? `${row} • ` : ''
    const groupBinTierKey = `${row}_Bin${binNumber}_Lvl${levelNumber}`
    const groupBinTierLabel = `${rowPrefix}${bin} • ${level}`

    const groupBinKey = `${row}_Bin${binNumber}`
    const groupBinLabel = `${rowPrefix}${bin}`

    const groupTierKey = `${level}`
    const groupTierLabel = `${level}`

    return {
        warehouse,
        row,
        rowNumber,
        bin,
        binNumber,
        level,
        levelNumber,
        side,
        subPosition,
        groupBinTierKey,
        groupBinTierLabel,
        groupBinKey,
        groupBinLabel,
        groupTierKey,
        groupTierLabel,
        slotLabel
    }
}

/**
 * Hàm so sánh 2 vị trí theo thứ tự tự nhiên của kho:
 * Dãy -> Ô -> Tầng -> Mặt (A/B) -> Vị trí con (01, 02)
 * Đảm bảo các ô trong cùng 1 Tầng của cùng 1 Ô luôn đứng liền kề nhau, không bị nhảy lung tung.
 */
export function comparePositionsByBinAndLevel(a: any, b: any, zoneMap?: any): number {
    const infoA = parseDetailedPositionInfo(a?.code || '', a?.zone_id, zoneMap)
    const infoB = parseDetailedPositionInfo(b?.code || '', b?.zone_id, zoneMap)

    // 1. Dãy / Row (Dãy 1 trước Dãy 2)
    if (infoA.rowNumber !== infoB.rowNumber) {
        return infoA.rowNumber - infoB.rowNumber
    }
    if (infoA.row !== infoB.row) {
        const rowCmp = infoA.row.localeCompare(infoB.row, undefined, { numeric: true })
        if (rowCmp !== 0) return rowCmp
    }

    // 2. Ô / Bin (Ô 11 trước Ô 12)
    if (infoA.binNumber !== infoB.binNumber) {
        return infoA.binNumber - infoB.binNumber
    }
    if (infoA.bin !== infoB.bin) {
        const binCmp = infoA.bin.localeCompare(infoB.bin, undefined, { numeric: true })
        if (binCmp !== 0) return binCmp
    }

    // 3. Tầng / Level (Tầng 1 trước Tầng 2, Tầng 3)
    if (infoA.levelNumber !== infoB.levelNumber) {
        return infoA.levelNumber - infoB.levelNumber
    }
    if (infoA.level !== infoB.level) {
        const lvlCmp = infoA.level.localeCompare(infoB.level, undefined, { numeric: true })
        if (lvlCmp !== 0) return lvlCmp
    }

    // 4. Vị trí con / SubPosition (Hàng trên trước: 02 trước 01, khớp chính xác thứ tự hiển thị ô trên sơ đồ kho)
    const subNumA = parseInt(infoA.subPosition, 10) || 0
    const subNumB = parseInt(infoB.subPosition, 10) || 0
    if (subNumA !== subNumB) {
        return subNumB - subNumA // 02 trước, 01 sau (hàng trên -> hàng dưới)
    }

    // 5. Mặt / Cột con / Side (Từ trái qua phải: Mặt A -> Mặt B -> Mặt C)
    if (infoA.side !== infoB.side) {
        return infoA.side.localeCompare(infoB.side)
    }

    return (a?.code || '').localeCompare(b?.code || '', undefined, { numeric: true })
}

/**
 * Sắp xếp danh sách vị trí theo thứ tự Ô và Tầng chuẩn xác
 */
export function sortPositionsByBinAndLevel<T extends { code?: string | null, zone_id?: string | null }>(
    positions: T[],
    zoneMap?: any
): T[] {
    return [...positions].sort((a, b) => comparePositionsByBinAndLevel(a, b, zoneMap))
}

