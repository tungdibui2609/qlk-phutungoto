import { LocalZone, LocalPosition } from './types'

export interface AncestorZoneInfo {
    id: string
    code: string
    name: string
    level: number
}

/**
 * Get the full chain of ancestors from root down to zoneId
 */
export function getFullAncestorChain(zoneId: string, zones: LocalZone[]): LocalZone[] {
    const chain: LocalZone[] = []
    let curr: LocalZone | undefined = zones.find(z => z.id === zoneId)
    while (curr) {
        chain.unshift(curr)
        const parentId = curr.parent_id
        curr = parentId ? zones.find(z => z.id === parentId) : undefined
    }
    return chain
}

/**
 * Count total positions inside zone and all its descendants
 */
export function countPositionsInTree(
    zoneId: string,
    zones: LocalZone[],
    positionsMap: Record<string, LocalPosition[]>
): number {
    let count = (positionsMap[zoneId] || []).filter(p => p._status !== 'deleted').length
    const children = zones.filter(z => z.parent_id === zoneId && z._status !== 'deleted')
    for (const child of children) {
        count += countPositionsInTree(child.id, zones, positionsMap)
    }
    return count
}

/**
 * Build relative path lookup map for all subzones under rootId.
 * Maps relative code path (e.g. "A01/T1" and "A01.T1") -> LocalZone.
 * Also maps relative name path as fallback.
 */
export function getRelativeSubzoneMap(rootId: string, zones: LocalZone[]): {
    byPath: Map<string, LocalZone>
    byNamePath: Map<string, LocalZone>
    allSubzones: LocalZone[]
} {
    const byPath = new Map<string, LocalZone>()
    const byNamePath = new Map<string, LocalZone>()
    const allSubzones: LocalZone[] = []

    const rootZone = zones.find(z => z.id === rootId)
    if (rootZone) {
        byPath.set('', rootZone)
        byNamePath.set('', rootZone)
        allSubzones.push(rootZone)
    }

    function traverse(parentId: string, currentCodeSegments: string[], currentNameSegments: string[]) {
        const children = zones.filter(z => z.parent_id === parentId && z._status !== 'deleted')
        for (const child of children) {
            allSubzones.push(child)
            const codeSegs = [...currentCodeSegments, (child.code || '').trim().toUpperCase()]
            const nameSegs = [...currentNameSegments, (child.name || '').trim().toUpperCase()]

            const slashPath = codeSegs.join('/')
            const dotPath = codeSegs.join('.')
            const namePath = nameSegs.join('/')

            byPath.set(slashPath, child)
            byPath.set(dotPath, child)
            byNamePath.set(namePath, child)

            traverse(child.id, codeSegs, nameSegs)
        }
    }

    traverse(rootId, [], [])

    return { byPath, byNamePath, allSubzones }
}

export interface PrefixSuggestion {
    label: string
    search: string
    replace: string
    description: string
}

/**
 * Deduce default search and replace prefixes by comparing ancestor chains.
 * Example 1: Kho 2 > Dãy 1 (K2, D1) vs Kho 5 > Dãy 1 (K5, D1) -> K2 -> K5
 * Example 2: Kho 2 > Dãy 1 (K2, D1) vs Kho 2 > Dãy 2 (K2, D2) -> D1 -> D2
 */
