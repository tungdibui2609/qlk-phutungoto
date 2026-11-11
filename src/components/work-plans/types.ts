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
    packages_count?: number | null
    package_unit?: string | null
    kg_quantity?: number | null
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
    packages_count?: number | null
    package_unit?: string | null
    kg_quantity?: number | null
    unit: string
    estimated_weight_kg?: number | null
}

export interface LinkedLotDateSummary {
    id: string // `${created_date}_${zone_id || 'ALL'}`
    created_date: string // YYYY-MM-DD hoặc "YYYY-MM-DD..YYYY-MM-DD"
    date_label?: string // VD: "04/11/2026" hoặc "04/11 → 05/11/2026"
    zone_id?: string | null
    zone_name: string // 'Tất cả kho' | 'KHO 1' | 'KHO 2' ...
    lots_count: number
    assigned_positions_count: number
    total_quantity: number
    packages_count?: number | null
    package_unit?: string | null
    kg_quantity?: number | null
    unit: string
    estimated_weight_kg?: number | null
}

export interface LinkedApprovedAssignmentSummary {
    id: string // `${action_date}_${zone_id || 'ALL'}`
    action_date: string // YYYY-MM-DD hoặc "YYYY-MM-DD..YYYY-MM-DD"
    date_label?: string // VD: "04/11/2026" hoặc "04/11 → 05/11/2026"
    zone_id?: string | null
    zone_name: string // 'Tất cả kho' | 'KHO 1' | 'KHO 2' ...
    approved_count: number // Số vị trí xe nâng đã đưa lên kệ và được duyệt
    lots_count: number
    total_quantity: number
    packages_count?: number | null
    package_unit?: string | null
    kg_quantity?: number | null
    unit: string
    estimated_weight_kg?: number | null
}

export interface WorkloadMetrics {
    difficulty?: WorkloadDifficulty | null
    linked_export_orders?: LinkedExportOrderSummary[]
    linked_inbound_orders?: LinkedAccountingOrderSummary[]
    linked_outbound_orders?: LinkedAccountingOrderSummary[]
    linked_lot_summaries?: LinkedLotDateSummary[]
    linked_approved_assignments?: LinkedApprovedAssignmentSummary[]
    positions_count?: number | null
    lots_count?: number | null
    packages_count?: number | null
    package_unit?: string | null
    weight_kg?: number | null
    containers_count?: number | null
    hours_spent?: number | null
    // Công việc Thống kê / Ghi chép: số phiếu, biên bản, bảng số liệu đã hoàn thành trong ca
    // (không dùng để tính sản lượng tay chân hay giờ làm)
    documents_count?: number | null
    // Tổng số dòng dữ liệu đã nhập trong các phiếu (VD: 4 phiếu × ~10 dòng/phiếu)
    data_rows_count?: number | null
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
    // Phân loại Việc chính (100đ cơ bản) vs Việc phụ / Hỗ trợ (cộng thêm điểm lên 120-150đ)
    task_type?: WorkPlanTaskType | null
    // Đánh giá KPI & Ghi nhận vi phạm theo từng cá nhân
    assignee_evaluations?: WorkPlanAssigneeEvaluation[]
}

export type IncidentSeverity = 'minor' | 'moderate' | 'severe'

export interface WorkPlanAssigneeIncident {
    id: string
    type: string
    name: string
    group: 'safety_forklift' | 'quality_goods' | 'operations' | 'discipline_5s' | 'inventory_statistics' | 'other'
    severity: IncidentSeverity
    penalty_points: number
    note?: string | null
    created_at?: string
}

export interface WorkPlanAssigneeEvaluation {
    assignee_id?: string
    assignee_name: string
    share_percent: number // Tỷ lệ phân chia khối lượng (VD: 50, 70, 100)
    role?: 'main' | 'support' | 'equal' | string // Lái chính, Phụ việc, Chia đều
    task_type?: WorkPlanTaskType // Phân định cho người này: 'primary' (việc chính) hoặc 'secondary' (việc phụ/hỗ trợ)
    regular_hours?: number | null // Giờ ca chuẩn (mặc định 8h)
    overtime_hours?: number | null // Giờ tăng ca (OT, mặc định 0h)
    overtime_note?: string | null // Lý do / nội dung tăng ca (tùy chọn)
    bonus_points?: number // Điểm thưởng
    bonus_reason?: string | null
    incidents?: WorkPlanAssigneeIncident[] // Danh sách vi phạm / lỗi
    custom_productivity_score?: number | null // Cho phép quản lý chấm tay trực tiếp điểm năng suất (0-45đ)
    custom_quality_score?: number | null // Cho phép quản lý chấm tay trực tiếp điểm chất lượng (0-20đ) cho riêng từng người
    individual_note?: string | null // Nhận xét riêng
}

