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

// Extend the existing Tables type using intersection
type TypedTables = Database['public']['Tables'] & {
    audit_logs: AuditLogsTable
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
