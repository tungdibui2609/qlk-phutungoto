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
            { name: 'Danh mục', path: '/categories' },
            { name: 'Đơn vị', path: '/units' },
            { name: 'Xuất xứ', path: '/origins' },
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
        name: 'Báo cáo',
        path: '/reports',
        children: [
            { name: 'Chứng từ khách hàng', path: '/reports/customer-docs' },
            { name: 'Công nợ NCC', path: '/reports/supplier-debts' },
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
