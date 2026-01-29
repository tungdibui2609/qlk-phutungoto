import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use SERVICE_ROLE key to bypass RLS and create users without signing in
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

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            email,
            password,
            username,
            full_name,
            employee_code,
            phone,
            role_id,
            department,
            is_active,
            allowed_systems,
            company_id
        } = body

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username }
        })

        if (authError) throw authError

        if (!authData.user) throw new Error('Failed to create auth user')

        // 2. Create User Profile
        // We can execute this as admin to ensure it works even if RLS is tricky
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert([{
                id: authData.user.id,
                employee_code: employee_code || null,
                username: username,
                full_name: full_name,
                phone: phone || null,
                email: email,
                role_id: role_id || null,
                department: department || null,
                is_active: is_active,
                allowed_systems: allowed_systems,
                company_id: company_id
            }])

        if (profileError) {
            // Rollback auth user if profile creation fails? 
            //Ideally yes, but for now just throw error
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            throw profileError
        }

        return NextResponse.json({ success: true, user: authData.user })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }
}
