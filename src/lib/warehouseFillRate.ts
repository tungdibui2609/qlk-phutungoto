// Tính tỉ lệ lấp đầy theo ô vị trí (số ô có LOT / tổng số ô), TÁCH BẠCH hai loại khu vực:
//   - LÔ KỆ  : vị trí được quy hoạch, là chỉ số quyết định nhập/xuất và sức chứa.
//   - SẢNH   : khu tạm kết, không quy hoạch thành vị trí nên không được trộn vào chỉ số lô kệ.
// Logic độc lập với Supabase để unit test và đối soát trực tiếp với trang /warehouses/status.

export interface FillZoneLike {
    id: string
    code?: string | null
    name?: string | null
    parent_id?: string | null
    level?: number | null
    is_hall?: boolean | null
    display_order?: number | null
}

export interface FillPositionLike {
    id: string
    lot_id?: string | null
    zone_id?: string | null
}

export type FillScope = 'rack' | 'hall' | 'all'

export interface FillBucket {
    positions: number
    occupied: number
    free: number
    pct: number
}

export interface ZoneFillStat {
    zoneId: string
    label: string
    code: string
    displayOrder: number | null
    level: number
    parentId: string | null
    childCount: number
    isHall: boolean
    ownRackPositions: number
    ownRackOccupied: number
    ownHallPositions: number
    ownHallOccupied: number
    rackPositions: number
    rackOccupied: number
    hallPositions: number
    hallOccupied: number
    /** Tỉ lệ lấp đầy Lô kệ của cả subtree — chỉ số chính. */
    pct: number
    hallPct: number
}

export interface FillStats {
    byZone: Map<string, ZoneFillStat>
    roots: ZoneFillStat[]
    hallRoots: ZoneFillStat[]
    unassignedPositions: number
    unassignedOccupied: number
    totals: { rack: FillBucket; hall: FillBucket; all: FillBucket }
}

export const CRITICAL_FILL_PCT = 90
export const HIGH_FILL_PCT = 70

export type FillLevel = 'critical' | 'high' | 'normal' | 'empty'

export function classifyFill(pct: number): FillLevel {
    if (pct >= CRITICAL_FILL_PCT) return 'critical'
    if (pct >= HIGH_FILL_PCT) return 'high'
    if (pct > 0) return 'normal'
    return 'empty'
}

export function fillPct(occupied: number, positions: number): number {
    if (positions <= 0) return 0
    return (occupied / positions) * 100
}

function bucket(positions: number, occupied: number): FillBucket {
    return { positions, occupied, free: positions - occupied, pct: fillPct(occupied, positions) }
}

function zoneLabel(zone: FillZoneLike): string {
    return (zone.name || zone.code || '(không tên)').trim()
}

/**
 * Thứ tự hiển thị khu vực = đúng như sơ đồ kho: `display_order` trước, bằng nhau thì so mã
 * kiểu tự nhiên để KHO 2 đứng trước KHO 10. Cùng comparator với WarehouseStatusMap đang dùng.
 */
export function compareZoneOrder(a: ZoneFillStat, b: ZoneFillStat): number {
    const oa = a.displayOrder ?? 0
    const ob = b.displayOrder ?? 0
    if (oa !== ob) return oa - ob
    return a.code.localeCompare(b.code, undefined, { numeric: true })
}

/**
 * Nhận diện khu SẢNH: cờ `is_hall` hoặc tên khu (của chính nó / tổ tiên) bắt đầu hoặc chứa
 * "SẢNH"/"SÀNH"/"SANH". Giống hệt quy tắc trang /warehouses/status đang dùng để chia ô Lô kệ - Sảnh.
 */
export function buildHallDetector(zones: FillZoneLike[]): (zoneId?: string | null) => boolean {
    const byId = new Map(zones.map(z => [z.id, z]))

    return (zoneId?: string | null): boolean => {
        let currentId = zoneId || null
        const seen = new Set<string>()
        while (currentId && !seen.has(currentId)) {
            seen.add(currentId)
            const zone = byId.get(currentId)
            if (!zone) return false
            if (zone.is_hall) return true
            const nameUpper = (zone.name || '').trim().toUpperCase()
            if (
                nameUpper.startsWith('SẢNH') ||
                nameUpper.startsWith('SÀNH') ||
                nameUpper.startsWith('SANH') ||
                nameUpper.includes('SẢNH') ||
                nameUpper.includes('SÀNH')
            ) return true
            currentId = zone.parent_id || null
        }
        return false
    }
}

