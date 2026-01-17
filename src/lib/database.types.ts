export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            products: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    sku: string
                    barcode: string | null
                    description: string | null
                    category_id: string | null
                    unit: string | null
                    cost_price: number | null
                    retail_price: number | null
                    wholesale_price: number | null
                    stock_quantity: number
                    min_stock_level: number
                    max_stock_level: number | null
                    image_url: string | null
                    status: string | null
                    supplier_id: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    sku: string
                    barcode?: string | null
                    description?: string | null
                    category_id?: string | null
                    unit?: string | null
                    cost_price?: number | null
                    retail_price?: number | null
                    wholesale_price?: number | null
                    stock_quantity?: number
                    min_stock_level?: number
                    max_stock_level?: number | null
                    image_url?: string | null
                    status?: string | null
                    supplier_id?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    sku?: string
                    barcode?: string | null
                    description?: string | null
                    category_id?: string | null
                    unit?: string | null
                    cost_price?: number | null
                    retail_price?: number | null
                    wholesale_price?: number | null
                    stock_quantity?: number
                    min_stock_level?: number
                    max_stock_level?: number | null
                    image_url?: string | null
                    status?: string | null
                    supplier_id?: string | null
                }
            }
            suppliers: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    contact_name: string | null
                    email: string | null
                    phone: string | null
                    address: string | null
                    tax_code: string | null
                    website: string | null
                    note: string | null
                    status: string | null
                }
            }
            customers: {
                Row: {
                    id: string
                    name: string
                }
            }
            branches: {
                Row: {
                    id: string
                    name: string
                    is_default: boolean
                }
            }
            inbound_orders: {
                Row: {
                    id: string
                    code: string
                    status: string
                    supplier_address: string | null
                    supplier_phone: string | null
                    image_url: string | null
                }
                Insert: {
                    id?: string
                    code: string
                    status?: string
                    supplier_address?: string | null
                    supplier_phone?: string | null
                    image_url?: string | null
                }
                Update: {
                    id?: string
                    code?: string
                    status?: string
                    supplier_address?: string | null
                    supplier_phone?: string | null
                    image_url?: string | null
                }
            }
            outbound_orders: {
                Row: {
                    id: string
                    code: string
                    status: string
                    created_at: string
                    customer_name: string | null
                    warehouse_name: string | null
                    description: string | null
                    customer_address: string | null
                    customer_phone: string | null
                    image_url: string | null
                }
                Insert: {
                    id?: string
                    code: string
                    status?: string
                    created_at?: string
                    customer_name?: string | null
                    warehouse_name?: string | null
                    description?: string | null
                    customer_address?: string | null
                    customer_phone?: string | null
                    image_url?: string | null
                }
                Update: {
                    id?: string
                    code?: string
                    status?: string
                    created_at?: string
                    customer_name?: string | null
                    warehouse_name?: string | null
                    description?: string | null
                    customer_address?: string | null
                    customer_phone?: string | null
                    image_url?: string | null
                }
            }
            outbound_order_items: {
                Row: {
                    id: string
                    order_id: string
                    product_id: string | null
                    product_name: string | null
                    unit: string | null
                    quantity: number
                    price: number
                    note: string | null
                }
                Insert: {
                    id?: string
                    order_id: string
                    product_id?: string | null
                    product_name?: string | null
                    unit?: string | null
                    quantity?: number
                    price?: number
                    note?: string | null
                }
            }
        }
    }
}
