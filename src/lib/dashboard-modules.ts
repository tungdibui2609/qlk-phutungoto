import { LayoutDashboard, PieChart, Package, Boxes, TrendingUp, AlertTriangle } from 'lucide-react'

export interface DashboardModule {
    id: string
    name: string
    description: string
    icon: any
}

export const DASHBOARD_MODULES: DashboardModule[] = [
    {
        id: 'stats_overview',
        name: 'Thẻ thống kê tổng quan',
        description: 'Hiển thị tổng sản phẩm, danh mục, tồn kho thấp và nhập hàng trong tuần.',
        icon: LayoutDashboard
    },
    {
        id: 'inventory_distribution',
        name: 'Tỉ lệ phân bố hàng hóa',
        description: 'Biểu đồ tròn hiển thị tỉ lệ phần trăm các loại hàng hóa trong kho.',
        icon: PieChart
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
