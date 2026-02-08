import { Database } from '@/lib/database.types'

export type Product = Database['public']['Tables']['products']['Row'] & {
    stock_quantity?: number
    stock_details?: string
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
    isDocQtyVisible?: boolean
    isNoteOpen?: boolean
    needsUnbundle?: boolean
    unbundleInfo?: string
}

export interface OrderFormProps<T> {
    isOpen: boolean
    onClose: () => void
    onSuccess: (id?: string) => void
    editOrderId?: string | null
    initialData?: any
    systemCode: string
}

export type ProductWithCategory = {
    id: string
    sku: string
    name: string
    manufacturer: string | null
    part_number: string | null
    image_url: string | null
    min_stock_level: number | null
    unit: string | null
    price: number | null
    categories: {
        name: string
    } | null
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
