export interface ProductItem {
    id: string
    name: string
    sku?: string | null
    unit?: string | null
    weight_kg?: number | null
    aliases?: string | null
    internal_code?: string | null
    internal_name?: string | null
    available_units?: string[]
}

export interface OrderTypeItem {
    id: string
    code: string | null
    name: string
    scope?: string | null
    system_code?: string | null
    is_active?: boolean
}

export interface DeliveryJournalRecord {
    id: string
    delivery_code?: string | null
    item_name: string
    quantity_sent: number
    unit: string
    from_department: string
    to_department: string
    status: string
    notes: string | null
    sent_by_name: string | null
    sent_at: string
    received_by_warehouse_name?: string | null
    received_by_production_name?: string | null
    system_code?: string | null
    created_at?: string | null
}

export interface DeleteTargetShift {
    id: string
    title: string
    recordCount: number
}
