import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildDashboardWorkbook, excelFileName } from '../dashboardExcelWorkbook'
import {
    containerExportSpec,
    distributionKgExportSpec,
    fillRateExportSpec,
    categoryPositionExportSpec
} from '../dashboardExcelSpecs'
import { buildFillStats, buildZoneLookup, rowsForScope } from '../warehouseFillRate'
import type { CategoryPositionResult } from '../categoryPositionStats'

// PNG 1x1 trong suốt — chỉ cần để kiểm chứng exceljs nhúng ảnh vào gói .xlsx
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

function zone(id: string, code: string, extra: Record<string, unknown> = {}) {
    return { id, code, name: code, parent_id: null, level: 1, is_hall: false, display_order: 0, ...extra }
}

function makeStats() {
    const zones = [
        zone('z1', 'KHO 1'),
        zone('z2', 'KHO 2'),
        zone('z3', 'SANH 1', { is_hall: true })
    ]
    const positions: Array<{ id: string; lot_id: string | null; zone_id: string | null }> = []
    for (let i = 0; i < 10; i++) positions.push({ id: `p${i}`, lot_id: i < 4 ? 'lot1' : null, zone_id: 'z1' })
    for (let i = 0; i < 5; i++) positions.push({ id: `q${i}`, lot_id: i < 5 ? 'lot2' : null, zone_id: 'z2' })
    for (let i = 0; i < 3; i++) positions.push({ id: `h${i}`, lot_id: i < 1 ? 'lot3' : null, zone_id: 'z3' })
    const links = positions.map(p => ({ zone_id: p.zone_id!, position_id: p.id }))
    const lookup = buildZoneLookup(links)
    return buildFillStats(
        zones,
        positions.map(p => ({ ...p, zone_id: lookup.get(p.id) || null }))
    )
}

async function bufferToWorkbook(buffer: ArrayBuffer) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    return wb
}

describe('buildDashboardWorkbook', () => {
    it('tạo 2 sheet, đúng tên và đúng bảng số', async () => {
        const stats = makeStats()
        const rows = rowsForScope(stats, null, 'rack')
        const { spec } = fillRateExportSpec({
            systemName: 'Kho Đông Lạnh',
            scope: 'rack',
            pathLabels: [],
            stats,
            rows
        })
        const workbook = buildDashboardWorkbook({ ...spec, image: { base64: TINY_PNG, width: 720, height: 200 } })
        const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer

        expect(buffer.byteLength).toBeGreaterThan(1000)
        const wb = await bufferToWorkbook(buffer)
        expect(wb.worksheets.map(w => w.name)).toEqual(['Bieu do', 'Du lieu'])

        const data = wb.getWorksheet('Du lieu')!
        expect((data.getRow(1).values as unknown as Array<string | null>).slice(1)).toEqual([
            'Khu vực',
            'Ô Lô kệ quy hoạch',
            'Đang chứa',
            'Còn trống',
            'Tỉ lệ lấp đầy',
            'Trạng thái'
        ])
        expect(data.getRow(2).getCell(1).value).toBe('KHO 1')
        expect(data.getRow(2).getCell(5).value).toBe(40)
        expect(data.getRow(2).getCell(6).value).toBe('Bình thường')
    })

    it('giữ format số, autofilter, đóng băng dòng đầu và data bar trên cột %', async () => {
        const stats = makeStats()
        const { spec } = fillRateExportSpec({
            systemName: 'KHO',
            scope: 'rack',
            pathLabels: [],
            stats,
            rows: rowsForScope(stats, null, 'rack')
        })
        const wb = await bufferToWorkbook(
            (await buildDashboardWorkbook({ ...spec, image: null }).xlsx.writeBuffer()) as ArrayBuffer
        )
        const data = wb.getWorksheet('Du lieu')!
        const pctCell = data.getRow(2).getCell(5)
        expect(pctCell.numFmt).toContain('%')
        expect(data.autoFilter).toBeTruthy()
        expect(JSON.stringify(data.views)).toContain('frozen')
        const cf = (data as unknown as {
            conditionalFormattings: Array<{ ref: string; rules: Array<{ type: string }> }>
        }).conditionalFormattings
        expect(cf.length).toBe(1)
        expect(cf[0].ref).toBe('E2:E3')
        expect(cf[0].rules[0].type).toBe('dataBar')
    })

    it('nhúng ảnh PNG vào sheet Biểu đồ', async () => {
        const stats = makeStats()
        const { spec } = fillRateExportSpec({
            systemName: 'KHO',
            scope: 'hall',
            pathLabels: [],
            stats,
            rows: rowsForScope(stats, null, 'hall')
        })
        const buffer = (await buildDashboardWorkbook({
            ...spec,
            image: { base64: TINY_PNG, width: 720, height: 120 }
        }).xlsx.writeBuffer()) as ArrayBuffer

        // tên entry lưu dạng plaintext trong central directory của zip
        const asText = Buffer.from(buffer).toString('latin1')
        expect(asText).toContain('xl/media/image1.png')
        expect(asText).toContain('xl/drawings/drawing1.xml')
    })

    it('ghi dòng tổng và ghi chú phía dưới bảng', async () => {
        const { spec } = distributionKgExportSpec({
            systemName: 'KHO',
            filterLabel: 'Tất cả danh mục',
            items: [
                { name: 'Sầu riêng', code: 'SR01', value: 700.5, percentage: 70 },
                { name: 'Xoài', code: 'XO1', value: 299.5, percentage: 30 }
            ],
            totalWeight: 1000
        })
        const wb = await bufferToWorkbook((await buildDashboardWorkbook({ ...spec, image: null }).xlsx.writeBuffer()) as ArrayBuffer)
        const data = wb.getWorksheet('Du lieu')!
        const lastDataRow = data.getRow(4)
        expect(lastDataRow.getCell(2).value).toBe('Tất cả sản phẩm')
        expect(lastDataRow.getCell(4).value).toBe(1000)
        expect(lastDataRow.getCell(5).value).toBe(100)
        expect(String(data.getRow(6).getCell(1).value)).toContain('Khối lượng đã quy đổi')
    })
})

