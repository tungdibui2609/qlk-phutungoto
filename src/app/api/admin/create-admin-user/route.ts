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

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { companyId, email, password, full_name } = body

        if (!companyId || !email || !password || !full_name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { full_name: full_name }
        })

        if (authError) {
            return NextResponse.json({ error: 'Failed to create Auth User: ' + authError.message }, { status: 500 })
        }

        // 2. Create Profile
        if (authData.user) {
            const { error: profileError } = await supabaseAdmin
                .from('user_profiles')
                .insert({
                    id: authData.user.id,
                    full_name: full_name,
                    email: email,
                    company_id: companyId,
                    permissions: ['system.full_access'],
                    is_active: true,
                    allowed_systems: ['FROZEN', 'OFFICE', 'DRY']
                })

            if (profileError) {
                // If profile fails, should we delete the auth user? 
                // For now, let's keep it simple and just report error.
                return NextResponse.json({ error: 'Auth created but Profile failed: ' + profileError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, message: 'Admin added successfully' })

    } catch (error: any) {
        console.error('Error adding admin:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
