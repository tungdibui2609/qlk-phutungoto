import { SupabaseClient } from '@supabase/supabase-js'
import { lotService } from '@/services/warehouse/lotService'
import { logActivity } from '@/lib/audit'
import { generateUniqueLotCode } from '@/lib/lotCodeGenerator'
import { encodeSTT } from '@/lib/numberUtils'

export type ProposalActionType = 'CLEAR' | 'SET_QTY' | 'MOVE' | 'ASSIGN_LOT' | 'NOTE'

export interface ProposalSubItem {
    product_id?: string | null
    product_name: string
    sku?: string | null
    current_quantity: number
    new_quantity: number
    unit: string
    is_new?: boolean
}

export interface ProposalItem {
    id: string
    position_id: string
    position_code: string
    warehouse_name?: string
    action_type: ProposalActionType
    lot_id?: string | null
    lot_code?: string | null
    lot_stt?: string | null
    lot_found?: boolean
    product_name?: string | null
    sku?: string | null
    current_quantity?: number | null
    unit?: string | null
    // Chi tiết từng dòng sản phẩm cho pallet hỗn hợp
    sub_items?: ProposalSubItem[]
    new_quantity?: number | null
    target_position_id?: string | null
    target_position_code?: string | null
    note?: string | null
    status?: 'PENDING' | 'APPROVED'
    approved_at?: string | null
    approved_by_name?: string | null
    updated_at: string
}

export interface WarehouseProposal {
    id: string
    code?: string
    system_code: string
    company_id?: string | null
    title: string
    created_by?: string | null
    created_by_name?: string | null
    notes?: string | null
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PARTIAL'
    total_positions: number
    items: ProposalItem[]
    approved_by?: string | null
    approved_by_name?: string | null
    approved_at?: string | null
    review_notes?: string | null
    created_at: string
    updated_at: string
}

const TABLE_PRIMARY = 'warehouse_position_proposals'
const TABLE_FALLBACK = 'shift_tasks'

/**
 * Web mẹ tự tra cứu và làm giàu thông tin Lot (tên SP, mã Lot, số lượng, vị trí hiện tại)
 * cho các item ASSIGN_LOT mà App chỉ gửi lên STT (VD: G888, G57)
 */
async function enrichAssignLotItems(
    supabase: SupabaseClient,
    proposals: WarehouseProposal[],
    systemCode: string
): Promise<WarehouseProposal[]> {
    const seqSet = new Set<number>()
    const lotIdSet = new Set<string>()
    let hasAssignLot = false

    for (const p of proposals) {
        for (const it of p.items) {
            if (it.action_type !== 'ASSIGN_LOT') continue
            hasAssignLot = true
            if (it.lot_id) lotIdSet.add(it.lot_id)
            const sttRaw = (it.lot_stt || '').trim().toUpperCase()
            if (sttRaw) {
                const seq = encodeSTT(sttRaw)
                if (seq !== null) seqSet.add(seq)
            }
        }
    }

    if (!hasAssignLot || (seqSet.size === 0 && lotIdSet.size === 0)) {
        return proposals
    }

    const bySeq = new Map<number, any>()
    const byId = new Map<string, any>()

    try {
        if (seqSet.size > 0) {
            const { data } = await (supabase as any)
                .from('lots')
                .select(`
                    id, code, production_code, daily_seq, quantity,
                    lot_items(id, quantity, unit, products(name, sku, unit)),
                    positions!positions_lot_id_fkey(id, code)
                `)
                .eq('system_code', systemCode)
                .in('daily_seq', Array.from(seqSet))

            if (Array.isArray(data)) {
                for (const lot of data) {
                    if (lot.daily_seq != null) bySeq.set(lot.daily_seq, lot)
                    if (lot.id) byId.set(lot.id, lot)
                }
            }
        }

        const missingIds = Array.from(lotIdSet).filter(id => !byId.has(id))
        if (missingIds.length > 0) {
            const { data } = await (supabase as any)
                .from('lots')
                .select(`
                    id, code, production_code, daily_seq, quantity,
                    lot_items(id, quantity, unit, products(name, sku, unit)),
                    positions!positions_lot_id_fkey(id, code)
                `)
                .eq('system_code', systemCode)
                .in('id', missingIds)

            if (Array.isArray(data)) {
                for (const lot of data) {
                    if (lot.daily_seq != null) bySeq.set(lot.daily_seq, lot)
                    if (lot.id) byId.set(lot.id, lot)
                }
            }
        }
    } catch (err) {
        console.warn('Lỗi enrich thông tin Lot cho ASSIGN_LOT:', err)
        return proposals
    }

    for (const p of proposals) {
        for (const it of p.items) {
            if (it.action_type !== 'ASSIGN_LOT') continue
            const sttRaw = (it.lot_stt || '').trim().toUpperCase()
            const seq = sttRaw ? encodeSTT(sttRaw) : null
            const lot = (seq !== null ? bySeq.get(seq) : null) || (it.lot_id ? byId.get(it.lot_id) : null)

            if (!lot) {
                if (sttRaw) it.lot_found = false
                continue
            }

            it.lot_found = true
            it.lot_id = lot.id
            it.lot_code = lot.code || lot.production_code || it.lot_code

            const itemsArr: any[] = Array.isArray(lot.lot_items) ? lot.lot_items : []
            if (itemsArr.length > 0) {
                const names = itemsArr
                    .map(li => li.products?.name)
                    .filter(Boolean)
                const skus = itemsArr
                    .map(li => li.products?.sku)
                    .filter(Boolean)
                const totalQty = itemsArr.reduce((s, li) => s + (Number(li.quantity) || 0), 0)
                const firstUnit = itemsArr[0]?.unit || itemsArr[0]?.products?.unit || it.unit || 'Thùng'

                if (names.length > 0) it.product_name = Array.from(new Set(names)).join(', ')
                if (skus.length > 0) it.sku = Array.from(new Set(skus)).join(', ')
                it.new_quantity = totalQty || lot.quantity || it.new_quantity
                it.unit = firstUnit
            } else if (lot.quantity != null) {
                it.new_quantity = lot.quantity
            }

            const posArr: any[] = Array.isArray(lot.positions)
                ? lot.positions
                : lot.positions
                ? [lot.positions]
                : []
            if (posArr.length > 0 && posArr[0]?.code) {
                it.target_position_id = posArr[0].id || it.target_position_id
                it.target_position_code = posArr[0].code
            }
        }
    }

    return proposals
}

