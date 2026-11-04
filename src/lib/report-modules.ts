import {
    BarChart3,
    Layers,
    Map,
    Activity,
    TrendingUp,
    CalendarClock,
    Factory,
    Scale,
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
        description: 'Báo cáo thời gian lưu kho theo ngưỡng tuỳ chỉnh (90/180 ngày), chọn mốc ngày nhập kho, sản xuất, nguyên liệu hoặc đóng gói',
        icon: CalendarClock,
        is_basic: true
    },
    {
        id: 'report_inventory_by_production',
        name: 'Tồn theo Lệnh sản xuất',
        description: 'Tab tồn kho gom theo lệnh sản xuất › mã lot sản xuất › sản phẩm. Dành cho kho có truy xuất nguồn gốc theo lệnh SX.',
        icon: Factory,
        is_basic: true
    },
    {
        id: 'inventory_show_lot_balance',
        name: 'Hiện Tồn kho theo LOT (Bảng Kế toán)',
        description: 'Hiển thị thêm cột số lượng Tồn kho theo LOT ngay trên bảng Tồn kho kế toán để dễ dàng đối chiếu số lượng thực tế trong kho với sổ sách.',
        icon: Scale,
        is_basic: true
    },
    {
        id: 'report_stocktake_diff',
        name: 'Đối chiếu kiểm kê',
        description: 'So 2 file Excel cùng loại (sơ đồ kho dạng Bảng / dạng Lưới, hoặc tồn kho theo LOT) xuất trước và sau khi kiểm kê để chỉ ra chỗ lệch số lượng, xuất báo cáo Excel tô đỏ dòng lệch',
        icon: Scale,
        is_basic: true
    }
]
