export type PlanMode = 'INPUT_DRIVEN' | 'OUTPUT_DRIVEN' | 'HYBRID'

export type PlanStatus =
    | 'DRAFT'
    | 'APPROVED'
    | 'STAGING'
    | 'IN_PROGRESS'
    | 'PAUSED'
    | 'COMPLETED'
    | 'CANCELED'

export type PlanPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export type OutputType = 'PRIMARY' | 'BYPRODUCT' | 'SCRAP'

export type AllocationStatus =
    | 'RESERVED'
    | 'STAGED'
    | 'PARTIAL_ISSUED'
    | 'ISSUED'
    | 'RETURNED'
    | 'RELEASED'

export type PlanLogType =
    | 'ISSUE_INPUT'
    | 'RETURN_INPUT'
    | 'PRODUCE_PRIMARY'
    | 'PRODUCE_BYPRODUCT'
    | 'RECORD_SCRAP'

export interface ProductLite {
    id: string
    name: string
    sku: string
    unit: string | null
    internal_code?: string | null
    internal_name?: string | null
    aliases?: string | null
    weight_kg?: number | null
    cost_price?: number | null
    price?: number | null
    category_id?: string | null
    system_type?: string | null
    system_code?: string | null
    product_units?: Array<{
        unit_id: string
        conversion_rate: number
        unit_name?: string
    }>
}

export interface ProductionPlanInput {
    id: string
    company_id?: string | null
    system_code: string
    plan_id: string
    product_id: string
    unit: string
    weight_per_unit_kg: number
    required_quantity: number
    is_open_quantity: boolean
    allocated_quantity: number
    issued_quantity: number
    returned_quantity: number
    unit_cost: number
    notes?: string | null
    sort_order: number
    created_at?: string
    products?: ProductLite | null
}

export interface ProductionPlanOutput {
    id: string
    company_id?: string | null
    system_code: string
    plan_id: string
    product_id?: string | null
    item_name: string
    output_type: OutputType
    unit: string
    weight_per_unit_kg: number
    target_quantity: number
    produced_quantity: number
    target_lot_code?: string | null
    cost_allocation_ratio: number
    notes?: string | null
    sort_order: number
    created_at?: string
    products?: ProductLite | null
}

export interface ProductionPlanAllocation {
    id: string
    company_id?: string | null
    system_code: string
    plan_id: string
    plan_input_id?: string | null
    lot_id: string
    position_id?: string | null
    product_id: string
    lot_code?: string | null
    production_code?: string | null
    position_code?: string | null
    allocated_quantity: number
    issued_quantity: number
    returned_quantity: number
    unit: string
    weight_per_unit_kg: number
    status: AllocationStatus
    export_task_id?: string | null
    allocated_by?: string | null
    allocated_at: string
    notes?: string | null
    products?: ProductLite | null
    export_tasks?: {
        id: string
        code: string
        status: string
    } | null
}

export interface ProductionPlanLog {
    id: string
    company_id?: string | null
    system_code: string
    plan_id: string
    log_type: PlanLogType
    plan_input_id?: string | null
    plan_output_id?: string | null
    allocation_id?: string | null
    lot_id?: string | null
    product_id?: string | null
    item_name: string
    lot_code?: string | null
    production_code?: string | null
    position_code?: string | null
    quantity: number
    unit: string
    weight_kg: number
    shift_name?: string | null
    operator_name?: string | null
    event_at: string
    notes?: string | null
    created_by?: string | null
    created_at: string
}

export interface ProductionPlan {
    id: string
    company_id?: string | null
    system_code: string
    code: string
    name: string
    plan_mode: PlanMode
    status: PlanStatus
    priority: PlanPriority
    production_id?: string | null
    bom_id?: string | null
    customer_id?: string | null
    work_area_name?: string | null
    requested_by_name?: string | null
    planned_start_at?: string | null
    planned_end_at?: string | null
    actual_start_at?: string | null
    actual_end_at?: string | null
    paused_minutes: number
    worker_count?: number | null
    allowed_loss_percent: number
    expected_yield_percent?: number | null
    settled_gross_input_kg: number
    settled_returned_input_kg: number
    settled_net_input_kg: number
    settled_primary_output_kg: number
    settled_byproduct_output_kg: number
    settled_scrap_kg: number
    settled_unaccounted_loss_kg: number
    settled_total_loss_kg: number
    settled_loss_percent: number
    settled_yield_percent: number
    settlement_notes?: string | null
    outbound_order_id?: string | null
    inbound_order_id?: string | null
    notes?: string | null
    created_by?: string | null
    settled_by?: string | null
    settled_at?: string | null
    created_at: string
    updated_at: string
    customers?: { id: string; name: string } | null
    productions?: { id: string; code: string; name: string } | null
    boms?: { id: string; code: string; name: string; quantity: number } | null
    outbound_orders?: { id: string; code: string; status: string } | null
    inbound_orders?: { id: string; code: string; status: string } | null
    production_plan_inputs?: ProductionPlanInput[]
    production_plan_outputs?: ProductionPlanOutput[]
    production_plan_allocations?: ProductionPlanAllocation[]
    production_plan_logs?: ProductionPlanLog[]
}