export interface IncidentTemplateItem {
    type: string
    name: string
    severity: IncidentSeverity
    penalty: number
}

export interface IncidentGroupTemplate {
    group: 'safety_forklift' | 'quality_goods' | 'operations' | 'discipline_5s' | 'inventory_statistics' | 'other'
    groupLabel: string
    icon: string
    items: IncidentTemplateItem[]
}

export const DEFAULT_INCIDENT_TEMPLATES: IncidentGroupTemplate[] = [
    {
        group: 'inventory_statistics',
        groupLabel: 'Thống kê, Kiểm đếm & Dữ liệu kho',
        icon: '📊',
        items: [
            { type: 'wrong_quantity_count', name: 'Ghi sai số lượng / Lệch kiện so với thực tế', severity: 'moderate', penalty: 15 },
            { type: 'wrong_rack_location', name: 'Ghi sai vị trí kệ / Nhầm vị trí lưu kho', severity: 'moderate', penalty: 15 },
            { type: 'wrong_lot_code', name: 'Ghi sai mã LOT / Nhầm LOT sản xuất', severity: 'severe', penalty: 25 },
            { type: 'wrong_box_label', name: 'Dán nhầm tem nhãn / Dán sai quy cách thùng', severity: 'moderate', penalty: 15 },
            { type: 'delayed_system_update', name: 'Chậm cập nhật phần mềm / Quên chốt xuất nhập', severity: 'minor', penalty: 10 },
            { type: 'handover_discrepancy', name: 'Sai lệch số liệu bàn giao ca / Thiếu biên bản', severity: 'minor', penalty: 10 },
        ],
    },
    {
        group: 'safety_forklift',
        groupLabel: 'Vận hành xe nâng & An toàn kho',
        icon: '🚜',
        items: [
            { type: 'rack_collision', name: 'Va quẹt chân kệ / Cột bảo vệ', severity: 'severe', penalty: 30 },
            { type: 'speeding', name: 'Chạy quá tốc độ / Cua gấp trong kho', severity: 'moderate', penalty: 15 },
            { type: 'no_horn', name: 'Không bấm còi góc khuất / Cửa kho lạnh', severity: 'minor', penalty: 5 },
            { type: 'unsafe_stacking', name: 'Nâng hạ không cân / Quá tải trọng', severity: 'severe', penalty: 25 },
        ],
    },
    {
        group: 'quality_goods',
        groupLabel: 'Hàng hóa, Bốc vác & Chất lượng',
        icon: '📦',
        items: [
            { type: 'fork_puncture', name: 'Nĩa xe đâm rách thùng / Bao bì', severity: 'moderate', penalty: 20 },
            { type: 'dropped_pallet', name: 'Làm đổ / Rơi kiện / Pallet hàng', severity: 'severe', penalty: 40 },
            { type: 'cold_chain_breach', name: 'Để hàng ngoài nhiệt độ lạnh quá giờ', severity: 'severe', penalty: 35 },
            { type: 'mixed_lots_pallet', name: 'Xếp lẫn lộn nhiều LOT trên một pallet không phân tách', severity: 'moderate', penalty: 15 },
            { type: 'improper_stacking', name: 'Bốc xếp sai quy cách / Nghiêng lệch kiện hàng', severity: 'minor', penalty: 10 },
            { type: 'torn_label', name: 'Làm mờ, rách tem / Mất mã barcode kiện hàng', severity: 'minor', penalty: 10 },
        ],
    },
    {
        group: 'operations',
        groupLabel: 'Vận hành & Tiến độ',
        icon: '📍',
        items: [
            { type: 'incomplete_task', name: 'Chưa xong việc trong ca (chủ quan)', severity: 'minor', penalty: 5 },
            { type: 'slow_task_progress', name: 'Chậm tiến độ / Kéo dài ca làm việc', severity: 'minor', penalty: 5 },
            { type: 'missed_scan', name: 'Quên quét tem / Bỏ sót kiện hàng khi xuất nhập', severity: 'minor', penalty: 10 },
            { type: 'loose_strapping', name: 'Đai hàng lỏng / Quấn màng co ẩu', severity: 'minor', penalty: 5 },
        ],
    },
    {
        group: 'discipline_5s',
        groupLabel: 'Kỷ luật & 5S vệ sinh',
        icon: '🧹',
        items: [
            { type: 'late_leave_early', name: 'Đi muộn / Về sớm / Rời ca không báo', severity: 'moderate', penalty: 15 },
            { type: 'no_cleanup_5s', name: 'Không dọn dẹp vệ sinh khu vực sau ca', severity: 'minor', penalty: 10 },
            { type: 'slow_progress', name: 'Làm việc riêng / Chậm trễ dây chuyền', severity: 'minor', penalty: 5 },
        ],
    },
]

