import { supabase } from '@/lib/supabaseClient'
import { generateOrderCode } from '@/lib/orderCodeUtils'
import { ConsignmentDirection, ConsignmentOrder, ConsignmentOrderItem, ConsignmentOrderStatus } from './types'

/**
 * Sinh mã phiếu ký gửi theo chuẩn hệ thống: xxxx/mmyy/NKG hoặc xxxx/mmyy/XKG
 */
export async function generateConsignmentOrderCode(
    direction: ConsignmentDirection,
    systemCode: string
): Promise<string> {
    const today = new Date()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const year = String(today.getFullYear()).slice(-2)
    const mmyy = `${month}${year}`
    const suffix = direction === 'INBOUND' ? 'NKG' : 'XKG'
    const pattern = `%/${mmyy}/${suffix}`

    const { data } = await (supabase.from('consignment_orders') as any)
        .select('code')
        .eq('system_code', systemCode)
        .like('code', pattern)
        .order('code', { ascending: false })
        .limit(1)

    let nextStt = 1
    if (data && data.length > 0) {
        const lastCode = String(data[0].code || '')
        const parts = lastCode.split('/')
        const lastStt = parseInt(parts[0], 10)
        if (!isNaN(lastStt)) {
            nextStt = lastStt + 1
        }
    }

    const xxxx = String(nextStt).padStart(4, '0')
    return `${xxxx}/${mmyy}/${suffix}`
}

/**
 * Chuyển từ Phiếu xuất Kế toán gốc (outbound_orders) -> tạo Phiếu nhập Kho ký gửi (consignment_orders INBOUND)
 */
export async function transferOutboundToConsignment(params: {
    outboundOrderId: string
    systemCode: string
    companyId: string | null
    consignmentWarehouseId: string
    orderDate: string
    status: ConsignmentOrderStatus
    description?: string
    vehicleNumber?: string
    driverName?: string
}) {
    const {
        outboundOrderId,
        systemCode,
        companyId,
        consignmentWarehouseId,
        orderDate,
        status,
        description,
        vehicleNumber,
        driverName
    } = params

    // 1. Kiểm tra đã chuyển phiếu này trước đó chưa
    const { data: existing } = await (supabase.from('consignment_orders') as any)
        .select('id, code')
        .eq('source_outbound_order_id', outboundOrderId)
        .eq('direction', 'INBOUND')
        .neq('status', 'Cancelled')
        .maybeSingle()

    if (existing) {
        throw new Error(`Phiếu xuất này đã được chuyển sang Kho ký gửi (${existing.code}).`)
    }

    // 2. Lấy chi tiết phiếu xuất kế toán gốc
    const { data: outOrder, error: outErr } = await (supabase.from('outbound_orders') as any)
        .select('id, code, customer_name, warehouse_name, description, metadata, created_at')
        .eq('id', outboundOrderId)
        .single()

    if (outErr || !outOrder) {
        throw new Error('Không tìm thấy phiếu xuất Kế toán gốc.')
    }

    const { data: outItems, error: itemsErr } = await (supabase.from('outbound_order_items') as any)
        .select('product_id, product_name, unit, quantity, note, products(sku, name)')
        .eq('order_id', outboundOrderId)

    if (itemsErr) throw itemsErr
    if (!outItems || outItems.length === 0) {
        throw new Error('Phiếu xuất Kế toán gốc không có dòng hàng hóa nào.')
    }

    // 3. Sinh mã phiếu nhập ký gửi
    const code = await generateConsignmentOrderCode('INBOUND', systemCode)
    const meta = outOrder.metadata || {}

    const { data: createdOrder, error: insertOrderErr } = await (supabase.from('consignment_orders') as any)
        .insert({
            company_id: companyId || undefined,
            system_code: systemCode,
            code,
            direction: 'INBOUND',
            outbound_purpose: null,
            consignment_warehouse_id: consignmentWarehouseId,
            status,
            order_date: orderDate || new Date().toISOString(),
            description: description?.trim() || `Nhận ký gửi từ phiếu xuất ${outOrder.code}${outOrder.description ? ` - ${outOrder.description}` : ''}`,
            partner_name: outOrder.customer_name || null,
            vehicle_number: vehicleNumber?.trim() || meta.vehicleNumber || null,
            driver_name: driverName?.trim() || meta.driverName || null,
            source_outbound_order_id: outOrder.id,
            source_outbound_order_code: outOrder.code,
            metadata: {
                source: 'outbound_order',
                source_warehouse_name: outOrder.warehouse_name || null
            }
        })
        .select()
        .single()

    if (insertOrderErr) throw insertOrderErr

    // 4. Tạo các dòng hàng hóa ký gửi
    const rows = outItems.map((it: any) => {
        let rawNote = it.note || ''
        let batchCode: string | null = null
        const lotMatch = rawNote.match(/Lô:\s*([^•\]]+)/)
        if (lotMatch) {
            batchCode = lotMatch[1].trim()
        }
        return {
            company_id: companyId || undefined,
            system_code: systemCode,
            order_id: createdOrder.id,
            product_id: it.product_id || null,
            product_name: it.product_name || it.products?.name || 'Hàng hóa',
            sku: it.products?.sku || null,
            unit: it.unit || 'Cái',
            quantity: Number(it.quantity) || 0,
            batch_code: batchCode,
            note: rawNote || null
        }
    })

    const { error: insertItemsErr } = await (supabase.from('consignment_order_items') as any).insert(rows)
    if (insertItemsErr) {
        await (supabase.from('consignment_orders') as any).delete().eq('id', createdOrder.id)
        throw insertItemsErr
    }

    return createdOrder as ConsignmentOrder
}

