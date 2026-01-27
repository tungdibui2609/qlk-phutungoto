/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBrowserClient } from '@supabase/ssr'
import { Database } from './database.types'

export type TypedDatabase = Database & {
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    role: string | null
                    email: string | null
                    avatar_url: string | null
                }
            }
            order_types: {
                Row: {
                    id: string
                    name: string
                    system_code: string
                    scope: 'INBOUND' | 'OUTBOUND'
                }
            }
            audit_logs: {
                Row: {
                    id: string
                    table_name: string
                    record_id: string
                    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'Other'
                    old_data: any
                    new_data: any
                    changed_by: string
                    created_at: string
                }
            }
            inventory_checks: {
                Row: {
                    id: string
                    code: string
                    warehouse_id: string | null
                    warehouse_name: string | null
                    status: 'DRAFT' | 'IN_PROGRESS' | 'WAITING_FOR_APPROVAL' | 'COMPLETED' | 'REJECTED' | 'CANCELLED'
                    note: string | null
                    created_by: string
                    system_code: string
                    created_at: string
                    updated_at: string
                    completed_at: string | null
                    reviewer_id: string | null
                    reviewed_at: string | null
                    rejection_reason: string | null
                    approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
                    adjustment_inbound_order_id: string | null
                    adjustment_outbound_order_id: string | null
                    scope: 'ALL' | 'PARTIAL' | null
                    participants: any
                }
            }
            inventory_check_items: {
                Row: {
                    id: string
                    check_id: string
                    lot_id: string | null
                    lot_item_id: string | null
                    product_id: string
                    product_sku: string | null
                    product_name: string | null
                    system_quantity: number
                    actual_quantity: number | null
                    difference: number
                    unit: string | null
                    note: string | null
                    created_at: string
                    lot_code: string | null
                }
            }
        }
    }
}

export const supabase = createBrowserClient<TypedDatabase>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
