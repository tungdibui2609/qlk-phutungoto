import { Database } from '@/lib/database.types'

export type DBZone = Database['public']['Tables']['zones']['Row']
export type DBPosition = Database['public']['Tables']['positions']['Row']

export interface LocalZone extends DBZone {
    _status?: 'new' | 'modified' | 'deleted' | 'existing'
}

export interface LocalPosition extends DBPosition {
    _status?: 'new' | 'modified' | 'deleted' | 'existing'
}

export interface ZoneTemplate {
    id: string
    name: string
    structure: TemplateNode
    createdAt: string
}

export interface TemplateNode {
    code: string
    name: string
    children: TemplateNode[]
}
