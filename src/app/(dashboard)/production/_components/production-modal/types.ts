export interface ProductionLot {
    id?: string
    lot_code: string
    product_id: string | null
    weight_per_unit: number
    planned_quantity?: number | null
    actual_quantity?: number // Added for display
    inventory_quantity?: number // Added for display
    unit?: string // Added for display (Product base unit)
    product_name?: string // UI helper
    conversion_rules?: { factor: number; unit_name: string; ref_unit_name: string }[] // Linked rules
    quantity_by_unit?: { qty: number; current_qty?: number; unit: string }[] // Linked units stats
    is_locked?: boolean // Locked status
    production_date?: string | null // Production date
}

export interface ProductionModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editItem?: any | null
    readOnly?: boolean
}