export const INCIDENT_GROUPS = DEFAULT_INCIDENT_TEMPLATES

// ==========================================
// PHÂN LOẠI VIỆC CHÍNH VS VIỆC PHỤ / HỖ TRỢ (MỞ TRẦN 150 ĐIỂM)
// ==========================================
export type WorkPlanTaskType = 'primary' | 'secondary'

export interface TaskTypeConfig {
    label: string
    shortLabel: string
    badgeEmoji: string
    badgeClass: string
    description: string
    baseScore: number
}

// ==========================================
// BẢN CHẤT CÔNG VIỆC: LAO ĐỘNG TAY CHÂN VS THỐNG KÊ / GHI CHÉP
// Công việc thống kê không phát sinh sản lượng tay chân và không ghi giờ làm ở báo cáo;
// chỉ chấm độ chính xác và hoàn thành trong ngày.
// ==========================================
export type WorkPlanWorkNature = 'labor' | 'statistics'

export interface WorkNatureConfig {
    label: string
    shortLabel: string
    badgeEmoji: string
    badgeClass: string
    description: string
}

export const WORK_NATURE_CONFIG: Record<WorkPlanWorkNature, WorkNatureConfig> = {
    labor: {
        label: 'Lao động tay chân',
        shortLabel: 'Lao động',
        badgeEmoji: '🏋️',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        description: 'Bốc xếp, hạ/xếp hàng, vệ sinh... có sản lượng và giờ làm thực tế',
    },
    statistics: {
        label: 'Thống kê / Ghi chép',
        shortLabel: 'Thống kê',
        badgeEmoji: '📊',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
        description:
            'Ghi chép, thống kê số liệu, chứng từ... không có tay chân; chấm độ chính xác và hoàn thành trong ngày, không ghi sản lượng & giờ làm',
    },
}

export const TASK_TYPE_CONFIG: Record<WorkPlanTaskType, TaskTypeConfig> = {
    primary: {
        label: 'Việc chính trong ca',
        shortLabel: 'Việc chính',
        badgeEmoji: '⭐',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        description: 'Nhiệm vụ cốt lõi trong ca (Hoàn thành đạt 40đ Năng suất chuẩn, tổng ca 100đ)',
        baseScore: 40,
    },
    secondary: {
        label: 'Việc phụ / Tăng cường / Làm thêm',
        shortLabel: 'Việc phụ',
        badgeEmoji: '➕',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        description: 'Làm thêm / Hỗ trợ ca khác (Mở trần, cộng thêm điểm thưởng vượt mức lên 120đ - 150đ+)',
        baseScore: 20,
    },
}

// ==========================================
// THANG ĐIỂM KPI 100% CHUẨN (BALANCED 4-PILLAR MODEL)
// ==========================================
export const KPI_PILLARS = {
    productivity: { label: 'Năng suất', max: 45, weight: 0.45 },
    quality: { label: 'Chất lượng', max: 20, weight: 0.2 },
    safety: { label: 'An toàn & Hàng hóa', max: 20, weight: 0.2 },
    discipline: { label: 'Kỷ luật & 5S', max: 15, weight: 0.15 },
} as const

export interface TaskStandardKpiScore {
    taskType: WorkPlanTaskType
    totalKpi: number // Với việc chính: thang 0 - 100đ (mở trần 105đ với việc rất nặng); Với việc phụ: cộng dồn vào KPI ngày (+10đ đến +50đ)
    bonusOverTargetPoints: number // Điểm việc phụ / vượt mức cộng dồn
    productivityScore: number // Chuẩn 40đ (Nhẹ 40đ, Vừa 42đ, Nặng 45đ, Rất nặng 50đ)
    qualityScore: number // Tối đa 20đ
    safetyScore: number // Gốc 20đ (trừ lỗi an toàn)
    disciplineScore: number // Gốc 15đ (trừ lỗi 5S + cộng thưởng)
    grade: 'A+' | 'A' | 'B' | 'C'
    gradeLabel: string
    hasSevereIncident: boolean
}

/**
 * Xác định điểm Năng Suất cơ sở theo Mức Độ Khối Lượng công việc
 * Chuẩn cơ sở 40đ cho việc nhẹ (tổng ca đạt 95đ - Hạng A)
 * Nhẹ: 40đ • Vừa: 42đ • Nặng: 45đ • Rất nặng: 50đ
 */
