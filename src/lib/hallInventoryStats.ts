import { canonicalizeUnit } from './unitConversion'

/**
 * Gom cụm sản phẩm theo TỪNG khu sảnh cho màn hình kiểm kê nội bộ.
 * Logic thuần, không đụng Supabase, để test được độc lập với trang.
 */

export interface HallGroup {
    groupKey: string
    sku: string
    name: string
    quantity: number
    unit: string
    tag: string
    count: number
    positionIds: string[]
    checkedCount: number
    notes: string[]
}

export interface HallScope {
    id: string
    name: string
    /** Số ô đang chứa lô trong phạm vi này — các sảnh cộng đúng bằng tab tổng. */
    positionCount: number
    groups: HallGroup[]
}

export interface HallZoneLike {
    id: string
    name?: string | null
    code?: string | null
    parent_id?: string | null
    is_hall?: boolean | null
    display_order?: number | null
}

export interface HallPositionLike {
    id: string
    zone_id?: string | null
    lot_id?: string | null
}

export interface HallLotLike {
    items?: { sku?: string | null, product_name?: string | null, quantity?: number | null, unit?: string | null }[] | null
    tags?: string[] | null
}

export interface HallItemResultLike {
    checked?: boolean | null
    note?: string | null
}

export const HALL_ALL_TAB_ID = 'all'

/** Thứ tự khu vực khớp sơ đồ kho: display_order trước, rồi so tên kiểu tự nhiên (SẢNH 2 < SẢNH 10). */
function compareHallOrder(a: HallZoneLike, b: HallZoneLike): number {
    if ((a.display_order ?? 0) !== (b.display_order ?? 0)) {
        return (a.display_order ?? 0) - (b.display_order ?? 0)
    }
    return (a.name || '').localeCompare(b.name || '', undefined, { numeric: true })
}

/**
 * Sảnh "đầu ngành" = khu `is_hall` mà cha không phải sảnh. Nhờ vậy mỗi vị trí chỉ thuộc MỘT sảnh
 * (sảnh lồng sảnh thì gộp vào sảnh ngoài cùng) và số từng sảnh cộng ra đúng số tổng.
 */
export function hallRootsInScope(zones: HallZoneLike[], scopeIds: string[]): HallZoneLike[] {
    const byId = new Map(zones.map(z => [z.id, z]))
    const inScope = new Set(scopeIds)
    return zones
        .filter(z => z.is_hall && inScope.has(z.id) && !byId.get(z.parent_id || '')?.is_hall)
        .sort(compareHallOrder)
}

/** Sảnh đầu ngành gần nhất chứa `zoneId` (đi lên hết chuỗi cha), hoặc null nếu zone không nằm trong sảnh nào. */
export function topHallOfZone(zones: HallZoneLike[], zoneId?: string | null): string | null {
    const byId = new Map(zones.map(z => [z.id, z]))
    let curr = zoneId || null
    let found: string | null = null
    const seen = new Set<string>()
    while (curr && !seen.has(curr)) {
        seen.add(curr)
        const z = byId.get(curr)
        if (!z) break
        if (z.is_hall) found = z.id
        curr = z.parent_id || null
    }
    return found
}

export function buildHallStats(opts: {
    zones: HallZoneLike[]
    positions: HallPositionLike[]
    lotInfo: Record<string, HallLotLike | undefined>
    itemsMap: Record<string, HallItemResultLike | undefined>
    scopeIds: string[]
}): { halls: HallScope[], all: HallScope | null } {
    const { zones, positions, lotInfo, itemsMap, scopeIds } = opts
    const hallsInScope = hallRootsInScope(zones, scopeIds)

    const byHall: Record<string, Record<string, HallGroup>> = {}
    const positionCountByHall: Record<string, number> = {}
    const allGroups: Record<string, HallGroup> = {}

    const addTo = (groups: Record<string, HallGroup>, groupKey: string, sku: string, name: string, quantity: number, unit: string, tag: string, positionId: string, checked: boolean, note: string | null) => {
        const existing = groups[groupKey]
        if (!existing) {
            groups[groupKey] = { groupKey, sku, name, quantity, unit, tag, count: 1, positionIds: [positionId], checkedCount: checked ? 1 : 0, notes: note ? [note] : [] }
        } else {
            existing.count++
            existing.positionIds.push(positionId)
            if (checked) existing.checkedCount++
            if (note) existing.notes.push(note)
        }
    }

    positions.forEach(p => {
        const hallId = topHallOfZone(zones, p.zone_id)
        if (!hallId || !scopeIds.includes(hallId)) return
        const lot = p.lot_id ? lotInfo[p.lot_id] : null
        if (!lot?.items) return
        const res = itemsMap[p.id] || {}
        positionCountByHall[hallId] = (positionCountByHall[hallId] || 0) + 1
        lot.items.forEach(it => {
            const tag = lot.tags?.[0] || ''
            const quantity = it.quantity ?? 0
            const groupKey = `${canonicalizeUnit(it.sku || '')}|${quantity}|${canonicalizeUnit(it.unit || '')}|${tag}`
            if (!byHall[hallId]) byHall[hallId] = {}
            addTo(byHall[hallId], groupKey, it.sku || '', it.product_name || '', quantity, it.unit || '', tag, p.id, Boolean(res.checked), res.note || null)
            addTo(allGroups, groupKey, it.sku || '', it.product_name || '', quantity, it.unit || '', tag, p.id, Boolean(res.checked), res.note || null)
        })
    })

    const bySku = (a: HallGroup, b: HallGroup) => (a.sku || '').localeCompare(b.sku || '')
    const halls: HallScope[] = hallsInScope.map(z => ({
        id: z.id,
        name: z.name || z.code || 'Sảnh',
        positionCount: positionCountByHall[z.id] || 0,
        groups: Object.values(byHall[z.id] || {}).sort(bySku)
    }))
    const all: HallScope | null = halls.length > 0 ? {
        id: HALL_ALL_TAB_ID,
        name: 'Tất cả sảnh',
        positionCount: halls.reduce((s, h) => s + h.positionCount, 0),
        groups: Object.values(allGroups).sort(bySku)
    } : null

    return { halls, all }
}