export function deducePrefixReplacement(
    sourceChain: LocalZone[],
    targetChain: LocalZone[]
): {
    defaultSearch: string
    defaultReplace: string
    suggestions: PrefixSuggestion[]
} {
    const suggestions: PrefixSuggestion[] = []

    const sourceRoot = sourceChain[0]?.code?.toUpperCase() || ''
    const targetRoot = targetChain[0]?.code?.toUpperCase() || ''

    const sourceLast = sourceChain[sourceChain.length - 1]?.code?.toUpperCase() || ''
    const targetLast = targetChain[targetChain.length - 1]?.code?.toUpperCase() || ''

    const sourceFullConcat = sourceChain.map(z => (z.code || '').toUpperCase()).join('')
    const targetFullConcat = targetChain.map(z => (z.code || '').toUpperCase()).join('')

    const sourceFullDotted = sourceChain.map(z => (z.code || '').toUpperCase()).join('.')
    const targetFullDotted = targetChain.map(z => (z.code || '').toUpperCase()).join('.')

    let defaultSearch = ''
    let defaultReplace = ''

    // 1. Root warehouse differs (e.g. K2 vs K5)
    if (sourceRoot && targetRoot && sourceRoot !== targetRoot) {
        suggestions.push({
            label: `${sourceRoot} ➔ ${targetRoot}`,
            search: sourceRoot,
            replace: targetRoot,
            description: `Đổi tiền tố kho (${sourceChain[0]?.name || sourceRoot} sang ${targetChain[0]?.name || targetRoot})`
        })
    }

    // 2. Full chain differs (e.g. K2D1 vs K5D1 or K2D1 vs K2D2)
    if (sourceFullConcat && targetFullConcat && sourceFullConcat !== targetFullConcat) {
        suggestions.push({
            label: `${sourceFullConcat} ➔ ${targetFullConcat}`,
            search: sourceFullConcat,
            replace: targetFullConcat,
            description: `Đổi chuỗi tiền tố đầy đủ (${sourceFullConcat} sang ${targetFullConcat})`
        })
    }

    // 3. Last zone differs (e.g. D1 vs D2)
    if (sourceLast && targetLast && sourceLast !== targetLast) {
        suggestions.push({
            label: `${sourceLast} ➔ ${targetLast}`,
            search: sourceLast,
            replace: targetLast,
            description: `Đổi mã zone hiện tại (${sourceLast} sang ${targetLast})`
        })
    }

    // Determine default:
    // If root differs and the rest of the chain is identical, default to root (e.g. K2 -> K5)
    if (sourceRoot && targetRoot && sourceRoot !== targetRoot) {
        const sourceRest = sourceChain.slice(1).map(z => z.code?.toUpperCase()).join('')
        const targetRest = targetChain.slice(1).map(z => z.code?.toUpperCase()).join('')
        if (sourceRest === targetRest) {
            defaultSearch = sourceRoot
            defaultReplace = targetRoot
        } else {
            defaultSearch = sourceFullConcat
            defaultReplace = targetFullConcat
        }
    } else if (sourceLast && targetLast && sourceLast !== targetLast) {
        defaultSearch = sourceLast
        defaultReplace = targetLast
    } else {
        defaultSearch = sourceRoot || sourceLast
        defaultReplace = targetRoot || targetLast
    }

    return { defaultSearch, defaultReplace, suggestions }
}

/**
 * Transform position code by replacing searchPrefix with replacePrefix.
 * Prioritizes matching at the start of the string, case-insensitively.
 */
export function transformPositionCode(
    originalCode: string,
    searchPrefix: string,
    replacePrefix: string
): string {
    if (!originalCode) return ''
    const trimmedSearch = searchPrefix.trim()
    const trimmedReplace = replacePrefix.trim().toUpperCase()

    if (!trimmedSearch) return originalCode.toUpperCase()

    const escaped = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // 1. Try match at beginning
    const startRegex = new RegExp(`^${escaped}`, 'i')
    if (startRegex.test(originalCode)) {
        return originalCode.replace(startRegex, trimmedReplace).toUpperCase()
    }

    // 2. Try match anywhere
    const anyRegex = new RegExp(escaped, 'i')
    if (anyRegex.test(originalCode)) {
        return originalCode.replace(anyRegex, trimmedReplace).toUpperCase()
    }

    // 3. Fallback: If not matched, prepend target prefix if not already present
    return `${trimmedReplace}${originalCode}`.toUpperCase()
}

export interface ClonePositionPreviewItem {
    sourceZoneName: string
    sourceZoneCode: string
    targetZoneName: string
    targetZoneCode: string
    targetZoneId: string
    originalCode: string
    newCode: string
    status: 'ok' | 'duplicate_existing' | 'duplicate_batch' | 'unmatched_target'
    statusMessage?: string
}

export interface ClonePositionSummary {
    totalPositionsToClone: number
    matchedSubzonesCount: number
    totalSourceSubzonesCount: number
    unmatchedSubzones: Array<{ name: string; code: string; posCount: number }>
    previewItems: ClonePositionPreviewItem[]
    duplicateCount: number
    canExecute: boolean
}

/**
 * Generate preview and stats for cloning positions from sourceZone to targetZone
 */