export function getProductivityScoreByDifficulty(
    difficulty?: WorkloadDifficulty | null,
    diffMultiplier?: number
): number {
    if (difficulty === 'very_heavy' || (diffMultiplier && diffMultiplier >= 2.0)) return 50
    if (difficulty === 'heavy' || (diffMultiplier && diffMultiplier >= 1.5)) return 45
    if (difficulty === 'medium' || (diffMultiplier && diffMultiplier >= 1.2)) return 42
    return 40 // light (x1.0) hoặc mặc định chuẩn cơ sở
}

/**
 * Tính điểm KPI chuẩn trên thang 100% cho từng nhân sự
 * Thang 4 Trụ Cột: Năng suất 40-50đ • Chất lượng 20đ • An toàn 20đ • Kỷ luật 15đ
 * Năng suất phân theo khối lượng: Nhẹ 40đ • Vừa 42đ • Nặng 45đ • Rất nặng 50đ
 * Hỗ trợ phân định Việc chính (chuẩn 100đ) vs Việc phụ (cộng thêm điểm lên 120 - 150đ)
 */
export function calculateAssigneeTaskStandardKpi(params: {
    userPositions: number
    diffMultiplier?: number
    difficulty?: WorkloadDifficulty | null
    progressPercent?: number
    ratingStars?: number | null
    customProductivityScore?: number | null
    customQualityScore?: number | null
    incidents?: WorkPlanAssigneeIncident[]
    bonusPoints?: number
    taskType?: WorkPlanTaskType
    taskStatus?: WorkPlanItemStatus
    sharePercent?: number
}): TaskStandardKpiScore {
    const {
        userPositions,
        diffMultiplier = 1.0,
        difficulty = null,
        progressPercent = 100,
        ratingStars = null,
        customProductivityScore = null,
        customQualityScore = null,
        incidents = [],
        bonusPoints = 0,
        taskType = 'primary',
        taskStatus = 'completed',
        sharePercent = 100,
    } = params

    // Nếu công việc bị hoãn / hủy bỏ hoàn toàn trong ca thì không tính điểm năng suất
    const isCancelled = taskStatus === 'cancelled'

    // 1. Trụ Cột Năng Suất (Chuẩn 40đ: Nhẹ 40đ, Vừa 42đ, Nặng 45đ, Rất nặng 50đ)
    // Nếu Quản lý tự chấm tay (customProductivityScore) thì ưu tiên tuyệt đối điểm chấm tay của quản lý
    let prodScore = 0
    const baseDifficultyScore = getProductivityScoreByDifficulty(difficulty, diffMultiplier)

    if (isCancelled) {
        prodScore = 0
    } else if (customProductivityScore !== null && customProductivityScore !== undefined) {
        prodScore = Math.max(0, Math.min(50, customProductivityScore))
    } else if (taskType === 'secondary') {
        // VỚI VIỆC PHỤ / HỖ TRỢ:
        // Điểm hỗ trợ được tự động tính theo % đóng góp thực tế vào công việc
        // Cơ sở điểm dựa theo độ nặng (Nhẹ 40đ, Vừa 42đ, Nặng 45đ, Rất nặng 50đ)
        const share = typeof sharePercent === 'number' ? Math.max(0, Math.min(100, sharePercent)) : 100
        prodScore = Math.round(((baseDifficultyScore * share) / 100) * 10) / 10
    } else {
        // VỚI VIỆC CHÍNH:
        // Điểm Năng suất đạt trực tiếp theo độ nặng của công việc
        prodScore = baseDifficultyScore
    }

    // 2. Trụ Cột Chất Lượng (Tối đa 20đ)
    // Nếu Quản lý tự chấm tay riêng (customQualityScore) thì ưu tiên điểm chấm tay của nhân sự đó
    let qualScore = 20
    if (isCancelled) {
        qualScore = 0
    } else if (customQualityScore !== null && customQualityScore !== undefined) {
        qualScore = Math.max(0, Math.min(20, customQualityScore))
    } else if (ratingStars !== null && ratingStars !== undefined) {
        if (ratingStars >= 5) qualScore = 20
        else if (ratingStars >= 4) qualScore = 16
        else if (ratingStars >= 3) qualScore = 12
        else if (ratingStars >= 2) qualScore = 8
        else qualScore = 4
    } else {
        // Mặc định đạt yêu cầu chuẩn (20đ) khi không chấm sao thủ công
        qualScore = 20
    }

    // 3. Trụ Cột An Toàn Lao Động & Hàng Hóa (Gốc 20đ, trừ lỗi)
    let safetyDeduction = 0
    let hasSevere = false
    incidents.forEach(inc => {
        if (inc.group === 'safety_forklift' || inc.group === 'quality_goods') {
            safetyDeduction += inc.penalty_points || 0
        }
        if (inc.severity === 'severe') {
            hasSevere = true
        }
    })
    const safetyScore = isCancelled ? 0 : Math.max(0, 20 - safetyDeduction)

    // 4. Trụ Cột Kỷ Luật & 5S (Gốc 15đ, trừ lỗi + cộng thưởng)
    let disciplineDeduction = 0
    incidents.forEach(inc => {
        if (
            inc.group === 'operations' ||
            inc.group === 'discipline_5s' ||
            inc.group === 'inventory_statistics' ||
            inc.group === 'other'
        ) {
            disciplineDeduction += inc.penalty_points || 0
        }
    })
    const discScore = isCancelled ? 0 : Math.min(20, Math.max(0, 15 - disciplineDeduction + bonusPoints))

    // Xử lý theo Việc chính hay Việc phụ:
    let bonusOverTargetPoints = 0
    let totalKpi = 0

    if (taskType === 'secondary') {
        // Việc phụ / Làm thêm / Hỗ trợ: Là điểm năng suất cộng thêm mở trần (Bonus points)
        const taskPenalty = safetyDeduction + disciplineDeduction
        bonusOverTargetPoints = isCancelled
            ? 0
            : Math.max(0, Math.round((prodScore - taskPenalty + bonusPoints) * 10) / 10)
        totalKpi = bonusOverTargetPoints
    } else {
        // Việc chính trong ca: Chuẩn 100 điểm
        const rawTotal = prodScore + qualScore + safetyScore + discScore
        totalKpi = isCancelled ? 0 : Math.min(110, Math.round(rawTotal * 10) / 10)
    }

    // Xếp loại Danh hiệu Bé Khỏe Bé Ngoan & Khóa danh hiệu nếu có lỗi nghiêm trọng
    let grade: 'A+' | 'A' | 'B' | 'C' = 'B'
    let gradeLabel = '🌱 Cần Cố Gắng (B)'
    if (isCancelled) {
        grade = 'C'
        gradeLabel = 'Hoãn / Hủy'
    } else if (hasSevere || safetyScore <= 5 || (taskType === 'primary' && totalKpi < 70)) {
        grade = 'C'
        gradeLabel = hasSevere ? '⚠️ Chưa Ngoan (Sự cố)' : '⚠️ Chưa Ngoan (C)'
    } else if (totalKpi >= 100) {
        grade = 'A+'
        gradeLabel = '🌸 Bé Khỏe Bé Ngoan (A+)'
    } else if (totalKpi >= 85) {
        grade = 'A'
        gradeLabel = '⭐ Bé Ngoan (A)'
    } else if (totalKpi >= 70) {
        grade = 'B'
        gradeLabel = '🌱 Cần Cố Gắng (B)'
    } else {
        grade = 'C'
        gradeLabel = '⚠️ Chưa Ngoan (C)'
    }

    return {
        taskType,
        totalKpi,
        bonusOverTargetPoints,
        productivityScore: prodScore,
        qualityScore: qualScore,
        safetyScore,
        disciplineScore: discScore,
        grade,
        gradeLabel,
        hasSevereIncident: hasSevere,
    }
}

