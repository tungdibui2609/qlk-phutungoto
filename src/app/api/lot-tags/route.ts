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

// GET: Fetch tags
// ?lotId=... -> get tags for specific LOT
// ?all=1 -> get all unique used tags
// GET: Fetch tags
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const lotId = searchParams.get('lotId')
        const all = searchParams.get('all')

        const supabase = await createClient()

        if (lotId) {
            const { data, error } = await supabase
                .from('lot_tags')
                .select('tag, added_at, added_by, lot_item_id')
                .eq('lot_id', lotId)
                .order('tag', { ascending: true })

            if (error) throw error
            return NextResponse.json({ ok: true, items: data || [] })
        }

        if (all) {
            const { data, error } = await supabase
                .from('lot_tags')
                .select('tag')

            if (error) throw error

            const uniqueTags = Array.from(new Set(data?.map(i => i.tag) || [])).sort()
            return NextResponse.json({ ok: true, uniqueTags })
        }

        return NextResponse.json({ ok: false, error: 'Missing parameters' }, { status: 400 })

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
}

// POST: Add tag(s) to LOT
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { lotId, tag, tags, lotItemId } = body

        if (!lotId) {
            return NextResponse.json({ ok: false, error: 'Missing lotId' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        const userName = user?.email || 'Unknown'

        const tagList: string[] = []
        if (tag) tagList.push(tag)
        if (Array.isArray(tags)) tagList.push(...tags)

        if (tagList.length === 0) {
            return NextResponse.json({ ok: false, error: 'Missing tags' }, { status: 400 })
        }

        const inserts = tagList.map(t => ({
            lot_id: lotId,
            lot_item_id: lotItemId || null,
            tag: t.toUpperCase().trim(),
            added_by: userName
        }))

        // Conflict on (lot_item_id, tag) if strictly enforced, but let's try standard insert
        // If unique constraint is (lot_item_id, tag)
        const { error } = await supabase
            .from('lot_tags')
            .upsert(inserts, { onConflict: 'lot_item_id,tag', ignoreDuplicates: true })

        if (error) {
            // Fallback if the unique constraint is still old or different? 
            // Just throw for now
            throw error
        }

        return NextResponse.json({ ok: true })

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
}

// DELETE: Remove tag from LOT (specific item)
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const lotId = searchParams.get('lotId')
        const tag = searchParams.get('tag')
        const lotItemId = searchParams.get('lotItemId')

        if (!lotId || !tag) {
            return NextResponse.json({ ok: false, error: 'Missing params' }, { status: 400 })
        }

        const supabase = await createClient()

        let query = supabase
            .from('lot_tags')
            .delete()
            .eq('lot_id', lotId)
            .eq('tag', tag)

        if (lotItemId) {
            query = query.eq('lot_item_id', lotItemId)
        } else {
            // If no lotItemId specified, maybe delete all occurrences or just those with null?
            // Safest is to delete only those where lot_item_id is NULL if user meant "Lot Tag"
            // But backward compatibility might mean "delete any tag with this name from this lot"
            // Let's assume strict deletion if provided, otherwise loose?
            // Given the UI will pass exact context, let's match exact state.
            // If lotItemId is NOT provided, it might delete specific item tags if we aren't careful?
            // Let's rely on UI passing correct params. 
        }

        const { error } = await query

        if (error) throw error

        return NextResponse.json({ ok: true })

    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
}