export function previewClonePositions(
    sourceZoneId: string,
    targetZoneId: string,
    searchPrefix: string,
    replacePrefix: string,
    zones: LocalZone[],
    positionsMap: Record<string, LocalPosition[]>
): ClonePositionSummary {
    const sourceRelative = getRelativeSubzoneMap(sourceZoneId, zones)
    const targetRelative = getRelativeSubzoneMap(targetZoneId, zones)

    // Collect all existing position codes across all zones (excluding deleted)
    const existingCodes = new Set<string>()
    Object.values(positionsMap).forEach(list => {
        list.forEach(p => {
            if (p._status !== 'deleted' && p.code) {
                existingCodes.add(p.code.toUpperCase())
            }
        })
    })

    const previewItems: ClonePositionPreviewItem[] = []
    const newCodesSeen = new Set<string>()
    let totalPositionsToClone = 0
    let matchedSubzonesCount = 0
    let totalSourceSubzonesWithPos = 0
    const unmatchedSubzones: Array<{ name: string; code: string; posCount: number }> = []
    let duplicateCount = 0

    // Iterate through all source subzones
    sourceRelative.allSubzones.forEach(sZone => {
        const sPositions = (positionsMap[sZone.id] || []).filter(p => p._status !== 'deleted')
        if (sPositions.length === 0) return

        totalSourceSubzonesWithPos++

        // Find relative path of sZone from sourceZoneId
        let sCodePath = ''
        let sNamePath = ''
        if (sZone.id !== sourceZoneId) {
            const chain: string[] = []
            const nameChain: string[] = []
            let curr: LocalZone | undefined = sZone
            while (curr && curr.id !== sourceZoneId) {
                if (curr.code) chain.unshift(curr.code.trim().toUpperCase())
                if (curr.name) nameChain.unshift(curr.name.trim().toUpperCase())
                curr = curr.parent_id ? zones.find(z => z.id === curr?.parent_id) : undefined
            }
            sCodePath = chain.join('/')
            sNamePath = nameChain.join('/')
        }

        // Match in targetRelative
        let tZone: LocalZone | undefined = undefined
        if (sZone.id === sourceZoneId) {
            tZone = zones.find(z => z.id === targetZoneId)
        } else {
            tZone = targetRelative.byPath.get(sCodePath) || targetRelative.byNamePath.get(sNamePath)
        }

        if (!tZone) {
            unmatchedSubzones.push({
                name: sZone.name,
                code: sZone.code,
                posCount: sPositions.length
            })
            // Add items with unmatched status
            sPositions.forEach(p => {
                const newCode = transformPositionCode(p.code, searchPrefix, replacePrefix)
                previewItems.push({
                    sourceZoneName: sZone.name,
                    sourceZoneCode: sZone.code,
                    targetZoneName: '(Không tìm thấy zone đích)',
                    targetZoneCode: '---',
                    targetZoneId: '',
                    originalCode: p.code,
                    newCode,
                    status: 'unmatched_target',
                    statusMessage: 'Không có zone con tương ứng ở kho đích'
                })
            })
            return
        }

        matchedSubzonesCount++
        totalPositionsToClone += sPositions.length

        sPositions.forEach(p => {
            const newCode = transformPositionCode(p.code, searchPrefix, replacePrefix)
            let status: 'ok' | 'duplicate_existing' | 'duplicate_batch' = 'ok'
            let statusMessage: string | undefined = undefined

            if (newCodesSeen.has(newCode)) {
                status = 'duplicate_batch'
                statusMessage = 'Trùng với một vị trí khác trong đợt sao chép này'
                duplicateCount++
            } else if (existingCodes.has(newCode)) {
                // If it's already in the target zone, or another zone
                status = 'duplicate_existing'
                statusMessage = 'Mã vị trí đã tồn tại trong hệ thống'
                duplicateCount++
            }

            newCodesSeen.add(newCode)

            previewItems.push({
                sourceZoneName: sZone.name,
                sourceZoneCode: sZone.code,
                targetZoneName: tZone.name,
                targetZoneCode: tZone.code,
                targetZoneId: tZone.id,
                originalCode: p.code,
                newCode,
                status,
                statusMessage
            })
        })
    })

    return {
        totalPositionsToClone,
        matchedSubzonesCount,
        totalSourceSubzonesCount: totalSourceSubzonesWithPos,
        unmatchedSubzones,
        previewItems,
        duplicateCount,
        canExecute: totalPositionsToClone > 0 && duplicateCount === 0
    }
}
