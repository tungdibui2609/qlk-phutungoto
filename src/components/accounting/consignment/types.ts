export type ConsignmentDirection = 'INBOUND' | 'OUTBOUND'
export type ConsignmentOutboundPurpose = 'RETURN_TO_MAIN' | 'DIRECT_DELIVERY' | 'ADJUSTMENT'
export type ConsignmentOrderStatus = 'Pending' | 'Completed' | 'Cancelled'

export interface ConsignmentWarehouse {
    id: string
    company_id: string | null
    system_code: string
    code: string
    name: string
    address: string | null
    contact_name: string | null
    contact_phone: string | null
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface ConsignmentOrderItem {
    id?: string
    order_id?: string
    product_id: string | null
    product_name: string
    sku: string | null
    unit: string
    quantity: number
    batch_code: string | null
    note: string | null
    products?: {
        id: string
        sku: string
        name: string
        unit: string | null
        internal_code?: string | null
        internal_name?: string | null
        aliases?: string | null
    } | null
}

export interface ConsignmentOrder {
    id: string
    company_id: string | null
    system_code: string
    code: string
    direction: ConsignmentDirection
    outbound_purpose: ConsignmentOutboundPurpose | null
    consignment_warehouse_id: string
    status: ConsignmentOrderStatus
    order_date: string
    description: string | null
    partner_name: string | null
    vehicle_number: string | null
    driver_name: string | null
    source_outbound_order_id: string | null
    source_outbound_order_code: string | null
    linked_inbound_order_id: string | null
    linked_inbound_order_code: string | null
    metadata: Record<string, any> | null
    created_by: string | null
    created_at: string
    updated_at: string
    consignment_warehouses?: {
        id: string
        code: string
        name: string
    } | null
    items?: ConsignmentOrderItem[]
}

export interface ConsignmentInventoryRow {
    key: string
    warehouseId: string
    warehouseName: string
    productId: string | null
    sku: string
    productName: string
    internalCode?: string | null
    internalName?: string | null
    aliases?: string | null
    unit: string
    opening: number
    qtyIn: number
    qtyOutReturn: number
    qtyOutDirect: number
    qtyOutTotal: number
    balance: number
}

export const OUTBOUND_PURPOSE_LABELS: Record<ConsignmentOutboundPurpose, string> = {
    RETURN_TO_MAIN: 'Lấy về kho gốc',
    DIRECT_DELIVERY: 'Giao thẳng / Xuất khác',
    ADJUSTMENT: 'Điều chỉnh / Hao hụt'
}
