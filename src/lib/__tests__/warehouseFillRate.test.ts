import { describe, expect, it } from 'vitest'
import {
    ancestorLabels,
    buildFillStats,
    buildHallDetector,
    buildZoneLookup,
    childStatsOf,
    classifyFill,
    drillableChildCount,
    fillPct,
    metricsOf,
    ownMetricsOf,
    rowsForScope
} from '../warehouseFillRate'

const KHO = 'kho-1'
const KHU_A = 'khu-a'
const DAY_A1 = 'day-a1'
const SANH = 'sanh-1'
const SANH_CON = 'sanh-1a'

const zones = [
    { id: KHO, code: 'K1', name: 'Kho 1', parent_id: null, level: 0 },
    { id: KHU_A, code: 'K1A', name: 'Khu A', parent_id: KHO, level: 1 },
    { id: DAY_A1, code: 'K1A1', name: 'Dãy A1', parent_id: KHU_A, level: 2 },
    { id: SANH, code: 'S1', name: 'Sảnh tạm kết', parent_id: KHO, level: 1 },
    { id: SANH_CON, code: 'S1A', name: 'Khu chờ xe', parent_id: SANH, level: 2 }
]

const pos = (id: string, zone_id: string | null, occupied: boolean) => ({
    id,
    zone_id,
    lot_id: occupied ? `lot-${id}` : null
})

const mixedPositions = [
    pos('p1', DAY_A1, true),
    pos('p2', KHU_A, false),
    pos('p3', KHO, false),
    pos('p4', SANH, true),
    pos('p5', SANH_CON, false)
]

describe('nhận diện khu sảnh', () => {
    it('dựa vào cờ is_hall hoặc tên SẢNH/SÀNH/SANH của chính nó và của tổ tiên', () => {
        const detect = buildHallDetector([
            { id: 'a', name: 'Khu A' },
            { id: 'b', name: 'Khu B', is_hall: true },
            { id: 'c', name: 'SÀNH giao hàng' },
            { id: 'd', name: 'Khu chờ', parent_id: 'c' },
            { id: 'e', name: 'SANH 2' }
        ])
        expect(detect('a')).toBe(false)
        expect(detect('b')).toBe(true)
        expect(detect('c')).toBe(true)
        expect(detect('d')).toBe(true)
        expect(detect('e')).toBe(true)
        expect(detect(null)).toBe(false)
        expect(detect('zone-khong-ton-tai')).toBe(false)
    })
})

