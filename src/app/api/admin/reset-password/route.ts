import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
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
        const { userId, password } = body

        if (!userId || !password) {
            return NextResponse.json({ error: 'User ID and Password are required' }, { status: 400 })
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            { password: password }
        )

        if (error) throw error

        return NextResponse.json({ success: true, user: data.user })

    } catch (error: any) {
        console.error('Error resetting password:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