/**
 * Lấy danh sách phiếu đề xuất điều chỉnh vị trí kho
 */
export async function getWarehouseProposals(
    supabase: SupabaseClient,
    systemCode: string,
    statusFilter?: string
): Promise<WarehouseProposal[]> {
    if (!systemCode) return []

    // 1. Thử lấy từ bảng chuyên dụng warehouse_position_proposals
    try {
        let q = (supabase as any)
            .from(TABLE_PRIMARY)
            .select('*')
            .eq('system_code', systemCode)
            .order('created_at', { ascending: false })

        if (statusFilter && statusFilter !== 'ALL') {
            q = q.eq('status', statusFilter.toUpperCase())
        }

        const { data, error } = await q
        if (!error && Array.isArray(data)) {
            const mapped = data.map(mapRowToProposal)
            return await enrichAssignLotItems(supabase, mapped, systemCode)
        }
    } catch {
        // Fallback sang shift_tasks
    }

    // 2. Fallback sang shift_tasks với task_type = 'warehouse_adjustment'
    try {
        let q = (supabase as any)
            .from(TABLE_FALLBACK)
            .select('*')
            .eq('system_code', systemCode)
            .eq('task_type', 'warehouse_adjustment')
            .order('created_at', { ascending: false })

        const { data, error } = await q
        if (error || !Array.isArray(data)) return []

        const proposals: WarehouseProposal[] = data.map((t: any) => {
            let parsedItems: ProposalItem[] = []
            let parsedNotes = t.content || ''
            try {
                if (t.content && t.content.startsWith('{')) {
                    const parsed = JSON.parse(t.content)
                    parsedItems = parsed.items || []
                    parsedNotes = parsed.notes || ''
                }
            } catch {
                // ignore
            }

            const rawStatus = (t.status || '').toUpperCase()
            const status =
                rawStatus === 'COMPLETED' ? 'APPROVED' :
                rawStatus === 'CANCELLED' ? 'REJECTED' : 'PENDING'

            return {
                id: t.id,
                code: t.code,
                system_code: t.system_code,
                company_id: t.company_id,
                title: t.title || 'Đề xuất điều chỉnh vị trí kho',
                created_by: t.created_by,
                created_by_name: t.created_by_name || 'Nhân viên kho',
                notes: parsedNotes,
                status,
                total_positions: parsedItems.length,
                items: parsedItems,
                approved_by: t.completed_by,
                approved_by_name: t.completed_by_name,
                approved_at: t.completed_at,
                review_notes: t.completion_notes,
                created_at: t.created_at,
                updated_at: t.updated_at
            }
        })

        const filtered = (statusFilter && statusFilter !== 'ALL')
            ? proposals.filter(p => p.status === statusFilter.toUpperCase())
            : proposals
        return await enrichAssignLotItems(supabase, filtered, systemCode)
    } catch (err) {
        console.error('Lỗi khi tải phiếu đề xuất:', err)
        return []
    }
}