describe('tách bạch chỉ số Lô kệ và Sảnh', () => {
    it('cấp cha cộng dồn riêng hai loại, tỉ lệ chính chỉ tính Lô kệ', () => {
        const stats = buildFillStats(zones, mixedPositions)

        const kho = stats.byZone.get(KHO)!
        expect(kho).toMatchObject({
            ownRackPositions: 1,
            ownRackOccupied: 0,
            rackPositions: 3,
            rackOccupied: 1,
            hallPositions: 2,
            hallOccupied: 1,
            isHall: false
        })
        expect(kho.pct).toBeCloseTo(100 / 3, 3)
        expect(kho.hallPct).toBeCloseTo(50, 3)

        const sanh = stats.byZone.get(SANH)!
        expect(sanh.isHall).toBe(true)
        expect(sanh).toMatchObject({ hallPositions: 2, hallOccupied: 1, rackPositions: 0, pct: 0 })

        expect(stats.totals.rack).toEqual({ positions: 3, occupied: 1, free: 2, pct: fillPct(1, 3) })
        expect(stats.totals.hall).toEqual({ positions: 2, occupied: 1, free: 1, pct: 50 })
        expect(stats.totals.all.positions).toBe(5)
        expect(stats.totals.all.occupied).toBe(2)
    })

    it('vị trí chưa gán khu vực được tính là Lô kệ và vẫn nằm trong tổng toàn kho', () => {
        const stats = buildFillStats(zones, [
            pos('p1', KHU_A, true),
            pos('p2', null, true),
            pos('p3', 'khu-da-xoa', false)
        ])
        expect(stats.unassignedPositions).toBe(2)
        expect(stats.unassignedOccupied).toBe(1)
        expect(stats.totals.rack.positions).toBe(3)
        expect(stats.totals.rack.occupied).toBe(2)
        expect(stats.totals.hall.positions).toBe(0)
        expect(stats.totals.all.positions).toBe(3)
    })

    it('danh sách cấp Lô kệ loại hẳn khu sảnh, danh sách sảnh chỉ giữ sảnh', () => {
        const stats = buildFillStats(zones, mixedPositions)
        expect(childStatsOf(stats, KHO, 'rack').map(z => z.zoneId)).toEqual([KHU_A])
        expect(childStatsOf(stats, KHO, 'hall').map(z => z.zoneId)).toEqual([SANH])
        expect(childStatsOf(stats, null, 'all').map(z => z.zoneId)).toEqual([KHO])
        expect(childStatsOf(stats, DAY_A1, 'rack')).toEqual([])
    })

    it('hallRoots chỉ lấy khu sảnh đầu ngành, khu con của sảnh không bị liệt kê trùng', () => {
        const stats = buildFillStats(zones, mixedPositions)
        expect(stats.hallRoots.map(z => z.zoneId)).toEqual([SANH])
        expect(childStatsOf(stats, SANH, 'hall').map(z => z.zoneId)).toEqual([SANH_CON])
    })

    it('số khu con để quyết định có cho phép đi xuống hay không', () => {
        const stats = buildFillStats(zones, mixedPositions)
        expect(drillableChildCount(stats, KHO, 'rack')).toBe(1)
        expect(drillableChildCount(stats, KHO, 'hall')).toBe(1)
        expect(drillableChildCount(stats, DAY_A1, 'rack')).toBe(0)
    })

    it('khu Lô kệ chưa quy hoạch ô nào bị ẩn khỏi danh sách để không nhiễu chỉ số', () => {
        const stats = buildFillStats(zones, [pos('p1', SANH, false)])
        expect(childStatsOf(stats, KHO, 'rack')).toEqual([])
        expect(stats.byZone.get(KHU_A)!.pct).toBe(0)
        expect(stats.byZone.get(KHU_A)!.rackPositions).toBe(0)
        expect(childStatsOf(stats, KHO, 'hall').map(z => z.zoneId)).toEqual([SANH])
    })
})

describe('ba tab Lô kệ / Sảnh / Tổng', () => {
    const stats = buildFillStats(zones, mixedPositions)
    const kho = stats.byZone.get(KHO)!

    it('tab Tổng cộng Lô kệ + Sảnh, tab con đọc đúng bộ đếm riêng', () => {
        expect(metricsOf(kho, 'rack')).toEqual({ positions: 3, occupied: 1, free: 2, pct: fillPct(1, 3) })
        expect(metricsOf(kho, 'hall')).toEqual({ positions: 2, occupied: 1, free: 1, pct: 50 })
        expect(metricsOf(kho, 'all')).toEqual({ positions: 5, occupied: 2, free: 3, pct: 40 })
        expect(metricsOf(kho, 'all').positions).toBe(stats.totals.all.positions)
    })

    it('"riêng khu này" ở tab Tổng gộp cả ô kệ và ô sảnh của chính khu đó', () => {
        expect(ownMetricsOf(kho, 'rack')).toEqual({ positions: 1, occupied: 0, free: 1, pct: 0 })
        expect(ownMetricsOf(kho, 'all').positions).toBe(1)
        expect(ownMetricsOf(stats.byZone.get(SANH)!, 'all')).toEqual({ positions: 1, occupied: 1, free: 0, pct: 100 })
    })

    it('tab Tổng giữ cả khu kệ lẫn khu sảnh ở cùng một cấp', () => {
        expect(childStatsOf(stats, KHO, 'all').map(z => z.zoneId)).toEqual([KHU_A, SANH])
        expect(drillableChildCount(stats, KHO, 'all')).toBe(2)
    })

    it('tab Sảnh mở đầu bằng khu sảnh đầu ngành, không phải tên kho', () => {
        expect(rowsForScope(stats, null, 'hall').map(z => z.zoneId)).toEqual([SANH])
        expect(rowsForScope(stats, null, 'rack').map(z => z.zoneId)).toEqual([KHO])
        expect(rowsForScope(stats, SANH, 'hall').map(z => z.zoneId)).toEqual([SANH_CON])
    })

    it('khu sảnh không có ô sảnh nào bị ẩn khỏi tab Sảnh', () => {
        const empty = buildFillStats(zones, [pos('p1', DAY_A1, true)])
        expect(rowsForScope(empty, null, 'hall')).toEqual([])
        expect(metricsOf(empty.byZone.get(SANH)!, 'hall').positions).toBe(0)
    })
})

