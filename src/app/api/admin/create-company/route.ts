import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Initialize Admin Client with Service Role Key
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
        const { name, code, address, phone, email, tax_code, admin_name, admin_email, admin_password } = body

        if (!name || !code || !admin_email || !admin_password) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 1. Create Company
        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .insert({
                name,
                code,
                address,
                phone,
                email,
                tax_code
            })
            .select()
            .single()

        if (companyError) {
            console.error('Error creating company:', companyError)
            return NextResponse.json({ error: companyError.message }, { status: 500 })
        }

        // 2. Create Admin User (Auth)
        // using admin.createUser prevents signing in the user on the client side
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: admin_email,
            password: admin_password,
            email_confirm: true,
            user_metadata: { full_name: admin_name }
        })

        if (authError) {
            // Rollback company creation if auth fails? 
            // Ideally yes, but for now we just report error.
            console.error('Error creating auth user:', authError)
            return NextResponse.json({
                error: 'Company created but Admin User failed: ' + authError.message,
                company
            }, { status: 500 })
        }

        // 3. Create Admin Profile (Linked to Company)
        if (authData.user) {
            const { error: profileError } = await supabaseAdmin
                .from('user_profiles')
                .insert({
                    id: authData.user.id,
                    full_name: admin_name,
                    email: admin_email,
                    company_id: company.id,
                    permissions: ['system.full_access'],
                    is_active: true,
                    allowed_systems: ['FROZEN', 'OFFICE', 'DRY']
                })

            if (profileError) {
                console.error('Error creating profile:', profileError)
                return NextResponse.json({
                    error: 'Company & User created but Profile failed: ' + profileError.message,
                    company
                }, { status: 500 })
            }
        }

        return NextResponse.json({
            success: true,
            company,
            message: 'Company and Admin created successfully'
        })

    } catch (error: any) {
        console.error('Unexpected error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
