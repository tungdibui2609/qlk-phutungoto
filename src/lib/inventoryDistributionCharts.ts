import { renderChartPng } from '@/lib/chartImage'
import { buildCategoryPositionStats } from '@/lib/categoryPositionStats'
import { categoryPositionExportSpec, distributionKgExportSpec } from '@/lib/dashboardExcelSpecs'
import type { DashboardChartImage } from '@/lib/dashboardExcelWorkbook'
import { readUiConfig } from '@/lib/systemUiSettings'
import {
    aggregateKgByProduct,
    fetchCategoryPositionRaw,
    fetchDistributionCategories,
    fetchDistributionLots,
    type KgConversion
} from './inventoryDistributionData'

export interface DistributionChartImages {
    kg: DashboardChartImage
    position: DashboardChartImage
}

/**
 * Danh mục được theo dõi trên tab vị trí — đọc đúng khóa cấu hình mà card dashboard dùng,
 * để ảnh nhúng vào báo cáo LOT có đúng tập danh mục người dùng đã chọn.
 * Không đọc được (trang in có thể mở ẩn danh) thì coi như theo dõi toàn bộ.
 */
async function readTrackedCategoryIds(systemCode: string): Promise<string[] | null> {
    try {
        const cfg = await readUiConfig(systemCode)
        const ids = cfg.warehouse_status_config?.selected_category_ids
        return Array.isArray(ids) ? ids : null
    } catch {
        return null
    }
}

/**
 * Dựng đúng hai biểu đồ của dashboard "Tỉ lệ phân bố hàng hóa tồn kho" (donut KG và
 * donut ô vị trí) thành ảnh PNG, để báo cáo khác (Tồn kho theo LOT) nhúng vào Excel
 * mà số liệu khớp 1:1 với dashboard — cùng hàm spec, cùng hàm tổng hợp.
 * Trả `null` khi lỗi để việc xuất báo cáo vẫn chạy, chỉ thiếu sheet ảnh.
 */
export async function buildDistributionChartImages(input: {
    systemCode: string
    conversion: KgConversion
}): Promise<DistributionChartImages | null> {
    const { systemCode, conversion } = input
    if (!systemCode) return null
    try {
        const [lots, categories, positionRaw] = await Promise.all([
            fetchDistributionLots(systemCode),
            fetchDistributionCategories(systemCode),
            fetchCategoryPositionRaw(systemCode)
        ])

        const { items, totalWeight } = aggregateKgByProduct(lots, conversion)
        const kgChart = distributionKgExportSpec({
            systemName: systemCode,
            filterLabel: 'Tất cả danh mục',
            items,
            totalWeight
        }).chart

        const tracked = await readTrackedCategoryIds(systemCode)
        const trackedSet = tracked ? new Set(tracked) : null
        const result = buildCategoryPositionStats({
            categories,
            positions: positionRaw.positions,
            lotCategories: positionRaw.lotCategories,
            zones: positionRaw.zones,
            warehouseId: null
        })
        const positionChart = categoryPositionExportSpec({
            systemName: systemCode,
            warehouseLabel: 'Tất cả kho',
            result: trackedSet
                ? { ...result, stats: result.stats.filter(s => trackedSet.has(s.categoryId)) }
                : result,
            visibleOnly: !!trackedSet
        }).chart

        return { kg: renderChartPng(kgChart), position: renderChartPng(positionChart) }
    } catch (err) {
        console.error('Không dựng được ảnh biểu đồ phân bố tồn kho:', err)
        return null
    }
}
