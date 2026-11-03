import { NextResponse } from 'next/server'
import { createServerSupabaseClient as createClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

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
        const { name, systemCode, append_to_product_name } = body

        if (!name || !systemCode) {
            return NextResponse.json({ ok: false, error: 'Missing name or systemCode' }, { status: 400 })
        }

        const supabase = await createClient()

        const { error } = await supabase
            .from('master_tags')
            .insert({
                name: name.toUpperCase().trim(),
                system_code: systemCode,
                append_to_product_name: Boolean(append_to_product_name)
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

// PATCH: Update master tag (toggle append_to_product_name)
export async function PATCH(request: Request) {
    try {
        const body = await request.json()
        const { name, systemCode, append_to_product_name } = body

        if (!name || !systemCode || append_to_product_name === undefined) {
            return NextResponse.json({ ok: false, error: 'Missing name, systemCode or append_to_product_name' }, { status: 400 })
        }

        const supabase = await createClient()

        const { error } = await supabase
            .from('master_tags')
            .update({
                append_to_product_name: Boolean(append_to_product_name)
            })
            .eq('name', name)
            .eq('system_code', systemCode)

        if (error) throw error

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
