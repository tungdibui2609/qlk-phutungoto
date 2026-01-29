import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

export async function GET(req: Request) {
    try {
        const email = 'tungdibui2609@gmail.com'
        const password = 'password123' // Simple password for recovery

        // 1. Find existing user to get ID
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = users.find(u => u.email === email)

        // 2. Delete if exists (clean slate)
        if (existingUser) {
            await supabaseAdmin.auth.admin.deleteUser(existingUser.id)
            // Also clean profile just in case RLS blocked cascade
            await supabaseAdmin.from('user_profiles').delete().eq('email', email)
        }

        // 3. Create fresh Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username: 'admin' }
        })

        if (authError) throw authError
        if (!authData.user) throw new Error('Failed to create auth user')

        // 4. Link to AnyWarehouse Company
        // Get company ID
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('id')
            .eq('code', 'anywarehouse')
            .single()

        if (!company) throw new Error('Company AnyWarehouse not found')

        // 5. Create Profile as Super Admin
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert([{
                id: authData.user.id,
                email,
                full_name: 'Super Admin',
                username: 'admin',
                is_active: true,
                company_id: company.id,
                // Don't set role_id if you don't know the uuid, 
                // or fetch the 'Super Admin' role uuid first.
                // Assuming null role or handling it elsewhere, or we can fetch it.
            }])

        if (profileError) throw profileError

        return NextResponse.json({
            success: true,
            message: 'Super Admin restored successfully',
            credentials: { email, password }
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
