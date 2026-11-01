import { describe, expect, it } from 'vitest'
import {
    buildCategoryPositionStats,
    buildLotCategoryMap,
    warehouseScopeZoneIds
} from '../categoryPositionStats'

const MIT = 'cat-mit'
const XOAI = 'cat-xoai'
const SAU = 'cat-sau'

const categories = [
    { id: MIT, name: 'MÍT' },
    { id: XOAI, name: 'XOÀI' },
    { id: SAU, name: 'SẦU RIÊNG' }
]

const zones = [
    { id: 'kho1', level: 0, parent_id: null },
    { id: 'khu1a', level: 1, parent_id: 'kho1' },
    { id: 'day1a1', level: 2, parent_id: 'khu1a' },
    { id: 'kho2', level: 0, parent_id: null }
]

const pos = (id: string, zone_id: string | null, lot_id: string | null) => ({ id, zone_id, lot_id })

function lot(id: string, items: Array<{ category_id?: string | null; product_category_ids?: string[] }>) {
    return {
        id,
        lot_items: items.map(it => ({
            category_id: it.category_id ?? null,
            products: it.product_category_ids
                ? { product_category_rel: it.product_category_ids.map(cid => ({ category_id: cid })) }
                : null
        }))
    }
}

describe('thống kê danh mục trên ô vị trí', () => {
    it('hai mẫu số khác nhau: hàng hoá tính trên ô đang đầy, công suất tính trên mọi ô quy hoạch', () => {
        const positions = [
            pos('p1', 'day1a1', 'l1'),
            pos('p2', 'day1a1', 'l2'),
            pos('p3', 'khu1a', null),
            pos('p4', 'kho2', null),
            pos('p5', 'kho2', null),
            pos('p6', 'kho2', null),
            pos('p7', 'kho2', null),
            pos('p8', 'kho2', null),
            pos('p9', 'kho2', null),
            pos('p10', 'kho2', null)
        ]
        const lotCategories = buildLotCategoryMap([
            lot('l1', [{ product_category_ids: [MIT] }]),
            lot('l2', [{ product_category_ids: [MIT] }])
        ])
        const result = buildCategoryPositionStats({ categories, positions, lotCategories, zones })

        expect(result.totalPositions).toBe(10)
        expect(result.occupiedPositions).toBe(2)
        const mit = result.stats.find(s => s.categoryId === MIT)!
        expect(mit.count).toBe(2)
        expect(mit.pctOfOccupied).toBeCloseTo(100, 6)
        expect(mit.pctOfTotal).toBeCloseTo(20, 6)
        expect(result.stats.find(s => s.categoryId === XOAI)!.count).toBe(0)
    })

    it('một LOT mang nhiều danh mục thì ô đó được tính cho từng danh mục (tổng có thể vượt 100%)', () => {
        const positions = [pos('p1', 'kho1', 'l1'), pos('p2', 'kho1', 'l2')]
        const lotCategories = buildLotCategoryMap([
            lot('l1', [{ product_category_ids: [MIT] }, { product_category_ids: [XOAI] }]),
            lot('l2', [{ product_category_ids: [XOAI] }])
        ])
        const { stats } = buildCategoryPositionStats({ categories, positions, lotCategories, zones })
        expect(stats.find(s => s.categoryId === MIT)!.count).toBe(1)
        expect(stats.find(s => s.categoryId === XOAI)!.count).toBe(2)
        expect(stats.find(s => s.categoryId === XOAI)!.pctOfOccupied).toBeCloseTo(100, 6)
    })

    it('danh mục gán trên dòng LOT thắng danh mục của sản phẩm', () => {
        const lotCategories = buildLotCategoryMap([
            lot('l1', [{ category_id: SAU, product_category_ids: [MIT] }])
        ])
        expect(lotCategories.get('l1')).toEqual([SAU])
        const positions = [pos('p1', 'kho1', 'l1')]
        const { stats } = buildCategoryPositionStats({ categories, positions, lotCategories, zones })
        expect(stats.find(s => s.categoryId === SAU)!.count).toBe(1)
        expect(stats.find(s => s.categoryId === MIT)!.count).toBe(0)
    })

    it('chọn kho chỉ tính ô trong cây khu của kho đó, ô chưa gán khu bị loại khi đã chọn kho', () => {
        const positions = [
            pos('p1', 'day1a1', 'l1'),
            pos('p2', 'khu1a', 'l1'),
            pos('p3', 'kho2', 'l2'),
            pos('p4', null, 'l2')
        ]
        const lotCategories = buildLotCategoryMap([
            lot('l1', [{ product_category_ids: [MIT] }]),
            lot('l2', [{ product_category_ids: [XOAI] }])
        ])

        const all = buildCategoryPositionStats({ categories, positions, lotCategories, zones })
        expect(all.totalPositions).toBe(4)

        const kho1 = buildCategoryPositionStats({ categories, positions, lotCategories, zones, warehouseId: 'kho1' })
        expect(kho1.totalPositions).toBe(2)
        expect(kho1.occupiedPositions).toBe(2)
        expect(kho1.stats.find(s => s.categoryId === MIT)!.pctOfOccupied).toBeCloseTo(100, 6)
        expect(kho1.stats.find(s => s.categoryId === XOAI)!.count).toBe(0)

        expect(warehouseScopeZoneIds(zones, 'kho1')).toEqual(new Set(['kho1', 'khu1a', 'day1a1']))
        expect(warehouseScopeZoneIds(zones, null)).toBeNull()
    })

    it('ô chứa LOT không có dòng nào (LOT legacy) vẫn ở trong mẫu số và được báo riêng', () => {
        const positions = [pos('p1', 'kho1', 'l1'), pos('p2', 'kho1', 'l2'), pos('p3', 'kho1', null)]
        const lotCategories = buildLotCategoryMap([lot('l1', [{ product_category_ids: [MIT] }]), lot('l2', [])])
        const result = buildCategoryPositionStats({ categories, positions, lotCategories, zones })
        expect(result.occupiedPositions).toBe(2)
        expect(result.unclassifiedOccupied).toBe(1)
        expect(result.stats.find(s => s.categoryId === MIT)!.pctOfTotal).toBeCloseTo(100 / 3, 4)
    })

    it('không có ô nào thì tỉ lệ bằng 0, không chia cho 0', () => {
        const result = buildCategoryPositionStats({ categories, positions: [], lotCategories: new Map(), zones })
        expect(result.totalPositions).toBe(0)
        expect(result.stats.every(s => s.pctOfOccupied === 0 && s.pctOfTotal === 0)).toBe(true)
        expect(result.stats.every(s => !Number.isNaN(s.pctOfOccupied))).toBe(true)
    })

    it('dữ liệu khu có quan hệ vòng lặp không làm treo khi lấy cây con', () => {
        const cyclic = [
            { id: 'a', parent_id: 'b' },
            { id: 'b', parent_id: 'a' }
        ]
        const ids = warehouseScopeZoneIds(cyclic, 'a')
        expect(ids).toEqual(new Set(['a', 'b']))
    })
})
