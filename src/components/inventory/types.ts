import { Database } from '@/lib/database.types'

export type Product = Database['public']['Tables']['products']['Row'] & {
    stock_quantity?: number
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
}

export interface OrderFormProps<T> {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editOrderId?: string | null
    systemCode: string
}
