import { describe, it, expect, vi } from 'vitest'
import ExcelJS from 'exceljs'
import { exportInventoryReportToExcel } from '../inventoryReportExcelExport'

const { savedBlobs } = vi.hoisted(() => ({ savedBlobs: [] as any[] }))

vi.mock('file-saver', () => ({
    saveAs: (blob: any) => savedBlobs.push(blob)
}))

async function loadRows(data: any): Promise<any[][]> {
    savedBlobs.length = 0
    await exportInventoryReportToExcel(data)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await savedBlobs[0].arrayBuffer())
    const ws = workbook.worksheets[0]
    return (ws.getRows(1, ws.rowCount)?.map(r => r.values) || []) as any[][]
}

const product = (code: string, name: string, qty: number, unit: string, pallets: string[]) => ({
    productCode: code, productName: name, quantity: qty, unit, lotCodes: pallets, isUnconvertible: false
})

describe('exportInventoryReportToExcel - tab Tồn theo Lệnh SX', () => {
    const items = [
        {
            orderCode: 'LSX030526',
            orderName: 'Lệnh sầu riêng tháng 5',
            lots: [
                {
                    lotCode: 'L015DD260-TN',
                    productionDate: '2026-05-03',
                    products: [
                        product('TP1010102.02.002', 'Sầu riêng múi loại 2', 36, 'Thùng (20kg)', ['DL-LOT-001', 'DL-LOT-002']),
                        product('TP1010102.02.004', 'Sầu riêng múi loại 4', 100, 'Kg', ['DL-LOT-003'])
                    ]
                }
            ]
        },
        {
            orderCode: 'Chưa gắn lệnh SX',
            orderName: null,
            lots: [
                {
                    lotCode: 'Không có mã lot SX',
                    productionDate: null,
                    products: [product('TP1010102.02.002', 'Sầu riêng múi loại 2', 14, 'Thùng (20kg)', ['DL-LOT-004'])]
                }
            ]
        }
    ]

    it('xu đủ 9 cột và một dòng cho mỗi (lệnh, lot SX, sản phẩm, đơn vị)', async () => {
        const rows = await loadRows({
            type: 'production', dateTitle: 'Tính đến ngày: 31/10/2026', warehouse: 'Tất cả',
            items, companyInfo: null
        })

        const header = rows.find(r => (r || []).includes('Mã Lot SX'))
        expect(header).toBeDefined()
        expect(header).toEqual(expect.arrayContaining(['Mã Lệnh SX', 'Mã Lot SX', 'Ngày SX', 'Mã SP', 'Tên sản phẩm', 'ĐVT', 'Số lượng', 'Số kiện']))

        const dataRows = rows.filter(r => (r || []).includes('LSX030526') || (r || []).includes('Chưa gắn lệnh SX'))
        expect(dataRows.length).toBe(3)

        const kgRow: any = dataRows.find(r => (r || []).includes('L015DD260-TN') && (r || []).includes('Kg'))
        expect(kgRow[8]).toBe(100)
        expect(kgRow[9]).toBe(1)
        expect(kgRow[4]).toBe('03/05/2026')
    })

    it('cộng dòng cuối theo từng đơn vị, không cộng xuyên đơn vị', async () => {
        const rows = await loadRows({
            type: 'production', dateTitle: 'Tính đến ngày: 31/10/2026', warehouse: 'Tất cả',
            items, companyInfo: null
        })

        const totals = rows.filter(r => typeof r?.[6] === 'string' && (r[6] as string).startsWith('TỔNG CỘNG'))
        expect(totals.length).toBe(2)

        const byUnit = Object.fromEntries(totals.map(r => [r[6], r[8]]))
        expect(byUnit['TỔNG CỘNG (Thùng (20kg))']).toBe(50)
        expect(byUnit['TỔNG CỘNG (Kg)']).toBe(100)
        expect(totals.some(r => r[8] === 150)).toBe(false)
    })

    it('gộp cách viết hoa khác nhau của cùng đơn vị thành một dòng tổng', async () => {
        const rows = await loadRows({
            type: 'production', dateTitle: 'Tính đến ngày: 31/10/2026', warehouse: 'Tất cả',
            companyInfo: null,
            items: [{
                orderCode: 'LSX010626', orderName: null,
                lots: [{
                    lotCode: 'L01', productionDate: null,
                    products: [
                        product('A', 'SP A', 30, 'Thùng (20kg)', ['P1']),
                        product('B', 'SP B', 20, 'Thùng (20 Kg)', ['P2'])
                    ]
                }]
            }]
        })

        const totals = rows.filter(r => typeof r?.[6] === 'string' && (r[6] as string).startsWith('TỔNG CỘNG'))
        expect(totals.length).toBe(1)
        expect(totals[0][6]).toBe('TỔNG CỘNG (Thùng (20kg))')
        expect(totals[0][8]).toBe(50)
    })
})

describe('exportInventoryReportToExcel - tiêu đề theo loại báo cáo', () => {
    it('tab Mã phụ in tiêu đề THEO MÃ PHỤ, không còn ghi nhầm THEO LOT', async () => {
        const rows = await loadRows({
            type: 'tags', dateTitle: 'Tính đến ngày: 31/10/2026', warehouse: 'Tất cả',
            items: [], companyInfo: null
        })
        expect(rows.flat()).toContain('BÁO CÁO TỒN KHO THEO MÃ PHỤ')
    })

    it('tab LOT vẫn giữ tiêu đề THEO LOT', async () => {
        const rows = await loadRows({
            type: 'lot', dateTitle: 'Tính đến ngày: 31/10/2026', warehouse: 'Tất cả',
            items: [], companyInfo: null
        })
        expect(rows.flat()).toContain('BÁO CÁO TỒN KHO THEO LOT')
    })
})
