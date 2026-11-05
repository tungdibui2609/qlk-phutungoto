export type WorkPlanStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'EVALUATED' | 'LOCKED'

export type WorkPlanItemStatus =
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'partial'
    | 'uncompleted'
    | 'cancelled'

export type WorkPlanPriority = 'urgent' | 'important' | 'normal'

export type WorkPlanRating =
    | 'excellent'
    | 'good'
    | 'satisfactory'
    | 'needs_improvement'
    | 'poor'

export type WorkloadDifficulty = 'light' | 'medium' | 'heavy' | 'very_heavy'

export interface LinkedExportOrderSummary {
    id: string
    code: string
    status: string
    created_at?: string
    positions_count: number
    lots_count: number
    total_quantity: number
    exported_quantity?: number
    unit: string
    estimated_weight_kg?: number | null
}

export interface LinkedAccountingOrderSummary {
    id: string
    code: string
    order_kind: 'inbound' | 'outbound'
    status: string
    created_at?: string
    partner_name?: string | null
    warehouse_name?: string | null
    description?: string | null
    items_count: number
    total_quantity: number
    unit: string
    estimated_weight_kg?: number | null
}

export interface LinkedLotDateSummary {
    id: string // `${created_date}_${zone_id || 'ALL'}`
    created_date: string // YYYY-MM-DD
    zone_id?: string | null
    zone_name: string // 'Tất cả kho' | 'KHO 1' | 'KHO 2' ...
    lots_count: number
    assigned_positions_count: number
    total_quantity: number
    unit: string
    estimated_weight_kg?: number | null
}

export interface WorkloadMetrics {
    difficulty?: WorkloadDifficulty | null
    linked_export_orders?: LinkedExportOrderSummary[]
    linked_inbound_orders?: LinkedAccountingOrderSummary[]
    linked_outbound_orders?: LinkedAccountingOrderSummary[]
    linked_lot_summaries?: LinkedLotDateSummary[]
    positions_count?: number | null
    lots_count?: number | null
    packages_count?: number | null
    package_unit?: string | null
    weight_kg?: number | null
    containers_count?: number | null
    hours_spent?: number | null
    custom_metric_label?: string | null
    custom_metric_value?: string | null
    external_link?: string | null
    // Hệ số nhân / chia khối lượng thực tế (VD: 1/3, 1/2, x2 đưa ra đưa vào) + lý do
    quantity_factor?: number | null
    quantity_factor_label?: string | null
    quantity_adjustment_note?: string | null
    base_positions_count?: number | null
    base_lots_count?: number | null
    base_packages_count?: number | null
    base_weight_kg?: number | null
}

export interface QuantityFactorPreset {
    key: string
    label: string
    shortBadge: string
    factor: number
    description: string
    suggestedReasons: string[]
}

export const QUANTITY_FACTOR_PRESETS: QuantityFactorPreset[] = [
    {
        key: '1/3',
        label: '1/3 Khối lượng',
        shortBadge: '1/3',
        factor: 1 / 3,
        description: 'Chỉ thực hiện 1/3 (do hàng đã bốc sẵn một phần hoặc chia 3 ca)',
        suggestedReasons: [
            'Một số hàng đã được bốc/chuẩn bị sẵn từ trước (tính 1/3 khối lượng)',
            'Chia khối lượng thực hiện cùng các ca/nhóm khác (1/3)',
        ],
    },
    {
        key: '1/2',
        label: '1/2 (Một nửa)',
        shortBadge: '1/2',
        factor: 0.5,
        description: 'Thực hiện 50% khối lượng (một nửa đã làm sẵn hoặc chia đôi)',
        suggestedReasons: [
            'Một nửa lượng hàng đã được bốc/hạ sẵn từ trước (tính 1/2 khối lượng)',
            'Chia đôi khối lượng công việc với ca khác / đội khác (1/2)',
        ],
    },
    {
        key: '2/3',
        label: '2/3 Khối lượng',
        shortBadge: '2/3',
        factor: 2 / 3,
        description: 'Thực hiện 2/3 khối lượng (1/3 đã được chuẩn bị sẵn)',
        suggestedReasons: [
            'Một phần nhỏ hàng đã được bốc sẵn, thực làm 2/3 khối lượng',
        ],
    },
    {
        key: 'x1',
        label: 'x1 (Số gốc)',
        shortBadge: 'x1',
        factor: 1,
        description: 'Giữ nguyên 100% theo số liệu gốc của chứng từ',
        suggestedReasons: [],
    },
    {
        key: 'x1.5',
        label: 'x1.5 lần',
        shortBadge: 'x1.5',
        factor: 1.5,
        description: 'Đưa hàng ra xử lý và đưa một nửa quay lại kho',
        suggestedReasons: [
            'Đưa hàng ra xử lý và đưa một phần vào lại kho (x1.5 khối lượng)',
        ],
    },
    {
        key: 'x2',
        label: 'x2 (Nhân đôi)',
        shortBadge: 'x2',
        factor: 2,
        description: 'Đưa hàng ra dán tem/đai kiện rồi đưa vào lại kho (2 lượt)',
        suggestedReasons: [
            'Đưa ra đưa vào nhân đôi khối lượng (hạ ra dán tem/đai kiện rồi xếp vào lại kho)',
            'Bốc xếp 2 lượt: hạ hàng xuống sảnh kiểm đếm và chất lại lên kệ/cont (x2)',
        ],
    },
    {
        key: 'x3',
        label: 'x3 (Nhân ba)',
        shortBadge: 'x3',
        factor: 3,
        description: 'Di chuyển, phân loại và bốc xếp qua 3 công đoạn',
        suggestedReasons: [
            'Đưa hàng ra, phân loại/dán tem và trung chuyển qua kho khác (3 lượt bốc xếp)',
        ],
    },
]

