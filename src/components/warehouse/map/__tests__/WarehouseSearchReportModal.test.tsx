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
        expect(screen.getByText('Xuất file Excel')).toBeDefined()

        // Bấm sang tab "Chi tiết vị trí" để thấy mã vị trí và ngày nhập
        const detailTabBtn = screen.getByText(/Chi tiết vị trí/)
        fireEvent.click(detailTabBtn)

        expect(screen.getByText('K1D1A01T101')).toBeDefined()
        expect(screen.getByText('K1D1A01T201')).toBeDefined()
        expect(screen.getByText('02/07/2026')).toBeDefined()
        expect(screen.getByText('23/09/2026')).toBeDefined()
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
        expect(screen.getByText('Mã SP (SKU)')).toBeDefined()
    })

    it('filters mixed pallet items when searching for a specific product', () => {
        // Pallet ghép: pos-mixed có 2 item (1 item khớp search, 1 item khác)
        const mixedPositions = [
            { id: 'pos-mixed', code: 'MIXED-01', lot_id: 'lot-mixed', zone_id: 'zone-1' }
        ]
        const mixedLotInfo = {
            'lot-mixed': {
                code: 'LOT-MIX',
                inbound_date: '2026-10-15',
                items: [
                    { product_name: 'TP cấp đông sầu riêng', sku: 'SR001', quantity: 30, unit: 'Thùng' },
                    { product_name: 'Mặt hàng khác không liên quan', sku: 'OTHER-999', quantity: 70, unit: 'Thùng' }
                ]
            }
        }

        render(
            <WarehouseSearchReportModal
                isOpen={true}
                onClose={vi.fn()}
                positions={mixedPositions}
                zones={mockZones}
                lotInfo={mixedLotInfo}
                searchTerm="TP cấp đông sầu riêng"
            />
        )

        // Bấm sang tab Chi tiết
        fireEvent.click(screen.getByText(/Chi tiết vị trí/))

        // Chỉ có sản phẩm khớp tìm kiếm
        expect(screen.getByText('SR001')).toBeDefined()
        expect(screen.queryByText('OTHER-999')).toBeNull()

        // Khi bấm nút toggle để xem tất cả mặt hàng trên vị trí
        const toggleBtn = screen.getByText('Chỉ mặt hàng tìm kiếm')
        fireEvent.click(toggleBtn)

        // Lúc này cả 2 sản phẩm đều hiển thị
        expect(screen.getByText('SR001')).toBeDefined()
        expect(screen.getByText('OTHER-999')).toBeDefined()
    })
})
