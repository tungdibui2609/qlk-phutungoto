import {
    chartRowsForScope,
    classifyFill,
    fillTreeRows,
    metricsOf,
    CRITICAL_FILL_PCT,
    HIGH_FILL_PCT,
    type FillLevel,
    type FillScope,
    type FillStats,
    type ZoneFillStat
} from './warehouseFillRate'
import type { CategoryPositionResult } from './categoryPositionStats'
import type { ChartSpec } from './chartImage'
import type { DashboardSheetSpec, DashboardWorkbookSpec } from './dashboardExcelWorkbook'

/**
 * Dựng nội dung file Excel cho từng view Dashboard.
 * Đặt ở lib (không import React/canvas) để chạy được trong vitest và dùng lại được.
 */

export type ExportSpec = {
    spec: Omit<DashboardWorkbookSpec, 'image'>
    chart: ChartSpec
}

/** Một sheet kèm biểu đồ riêng — ảnh PNG do phía client vẽ khi tải file. */
export type DashboardSheetPlan = DashboardSheetSpec & { chart?: ChartSpec | null }

const LEVEL_LABEL: Record<FillLevel, string> = {
    critical: 'Sắp đầy',
    high: 'Cao',
    normal: 'Bình thường',
    empty: 'Trống'
}

const LEVEL_HEX: Record<FillLevel, string> = {
    critical: '#f43f5e',
    high: '#f59e0b',
    normal: '#10b981',
    empty: '#d6d3d1'
}

export const SCOPE_LABEL: Record<FillScope, string> = {
    rack: 'Lô kệ',
    hall: 'Sảnh tạm kết',
    all: 'Tổng (kệ + sảnh)'
}

function exportedAt(when: Date = new Date()) {
    return when.toLocaleString('vi-VN', { hour12: false })
}

function round(n: number, decimals = 1) {
    const f = Math.pow(10, decimals)
    return Math.round((Number.isFinite(n) ? n : 0) * f) / f
}

const SCOPE_ORDER: FillScope[] = ['rack', 'hall', 'all']

/** Tên sheet không dấu — Excel giữ tên tiếng Việt có dấu nhưng dễ lỗi phông khi mở máy khác. */
const SCOPE_SHEET_NAME: Record<FillScope, string> = {
    rack: 'Lo ke',
    hall: 'Sanh',
    all: 'Tong (ke + sanh)'
}

/** Từ ngắn dùng trong tiêu đề/nhãn cột, gọn hơn nhãn tab. */
const SCOPE_UNIT: Record<FillScope, string> = {
    rack: 'Lô kệ',
    hall: 'Sảnh',
    all: 'vị trí'
}

const viNumber = (n: number) => n.toLocaleString('vi-VN')
const viPercent = (n: number) => `${round(n, 1).toLocaleString('vi-VN')}%`

/**
 * File Excel của dashboard tỉ lệ lấp đầy: 4 sheet
 *   "Tong quan"          — số của cả ba tab trên một màn
 *   "Lo ke"/"Sanh"/"Tong"— biểu đồ cấp khu vực + bảng TOÀN BỘ cây khu, thụt đầu dòng theo cấp
 * Xuất độc lập với cấp đang drill trên màn hình vì người dùng cần xem cả hệ thống trong Excel.
 */