// ==========================================
// TÍNH TOÁN GIỜ LÀM VIỆC, TĂNG CA (OT) & TỐC ĐỘ NĂNG SUẤT THEO GIỜ
// ==========================================
export interface WorkSpeedResult {
    totalHours: number
    regularHours: number
    overtimeHours: number
    positionsPerHour: number | null
    weightKgPerHour: number | null
    weightTonsPerHour: number | null
    packagesPerHour: number | null
    speedSummaryText: string
}

/**
 * Tính toán tốc độ làm việc thực tế theo giờ
 * (Vị trí/giờ, Tấn/giờ, Thùng/giờ) dựa trên tổng giờ làm việc (Giờ chuẩn 8h + Giờ OT)
 */
export function calculateWorkSpeed(params: {
    positions?: number | null
    weightKg?: number | null
    packages?: number | null
    regularHours?: number | null
    overtimeHours?: number | null
}): WorkSpeedResult {
    const reg =
        typeof params.regularHours === 'number' && !isNaN(params.regularHours)
            ? Math.max(0, params.regularHours)
            : 8
    const ot =
        typeof params.overtimeHours === 'number' && !isNaN(params.overtimeHours)
            ? Math.max(0, params.overtimeHours)
            : 0
    const totalHours = Math.round((reg + ot) * 10) / 10

    const pos =
        typeof params.positions === 'number' && params.positions > 0 ? params.positions : 0
    const kg =
        typeof params.weightKg === 'number' && params.weightKg > 0 ? params.weightKg : 0
    const pkg =
        typeof params.packages === 'number' && params.packages > 0 ? params.packages : 0

    let positionsPerHour: number | null = null
    let weightKgPerHour: number | null = null
    let weightTonsPerHour: number | null = null
    let packagesPerHour: number | null = null

    if (totalHours > 0) {
        if (pos > 0) {
            positionsPerHour = Math.round((pos / totalHours) * 10) / 10
        }
        if (kg > 0) {
            weightKgPerHour = Math.round(kg / totalHours)
            weightTonsPerHour = Math.round((kg / 1000 / totalHours) * 10) / 10
        }
        if (pkg > 0) {
            packagesPerHour = Math.round((pkg / totalHours) * 10) / 10
        }
    }

    const parts: string[] = []
    if (positionsPerHour !== null && positionsPerHour > 0) {
        parts.push(`${positionsPerHour} vt/h`)
    }
    if (weightTonsPerHour !== null && weightTonsPerHour > 0) {
        parts.push(`${weightTonsPerHour} tấn/h`)
    } else if (weightKgPerHour !== null && weightKgPerHour > 0) {
        parts.push(`${weightKgPerHour.toLocaleString('vi-VN')} kg/h`)
    }
    if (parts.length === 0 && packagesPerHour !== null && packagesPerHour > 0) {
        parts.push(`${packagesPerHour} thùng/h`)
    }

    const speedSummaryText = parts.length > 0 ? parts.join(' • ') : ''

    return {
        totalHours,
        regularHours: reg,
        overtimeHours: ot,
        positionsPerHour,
        weightKgPerHour,
        weightTonsPerHour,
        packagesPerHour,
        speedSummaryText,
    }
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
    task_type?: WorkPlanTaskType // Phân định cho người này: 'primary' (việc chính) hoặc 'secondary' (việc phụ/hỗ trợ)
    regular_hours?: number | null // Giờ ca chuẩn (mặc định 8h)
    overtime_hours?: number | null // Giờ tăng ca (OT, mặc định 0h)
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
    description?: string | null
    category: string | null
    priority: WorkPlanPriority
    work_nature?: WorkPlanWorkNature | null // 'labor' (mặc định) | 'statistics' (không ghi sản lượng & giờ làm)
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
    assignee_evaluations?: WorkPlanAssigneeEvaluation[]
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

export interface WarehouseBadgeInfo {
    label: string
    icon: string
    badgeClass: string
}

export function getWarehouseBadge(codeOrName?: string | null): WarehouseBadgeInfo {
    if (!codeOrName || codeOrName === 'ALL' || codeOrName === 'all') {
        return {
            label: 'Dùng chung',
            icon: '🌐',
            badgeClass: 'bg-stone-100 text-stone-700 border-stone-200',
        }
    }
    const lower = codeOrName.toLowerCase()
    if (lower.includes('đông') || lower.includes('cold') || lower.includes('lạnh')) {
        return {
            label: codeOrName,
            icon: '❄️',
            badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        }
    }
    if (lower.includes('bao bì') || lower.includes('vật tư') || lower.includes('pack')) {
        return {
            label: codeOrName,
            icon: '📦',
            badgeClass: 'bg-amber-50 text-amber-900 border-amber-200',
        }
    }
    if (lower.includes('dụng cụ') || lower.includes('ccdc') || lower.includes('tool')) {
        return {
            label: codeOrName,
            icon: '🛠️',
            badgeClass: 'bg-violet-50 text-violet-800 border-violet-200',
        }
    }
    if (lower.includes('hóa chất') || lower.includes('chem')) {
        return {
            label: codeOrName,
            icon: '🧪',
            badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
        }
    }
    if (lower.includes('nguyên') || lower.includes('liệu') || lower.includes('raw')) {
        return {
            label: codeOrName,
            icon: '🌾',
            badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        }
    }
    return {
        label: codeOrName,
        icon: '🏢',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
    }
}

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
        baseScore: number
        badgeEmoji: string
        bgClass: string
        textClass: string
        borderClass: string
        description: string
    }