/**
 * Gửi phiếu đề xuất điều chỉnh vị trí kho mới
 */
export async function submitWarehouseProposal(
    supabase: SupabaseClient,
    payload: {
        system_code: string
        company_id?: string | null
        title?: string
        created_by?: string | null
        created_by_name?: string | null
        notes?: string | null
        items: ProposalItem[]
    }
): Promise<{ success: boolean; data?: WarehouseProposal; error?: string }> {
    if (!payload.system_code || !payload.items || payload.items.length === 0) {
        return { success: false, error: 'Dữ liệu phiếu không hợp lệ hoặc không có vị trí nào.' }
    }

    const title = payload.title || `Điều chỉnh vị trí kho (${payload.items.length} vị trí)`

    // 1. Thử ghi vào bảng chuyên dụng
    try {
        const primaryPayload = {
            system_code: payload.system_code,
            company_id: payload.company_id || null,
            title,
            created_by: payload.created_by || null,
            created_by_name: payload.created_by_name || 'Nhân viên',
            notes: payload.notes || null,
            status: 'PENDING',
            total_positions: payload.items.length,
            items: payload.items
        }

        const { data, error } = await (supabase as any)
            .from(TABLE_PRIMARY)
            .insert(primaryPayload)
            .select()
            .single()

        if (!error && data) {
            return { success: true, data: mapRowToProposal(data) }
        }
    } catch {
        // Fallback sang shift_tasks
    }

    // 2. Fallback sang shift_tasks
    try {
        const now = new Date()
        const code = `DC-${now.getFullYear().toString().slice(2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`

        const contentPayload = JSON.stringify({
            notes: payload.notes || '',
            items: payload.items
        })

        const fallbackPayload = {
            code,
            system_code: payload.system_code,
            company_id: payload.company_id || null,
            title,
            content: contentPayload,
            priority: 'normal',
            status: 'pending',
            task_type: 'warehouse_adjustment',
            created_by: payload.created_by || null,
            created_by_name: payload.created_by_name || 'Nhân viên kho',
            images: []
        }

        const { data, error } = await (supabase as any)
            .from(TABLE_FALLBACK)
            .insert(fallbackPayload)
            .select()
            .single()

        if (error) throw error

        return {
            success: true,
            data: {
                id: data.id,
                code: data.code,
                system_code: data.system_code,
                company_id: data.company_id,
                title: data.title,
                created_by: data.created_by,
                created_by_name: data.created_by_name,
                notes: payload.notes || '',
                status: 'PENDING',
                total_positions: payload.items.length,
                items: payload.items,
                created_at: data.created_at,
                updated_at: data.updated_at
            }
        }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi gửi phiếu lên máy chủ.' }
    }
}

/**
 * Hàm áp dụng cập nhật 1 vị trí đề xuất vào CSDL (hỗ trợ đầy đủ CLEAR, SET_QTY nhiều dòng SP, MOVE)
 */
