import {
    BarChart3,
    Layers,
    Map,
    Activity,
    TrendingUp,
    CalendarClock,
    LucideIcon
} from 'lucide-react'

export interface ReportModule {
    id: string
    name: string
    description: string
    icon: LucideIcon
    is_basic?: boolean
}

export const REPORT_MODULES: ReportModule[] = [
    {
        id: 'report_hall_summary',
        name: 'Thống kê sảnh',
        description: 'Báo cáo tổng hợp số lượng, trạng thái hàng hóa và vị trí tại các khu vực sảnh',
        icon: BarChart3,
        is_basic: true
    },
    {
        id: 'report_floor_1',
        name: 'Báo cáo tầng 1',
        description: 'Báo cáo chi tiết hoạt động xuất nhập và tồn kho tại khu vực tầng 1',
        icon: Layers,
        is_basic: true
    },
    {
        id: 'report_warehouse_map_log',
        name: 'Nhật ký sơ đồ kho',
        description: 'Theo dõi lịch sử thay đổi vị trí, sơ đồ mặt bằng và cấu trúc kho',
        icon: Map,
        is_basic: true
    },
    {
        id: 'report_warehouse_movements',
        name: 'Diễn biến kho (Sạch)',
        description: 'Thống kê luồng luân chuyển hàng hóa sạch và diễn biến xuất nhập tồn',
        icon: Activity,
        is_basic: true
    },
    {
        id: 'report_picking_productivity',
        name: 'Năng suất lấy hàng',
        description: 'Báo cáo hiệu suất, tốc độ lấy hàng và năng suất làm việc của nhân sự',
        icon: TrendingUp,
        is_basic: true
    },
    {
        id: 'report_inventory_aging',
        name: 'Tồn kho lâu ngày',
        description: 'Báo cáo tuổi tồn kho theo ngưỡng tuỳ chỉnh (90/180 ngày), chọn mốc ngày nhập kho, sản xuất, nguyên liệu hoặc đóng gói',
        icon: CalendarClock,
        is_basic: true
    }
]
