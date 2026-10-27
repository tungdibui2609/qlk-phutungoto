import { describe, it, expect, vi, beforeEach } from 'vitest'
import ExcelJS from 'exceljs'
import { exportOrderReportToExcel } from '../exportOrderReportExcelExport'

const saveAsMock = vi.fn()
vi.mock('file-saver', () => ({
    saveAs: (...args: any[]) => saveAsMock(...args)
}))

const baseOptions = {
    systemName: 'Kho Bao Bì',
    dateFrom: '2026-10-01',
    dateTo: '2026-10-27',
    summary: [
        { label: 'Tổng số lệnh xuất', value: 2 },
        { label: 'Tổng SL đã xuất', value: '130' },
    ],
    dayRows: [
        { date: '25/10/2026', taskCount: 2, lineCount: 3, requestedQty: 150, exportedQty: 130, completedTasks: 1 },
    ],
    productRows: [
        { productName: 'Thùng 5 lớp', sku: 'HH001', unit: 'Cái', lineCount: 2, requestedQty: 100, exportedQty: 80 },
    ],
    pickRows: [
        { date: '25/10/2026', hour: '14:20', pickerName: 'Nguyễn Văn A', productName: 'Thùng 5 lớp', sku: 'HH001', taskCode: 'XK-001', quantity: 80, unit: 'Cái', note: '' },
    ],
    detailRows: [
        {
            taskCode: 'XK-001', taskCreatedAt: '25/10/2026 09:00', taskStatus: 'Completed',
            productName: 'Thùng 5 lớp', sku: 'HH001', productionCode: 'L015DD260-TN', lotCode: 'DL-LOT-280526-013',
            positionCode: 'K1D1A01T101', requestedQty: 100, exportedQty: 80, unit: 'Cái', lineStatus: 'Exported', itemNotes: '',
        },
    ],
    companyInfo: { name: 'CÔNG TY TNHH XNK TRÁI CÂY CHÁNH THU' },
}

async function readWorkbook(blob: Blob) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await blob.arrayBuffer())
    return wb
}

describe('exportOrderReportToExcel', () => {
    beforeEach(() => saveAsMock.mockClear())

    it('tạo file .xlsx với 5 sheet và gọi saveAs', async () => {
        const fileName = await exportOrderReportToExcel(baseOptions)

        expect(fileName).toContain('.xlsx')
        expect(fileName).toContain('Thong_ke_xuat_kho_2026-10-01_2026-10-27')
        expect(saveAsMock).toHaveBeenCalledTimes(1)

        const wb = await readWorkbook(saveAsMock.mock.calls[0][0] as Blob)
        expect(wb.worksheets.map(w => w.name)).toEqual([
            'Tong hop', 'Theo ngay', 'Theo san pham', 'Chi tiet lenh xuat', 'Lịch sử hạ hàng',
        ])
    })

    it('ghi đúng dữ liệu dòng ngày và dòng sản phẩm vào sheet', async () => {
        await exportOrderReportToExcel(baseOptions)
        const wb = await readWorkbook(saveAsMock.mock.calls[0][0] as Blob)

        const wsDay = wb.getWorksheet('Theo ngay')!
        expect(wsDay.getCell('A1').value).toBe('SẢN LƯỢNG XUẤT THEO NGÀY')
        expect(wsDay.getCell('A4').value).toBe('STT')
        expect(wsDay.getRow(5).cellCount).toBeGreaterThan(0)
        expect(wsDay.getCell('B5').value).toBe('25/10/2026')
        expect(wsDay.getCell('E5').value).toBe(150)
        expect(wsDay.getCell('F5').value).toBe(130)

        const wsProduct = wb.getWorksheet('Theo san pham')!
        expect(wsProduct.getCell('B5').value).toBe('Thùng 5 lớp')
        expect(wsProduct.getCell('H5').value).toContain('20%')
    })

    it('bỏ qua sheet lịch sử hạ hàng khi phân hệ chưa có dữ liệu pick', async () => {
        await exportOrderReportToExcel({ ...baseOptions, pickRows: [] })
        const wb = await readWorkbook(saveAsMock.mock.calls[0][0] as Blob)

        expect(wb.worksheets.map(w => w.name)).toEqual([
            'Tong hop', 'Theo ngay', 'Theo san pham', 'Chi tiet lenh xuat',
        ])
    })
})
