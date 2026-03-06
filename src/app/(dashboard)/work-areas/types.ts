import { Database } from '@/lib/database.types'

export type WorkArea = {
    id: string
    created_at: string
    updated_at: string
    name: string
    code: string | null
    description: string | null
    system_code: string | null
    company_id: string | null
    is_active: boolean
}

export type WorkAreaInsert = Omit<WorkArea, 'id' | 'created_at' | 'updated_at'>
export type WorkAreaUpdate = Partial<WorkAreaInsert>