export interface WorkPlanAssignee {
    id?: string
    name: string
    type: 'member' | 'team' | 'custom'
    role?: string
}

export interface WorkPlan {
    id: string
    system_code: string
    company_id: string | null
    plan_date: string // YYYY-MM-DD
    shift_name: string
    title: string
    area_name: string | null
    general_note: string | null
    end_of_day_summary: string | null
    status: WorkPlanStatus
    created_by: string | null
    created_by_name: string | null
    evaluated_by: string | null
    evaluated_by_name: string | null
    evaluated_at: string | null
    created_at: string
    updated_at: string
}

export interface WorkPlanItem {
    id: string
    plan_id: string
    system_code: string
    company_id: string | null
    plan_date: string // YYYY-MM-DD
    sort_order: number
    content: string
    category: string | null
    priority: WorkPlanPriority
    location_note: string | null
    assignees: WorkPlanAssignee[]
    images: string[]
    status: WorkPlanItemStatus
    progress_percent: number
    rating: WorkPlanRating | null
    rating_stars: number | null
    evaluation_note: string | null
    completion_images: string[]
    workload_metrics?: WorkloadMetrics | null
    evaluated_by: string | null
    evaluated_by_name: string | null
    evaluated_at: string | null
    carried_from_item_id: string | null
    carried_to_date: string | null
    created_at: string
    updated_at: string
}

export const WORK_CATEGORIES = [
    'Vận hành kho',
    'Xuất / Nhập cont',
    'Hàng sản xuất / Khay',
    'Vệ sinh & 5S',
    'Đào tạo & Hỗ trợ',
    'Sắp xếp & Ghép hàng',
    'Bảo trì / Thiết bị',
    'Khác',
] as const

export const WORK_SHIFTS = [
    'Cả ngày',
    'Ca 1 (Sáng)',
    'Ca 2 (Chiều)',
    'Ca 3 (Đêm)',
    'Hành chính',
] as const

export const DIFFICULTY_CONFIG: Record<
    WorkloadDifficulty,
    {
        label: string
        shortLabel: string
        multiplier: number
        badgeEmoji: string
        bgClass: string
        textClass: string
        borderClass: string
        description: string
    }
