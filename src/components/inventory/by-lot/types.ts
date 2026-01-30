import { Database } from '@/lib/database.types'

export type Lot = Database['public']['Tables']['lots']['Row'] & {
    lot_items: (Database['public']['Tables']['lot_items']['Row'] & {
        unit: string | null
        products: { name: string; unit: string; product_code?: string; sku: string; system_type: string } | null
    })[] | null
    suppliers: { name: string } | null
    positions: { code: string }[] | null
    lot_tags: { tag: string; lot_item_id: string | null }[] | null
    // Legacy support
    products: { name: string; unit: string; product_code?: string; sku: string; system_type: string } | null
}

export interface GroupedProduct {
    key: string
    productSku: string
    productCode: string
    productName: string
    unit: string
    totalQuantity: number
    variants: Map<string, number> // CompositeTag -> Quantity
    lotCodes: string[]
}