async function applyProposalItemUpdate(supabase: SupabaseClient, it: ProposalItem): Promise<boolean> {
    try {
        // ── 1. THAO TÁC XUẤT RỖNG Ô (BỐC XUẤT SẠCH HÀNG KHỎI KHO) ──
        if (it.action_type === 'CLEAR') {
            let lotId = it.lot_id
            if (!lotId && it.position_id) {
                const { data: posRec } = await (supabase as any)
                    .from('positions')
                    .select('lot_id')
                    .eq('id', it.position_id)
                    .maybeSingle()
                if (posRec?.lot_id) {
                    lotId = posRec.lot_id
                }
            }

            // 1. Gỡ lot khỏi vị trí trên sơ đồ kho
            await (supabase as any)
                .from('positions')
                .update({ lot_id: null })
                .eq('id', it.position_id)

            // 2. Chuyển trạng thái Lot thành 'exported' và cập nhật số lượng về 0
            if (lotId) {
                try {
                    const { data: lotData } = await (supabase as any)
                        .from('lots')
                        .select('id, quantity, status, metadata, system_code')
                        .eq('id', lotId)
                        .maybeSingle()

                    // Lấy các mặt hàng trong lot_items để ghi lịch sử xuất
                    const { data: lotItems } = await (supabase as any)
                        .from('lot_items')
                        .select('id, product_id, quantity, unit')
                        .eq('lot_id', lotId)

                    const exportItemsData: Record<string, any> = {}
                    if (Array.isArray(lotItems)) {
                        for (const lItem of lotItems) {
                            exportItemsData[lItem.id] = {
                                product_id: lItem.product_id,
                                exported_quantity: lItem.quantity || 0,
                                unit: lItem.unit || it.unit || 'Thùng'
                            }
                        }
                    }

                    // Xóa các dòng trong lot_items
                    await (supabase as any)
                        .from('lot_items')
                        .delete()
                        .eq('lot_id', lotId)

                    // Ghi lịch sử xuất kho vào metadata
                    const newMetadata = await lotService.addExportToHistory({
                        supabase,
                        lotId: lotId,
                        originalMetadata: lotData?.metadata,
                        exportData: {
                            id: crypto.randomUUID(),
                            customer: 'Xuất kho từ Đề xuất điều chỉnh',
                            description: it.note || 'Xuất rỗng ô (Trừ vị trí X)',
                            location_code: it.position_code,
                            items: exportItemsData
                        }
                    })

                    // Cập nhật lot: status = 'exported', quantity = 0
                    await (supabase as any)
                        .from('lots')
                        .update({
                            quantity: 0,
                            status: 'exported',
                            metadata: newMetadata
                        })
                        .eq('id', lotId)

                    // Ghi audit log
                    await logActivity({
                        supabase,
                        tableName: 'lots',
                        recordId: lotId,
                        action: 'UPDATE',
                        oldData: { quantity: lotData?.quantity, status: lotData?.status },
                        newData: { quantity: 0, status: 'exported' },
                        systemCode: lotData?.system_code || 'KHO_DONG_LANH'
                    })
                } catch (err) {
                    console.error('Lỗi khi cập nhật trạng thái xuất kho cho lot:', err)
                }
            }

            return true
        }

        // ── 2. THAO TÁC SỬA SỐ LƯỢNG (HOẶC TẠO LOT MỚI CHO VỊ TRÍ TRỐNG) ──
        if (it.action_type === 'SET_QTY' && it.new_quantity !== undefined && it.new_quantity !== null) {
            let lotId = it.lot_id
            let posRecord: any = null
            if (!lotId && it.position_id) {
                const { data: posRec } = await (supabase as any)
                    .from('positions')
                    .select('lot_id, system_type, company_id')
                    .eq('id', it.position_id)
                    .maybeSingle()
                posRecord = posRec
                if (posRec?.lot_id) {
                    lotId = posRec.lot_id
                }
            }

            // Trường hợp vị trí đang trống (!lotId) -> Tạo Lot mới cho vị trí
            if (!lotId && it.position_id) {
                const validSubs = (it.sub_items || []).filter((s: ProposalSubItem) => (s.new_quantity || 0) > 0)
                const fallbackQty = Number(it.new_quantity) || 0

                if (validSubs.length > 0 || fallbackQty > 0) {
                    const sysCode = posRecord?.system_type || 'KHO_DONG_LANH'
                    const companyId = posRecord?.company_id || null

                    let systemName: string | null = sysCode === 'KHO_DONG_LANH' ? 'Kho Đông Lạnh' : sysCode
                    try {
                        const { data: sysRec } = await (supabase as any)
                            .from('systems')
                            .select('name')
                            .eq('code', sysCode)
                            .maybeSingle()
                        if (sysRec?.name) systemName = sysRec.name
                    } catch {
                        // ignore
                    }

                    const newLotCode = await generateUniqueLotCode(supabase, systemName)
                    const resolvedSubs: Array<ProposalSubItem & { product_id: string | null }> = []
                    for (const sub of validSubs) {
                        let prodId = sub.product_id || null
                        if (!prodId && sub.sku) {
                            try {
                                const { data: prodRow } = await (supabase as any)
                                    .from('products')
                                    .select('id')
                                    .eq('sku', sub.sku)
                                    .limit(1)
                                    .maybeSingle()
                                if (prodRow?.id) prodId = prodRow.id
                            } catch {
                                // ignore
                            }
                        }
                        resolvedSubs.push({ ...sub, product_id: prodId })
                    }

                    const totalQty = resolvedSubs.length > 0
                        ? resolvedSubs.reduce((sum, s) => sum + (s.new_quantity || 0), 0)
                        : fallbackQty

                    const { data: newLot, error: createLotErr } = await (supabase as any)
                        .from('lots')
                        .insert({
                            code: newLotCode,
                            product_id: resolvedSubs[0]?.product_id || null,
                            quantity: totalQty,
                            status: 'active',
                            inbound_date: new Date().toISOString().split('T')[0],
                            system_code: sysCode,
                            company_id: companyId,
                            notes: it.note || 'Tạo Lot mới từ đề xuất điều chỉnh vị trí'
                        })
                        .select('id')
                        .single()

                    if (createLotErr || !newLot?.id) {
                        console.error('Lỗi khi tạo Lot mới cho vị trí trống:', createLotErr)
                        return false
                    }

                    if (resolvedSubs.length > 0) {
                        const inserts = resolvedSubs.map((sub) => ({
                            lot_id: newLot.id,
                            product_id: sub.product_id || null,
                            quantity: sub.new_quantity,
                            unit: sub.unit || it.unit || 'Thùng'
                        }))
                        await (supabase as any).from('lot_items').insert(inserts)
                    }

                    const { error: posUpdErr } = await (supabase as any)
                        .from('positions')
                        .update({ lot_id: newLot.id })
                        .eq('id', it.position_id)

                    if (posUpdErr) {
                        console.error('Lỗi khi gán Lot mới vào vị trí:', posUpdErr)
                        return false
                    }
                    return true
                }
                return false
            }

            if (lotId) {
                // Cập nhật tổng quantity ở bảng lots
                await (supabase as any)
                    .from('lots')
                    .update({ quantity: it.new_quantity })
                    .eq('id', lotId)

                // Nếu có chi tiết từng dòng con (sub_items) cho pallet hỗn hợp
                if (it.sub_items && it.sub_items.length > 0) {
                    try {
                        // Lấy danh sách lot_items thực tế trong CSDL
                        const { data: dbLotItems, error: lotItemsErr } = await (supabase as any)
                            .from('lot_items')
                            .select('id, product_id, quantity, unit')
                            .eq('lot_id', lotId)

                        if (!lotItemsErr && Array.isArray(dbLotItems) && dbLotItems.length > 0) {
                            // Lấy thông tin name, sku từ bảng products nếu có
                            const prodIds = dbLotItems.map((d: any) => d.product_id).filter(Boolean)
                            let dbProducts: any[] = []
                            if (prodIds.length > 0) {
                                try {
                                    const { data: prodData } = await (supabase as any)
                                        .from('products')
                                        .select('id, name, sku')
                                        .in('id', prodIds)
                                    if (Array.isArray(prodData)) {
                                        dbProducts = prodData
                                    }
                                } catch {
                                    // ignore nếu RLS chặn products
                                }
                            }

                            // Gắn thông tin sản phẩm vào từng dòng lot_item
                            const enrichedLotItems = dbLotItems.map((item: any) => {
                                const prod = dbProducts.find((p: any) => p.id === item.product_id)
                                return {
                                    ...item,
                                    product_name: prod?.name || '',
                                    sku: prod?.sku || '',
                                    isMatched: false
                                }
                            })

                            // Cập nhật số lượng chính xác cho từng dòng con (và INSERT nếu có sản phẩm mới thêm vào lot)
                            for (let i = 0; i < it.sub_items.length; i++) {
                                const sub = it.sub_items[i]
                                let matched: any = null

                                if (!sub.is_new) {
                                    const subNameClean = (sub.product_name || '').trim().toLowerCase()
                                    const subSkuClean = (sub.sku || '').trim().toLowerCase()
                                    const subUnitClean = (sub.unit || '').trim().toLowerCase()

                                    // 1. Ưu tiên khớp theo product_id
                                    matched = enrichedLotItems.find(
                                        (d: any) => !d.isMatched && sub.product_id && d.product_id === sub.product_id
                                    )

                                    // 2. Khớp theo SKU nếu có
                                    if (!matched && subSkuClean) {
                                        matched = enrichedLotItems.find(
                                            (d: any) => !d.isMatched && d.sku && d.sku.trim().toLowerCase() === subSkuClean
                                        )
                                    }

                                    // 3. Khớp theo Đơn vị tính (rất hiệu quả với pallet hỗn hợp có quy cách thùng khác nhau ví dụ 9.6kg vs 20kg)
                                    if (!matched && subUnitClean) {
                                        matched = enrichedLotItems.find(
                                            (d: any) => !d.isMatched && d.unit && d.unit.trim().toLowerCase() === subUnitClean
                                        )
                                    }

                                    // 4. Khớp theo tên sản phẩm
                                    if (!matched && subNameClean) {
                                        matched = enrichedLotItems.find(
                                            (d: any) =>
                                                !d.isMatched &&
                                                d.product_name &&
                                                (d.product_name.trim().toLowerCase() === subNameClean ||
                                                    d.product_name.trim().toLowerCase().includes(subNameClean) ||
                                                    subNameClean.includes(d.product_name.trim().toLowerCase()))
                                        )
                                    }

                                    // 5. Nếu chưa khớp -> khớp theo thứ tự index
                                    if (!matched && enrichedLotItems[i] && !enrichedLotItems[i].isMatched) {
                                        matched = enrichedLotItems[i]
                                    }

                                    // 6. Fallback: dòng đầu tiên còn lại chưa gán
                                    if (!matched) {
                                        matched = enrichedLotItems.find((d: any) => !d.isMatched)
                                    }
                                }

                                if (matched) {
                                    matched.isMatched = true
                                    await (supabase as any)
                                        .from('lot_items')
                                        .update({ quantity: sub.new_quantity })
                                        .eq('id', matched.id)
                                } else if (sub.new_quantity > 0) {
                                    let resolvedProductId = sub.product_id || null
                                    if (!resolvedProductId && sub.sku) {
                                        try {
                                            const { data: prodRow } = await (supabase as any)
                                                .from('products')
                                                .select('id')
                                                .eq('sku', sub.sku)
                                                .limit(1)
                                                .maybeSingle()
                                            if (prodRow?.id) resolvedProductId = prodRow.id
                                        } catch {
                                            // ignore
                                        }
                                    }
                                    await (supabase as any)
                                        .from('lot_items')
                                        .insert({
                                            lot_id: lotId,
                                            product_id: resolvedProductId,
                                            quantity: sub.new_quantity,
                                            unit: sub.unit || it.unit || 'Thùng'
                                        })
                                }
                            }
                        } else {
                            // Nếu lô này chưa có bản ghi lot_items nào, tạo mới từng dòng con tương ứng
                            const inserts = it.sub_items.map((sub: ProposalSubItem) => ({
                                lot_id: lotId,
                                product_id: sub.product_id || null,
                                quantity: sub.new_quantity,
                                unit: sub.unit || it.unit || 'Thùng'
                            }))
                            await (supabase as any).from('lot_items').insert(inserts)
                        }
                    } catch (err) {
                        console.error('Lỗi khi cập nhật chi tiết lot_items:', err)
                    }
                } else {
                    // Pallet đơn thông thường (chỉ có 1 sản phẩm)
                    await (supabase as any)
                        .from('lot_items')
                        .update({ quantity: it.new_quantity })
                        .eq('lot_id', lotId)
                }

                return true
            }
        }

        // ── 3. THAO TÁC CHUYỂN Ô (MOVE) ──
        if (it.action_type === 'MOVE') {
            // Tra cứu target_position_id nếu người dùng chỉ nhập mã ô (target_position_code)
            let targetPosId = it.target_position_id
            if (!targetPosId && it.target_position_code) {
                const targetCode = it.target_position_code.trim()
                const { data: foundPos } = await (supabase as any)
                    .from('positions')
                    .select('id')
                    .ilike('code', targetCode)
                    .maybeSingle()
                if (foundPos?.id) {
                    targetPosId = foundPos.id
                }
            }

            // Lấy lot_id của ô nguồn nếu bị thiếu
            let lotIdToMove = it.lot_id
            if (!lotIdToMove && it.position_id) {
                const { data: currentPos } = await (supabase as any)
                    .from('positions')
                    .select('lot_id')
                    .eq('id', it.position_id)
                    .maybeSingle()
                if (currentPos?.lot_id) {
                    lotIdToMove = currentPos.lot_id
                }
            }

            if (targetPosId && lotIdToMove) {
                // 1. Gỡ lot_id ở ô cũ
                await (supabase as any)
                    .from('positions')
                    .update({ lot_id: null })
                    .eq('id', it.position_id)

                // 2. Gán lot_id vào ô mới
                await (supabase as any)
                    .from('positions')
                    .update({ lot_id: lotIdToMove })
                    .eq('id', targetPosId)

                return true
            } else {
                console.warn('Không thể di chuyển vị trí do thiếu targetPosId hoặc lotIdToMove:', {
                    targetPosId,
                    lotIdToMove,
                    target_position_code: it.target_position_code,
                    position_id: it.position_id
                })
                return false
            }
        }

        // ── 4. THAO TÁC GẮN STT LOT VÀO VỊ TRÍ (ASSIGN_LOT) ──
        if (it.action_type === 'ASSIGN_LOT' && it.position_id) {
            let targetLotId = it.lot_id

            // Nếu App chỉ gửi STT (VD: G57, G88) mà chưa có lot_id -> Web mẹ tự tra cứu trong CSDL
            if (!targetLotId) {
                const sttInput = (it.lot_stt || it.lot_code || '').trim().toUpperCase()
                if (!sttInput) {
                    console.warn('ASSIGN_LOT thiếu cả lot_id và lot_stt:', it)
                    return false
                }

                const { data: posRec } = await (supabase as any)
                    .from('positions')
                    .select('system_type, company_id')
                    .eq('id', it.position_id)
                    .maybeSingle()

                const sysCode = posRec?.system_type || 'KHO_DONG_LANH'
                const companyId = posRec?.company_id || null
                const encodedSeq = encodeSTT(sttInput)

                if (encodedSeq !== null) {
                    let q = (supabase as any)
                        .from('lots')
                        .select('id')
                        .eq('daily_seq', encodedSeq)
                        .eq('system_code', sysCode)
                    if (companyId) q = q.eq('company_id', companyId)
                    const { data: lotBySeq } = await q.limit(1).maybeSingle()
                    if (lotBySeq?.id) targetLotId = lotBySeq.id
                }

                if (!targetLotId) {
                    let q = (supabase as any)
                        .from('lots')
                        .select('id')
                        .eq('system_code', sysCode)
                        .or(`code.ilike.%${sttInput}%,production_code.ilike.%${sttInput}%`)
                    if (companyId) q = q.eq('company_id', companyId)
                    const { data: lotByCode } = await q.limit(1).maybeSingle()
                    if (lotByCode?.id) targetLotId = lotByCode.id
                }

                if (!targetLotId) {
                    console.warn(`Không tìm thấy Lot nào khớp STT/mã "${sttInput}" trong phân hệ ${sysCode}`)
                    return false
                }
            }

            // Nếu Lot đang nằm ở vị trí khác thì gỡ ra trước để tránh trùng lặp
            await (supabase as any)
                .from('positions')
                .update({ lot_id: null })
                .eq('lot_id', targetLotId)
                .neq('id', it.position_id)

            const { error: assignErr } = await (supabase as any)
                .from('positions')
                .update({ lot_id: targetLotId })
                .eq('id', it.position_id)

            if (assignErr) {
                console.error('Lỗi khi gắn Lot vào vị trí:', assignErr)
                return false
            }
            return true
        }

        // ── 5. THAO TÁC CHỈ GHI CHÚ (NOTE) ──
        if (it.action_type === 'NOTE') {
            // Chỉ ghi chú cho quản lý đọc, không làm thay đổi vị trí hay số lượng hàng hóa
            return true
        }

        return false
    } catch (err) {
        console.error('Lỗi trong applyProposalItemUpdate:', err)
        return false
    }
}

