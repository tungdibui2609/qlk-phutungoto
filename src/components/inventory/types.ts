import { Database } from '@/lib/database.types'

export type Product = Database['public']['Tables']['products']['Row'] & {
    stock_quantity?: number
    stock_details?: string
    internal_code?: string | null
    internal_name?: string | null
    aliases?: string | null
    part_number?: string | null
    product_units?: {
        unit_id: string
        conversion_rate: number
    }[]
}

export type Unit = Database['public']['Tables']['units']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type Customer = { id: string, name: string, address?: string | null, phone?: string | null }

export interface OrderItem {
    id: string
    productId: string
    productName: string
    unit: string
    quantity: number
    document_quantity: number
    price: number
    note: string
    batch_code?: string | null
    customer_name?: string | null
    customerId?: string | null
    categoryId?: string | null
    isDocQtyVisible?: boolean
    isNoteOpen?: boolean
    needsUnbundle?: boolean
    unbundleInfo?: string
    unbundleMeta?: any
    needsBundle?: boolean
    bundleInfo?: string
    bundleMeta?: any
    isBundleConfirmed?: boolean
}

export interface OrderFormProps<T> {
    isOpen: boolean
    onClose: () => void
    onSuccess: (id?: string) => void
    editOrderId?: string | null
    duplicateOrderId?: string | null
    initialData?: any
    systemCode: string
}

export type ProductWithCategory = {
    id: string
    sku: string
    name: string
    manufacturer: string | null
    part_number: string | null
    internal_code?: string | null
    internal_name?: string | null
    image_url: string | null
    min_stock_level: number | null
    unit: string | null
    price: number | null
    quantity_per_pallet?: number | null
    pallet_unit?: string | null
    boxes_per_container?: number | null
    packaging_specification?: string | null
    categories: {
        name: string
    } | null
    category_id: string | null
    product_category_rel?: {
        category_id: string
        is_primary: boolean
        categories: {
            id: string
            name: string
        } | null
    }[]
    product_media: {
        url: string
        type: string
    }[]
    product_units: {
        conversion_rate: number
        unit_id: string
    }[]
    is_active: boolean | null
    created_at: string
}