/**
 * Gán mỗi vị trí vào zone gần nhất của nó. Một vị trí chỉ thuộc một zone trong thống kê
 * này (theo đúng cách trang /warehouses/status dựng sơ đồ).
 */
export function buildZoneLookup(links: Array<{ zone_id?: string | null; position_id?: string | null }>): Map<string, string> {
    const lookup = new Map<string, string>()
    for (const link of links) {
        if (link.position_id && link.zone_id) lookup.set(link.position_id, link.zone_id)
    }
    return lookup
}

interface OwnCounters {
    rackPositions: number
    rackOccupied: number
    hallPositions: number
    hallOccupied: number
}

export function buildFillStats(
    zones: FillZoneLike[],
    positions: FillPositionLike[]
): FillStats {
    const zoneIds = new Set(zones.map(z => z.id))
    const isHallZoneId = buildHallDetector(zones)

    const ownStats = new Map<string, OwnCounters>()
    let unassignedPositions = 0
    let unassignedOccupied = 0
    let rackPositions = 0
    let rackOccupied = 0
    let hallPositions = 0
    let hallOccupied = 0

    for (const position of positions) {
        const isOccupied = !!position.lot_id
        const zoneId = position.zone_id && zoneIds.has(position.zone_id) ? position.zone_id : null
        // Vị trí chưa gán khu vực được tính là Lô kệ, giống cách trang trạng thái kho phân loại.
        const isHallPosition = !!zoneId && isHallZoneId(zoneId)

        if (isHallPosition) {
            hallPositions++
            if (isOccupied) hallOccupied++
        } else {
            rackPositions++
            if (isOccupied) rackOccupied++
        }

        if (!zoneId) {
            unassignedPositions++
            if (isOccupied) unassignedOccupied++
            continue
        }

        const counters = ownStats.get(zoneId) || { rackPositions: 0, rackOccupied: 0, hallPositions: 0, hallOccupied: 0 }
        if (isHallPosition) {
            counters.hallPositions++
            if (isOccupied) counters.hallOccupied++
        } else {
            counters.rackPositions++
            if (isOccupied) counters.rackOccupied++
        }
        ownStats.set(zoneId, counters)
    }

    // Cây zone: cha -> con; zone có cha không tồn tại được coi là gốc.
    const childrenOf = new Map<string, string[]>()
    const rootZoneIds: string[] = []
    for (const zone of zones) {
        const parentId = zone.parent_id && zoneIds.has(zone.parent_id) ? zone.parent_id : null
        if (parentId) {
            const siblings = childrenOf.get(parentId) || []
            siblings.push(zone.id)
            childrenOf.set(parentId, siblings)
        } else {
            rootZoneIds.push(zone.id)
        }
    }

    const rollupCache = new Map<string, OwnCounters>()
    const visiting = new Set<string>()

    // Dữ liệu zone hỏng (quan hệ vòng lặp) thì nhánh quay lại điểm đang xét coi như không đóng góp.
    const rollup = (zoneId: string): OwnCounters => {
        const cached = rollupCache.get(zoneId)
        if (cached) return { ...cached }
        if (visiting.has(zoneId)) return { rackPositions: 0, rackOccupied: 0, hallPositions: 0, hallOccupied: 0 }

        visiting.add(zoneId)
        const own = ownStats.get(zoneId) || { rackPositions: 0, rackOccupied: 0, hallPositions: 0, hallOccupied: 0 }
        const agg: OwnCounters = { ...own }
        for (const childId of childrenOf.get(zoneId) || []) {
            const child = rollup(childId)
            agg.rackPositions += child.rackPositions
            agg.rackOccupied += child.rackOccupied
            agg.hallPositions += child.hallPositions
            agg.hallOccupied += child.hallOccupied
        }
        visiting.delete(zoneId)
        rollupCache.set(zoneId, agg)
        return agg
    }

    const byZone = new Map<string, ZoneFillStat>()
    for (const zone of zones) {
        const own = ownStats.get(zone.id) || { rackPositions: 0, rackOccupied: 0, hallPositions: 0, hallOccupied: 0 }
        const total = rollup(zone.id)
        const parentId = zone.parent_id && zoneIds.has(zone.parent_id) ? zone.parent_id : null
        byZone.set(zone.id, {
            zoneId: zone.id,
            label: zoneLabel(zone),
            code: (zone.code || '').trim(),
            displayOrder: zone.display_order ?? null,
            level: zone.level ?? 0,
            parentId,
            childCount: (childrenOf.get(zone.id) || []).length,
            isHall: isHallZoneId(zone.id),
            ownRackPositions: own.rackPositions,
            ownRackOccupied: own.rackOccupied,
            ownHallPositions: own.hallPositions,
            ownHallOccupied: own.hallOccupied,
            rackPositions: total.rackPositions,
            rackOccupied: total.rackOccupied,
            hallPositions: total.hallPositions,
            hallOccupied: total.hallOccupied,
            pct: fillPct(total.rackOccupied, total.rackPositions),
            hallPct: fillPct(total.hallOccupied, total.hallPositions)
        })
    }

    const roots = rootZoneIds.map(id => byZone.get(id)).filter((s): s is ZoneFillStat => !!s)

    // Cấp sảnh hiển thị ngay: chỉ khu sảnh "đầu ngành" (cha không phải sảnh) để không lồng nhau.
    const hallRoots = Array.from(byZone.values())
        .filter(z => z.isHall && z.hallPositions > 0 && !(z.parentId && byZone.get(z.parentId)?.isHall))
        .sort(compareZoneOrder)

    return {
        byZone,
        roots,
        hallRoots,
        unassignedPositions,
        unassignedOccupied,
        totals: {
            rack: bucket(rackPositions, rackOccupied),
            hall: bucket(hallPositions, hallOccupied),
            all: bucket(rackPositions + hallPositions, rackOccupied + hallOccupied)
        }
    }
}