/**
 * Chuyển từ Phiếu xuất Kho ký gửi (RETURN_TO_MAIN) -> tạo Phiếu nhập Kho Kế toán gốc (inbound_orders)
 */
export async function transferConsignmentToInbound(params: {
    consignmentOrderId: string
    systemCode: string
    companyId: string | null
    warehouseName: string
    orderTypeId?: string | null
    status: 'Pending' | 'Completed'
    orderDate: string
    description?: string
}) {
    const {
        consignmentOrderId,
        systemCode,
        companyId,
        warehouseName,
        orderTypeId,
        status,
        orderDate,
        description
    } = params

    // 1. Lấy phiếu xuất ký gửi và kiểm tra điều kiện
    const { data: cOrder, error: cErr } = await (supabase.from('consignment_orders') as any)
        .select('*, consignment_warehouses(id, code, name)')
        .eq('id', consignmentOrderId)
        .single()

    if (cErr || !cOrder) {
        throw new Error('Không tìm thấy phiếu xuất Kho ký gửi.')
    }

    if (cOrder.direction !== 'OUTBOUND') {
        throw new Error('Chỉ có thể chuyển Phiếu XUẤT Kho ký gửi về Kế toán gốc.')
    }

    if (cOrder.linked_inbound_order_id) {
        throw new Error(`Phiếu xuất ký gửi này đã chuyển thành phiếu nhập Kế toán (${cOrder.linked_inbound_order_code || 'đã liên kết'}).`)
    }

    const { data: cItems, error: cItemsErr } = await (supabase.from('consignment_order_items') as any)
        .select('*, products(id, sku, name, category_id)')
        .eq('order_id', consignmentOrderId)

    if (cItemsErr) throw cItemsErr
    if (!cItems || cItems.length === 0) {
        throw new Error('Phiếu xuất Kho ký gửi không có sản phẩm nào.')
    }

    // 2. Sinh mã PNK theo chuẩn Kế toán gốc
    const pnkCode = await generateOrderCode('PNK', systemCode)
    const whLabel = cOrder.consignment_warehouses?.name || 'Kho ký gửi'

    // 3. Tạo phiếu nhập Kế toán gốc (inbound_orders)
    const { data: inboundOrder, error: inErr } = await (supabase.from('inbound_orders') as any)
        .insert({
            code: pnkCode,
            status,
            type: 'Return',
            system_code: systemCode,
            system_type: systemCode,
            company_id: companyId || null,
            warehouse_name: warehouseName,
            order_type_id: orderTypeId || null,
            description: description?.trim() || `Nhập thu hồi hàng ký gửi từ ${whLabel} (Phiếu ${cOrder.code})${cOrder.description ? ` - ${cOrder.description}` : ''}`,
            created_at: orderDate || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
                source: 'consignment_outbound',
                consignment_order_id: cOrder.id,
                consignment_order_code: cOrder.code,
                consignment_warehouse_id: cOrder.consignment_warehouse_id,
                consignment_warehouse_name: whLabel,
                vehicleNumber: cOrder.vehicle_number || '',
                driverName: cOrder.driver_name || ''
            }
        })
        .select()
        .single()

    if (inErr) throw inErr

    // 4. Tạo các dòng hàng hóa cho inbound_order_items
    const inboundItems = cItems.map((it: any) => {
        let note = it.note || ''
        if (it.batch_code && !note.includes(`Lô: ${it.batch_code}`)) {
            note = note ? `${note} [Lô: ${it.batch_code}]` : `[Lô: ${it.batch_code}]`
        }
        return {
            order_id: inboundOrder.id,
            product_id: it.product_id || null,
            product_name: it.product_name || it.products?.name || 'Hàng hóa',
            unit: it.unit || 'Cái',
            quantity: Number(it.quantity) || 0,
            document_quantity: Number(it.quantity) || 0,
            price: 0,
            note: note || null,
            category_id: it.products?.category_id || null
        }
    })

    const { error: inItemsErr } = await (supabase.from('inbound_order_items') as any).insert(inboundItems)
    if (inItemsErr) {
        await (supabase.from('inbound_orders') as any).delete().eq('id', inboundOrder.id)
        throw inItemsErr
    }

    // 5. Cập nhật ngược liên kết lên phiếu xuất ký gửi (và tự hoàn thành phiếu xuất ký gửi nếu đang Pending)
    const { error: updErr } = await (supabase.from('consignment_orders') as any)
        .update({
            linked_inbound_order_id: inboundOrder.id,
            linked_inbound_order_code: inboundOrder.code,
            status: cOrder.status === 'Pending' ? 'Completed' : cOrder.status,
            updated_at: new Date().toISOString()
        })
        .eq('id', consignmentOrderId)

    if (updErr) throw updErr

    return inboundOrder
}

/**
 * Kiểm tra nhanh danh sách outbound_order_id nào đã được chuyển sang Kho ký gửi
 */
export async function fetchTransferredOutboundMap(
    outboundIds: string[],
    systemCode: string
): Promise<Record<string, { id: string; code: string; warehouseName: string }>> {
    if (!outboundIds.length || !systemCode) return {}

    const { data } = await (supabase.from('consignment_orders') as any)
        .select('id, code, source_outbound_order_id, consignment_warehouses(name)')
        .eq('system_code', systemCode)
        .eq('direction', 'INBOUND')
        .neq('status', 'Cancelled')
        .in('source_outbound_order_id', outboundIds)

    const map: Record<string, { id: string; code: string; warehouseName: string }> = {}
    if (data) {
        for (const row of data) {
            if (row.source_outbound_order_id) {
                map[row.source_outbound_order_id] = {
                    id: row.id,
                    code: row.code,
                    warehouseName: row.consignment_warehouses?.name || ''
                }
            }
        }
    }
    return map
}
