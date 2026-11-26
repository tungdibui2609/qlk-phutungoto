import { supabase } from '@/lib/supabaseClient'
import { extractWeightFromName, isKg, normalizeUnit } from '@/lib/unitConversion'
import {
    AvailableLotStockItem,
    MassBalanceSummary,
    ProductLite,
    ProductionPlan,
    ProductionPlanAllocation,
    ProductionPlanInput,
    ProductionPlanLog,
    ProductionPlanOutput
} from '@/components/production-plans/types'

/**
 * Ước tính trọng lượng (Kg) trên 1 đơn vị tính của sản phẩm:
 * 1. Nếu đơn vị là Kg -> 1
 * 2. Nếu đơn vị là Tấn -> 1000 | Tạ -> 100 | Yến -> 10 | Gram -> 0.001
 * 3. Nếu tên đơn vị có hậu tố cân nặng VD "Thùng (10kg)", "Khay 0.5kg" -> trích xuất trực tiếp
 * 4. Nếu sản phẩm có cấu hình product_units quy đổi về Kg -> lấy conversion_rate
 * 5. Nếu sản phẩm có trường weight_kg > 0 và đơn vị là đơn vị gốc -> lấy weight_kg
 */
export function resolveUnitWeightKg(
    unitName: string | null | undefined,
    product?: ProductLite | null,
    unitsMap?: Map<string, string> | Record<string, string>
): number {
    if (!unitName) return product?.weight_kg && product.weight_kg > 0 ? Number(product.weight_kg) : 1
    const norm = normalizeUnit(unitName)

    if (isKg(norm)) return 1
    if (norm === 'tấn' || norm === 'tan' || norm === 'ton' || norm === 'tons' || norm === 'mt') return 1000
    if (norm === 'tạ' || norm === 'ta') return 100
    if (norm === 'yến' || norm === 'yen') return 10
    if (norm === 'g' || norm === 'gram' || norm === 'gam' || norm === 'gr') return 0.001

    const extracted = extractWeightFromName(unitName)
    if (extracted !== null && extracted > 0) {
        return extracted
    }

    if (product?.product_units && product.product_units.length > 0) {
        const getUName = (id?: string) => {
            if (!id || !unitsMap) return ''
            if (unitsMap instanceof Map) return unitsMap.get(id) || ''
            return unitsMap[id] || ''
        }

        const strippedNorm = norm.replace(/\s*\([^)]*\)/g, '').trim()
        for (const pu of product.product_units) {
            const rawUName = pu.unit_name || getUName(pu.unit_id)
            const normPu = normalizeUnit(rawUName)
            const strippedPu = normPu.replace(/\s*\([^)]*\)/g, '').trim()
            if ((normPu && normPu === norm) || (strippedPu && strippedPu === strippedNorm)) {
                if (pu.conversion_rate > 0) {
                    if (isKg(product.unit)) return Number(pu.conversion_rate)
                    if (product.weight_kg && product.weight_kg > 0) {
                        return Number(pu.conversion_rate) * Number(product.weight_kg)
                    }
                    return Number(pu.conversion_rate)
                }
            }
        }
    }

    if (product?.unit && normalizeUnit(product.unit) === norm && product.weight_kg && product.weight_kg > 0) {
        return Number(product.weight_kg)
    }

    return 1
}

/**
 * Sinh mã kế hoạch sản xuất tự động theo ngày: KHSX-DDMMYY-XXX
 */