> = {
    light: {
        label: 'Nhẹ',
        shortLabel: 'Nhẹ (x1.0)',
        multiplier: 1.0,
        badgeEmoji: '🌱',
        bgClass: 'bg-sky-50',
        textClass: 'text-sky-700',
        borderClass: 'border-sky-200',
        description: 'Công việc nhẹ nhàng, ít vị trí (< 10 vị trí)',
    },
    medium: {
        label: 'Vừa',
        shortLabel: 'Vừa (x1.2)',
        multiplier: 1.2,
        badgeEmoji: '⚡',
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-700',
        borderClass: 'border-indigo-200',
        description: 'Khối lượng trung bình (10 – 24 vị trí)',
    },
    heavy: {
        label: 'Nặng',
        shortLabel: 'Nặng (x1.5)',
        multiplier: 1.5,
        badgeEmoji: '💪',
        bgClass: 'bg-orange-50',
        textClass: 'text-orange-700',
        borderClass: 'border-orange-200',
        description: 'Công việc nặng, nhiều vị trí (25 – 44 vị trí) hoặc dọn vệ sinh nặng',
    },
    very_heavy: {
        label: 'Rất nặng',
        shortLabel: 'Rất nặng (x2.0)',
        multiplier: 2.0,
        badgeEmoji: '🔥',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200',
        description: 'Khối lượng rất lớn (≥ 45 vị trí / xuất nguyên Cont / đập đá dàn lạnh)',
    },
}

export const ITEM_STATUS_CONFIG: Record<
    WorkPlanItemStatus,
    {
        label: string
        shortLabel: string
        bgClass: string
        textClass: string
        borderClass: string
        dotClass: string
        defaultProgress: number
    }
> = {
    pending: {
        label: 'Chưa thực hiện',
        shortLabel: 'Chờ làm',
        bgClass: 'bg-stone-100',
        textClass: 'text-stone-700',
        borderClass: 'border-stone-200',
        dotClass: 'bg-stone-400',
        defaultProgress: 0,
    },
    in_progress: {
        label: 'Đang thực hiện',
        shortLabel: 'Đang làm',
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
        dotClass: 'bg-blue-500',
        defaultProgress: 50,
    },
    completed: {
        label: 'Hoàn thành',
        shortLabel: 'Hoàn thành',
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        dotClass: 'bg-emerald-500',
        defaultProgress: 100,
    },
    partial: {
        label: 'Đạt một phần',
        shortLabel: 'Một phần',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
        defaultProgress: 60,
    },
    uncompleted: {
        label: 'Chưa xong / Tồn đọng',
        shortLabel: 'Chưa xong',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200',
        dotClass: 'bg-rose-500',
        defaultProgress: 0,
    },
    cancelled: {
        label: 'Hủy / Hoãn',
        shortLabel: 'Đã hoãn',
        bgClass: 'bg-stone-100',
        textClass: 'text-stone-400 line-through',
        borderClass: 'border-stone-200',
        dotClass: 'bg-stone-300',
        defaultProgress: 0,
    },
}

export const RATING_CONFIG: Record<
    WorkPlanRating,
    {
        label: string
        stars: number
        score: number
        bgClass: string
        textClass: string
        borderClass: string
        badgeEmoji: string
    }
> = {
    excellent: {
        label: 'Xuất sắc',
        stars: 5,
        score: 100,
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-700',
        borderClass: 'border-emerald-200',
        badgeEmoji: '🌟',
    },
    good: {
        label: 'Tốt',
        stars: 4,
        score: 85,
        bgClass: 'bg-teal-50',
        textClass: 'text-teal-700',
        borderClass: 'border-teal-200',
        badgeEmoji: '👍',
    },
    satisfactory: {
        label: 'Đạt yêu cầu',
        stars: 3,
        score: 70,
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-700',
        borderClass: 'border-blue-200',
        badgeEmoji: '👌',
    },
    needs_improvement: {
        label: 'Cần nhắc nhở',
        stars: 2,
        score: 50,
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
        badgeEmoji: '⚠️',
    },
    poor: {
        label: 'Chưa đạt',
        stars: 1,
        score: 25,
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200',
        badgeEmoji: '❗',
    },
}

export const PRIORITY_CONFIG: Record<
    WorkPlanPriority,
    {
        label: string
        bgClass: string
        textClass: string
        borderClass: string
    }
> = {
    urgent: {
        label: 'Khẩn cấp',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200',
    },
    important: {
        label: 'Quan trọng',
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-700',
        borderClass: 'border-amber-200',
    },
    normal: {
        label: 'Bình thường',
        bgClass: 'bg-stone-100',
        textClass: 'text-stone-600',
        borderClass: 'border-stone-200',
    },
}

