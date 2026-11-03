import { describe, it, expect } from 'vitest'
import {
    buildUnitOptions,
    collectAllUnitOptions,
    groupLotItemsForUnitChange,
    isSameUnit,
    letterOf,
    type UnitEditLotItemRow,
    type UnitEditProductRef,
    type UnitEditProductUnitRef,
    type UnitEditUnitRef,
} from '../lotUnitBulkEdit'

/**
 * Fixture lấy từ dữ liệu THẬT trong kho đông lạnh:
 * sản phẩm TP101020207.01.01, đơn vị gốc Kg (weight_kg NULL),
 * product_units = Khay 0.4 / Thùng 9.6 / Thùng 12.
 */
const PRODUCT_ID = '2d4c8de6-7052-40c6-9c47-61faec9319da'
const THUNGG_ID = '474c5aa3-02f9-48e5-9a1d-a64e80db8d18'
const KHAY_ID = '6ff2b8b7-a5cb-4db4-a1a0-2a7440a9f432'

const product: UnitEditProductRef = {
    id: PRODUCT_ID,
    sku: 'TP101020207.01.01',
    name: 'TP cấp đông sầu riêng múi ri 6 khay (có hạt) - thùng tạm',
    unit: 'Kg',
    weight_kg: null,
}

const units: UnitEditUnitRef[] = [
    { id: THUNGG_ID, name: 'Thùng' },
    { id: KHAY_ID, name: 'Khay' },
]

const productUnits: UnitEditProductUnitRef[] = [
    { product_id: PRODUCT_ID, unit_id: KHAY_ID, conversion_rate: 0.4 },
    { product_id: PRODUCT_ID, unit_id: THUNGG_ID, conversion_rate: 9.6 },
    { product_id: PRODUCT_ID, unit_id: THUNGG_ID, conversion_rate: 12 },
]

const row = (
    id: string,
    lotId: string,
    lotCode: string,
    unit: string | null,
    quantity: number | null,
    productId: string = PRODUCT_ID
): UnitEditLotItemRow => ({ id, lot_id: lotId, lot_code: lotCode, product_id: productId, quantity, unit })

describe('letterOf', () => {
    it('gán A..Z rồi sang nhãn đôi', () => {
        expect(letterOf(0)).toBe('A')
        expect(letterOf(25)).toBe('Z')
        expect(letterOf(26)).toBe('AA')
        expect(letterOf(27)).toBe('AB')
        expect(letterOf(52)).toBe('BA')
    })
})

describe('isSameUnit', () => {
    it('bỏ qua hoa/thường và khoảng trắng', () => {
        expect(isSameUnit('Thùng (20kg)', 'Thùng (20 Kg)')).toBe(true)
        expect(isSameUnit('Thùng (20kg)', ' thùng(20KG)')).toBe(true)
        expect(isSameUnit('Thùng (20kg)', 'Thùng (13kg)')).toBe(false)
        expect(isSameUnit(null, '')).toBe(true)
    })
})

describe('buildUnitOptions', () => {
    it('đơn vị gốc Kg không gắn hậu tố khối lượng, đơn vị quy đổi kèm kg', () => {
        expect(buildUnitOptions(product, productUnits, units, 'Thùng (12kg)')).toEqual([
            'Kg',
            'Khay (0.4kg)',
            'Thùng (9.6kg)',
            'Thùng (12kg)',
        ])
    })

    it('suy ra khối lượng gốc 1kg khi sản phẩm tính theo Kg mà weight_kg trống', () => {
        const options = buildUnitOptions(product, productUnits, units, '')
        expect(options).toContain('Thùng (12kg)')
        expect(options).not.toContain('Kg (1kg)')
    })

    it('dùng weight_kg của sản phẩm làm hệ số quy đổi', () => {
        const boxProduct: UnitEditProductRef = { ...product, unit: 'Thùng', weight_kg: 5 }
        const options = buildUnitOptions(boxProduct, [{ product_id: PRODUCT_ID, unit_id: KHAY_ID, conversion_rate: 0.4 }], units, '')
        expect(options).toEqual(['Thùng (5kg)', 'Khay (2kg)'])
    })

    it('giữ lại đơn vị hiện tại dù sản phẩm chưa cấu hình (không bao giờ mất lựa chọn gốc)', () => {
        const options = buildUnitOptions(product, [], units, 'Pallet (300kg)')
        expect(options).toEqual(['Kg', 'Pallet (300kg)'])
    })

    it('bỏ qua đơn vị quy đổi trùng tên với đơn vị gốc', () => {
        const options = buildUnitOptions(product, [{ product_id: PRODUCT_ID, unit_id: 'x', conversion_rate: 1 }], [{ id: 'x', name: 'kg' }], '')
        expect(options).toEqual(['Kg'])
    })

    it('an toàn với sản phẩm thiếu dữ liệu', () => {
        expect(buildUnitOptions(undefined, productUnits, units, 'Kiệt')).toEqual(['Kiệt'])
    })
})