/**
 * Duyệt và áp dụng toàn bộ đề xuất vào sơ đồ kho chính thức
 */
export async function approveWarehouseProposal(
    supabase: SupabaseClient,
    proposal: WarehouseProposal,
    reviewer: {
        id?: string | null
        name?: string | null
        notes?: string | null
    }
): Promise<{ success: boolean; error?: string; appliedCount?: number }> {
    try {
        let appliedCount = 0

        // Duyệt từng item chưa duyệt trong phiếu và cập nhật vào CSDL
        for (const it of proposal.items) {
            if (it.status === 'APPROVED') continue
            const ok = await applyProposalItemUpdate(supabase, it)
            if (ok) appliedCount++
        }

        // Cập nhật trạng thái phiếu thành APPROVED (giữ nguyên toàn bộ items để xem lịch sử)
        const nowIso = new Date().toISOString()
        const approvedByName = reviewer.name || 'Quản lý'
        const updatedItems = proposal.items.map(it => ({
            ...it,
            status: 'APPROVED' as const,
            approved_at: it.approved_at || nowIso,
            approved_by_name: it.approved_by_name || approvedByName
        }))

        // 1. Cập nhật bảng primary nếu có
        try {
            await (supabase as any)
                .from(TABLE_PRIMARY)
                .update({
                    items: updatedItems,
                    total_positions: updatedItems.length,
                    status: 'APPROVED',
                    approved_by: reviewer.id || null,
                    approved_by_name: approvedByName,
                    approved_at: nowIso,
                    review_notes: reviewer.notes || null
                })
                .eq('id', proposal.id)
        } catch {
            // ignore
        }

        // 2. Cập nhật bảng fallback shift_tasks nếu có
        try {
            await (supabase as any)
                .from(TABLE_FALLBACK)
                .update({
                    status: 'completed',
                    completed_by: reviewer.id || null,
                    completed_by_name: approvedByName,
                    completed_at: nowIso,
                    completion_notes: reviewer.notes || 'Đã duyệt và cập nhật sơ đồ kho',
                    content: JSON.stringify({
                        notes: proposal.notes || '',
                        items: updatedItems
                    })
                })
                .eq('id', proposal.id)
        } catch {
            // ignore
        }

        return { success: true, appliedCount }
    } catch (err: any) {
        console.error('Lỗi duyệt phiếu điều chỉnh:', err)
        return { success: false, error: err.message || 'Lỗi khi duyệt phiếu' }
    }
}

