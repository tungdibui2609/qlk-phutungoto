export interface ProductionLotData {
    id: string
    lot_code: string
    actual_quantity: number
    planned_quantity: number
    created_at: string
    products: {
        name: string
        sku: string
        unit: string
    }
    productions: {
        id: string
        code: string
        name: string
        last_sheet_index?: number
    }
}

export interface PrintConfigState {
    template: string
    sheet_template: string
    paper_size: string
    code_prefix: string
    month_val: string
    custom_lot_code: string
    specification: string
    net_weight: string
    team_group: string
    material_region: string
    production_date: string
    packing_date: string
    created_date: string
    label_count: number
    start_index: number
    is_random_index: boolean
    random_from_index: number
    random_to_index: number
    random_count: number
    show_production_date: boolean
    show_packing_date: boolean
}

export interface PrintToastState {
    show: boolean
    message: string
    type: 'success' | 'error'
}

export interface SheetLabelItem {
    qr_code: string
    stt: number
}
