import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
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

        const body = await request.json()
        const { userId, email, password, full_name } = body

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        const updates: any = {}
        const userMetadata: any = {}

        if (email) updates.email = email
        if (password && password.length >= 6) updates.password = password
        if (full_name) userMetadata.full_name = full_name

        if (Object.keys(userMetadata).length > 0) {
            updates.user_metadata = userMetadata
        }

        if (Object.keys(updates).length > 0) {
            // 1. Update Auth User
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                updates
            )

            if (authError) {
                return NextResponse.json({ error: 'Auth Update Failed: ' + authError.message }, { status: 500 })
            }
        }

        // 2. Update Profile
        const profileUpdates: any = {}
        if (email) profileUpdates.email = email
        if (full_name) profileUpdates.full_name = full_name

        if (Object.keys(profileUpdates).length > 0) {
            const { error: profileError } = await supabaseAdmin
                .from('user_profiles')
                .update(profileUpdates)
                .eq('id', userId)

            if (profileError) {
                return NextResponse.json({ error: 'Profile Update Failed: ' + profileError.message }, { status: 500 })
            }
        }

        return NextResponse.json({ success: true, message: 'User updated successfully' })

    } catch (error: any) {
        console.error('Error updating user:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
