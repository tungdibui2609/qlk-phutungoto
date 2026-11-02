import { describe, expect, it } from 'vitest'
import { buildHallStats, hallRootsInScope, topHallOfZone } from '../hallInventoryStats'

const KHO_2 = 'kho-2'
const SANH_1 = 'sanh-1'
const SANH_2 = 'sanh-2'
const SANH_2_CON = 'sanh-2a'
const SANH_3 = 'sanh-3'
const DAY_KEM = 'day-kem'
const KHO_3 = 'kho-3'
const SANH_KHO_3 = 'sanh-kho-3'

const zones = [
    { id: KHO_2, name: 'KHO 2', code: 'K2', parent_id: null, display_order: 2 },
    { id: SANH_1, name: 'SẢNH 1', code: 'S1', parent_id: KHO_2, display_order: 2, is_hall: true },
    { id: SANH_2, name: 'SẢNH 2', code: 'S2', parent_id: KHO_2, display_order: 5, is_hall: true },
    { id: SANH_2_CON, name: 'Khu chờ xe', code: 'S2A', parent_id: SANH_2, display_order: 1, is_hall: true },
    { id: SANH_3, name: 'SẢNH 3', code: 'S3', parent_id: KHO_2, display_order: 8, is_hall: true },
    { id: DAY_KEM, name: 'Dãy Kệ 1', code: 'D1', parent_id: KHO_2, display_order: 1 },
    { id: KHO_3, name: 'KHO 3', code: 'K3', parent_id: null, display_order: 3 },
    { id: SANH_KHO_3, name: 'SẢNH 1', code: 'S1', parent_id: KHO_3, display_order: 2, is_hall: true }
]

const scopeKho2 = [KHO_2, SANH_1, SANH_2, SANH_2_CON, SANH_3, DAY_KEM]

const lot = (sku: string, quantity: number, unit: string, tags: string[] = []) => ({
    items: [{ sku, product_name: `Tên ${sku}`, quantity, unit }],
    tags
})

const positions = [
    { id: 'p1', zone_id: SANH_1, lot_id: 'l1' },
    { id: 'p2', zone_id: SANH_1, lot_id: 'l2' },
    { id: 'p3', zone_id: SANH_2, lot_id: 'l1' },
    // Ô nằm trong sảnh con: phải tính cho sảnh đầu ngành SẢNH 2, không thành một tab riêng
    { id: 'p4', zone_id: SANH_2_CON, lot_id: 'l1' },
    // Ô sảnh thuộc kho khác: không được lẫn vào thống kê của KHO 2
    { id: 'p5', zone_id: SANH_KHO_3, lot_id: 'l1' },
    // Ô ngoài sảnh (kệ) và ô trống: không tính
    { id: 'p6', zone_id: DAY_KEM, lot_id: 'l1' },
    { id: 'p7', zone_id: SANH_3, lot_id: null }
]

const lotInfo: Record<string, any> = {
    l1: lot('MJ01', 10, 'Thùng', ['@']),
    l2: lot('MD02', 5, 'Kg')
}

const itemsMap: Record<string, any> = {
    p1: { checked: true, note: 'v rách' },
    p3: { checked: true, note: null },
    p4: { checked: false, note: 'ẩm mốc' }
}

const run = () => buildHallStats({ zones, positions, lotInfo, itemsMap, scopeIds: scopeKho2 })

describe('buildHallStats — tách thống kê theo từng sảnh', () => {
    it('tab sảnh theo thứ tự sơ đồ kho và giữ cả sảnh trống', () => {
        const { halls } = run()
        expect(halls.map(h => h.name)).toEqual(['SẢNH 1', 'SẢNH 2', 'SẢNH 3'])
        expect(halls.find(h => h.id === SANH_3)?.positionCount).toBe(0)
        expect(halls.find(h => h.id === SANH_3)?.groups).toEqual([])
    })

    it('sảnh con gộp vào sảnh đầu ngành, không tạo tab lồng nhau', () => {
        const { halls } = run()
        const sanh2 = halls.find(h => h.id === SANH_2)
        expect(sanh2?.positionCount).toBe(2)
        expect(sanh2?.groups.find(g => g.sku === 'MJ01')?.positionIds).toEqual(['p3', 'p4'])
        expect(halls.some(h => h.id === SANH_2_CON)).toBe(false)
    })

    it('số từng sảnh cộng lại khớp 1:1 với tab Tất cả sảnh', () => {
        const { halls, all } = run()
        expect(halls.reduce((s, h) => s + h.positionCount, 0)).toBe(all?.positionCount)
        const tongTheoTungSanh = halls.reduce((s, h) => s + (h.groups.find(g => g.sku === 'MJ01')?.count || 0), 0)
        expect(all?.groups.find(g => g.sku === 'MJ01')?.count).toBe(tongTheoTungSanh)
    })

    it('không lộ ô của sảnh thuộc kho khác', () => {
        const { all } = run()
        expect(all?.positionCount).toBe(4)
        expect(all?.groups.flatMap(g => g.positionIds)).not.toContain('p5')
        expect(run().halls.map(h => h.id)).not.toContain(SANH_KHO_3)
    })

    it('gộp tiến độ kiểm và ghi chú của các ô cùng cụm trong một sảnh', () => {
        const { halls } = run()
        const cumMJ01 = halls.find(h => h.id === SANH_1)?.groups.find(g => g.sku === 'MJ01')
        expect(cumMJ01).toMatchObject({ count: 1, checkedCount: 1, notes: ['v rách'], tag: '@', quantity: 10, unit: 'Thùng' })
        const sanh2 = halls.find(h => h.id === SANH_2)?.groups.find(g => g.sku === 'MJ01')
        expect(sanh2).toMatchObject({ count: 2, checkedCount: 1, notes: ['ẩm mốc'] })
    })

    it('nhận diện sảnh đầu ngành và ô thuộc sảnh', () => {
        expect(hallRootsInScope(zones, scopeKho2).map(z => z.id)).toEqual([SANH_1, SANH_2, SANH_3])
        expect(topHallOfZone(zones, SANH_2_CON)).toBe(SANH_2)
        expect(topHallOfZone(zones, DAY_KEM)).toBeNull()
        expect(topHallOfZone(zones, null)).toBeNull()
    })
})
