import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseClient'

const db = () => (supabase as any).from('delivery_journal')

// GET: Lấy danh sách nhật ký giao nhận
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        const systemCode = searchParams.get('system_code')
        const companyId = searchParams.get('company_id')
        const search = searchParams.get('search')
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
        if (status) query = query.eq('status', status)
        if (search) query = query.or(`item_name.ilike.%${search}%,delivery_code.ilike.%${search}%,result_item_name.ilike.%${search}%`)

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

// POST: Tạo bản ghi giao nhận mới (Kho gửi vật tư)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const {
            system_code,
            company_id,
            item_name,
            quantity_sent = 1,
            unit = 'Cái',
            from_department = 'Kho',
            to_department = 'Sản xuất',
            notes,
            sent_by,
            sent_by_name,
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
                quantity_sent: Math.max(0, parseFloat(quantity_sent) || 1),
                unit: unit || 'Cái',
                from_department,
                to_department,
                status: 'sent',
                notes: notes || null,
                sent_by: sent_by || null,
                sent_by_name: sent_by_name || null,
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

// PATCH: Cập nhật trạng thái (workflow transitions)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { id, action, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        // Lấy bản ghi hiện tại để validate workflow
        const { data: currentRecord } = await db()
            .select('status')
            .eq('id', id)
            .single()

        if (!currentRecord) {
            return NextResponse.json({ error: 'Record not found' }, { status: 404 })
        }

        const currentStatus = currentRecord.status

        // Workflow validation
        if (action) {
            const now = new Date().toISOString()

            switch (action) {
                case 'receive_by_production': {
                    // SX xác nhận nhận hàng
                    if (currentStatus !== 'sent') {
                        return NextResponse.json({ error: 'Chỉ có thể nhận khi trạng thái là "Đã gửi"' }, { status: 400 })
                    }
                    const updateData: any = {
                        status: 'received_by_production',
                        received_by_production_at: now,
                    }
                    if (updates.received_by_production) updateData.received_by_production = updates.received_by_production
                    if (updates.received_by_production_name) updateData.received_by_production_name = updates.received_by_production_name

                    const { data, error } = await db()
                        .update(updateData)
                        .eq('id', id)
                        .select()
                        .single()

                    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
                    return NextResponse.json({ data })
                }

                case 'complete_by_production': {
                    // SX hoàn thành và gửi kết quả về
                    if (currentStatus !== 'received_by_production') {
                        return NextResponse.json({ error: 'Chỉ có thể hoàn thành khi đã nhận hàng' }, { status: 400 })
                    }
                    const updateData: any = {
                        status: 'completed_by_production',
                        completed_by_production_at: now,
                    }
                    if (updates.completed_by) updateData.completed_by = updates.completed_by
                    if (updates.completed_by_name) updateData.completed_by_name = updates.completed_by_name
                    if (updates.result_item_name !== undefined) updateData.result_item_name = updates.result_item_name
                    if (updates.result_quantity !== undefined) updateData.result_quantity = parseFloat(updates.result_quantity)
                    if (updates.result_unit !== undefined) updateData.result_unit = updates.result_unit

                    const { data, error } = await db()
                        .update(updateData)
                        .eq('id', id)
                        .select()
                        .single()

                    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
                    return NextResponse.json({ data })
                }

                case 'receive_by_warehouse': {
                    // Kho nhận lại thành phẩm
                    if (currentStatus !== 'completed_by_production') {
                        return NextResponse.json({ error: 'Chỉ có thể nhận lại khi SX đã hoàn thành' }, { status: 400 })
                    }
                    const updateData: any = {
                        status: 'received_by_warehouse',
                        received_by_warehouse_at: now,
                    }
                    if (updates.received_by_warehouse) updateData.received_by_warehouse = updates.received_by_warehouse
                    if (updates.received_by_warehouse_name) updateData.received_by_warehouse_name = updates.received_by_warehouse_name

                    const { data, error } = await db()
                        .update(updateData)
                        .eq('id', id)
                        .select()
                        .single()

                    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
                    return NextResponse.json({ data })
                }

                case 'cancel': {
                    if (['received_by_warehouse'].includes(currentStatus)) {
                        return NextResponse.json({ error: 'Không thể hủy khi đã hoàn tất' }, { status: 400 })
                    }
                    const { data, error } = await db()
                        .update({ status: 'cancelled' })
                        .eq('id', id)
                        .select()
                        .single()

                    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
                    return NextResponse.json({ data })
                }

                default:
                    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
            }
        }

        // Cập nhật thông thường (notes, edit fields)
        const allowedFields = ['item_name', 'quantity_sent', 'unit', 'from_department', 'to_department', 'notes']
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

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ data })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Xóa bản ghi
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