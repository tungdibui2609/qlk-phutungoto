export interface MaterialZone {
    id: string
    code: string | null
    name: string
    location: string | null
    province: string | null
    area_ha: number | null
    farmer_name: string | null
    phone: string | null
    certification: string | null
    notes: string | null
    is_active: boolean
    system_code: string | null
    company_id: string | null
    created_at: string
    updated_at: string
}

export type MaterialZoneInsert = Omit<MaterialZone, 'id' | 'created_at' | 'updated_at'>