/**
 * Từ chối phiếu đề xuất
 */
export async function rejectWarehouseProposal(
    supabase: SupabaseClient,
    proposalId: string,
    reviewer: {
        id?: string | null
        name?: string | null
        notes?: string | null
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const nowIso = new Date().toISOString()

        try {
            await (supabase as any)
                .from(TABLE_PRIMARY)
                .update({
                    status: 'REJECTED',
                    approved_by: reviewer.id || null,
                    approved_by_name: reviewer.name || 'Quản lý',
                    approved_at: nowIso,
                    review_notes: reviewer.notes || 'Từ chối đề xuất'
                })
                .eq('id', proposalId)
        } catch {
            // ignore
        }

        try {
            await (supabase as any)
                .from(TABLE_FALLBACK)
                .update({
                    status: 'cancelled',
                    completed_by: reviewer.id || null,
                    completed_by_name: reviewer.name || 'Quản lý',
                    completed_at: nowIso,
                    completion_notes: reviewer.notes || 'Đã từ chối phiếu điều chỉnh'
                })
                .eq('id', proposalId)
        } catch {
            // ignore
        }

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message || 'Lỗi từ chối phiếu' }
    }
}

/**
 * Duyệt riêng một vị trí lẻ trong phiếu đề xuất
 */
export async function approveSingleProposalItem(
    supabase: SupabaseClient,
    proposal: WarehouseProposal,
    itemToApprove: ProposalItem,
    reviewer: {
        id?: string | null
        name?: string | null
        notes?: string | null
    }
): Promise<{ success: boolean; error?: string; isProposalCompleted?: boolean }> {
    try {
        const it = itemToApprove

        // 1. Áp dụng thay đổi vào DB theo loại thao tác
        const ok = await applyProposalItemUpdate(supabase, it)
        if (!ok) {
            return { success: false, error: 'Không thể áp dụng cập nhật vị trí này vào CSDL' }
        }

        // 2. Cập nhật lại phiếu trong DB: giữ nguyên item trong lịch sử và đánh dấu đã duyệt
        const nowIso = new Date().toISOString()
        const approvedByName = reviewer.name || 'Quản lý'
        const updatedItems = proposal.items.map(p =>
            (p.id === it.id || p.position_id === it.position_id)
                ? {
                    ...p,
                    status: 'APPROVED' as const,
                    approved_at: nowIso,
                    approved_by_name: approvedByName
                }
                : p
        )
        const isCompleted = updatedItems.every(p => p.status === 'APPROVED')

        try {
            await (supabase as any)
                .from(TABLE_PRIMARY)
                .update({
                    items: updatedItems,
                    total_positions: updatedItems.length,
                    status: isCompleted ? 'APPROVED' : 'PENDING',
                    approved_by: isCompleted ? (reviewer.id || null) : undefined,
                    approved_by_name: isCompleted ? approvedByName : undefined,
                    approved_at: isCompleted ? nowIso : undefined,
                    updated_at: nowIso,
                })
                .eq('id', proposal.id)
        } catch {
            // ignore
        }

        try {
            await (supabase as any)
                .from(TABLE_FALLBACK)
                .update({
                    status: isCompleted ? 'completed' : 'pending',
                    completed_by: isCompleted ? (reviewer.id || null) : undefined,
                    completed_by_name: isCompleted ? approvedByName : undefined,
                    completed_at: isCompleted ? nowIso : undefined,
                    content: JSON.stringify({
                        notes: proposal.notes || '',
                        items: updatedItems
                    })
                })
                .eq('id', proposal.id)
        } catch {
            // ignore
        }

        return { success: true, isProposalCompleted: isCompleted }
    } catch (err: any) {
        console.error('Lỗi khi duyệt riêng vị trí:', err)
        return { success: false, error: err.message || 'Lỗi khi duyệt vị trí' }
    }
}

function mapRowToProposal(row: any): WarehouseProposal {
    return {
        id: row.id,
        code: row.code,
        system_code: row.system_code,
        company_id: row.company_id,
        title: row.title || 'Đề xuất điều chỉnh vị trí',
        created_by: row.created_by,
        created_by_name: row.created_by_name || 'Nhân viên',
        notes: row.notes,
        status: row.status || 'PENDING',
        total_positions: row.total_positions || (row.items?.length ?? 0),
        items: Array.isArray(row.items) ? row.items : [],
        approved_by: row.approved_by,
        approved_by_name: row.approved_by_name,
        approved_at: row.approved_at,
        review_notes: row.review_notes,
        created_at: row.created_at,
        updated_at: row.updated_at
    }
}

