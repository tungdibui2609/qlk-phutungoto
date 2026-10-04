import { LayoutDashboard, Package, Settings, LogOut, Warehouse, ChevronRight, ChevronDown, Building2, Car, List, FolderTree, Map, ArrowDownToLine, ArrowUpFromLine, Boxes, ClipboardCheck, Users, BookUser, Shield, BarChart3, History, FileText, TrendingUp, AlertTriangle, PackageSearch, DollarSign, PieChart, Globe, Key } from 'lucide-react'

export type RouteItem = {
    name: string
    path: string
    icon?: any
    children?: RouteItem[]
}

export const APP_ROUTES: RouteItem[] = [
    { name: 'Tổng quan', path: '/' },
    {
        name: 'Quản lý sản phẩm',
        path: '/products-management',
        children: [
            { name: 'Sản phẩm', path: '/products' },
            { name: 'Sản phẩm nội bộ', path: '/internal-products' },
            { name: 'Tên gõ tắt', path: '/product-aliases' },
            { name: 'Danh mục', path: '/categories' },
            { name: 'Đơn vị', path: '/units' },
            { name: 'Xuất xứ', path: '/origins' },
            { name: 'Cấu hình Dấu Đóng', path: '/warehouses/stamp-rules' },
        ]
    },
    {
        name: 'Quản lý thông tin',
        path: '/info-management',
        children: [
            { name: 'Nhà cung cấp', path: '/suppliers' },
            { name: 'Dòng xe', path: '/vehicles' },
            { name: 'Khách hàng', path: '/customers' },
        ]
    },
    {
        name: 'Quản lý Kho',
        path: '/warehouse-management',
        children: [
            { name: 'Hạ tầng', path: '/warehouses' },
            { name: 'Sơ đồ kho', path: '/warehouses/map' },
            { name: 'Quản lý LOT', path: '/warehouses/lots' },
            { name: 'Nhập kho (KT)', path: '/inbound' },
            { name: 'Xuất kho (KT)', path: '/outbound' },
            { name: 'Tồn kho', path: '/inventory' },
            { name: 'Kiểm kê', path: '/operations/audit' },
        ]
    },
    {
        name: 'Quét mã QR',
        path: '/scan-management',
        children: [
            { name: 'Quản lý Pallet Quét', path: '/warehouses/pallets' },
            { name: 'Liên kết Tem Thùng', path: '/warehouses/lot-labels' },
            { name: 'Liên kết Tem (Mobile)', path: '/mobile/lot-labels' },
            { name: 'Gán vị trí', path: '/warehouses/scan/assign' },
            { name: 'Xuất kho', path: '/warehouses/scan/export' },
            { name: 'Lệnh xuất', path: '/warehouses/scan/export-order' },
            { name: 'Máy in trạm', path: '/print/station' },
            { name: 'Mobile', path: '/mobile' },
            { name: 'LOT Sản Xuất', path: '/production-lot' },
        ]
    },
    {
        name: 'Giao nhận',
        path: '/delivery-management',
        children: [
            { name: 'Cài đặt giao nhận', path: '/delivery-settings' },
            { name: 'Nhật ký giao nhận kho', path: '/delivery-journal' },
            { name: 'Giao nhận trực tiếp (1 bên)', path: '/delivery-journal-single' },
            { name: 'Ca làm & Thống kê', path: '/delivery-shifts' },
        ]
    },
    {
        name: 'Báo cáo',
        path: '/reports',
        children: [
            { name: 'Chứng từ khách hàng', path: '/reports/customer-docs' },
            { name: 'Công nợ NCC', path: '/reports/supplier-debts' },
        ]
    },
    {
        name: 'Công việc',
        path: '/work-management',
        children: [
            { name: 'Giao việc & Bàn giao ca', path: '/work/tasks' },
            { name: 'Lệnh xuất kho', path: '/work/export-order' },
            { name: 'Kiểm kê nội bộ', path: '/work/inventory' },
        ]
    },
    {
        name: 'Người dùng & Phân quyền',
        path: '/users-management',
        children: [
            { name: 'Người dùng', path: '/users' },
            { name: 'Vai trò', path: '/users/roles' },
            { name: 'Phân quyền', path: '/users/permissions' },
        ]
    },
    { name: 'Cài đặt', path: '/settings' },
]
