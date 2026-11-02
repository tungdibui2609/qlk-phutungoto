import {
    classifyFill,
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
import type { DashboardWorkbookSpec } from './dashboardExcelWorkbook'

/**
 * Dựng nội dung file Excel cho từng view Dashboard.
 * Đặt ở lib (không import React/canvas) để chạy được trong vitest và dùng lại được.
 */

export type ExportSpec = {
    spec: Omit<DashboardWorkbookSpec, 'image'>
    chart: ChartSpec
}

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

export function fillRateExportSpec(input: {
    systemName: string
    scope: FillScope
    pathLabels: string[]
    stats: FillStats
    rows: ZoneFillStat[]
    currentZoneId?: string | null
}): ExportSpec {
    const { systemName, scope, pathLabels, stats, rows, currentZoneId = null } = input
    const bucket = stats.totals[scope]
    const unit = scope === 'hall' ? 'Sảnh' : scope === 'rack' ? 'Lô kệ' : 'vị trí'

    const tableRows = rows.map(row => {
        const m = metricsOf(row, scope)
        return [
            row.label,
            m.positions,
            m.occupied,
            m.free,
            round(m.pct, 1),
            LEVEL_LABEL[classifyFill(m.pct)]
        ]
    })

    const notes: string[] = [
        `Ngưỡng: Sắp đầy ≥ ${CRITICAL_FILL_PCT}% · Cao ≥ ${HIGH_FILL_PCT}% · Bình thường < ${HIGH_FILL_PCT}% · Trống = 0%.`,
        'Số của khu cha đã cộng dồn toàn bộ khu con, nên không cộng tiếp các dòng với nhau.'
    ]
    if (scope !== 'hall' && stats.unassignedPositions > 0) {
        notes.push(
            `${stats.unassignedOccupied}/${stats.unassignedPositions} ô ${unit} chưa gán vào khu vực nào trong sơ đồ — vẫn nằm trong dòng "Toàn ${unit.toLowerCase()}".`
        )
    }

    return {
        spec: {
            chartTitle: `Tỉ lệ lấp đầy ${unit} theo khu vực`,
            meta: [
                { label: 'Phân hệ kho', value: systemName },
                { label: 'Tab', value: SCOPE_LABEL[scope] },
                { label: 'Cấp đang xem', value: pathLabels.length ? pathLabels.join(' › ') : 'Toàn kho' },
                { label: 'Tổng ô đã quy hoạch', value: bucket.positions.toLocaleString('vi-VN') },
                { label: 'Ô đang chứa hàng', value: bucket.occupied.toLocaleString('vi-VN') },
                { label: 'Tỉ lệ lấp đầy', value: `${round(bucket.pct, 1)}% (${LEVEL_LABEL[classifyFill(bucket.pct)]})` },
                { label: 'Xuất lúc', value: exportedAt() }
            ],
            columns: [
                { header: 'Khu vực', format: 'text', width: 32 },
                { header: `Ô ${unit} quy hoạch`, format: 'int' },
                { header: 'Đang chứa', format: 'int' },
                { header: 'Còn trống', format: 'int' },
                { header: 'Tỉ lệ lấp đầy', format: 'percent' },
                { header: 'Trạng thái', format: 'text', width: 16, align: 'center' }
            ],
            rows: tableRows,
            totalRow: [
                `Toàn ${unit.toLowerCase()}`,
                bucket.positions,
                bucket.occupied,
                bucket.free,
                round(bucket.pct, 1),
                LEVEL_LABEL[classifyFill(bucket.pct)]
            ],
            notes,
            dataBarColumn: 5
        },
        chart: {
            kind: 'hbar',
            title: `Tỉ lệ lấp đầy ${unit} — ${SCOPE_LABEL[scope]} (${pathLabels.length ? pathLabels[pathLabels.length - 1] : 'Toàn kho'})`,
            labels: rows.map(r => r.label),
            series: [{ name: 'Tỉ lệ lấp đầy', color: LEVEL_HEX.normal, values: rows.map(r => round(metricsOf(r, scope).pct, 1)) }],
            barColors: rows.map(r => LEVEL_HEX[classifyFill(metricsOf(r, scope).pct)]),
            percentAxis: true,
            unit: '%'
        }
    }
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
            kind: 'hbar',
            title: `Số ô vị trí theo danh mục — ${warehouseLabel}`,
            labels: stats.map(s => s.name),
            series: [{ name: 'Ô vị trí', color: '#6366f1', values: stats.map(s => s.count) }],
            unit: 'ô',
            decimals: 0
        }
    }
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
