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

        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        if (currentUser.id === userId) {
            return NextResponse.json({ error: 'Không thể tự xóa tài khoản đang đăng nhập' }, { status: 400 })
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

        // Fetch target user to prevent deleting super admin
        const { data: targetUser } = await supabaseAdmin
            .from('user_profiles')
            .select('email')
            .eq('id', userId)
            .single()

        if (targetUser?.email === 'tungdibui2609@gmail.com') {
            return NextResponse.json({ error: 'Không thể xóa tài khoản Super Admin' }, { status: 403 })
        }

        // 1. Delete from user_profiles
        const { error: profileDeleteErr } = await supabaseAdmin
            .from('user_profiles')
            .delete()
            .eq('id', userId)

        if (profileDeleteErr) {
            console.error('Error deleting user_profiles:', profileDeleteErr)
            return NextResponse.json({ error: 'Lỗi khi xóa hồ sơ người dùng: ' + profileDeleteErr.message }, { status: 500 })
        }

        // 2. Delete from auth.users
        const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authDeleteErr) {
            console.warn('Warning deleting auth user (profile was deleted):', authDeleteErr)
            // Still return success since profile is removed, but log warning
        }

        return NextResponse.json({ success: true, message: 'Đã xóa người dùng thành công' })

    } catch (error: any) {
        console.error('Error deleting user:', error)
        return NextResponse.json({ error: error.message || 'Lỗi server khi xóa người dùng' }, { status: 500 })
    }
}
