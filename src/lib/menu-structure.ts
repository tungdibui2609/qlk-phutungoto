import {
    LayoutDashboard, Package, Settings, Warehouse, BookUser, BarChart3, Shield,
    List, FolderTree, Boxes, Globe, Tag, Building2, Car, Users, FileText,
    ShieldCheck, Map, ClipboardCheck, StickyNote, HardHat, ArrowDownToLine,
    ArrowUpFromLine, Activity, DollarSign, History, ArrowRightLeft, Key
} from 'lucide-react'

export interface MenuItemConfig {
    id: string
    name: string
    description?: string
    icon: any
    children?: MenuItemConfig[]
}

export const MENU_STRUCTURE: MenuItemConfig[] = [
    {
        id: 'overview',
        name: 'Tổng quan',
        description: 'Trang dashboard chính với các thông tin thống kê tổng quát.',
        icon: LayoutDashboard,
    },
    {
        id: 'products_cat',
        name: 'Quản lý sản phẩm',
        description: 'Quản lý thông tin hàng hóa, danh mục, đơn vị tính và xuất xứ.',
        icon: Package,
        children: [
            { id: 'products', name: 'Sản phẩm', icon: List },
            { id: 'categories', name: 'Danh mục', icon: FolderTree },
            { id: 'units', name: 'Đơn vị', icon: Boxes },
            { id: 'origins', name: 'Xuất xứ', icon: Globe },
            { id: 'lot_codes', name: 'Mã phụ', icon: Tag },
        ]
    },
    {
        id: 'info_cat',
        name: 'Quản lý thông tin',
        description: 'Quản lý các thông tin cơ bản: Nhà cung cấp, Khách hàng, QC, Loại phiếu.',
        icon: BookUser,
        children: [
            { id: 'suppliers', name: 'Nhà cung cấp', icon: Building2 },
            { id: 'vehicles', name: 'Dòng xe', icon: Car },
            { id: 'customers', name: 'Khách hàng', icon: Users },
            { id: 'order_types', name: 'Loại phiếu', icon: FileText },
            { id: 'qc', name: 'QC', icon: ShieldCheck },
            { id: 'members_teams', name: 'Thành viên & Đội', icon: Users },
        ]
    },
    {
        id: 'warehouse_cat',
        name: 'Quản lý Kho',
        description: 'Quản lý hạ tầng kho, sơ đồ, trạng thái, và các thao tác kiểm kê.',
        icon: Warehouse,
        children: [
            { id: 'infrastructure', name: 'Hạ tầng', icon: Warehouse },
            { id: 'warehouse_map', name: 'Sơ đồ kho', icon: Map },
            { id: 'warehouse_status', name: 'Trạng thái kho', icon: BarChart3 },
            { id: 'lots', name: 'Quản lý LOT', icon: Boxes },
            { id: 'notes', name: 'Ghi chú vận hành', icon: StickyNote },
        ]
    },
    {
        id: 'construction_cat',
        name: 'Cấp phát hàng hóa',
        description: 'Dành riêng cho module quản lý vật tư tại công trình.',
        icon: HardHat,
        children: [
            { id: 'construction_overview', name: 'Tổng quan', icon: LayoutDashboard },
            { id: 'site_inventory', name: 'Cấp phát', icon: ClipboardCheck },
        ]
    },
    {
        id: 'accounting_cat',
        name: 'Kế toán',
        description: 'Quản lý các nghiệp vụ nhập kho và xuất kho.',
        icon: FileText,
        children: [
            { id: 'inbound', name: 'Nhập kho', icon: ArrowDownToLine },
            { id: 'outbound', name: 'Xuất kho', icon: ArrowUpFromLine },
            { id: 'audit', name: 'Kiểm kê', icon: ClipboardCheck },
        ]
    },
    {
        id: 'reports_cat',
        name: 'Báo cáo',
        description: 'Hệ thống báo cáo tồn kho, lịch sử thao tác, công nợ, nhật ký.',
        icon: BarChart3,
        children: [
            { id: 'inventory_report', name: 'Tồn kho', icon: Package },
            { id: 'history', name: 'Lịch sử thao tác', icon: Activity },
            { id: 'customer_docs', name: 'Chứng từ khách hàng', icon: FileText },
            { id: 'supplier_debts', name: 'Công nợ NCC', icon: DollarSign },
            { id: 'accounting_history', name: 'Nhật ký xuất nhập', icon: ArrowRightLeft },
            { id: 'lot_history', name: 'Nhật ký xuất nhập LOT', icon: History },
            { id: 'linked_journal', name: 'Nhật ký liên kết', icon: ArrowRightLeft },
        ]
    },
    {
        id: 'work_cat',
        name: 'Công việc',
        description: 'Quản lý các nghiệp vụ công việc, lệnh điều phối.',
        icon: ClipboardCheck,
        children: [
            { id: 'export_order', name: 'Lệnh xuất kho', icon: ArrowUpFromLine },
        ]
    },
    {
        id: 'users_cat',
        name: 'Người dùng',
        description: 'Quản lý tài khoản, vai trò và phân quyền chi tiết.',
        icon: Shield,
        children: [
            { id: 'users_list', name: 'Người dùng', icon: Shield },
            { id: 'roles', name: 'Vai trò', icon: BookUser },
            { id: 'permissions', name: 'Phân quyền', icon: Key },
        ]
    },
    {
        id: 'settings',
        name: 'Cài đặt',
        description: 'Thiết lập tham số hệ thống và các tùy chọn cá nhân.',
        icon: Settings
    }
]
