/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WarehouseSearchReportModal } from '../WarehouseSearchReportModal'

afterEach(() => {
    cleanup()
})

// Mock SystemContext
vi.mock('@/contexts/SystemContext', () => ({
    useSystem: () => ({
        currentSystem: { name: 'Kho Chánh Thu', code: 'KHO_1' },
        systemType: 'KHO'
    })
}))

// Mock ToastProvider
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({
        showToast: vi.fn()
    })
}))

// Mock CompanyInfo
vi.mock('@/hooks/usePrintCompanyInfo', () => ({
    usePrintCompanyInfo: () => ({
        companyInfo: { name: 'CÔNG TY TNHH XNK TRÁI CÂY CHÁNH THU' }
    })
}))

// Mock Excel export
vi.mock('@/lib/warehouseSearchReportExcelExport', () => ({
    exportWarehouseSearchReportToExcel: vi.fn().mockResolvedValue('Bao_cao_test.xlsx')
}))

describe('WarehouseSearchReportModal', () => {
    const mockPositions = [
        { id: 'pos-1', code: 'K1D1A01T101', lot_id: 'lot-1', zone_id: 'zone-1' },
        { id: 'pos-2', code: 'K1D1A01T201', lot_id: 'lot-2', zone_id: 'zone-1' }
    ]

    const mockZones = [
        { id: 'zone-1', name: 'Kho 1', parent_id: null }
    ]

    const mockLotInfo = {
        'lot-1': {
            code: 'LOT-001',
            inbound_date: '2026-07-02',
            items: [
                { product_name: 'TP cấp đông sầu riêng', sku: 'SR001', quantity: 30, unit: 'Thùng' }
            ]
        },
        'lot-2': {
            code: 'LOT-002',
            inbound_date: '2026-09-23',
            items: [
                { product_name: 'TP cấp đông sầu riêng', sku: 'SR001', quantity: 32, unit: 'Thùng' }
            ]
        }
    }

    it('renders report modal with search statistics and table rows', () => {
        render(
            <WarehouseSearchReportModal
                isOpen={true}
                onClose={vi.fn()}
                positions={mockPositions}
                zones={mockZones}
                lotInfo={mockLotInfo}
                searchTerm="TP cấp đông sầu riêng"
            />
        )

        expect(screen.getByText('Báo cáo vị trí & sản phẩm theo ngày')).toBeDefined()
        expect(screen.getByText('K1D1A01T101')).toBeDefined()
        expect(screen.getByText('K1D1A01T201')).toBeDefined()
        expect(screen.getByText('02/07/2026')).toBeDefined()
        expect(screen.getByText('23/09/2026')).toBeDefined()
        expect(screen.getByText('Xuất file Excel')).toBeDefined()
    })

    it('allows changing sort order and tabs', () => {
        render(
            <WarehouseSearchReportModal
                isOpen={true}
                onClose={vi.fn()}
                positions={mockPositions}
                zones={mockZones}
                lotInfo={mockLotInfo}
                searchTerm="TP cấp đông sầu riêng"
            />
        )

        // Switch to "Tổng hợp theo ngày"
        const dateTabBtn = screen.getByText(/Tổng hợp theo ngày/)
        fireEvent.click(dateTabBtn)
        expect(screen.getByText('Số loại sản phẩm')).toBeDefined()

        // Switch to "Tổng hợp theo SP"
        const prodTabBtn = screen.getByText(/Tổng hợp theo SP/)
        fireEvent.click(prodTabBtn)
        expect(screen.getByText('Ngày cũ nhất')).toBeDefined()
        expect(screen.getByText('Ngày mới nhất')).toBeDefined()
    })
})
