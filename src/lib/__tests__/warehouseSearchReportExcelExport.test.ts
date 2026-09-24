import { describe, it, expect, vi } from 'vitest'
import { exportWarehouseSearchReportToExcel, SearchReportExcelItem } from '../warehouseSearchReportExcelExport'

// Mock file-saver
vi.mock('file-saver', () => ({
    saveAs: vi.fn()
}))

describe('exportWarehouseSearchReportToExcel', () => {
    it('generates an excel report with correct sheets and calculations', async () => {
        const mockItems: SearchReportExcelItem[] = [
            {
                stt: 1,
                productName: 'TP cấp đông sầu riêng múi monthong B (1 túi) - Hầm đông',
                sku: 'SP001',
                positionCode: 'K1D1A01T101',
                zonePath: 'Kho 1 • Dãy 1 • Ô 1 • Tầng 1',
                warehouse: 'Kho 1',
                date: '2026-07-02',
                dateFormatted: '02/07/2026',
                dateType: 'Ngày nhập kho',
                packagingDateFormatted: '01/07/2026',
                peelingDateFormatted: '30/06/2026',
                quantity: 30,
                unit: 'Thùng',
                lotCode: 'LOT-2026-001',
                productionName: 'LSX-001'
            },
            {
                stt: 2,
                productName: 'TP cấp đông sầu riêng múi monthong B (1 túi) - Hầm đông',
                sku: 'SP001',
                positionCode: 'K1D1A01T201',
                zonePath: 'Kho 1 • Dãy 1 • Ô 1 • Tầng 2',
                warehouse: 'Kho 1',
                date: '2026-09-23',
                dateFormatted: '23/09/2026',
                dateType: 'Ngày nhập kho',
                quantity: 32,
                unit: 'Thùng',
                lotCode: 'LOT-2026-002',
                productionName: 'LSX-002'
            }
        ]

        const fileName = await exportWarehouseSearchReportToExcel({
            items: mockItems,
            searchTerm: 'TP cấp đông sầu riêng',
            systemName: 'Kho 1',
            sortDescription: 'Theo ngày (Từ nhỏ đến lớn / Cũ đến mới)',
            dateFieldDescription: 'Tự động',
            totalPositions: 2,
            totalQuantity: 62,
            oldestDate: '02/07/2026',
            newestDate: '23/09/2026',
            companyInfo: { name: 'CÔNG TY TNHH XNK TRÁI CÂY CHÁNH THU' }
        })

        expect(fileName).toBeDefined()
        expect(fileName).toContain('.xlsx')
    })
})
