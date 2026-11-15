import { Database } from '@/lib/database.types'
import { format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'

export type PendingAssignment = {
    id: string
    position_id: string
    lot_stt: number
    production_date: string
    system_code: string
    created_at: string
    status: string
    position?: {
        code: string
        id: string
    }
    lot?: {
        id: string
        code: string
        product_names: string[]
        product_skus: string[]
        tags?: string[]
        total_quantity: number
        total_weight_kg: number
        quantity_display: string
        production_code: string | null
        production_lot_code: string | null
        production_order_code: string | null
    }
    assignment_type?: 'new' | 'move'
    old_position_code?: string
}

export type Lot = Database['public']['Tables']['lots']['Row'] & {
    product_names?: string[]
    product_skus?: string[]
    tags?: string[]
    positions?: { code: string }[]
    lot_tags?: { tag: string; lot_item_id?: string | null }[]
}

export function extractLotTags(l: any): string[] {
    const tags: string[] = []
    if (Array.isArray(l?.lot_tags) && l.lot_tags.length > 0) {
        l.lot_tags.forEach((t: any) => {
            const val = typeof t === 'string' ? t.trim() : t?.tag?.trim()
            if (val && !tags.includes(val)) tags.push(val)
        })
    }
    const metaTag = (l?.metadata as any)?.pallet_tag || (l?.metadata as any)?.tag
    if (metaTag && typeof metaTag === 'string' && !tags.includes(metaTag.trim())) {
        tags.push(metaTag.trim())
    }
    return tags
}

export function safeFormatDate(dateVal: string | null | undefined, fmt: string = 'dd/MM/yyyy', fallback: string = '---'): string {
    if (!dateVal) return fallback
    try {
        const d = new Date(dateVal)
        if (isNaN(d.getTime())) return fallback
        return format(d, fmt)
    } catch {
        return fallback
    }
}

export function getLotDateStr(l: any): string {
    if (l?.inbound_date) return l.inbound_date.split('T')[0]
    if (l?.created_at) {
        try {
            return format(new Date(l.created_at), 'yyyy-MM-dd')
        } catch {
            return l.created_at.split('T')[0]
        }
    }
    return ''
}

