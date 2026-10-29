import { describe, expect, it } from 'vitest'
import {
    AGING_DATE_OPTIONS,
    assignBucketIndex,
    buildAgingLines,
    buildBuckets,
    diffDays,
    normalizeAgingDate,
    resolveLotDate,
    sanitizeThresholds,
    summarizeByLot,
    summarizeByProduct,
    type AgingLotSource
} from '../inventoryAging'

const buckets = buildBuckets([30, 60, 90, 180])
const AS_OF = '2026-08-01'

function lines(lots: AgingLotSource[]) {
    return buildAgingLines(lots, { dateType: 'inbound_date', asOfDate: AS_OF, buckets, categoryMap: {} })
}

describe('ngưỡng nhóm tuổi tồn kho', () => {
    it('tạo dải ngày liên tục, không hở mốc', () => {
        expect(buckets.map(b => b.shortLabel)).toEqual(['0-30', '31-60', '61-90', '91-180', '>180'])
        expect(assignBucketIndex(30, buckets)).toBe(0)
        expect(assignBucketIndex(31, buckets)).toBe(1)
        expect(assignBucketIndex(90, buckets)).toBe(2)
        expect(assignBucketIndex(91, buckets)).toBe(3)
        expect(assignBucketIndex(181, buckets)).toBe(4)
        expect(assignBucketIndex(9999, buckets)).toBe(4)
    })

    it('LOT chưa có ngày tách riêng, không bị tính là 0 ngày', () => {
        expect(assignBucketIndex(null, buckets)).toBeNull()
    })

    it('ngưỡng nhập tay được sắp lại và loại trùng', () => {
        expect(sanitizeThresholds([180, 90, 90, 0, -5, 30])).toEqual([30, 90, 180])
        expect(buildBuckets([90, 180]).map(b => b.shortLabel)).toEqual(['0-90', '91-180', '>180'])
    })
})

describe('chuẩn hoá ngày của LOT', () => {
    it('cắt đúng ngày của cột timestamp lưu ở nửa đêm UTC', () => {
        expect(normalizeAgingDate('2026-05-28T00:00:00+00:00')).toBe('2026-05-28')
        expect(normalizeAgingDate('2026-05-28')).toBe('2026-05-28')
        expect(normalizeAgingDate('28/05/2026')).toBe('2026-05-28')
        expect(normalizeAgingDate(null)).toBeNull()
        expect(normalizeAgingDate('')).toBeNull()
    })

    it('số ngày tính lùi từ mốc báo cáo', () => {
        expect(diffDays('2026-05-28', AS_OF)).toBe(65)
        expect(diffDays('2026-08-01', AS_OF)).toBe(0)
        expect(diffDays('2026-08-05', AS_OF)).toBe(-4)
        expect(diffDays(null, AS_OF)).toBeNull()
    })
})

describe('chọn ngày theo loại', () => {
    const lot: AgingLotSource = {
        id: 'l1',
        code: 'DL-LOT-1',
        inbound_date: '2026-06-01',
        peeling_date: null,
        raw_material_date: '2026-03-10T00:00:00+00:00',
        packaging_date: '2026-04-05',
        metadata: { peeling_dates: ['2026-02-20', '2026-02-11'] },
        production_lot_date: '2026-01-30'
    }

    it('chỉ đọc đúng loại ngày được chọn', () => {
        expect(resolveLotDate(lot, 'inbound_date')).toBe('2026-06-01')
        expect(resolveLotDate(lot, 'raw_material_date')).toBe('2026-03-10')
        expect(resolveLotDate(lot, 'packaging_date')).toBe('2026-04-05')
    })

    it('"Ngày sản xuất" lấy metadata sớm nhất khi cột peeling_date trống', () => {
        expect(resolveLotDate(lot, 'production_date')).toBe('2026-02-11')
        expect(resolveLotDate({ ...lot, metadata: null }, 'production_date')).toBe('2026-01-30')
        expect(resolveLotDate({ ...lot, metadata: null, production_lot_date: null }, 'production_date')).toBeNull()
    })

    it('có đủ 4 loại ngày cho bộ chọn, mỗi loại gắn đúng module LOT gating', () => {
        expect(AGING_DATE_OPTIONS.map(o => o.id)).toEqual([
            'inbound_date', 'production_date', 'raw_material_date', 'packaging_date'
        ])
        expect(AGING_DATE_OPTIONS.find(o => o.id === 'inbound_date')?.lotModuleId).toBeNull()
        expect(AGING_DATE_OPTIONS.find(o => o.id === 'production_date')?.lotModuleId).toBe('peeling_date')
    })
})

describe('tổng hợp tồn lâu ngày', () => {
    const lots: AgingLotSource[] = [
        {
            id: 'a', code: 'LOT-A', inbound_date: '2026-01-01',
            lot_items: [{ id: 'i1', quantity: 10, unit: 'Thùng', products: { id: 'p1', sku: 'SKU1', name: 'Hàng 1', unit: 'Thùng' } }]
        },
        {
            id: 'b', code: 'LOT-B', inbound_date: '2026-06-20',
            lot_items: [
                { id: 'i2', quantity: 4, unit: 'Thùng', products: { id: 'p1', sku: 'SKU1', name: 'Hàng 1', unit: 'Thùng' } },
                { id: 'i3', quantity: 100, unit: 'Kg', products: { id: 'p2', sku: 'SKU2', name: 'Hàng 2', unit: 'Kg' } }
            ]
        },
        {
            id: 'c', code: 'LOT-C',
            lot_items: [{ id: 'i4', quantity: 7, unit: 'Thùng', products: { id: 'p1', sku: 'SKU1', name: 'Hàng 1', unit: 'Thùng' } }]
        }
    ]

    it('gom một dòng mỗi LOT và giữ nguyên số dòng chưa có ngày', () => {
        const rows = summarizeByLot(lines(lots))
        expect(rows).toHaveLength(3)
        expect(rows[0].lotCode).toBe('LOT-A')
        expect(rows[0].days).toBe(212)
        expect(rows[0].items).toHaveLength(1)
        expect(rows[1].items).toHaveLength(2)
        expect(rows[1].quantity).toBe(104)
        expect(rows[2].days).toBeNull()
        expect(rows[2].bucketIndex).toBeNull()
    })

    it('cộng dồn theo nhóm tuổi và đếm LOT một lần cho mỗi nhóm', () => {
        const rows = summarizeByProduct(lines(lots), buckets.length)
        const sku1 = rows.find(r => r.sku === 'SKU1')!

        expect(sku1.quantity).toBe(21)
        expect(sku1.lotCount).toBe(3)
        expect(sku1.maxDays).toBe(212)
        expect(sku1.oldestDate).toBe('2026-01-01')
        expect(sku1.qtyByBucket).toEqual([0, 4, 0, 0, 10])
        expect(sku1.lotCountByBucket).toEqual([0, 1, 0, 0, 1])
    })

    it('bỏ dòng có số lượng bằng 0 để không đếm nhầm LOT hết hàng', () => {
        const rows = lines([{ id: 'd', code: 'LOT-D', inbound_date: '2026-01-01', quantity: 0, products: { id: 'p3', sku: 'SKU3', name: 'Hàng 3', unit: 'Kg' } }])
        expect(rows).toHaveLength(0)
    })
})