export const QUICK_EVALUATION_NOTES = [
    'Hoàn thành tốt, đúng tiến độ giao',
    'Thực hiện nhanh, khu vực kho sạch sẽ gọn gàng',
    'Khối lượng vị trí hạ hàng lớn, xử lý rất tốt',
    'Chủ động phối hợp hỗ trợ đồng đội tốt',
    'Đạt một phần, còn tồn đọng chuyển sang ngày mai',
    'Chậm tiến độ do chờ hàng / chờ xe nâng',
]

export function formatVNDate(dateStr: string): string {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    return `${parts[2]}.${parts[1]}.${parts[0]}`
}

export function formatVNDateSlash(dateStr: string): string {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length !== 3) return dateStr
    return `${parts[2]}/${parts[1]}/${parts[0]}`
}

export function getDayOfWeekVN(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00`)
    if (isNaN(d.getTime())) return ''
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return days[d.getDay()]
}

export function buildDefaultPlanTitle(dateStr: string, systemName?: string): string {
    const dStr = formatVNDate(dateStr)
    const suffix = systemName ? ` (${systemName})` : ''
    return `Kế hoạch làm việc kho ngày ${dStr}${suffix}`
}

/**
 * Tách số Kg từ chuỗi đơn vị như "Thùng (20kg)", "Khay (0.4kg)", "Kg"
 */
export function parseUnitWeightKg(unitStr: string | null | undefined): number | null {
    if (!unitStr) return null
    const trimmed = unitStr.trim()
    if (/^kg$/i.test(trimmed)) return 1
    const match = trimmed.match(/\(\s*(\d+(?:[.,]\d+)?)\s*kg\s*\)/i)
    if (match?.[1]) {
        const val = parseFloat(match[1].replace(',', '.'))
        return isNaN(val) ? null : val
    }
    return null
}

/**
 * Tự động gợi ý Mức độ Nặng / Nhẹ dựa trên số vị trí, số LOT, số thùng hoặc số kg
 */
export function suggestWorkloadDifficulty(
    metrics: Partial<WorkloadMetrics>
): WorkloadDifficulty {
    const pos = Number(metrics.positions_count) || 0
    const lots = Number(metrics.lots_count) || 0
    const pkgs = Number(metrics.packages_count) || 0
    const kg = Number(metrics.weight_kg) || 0
    const conts = Number(metrics.containers_count) || 0

    if (pos >= 40 || lots >= 40 || pkgs >= 1000 || kg >= 15000 || conts >= 2) {
        return 'very_heavy'
    }
    if (pos >= 20 || lots >= 20 || pkgs >= 400 || kg >= 6000 || conts >= 1) {
        return 'heavy'
    }
    if (pos >= 8 || lots >= 8 || pkgs >= 120 || kg >= 1500) {
        return 'medium'
    }
    return 'light'
}

export function recalculateWorkloadFromLinkedSources(
    metrics: WorkloadMetrics
): WorkloadMetrics {
    const exportList = Array.isArray(metrics.linked_export_orders)
        ? metrics.linked_export_orders
        : []
    const inboundList = Array.isArray(metrics.linked_inbound_orders)
        ? metrics.linked_inbound_orders
        : []
    const outboundList = Array.isArray(metrics.linked_outbound_orders)
        ? metrics.linked_outbound_orders
        : []
    const lotSummaries = Array.isArray(metrics.linked_lot_summaries)
        ? metrics.linked_lot_summaries
        : []

    const totalLinkedCount =
        exportList.length + inboundList.length + outboundList.length + lotSummaries.length

    if (totalLinkedCount === 0) {
        return metrics
    }

    const sumPositions =
        exportList.reduce((s, o) => s + (o.positions_count || 0), 0) +
        lotSummaries.reduce((s, l) => s + (l.assigned_positions_count || 0), 0)

    const sumLots =
        exportList.reduce((s, o) => s + (o.lots_count || 0), 0) +
        lotSummaries.reduce((s, l) => s + (l.lots_count || 0), 0) +
        inboundList.reduce((s, o) => s + (o.items_count || 0), 0) +
        outboundList.reduce((s, o) => s + (o.items_count || 0), 0)

    const sumPackages =
        exportList.reduce((s, o) => s + (o.total_quantity || 0), 0) +
        inboundList.reduce((s, o) => s + (o.total_quantity || 0), 0) +
        outboundList.reduce((s, o) => s + (o.total_quantity || 0), 0) +
        lotSummaries.reduce((s, l) => s + (l.total_quantity || 0), 0)

    const sumWeight =
        exportList.reduce((s, o) => s + (o.estimated_weight_kg || 0), 0) +
        inboundList.reduce((s, o) => s + (o.estimated_weight_kg || 0), 0) +
        outboundList.reduce((s, o) => s + (o.estimated_weight_kg || 0), 0) +
        lotSummaries.reduce((s, l) => s + (l.estimated_weight_kg || 0), 0)

    const primaryUnit =
        exportList[0]?.unit ||
        inboundList[0]?.unit ||
        outboundList[0]?.unit ||
        lotSummaries[0]?.unit ||
        metrics.package_unit ||
        'Thùng'

    const factor =
        metrics.quantity_factor && metrics.quantity_factor > 0
            ? metrics.quantity_factor
            : 1

    const basePos = sumPositions > 0 ? sumPositions : metrics.base_positions_count ?? metrics.positions_count ?? null
    const baseLots = sumLots > 0 ? sumLots : metrics.base_lots_count ?? metrics.lots_count ?? null
    const basePkgs =
        sumPackages > 0
            ? Math.round(sumPackages * 100) / 100
            : metrics.base_packages_count ?? metrics.packages_count ?? null
    const baseWeight =
        sumWeight > 0
            ? Math.round(sumWeight)
            : metrics.base_weight_kg ?? metrics.weight_kg ?? null

    const updated: WorkloadMetrics = {
        ...metrics,
        base_positions_count: basePos,
        base_lots_count: baseLots,
        base_packages_count: basePkgs,
        base_weight_kg: baseWeight,
        positions_count: basePos !== null ? Math.round(basePos * factor) : null,
        lots_count: baseLots !== null ? Math.round(baseLots * factor) : null,
        packages_count:
            basePkgs !== null ? Math.round(basePkgs * factor * 100) / 100 : null,
        package_unit: primaryUnit,
        weight_kg: baseWeight !== null ? Math.round(baseWeight * factor) : null,
    }
    updated.difficulty = suggestWorkloadDifficulty(updated)
    return updated
}

/**
 * Nhân hoặc chia khối lượng (VD: 1/3, 1/2, x2 đưa ra đưa vào) dựa trên số liệu gốc
 */
export function applyQuantityFactorToMetrics(
    metrics: WorkloadMetrics,
    factor: number,
    factorLabel: string
): WorkloadMetrics {
    const oldFactor =
        metrics.quantity_factor && metrics.quantity_factor > 0
            ? metrics.quantity_factor
            : 1

    const resolveBase = (
        baseVal: number | null | undefined,
        currentVal: number | null | undefined
    ): number | null => {
        if (baseVal !== null && baseVal !== undefined && baseVal > 0) return baseVal
        if (currentVal !== null && currentVal !== undefined && currentVal > 0) {
            return Math.round((currentVal / oldFactor) * 100) / 100
        }
        return null
    }

    const basePos = resolveBase(metrics.base_positions_count, metrics.positions_count)
    const baseLots = resolveBase(metrics.base_lots_count, metrics.lots_count)
    const basePkgs = resolveBase(metrics.base_packages_count, metrics.packages_count)
    const baseWeight = resolveBase(metrics.base_weight_kg, metrics.weight_kg)

    const updated: WorkloadMetrics = {
        ...metrics,
        quantity_factor: factor === 1 ? null : factor,
        quantity_factor_label: factor === 1 ? null : factorLabel,
        quantity_adjustment_note:
            factor === 1 ? null : metrics.quantity_adjustment_note || null,
        base_positions_count: basePos,
        base_lots_count: baseLots,
        base_packages_count: basePkgs,
        base_weight_kg: baseWeight,
        positions_count: basePos !== null ? Math.round(basePos * factor) : null,
        lots_count: baseLots !== null ? Math.round(baseLots * factor) : null,
        packages_count:
            basePkgs !== null ? Math.round(basePkgs * factor * 100) / 100 : null,
        weight_kg: baseWeight !== null ? Math.round(baseWeight * factor) : null,
    }
    updated.difficulty = suggestWorkloadDifficulty(updated)
    return updated
}

export function hasWorkloadData(metrics?: WorkloadMetrics | null): boolean {
    if (!metrics) return false
    return Boolean(
        metrics.difficulty ||
            (Array.isArray(metrics.linked_export_orders) &&
                metrics.linked_export_orders.length > 0) ||
            (Array.isArray(metrics.linked_inbound_orders) &&
                metrics.linked_inbound_orders.length > 0) ||
            (Array.isArray(metrics.linked_outbound_orders) &&
                metrics.linked_outbound_orders.length > 0) ||
            (Array.isArray(metrics.linked_lot_summaries) &&
                metrics.linked_lot_summaries.length > 0) ||
            (metrics.positions_count && metrics.positions_count > 0) ||
            (metrics.lots_count && metrics.lots_count > 0) ||
            (metrics.packages_count && metrics.packages_count > 0) ||
            (metrics.weight_kg && metrics.weight_kg > 0) ||
            (metrics.containers_count && metrics.containers_count > 0) ||
            (metrics.hours_spent && metrics.hours_spent > 0) ||
            metrics.custom_metric_value ||
            metrics.quantity_adjustment_note
    )
}

export function formatWorkloadSummaryText(metrics?: WorkloadMetrics | null): string {
    if (!hasWorkloadData(metrics) || !metrics) return ''
    const parts: string[] = []
    if (metrics.difficulty && DIFFICULTY_CONFIG[metrics.difficulty]) {
        const d = DIFFICULTY_CONFIG[metrics.difficulty]
        parts.push(`${d.badgeEmoji} ${d.label} (x${d.multiplier})`)
    }
    if (metrics.quantity_factor_label) {
        parts.push(`Hệ số KL: ${metrics.quantity_factor_label}`)
    }
    if (metrics.positions_count && metrics.positions_count > 0) {
        parts.push(`${metrics.positions_count} Vị trí`)
    }
    if (metrics.lots_count && metrics.lots_count > 0) {
        parts.push(`${metrics.lots_count} LOT`)
    }
    if (metrics.packages_count && metrics.packages_count > 0) {
        parts.push(
            `${metrics.packages_count.toLocaleString('vi-VN')} ${metrics.package_unit || 'Thùng'}`
        )
    }
    if (metrics.weight_kg && metrics.weight_kg > 0) {
        const tons =
            metrics.weight_kg >= 1000
                ? `${(metrics.weight_kg / 1000).toFixed(1)} Tấn`
                : `${metrics.weight_kg.toLocaleString('vi-VN')} Kg`
        parts.push(`~${tons}`)
    }
    if (metrics.containers_count && metrics.containers_count > 0) {
        parts.push(`${metrics.containers_count} Cont`)
    }
    if (metrics.hours_spent && metrics.hours_spent > 0) {
        parts.push(`${metrics.hours_spent} Giờ`)
    }
    if (metrics.quantity_adjustment_note) {
        parts.push(`Lý do hệ số: ${metrics.quantity_adjustment_note}`)
    }
    if (metrics.custom_metric_value) {
        parts.push(
            metrics.custom_metric_label
                ? `${metrics.custom_metric_label}: ${metrics.custom_metric_value}`
                : metrics.custom_metric_value
        )
    }
    if (
        Array.isArray(metrics.linked_export_orders) &&
        metrics.linked_export_orders.length > 0
    ) {
        parts.push(
            `Lệnh xuất: ${metrics.linked_export_orders.map(o => o.code).join(', ')}`
        )
    }
    if (
        Array.isArray(metrics.linked_inbound_orders) &&
        metrics.linked_inbound_orders.length > 0
    ) {
        parts.push(
            `Phiếu nhập KT: ${metrics.linked_inbound_orders.map(o => o.code).join(', ')}`
        )
    }
    if (
        Array.isArray(metrics.linked_outbound_orders) &&
        metrics.linked_outbound_orders.length > 0
    ) {
        parts.push(
            `Phiếu xuất KT: ${metrics.linked_outbound_orders.map(o => o.code).join(', ')}`
        )
    }
    if (
        Array.isArray(metrics.linked_lot_summaries) &&
        metrics.linked_lot_summaries.length > 0
    ) {
        parts.push(
            `LOT tạo: ${metrics.linked_lot_summaries
                .map(
                    l =>
                        `${l.lots_count} LOT (${formatVNDateSlash(l.created_date)}${
                            l.zone_name && l.zone_name !== 'Tất cả kho' ? ` - ${l.zone_name}` : ''
                        })`
                )
                .join(', ')}`
        )
    }
    return parts.join(' • ')
}

/**
 * Tự động phân tích dòng văn bản kế hoạch để gợi ý:
 * - Nội dung đã làm sạch số thứ tự đầu dòng (1., 2., -, *)
 * - Nhóm công việc (category)
 * - Khu vực (location_note)
 * - Nhân viên khớp tên (assignees)
 */
export function parseRawPlanLine(
    rawLine: string,
    availableMembers: { id?: string; name: string; type: 'member' | 'team' }[] = []
): {
    content: string
    category: string
    location_note: string
    priority: WorkPlanPriority
    assignees: WorkPlanAssignee[]
} {
    const cleaned = rawLine
        .trim()
        .replace(/^(?:công việc|mục|stt)?\s*\d+\s*[.):\-]\s*/i, '')
        .replace(/^[\-•*+]\s*/, '')
        .trim()

    const lower = cleaned.toLowerCase()

    let category = 'Vận hành kho'
    if (lower.includes('đào tạo') || lower.includes('hướng dẫn') || lower.includes('hỗ trợ')) {
        category = 'Đào tạo & Hỗ trợ'
    } else if (
        lower.includes('vệ sinh') ||
        lower.includes('quét') ||
        lower.includes('dọn dẹp') ||
        lower.includes('đập đá') ||
        lower.includes('bụi')
    ) {
        category = 'Vệ sinh & 5S'
    } else if (
        lower.includes('xuất cont') ||
        lower.includes('đai hàng') ||
        lower.includes('hạ hàng') ||
        lower.includes('lên cont') ||
        lower.includes('nhập cont')
    ) {
        category = 'Xuất / Nhập cont'
    } else if (lower.includes('sx') || lower.includes('sản xuất') || lower.includes('hàng khay')) {
        category = 'Hàng sản xuất / Khay'
    } else if (lower.includes('ghép hàng') || lower.includes('đưa vào kho') || lower.includes('sắp xếp')) {
        category = 'Sắp xếp & Ghép hàng'
    } else if (lower.includes('bảo trì') || lower.includes('sửa') || lower.includes('dàn lạnh')) {
        category = 'Bảo trì / Thiết bị'
    }

    let location_note = ''
    const khoMatch = cleaned.match(/(kho\s+[a-zA-Z0-9À-ỹ\s]{1,18}?)(?:[,().]|$)/i)
    if (khoMatch?.[1]) {
        location_note = khoMatch[1].trim()
    } else if (lower.includes('sảnh')) {
        location_note = 'Khu vực Sảnh'
    } else if (lower.includes('dàn lạnh')) {
        location_note = 'Khu dàn lạnh'
    }

    let priority: WorkPlanPriority = 'normal'
    if (lower.includes('gấp') || lower.includes('khẩn') || lower.includes('xuất cont')) {
        priority = 'important'
    }

    const matchedAssignees: WorkPlanAssignee[] = []
    const seenNames = new Set<string>()

    for (const member of availableMembers) {
        const memberName = member.name.trim()
        if (!memberName || memberName.length < 2) continue
        const escapedFull = memberName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const fullRegex = new RegExp(`(?:^|\\s|[,(])${escapedFull}(?:$|\\s|[.,)])`, 'i')
        if (fullRegex.test(cleaned)) {
            const key = memberName.toLowerCase()
            if (!seenNames.has(key)) {
                seenNames.add(key)
                matchedAssignees.push({
                    id: member.id,
                    name: memberName,
                    type: member.type,
                })
            }
        }
    }

    const hintRegex = /(?:hướng dẫn|hỗ trợ|cùng|phân công|giao cho)\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+)(?:\s+và\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ][a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+))?/g
    let match: RegExpExecArray | null
    while ((match = hintRegex.exec(cleaned)) !== null) {
        const candidates = [match[1], match[2]].filter(Boolean)
        for (const c of candidates) {
            const name = c.trim()
            const key = name.toLowerCase()
            if (
                !seenNames.has(key) &&
                !['kho', 'sảnh', 'hàng', 'cont', 'xe', 'ca'].includes(key)
            ) {
                seenNames.add(key)
                matchedAssignees.push({
                    name,
                    type: 'custom',
                })
            }
        }
    }

    return {
        content: cleaned,
        category,
        location_note,
        priority,
        assignees: matchedAssignees,
    }
}