describe('thứ tự khu vực phải khớp sơ đồ kho', () => {
    const mapZones = [
        { id: 'root', code: 'KHO', name: 'Kho', parent_id: null, level: 0, display_order: 0 },
        { id: 'k1', code: 'KHO 1', name: 'KHO 1', parent_id: 'root', level: 1, display_order: 0 },
        { id: 'k2', code: 'KHO 2', name: 'KHO 2', parent_id: 'root', level: 1, display_order: 0 },
        { id: 'k10', code: 'KHO 10', name: 'KHO 10', parent_id: 'root', level: 1, display_order: 0 },
        { id: 'k9', code: 'KHO 9', name: 'KHO 9', parent_id: 'root', level: 1, display_order: 0 },
        { id: 'u1', code: 'ZZZ', name: 'Khu kéo lên đầu', parent_id: 'root', level: 1, display_order: -5 }
    ]
    const mapPositions = [
        pos('p1', 'k1', true),
        pos('p2', 'k2', false),
        pos('p10', 'k10', false),
        pos('p9', 'k9', true),
        pos('pu', 'u1', false)
    ]

    it('display_order quyết định trước, bằng nhau thì so mã kiểu tự nhiên (KHO 2 trước KHO 10)', () => {
        const stats = buildFillStats(mapZones, mapPositions)
        expect(childStatsOf(stats, 'root', 'rack').map(z => z.zoneId)).toEqual(['u1', 'k1', 'k2', 'k9', 'k10'])
    })

    it('tab Sảnh cũng theo thứ tự sơ đồ, display_order thắng thứ tự mã', () => {
        const stats = buildFillStats(
            [
                { id: 'root', code: 'KHO', name: 'Kho', parent_id: null, level: 0 },
                { id: 's2', code: 'SANH 2', name: 'Sảnh 2', parent_id: 'root', level: 1, is_hall: true, display_order: 1 },
                { id: 's1', code: 'SANH 1', name: 'Sảnh 1', parent_id: 'root', level: 1, is_hall: true, display_order: 2 }
            ],
            [pos('p1', 's1', false), pos('p2', 's2', false)]
        )
        expect(stats.hallRoots.map(z => z.code)).toEqual(['SANH 2', 'SANH 1'])
        expect(rowsForScope(stats, null, 'hall').map(z => z.code)).toEqual(['SANH 2', 'SANH 1'])
    })

    it('khu không có display_order vẫn xếp được theo mã', () => {
        const stats = buildFillStats(
            [
                { id: 'a', code: 'DAY B', name: 'Dãy B', parent_id: null, level: 0 },
                { id: 'b', code: 'DAY A', name: 'Dãy A', parent_id: null, level: 0 }
            ],
            [pos('p1', 'a', false), pos('p2', 'b', false)]
        )
        expect(stats.roots.map(z => z.displayOrder)).toEqual([null, null])
        expect(childStatsOf(stats, null, 'rack').map(z => z.code)).toEqual(['DAY A', 'DAY B'])
    })
})

