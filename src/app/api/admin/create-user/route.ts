import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'


export async function POST(req: Request) {
    try {
        // 0. Check Authorization
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options })
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.set({ name, value: '', ...options })
                    },
                },
            }
        )

        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile, error: profileErr } = await supabase
            .from('user_profiles')
            .select('account_level, email')
            .eq('id', currentUser.id)
            .single()

        if (profileErr || !profile || profile.account_level === 3 || !profile.email || profile.email.endsWith('@system.local')) {
            return NextResponse.json({ error: 'Bạn không có quyền thực hiện hành động này' }, { status: 403 })
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