export function fillRateWorkbookPlan(input: {
    systemName: string
    stats: FillStats
    when?: Date
}): DashboardSheetPlan[] {
    const { systemName, stats, when = new Date() } = input

    const levelNote = `Ngưỡng: Sắp đầy ≥ ${CRITICAL_FILL_PCT}% · Cao ≥ ${HIGH_FILL_PCT}% · Bình thường < ${HIGH_FILL_PCT}% · Trống = 0%.`

    const overview: DashboardSheetPlan = {
        sheetName: 'Tong quan',
        title: 'Tỉ lệ lấp đầy theo khu vực',
        meta: [
            { label: 'Phân hệ kho', value: systemName },
            { label: 'Xuất lúc', value: exportedAt(when) },
            { label: 'Bao gồm', value: '3 sheet riêng: Lô kệ / Sảnh / Tổng — mỗi sheet có biểu đồ và toàn bộ cây khu vực' }
        ],
        columns: [
            { header: 'Phạm vi', format: 'text', width: 22 },
            { header: 'Ô quy hoạch', format: 'int' },
            { header: 'Đang chứa', format: 'int' },
            { header: 'Còn trống', format: 'int' },
            { header: 'Tỉ lệ lấp đầy', format: 'percent' },
            { header: 'Trạng thái', format: 'text', width: 16, align: 'center' }
        ],
        rows: SCOPE_ORDER.map(scope => {
            const bucket = stats.totals[scope]
            return [
                SCOPE_LABEL[scope],
                bucket.positions,
                bucket.occupied,
                bucket.free,
                round(bucket.pct, 1),
                LEVEL_LABEL[classifyFill(bucket.pct)]
            ]
        }),
        notes: [
            'Lô kệ và Sảnh tách riêng vì sức chứa và quyết định nhập/xuất dựa trên Lô kệ; tab Tổng cộng cả hai để đối soát với trang Sơ đồ trạng thái kho.',
            ...(stats.unassignedPositions > 0
                ? [`${stats.unassignedOccupied}/${stats.unassignedPositions} ô Lô kệ chưa gán vào khu vực nào trong sơ đồ — vẫn nằm trong dòng "Lô kệ" của bảng này.`]
                : []),
            levelNote
        ],
        dataBarColumn: 5
    }

    const scopeSheets: DashboardSheetPlan[] = SCOPE_ORDER.map(scope => {
        const unit = SCOPE_UNIT[scope]
        const bucket = stats.totals[scope]
        const tree = fillTreeRows(stats, scope)
        const chartRows = chartRowsForScope(stats, scope)
        const metricsOfRow = (row: ZoneFillStat) => metricsOf(row, scope)

        return {
            sheetName: SCOPE_SHEET_NAME[scope],
            title: `Tỉ lệ lấp đầy ${SCOPE_LABEL[scope]}`,
            columns: [
                { header: 'Khu vực', format: 'text', width: 34 },
                { header: 'Đường dẫn trong sơ đồ', format: 'text', width: 46 },
                { header: `Ô ${unit} quy hoạch`, format: 'int' },
                { header: 'Đang chứa', format: 'int' },
                { header: 'Còn trống', format: 'int' },
                { header: 'Tỉ lệ lấp đầy', format: 'percent' },
                { header: 'Trạng thái', format: 'text', width: 16, align: 'center' }
            ],
            rows: tree.map(({ stat, path }) => {
                const m = metricsOfRow(stat)
                return [
                    stat.label,
                    path.join(' › '),
                    m.positions,
                    m.occupied,
                    m.free,
                    round(m.pct, 1),
                    LEVEL_LABEL[classifyFill(m.pct)]
                ]
            }),
            rowIndents: tree.map(({ depth }) => depth),
            totalRow: [
                `Toàn ${unit}`,
                '',
                bucket.positions,
                bucket.occupied,
                bucket.free,
                round(bucket.pct, 1),
                LEVEL_LABEL[classifyFill(bucket.pct)]
            ],
            notes: [
                'Dòng khu cha đã cộng dồn toàn bộ khu con bên dưới nên không cộng tiếp các dòng với nhau; cột "Còn trống" là ô đã quy hoạch chưa có LOT.',
                ...(scope !== 'hall' && stats.unassignedPositions > 0
                    ? [`${stats.unassignedOccupied}/${stats.unassignedPositions} ô ${unit} chưa gán khu vực — chỉ nằm ở dòng "Toàn ${unit}", không có dòng khu vực nào.`]
                    : []),
                levelNote
            ],
            dataBarColumn: 6,
            chart: {
                kind: 'hbar',
                title: `Tỉ lệ lấp đầy ${SCOPE_LABEL[scope]} — cấp khu vực`,
                labels: chartRows.map(row => row.label),
                series: [{
                    name: 'Tỉ lệ lấp đầy',
                    color: LEVEL_HEX.normal,
                    values: chartRows.map(row => round(metricsOfRow(row).pct, 1))
                }],
                barColors: chartRows.map(row => LEVEL_HEX[classifyFill(metricsOfRow(row).pct)]),
                percentAxis: true,
                unit: '%',
                valueLabels: chartRows.map(row => {
                    const m = metricsOfRow(row)
                    return `${viPercent(m.pct)} · ${viNumber(m.occupied)}/${viNumber(m.positions)} ô`
                })
            }
        }
    })

    return [overview, ...scopeSheets]
}

