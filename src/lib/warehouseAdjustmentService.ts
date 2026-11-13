import { SupabaseClient } from '@supabase/supabase-js'

export type ProposalActionType = 'CLEAR' | 'SET_QTY' | 'MOVE'

export interface ProposalSubItem {
    product_id?: string | null
    product_name: string
    sku?: string | null
    current_quantity: number
    new_quantity: number
    unit: string
}

export interface ProposalItem {
    id: string
    position_id: string
    position_code: string
    warehouse_name?: string
    action_type: ProposalActionType
    lot_id?: string | null
    lot_code?: string | null
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
            return data.map(mapRowToProposal)
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

        if (statusFilter && statusFilter !== 'ALL') {
            return proposals.filter(p => p.status === statusFilter.toUpperCase())
        }
        return proposals
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

        // Duyệt từng item trong phiếu và cập nhật vào bảng positions / lots
        for (const it of proposal.items) {
            if (it.action_type === 'CLEAR') {
                // 1. Rỗng ô: Gỡ lot_id khỏi vị trí
                const { error: posErr } = await (supabase as any)
                    .from('positions')
                    .update({ lot_id: null })
                    .eq('id', it.position_id)

                if (posErr) {
                    console.error('Lỗi khi rỗng ô:', it.position_code, posErr)
                } else {
                    appliedCount++
                }
            } else if (it.action_type === 'SET_QTY' && it.new_quantity !== undefined && it.new_quantity !== null) {
                // 2. Sửa số lượng (lẻ thùng)
                if (it.lot_id) {
                    // Cập nhật tổng quantity ở bảng lots
                    await (supabase as any)
                        .from('lots')
                        .update({ quantity: it.new_quantity })
                        .eq('id', it.lot_id)

                    // Nếu có chi tiết từng dòng con (sub_items) cho pallet hỗn hợp
                    if (it.sub_items && it.sub_items.length > 0) {
                        try {
                            const { data: dbLotItems } = await (supabase as any)
                                .from('lot_items')
                                .select('id, product_id, sku, product_name, quantity')
                                .eq('lot_id', it.lot_id)

                            if (Array.isArray(dbLotItems) && dbLotItems.length > 0) {
                                for (const sub of it.sub_items) {
                                    // Tìm dòng khớp theo product_id, sku hoặc tên
                                    const matched = dbLotItems.find(
                                        (d: any) =>
                                            (sub.product_id && d.product_id === sub.product_id) ||
                                            (sub.sku && d.sku && d.sku.trim() === sub.sku.trim()) ||
                                            (sub.product_name && d.product_name && d.product_name.trim().toLowerCase() === sub.product_name.trim().toLowerCase())
                                    )

                                    if (matched) {
                                        await (supabase as any)
                                            .from('lot_items')
                                            .update({ quantity: sub.new_quantity })
                                            .eq('id', matched.id)
                                    }
                                }
                            } else {
                                // Fallback nếu chưa có record riêng trong lot_items
                                await (supabase as any)
                                    .from('lot_items')
                                    .update({ quantity: it.new_quantity })
                                    .eq('lot_id', it.lot_id)
                            }
                        } catch (err) {
                            console.error('Lỗi khi cập nhật chi tiết lot_items:', err)
                        }
                    } else {
                        // Pallet đơn thông thường
                        await (supabase as any)
                            .from('lot_items')
                            .update({ quantity: it.new_quantity })
                            .eq('lot_id', it.lot_id)
                    }

                    appliedCount++
                }
            } else if (it.action_type === 'MOVE' && it.target_position_id && it.lot_id) {
                // 3. Chuyển ô: gỡ ở ô cũ, gán vào ô mới
                await (supabase as any)
                    .from('positions')
                    .update({ lot_id: null })
                    .eq('id', it.position_id)

                await (supabase as any)
                    .from('positions')
                    .update({ lot_id: it.lot_id })
                    .eq('id', it.target_position_id)

                appliedCount++
            }
        }

        // Cập nhật trạng thái phiếu thành APPROVED
        const nowIso = new Date().toISOString()

        // 1. Cập nhật bảng primary nếu có
        try {
            await (supabase as any)
                .from(TABLE_PRIMARY)
                .update({
                    status: 'APPROVED',
                    approved_by: reviewer.id || null,
                    approved_by_name: reviewer.name || 'Quản lý',
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
                    completed_by_name: reviewer.name || 'Quản lý',
                    completed_at: nowIso,
                    completion_notes: reviewer.notes || 'Đã duyệt và cập nhật sơ đồ kho'
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

