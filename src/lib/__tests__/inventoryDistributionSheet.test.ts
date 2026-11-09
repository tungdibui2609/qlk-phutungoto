import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
    buildInventoryReportWorkbook,
    DISTRIBUTION_SHEET_NAME
} from '../inventoryReportExcelExport'
import { aggregateKgByProduct, type DistributionLot, type KgConversion } from '../inventoryDistributionData'

// Hàm xuất thật gọi saveAs ở cuối; test chỉ dựng workbook nên chặn lại cho khỏi đụng filesystem.
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

// PNG 1x1 — chỉ cần để kiểm chứng exceljs nhúng ảnh vào gói .xlsx
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

const images = {
    kg: { base64: TINY_PNG, width: 720, height: 300 },
    position: { base64: TINY_PNG, width: 720, height: 300 }
}

/** Một mục GroupedLot đúng như trang /print/inventory truyền cho hàm xuất thật. */
const lotGroup = (sku: string, name: string, unit: string, qty: number, categoryName: string) => ({
    key: `${categoryName}__${sku}__${unit}`,
    productSku: sku,
    productName: name,
    productUnit: unit,
    totalQuantity: qty,
    totalKg: qty * 2,
    categoryName,
    variants: new Map<string, any>([['Không có mã phụ', { totalQuantity: qty, totalKg: qty * 2, items: [] }]]),
    items: []
})

const baseData = (extra: Record<string, unknown> = {}) => ({
    type: 'lot' as const,
    dateTitle: 'Tính đến ngày: 07/11/2026',
    warehouse: 'Chi nhánh 1',
    items: [lotGroup('TP01', 'Sầu riêng múi', 'Kg', 10, 'SẦU RIÊNG')],
    companyInfo: null,
    ...extra
})

async function reload(workbook: ExcelJS.Workbook) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await workbook.xlsx.writeBuffer())
    return wb
}

describe('Sheet ảnh phân bố trong báo cáo Tồn kho theo LOT', () => {
    it('tab LOT có ảnh thì thêm sheet phân bố sau sheet Tổng hợp, trước Chi tiết, chứa đúng 2 ảnh', () => {
        const wb = buildInventoryReportWorkbook(baseData({ distributionImages: images }) as any)
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Tổng hợp', DISTRIBUTION_SHEET_NAME, 'Chi tiết'])

        const ws = wb.getWorksheet(DISTRIBUTION_SHEET_NAME)!
        expect(ws.getCell('A1').value).toBe('Tỉ lệ phân bố hàng hóa tồn kho')
        expect(ws.getImages()).toHaveLength(2)
    })

    it('tiêu đề từng ảnh ghi rõ KG hay ô vị trí — mở file lên biết ngay ảnh nào là ảnh nào', () => {
        const ws = buildInventoryReportWorkbook(baseData({ distributionImages: images }) as any)
            .getWorksheet(DISTRIBUTION_SHEET_NAME)!
        const texts: string[] = []
        for (let r = 1; r <= 40; r++) {
            const v = ws.getRow(r).getCell(1).value
            if (typeof v === 'string') texts.push(v)
        }
        expect(texts).toContain('Phân bố khối lượng (KG) theo sản phẩm')
        expect(texts).toContain('Số ô vị trí đang chứa hàng theo danh mục')
    })

    it('ảnh nằm ở hai vị trí khác nhau, ảnh dưới bắt đầu sau khi ảnh trên hết chỗ', () => {
        const ws = buildInventoryReportWorkbook(baseData({ distributionImages: images }) as any)
            .getWorksheet(DISTRIBUTION_SHEET_NAME)!
        const rows = ws.getImages().map(img => (img.range.tl as any).nativeRow)
        expect(rows[1]).toBeGreaterThan(rows[0])
    })

    it('không có ảnh thì không sinh sheet rỗng', () => {
        const wb = buildInventoryReportWorkbook(baseData() as any)
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Tổng hợp', 'Chi tiết'])
    })

    it('các tab báo cáo khác không bị dính sheet phân bố', () => {
        const wb = buildInventoryReportWorkbook(baseData({ type: 'accounting', distributionImages: images }) as any)
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Bao Cao Ton Kho'])
    })

    it('ảnh sống sót qua một vòng ghi file rồi đọc lại', async () => {
        const wb = await reload(buildInventoryReportWorkbook(baseData({ distributionImages: images }) as any))
        expect(wb.worksheets.map(ws => ws.name)).toContain(DISTRIBUTION_SHEET_NAME)
        expect(wb.model.media).toHaveLength(2)
    })

    it('hai sheet số liệu cũ vẫn nguyên vẹn khi thêm sheet ảnh', () => {
        const wb = buildInventoryReportWorkbook(baseData({ distributionImages: images }) as any)
        const detail = wb.getWorksheet('Chi tiết')!
        let headerRow = 0
        for (let r = 1; r <= 20; r++) {
            if (detail.getRow(r).getCell(1).value === 'STT') { headerRow = r; break }
        }
        expect(headerRow).toBeGreaterThan(0)
        expect(detail.getRow(headerRow).getCell(2).value).toBe('Mã SP')
        expect(String(detail.getRow(headerRow + 1).getCell(1).value)).toMatch(/^DANH M/)
        expect(detail.rowCount).toBeGreaterThan(headerRow + 2)
    })
})

