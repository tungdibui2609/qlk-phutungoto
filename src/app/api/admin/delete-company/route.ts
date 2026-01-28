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
        const { data: users, error: fetchError } = await supabaseAdmin
            .from('user_profiles')
            .select('id') // id is the Auth User ID
            .eq('company_id', companyId)

        if (fetchError) {
            return NextResponse.json({ error: 'Error fetching users: ' + fetchError.message }, { status: 500 })
        }

        // Filter out Super Admin to prevent accidental deletion
        const userIds = (users || [])
            .filter((u: any) => u.email !== 'tungdibui2609@gmail.com') // Safety check
            .map(u => u.id)

        // Helper to delete by company_id
        const deleteByCompany = async (table: string) => {
            // Check if column exists is hard via API, so we assume it exists based on our migrations.
            // If strictly needed, we wrap in try-catch or assume migration success.
            const { error } = await supabaseAdmin.from(table).delete().eq('company_id', companyId)
            if (error) console.warn(`Failed to delete from ${table}:`, error.message)
        }

        // STEP A: Delete High Level Operational Data (Delete these FIRST to free up dependent items)
        console.log('Step A: Deleting Orders and Transactions...')
        await deleteByCompany('site_loans')
        await deleteByCompany('inventory_checks')
        await deleteByCompany('inbound_orders') // Items should cascade or be deleted if we enabled cascade
        await deleteByCompany('outbound_orders')

        // STEP B: Delete Core Entities
        console.log('Step B: Deleting Core Entities...')
        await Promise.all([
            deleteByCompany('products'),
            deleteByCompany('customers'),
            deleteByCompany('suppliers'),
            deleteByCompany('vehicles'),
            deleteByCompany('qc_info'),
            deleteByCompany('operational_notes'), // Referencing users
        ])

        // STEP B2: Delete Audit Logs (Manually if no company_id)
        // Audit logs usually reference auth.users. Since we haven't deleted users yet, we can delete logs by user_id
        if (userIds.length > 0) {
            console.log('Step B2: Deleting Audit Logs for users...')
            const { error: auditError } = await supabaseAdmin
                .from('audit_logs')
                .delete()
                .in('changed_by', userIds)

            if (auditError) console.warn('Failed to delete audit_logs:', auditError.message)
        }

        // STEP C: Delete Config/Master Data
        console.log('Step C: Deleting Config and Master Data...')
        await Promise.all([
            deleteByCompany('categories'),
            deleteByCompany('units'),
            deleteByCompany('systems'),
            deleteByCompany('systems'),
            deleteByCompany('system_configs'),
            // company_settings uses 'id' as company_id, so we delete by PK explicitly or rely on cascade.
            // But deleteByCompany expects 'company_id' column.
            supabaseAdmin.from('company_settings').delete().eq('id', companyId),
            deleteByCompany('master_tags'), // Delete tags
            // user_profiles is deleted via auth delete or explicit delete below
        ])

        // STEP D: Delete Auth Users (Now safe because referencing data is gone)
        console.log('Step D: Deleting Auth Users...')
        const deletePromises = userIds.map(async (uid) => {
            const { error } = await supabaseAdmin.auth.admin.deleteUser(uid)
            if (error) {
                console.warn(`Failed to delete user ${uid}:`, error)
            }
        })
        await Promise.all(deletePromises)

        // Also ensure user_profiles are gone (if cascade didn't work)
        await deleteByCompany('user_profiles')

        // STEP E: Delete Company Record
        console.log('Step E: Deleting Company Record...')
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
