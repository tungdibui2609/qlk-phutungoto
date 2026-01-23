import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { Database } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

async function createClient() {
    const cookieStore = await cookies()
    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
                set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
                remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options }) },
            },
        }
    )
}

// GET: Fetch master tags by system
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const systemCode = searchParams.get('systemCode')

        const supabase = await createClient()

        let query = supabase
            .from('master_tags')
            .select('*')
            .order('name', { ascending: true })

        if (systemCode) {
            query = query.eq('system_code', systemCode)
        }

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({ ok: true, tags: data || [] })

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
}

// POST: Create master tag
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, systemCode } = body

        if (!name || !systemCode) {
            return NextResponse.json({ ok: false, error: 'Missing name or systemCode' }, { status: 400 })
        }

        const supabase = await createClient()
        // const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase
            .from('master_tags')
            .insert({
                name: name.toUpperCase().trim(),
                system_code: systemCode
            })
            .select()

        if (error) {
            // Uniqueness violation usually 23505
            if (error.code === '23505') {
                return NextResponse.json({ ok: false, error: 'Tag already exists in this system' }, { status: 409 })
            }
            throw error
        }

        return NextResponse.json({ ok: true })

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
}

// DELETE: Delete master tag
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const name = searchParams.get('name')
        const systemCode = searchParams.get('systemCode')

        if (!name || !systemCode) {
            return NextResponse.json({ ok: false, error: 'Missing name or systemCode' }, { status: 400 })
        }

        const supabase = await createClient()

        const { error } = await supabase
            .from('master_tags')
            .delete()
            .eq('name', name)
            .eq('system_code', systemCode)

        if (error) throw error

        return NextResponse.json({ ok: true })

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
}
