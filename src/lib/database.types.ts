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
                    part_number: string | null
                    cross_reference_numbers: string[] | null
                    compatible_models: string[] | null
                    oem_number: string | null
                    origin_country: string | null
                    quality_grade: string | null
                    warranty_months: number | null
                    weight_kg: number | null
                    dimensions: string | null
                    lead_time_days: number | null
                    is_active: boolean
                    is_returnable: boolean
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
                    part_number?: string | null
                    cross_reference_numbers?: string[] | null
                    compatible_models?: string[] | null
                    oem_number?: string | null
                    origin_country?: string | null
                    quality_grade?: string | null
                    warranty_months?: number | null
                    weight_kg?: number | null
                    dimensions?: string | null
                    lead_time_days?: number | null
                    is_active?: boolean
                    is_returnable?: boolean
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
                    part_number?: string | null
                    cross_reference_numbers?: string[] | null
                    compatible_models?: string[] | null
                    oem_number?: string | null
                    origin_country?: string | null
                    quality_grade?: string | null
                    warranty_months?: number | null
                    weight_kg?: number | null
                    dimensions?: string | null
                    lead_time_days?: number | null
                    is_active?: boolean
                    is_returnable?: boolean
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
                    notes: string | null
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
                    notes?: string | null
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
                    notes?: string | null
                    status?: string | null
                    is_active?: boolean
                }
            }
            customers: {
                Row: {
                    id: string
                    created_at: string
                    code: string
                    name: string
                    contact_person: string | null
                    phone: string | null
                    email: string | null
                    address: string | null
                    tax_code: string | null
                    notes: string | null
                    is_active: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    code: string
                    name: string
                    contact_person?: string | null
                    phone?: string | null
                    email?: string | null
                    address?: string | null
                    tax_code?: string | null
                    notes?: string | null
                    is_active?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    code?: string
                    name?: string
                    contact_person?: string | null
                    phone?: string | null
                    email?: string | null
                    address?: string | null
                    tax_code?: string | null
                    notes?: string | null
                    is_active?: boolean
                }
            }
            branches: {
                Row: {
                    id: string
                    created_at: string
                    code: string | null
                    name: string
                    address: string | null
                    phone: string | null
                    is_active: boolean
                    is_default: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    code?: string | null
                    name: string
                    address?: string | null
                    phone?: string | null
                    is_active?: boolean
                    is_default?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    code?: string | null
                    name?: string
                    address?: string | null
                    phone?: string | null
                    is_active?: boolean
                    is_default?: boolean
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
                    notes: string | null
                    brand: string
                    model: string
                    body_type: string | null
                    year_from: number | null
                    year_to: number | null
                    engine_type: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    license_plate: string
                    driver_name?: string | null
                    driver_phone?: string | null
                    status?: string
                    notes?: string | null
                    brand: string
                    model: string
                    body_type?: string | null
                    year_from?: number | null
                    year_to?: number | null
                    engine_type?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    license_plate?: string
                    driver_name?: string | null
                    driver_phone?: string | null
                    status?: string
                    notes?: string | null
                    brand?: string
                    model?: string
                    body_type?: string | null
                    year_from?: number | null
                    year_to?: number | null
                    engine_type?: string | null
                }
            }
            roles: {
                Row: {
                    id: string
                    created_at: string
                    code: string
                    name: string
                    description: string | null
                    permissions: string[] | null
                    is_system: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    code: string
                    name: string
                    description?: string | null
                    permissions?: string[] | null
                    is_system?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    code?: string
                    name?: string
                    description?: string | null
                    permissions?: string[] | null
                    is_system?: boolean
                }
            }
            user_profiles: {
                Row: {
                    id: string
                    created_at: string
                    employee_code: string | null
                    full_name: string
                    phone: string | null
                    email: string | null
                    avatar_url: string | null
                    role_id: string | null
                    department: string | null
                    is_active: boolean
                    last_login: string | null
                }
                Insert: {
                    id: string
                    created_at?: string
                    employee_code?: string | null
                    full_name: string
                    phone?: string | null
                    email?: string | null
                    avatar_url?: string | null
                    role_id?: string | null
                    department?: string | null
                    is_active?: boolean
                    last_login?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    employee_code?: string | null
                    full_name?: string
                    phone?: string | null
                    email?: string | null
                    avatar_url?: string | null
                    role_id?: string | null
                    department?: string | null
                    is_active?: boolean
                    last_login?: string | null
                }
            }
            lots: {
                Row: {
                    id: string
                    created_at: string
                    code: string
                    notes: string | null
                    product_id: string | null
                    supplier_id: string | null
                    inbound_date: string | null
                    batch_code: string | null
                    quantity: number
                    status: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    code: string
                    notes?: string | null
                    product_id?: string | null
                    supplier_id?: string | null
                    inbound_date?: string | null
                    batch_code?: string | null
                    quantity?: number
                    status?: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    code?: string
                    notes?: string | null
                    product_id?: string | null
                    supplier_id?: string | null
                    inbound_date?: string | null
                    batch_code?: string | null
                    quantity?: number
                    status?: string
                }
            }
            lot_items: {
                Row: {
                    id: string
                    created_at: string
                    lot_id: string
                    product_id: string
                    quantity: number
                }
                Insert: {
                    id?: string
                    created_at?: string
                    lot_id: string
                    product_id: string
                    quantity?: number
                }
                Update: {
                    id?: string
                    created_at?: string
                    lot_id?: string
                    product_id?: string
                    quantity?: number
                }
            }
            positions: {
                Row: {
                    id: string
                    created_at: string
                    code: string
                    lot_id: string | null
                    status: string
                    batch_name: string | null
                    display_order: number | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    code: string
                    lot_id?: string | null
                    status?: string
                    batch_name?: string | null
                    display_order?: number | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    code?: string
                    lot_id?: string | null
                    status?: string
                    batch_name?: string | null
                    display_order?: number | null
                }
            }
            zones: {
                Row: {
                    id: string
                    created_at: string
                    code: string
                    name: string
                    parent_id: string | null
                    level: number
                }
                Insert: {
                    id?: string
                    created_at?: string
                    code: string
                    name: string
                    parent_id?: string | null
                    level?: number
                }
                Update: {
                    id?: string
                    created_at?: string
                    code?: string
                    name?: string
                    parent_id?: string | null
                    level?: number
                }
            }
            zone_positions: {
                Row: {
                    id: string
                    created_at: string
                    zone_id: string
                    position_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    zone_id: string
                    position_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    zone_id?: string
                    position_id?: string
                }
            }
            zone_layouts: {
                Row: {
                    id: string
                    created_at: string
                    zone_id: string
                    rows: number
                    cols: number
                    direction: string | null
                    custom_layout: Json | null
                    position_columns: number | null
                    cell_width: number | null
                    cell_height: number | null
                    child_layout: string | null
                    child_columns: number | null
                    child_width: number | null
                    collapsible: boolean | null
                    display_type: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    zone_id: string
                    rows?: number
                    cols?: number
                    direction?: string | null
                    custom_layout?: Json | null
                    position_columns?: number | null
                    cell_width?: number | null
                    cell_height?: number | null
                    child_layout?: string | null
                    child_columns?: number | null
                    child_width?: number | null
                    collapsible?: boolean | null
                    display_type?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    zone_id?: string
                    rows?: number
                    cols?: number
                    direction?: string | null
                    custom_layout?: Json | null
                    position_columns?: number | null
                    cell_width?: number | null
                    cell_height?: number | null
                    child_layout?: string | null
                    child_columns?: number | null
                    child_width?: number | null
                    collapsible?: boolean | null
                    display_type?: string | null
                }
            }
            inventory: {
                Row: {
                    id: string
                    created_at: string
                    product_id: string
                    position_id: string | null
                    quantity: number
                }
                Insert: {
                    id?: string
                    created_at?: string
                    product_id: string
                    position_id?: string | null
                    quantity?: number
                }
                Update: {
                    id?: string
                    created_at?: string
                    product_id?: string
                    position_id?: string | null
                    quantity?: number
                }
            }
            product_vehicle_compatibility: {
                Row: {
                    id: string
                    created_at: string
                    product_id: string
                    vehicle_id: string
                }
                Insert: {
                    id?: string
                    created_at?: string
                    product_id: string
                    vehicle_id: string
                }
                Update: {
                    id?: string
                    created_at?: string
                    product_id?: string
                    vehicle_id?: string
                }
            }
            company_settings: {
                Row: {
                    id: string
                    updated_at: string
                    name: string
                    short_name: string
                    tax_code: string | null
                    address: string | null
                    phone: string | null
                    email: string | null
                    website: string | null
                    logo_url: string | null
                }
                Insert: {
                    id?: string
                    updated_at?: string
                    name: string
                    short_name: string
                    tax_code?: string | null
                    address?: string | null
                    phone?: string | null
                    email?: string | null
                    website?: string | null
                    logo_url?: string | null
                }
                Update: {
                    id?: string
                    updated_at?: string
                    name?: string
                    short_name?: string
                    tax_code?: string | null
                    address?: string | null
                    phone?: string | null
                    email?: string | null
                    website?: string | null
                    logo_url?: string | null
                }
            }
            units: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    description: string | null
                    is_active: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    description?: string | null
                    is_active?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    description?: string | null
                    is_active?: boolean
                }
            }
            origins: {
                Row: {
                    id: string
                    created_at: string
                    name: string
                    code: string | null
                    description: string | null
                    is_active: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    name: string
                    code?: string | null
                    description?: string | null
                    is_active?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    name?: string
                    code?: string | null
                    description?: string | null
                    is_active?: boolean
                }
            },
            systems: {
                Row: {
                    code: string
                    name: string
                    description: string | null
                    icon: string | null
                    bg_color_class: string | null
                    text_color_class: string | null
                    is_active: boolean
                    created_at: string
                }
                Insert: {
                    code: string
                    name: string
                    description?: string | null
                    icon?: string | null
                    bg_color_class?: string | null
                    text_color_class?: string | null
                    is_active?: boolean
                    created_at?: string
                }
                Update: {
                    code?: string
                    name?: string
                    description?: string | null
                    icon?: string | null
                    bg_color_class?: string | null
                    text_color_class?: string | null
                    is_active?: boolean
                    created_at?: string
                }
            }
        }
    }
}
