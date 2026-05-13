import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

// Helper: truy cập bảng handover_records (runtime migration, chưa có trong type)
const db = () => (supabase as any).from('handover_records')

// GET: Lấy danh sách bàn giao
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const direction = searchParams.get('direction')
        const status = searchParams.get('status')
        const systemCode = searchParams.get('system_code')
        const companyId = searchParams.get('company_id')
        const relatedRecordId = searchParams.get('related_record_id')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')

        if (!systemCode) {
            return NextResponse.json({ error: 'system_code is required' }, { status: 400 })
        }

        let query = db()
            .select('*', { count: 'exact' })
            .eq('system_code', systemCode)
            .order('created_at', { ascending: false })

        if (companyId) query = query.eq('company_id', companyId)
        if (direction) query = query.eq('direction', direction)
        if (status) query = query.eq('status', status)
        if (relatedRecordId) query = query.eq('related_record_id', relatedRecordId)

        const from = (page - 1) * limit
        const to = from + limit - 1

        const { data, error, count } = await query.range(from, to)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data, count, page, limit })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Tạo bản ghi bàn giao mới
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const {
            system_code,
            company_id,
            item_name,
            quantity = 1,
            unit = 'Cái',
            from_department,
            to_department,
            direction = 'inbound',
            status = 'pending',
            notes,
            received_by,
            handed_by,
            related_record_id,
            created_by,
            created_by_name,
        } = body

        if (!system_code) {
            return NextResponse.json({ error: 'system_code is required' }, { status: 400 })
        }
        if (!item_name || !item_name.trim()) {
            return NextResponse.json({ error: 'item_name is required' }, { status: 400 })
        }

        const { data, error } = await db()
            .insert({
                system_code,
                company_id: company_id || null,
                item_name: item_name.trim(),
                quantity: Math.max(1, parseInt(quantity) || 1),
                unit: unit || 'Cái',
                from_department: from_department || null,
                to_department: to_department || null,
                direction,
                status,
                notes: notes || null,
                received_by: received_by || null,
                handed_by: handed_by || null,
                related_record_id: related_record_id || null,
                created_by: created_by || null,
                created_by_name: created_by_name || null,
            })
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data }, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PATCH: Cập nhật bản ghi bàn giao
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const allowedFields = [
            'item_name', 'quantity', 'unit', 'from_department',
            'to_department', 'direction', 'status', 'notes',
            'received_by', 'handed_by', 'related_record_id'
        ]

        const filteredUpdates: any = {}
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key]
            }
        }

        if (Object.keys(filteredUpdates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
        }

        const { data, error } = await db()
            .update(filteredUpdates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Xóa bản ghi bàn giao
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const { error } = await db()
            .delete()
            .eq('id', id)

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}