export interface ProductionPlace {
    id: string
    code: string | null
    name: string
    address: string | null
    location: string | null
    province: string | null
    contact_person: string | null
    phone: string | null
    capacity: string | null
    certification: string | null
    notes: string | null
    is_active: boolean
    system_code: string | null
    company_id: string | null
    created_at: string
    updated_at: string
}

export type ProductionPlaceInsert = Omit<ProductionPlace, 'id' | 'created_at' | 'updated_at'>
