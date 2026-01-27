import { render, screen, cleanup } from '@testing-library/react'
import { vi, describe, it, expect, afterEach } from 'vitest'
import OutboundOrderModal from './OutboundOrderModal'
import * as useOutboundOrderHook from './useOutboundOrder'

afterEach(() => {
    cleanup()
})

// Mock PartnerSelect to inspect props
vi.mock('../shared/PartnerSelect', () => ({
    PartnerSelect: (props: any) => (
        <div data-testid="partner-select">
            <span data-testid="selected-id">{props.selectedId}</span>
            <span data-testid="partner-name">{props.partnerName}</span>
        </div>
    )
}))

// Mock dependencies
vi.mock('./useOutboundOrder')
vi.mock('@/contexts/SystemContext', () => ({
    useSystem: () => ({ currentSystem: { outbound_modules: [] } })
}))
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ showToast: vi.fn() })
}))

// Mock other components to avoid rendering errors
vi.mock('../shared/OrderFormLayout', () => ({
    OrderFormLayout: ({ children }: any) => <div>{children}</div>
}))
vi.mock('../shared/OrderGeneralInfo', () => ({
    OrderGeneralInfo: () => <div>OrderGeneralInfo</div>
}))
vi.mock('../shared/LogisticsSection', () => ({
    LogisticsSection: () => <div>LogisticsSection</div>
}))
vi.mock('../shared/OrderImagesSection', () => ({
    OrderImagesSection: () => <div>OrderImagesSection</div>
}))
vi.mock('../shared/OrderDescription', () => ({
    OrderDescription: () => <div>OrderDescription</div>
}))
vi.mock('./OutboundItemsTable', () => ({
    OutboundItemsTable: () => <div>OutboundItemsTable</div>
}))
vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: () => <div>ConfirmDialog</div>
}))

describe('OutboundOrderModal', () => {
    it('passes correct selectedId to PartnerSelect when customer matches', () => {
        const mockCustomers = [
            { id: 'c1', name: 'Customer One' },
            { id: 'c2', name: 'Customer Two' }
        ]

        vi.spyOn(useOutboundOrderHook, 'useOutboundOrder').mockReturnValue({
            code: 'TEST',
            customerName: 'Customer One',
            customers: mockCustomers,
            hasModule: () => true,
            confirmDialog: { isOpen: false },
            items: [],
            loadingData: false,
            submitting: false,
            setCustomerName: vi.fn(),
            handleCustomerSelect: vi.fn(),
            products: [], units: [], branches: [], orderTypes: [],
            customerAddress: '',
            customerPhone: '',
            warehouseName: '',
            description: '',
            vehicleNumber: '',
            driverName: '',
            containerNumber: '',
            orderTypeId: '',
            images: [],
            targetUnit: '',
            addItem: vi.fn(),
            updateItem: vi.fn(),
            removeItem: vi.fn(),
            setVehicleNumber: vi.fn(),
            setDriverName: vi.fn(),
            setContainerNumber: vi.fn(),
            setOrderTypeId: vi.fn(),
            setImages: vi.fn(),
            setTargetUnit: vi.fn(),
            handleSubmit: vi.fn(),
            setConfirmDialog: vi.fn(),
            setCustomerAddress: vi.fn(),
            setCustomerPhone: vi.fn(),
            setWarehouseName: vi.fn(),
            setDescription: vi.fn(),
        } as any)

        render(<OutboundOrderModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} systemCode="sys" />)

        const selectedIdEl = screen.getByTestId('selected-id')
        expect(selectedIdEl.textContent).toBe('c1')
    })

    it('passes empty string to PartnerSelect when customer does not match', () => {
        const mockCustomers = [
            { id: 'c1', name: 'Customer One' }
        ]

        vi.spyOn(useOutboundOrderHook, 'useOutboundOrder').mockReturnValue({
            code: 'TEST',
            customerName: 'Unknown Customer',
            customers: mockCustomers,
            hasModule: () => true,
            confirmDialog: { isOpen: false },
            items: [],
            loadingData: false,
            submitting: false,
            setCustomerName: vi.fn(),
            handleCustomerSelect: vi.fn(),
            products: [], units: [], branches: [], orderTypes: [],
            customerAddress: '',
            customerPhone: '',
            warehouseName: '',
            description: '',
            vehicleNumber: '',
            driverName: '',
            containerNumber: '',
            orderTypeId: '',
            images: [],
            targetUnit: '',
            addItem: vi.fn(),
            updateItem: vi.fn(),
            removeItem: vi.fn(),
            setVehicleNumber: vi.fn(),
            setDriverName: vi.fn(),
            setContainerNumber: vi.fn(),
            setOrderTypeId: vi.fn(),
            setImages: vi.fn(),
            setTargetUnit: vi.fn(),
            handleSubmit: vi.fn(),
            setConfirmDialog: vi.fn(),
            setCustomerAddress: vi.fn(),
            setCustomerPhone: vi.fn(),
            setWarehouseName: vi.fn(),
            setDescription: vi.fn(),
        } as any)

        render(<OutboundOrderModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} systemCode="sys" />)

        const selectedIdEl = screen.getByTestId('selected-id')
        expect(selectedIdEl.textContent).toBe('')
    })
})