export function distributionKgExportSpec(input: {
    systemName: string
    filterLabel: string
    items: Array<{ name: string; code?: string | null; value: number; percentage: number }>
    totalWeight: number
}): ExportSpec {
    const { systemName, filterLabel, items, totalWeight } = input
    const sorted = [...items].sort((a, b) => b.value - a.value)
    return {
        spec: {
            chartTitle: 'Tỉ lệ phân bố hàng hóa tồn kho theo khối lượng (KG)',
            meta: [
                { label: 'Phân hệ kho', value: systemName },
                { label: 'Lọc danh mục', value: filterLabel },
                { label: 'Số sản phẩm', value: String(sorted.length) },
                { label: 'Tổng khối lượng', value: `${round(totalWeight, 1)} KG` },
                { label: 'Xuất lúc', value: exportedAt() }
            ],
            columns: [
                { header: 'STT', format: 'int', width: 7, align: 'center' },
                { header: 'Sản phẩm', format: 'text', width: 38 },
                { header: 'Mã', format: 'text', width: 18 },
                { header: 'Khối lượng (KG)', format: 'decimal' },
                { header: 'Tỉ lệ', format: 'percent' }
            ],
            rows: sorted.map((item, i) => [
                i + 1,
                item.name,
                item.code || '',
                round(item.value, 1),
                round(totalWeight > 0 ? (item.value / totalWeight) * 100 : 0, 1)
            ]),
            totalRow: ['', 'Tất cả sản phẩm', '', round(totalWeight, 1), 100],
            notes: [
                'Khối lượng đã quy đổi sang KG theo đơn vị gốc của sản phẩm; sản phẩm trùng mã nội bộ được gộp một dòng.',
                'Tỉ lệ tính trên tổng khối lượng của đúng tập đang lọc trên màn hình.'
            ],
            dataBarColumn: 5
        },
        chart: {
            kind: 'donut',
            title: 'Phân bố khối lượng (KG) theo sản phẩm',
            labels: sorted.map(i => i.name),
            series: [{ name: 'KG', color: '#0ea5e9', values: sorted.map(i => round(i.value, 1)) }],
            unit: 'KG',
            decimals: 1,
            legendLimit: 12
        }
    }
}

export function categoryPositionExportSpec(input: {
    systemName: string
    warehouseLabel: string
    result: CategoryPositionResult
    visibleOnly: boolean
}): ExportSpec {
    const { systemName, warehouseLabel, result, visibleOnly } = input
    const stats = [...result.stats].sort((a, b) => b.count - a.count)
    return {
        spec: {
            chartTitle: 'Số ô vị trí đang chứa hàng theo danh mục',
            meta: [
                { label: 'Phân hệ kho', value: systemName },
                { label: 'Phạm vi', value: warehouseLabel },
                { label: 'Ô đang chứa hàng', value: result.occupiedPositions.toLocaleString('vi-VN') },
                { label: 'Ô được quy hoạch', value: result.totalPositions.toLocaleString('vi-VN') },
                { label: 'Danh mục hiển thị', value: visibleOnly ? 'theo cấu hình chung với Sơ đồ trạng thái kho' : 'toàn bộ' },
                { label: 'Xuất lúc', value: exportedAt() }
            ],
            columns: [
                { header: 'Danh mục', format: 'text', width: 32 },
                { header: 'Số ô vị trí', format: 'int' },
                { header: 'Tỉ lệ hàng hoá', format: 'percent' },
                { header: 'Tỉ lệ công suất', format: 'percent' }
            ],
            rows: stats.map(s => [s.name, s.count, round(s.pctOfOccupied, 1), round(s.pctOfTotal, 1)]),
            notes: [
                'TỈ LỆ HÀNG HOÁ = số ô của danh mục / tổng ô ĐANG CHỨA HÀNG. TỈ LỆ CÔNG SUẤT = số ô của danh mục / tổng ô ĐƯỢC QUY HOẠCH.',
                'Một LOT có thể mang nhiều danh mục nên cột "Số ô vị trí" cộng dồn các danh mục có thể lớn hơn số ô đang chứa.',
                result.unclassifiedOccupied > 0
                    ? `${result.unclassifiedOccupied} ô chứa LOT chưa có dòng nào gắn danh mục — chỉ nằm ở mẫu số.`
                    : 'Toàn bộ ô đang chứa hàng đều đã gắn được danh mục.'
            ],
            dataBarColumn: 3
        },
        chart: {
            kind: 'donut',
            title: `Số ô vị trí theo danh mục — ${warehouseLabel}`,
            labels: stats.map(s => s.name),
            series: [{ name: 'Ô vị trí', color: '#6366f1', values: stats.map(s => s.count) }],
            unit: 'ô',
            decimals: 0,
            legendLimit: 12
        }
    }
}