export interface MassBalanceSummary {
    grossInputKg: number
    returnedInputKg: number
    netInputKg: number
    allocatedInputKg: number
    requiredInputKg: number
    primaryOutputKg: number
    byproductOutputKg: number
    totalRecoverableOutputKg: number
    recordedScrapKg: number
    unaccountedShrinkageKg: number
    surplusGainKg: number
    totalLossKg: number
    lossPercent: number
    primaryYieldPercent: number
    totalRecoveryPercent: number
    isOverAllowedLoss: boolean
    lossVariancePercent: number
    totalInputMaterialCost: number
    estimatedCostPerPrimaryKg: number
    activeDurationMinutes: number
    throughputInputKgPerHour: number
    workerProductivityKgPerHour: number | null
}

export interface AvailableLotStockItem {
    lotItemId: string
    lotId: string
    lotCode: string
    productionCode: string | null
    batchCode: string | null
    inboundDate: string | null
    createdAt: string
    dailySeq: number | null
    positionId: string | null
    positionCode: string
    warehouseName: string | null
    stagingAreaCode: string | null
    productId: string
    productName: string
    sku: string
    aliases: string | null
    internalCode: string | null
    quantityOnHand: number
    reservedElsewhere: number
    availableQuantity: number
    unit: string
    weightPerUnitKg: number
}

export const PLAN_MODE_CONFIG: Record<
    PlanMode,
    { label: string; shortLabel: string; badgeClass: string; description: string }
> = {
    INPUT_DRIVEN: {
        label: 'Theo Khối lượng Đầu vào (Rút hết yêu cầu)',
        shortLabel: 'Định mức Đầu vào',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
        description: 'SX yêu cầu lấy đủ khối lượng tồn kho cụ thể (VD: A 5 tấn, C 6 tấn). Kho soạn sẵn pallet, SX rút làm từ từ đến khi hết khối lượng yêu cầu.'
    },
    OUTPUT_DRIVEN: {
        label: 'Theo Mục tiêu Đầu ra (Chạy đủ SP & Quyết toán ngược)',
        shortLabel: 'Mục tiêu Đầu ra',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        description: 'SX yêu cầu làm đủ số lượng thành phẩm (VD: 500 thùng khay từ hàng Ri A). Không khống chế cứng lượng xuất ban đầu; khi đủ mục tiêu thì chốt quyết toán tiêu hao, phụ phẩm & hao hụt.'
    },
    HYBRID: {
        label: 'Kết hợp Đầu vào & Đầu ra (Song song)',
        shortLabel: 'Kết hợp Cả hai',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
        description: 'Đặt chỉ tiêu đồng thời cả khối lượng nguyên liệu đầu vào dự kiến và số lượng thành phẩm đầu ra cần đạt.'
    }
}

export const PLAN_STATUS_CONFIG: Record<
    PlanStatus,
    { label: string; badgeClass: string; dotClass: string }
> = {
    DRAFT: {
        label: 'Mới yêu cầu / Nháp',
        badgeClass: 'bg-stone-100 text-stone-700 border-stone-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        dotClass: 'bg-stone-400'
    },
    APPROVED: {
        label: 'Đã duyệt (Chờ soạn)',
        badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
        dotClass: 'bg-sky-500'
    },
    STAGING: {
        label: 'Đã soạn / Giữ LOT',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
        dotClass: 'bg-indigo-500'
    },
    IN_PROGRESS: {
        label: 'Đang chạy SX',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
        dotClass: 'bg-amber-500 animate-pulse'
    },
    PAUSED: {
        label: 'Tạm dừng',
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
        dotClass: 'bg-orange-500'
    },
    COMPLETED: {
        label: 'Đã chốt quyết toán',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
        dotClass: 'bg-emerald-500'
    },
    CANCELED: {
        label: 'Đã hủy',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800',
        dotClass: 'bg-rose-500'
    }
}

export const PLAN_PRIORITY_CONFIG: Record<
    PlanPriority,
    { label: string; badgeClass: string }
> = {
    LOW: { label: 'Thấp', badgeClass: 'bg-stone-100 text-stone-600 border-stone-200' },
    NORMAL: { label: 'Bình thường', badgeClass: 'bg-blue-50 text-blue-600 border-blue-200' },
    HIGH: { label: 'Ưu tiên cao', badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
    URGENT: { label: 'Khẩn cấp', badgeClass: 'bg-rose-100 text-rose-700 border-rose-300' }
}
