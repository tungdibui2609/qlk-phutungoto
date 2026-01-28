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
