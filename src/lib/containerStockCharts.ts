import { renderChartPng } from '@/lib/chartImage'
import { containerExportSpec } from '@/lib/dashboardExcelSpecs'
import type { DashboardChartImage } from '@/lib/dashboardExcelWorkbook'
import {
    aggregateContainerStock,
    fetchContainerLots,
    type ContainerConversion
} from './containerStockData'

/**
 * Dựng biểu đồ của card dashboard "Số lượng Container tồn kho theo từng mặt hàng" thành
 * ảnh PNG, để báo cáo Tồn kho theo LOT nhúng vào Excel mà số liệu khớp 1:1 với dashboard —
 * cùng fetchContainerLots, cùng aggregateContainerStock, cùng containerExportSpec.
 * Sửa spec sau này thì cả card lẫn báo cáo LOT cùng đổi, không lệch nhau.
 * Trả `null` khi lỗi để việc xuất báo cáo vẫn chạy, chỉ thiếu sheet ảnh.
 */
export async function buildContainerChartImage(input: {
    systemCode: string
    conversion: ContainerConversion
}): Promise<DashboardChartImage | null> {
    const { systemCode, conversion } = input
    if (!systemCode) return null
    try {
        const lots = await fetchContainerLots(systemCode)
        // Báo cáo là tài liệu độc lập: lấy toàn bộ mặt hàng (không lọc danh mục),
        // containerExportSpec tự sắp theo container và cắt Top 15 cho ảnh dễ đọc.
        const stats = aggregateContainerStock(lots, conversion, [])
        const { chart } = containerExportSpec({
            systemName: systemCode,
            filterLabel: 'Tất cả danh mục',
            items: stats
        })
        return renderChartPng(chart)
    } catch (err) {
        console.error('Không dựng được ảnh biểu đồ container tồn kho:', err)
        return null
    }
}
