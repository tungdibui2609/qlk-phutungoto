import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Define the AuditLogs structure
type AuditLogsTable = {
    Row: {
        id: string
        table_name: string
        record_id: string
        action: 'CREATE' | 'UPDATE' | 'DELETE'
        old_data: any | null
        new_data: any | null
        changed_by: string | null
        created_at: string
    }
    Insert: {
        id?: string
        table_name: string
        record_id: string
        action: 'CREATE' | 'UPDATE' | 'DELETE'
        old_data?: any | null
        new_data?: any | null
        changed_by?: string | null
        created_at?: string
    }
    Update: {
        id?: string
        table_name?: string
        record_id?: string
        action?: 'CREATE' | 'UPDATE' | 'DELETE'
        old_data?: any | null
        new_data?: any | null
        changed_by?: string | null
        created_at?: string
    }
    Relationships: [
        {
            foreignKeyName: "audit_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
        }
    ]
}

type InventoryChecksTable = {
    Row: {
        id: string
        code: string
        warehouse_id: string | null
        warehouse_name: string | null
        status: 'DRAFT' | 'IN_PROGRESS' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'CANCELLED' | 'REJECTED'
        note: string | null
        created_by: string | null
        created_at: string
        updated_at: string
        completed_at: string | null
        system_code: string
        reviewer_id: string | null
        reviewed_at: string | null
        rejection_reason: string | null
        approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
        adjustment_inbound_order_id: string | null
        adjustment_outbound_order_id: string | null
    }
    Insert: {
        id?: string
        code: string
        warehouse_id?: string | null
        warehouse_name?: string | null
        status?: 'DRAFT' | 'IN_PROGRESS' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'CANCELLED' | 'REJECTED'
        note?: string | null
        created_by?: string | null
        created_at?: string
        updated_at?: string
        completed_at?: string | null
        system_code: string
        reviewer_id?: string | null
        reviewed_at?: string | null
        rejection_reason?: string | null
        approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
        adjustment_inbound_order_id?: string | null
        adjustment_outbound_order_id?: string | null
    }
    Update: {
        id?: string
        code?: string
        warehouse_id?: string | null
        warehouse_name?: string | null
        status?: 'DRAFT' | 'IN_PROGRESS' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'CANCELLED' | 'REJECTED'
        note?: string | null
        created_by?: string | null
        created_at?: string
        updated_at?: string
        completed_at?: string | null
        system_code?: string
        reviewer_id?: string | null
        reviewed_at?: string | null
        rejection_reason?: string | null
        approval_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
        adjustment_inbound_order_id?: string | null
        adjustment_outbound_order_id?: string | null
    }
    Relationships: [
        {
            foreignKeyName: "inventory_checks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
        },
        {
            foreignKeyName: "inventory_checks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
        }
    ]
}

type InventoryCheckItemsTable = {
    Row: {
        id: string
        check_id: string
        lot_id: string | null
        lot_item_id: string | null
        product_id: string
        system_quantity: number
        actual_quantity: number | null
        difference: number
        unit: string | null
        note: string | null
        created_at: string
        lot_code?: string | null
        product_sku?: string | null
        product_name?: string | null
    }
    Insert: {
        id?: string
        check_id: string
        lot_id?: string | null
        lot_item_id?: string | null
        product_id: string
        system_quantity?: number
        actual_quantity?: number | null
        difference?: number
        unit?: string | null
        note?: string | null
        created_at?: string
        lot_code?: string | null
        product_sku?: string | null
        product_name?: string | null
    }
    Update: {
        id?: string
        check_id?: string
        lot_id?: string | null
        lot_item_id?: string | null
        product_id?: string
        system_quantity?: number
        actual_quantity?: number | null
        difference?: number
        unit?: string | null
        note?: string | null
        created_at?: string
        lot_code?: string | null
        product_sku?: string | null
        product_name?: string | null
    }
    Relationships: [
        {
            foreignKeyName: "inventory_check_items_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "inventory_checks"
            referencedColumns: ["id"]
        },
        {
            foreignKeyName: "inventory_check_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
        }
    ]
}

type OperationalNotesTable = {
    Row: {
        id: string
        content: string
        user_id: string
        parent_id: string | null
        images: string[]
        created_at: string
        updated_at: string
    }
    Insert: {
        id?: string
        content: string
        user_id: string
        parent_id?: string | null
        images?: string[]
        created_at?: string
        updated_at?: string
    }
    Update: {
        id?: string
        content?: string
        user_id?: string
        parent_id?: string | null
        images?: string[]
        created_at?: string
        updated_at?: string
    }
    Relationships: [
        {
            foreignKeyName: "operational_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
        },
        {
            foreignKeyName: "operational_notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "operational_notes"
            referencedColumns: ["id"]
        }
    ]
}

// Extend the existing Tables type using intersection
type TypedTables = Database['public']['Tables'] & {
    audit_logs: AuditLogsTable
    inventory_checks: InventoryChecksTable
    inventory_check_items: InventoryCheckItemsTable
    operational_notes: OperationalNotesTable
}

// Manually extend the Database type
export type TypedDatabase = Omit<Database, 'public'> & {
    public: {
        Tables: TypedTables
        Views: Database['public']['Views']
        Functions: Database['public']['Functions']
        Enums: Database['public']['Enums']
        CompositeTypes: Database['public']['CompositeTypes']
    }
}

export const createClient = () =>
    createBrowserClient<TypedDatabase>(supabaseUrl, supabaseKey)

// Export a typed client instance
export const supabase = createBrowserClient<TypedDatabase>(supabaseUrl, supabaseKey)