describe('groupLotItemsForUnitChange', () => {
    it('tách 2 dòng của CÙNG sản phẩm nhưng khác đơn vị thành 2 nhóm A và B', () => {
        const groups = groupLotItemsForUnitChange(
            [row('i1', 'l1', 'DL-LOT-001', 'Thùng (12kg)', 30), row('i2', 'l2', 'DL-LOT-002', 'Thùng (9.6kg)', 50)],
            [product],
            productUnits,
            units
        )
        expect(groups).toHaveLength(2)
        expect(groups.map(g => g.letter)).toEqual(['A', 'B'])
        expect(groups.map(g => g.currentUnit)).toEqual(['Thùng (12kg)', 'Thùng (9.6kg)'])
        expect(groups[0].itemIds).toEqual(['i1'])
        expect(groups[0].quantity).toBe(30)
        expect(groups[1].lotCodes).toEqual(['DL-LOT-002'])
    })

    it('gộp "Thùng (20 Kg)" và "Thùng (20kg)" (2 biến thể có thật trong DB) thành một nhóm', () => {
        const p20: UnitEditProductRef = { ...product, id: 'p20', name: 'Sản phẩm 20kg', sku: 'TP20' }
        const groups = groupLotItemsForUnitChange(
            [row('i1', 'l1', 'LOT-A', 'Thùng (20 Kg)', 4, 'p20'), row('i2', 'l2', 'LOT-B', 'Thùng (20kg)', 6, 'p20')],
            [p20],
            [],
            []
        )
        expect(groups).toHaveLength(1)
        expect(groups[0].itemIds).toEqual(['i1', 'i2'])
        expect(groups[0].quantity).toBe(10)
        expect(groups[0].currentUnit).toBe('Thùng (20 Kg)')
        expect(groups[0].lotCodes).toEqual(['LOT-A', 'LOT-B'])
    })

    it('cộng dồn số lượng theo từng LOT và loại mã LOT trùng lặp', () => {
        const groups = groupLotItemsForUnitChange(
            [row('i1', 'l1', 'LOT-A', 'Thùng (13kg)', 10), row('i2', 'l1', 'LOT-A', 'Thùng (13kg)', 12.5), row('i3', 'l2', 'LOT-B', 'Thùng (13kg)', null)],
            [product],
            productUnits,
            units
        )
        expect(groups).toHaveLength(1)
        expect(groups[0].quantity).toBe(22.5)
        expect(groups[0].lotCodes).toEqual(['LOT-A', 'LOT-B'])
    })

    it('lấy đơn vị gốc của sản phẩm khi dòng LOT bỏ trống đơn vị', () => {
        const groups = groupLotItemsForUnitChange([row('i1', 'l1', 'LOT-A', null, 8)], [product], productUnits, units)
        expect(groups[0].currentUnit).toBe('Kg')
        expect(groups[0].options).toEqual(['Kg', 'Khay (0.4kg)', 'Thùng (9.6kg)', 'Thùng (12kg)'])
    })

    it('sắp xếp theo tên sản phẩm rồi đơn vị và vẫn sinh nhóm cho sản phẩm đã bị xóa', () => {
        const other: UnitEditProductRef = { id: 'p9', sku: 'TP09', name: 'Bơ cub', unit: 'Kg', weight_kg: null }
        const groups = groupLotItemsForUnitChange(
            [row('i1', 'l1', 'LOT-A', 'Kg', 1, 'p_missing'), row('i2', 'l1', 'LOT-A', 'Kg', 2, 'p9')],
            [other],
            [],
            []
        )
        expect(groups.map(g => g.productName)).toEqual(['(sản phẩm không tồn tại)', 'Bơ cub'])
        expect(groups[0].sku).toBe('')
        expect(groups[0].options).toEqual(['Kg'])
        expect(groups[1].options).toEqual(['Kg'])
    })
})

describe('collectAllUnitOptions', () => {
    it('gộp và khử trùng đơn vị của mọi nhóm, có thứ tự', () => {
        const groups = groupLotItemsForUnitChange(
            [row('i1', 'l1', 'LOT-A', 'Thùng (12kg)', 1), row('i2', 'l2', 'LOT-B', 'Thùng (9.6kg)', 1), row('i3', 'l3', 'LOT-C', 'Thùng (12 Kg)', 1)],
            [product],
            productUnits,
            units
        )
        expect(groups).toHaveLength(2)
        expect([...collectAllUnitOptions(groups)].sort()).toEqual(
            ['Kg', 'Khay (0.4kg)', 'Thùng (9.6kg)', 'Thùng (12kg)'].sort()
        )
        expect(new Set(collectAllUnitOptions(groups)).size).toBe(4)
    })

    it('trống khi không có nhóm nào', () => {
        expect(collectAllUnitOptions([])).toEqual([])
    })
})