describe('tổng hợp cây khu vực', () => {
    it('cấp cha bằng tổng ô của chính nó cộng các cấp con bên dưới', () => {
        const stats = buildFillStats(zones, [
            pos('p1', DAY_A1, true),
            pos('p2', DAY_A1, false),
            pos('p3', KHU_A, true)
        ])
        expect(stats.byZone.get(DAY_A1)).toMatchObject({ ownRackPositions: 2, ownRackOccupied: 1, rackPositions: 2, childCount: 0 })
        expect(stats.byZone.get(KHU_A)).toMatchObject({ ownRackPositions: 1, ownRackOccupied: 1, rackPositions: 3, rackOccupied: 2, childCount: 1 })
        expect(stats.byZone.get(KHO)!.rackPositions).toBe(3)
    })

    it('khu chưa có ô nào thì tỉ lệ là 0, không chia cho 0', () => {
        expect(fillPct(0, 0)).toBe(0)
        const stats = buildFillStats([{ id: 'z1', name: 'Khu trống', parent_id: null, level: 0 }], [])
        expect(stats.byZone.get('z1')!.pct).toBe(0)
        expect(stats.totals.rack.pct).toBe(0)
        expect(stats.totals.all.pct).toBe(0)
    })

    it('phân loại mức lấp đầy theo ngưỡng 90% và 70%', () => {
        expect(classifyFill(92)).toBe('critical')
        expect(classifyFill(90)).toBe('critical')
        expect(classifyFill(71)).toBe('high')
        expect(classifyFill(70)).toBe('high')
        expect(classifyFill(35)).toBe('normal')
        expect(classifyFill(0)).toBe('empty')
    })

    it('một vị trí chỉ thuộc đúng một khu vực trong thống kê', () => {
        const lookup = buildZoneLookup([
            { position_id: 'p1', zone_id: KHU_A },
            { position_id: 'p1', zone_id: SANH },
            { position_id: 'p2', zone_id: null }
        ])
        expect(lookup.get('p1')).toBe(SANH)
        expect(lookup.has('p2')).toBe(false)
        expect(lookup.size).toBe(1)
    })

    it('zone có cha không tồn tại vẫn được coi là gốc, không rơi khỏi tổng', () => {
        const stats = buildFillStats(
            [{ id: 'orphan', name: 'Khu mồ côi', parent_id: 'cha-bi-xoa', level: 1 }],
            [pos('p1', 'orphan', true)]
        )
        expect(stats.roots.map(z => z.zoneId)).toEqual(['orphan'])
        expect(stats.totals.rack.occupied).toBe(1)
    })

    it('dữ liệu zone có quan hệ vòng lặp không làm treo khi cộng dồn', () => {
        const stats = buildFillStats(
            [
                { id: 'a', name: 'A', parent_id: 'b', level: 1 },
                { id: 'b', name: 'B', parent_id: 'a', level: 1 }
            ],
            [pos('p1', 'a', true), pos('p2', 'b', true)]
        )
        expect(stats.totals.rack.occupied).toBe(2)
        expect(stats.byZone.get('a')!.rackPositions).toBe(2)
        expect(stats.roots).toEqual([])
    })
})

describe('ancestorLabels — ngữ cảnh khu cha cho khu trùng tên', () => {
    it('trả chuỗi cha từ gốc tới cha trực tiếp, không gồm chính nó', () => {
        const stats = buildFillStats(zones, mixedPositions)
        expect(ancestorLabels(stats, DAY_A1)).toEqual(['Kho 1', 'Khu A'])
        expect(ancestorLabels(stats, SANH)).toEqual(['Kho 1'])
        expect(ancestorLabels(stats, KHO)).toEqual([])
        expect(ancestorLabels(stats, 'khong-ton-tai')).toEqual([])
    })

    it('sảnh trùng tên ở hai kho vẫn phân biệt được bằng chuỗi cha', () => {
        const stats = buildFillStats(
            [
                { id: 'k1', code: 'K1', name: 'KHO 1', parent_id: null, level: 0 },
                { id: 'k2', code: 'K2', name: 'KHO 2', parent_id: null, level: 0 },
                { id: 's1', code: 'S1', name: 'SẢNH 1', parent_id: 'k1', level: 1, is_hall: true },
                { id: 's2', code: 'S1', name: 'SẢNH 1', parent_id: 'k2', level: 1, is_hall: true }
            ],
            [pos('p1', 's1', true), pos('p2', 's2', false)]
        )
        expect(stats.hallRoots.map(z => ancestorLabels(stats, z.zoneId).concat(z.label).join(' › ')))
            .toEqual(['KHO 1 › SẢNH 1', 'KHO 2 › SẢNH 1'])
    })

    it('quan hệ vòng lặp không làm treo khi đi ngược chuỗi cha', () => {
        const stats = buildFillStats(
            [
                { id: 'a', name: 'A', parent_id: 'b', level: 1 },
                { id: 'b', name: 'B', parent_id: 'a', level: 1 }
            ],
            [pos('p1', 'a', true)]
        )
        expect(ancestorLabels(stats, 'a')).toEqual(['B'])
    })
})
