import { LayoutDashboard, PieChart, Package, Boxes, TrendingUp, AlertTriangle, BarChart3, Gauge } from 'lucide-react'

export interface DashboardModule {
    id: string
    name: string
    description: string
    icon: any
    is_basic?: boolean
}

export const DASHBOARD_MODULES: DashboardModule[] = [
    {
        id: 'stats_overview',
        name: 'Thẻ thống kê tổng quan',
        description: 'Hiển thị tổng sản phẩm, danh mục, tồn kho thấp và nhập hàng trong tuần.',
        icon: LayoutDashboard,
        is_basic: true
    },
    {
        id: 'inventory_distribution',
        name: 'Tỉ lệ phân bố hàng hóa',
        description: 'Hai tab: "Theo khối lượng (KG)" — biểu đồ tròn phân bố theo sản phẩm; "Theo danh mục (vị trí)" — số ô vị trí đang chứa hàng của từng danh mục (tỉ lệ hàng hoá / công suất), dùng chung cấu hình với Sơ đồ trạng thái kho.',
        icon: PieChart
    },
    {
        id: 'container_distribution',
        name: 'Ước tính Container xuất bán',
        description: 'Biểu đồ cột thể hiện ước tính số lượng container tồn kho cho từng sản phẩm theo quy cách thùng.',
        icon: BarChart3,
        is_basic: true
    },
    {
        id: 'warehouse_fill_rate',
        name: 'Tỉ lệ lấp đầy kho',
        description: 'Khối thống kê tỉ lệ lấp đầy ô vị trí theo khu vực, tách thành tab Lô kệ / Sảnh tạm kết / Tổng, kèm cảnh báo khu sắp đầy.',
        icon: Gauge,
        is_basic: true
    },
    {
        id: 'categories_summary',
        name: 'Danh sách danh mục',
        description: 'Bảng tóm tắt các danh mục sản phẩm hiện có.',
        icon: Boxes
    },
    {
        id: 'recent_products',
        name: 'Sản phẩm mới nhất',
        description: 'Danh sách các sản phẩm mới được thêm vào hệ thống.',
        icon: Package
    }
]
