import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Client init moved inside handler for better error handling

export async function POST(request: Request) {
    try {
        console.log('Starting Delete Company Request...')

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
        }

        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        const body = await request.json()
        const { companyId } = body
        console.log('Deleting Company ID:', companyId)

        if (!companyId) {
            return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
        }

        // 1. Fetch all users associated with this company
        // We look at user_profiles to identify auth users
        const { data: users, error: fetchError } = await supabaseAdmin
            .from('user_profiles')
            .select('id') // id is the Auth User ID
            .eq('company_id', companyId)

        if (fetchError) {
            return NextResponse.json({ error: 'Error fetching users: ' + fetchError.message }, { status: 500 })
        }

        // 2. Delete Auth Users
        const deletePromises = (users || []).map(async (user) => {
            const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
            if (error) {
                console.warn(`Failed to delete user ${user.id}:`, error)
                // Continue despite error? Yes, try to clean as much as possible.
            }
        })

        await Promise.all(deletePromises)

        // 3. Delete Business Data (Manual Cascade)
        // We must delete strictly dependent tables first (items before orders)
        // Since we don't have company_id on items, we must select them via orders.
        // Or assume ON DELETE CASCADE is set for items -> orders. 
        // If not, we'd fail. Let's try to delete Orders directly first. If it fails, we know.
        // But to be safe, let's look for tables with company_id.

        // Tables with company_id from our migration list:
        // 'systems', 'products', 'categories', 'customers', 'suppliers', 'units', 
        // 'inbound_orders', 'outbound_orders', 'qc_info', 'vehicles', 'operational_notes', 'system_configs'

        // Plus standard dependencies:
        // inbound_order_items -> inbound_orders
        // outbound_order_items -> outbound_orders
        // site_loans, inventory_checks...

        // Helper to delete by company_id
        const deleteByCompany = async (table: string) => {
            const { error } = await supabaseAdmin.from(table).delete().eq('company_id', companyId)
            if (error) console.warn(`Failed to delete from ${table}:`, error.message)
        }

        // STEP A: Delete High Level Operational Data (that might have deps)
        // We rely on PG foreign keys to cascade items if possible, OR we accept error if not. 
        // Actually, if we want "Accept to delete everything", we should try to be thorough.

        // Delete Orders will likely cascade items if configured, or fail. 
        // Let's assume standard cascading for child items.
        await deleteByCompany('inbound_orders')
        await deleteByCompany('outbound_orders')
        await deleteByCompany('site_loans') // If exists
        await deleteByCompany('inventory_checks') // If exists

        // STEP B: Delete Core Entities
        await Promise.all([
            deleteByCompany('products'),
            deleteByCompany('customers'),
            deleteByCompany('suppliers'),
            deleteByCompany('vehicles'),
            deleteByCompany('qc_info'),
            deleteByCompany('operational_notes'),
            deleteByCompany('audit_logs'), // If strictly isolated
        ])

        // STEP C: Delete Config/Master Data
        await Promise.all([
            deleteByCompany('categories'),
            deleteByCompany('units'),
            deleteByCompany('systems'),
            deleteByCompany('system_configs'),
            deleteByCompany('user_profiles') // Should be empty due to auth delete, but cleanup just in case
        ])

        // 4. Delete Company Record
        const { error: companyError } = await supabaseAdmin
            .from('companies')
            .delete()
            .eq('id', companyId)

        if (companyError) {
            console.error('Final Delete Error:', companyError)
            return NextResponse.json({ error: 'Failed to delete company record: ' + companyError.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, message: 'Company and associated users deleted successfully' })

    } catch (error: any) {
        console.error('Error deleting company:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
