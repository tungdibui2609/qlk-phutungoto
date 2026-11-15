export interface BoxLabelItem {
    id: string
    code: string
    lot_id?: string | null
    quantity: number
    unit: string
    status: string
    semi_finished_lot_code: string | null
    finished_lot_code: string | null
    created_at: string
    metadata?: {
        pallet_stt?: string
        pallet_local_id?: string
        tag?: string | null
        scan_type?: string
        stamp_line1?: string
        stamp_line2?: string
        box_index?: number | string
        sku?: string
        product_name?: string
        spec?: string
        shift_group?: string
        region?: string
        production_date?: string
        packaging_date?: string
        raw_material_date?: string
        [key: string]: any
    } | null
    products: {
        name: string
        sku: string
        internal_name: string | null
    } | null
}

export interface PalletLot {
    id: string
    code: string
    daily_seq?: number | null
    status?: string | null
    production_code: string | null
    system_code: string
    company_id: string | null
    created_at: string
    inbound_date: string | null
    packaging_date?: string | null
    peeling_date?: string | null
    raw_material_date?: string | null
    notes?: string | null
    metadata?: any
    quantity: number
    product_id?: string | null
    products: { id?: string; name: string; sku: string } | null
    box_labels: BoxLabelItem[]
}

export interface UnlinkedPalletGroup {
    pallet_stt: string
    pallet_tag?: string | null
    pallet_notes?: string | null
    boxes: BoxLabelItem[]
    total_weight: number
    created_at: string
    isConflict?: boolean
    matchedLot?: {
        id: string
        code: string
        daily_seq?: number | null
        status?: string | null
        product_name?: string
        quantity?: number
        created_at?: string
        existingBoxesCount?: number
        existingTotalWeight?: number
    } | null
}

export interface WarehouseProduct {
    id: string
    name: string
    sku: string
    unit: string | null
    weight_kg?: number | null
    aliases?: string | null
    internal_name?: string | null
    internal_code?: string | null
}


export interface ApproveLotProductLine {
    id: string
    product_id: string
    product: WarehouseProduct | null
    quantity: number
    weight: number
    unit: string
    box_ids?: string[]
    stamp_code?: string
    matchReason?: string
}