> = {
    light: {
        label: 'Nhẹ',
        shortLabel: 'Nhẹ (40đ)',
        multiplier: 1.0,
        baseScore: 40,
        badgeEmoji: '🌱',
        bgClass: 'bg-sky-50',
        textClass: 'text-sky-700',
        borderClass: 'border-sky-200',
        description: 'Công việc nhẹ nhàng (< 1 Cont / < 45 vị trí / < 27 tấn) • Năng suất chuẩn: 40đ (Tổng ca 95đ)',
    },
    medium: {
        label: 'Vừa',
        shortLabel: 'Vừa (42đ)',
        multiplier: 1.2,
        baseScore: 42,
        badgeEmoji: '⚡',
        bgClass: 'bg-indigo-50',
        textClass: 'text-indigo-700',
        borderClass: 'border-indigo-200',
        description: 'Khối lượng trung bình (1 – 3 Cont / 45 – 179 vị trí / 27 – 107 tấn) • Năng suất: 42đ',
    },
    heavy: {
        label: 'Nặng',
        shortLabel: 'Nặng (45đ)',
        multiplier: 1.5,
        baseScore: 45,
        badgeEmoji: '💪',
        bgClass: 'bg-orange-50',
        textClass: 'text-orange-700',
        borderClass: 'border-orange-200',
        description: 'Công việc nặng (4 – 7 Cont / 180 – 359 vị trí / 108 – 215 tấn) • Năng suất: 45đ (Tổng ca 100đ)',
    },
    very_heavy: {
        label: 'Rất nặng',
        shortLabel: 'Rất nặng (50đ)',
        multiplier: 2.0,
        baseScore: 50,
        badgeEmoji: '🔥',
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-700',
        borderClass: 'border-rose-200',
        description: 'Khối lượng rất lớn (≥ 8 Cont / ≥ 360 vị trí / ≥ 216 tấn) • Năng suất: 50đ (Mở trần 105đ)',
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
    if (dateStr.includes('..')) {
        const [d1, d2] = dateStr.split('..')
        return `${formatVNDateSlash(d1)} → ${formatVNDateSlash(d2)}`
    }
    if (dateStr.includes(',')) {
        return dateStr
            .split(',')
            .map(d => formatVNDateSlash(d.trim()))
            .join(', ')
    }
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
 * Kiểm tra xem một chuỗi đơn vị có phải là Kg hay không (ví dụ "Kg", "kgs", "kilogram"...)
 */
export function isKgUnit(unitStr: string | null | undefined): boolean {
    if (!unitStr) return false
    const norm = unitStr.normalize('NFC').toLowerCase().trim()
    return (
        norm === 'kg' ||
        norm === 'kgs' ||
        norm === 'kilogram' ||
        norm === 'ki-lo-gam' ||
        norm === 'kilo' ||
        norm === 'kg.'
    )
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
 * Tự động gợi ý Mức độ Nặng / Nhẹ dựa trên:
 * - 1 Cont tương đương ~ 45 vị trí ~ 27 tấn (27.000 kg)
 * - Rất nặng: 1 trong 3 thông số đạt (Cont >= 8, Vị trí/LOT >= 360, Khối lượng >= 216 tấn = 216.000 kg)
 * - Nặng: Cont >= 4 (hoặc Vị trí/LOT >= 180, Khối lượng >= 108 tấn = 108.000 kg)
 * - Vừa: Cont >= 1 (hoặc Vị trí/LOT >= 45, Khối lượng >= 27 tấn = 27.000 kg)
 * - Nhẹ: Dưới 1 Cont (< 45 vị trí, < 27 tấn)
 */
export function suggestWorkloadDifficulty(
    metrics: Partial<WorkloadMetrics>
): WorkloadDifficulty {
    const pos = Number(metrics.positions_count) || 0
    const lots = Number(metrics.lots_count) || 0
    const kg = Number(metrics.weight_kg) || 0
    const conts = Number(metrics.containers_count) || 0

    // Rất nặng: chỉ cần 1 trong 3 thông số (Cont, Vị trí/LOT, Khối lượng) đạt mốc
    if (conts >= 8 || pos >= 360 || lots >= 360 || kg >= 216000) {
        return 'very_heavy'
    }

    // Nặng: Cont >= 4, hoặc Vị trí/LOT >= 180, hoặc Khối lượng >= 108 tấn
    if (conts >= 4 || pos >= 180 || lots >= 180 || kg >= 108000) {
        return 'heavy'
    }

    // Vừa: Cont >= 1, hoặc Vị trí/LOT >= 45, hoặc Khối lượng >= 27 tấn
    if (conts >= 1 || pos >= 45 || lots >= 45 || kg >= 27000) {
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
    const approvedAssignments = Array.isArray(metrics.linked_approved_assignments)
        ? metrics.linked_approved_assignments
        : []

    const totalLinkedCount =
        exportList.length +
        inboundList.length +
        outboundList.length +
        lotSummaries.length +
        approvedAssignments.length

    if (totalLinkedCount === 0) {
        return metrics
    }

    const sumPositions =
        exportList.reduce((s, o) => s + (o.positions_count || 0), 0) +
        lotSummaries.reduce((s, l) => s + (l.assigned_positions_count || 0), 0) +
        approvedAssignments.reduce((s, a) => s + (a.approved_count || 0), 0)

    // Phiếu nhập/xuất kế toán không có thông tin LOT/vị trí thật và không quy đổi tự động —
    // để trống cho người dùng tự nhập, tránh lấy số dòng hàng làm số LOT.
    const sumLots =
        exportList.reduce((s, o) => s + (o.lots_count || 0), 0) +
        lotSummaries.reduce((s, l) => s + (l.lots_count || 0), 0) +
        approvedAssignments.reduce((s, a) => s + (a.lots_count || 0), 0)

    const getPackagesFromSummary = (item: {
        packages_count?: number | null
        total_quantity?: number
        unit?: string
    }): number => {
        if (typeof item.packages_count === 'number') {
            return item.packages_count
        }
        if (item.unit && isKgUnit(item.unit)) {
            return 0
        }
        return item.total_quantity || 0
    }

    const sumPackages =
        exportList.reduce((s, o) => s + getPackagesFromSummary(o), 0) +
        inboundList.reduce((s, o) => s + getPackagesFromSummary(o), 0) +
        outboundList.reduce((s, o) => s + getPackagesFromSummary(o), 0) +
        lotSummaries.reduce((s, l) => s + getPackagesFromSummary(l), 0) +
        approvedAssignments.reduce((s, a) => s + getPackagesFromSummary(a), 0)

    const sumWeight =
        exportList.reduce((s, o) => s + (o.estimated_weight_kg || 0), 0) +
        inboundList.reduce((s, o) => s + (o.estimated_weight_kg || 0), 0) +
        outboundList.reduce((s, o) => s + (o.estimated_weight_kg || 0), 0) +
        lotSummaries.reduce((s, l) => s + (l.estimated_weight_kg || 0), 0) +
        approvedAssignments.reduce((s, a) => s + (a.estimated_weight_kg || 0), 0)

    const findPackageUnit = (item?: {
        package_unit?: string | null
        unit?: string
    }) => {
        if (!item) return null
        const u = item.package_unit || item.unit
        return u && !isKgUnit(u) ? u : null
    }

    const primaryUnit =
        findPackageUnit(exportList[0]) ||
        findPackageUnit(inboundList[0]) ||
        findPackageUnit(outboundList[0]) ||
        findPackageUnit(lotSummaries[0]) ||
        findPackageUnit(approvedAssignments[0]) ||
        metrics.package_unit ||
        (sumPackages === 0 ? 'Kg' : 'Thùng')

    const factor =
        metrics.quantity_factor && metrics.quantity_factor > 0
            ? metrics.quantity_factor
            : 1

    const basePos = sumPositions > 0 ? sumPositions : metrics.base_positions_count ?? metrics.positions_count ?? null
    const baseLots = sumLots > 0 ? sumLots : metrics.base_lots_count ?? metrics.lots_count ?? null
    const basePkgs =
        sumPackages > 0
            ? Math.round(sumPackages * 100) / 100
            : totalLinkedCount > 0
                ? 0
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
        (Array.isArray(metrics.linked_approved_assignments) &&
            metrics.linked_approved_assignments.length > 0) ||
        (metrics.positions_count && metrics.positions_count > 0) ||
        (metrics.lots_count && metrics.lots_count > 0) ||
        (metrics.packages_count && metrics.packages_count > 0) ||
        (metrics.weight_kg && metrics.weight_kg > 0) ||
        (metrics.containers_count && metrics.containers_count > 0) ||
        (metrics.hours_spent && metrics.hours_spent > 0) ||
        (metrics.documents_count && metrics.documents_count > 0) ||
        (metrics.data_rows_count && metrics.data_rows_count > 0) ||
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
    if (metrics.documents_count && metrics.documents_count > 0) {
        parts.push(`📄 ${metrics.documents_count.toLocaleString('vi-VN')} phiếu đã tạo`)
    }
    if (metrics.data_rows_count && metrics.data_rows_count > 0) {
        parts.push(`📋 ${metrics.data_rows_count.toLocaleString('vi-VN')} dòng dữ liệu`)
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
                        `${l.lots_count} LOT (${l.date_label || formatVNDateSlash(l.created_date)}${l.zone_name && l.zone_name !== 'Tất cả kho' ? ` - ${l.zone_name}` : ''
                        })`
                )
                .join(', ')}`
        )
    }
    if (
        Array.isArray(metrics.linked_approved_assignments) &&
        metrics.linked_approved_assignments.length > 0
    ) {
        parts.push(
            `Đưa lên kệ: ${metrics.linked_approved_assignments
                .map(
                    a =>
                        `${a.approved_count} vị trí (${a.date_label || formatVNDateSlash(a.action_date)}${a.zone_name && a.zone_name !== 'Tất cả kho' ? ` - ${a.zone_name}` : ''
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
