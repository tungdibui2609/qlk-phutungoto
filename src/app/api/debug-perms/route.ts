import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: 'Missing Supabase environment variables' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    try {
        const { data, error, count } = await supabase
            .from('permissions')
            .select('*', { count: 'exact' })

        if (error) {
            return NextResponse.json({
                message: 'Error fetching from Supabase',
                error
            }, { status: 500 })
        }

        const { count: userCount } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })

        return NextResponse.json({
            message: 'Success',
            permissions_count: count,
            users_count: userCount,
            sample: data?.slice(0, 5),
            env: {
                url: supabaseUrl.substring(0, 20) + '...',
                hasKey: !!supabaseKey
            }
        })
    } catch (err: any) {
        return NextResponse.json({
            message: 'Server Error',
            error: err.message
        }, { status: 500 })
    }
}