function scopeCounters(stat: ZoneFillStat, scope: FillScope) {
    if (scope === 'hall') return { positions: stat.hallPositions, occupied: stat.hallOccupied }
    if (scope === 'all') {
        return { positions: stat.rackPositions + stat.hallPositions, occupied: stat.rackOccupied + stat.hallOccupied }
    }
    return { positions: stat.rackPositions, occupied: stat.rackOccupied }
}

/**
 * Bộ số của MỘT khu vực theo tab đang xem. Tab Tổng cộng Lô kệ + Sảnh để đối soát
 * với trang /warehouses/status; tab Lô kệ và tab Sảnh luôn đọc hai bộ đếm riêng.
 */
export function metricsOf(row: ZoneFillStat, scope: FillScope): FillBucket {
    const { positions, occupied } = scopeCounters(row, scope)
    return bucket(positions, occupied)
}

/** Bộ số tính RIÊNG khu vực đó (không cộng subtree) — dùng cho dòng "Riêng khu này". */
export function ownMetricsOf(row: ZoneFillStat, scope: FillScope): FillBucket {
    if (scope === 'hall') return bucket(row.ownHallPositions, row.ownHallOccupied)
    if (scope === 'all') {
        return bucket(row.ownRackPositions + row.ownHallPositions, row.ownRackOccupied + row.ownHallOccupied)
    }
    return bucket(row.ownRackPositions, row.ownRackOccupied)
}

/**
 * Cấp hiển thị tiếp theo: khu vực con của `parentId` (hoặc gốc khi `null`), lọc theo phạm vi
 * Lô kệ / Sảnh / Tổng và giữ đúng thứ tự sơ đồ kho (display_order → so mã tự nhiên).
 */
export function childStatsOf(stats: FillStats, parentId: string | null, scope: FillScope = 'rack'): ZoneFillStat[] {
    const base = parentId === null ? stats.roots : Array.from(stats.byZone.values()).filter(z => z.parentId === parentId)

    // Tab Lô kệ chỉ khu không phải sảnh, tab Sảnh chỉ khu sảnh — giữ nguyên tách bạch,
    // khu có 0 ô trong phạm vi đó bị ẩn để không nhiễu danh sách.
    const filtered = base.filter(z => {
        if (scope === 'all') return metricsOf(z, 'all').positions > 0
        if (scope === 'hall') return z.isHall && z.hallPositions > 0
        return !z.isHall && z.rackPositions > 0
    })

    return [...filtered].sort(compareZoneOrder)
}

/**
 * Danh sách cho tab đang xem. Tab Sảnh phải bắt đầu từ các khu sảnh "đầu ngành" vì khu sảnh
 * thường là con của một kho (không phải sảnh) nên childStatsOf từ gốc sẽ trả về rỗng.
 */
export function rowsForScope(stats: FillStats, parentId: string | null, scope: FillScope): ZoneFillStat[] {
    if (scope === 'hall' && parentId === null) return stats.hallRoots
    return childStatsOf(stats, parentId, scope)
}

/** Số khu vực con còn lại có thể đi xuống trong phạm vi đang xem. */
export function drillableChildCount(stats: FillStats, zoneId: string, scope: FillScope): number {
    return rowsForScope(stats, zoneId, scope).length
}