export async function generateProductionPlanCode(systemCode: string): Promise<string> {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yy = String(now.getFullYear()).slice(-2)
    const prefix = `KHSX-${dd}${mm}${yy}-`

    const { data } = await (supabase.from('production_plans' as any) as any)
        .select('code')
        .eq('system_code', systemCode)
        .ilike('code', `${prefix}%`)
        .order('code', { ascending: false })
        .limit(20)

    let maxSeq = 0
    for (const row of data || []) {
        const parts = String(row.code || '').split('-')
        const lastNum = parseInt(parts[parts.length - 1], 10)
        if (!isNaN(lastNum) && lastNum > maxSeq) maxSeq = lastNum
    }

    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`
}

/**
 * Tính toán Cân bằng Khối lượng (Mass Balance), Tỷ lệ Thu hồi, Hao hụt & Giá vốn Kế toán
 * cho một Kế hoạch Sản xuất theo thời gian thực hoặc sau khi chốt.
 */
export function calculatePlanMassBalance(
    plan: Pick<
        ProductionPlan,
        | 'allowed_loss_percent'
        | 'actual_start_at'
        | 'actual_end_at'
        | 'paused_minutes'
        | 'worker_count'
    >,
    inputs: ProductionPlanInput[] = [],
    outputs: ProductionPlanOutput[] = [],
    logs: ProductionPlanLog[] = []
): MassBalanceSummary {
    const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

    let requiredInputKg = 0
    let allocatedInputKg = 0
    let grossInputKg = 0
    let returnedInputKg = 0
    let totalInputMaterialCost = 0

    for (const inp of inputs) {
        const w = Number(inp.weight_per_unit_kg) > 0 ? Number(inp.weight_per_unit_kg) : 1
        const reqQty = Number(inp.required_quantity) || 0
        const allocQty = Number(inp.allocated_quantity) || 0
        const issQty = Number(inp.issued_quantity) || 0
        const retQty = Number(inp.returned_quantity) || 0
        const netQty = Math.max(0, issQty - retQty)

        requiredInputKg += reqQty * w
        allocatedInputKg += allocQty * w
        grossInputKg += issQty * w
        returnedInputKg += retQty * w

        const unitCost =
            Number(inp.unit_cost) > 0
                ? Number(inp.unit_cost)
                : Number(inp.products?.cost_price || inp.products?.price || 0)
        totalInputMaterialCost += netQty * unitCost
    }

    // Cộng thêm từ nhật ký nếu người dùng phát sinh xuất ngoài dòng khai báo ban đầu
    const unmappedIssueLogsKg = logs
        .filter(l => l.log_type === 'ISSUE_INPUT' && !l.plan_input_id)
        .reduce((s, l) => s + (Number(l.weight_kg) || 0), 0)
    const unmappedReturnLogsKg = logs
        .filter(l => l.log_type === 'RETURN_INPUT' && !l.plan_input_id)
        .reduce((s, l) => s + (Number(l.weight_kg) || 0), 0)

    grossInputKg += unmappedIssueLogsKg
    returnedInputKg += unmappedReturnLogsKg

    const netInputKg = Math.max(0, grossInputKg - returnedInputKg)

    let primaryOutputKg = 0
    let byproductOutputKg = 0
    let recordedScrapFromOutputsKg = 0

    for (const out of outputs) {
        const w = Number(out.weight_per_unit_kg) > 0 ? Number(out.weight_per_unit_kg) : 1
        const prodQty = Number(out.produced_quantity) || 0
        const kg = prodQty * w
        if (out.output_type === 'PRIMARY') primaryOutputKg += kg
        else if (out.output_type === 'BYPRODUCT') byproductOutputKg += kg
        else if (out.output_type === 'SCRAP') recordedScrapFromOutputsKg += kg
    }

    // Cộng thêm các dòng ghi nhận trực tiếp trên logs không gắn plan_output_id
    const unmappedPrimaryKg = logs
        .filter(l => l.log_type === 'PRODUCE_PRIMARY' && !l.plan_output_id)
        .reduce((s, l) => s + (Number(l.weight_kg) || 0), 0)
    const unmappedByproductKg = logs
        .filter(l => l.log_type === 'PRODUCE_BYPRODUCT' && !l.plan_output_id)
        .reduce((s, l) => s + (Number(l.weight_kg) || 0), 0)
    const unmappedScrapLogsKg = logs
        .filter(l => l.log_type === 'RECORD_SCRAP' && !l.plan_output_id)
        .reduce((s, l) => s + (Number(l.weight_kg) || 0), 0)

    primaryOutputKg += unmappedPrimaryKg
    byproductOutputKg += unmappedByproductKg
    const recordedScrapKg = recordedScrapFromOutputsKg + unmappedScrapLogsKg

    const totalRecoverableOutputKg = primaryOutputKg + byproductOutputKg

    // Cân bằng khối lượng: Net Input = Primary + Byproduct + Recorded Scrap + Unaccounted Shrinkage
    const rawDiffKg = netInputKg - totalRecoverableOutputKg
    const totalLossKg = Math.max(0, rawDiffKg)
    const surplusGainKg = rawDiffKg < 0 ? Math.abs(rawDiffKg) : 0
    const unaccountedShrinkageKg = Math.max(0, totalLossKg - recordedScrapKg)

    const lossPercent = netInputKg > 0 ? (totalLossKg / netInputKg) * 100 : 0
    const primaryYieldPercent = netInputKg > 0 ? (primaryOutputKg / netInputKg) * 100 : 0
    const totalRecoveryPercent = netInputKg > 0 ? (totalRecoverableOutputKg / netInputKg) * 100 : 0

    const allowedLoss = Number(plan.allowed_loss_percent) || 0
    const lossVariancePercent = lossPercent - allowedLoss
    const isOverAllowedLoss = netInputKg > 0 && lossPercent > allowedLoss + 0.001

    // Giá vốn bình quân trên 1 Kg thành phẩm chính (sau khi hấp thụ hao hụt)
    const estimatedCostPerPrimaryKg =
        primaryOutputKg > 0 ? totalInputMaterialCost / primaryOutputKg : 0

    // Tính thời gian chạy thực tế & năng suất
    let activeDurationMinutes = 0
    if (plan.actual_start_at) {
        const startMs = new Date(plan.actual_start_at).getTime()
        const endMs = plan.actual_end_at ? new Date(plan.actual_end_at).getTime() : Date.now()
        if (endMs > startMs) {
            const rawMinutes = Math.floor((endMs - startMs) / 60000)
            activeDurationMinutes = Math.max(1, rawMinutes - (Number(plan.paused_minutes) || 0))
        }
    }

    const activeHours = activeDurationMinutes > 0 ? activeDurationMinutes / 60 : 0
    const throughputInputKgPerHour = activeHours > 0 ? netInputKg / activeHours : 0
    const workerProductivityKgPerHour =
        activeHours > 0 && plan.worker_count && plan.worker_count > 0
            ? throughputInputKgPerHour / plan.worker_count
            : null

    return {
        grossInputKg: round2(grossInputKg),
        returnedInputKg: round2(returnedInputKg),
        netInputKg: round2(netInputKg),
        allocatedInputKg: round2(allocatedInputKg),
        requiredInputKg: round2(requiredInputKg),
        primaryOutputKg: round2(primaryOutputKg),
        byproductOutputKg: round2(byproductOutputKg),
        totalRecoverableOutputKg: round2(totalRecoverableOutputKg),
        recordedScrapKg: round2(recordedScrapKg),
        unaccountedShrinkageKg: round2(unaccountedShrinkageKg),
        surplusGainKg: round2(surplusGainKg),
        totalLossKg: round2(totalLossKg),
        lossPercent: round2(lossPercent),
        primaryYieldPercent: round2(primaryYieldPercent),
        totalRecoveryPercent: round2(totalRecoveryPercent),
        isOverAllowedLoss,
        lossVariancePercent: round2(lossVariancePercent),
        totalInputMaterialCost: round2(totalInputMaterialCost),
        estimatedCostPerPrimaryKg: round2(estimatedCostPerPrimaryKg),
        activeDurationMinutes,
        throughputInputKgPerHour: round2(throughputInputKgPerHour),
        workerProductivityKgPerHour:
            workerProductivityKgPerHour !== null ? round2(workerProductivityKgPerHour) : null
    }
}

/**
 * Tải danh sách tồn kho LOT khả dụng của phân hệ hiện hành (phân trang an toàn cho kho lớn),
 * trừ đi số lượng đang được giữ chỗ (RESERVED / STAGED / PARTIAL_ISSUED) ở các Kế hoạch SX khác,
 * và sắp xếp ưu tiên FIFO (inbound_date cũ nhất lên đầu).
 */
export async function fetchAvailableLotsForStaging(
    systemCode: string,
    filterProductIds?: string[]
): Promise<AvailableLotStockItem[]> {
    const PAGE_SIZE = 1000
    let allLots: any[] = []
    let from = 0
    let hasMore = true

    while (hasMore) {
        let query = supabase
            .from('lots')
            .select(`
                id,
                code,
                production_code,
                batch_code,
                inbound_date,
                created_at,
                daily_seq,
                status,
                is_locked,
                warehouse_name,
                staging_area_code,
                lot_items!inner (
                    id,
                    product_id,
                    quantity,
                    unit,
                    products!inner (
                        id,
                        name,
                        sku,
                        unit,
                        aliases,
                        internal_code,
                        weight_kg,
                        product_units ( unit_id, conversion_rate )
                    )
                ),
                positions!positions_lot_id_fkey ( id, code )
            `)
            .eq('system_code', systemCode)
            .neq('status', 'Exported')
            .neq('status', 'Deleted')
            .gt('lot_items.quantity', 0)

        if (filterProductIds && filterProductIds.length > 0) {
            query = query.in('lot_items.product_id', filterProductIds)
        }

        const { data, error } = await query
            .order('inbound_date', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true })
            .range(from, from + PAGE_SIZE - 1)

        if (error) throw error

        if (!data || data.length === 0) {
            hasMore = false
        } else {
            allLots = [...allLots, ...data]
            if (data.length < PAGE_SIZE) hasMore = false
            else from += PAGE_SIZE
        }
    }

    // Lấy các khoản đang giữ chỗ ở các kế hoạch đang chạy trong cùng phân hệ
    const { data: activeAllocs } = await (supabase.from('production_plan_allocations' as any) as any)
        .select('lot_id, product_id, allocated_quantity, issued_quantity, status')
        .eq('system_code', systemCode)
        .in('status', ['RESERVED', 'STAGED', 'PARTIAL_ISSUED'])

    const reservedMap = new Map<string, number>()
    for (const a of activeAllocs || []) {
        const key = `${a.lot_id}_${a.product_id}`
        const remainingHold = Math.max(0, (Number(a.allocated_quantity) || 0) - (Number(a.issued_quantity) || 0))
        reservedMap.set(key, (reservedMap.get(key) || 0) + remainingHold)
    }

    const items: AvailableLotStockItem[] = []

    for (const lot of allLots) {
        if (lot.is_locked) continue
        const pos = Array.isArray(lot.positions) && lot.positions.length > 0 ? lot.positions[0] : null

        for (const li of lot.lot_items || []) {
            const qtyOnHand = Number(li.quantity) || 0
            if (qtyOnHand <= 0) continue

            const prod = li.products as ProductLite
            const key = `${lot.id}_${li.product_id}`
            const reserved = reservedMap.get(key) || 0
            const available = Math.max(0, qtyOnHand - reserved)
            const weightPerUnitKg = resolveUnitWeightKg(li.unit || prod?.unit, prod)

            items.push({
                lotItemId: li.id,
                lotId: lot.id,
                lotCode: lot.code,
                productionCode: lot.production_code || null,
                batchCode: lot.batch_code || null,
                inboundDate: lot.inbound_date || null,
                createdAt: lot.created_at,
                dailySeq: lot.daily_seq || null,
                positionId: pos?.id || null,
                positionCode: pos?.code || (lot.staging_area_code ? `Sảnh: ${lot.staging_area_code}` : 'Chưa gán vị trí'),
                warehouseName: lot.warehouse_name || null,
                stagingAreaCode: lot.staging_area_code || null,
                productId: li.product_id,
                productName: prod?.name || '---',
                sku: prod?.sku || '---',
                aliases: prod?.aliases || null,
                internalCode: prod?.internal_code || null,
                quantityOnHand: qtyOnHand,
                reservedElsewhere: reserved,
                availableQuantity: available,
                unit: li.unit || prod?.unit || 'Kg',
                weightPerUnitKg
            })
        }
    }

    // Sắp xếp chuẩn FIFO: ngày nhập kho sớm nhất -> ngày tạo sớm nhất
    return items.sort((a, b) => {
        const da = a.inboundDate ? new Date(a.inboundDate).getTime() : new Date(a.createdAt).getTime()
        const db = b.inboundDate ? new Date(b.inboundDate).getTime() : new Date(b.createdAt).getTime()
        return da - db
    })
}

/**
 * Đẩy các Pallet/LOT đã soạn trong Kế hoạch Sản xuất sang Lệnh Xuất Kho (/work/export-order)
 * để đội xe nâng trên Web / Web Scanner (/scanner) / App Android nhận lệnh lấy hàng ngay lập tức!
 */
export async function pushAllocationsToExportTask(params: {
    plan: ProductionPlan
    allocations: ProductionPlanAllocation[]
    userId: string
}): Promise<{ taskId: string; taskCode: string }> {
    const { plan, allocations, userId } = params
    const targetAllocs = allocations.filter(
        a => !a.export_task_id && ['RESERVED', 'STAGED'].includes(a.status) && a.allocated_quantity > 0
    )

    if (targetAllocs.length === 0) {
        throw new Error('Không có Pallet/LOT mới nào đang chờ đẩy sang Lệnh xuất kho.')
    }

    const suffix = Date.now().toString().slice(-4)
    const taskCode = `LX-${plan.code}-${suffix}`

    const { data: task, error: taskErr } = await (supabase.from('export_tasks' as any) as any)
        .insert({
            code: taskCode,
            status: 'Pending',
            created_by: userId,
            system_code: plan.system_code,
            notes: `[Kế hoạch SX: ${plan.code}] ${plan.name}${plan.work_area_name ? ` • Khu vực: ${plan.work_area_name}` : ''}`
        })
        .select()
        .single()

    if (taskErr) throw taskErr

    const taskItems = targetAllocs.map(a => ({
        task_id: task.id,
        lot_id: a.lot_id,
        position_id: a.position_id || null,
        product_id: a.product_id,
        quantity: a.allocated_quantity,
        unit: a.unit,
        status: 'Pending',
        metadata: {
            production_plan_id: plan.id,
            production_plan_code: plan.code,
            allocation_id: a.id
        }
    }))

    const { error: itemsErr } = await (supabase.from('export_task_items' as any) as any).insert(taskItems)
    if (itemsErr) {
        await (supabase.from('export_tasks' as any) as any).delete().eq('id', task.id)
        throw itemsErr
    }

    // Gắn export_task_id và chuyển trạng thái STAGED cho các dòng phân bổ
    const allocIds = targetAllocs.map(a => a.id)
    await (supabase.from('production_plan_allocations' as any) as any)
        .update({
            export_task_id: task.id,
            status: 'STAGED'
        })
        .in('id', allocIds)

    // Nếu kế hoạch đang ở DRAFT hoặc APPROVED, nâng lên STAGING
    if (plan.status === 'DRAFT' || plan.status === 'APPROVED') {
        await (supabase.from('production_plans' as any) as any)
            .update({ status: 'STAGING', updated_at: new Date().toISOString() })
            .eq('id', plan.id)
    }

    return { taskId: task.id, taskCode }
}

/**
 * Đồng bộ số lượng thực tế đã xuất từ Lệnh Xuất Kho (export_task_items.exported_quantity)
 * ngược về Kế hoạch Sản xuất (allocations + inputs + tạo dòng nhật ký tự động cho phần chênh lệch mới xuất).
 */
export async function syncExportedQuantitiesFromTasks(
    plan: ProductionPlan,
    allocations: ProductionPlanAllocation[],
    inputs: ProductionPlanInput[]
): Promise<{ syncedCount: number; addedKg: number }> {
    const linkedAllocs = allocations.filter(a => !!a.export_task_id)
    if (linkedAllocs.length === 0) return { syncedCount: 0, addedKg: 0 }

    const taskIds = Array.from(new Set(linkedAllocs.map(a => a.export_task_id!)))
    const { data: taskItems, error } = await (supabase.from('export_task_items' as any) as any)
        .select('id, task_id, lot_id, product_id, quantity, exported_quantity, unit, status')
        .in('task_id', taskIds)

    if (error) throw error
    if (!taskItems || taskItems.length === 0) return { syncedCount: 0, addedKg: 0 }

    let syncedCount = 0
    let addedKg = 0
    const newLogs: any[] = []

    for (const alloc of linkedAllocs) {
        const matched = taskItems.find(
            (ti: any) =>
                ti.task_id === alloc.export_task_id &&
                ti.lot_id === alloc.lot_id &&
                ti.product_id === alloc.product_id
        )
        if (!matched) continue

        const exportedQty = Number(matched.exported_quantity) || 0
        const currentIssued = Number(alloc.issued_quantity) || 0
        const delta = Math.round((exportedQty - currentIssued) * 1000) / 1000

        if (delta > 0.0001) {
            const newStatus =
                exportedQty >= Number(alloc.allocated_quantity) - 0.0001 ? 'ISSUED' : 'PARTIAL_ISSUED'
            const wKg = (Number(alloc.weight_per_unit_kg) || 1) * delta

            await (supabase.from('production_plan_allocations' as any) as any)
                .update({
                    issued_quantity: exportedQty,
                    status: newStatus
                })
                .eq('id', alloc.id)

            newLogs.push({
                system_code: plan.system_code,
                plan_id: plan.id,
                log_type: 'ISSUE_INPUT',
                plan_input_id: alloc.plan_input_id || null,
                allocation_id: alloc.id,
                lot_id: alloc.lot_id,
                product_id: alloc.product_id,
                item_name: alloc.products?.name || 'Nguyên liệu từ Lệnh xuất',
                lot_code: alloc.lot_code || null,
                production_code: alloc.production_code || null,
                position_code: alloc.position_code || null,
                quantity: delta,
                unit: alloc.unit,
                weight_kg: Math.round(wKg * 100) / 100,
                shift_name: 'Đồng bộ Lệnh xuất',
                notes: `Tự động đồng bộ từ Lệnh xuất kho ${alloc.export_tasks?.code || ''}`.trim()
            })

            syncedCount++
            addedKg += wKg
        }
    }

    if (newLogs.length > 0) {
        await (supabase.from('production_plan_logs' as any) as any).insert(newLogs)
        await recalculatePlanAggregates(plan.id)

        if (['DRAFT', 'APPROVED', 'STAGING'].includes(plan.status)) {
            await (supabase.from('production_plans' as any) as any)
                .update({
                    status: 'IN_PROGRESS',
                    actual_start_at: plan.actual_start_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', plan.id)
        }
    }

    // Suppress unused warning
    void inputs

    return { syncedCount, addedKg: Math.round(addedKg * 100) / 100 }
}

/**
 * Tính lại tổng số lượng allocated_quantity, issued_quantity, returned_quantity trên inputs
 * và produced_quantity trên outputs từ bảng allocations và logs để dữ liệu luôn chuẩn xác 100%.
 */
export async function recalculatePlanAggregates(planId: string): Promise<void> {
    const [inputsRes, outputsRes, allocsRes, logsRes] = await Promise.all([
        (supabase.from('production_plan_inputs' as any) as any).select('*').eq('plan_id', planId),
        (supabase.from('production_plan_outputs' as any) as any).select('*').eq('plan_id', planId),
        (supabase.from('production_plan_allocations' as any) as any)
            .select('*')
            .eq('plan_id', planId)
            .neq('status', 'RELEASED'),
        (supabase.from('production_plan_logs' as any) as any).select('*').eq('plan_id', planId)
    ])

    const inputs: ProductionPlanInput[] = inputsRes.data || []
    const outputs: ProductionPlanOutput[] = outputsRes.data || []
    const allocs: ProductionPlanAllocation[] = allocsRes.data || []
    const logs: ProductionPlanLog[] = logsRes.data || []

    for (const inp of inputs) {
        const allocSum = allocs
            .filter(a => a.plan_input_id === inp.id || (!a.plan_input_id && a.product_id === inp.product_id))
            .reduce((s, a) => s + (Number(a.allocated_quantity) || 0), 0)

        const issuedSum = logs
            .filter(
                l =>
                    l.log_type === 'ISSUE_INPUT' &&
                    (l.plan_input_id === inp.id || (!l.plan_input_id && l.product_id === inp.product_id))
            )
            .reduce((s, l) => s + (Number(l.quantity) || 0), 0)

        const returnedSum = logs
            .filter(
                l =>
                    l.log_type === 'RETURN_INPUT' &&
                    (l.plan_input_id === inp.id || (!l.plan_input_id && l.product_id === inp.product_id))
            )
            .reduce((s, l) => s + (Number(l.quantity) || 0), 0)

        await (supabase.from('production_plan_inputs' as any) as any)
            .update({
                allocated_quantity: Math.round(allocSum * 1000) / 1000,
                issued_quantity: Math.round(issuedSum * 1000) / 1000,
                returned_quantity: Math.round(returnedSum * 1000) / 1000
            })
            .eq('id', inp.id)
    }

    for (const out of outputs) {
        const producedSum = logs
            .filter(l => l.plan_output_id === out.id)
            .reduce((s, l) => s + (Number(l.quantity) || 0), 0)

        await (supabase.from('production_plan_outputs' as any) as any)
            .update({
                produced_quantity: Math.round(producedSum * 1000) / 1000
            })
            .eq('id', out.id)
    }
}

/**
 * Định dạng thời lượng phút sang chuỗi Tiếng Việt dễ đọc (VD: "4 giờ 35 phút")
 */
export function formatDurationMinutes(minutes: number): string {
    if (!minutes || minutes <= 0) return '0 phút'
    const hrs = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hrs === 0) return `${mins} phút`
    if (mins === 0) return `${hrs} giờ`
    return `${hrs} giờ ${mins} phút`
}