const conversion: KgConversion = {
    toBaseAmount: (_pid, _unit, qty) => qty,
    getBaseToKgRate: (_pid, baseUnit) => (baseUnit === 'Kg' ? 1 : null)
}

const product = (sku: string, unit: string, internalCode: string | null, categoryIds: string[] = []) => ({
    sku,
    name: `SP ${sku}`,
    unit,
    internal_code: internalCode,
    internal_name: internalCode ? `Nội bộ ${internalCode}` : null,
    product_category_rel: categoryIds.map(category_id => ({ category_id }))
})

const lotWithItems = (
    id: string,
    items: Array<{ product_id: string; quantity: number; unit: string | null; sku: string; baseUnit: string; internalCode: string | null; categoryIds?: string[] }>
): DistributionLot => ({
    id,
    product_id: null,
    quantity: null,
    lot_items: items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit: i.unit,
        products: product(i.sku, i.baseUnit, i.internalCode, i.categoryIds || [])
    })),
    products: null
})

describe('aggregateKgByProduct — cùng luật với card dashboard', () => {
    it('gộp các dòng trùng mã nội bộ thành một sản phẩm', () => {
        const { items, totalWeight } = aggregateKgByProduct([
            lotWithItems('l1', [{ product_id: 'p1', quantity: 10, unit: 'Kg', sku: 'TP01', baseUnit: 'Kg', internalCode: 'NB01' }]),
            lotWithItems('l2', [{ product_id: 'p2', quantity: 5, unit: 'Kg', sku: 'TP02', baseUnit: 'Kg', internalCode: 'NB01' }])
        ], conversion)

        expect(items).toHaveLength(1)
        expect(items[0].value).toBe(15)
        expect(items[0].code).toBe('NB01')
        expect(totalWeight).toBe(15)
    })

    it('bỏ qua sản phẩm không quy đổi được ra KG', () => {
        const { items, totalWeight } = aggregateKgByProduct([
            lotWithItems('l1', [
                { product_id: 'p1', quantity: 10, unit: 'Kg', sku: 'TP01', baseUnit: 'Kg', internalCode: null },
                { product_id: 'p2', quantity: 4, unit: 'Thùng', sku: 'TP02', baseUnit: 'Thùng', internalCode: null }
            ])
        ], conversion)

        expect(items.map(i => i.originalSku)).toEqual(['TP01'])
        expect(totalWeight).toBe(10)
    })

    it('LOT cũ không có dòng chi tiết thì đọc thẳng số liệu trên đầu LOT', () => {
        const legacy: DistributionLot = {
            id: 'l1',
            product_id: 'p1',
            quantity: 8,
            unit: 'Kg',
            lot_items: null,
            products: product('TP01', 'Kg', null)
        }
        const { items } = aggregateKgByProduct([legacy], conversion)
        expect(items).toHaveLength(1)
        expect(items[0].value).toBe(8)
    })

    it('lọc theo danh mục: chỉ giữ dòng có danh mục được chọn, "none" là dòng chưa phân loại', () => {
        const lots: DistributionLot[] = [
            lotWithItems('l1', [{ product_id: 'p1', quantity: 10, unit: 'Kg', sku: 'TP01', baseUnit: 'Kg', internalCode: null, categoryIds: ['c1'] }]),
            lotWithItems('l2', [{ product_id: 'p2', quantity: 6, unit: 'Kg', sku: 'TP02', baseUnit: 'Kg', internalCode: null, categoryIds: ['c2'] }]),
            lotWithItems('l3', [{ product_id: 'p3', quantity: 3, unit: 'Kg', sku: 'TP03', baseUnit: 'Kg', internalCode: null, categoryIds: [] }])
        ]

        expect(aggregateKgByProduct(lots, conversion, ['c1']).items.map(i => i.originalSku)).toEqual(['TP01'])
        expect(aggregateKgByProduct(lots, conversion, ['none']).items.map(i => i.originalSku)).toEqual(['TP03'])
        expect(aggregateKgByProduct(lots, conversion, ['c1', 'c2']).items.map(i => i.originalSku)).toEqual(['TP01', 'TP02'])
    })

    it('tỉ lệ % tính trên tổng của đúng tập đang lọc, sắp xếp lớn trước', () => {
        const { items } = aggregateKgByProduct([
            lotWithItems('l1', [
                { product_id: 'p1', quantity: 30, unit: 'Kg', sku: 'TP01', baseUnit: 'Kg', internalCode: null },
                { product_id: 'p2', quantity: 10, unit: 'Kg', sku: 'TP02', baseUnit: 'Kg', internalCode: null }
            ])
        ], conversion)

        expect(items.map(i => i.value)).toEqual([30, 10])
        expect(items.map(i => i.percentage)).toEqual([75, 25])
    })

    it('không có dữ liệu thì tổng bằng 0, không chia cho 0', () => {
        const { items, totalWeight } = aggregateKgByProduct([], conversion)
        expect(items).toEqual([])
        expect(totalWeight).toBe(0)
    })
})
