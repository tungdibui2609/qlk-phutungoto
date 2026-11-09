import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import {
    buildInventoryReportWorkbook,
    CONTAINER_SHEET_NAME,
    DISTRIBUTION_SHEET_NAME,
    FILL_RATE_SHEET_NAME
} from '../inventoryReportExcelExport'
import {
    aggregateContainerStock,
    type ContainerConversion,
    type ContainerLot,
    type ContainerProductRef
} from '../containerStockData'

// Hàm xuất thật gọi saveAs ở cuối; test chỉ dựng workbook nên chặn lại cho khỏi đụng filesystem.
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

// PNG 1x1 — chỉ cần để kiểm chứng exceljs nhúng ảnh vào gói .xlsx
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

const containerImage = { base64: TINY_PNG, width: 720, height: 300 }
const distributionImages = {
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

describe('Sheet ảnh container trong báo cáo Tồn kho theo LOT', () => {
    it('tab LOT có ảnh thì thêm sheet container sau sheet phân bố, chứa đúng 1 ảnh', () => {
        const wb = buildInventoryReportWorkbook(
            baseData({ distributionImages, containerImage }) as any
        )
        expect(wb.worksheets.map(ws => ws.name)).toEqual([
            'Tổng hợp', DISTRIBUTION_SHEET_NAME, CONTAINER_SHEET_NAME, 'Chi tiết'
        ])

        const ws = wb.getWorksheet(CONTAINER_SHEET_NAME)!
        expect(ws.getCell('A1').value).toBe('Ước tính số container tồn kho theo mặt hàng')
        expect(ws.getImages()).toHaveLength(1)
    })

    it('chỉ có ảnh container (không phân bố) thì sheet container vẫn đứng trước Chi tiết', () => {
        const wb = buildInventoryReportWorkbook(baseData({ containerImage }) as any)
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Tổng hợp', CONTAINER_SHEET_NAME, 'Chi tiết'])
    })

    it('tiêu đề ảnh ghi rõ nội dung — mở file lên biết ngay ảnh nào là ảnh nào', () => {
        const ws = buildInventoryReportWorkbook(baseData({ containerImage }) as any)
            .getWorksheet(CONTAINER_SHEET_NAME)!
        const texts: string[] = []
        for (let r = 1; r <= 40; r++) {
            const v = ws.getRow(r).getCell(1).value
            if (typeof v === 'string') texts.push(v)
        }
        expect(texts).toContain('Số lượng Container tồn kho theo từng mặt hàng')
    })

    it('không có ảnh thì không sinh sheet rỗng', () => {
        const wb = buildInventoryReportWorkbook(baseData() as any)
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Tổng hợp', 'Chi tiết'])
    })

    it('các tab báo cáo khác không bị dính sheet container', () => {
        const wb = buildInventoryReportWorkbook(
            baseData({ type: 'accounting', containerImage }) as any
        )
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Bao Cao Ton Kho'])
    })

    it('ảnh sống sót qua một vòng ghi file rồi đọc lại', async () => {
        const wb = await reload(buildInventoryReportWorkbook(baseData({ containerImage }) as any))
        expect(wb.worksheets.map(ws => ws.name)).toContain(CONTAINER_SHEET_NAME)
        expect(wb.model.media).toHaveLength(1)
    })
})

// 1 Thùng = 20 Kg; đơn vị khác giữ nguyên để rơi xuống nhánh Kg/20.
const conversion: ContainerConversion = {
    convertUnit: (_pid, fromUnit, toUnit, qty) =>
        (fromUnit === 'Kg' && toUnit === 'Thùng') ? qty / 20 : qty,
    getBaseAmount: (_pid, _unit, qty) => qty
}

const product = (sku: string, unit: string, boxesPerContainer: number | null): ContainerProductRef => ({
    id: `id-${sku}`,
    sku,
    name: `SP ${sku}`,
    unit,
    boxes_per_container: boxesPerContainer,
    internal_code: null,
    internal_name: null,
    product_category_rel: []
})

const lotWith = (
    id: string,
    items: Array<{ product_id: string; quantity: number; unit: string; sku: string; baseUnit: string; boxes: number | null }>
): ContainerLot => ({
    id,
    product_id: null,
    quantity: null,
    lot_items: items.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit: i.unit,
        products: product(i.sku, i.baseUnit, i.boxes)
    })),
    products: null
})