describe('fillRateExportSpec', () => {
    it('vẽ hbar trục % và tô màu theo mức lấp đầy', () => {
        const stats = makeStats()
        const rows = rowsForScope(stats, null, 'rack')
        const { spec, chart } = fillRateExportSpec({
            systemName: 'KHO',
            scope: 'rack',
            pathLabels: ['KHO 1'],
            stats,
            rows
        })
        expect(chart.kind).toBe('hbar')
        expect(chart.percentAxis).toBe(true)
        expect(chart.labels).toEqual(['KHO 1', 'KHO 2'])
        expect(chart.series[0].values).toEqual([40, 100])
        expect(chart.barColors).toEqual(['#10b981', '#f43f5e'])
        expect(spec.meta!.find(m => m.label === 'Cấp đang xem')?.value).toBe('KHO 1')
        expect(spec.totalRow?.[4]).toBe(60)
    })

    it('tab Sảnh đổi tiêu đề và đơn vị, không kèm ghi chú ô chưa gán khu', () => {
        const stats = makeStats()
        const { spec } = fillRateExportSpec({
            systemName: 'KHO',
            scope: 'hall',
            pathLabels: [],
            stats,
            rows: rowsForScope(stats, null, 'hall')
        })
        expect(spec.columns[1].header).toBe('Ô Sảnh quy hoạch')
        expect(spec.notes?.some(n => n.includes('chưa gán vào khu'))).toBe(false)
        expect(spec.rows).toEqual([['SANH 1', 3, 1, 2, 33.3, 'Bình thường']])
    })
})

describe('categoryPositionExportSpec', () => {
    it('xuất 2 tỉ lệ và ghi chú LOT chưa phân loại', () => {
        const result: CategoryPositionResult = {
            stats: [
                { categoryId: 'c1', name: 'SẦU RIÊNG', count: 1414, pctOfOccupied: 68.21, pctOfTotal: 18.1 },
                { categoryId: 'c2', name: 'XOÀI', count: 193, pctOfOccupied: 9.32, pctOfTotal: 2.5 }
            ],
            totalPositions: 7820,
            occupiedPositions: 2073,
            unclassifiedOccupied: 12
        }
        const { spec, chart } = categoryPositionExportSpec({
            systemName: 'KHO',
            warehouseLabel: 'KHO 1',
            result,
            visibleOnly: true
        })
        expect(spec.rows[0]).toEqual(['SẦU RIÊNG', 1414, 68.2, 18.1])
        expect(spec.dataBarColumn).toBe(3)
        expect(chart.series[0].values).toEqual([1414, 193])
        expect(spec.notes?.[2]).toContain('12 ô')
        expect(spec.meta!.find(m => m.label === 'Ô đang chứa hàng')?.value).toBe('2.073')
    })
})

describe('containerExportSpec', () => {
    it('để trống container của mặt hàng chưa khai định mức và không cộng vào tổng', () => {
        const { spec } = containerExportSpec({
            systemName: 'KHO',
            filterLabel: 'Tất cả danh mục',
            items: [
                { name: 'A', sku: 'A1', totalBoxes: 400, boxesPerContainer: 100, containers: 4, hasConfig: true },
                { name: 'B', sku: 'B1', totalBoxes: 900, boxesPerContainer: 0, containers: 0, hasConfig: false }
            ]
        })
        expect(spec.rows[0][1]).toBe('A')
        expect(spec.rows[1][5]).toBeNull()
        expect(spec.rows[1][6]).toBe('Chưa khai báo định mức')
        expect(spec.totalRow?.[5]).toBe(4)
        expect(spec.totalRow?.[3]).toBe(1300)
    })
})

describe('excelFileName', () => {
    it('bỏ dấu và ký tự cấm, có mốc thời gian', () => {
        const name = excelFileName('Tỉ lệ lấp đầy kho', 'Sảnh tạm kết', new Date(2026, 10, 1, 9, 5))
        expect(name).toBe('TI_LE_LAP_DAY_KHO_SANH_TAM_KET_20261101_0905.xlsx')
    })
})
