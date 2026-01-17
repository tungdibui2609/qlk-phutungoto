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
                    manufacturer: string | null
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
                    manufacturer?: string | null
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
                    manufacturer?: string | null
                }
            }
            suppliers: {
                Row: {
                    id: string
                    created_at: string
                    code: string
                    name: string
                    contact_name: string | null
                    contact_person: string | null
                    email: string | null
                    phone: string | null
                    address: string | null
                    tax_code: string | null
                    website: string | null
                    note: string | null
                    status: string | null
                    is_active: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    code: string
                    name: string
                    contact_name?: string | null
                    contact_person?: string | null
                    email?: string | null
                    phone?: string | null
                    address?: string | null
                    tax_code?: string | null
                    website?: string | null
                    note?: string | null
                    status?: string | null
                    is_active?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    code?: string
                    name?: string
                    contact_name?: string | null
                    contact_person?: string | null
                    email?: string | null
                    phone?: string | null
                    address?: string | null
                    tax_code?: string | null
                    website?: string | null
                    note?: string | null
                    status?: string | null
                    is_active?: boolean
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
                    created_at: string
                    warehouse_name: string | null
                    description: string | null
                    supplier_address: string | null
                    supplier_phone: string | null
                    image_url: string | null
                }
                Insert: {
                    id?: string
                    code: string
                    status?: string
                    created_at?: string
                    warehouse_name?: string | null
                    description?: string | null
                    supplier_address?: string | null
                    supplier_phone?: string | null
                    image_url?: string | null
                }
                Update: {
                    id?: string
                    code?: string
                    status?: string
                    created_at?: string
                    warehouse_name?: string | null
                    description?: string | null
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
            categories: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    description: string | null
                    slug: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    description?: string | null
                    slug?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    description?: string | null
                    slug?: string | null
                }
            }
            vehicles: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    license_plate: string
                    driver_name: string | null
                    driver_phone: string | null
                    status: string
                    description: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    license_plate: string
                    driver_name?: string | null
                    driver_phone?: string | null
                    status?: string
                    description?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    license_plate?: string
                    driver_name?: string | null
                    driver_phone?: string | null
                    status?: string
                    description?: string | null
                }
            }
        }
    }
}