describe('aggregateContainerStock — cùng luật với card dashboard', () => {
    it('đơn vị thùng đếm thẳng rồi chia định mức ra container', () => {
        const stats = aggregateContainerStock([
            lotWith('l1', [{ product_id: 'p1', quantity: 250, unit: 'Thùng', sku: 'TP01', baseUnit: 'Thùng', boxes: 100 }])
        ], conversion)
        expect(stats).toHaveLength(1)
        expect(stats[0].totalBoxes).toBe(250)
        expect(stats[0].containers).toBe(2.5)
        expect(stats[0].hasConfig).toBe(true)
    })

    it('chưa khai định mức thì containers = 0 nhưng vẫn có dòng để báo cáo thấy chỗ thiếu', () => {
        const stats = aggregateContainerStock([
            lotWith('l1', [{ product_id: 'p1', quantity: 40, unit: 'Thùng', sku: 'TP01', baseUnit: 'Thùng', boxes: 0 }])
        ], conversion)
        expect(stats[0].hasConfig).toBe(false)
        expect(stats[0].containers).toBe(0)
        expect(stats[0].totalBoxes).toBe(40)
    })

    it('đơn vị Kg quy về Thùng rồi mới chia định mức', () => {
        const stats = aggregateContainerStock([
            lotWith('l1', [{ product_id: 'p1', quantity: 200, unit: 'Kg', sku: 'TP01', baseUnit: 'Kg', boxes: 5 }])
        ], conversion)
        // 200 Kg / 20 = 10 Thùng; 10 / 5 = 2 container
        expect(stats[0].totalBoxes).toBe(10)
        expect(stats[0].containers).toBe(2)
    })

    it('gộp nhiều LOT cùng sản phẩm thành một dòng', () => {
        const stats = aggregateContainerStock([
            lotWith('l1', [{ product_id: 'p1', quantity: 100, unit: 'Thùng', sku: 'TP01', baseUnit: 'Thùng', boxes: 50 }]),
            lotWith('l2', [{ product_id: 'p1', quantity: 50, unit: 'Thùng', sku: 'TP01', baseUnit: 'Thùng', boxes: 50 }])
        ], conversion)
        expect(stats).toHaveLength(1)
        expect(stats[0].totalBoxes).toBe(150)
        expect(stats[0].containers).toBe(3)
    })

    it('không có dữ liệu thì trả mảng rỗng, không lỗi', () => {
        expect(aggregateContainerStock([], conversion)).toEqual([])
    })
})

describe('Sheet ảnh Tỉ lệ lấp đầy trong báo cáo Tồn kho theo LOT', () => {
    const fillRateImage = { base64: TINY_PNG, width: 720, height: 900 }

    it('tab LOT có ảnh thì sheet lấp đầy đứng sau sheet container, trước Chi tiết', () => {
        const wb = buildInventoryReportWorkbook(
            baseData({ distributionImages, containerImage, fillRateImage }) as any
        )
        expect(wb.worksheets.map(ws => ws.name)).toEqual([
            'Tổng hợp', DISTRIBUTION_SHEET_NAME, CONTAINER_SHEET_NAME, FILL_RATE_SHEET_NAME, 'Chi tiết'
        ])

        const ws = wb.getWorksheet(FILL_RATE_SHEET_NAME)!
        expect(ws.getCell('A1').value).toBe('Tỉ lệ lấp đầy theo khu vực')
        expect(ws.getImages()).toHaveLength(1)
    })

    it('caption trong sheet ghi đúng tên card dashboard', () => {
        const ws = buildInventoryReportWorkbook(baseData({ fillRateImage }) as any)
            .getWorksheet(FILL_RATE_SHEET_NAME)!
        const texts: string[] = []
        for (let r = 1; r <= 40; r++) {
            const v = ws.getRow(r).getCell(1).value
            if (typeof v === 'string') texts.push(v)
        }
        // Xuất hiện ≥ 2 lần: tiêu đề A1 và caption trên ảnh — chứng tỏ caption thật sự được ghi.
        expect(texts.filter(t => t === 'Tỉ lệ lấp đầy theo khu vực').length).toBeGreaterThanOrEqual(2)
    })

    it('không có ảnh lấp đầy thì không sinh sheet rỗng, thứ tự cũ giữ nguyên', () => {
        const wb = buildInventoryReportWorkbook(baseData({ containerImage }) as any)
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Tổng hợp', CONTAINER_SHEET_NAME, 'Chi tiết'])
    })

    it('tab báo cáo khác không bị dính sheet lấp đầy', () => {
        const wb = buildInventoryReportWorkbook(baseData({ type: 'accounting', fillRateImage }) as any)
        expect(wb.worksheets.map(ws => ws.name)).toEqual(['Bao Cao Ton Kho'])
    })

    it('ảnh lấp đầy sống sót qua một vòng ghi file rồi đọc lại', async () => {
        const wb = await reload(buildInventoryReportWorkbook(baseData({ fillRateImage }) as any))
        expect(wb.worksheets.map(ws => ws.name)).toContain(FILL_RATE_SHEET_NAME)
        expect(wb.model.media).toHaveLength(1)
    })
})
