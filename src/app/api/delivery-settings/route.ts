import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

const db = () => (supabase as any).from('delivery_settings')

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const systemCode = searchParams.get('system_code')
        const moId = searchParams.get('mo_id')
        const companyId = searchParams.get('company_id')

        if (!systemCode) {
            return NextResponse.json({ error: 'system_code is required' }, { status: 400 })
        }

        let query = db()
            .select('*')
            .eq('system_code', systemCode)
            .order('created_at', { ascending: false })

        if (companyId) query = query.eq('company_id', companyId)
        if (moId) query = query.eq('mo_id', moId)

        const { data, error } = await query

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ data })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { system_code, mo_id, mo_code, product_id, product_name, product_code, quantity, unit, direction, notes, company_id, production_lot_id } = body

        if (!system_code || !mo_id || !product_name) {
            return NextResponse.json({ error: 'system_code, mo_id, product_name are required' }, { status: 400 })
        }

        const payload = {
            system_code,
            company_id: company_id || null,
            mo_id,
            mo_code: mo_code || '',
            production_lot_id: production_lot_id || null,
            product_id: product_id || null,
            product_name,
            product_code: product_code || null,
            quantity: quantity || 0,
            unit: unit || 'Cái',
            direction: direction || 'warehouse_to_production',
            notes: notes || null,
            updated_at: new Date().toISOString(),
        }

        console.log('[POST /api/delivery-settings] Payload:', JSON.stringify(payload, null, 2))

        const { data, error } = await db()
            .insert(payload)
            .select()
            .single()

        if (error) {
            console.error('[POST /api/delivery-settings] Supabase error:', JSON.stringify(error, null, 2))
            return NextResponse.json({
                error: error.message,
                details: error.details || null,
                code: error.code || null,
                hint: error.hint || null,
            }, { status: 500 })
        }

        return NextResponse.json({ data }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const { data, error } = await db()
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ data })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const { error } = await db().delete().eq('id', id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}