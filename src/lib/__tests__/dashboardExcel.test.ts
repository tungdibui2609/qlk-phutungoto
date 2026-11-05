import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import {
    buildDashboardWorkbook,
    buildWorkbookFromSheets,
    excelFileName,
    type DashboardChartImage
} from '../dashboardExcelWorkbook'
import {
    categoryPositionExportSpec,
    containerExportSpec,
    distributionKgExportSpec,
    distributionWorkbookPlan,
    fillRateWorkbookPlan
} from '../dashboardExcelSpecs'
import { buildFillStats, buildZoneLookup, fillTreeRows } from '../warehouseFillRate'
import type { CategoryPositionResult } from '../categoryPositionStats'

// PNG 1x1 trong suốt — chỉ cần để kiểm chứng exceljs nhúng ảnh vào gói .xlsx
const TINY_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=='

function zone(id: string, code: string, extra: Record<string, unknown> = {}) {
    return { id, code, name: code, parent_id: null, level: 1, is_hall: false, display_order: 0, ...extra }
}

function makeStats() {
    const zones = [
        zone('z1', 'KHO 1'),
        zone('z1a', 'KHU A 1', { parent_id: 'z1', level: 2 }),
        zone('z2', 'KHO 2'),
        zone('z3', 'SANH 1', { is_hall: true, parent_id: 'z1', level: 2 })
    ]
    const positions: Array<{ id: string; lot_id: string | null; zone_id: string | null }> = []
    for (let i = 0; i < 10; i++) positions.push({ id: `p${i}`, lot_id: i < 4 ? 'lot1' : null, zone_id: 'z1' })
    for (let i = 0; i < 6; i++) positions.push({ id: `a${i}`, lot_id: i < 2 ? 'lot4' : null, zone_id: 'z1a' })
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

/** Sheet có tiêu đề nằm dưới ảnh biểu đồ → phải tìm dòng tiêu đề thật trước khi assert. */
function headerRowOf(ws: ExcelJS.Worksheet, firstHeader: string) {
    for (let r = 1; r <= 60; r++) {
        if (ws.getRow(r).getCell(1).value === firstHeader) return r
    }
    throw new Error(`Không tìm thấy dòng tiêu đề "${firstHeader}"`)
}

const CATEGORY_RESULT: CategoryPositionResult = {
    stats: [
        { categoryId: 'c1', name: 'SẦU RIÊNG', count: 1414, pctOfOccupied: 68.21, pctOfTotal: 18.1 },
        { categoryId: 'c2', name: 'XOÀI', count: 193, pctOfOccupied: 9.32, pctOfTotal: 2.5 }
    ],
    totalPositions: 7820,
    occupiedPositions: 2073,
    unclassifiedOccupied: 12
}

describe('buildDashboardWorkbook (kiểu cũ 2 sheet)', () => {
    it('tạo 2 sheet "Bieu do"/"Du lieu" và giữ nguyên bảng số của spec', async () => {
        const { spec } = categoryPositionExportSpec({
            systemName: 'Kho Đông Lạnh',
            warehouseLabel: 'KHO 1',
            result: CATEGORY_RESULT,
            visibleOnly: true
        })
        const buffer = (await buildDashboardWorkbook({
            ...spec,
            image: { base64: TINY_PNG, width: 720, height: 200 }
        }).xlsx.writeBuffer()) as ArrayBuffer

        expect(buffer.byteLength).toBeGreaterThan(1000)
        const wb = await bufferToWorkbook(buffer)
        expect(wb.worksheets.map(w => w.name)).toEqual(['Bieu do', 'Du lieu'])

        const data = wb.getWorksheet('Du lieu')!
        expect((data.getRow(1).values as unknown as Array<string | null>).slice(1)).toEqual([
            'Danh mục',
            'Số ô vị trí',
            'Tỉ lệ hàng hoá',
            'Tỉ lệ công suất'
        ])
        expect(data.getRow(2).getCell(1).value).toBe('SẦU RIÊNG')
        expect(data.getRow(2).getCell(2).value).toBe(1414)
        expect(data.getRow(2).getCell(3).value).toBe(68.2)
    })

    it('giữ format số, autofilter, đóng băng dòng đầu và data bar trên cột %', async () => {
        const { spec } = categoryPositionExportSpec({
            systemName: 'KHO',
            warehouseLabel: 'KHO 1',
            result: CATEGORY_RESULT,
            visibleOnly: true
        })
        const wb = await bufferToWorkbook(
            (await buildDashboardWorkbook({ ...spec, image: null }).xlsx.writeBuffer()) as ArrayBuffer
        )
        const data = wb.getWorksheet('Du lieu')!
        const pctCell = data.getRow(2).getCell(3)
        expect(pctCell.numFmt).toContain('%')
        expect(data.autoFilter).toBeTruthy()
        expect(JSON.stringify(data.views)).toContain('frozen')
        const cf = (data as unknown as {
            conditionalFormattings: Array<{ ref: string; rules: Array<{ type: string }> }>
        }).conditionalFormattings
        expect(cf.length).toBe(1)
        expect(cf[0].ref).toBe('C2:C3')
        expect(cf[0].rules[0].type).toBe('dataBar')
    })

    it('nhúng ảnh PNG vào sheet Biểu đồ', async () => {
        const { spec } = distributionKgExportSpec({
            systemName: 'KHO',
            filterLabel: 'Tất cả danh mục',
            items: [{ name: 'Sầu riêng', value: 700.5, percentage: 70 }],
            totalWeight: 700.5
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

describe('fillTreeRows', () => {
    it('đi toàn bộ cây khu: cha đứng trước con, depth tăng theo cấp', () => {
        const tree = fillTreeRows(makeStats(), 'rack')
        expect(tree.map(r => `${r.stat.label}:${r.depth}`)).toEqual(['KHO 1:0', 'KHU A 1:1', 'KHO 2:0'])
        // tab Sảnh bắt đầu từ khu sảnh đầu ngành, không lẫn khu kệ
        expect(fillTreeRows(makeStats(), 'hall').map(r => r.stat.label)).toEqual(['SANH 1'])
    })
})

describe('fillRateWorkbookPlan', () => {
    it('4 sheet, sheet Tổng quan đủ số của cả ba tab', () => {
        const plan = fillRateWorkbookPlan({
            systemName: 'Kho Đông Lạnh',
            stats: makeStats(),
            when: new Date(2026, 10, 5, 14, 1)
        })
        expect(plan.map(s => s.sheetName)).toEqual(['Tong quan', 'Lo ke', 'Sanh', 'Tong (ke + sanh)'])
        expect(plan[0].rows).toEqual([
            ['Lô kệ', 21, 11, 10, 52.4, 'Bình thường'],
            ['Sảnh tạm kết', 3, 1, 2, 33.3, 'Bình thường'],
            ['Tổng (kệ + sảnh)', 24, 12, 12, 50, 'Bình thường']
        ])
        expect(plan[0].meta!.find(m => m.label === 'Phân hệ kho')?.value).toBe('Kho Đông Lạnh')
        expect(plan[0].chart).toBeUndefined()
    })

    it('sheet Lô kệ là toàn bộ cây khu, con thụt một cấp so với cha', () => {
        const rack = fillRateWorkbookPlan({ systemName: 'KHO', stats: makeStats() })[1]
        expect(rack.columns!.map(c => c.header)).toEqual([
            'Khu vực',
            'Đường dẫn trong sơ đồ',
            'Ô Lô kệ quy hoạch',
            'Đang chứa',
            'Còn trống',
            'Tỉ lệ lấp đầy',
            'Trạng thái'
        ])
        expect(rack.rows).toEqual([
            ['KHO 1', 'KHO 1', 16, 6, 10, 37.5, 'Bình thường'],
            ['KHU A 1', 'KHO 1 › KHU A 1', 6, 2, 4, 33.3, 'Bình thường'],
            ['KHO 2', 'KHO 2', 5, 5, 0, 100, 'Sắp đầy']
        ])
        expect(rack.rowIndents).toEqual([0, 1, 0])
        expect(rack.totalRow).toEqual(['Toàn Lô kệ', '', 21, 11, 10, 52.4, 'Bình thường'])
    })

    it('biểu đồ chỉ vẽ cấp khu vực và nhãn thanh kèm số ô như trên màn hình', () => {
        const plan = fillRateWorkbookPlan({ systemName: 'KHO', stats: makeStats() })
        const rackChart = plan[1].chart!
        expect(rackChart.labels).toEqual(['KHO 1', 'KHO 2'])
        expect(rackChart.series[0].values).toEqual([37.5, 100])
        expect(rackChart.barColors).toEqual(['#10b981', '#f43f5e'])
        expect(rackChart.valueLabels).toEqual(['37,5% · 6/16 ô', '100% · 5/5 ô'])
        expect(plan[2].chart!.labels).toEqual(['SANH 1'])
    })

    it('khu sảnh trùng tên vẫn phân biệt được nhờ cột đường dẫn', () => {
        const hall = fillRateWorkbookPlan({ systemName: 'KHO', stats: makeStats() })[2]
        expect(hall.rows).toEqual([['SANH 1', 'KHO 1 › SANH 1', 3, 1, 2, 33.3, 'Bình thường']])
        expect(hall.rowIndents).toEqual([0])
        expect(hall.totalRow).toEqual(['Toàn Sảnh', '', 3, 1, 2, 33.3, 'Bình thường'])
    })

    it('buildWorkbookFromSheets: ảnh nằm trên, bảng bắt đầu bên dưới ảnh, data bar đúng cột tỉ lệ', async () => {
        const plan = fillRateWorkbookPlan({ systemName: 'KHO', stats: makeStats() })
        const image: DashboardChartImage = { base64: TINY_PNG, width: 720, height: 100 }
        const wb = await bufferToWorkbook(
            (await buildWorkbookFromSheets(
                plan.map(s => ({ ...s, image: s.chart ? image : null }))
            ).xlsx.writeBuffer()) as ArrayBuffer
        )

        expect(wb.worksheets.map(w => w.name)).toEqual(['Tong quan', 'Lo ke', 'Sanh', 'Tong (ke + sanh)'])

        const rack = wb.getWorksheet('Lo ke')!
        const headerRow = headerRowOf(rack, 'Khu vực')
        expect(headerRow).toBeGreaterThan(1)
        expect(rack.getRow(headerRow + 2).getCell(1).value).toBe('KHU A 1')
        expect(rack.getRow(headerRow + 2).getCell(1).alignment?.indent).toBe(1)
        expect(rack.getRow(headerRow + 1).getCell(3).numFmt).toContain('#')
        expect(JSON.stringify(rack.views)).toContain('frozen')
        const cf = (rack as unknown as { conditionalFormattings: Array<{ ref: string }> }).conditionalFormattings
        expect(cf[0].ref).toBe(`F${headerRow + 1}:F${headerRow + 3}`)

        // sheet Tổng quan không có ảnh → bảng sát ngay dưới metadata
        const overview = wb.getWorksheet('Tong quan')!
        expect(headerRowOf(overview, 'Phạm vi')).toBeLessThan(8)
        expect(overview.getRow(3).getCell(2).value).toBe('KHO')
    })
})

describe('categoryPositionExportSpec', () => {
    it('xuất 2 tỉ lệ và ghi chú LOT chưa phân loại', () => {
        const { spec, chart } = categoryPositionExportSpec({
            systemName: 'KHO',
            warehouseLabel: 'KHO 1',
            result: CATEGORY_RESULT,
            visibleOnly: true
        })
        expect(spec.rows[0]).toEqual(['SẦU RIÊNG', 1414, 68.2, 18.1])
        expect(spec.dataBarColumn).toBe(3)
        expect(chart.kind).toBe('donut')
        expect(chart.legendLimit).toBe(12)
        expect(chart.series[0].values).toEqual([1414, 193])
        expect(spec.notes?.[2]).toContain('12 ô')
        expect(spec.meta!.find(m => m.label === 'Ô đang chứa hàng')?.value).toBe('2.073')
    })
})

describe('distributionWorkbookPlan', () => {
    const plan = () =>
        distributionWorkbookPlan(
            {
                systemName: 'KHO',
                filterLabel: 'Tất cả danh mục',
                items: [{ name: 'Sầu riêng', code: 'SR01', value: 700.5, percentage: 100 }],
                totalWeight: 700.5
            },
            { systemName: 'KHO', warehouseLabel: 'Tất cả kho', result: CATEGORY_RESULT, visibleOnly: true }
        )

    it('một file hai sheet, sheet KG trước sheet danh mục', () => {
        const sheets = plan()
        expect(sheets.map(s => s.sheetName)).toEqual(['Khoi luong KG', 'Danh muc vi tri'])
        expect(sheets[0].title).toContain('khối lượng')
        expect(sheets[1].title).toContain('danh mục')
        expect(sheets.map(s => s.chart?.kind)).toEqual(['donut', 'donut'])
        expect(sheets[0].totalRow?.[3]).toBe(700.5)
        expect(sheets[1].rows?.[0]).toEqual(['SẦU RIÊNG', 1414, 68.2, 18.1])
    })

    it('writeBuffer ra workbook có đúng 2 sheet kèm bảng số của từng tab', async () => {
        const sheets = plan().map(({ chart, ...sheet }) => ({
            ...sheet,
            image: { base64: TINY_PNG, width: 720, height: 200 } as DashboardChartImage
        }))
        const wb = await bufferToWorkbook((await buildWorkbookFromSheets(sheets).xlsx.writeBuffer()) as ArrayBuffer)
        expect(wb.worksheets.map(w => w.name)).toEqual(['Khoi luong KG', 'Danh muc vi tri'])

        const posSheet = wb.getWorksheet('Danh muc vi tri')!
        const headerRow = headerRowOf(posSheet, 'Danh mục')
        expect((posSheet.getRow(headerRow).values as unknown as Array<string | null>).slice(1)).toEqual([
            'Danh mục',
            'Số ô vị trí',
            'Tỉ lệ hàng hoá',
            'Tỉ lệ công suất'
        ])
        expect(posSheet.getRow(headerRow + 1).getCell(2).value).toBe(1414)
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