function sheetFromExport(exportSpec: ExportSpec, sheetName: string): DashboardSheetPlan {
    const { spec, chart } = exportSpec
    return {
        sheetName,
        title: spec.chartTitle,
        meta: spec.meta,
        columns: spec.columns,
        rows: spec.rows,
        totalRow: spec.totalRow,
        notes: spec.notes,
        dataBarColumn: spec.dataBarColumn,
        chart
    }
}

/**
 * Dashboard "Tỉ lệ phân bố hàng hóa" gộp CẢ HAI tab vào một file:
 * bấm Xuất Excel một lần là có đủ sheet khối lượng (KG) và sheet danh mục (vị trí),
 * khỏi phải chuyển tab rồi xuất hai lần.
 */
export function distributionWorkbookPlan(
    kgInput: Parameters<typeof distributionKgExportSpec>[0],
    positionInput: Parameters<typeof categoryPositionExportSpec>[0]
): DashboardSheetPlan[] {
    return [
        sheetFromExport(distributionKgExportSpec(kgInput), 'Khoi luong KG'),
        sheetFromExport(categoryPositionExportSpec(positionInput), 'Danh muc vi tri')
    ]
}

export function containerExportSpec(input: {
    systemName: string
    filterLabel: string
    items: Array<{
        name: string
        sku?: string | null
        totalBoxes: number
        boxesPerContainer: number
        containers: number
        hasConfig: boolean
    }>
}): ExportSpec {
    const { systemName, filterLabel, items } = input
    const sorted = [...items].sort((a, b) => b.containers - a.containers || b.totalBoxes - a.totalBoxes)
    const totalBoxes = sorted.reduce((sum, i) => sum + (i.totalBoxes || 0), 0)
    const totalContainers = sorted.reduce((sum, i) => sum + (i.hasConfig ? i.containers : 0), 0)
    return {
        spec: {
            chartTitle: 'Ước tính số container tồn kho theo mặt hàng',
            meta: [
                { label: 'Phân hệ kho', value: systemName },
                { label: 'Lọc danh mục', value: filterLabel },
                { label: 'Số mặt hàng', value: String(sorted.length) },
                { label: 'Tổng thùng', value: round(totalBoxes, 1).toLocaleString('vi-VN') },
                { label: 'Tổng container (mặt hàng có định mức)', value: round(totalContainers, 2).toLocaleString('vi-VN') },
                { label: 'Xuất lúc', value: exportedAt() }
            ],
            columns: [
                { header: 'STT', format: 'int', width: 7, align: 'center' },
                { header: 'Sản phẩm', format: 'text', width: 38 },
                { header: 'Mã', format: 'text', width: 18 },
                { header: 'Thùng tồn', format: 'decimal' },
                { header: 'Định mức (thùng/container)', format: 'int' },
                { header: 'Container ước tính', format: 'decimal' },
                { header: 'Trạng thái', format: 'text', width: 20, align: 'center' }
            ],
            rows: sorted.map((item, i) => [
                i + 1,
                item.name,
                item.sku || '',
                round(item.totalBoxes, 1),
                item.boxesPerContainer || 0,
                item.hasConfig ? round(item.containers, 2) : null,
                item.hasConfig ? '' : 'Chưa khai báo định mức'
            ]),
            totalRow: ['', 'Tất cả mặt hàng', '', round(totalBoxes, 1), null, round(totalContainers, 2), ''],
            notes: [
                'Container = số thùng / định mức thùng mỗi container; dòng chưa khai định mức để trống cột container và không cộng vào tổng.',
                'Số thùng đã quy đổi từ đơn vị LOT về thùng theo đơn vị tính của sản phẩm.'
            ]
        },
        chart: {
            kind: 'hbar',
            title: 'Container ước tính theo mặt hàng (Top 15)',
            labels: sorted.slice(0, 15).map(i => i.name),
            series: [{ name: 'Container', color: '#0f766e', values: sorted.slice(0, 15).map(i => round(i.containers, 2)) }],
            unit: 'container',
            decimals: 2
        }
    }
}
