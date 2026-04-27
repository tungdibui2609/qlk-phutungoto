import { Combine, ArrowRightLeft, Scissors, HardHat, Package, Factory, Store, ShieldCheck, QrCode, Users, FileText, ArrowUpDown, Leaf, AlertTriangle } from 'lucide-react'

export type ModuleCategory = 'core' | 'automation' | 'specialized' | 'info'

export interface UtilityModule {
    id: string
    name: string
    description: string
    icon: any
    category: ModuleCategory
    is_basic?: boolean
    default_enabled?: boolean
}

export interface SolutionPreset {
    id: string
    name: string
    description: string
    icon: any
    recommended_modules: string[]
}

export const UTILITY_MODULES: UtilityModule[] = [
    {
        id: 'lot_accounting_sync',
        name: 'Đồng bộ Kho - Kế toán (LOT)',
        description: 'Tự động tạo hàng chờ nhập/xuất và đồng bộ dữ liệu chênh lệch khi thay đổi LOT.',
        icon: ArrowRightLeft,
        category: 'core',
        default_enabled: true
    },
    {
        id: 'auto_unbundle_order',
        name: 'Bẻ gói Kế toán (PNK/PXK)',
        description: 'Tự động tạo phiếu chuyển đổi (AUTO) khi xuất hàng lẻ đơn vị (ví dụ: bẻ Bao thành Gói).',
        icon: Combine,
        category: 'automation',
        default_enabled: false
    },
    {
        id: 'auto_unbundle_lot',
        name: 'Bẻ gói Kho (LOT/Vị trí)',
        description: 'Cho phép thực hiện thao tác chia tách LOT và bẻ đơn vị tính trực tiếp tại sơ đồ kho.',
        icon: Scissors,
        category: 'automation',
        default_enabled: true
    },
    {
        id: 'site_inventory_manager',
        name: 'Cấp phát hàng hóa',
        description: 'Theo dõi xuất vật tư tiêu hao theo tổ đội và sổ theo dõi mượn/trả công cụ dụng cụ.',
        icon: HardHat,
        category: 'specialized',
        default_enabled: false
    },
    {
        id: 'production_inventory_manager',
        name: 'Cấp phát sản xuất',
        description: 'Theo dõi cấp phát vật tư, linh kiện cho các công đoạn sản xuất và lắp ráp.',
        icon: Factory,
        category: 'specialized',
        default_enabled: false
    },
    {
        id: 'utility_qr_assign',
        name: 'Quét mã QR & Gán vị trí',
        description: 'Cho phép quét mã QR để gán nhanh vị trí kho. Hiển thị menu Quét mã QR trên thanh điều hướng.',
        icon: QrCode,
        category: 'automation',
        default_enabled: false
    },
    {
        id: 'member_team_manager',
        name: 'Thành viên & Đội',
        description: 'Quản lý nhân sự và các đội nhóm thi công, vận hành.',
        icon: Users,
        category: 'info',
        is_basic: true,
        default_enabled: true
    },
    {
        id: 'production_code',
        name: 'Quản lý Lệnh sản xuất',
        description: 'Quản lý danh mục lệnh sản xuất, quy trình sản xuất tập trung cho toàn công ty.',
        icon: Factory,
        category: 'info',
        is_basic: true,
        default_enabled: true
    },
    {
        id: 'work_export_order',
        name: 'Lệnh xuất kho',
        description: 'Module quản lý các lệnh xuất kho và điều phối hàng hóa.',
        icon: FileText,
        category: 'core',
        default_enabled: true
    },
    {
        id: 'fifo_priority',
        name: 'FIFO - Nhập trước Xuất trước',
        description: 'Ưu tiên hiển thị vị trí/LOT có ngày nhập kho sớm nhất khi tìm kiếm trên Sơ đồ kho và Quản lý LOT.',
        icon: ArrowUpDown,
        category: 'automation',
        default_enabled: false
    },
    {
        id: 'fresh_material_manager',
        name: 'Nguyên liệu tươi',
        description: 'Theo dõi vòng đời nguyên liệu tươi từ bốc xe, phân loại, cấp đông đến thành phẩm.',
        icon: Leaf,
        category: 'specialized',
        default_enabled: false
    },
    {
        id: 'stock_warning',
        name: 'Cảnh báo tồn kho',
        description: 'Tự động gửi email cảnh báo khi sản phẩm xuống dưới ngưỡng tồn tối thiểu.',
        icon: AlertTriangle,
        category: 'automation',
        default_enabled: false
    },
    {
        id: 'warehouse_layout_2d',
        name: 'Sơ đồ kho 2D (AutoCAD)',
        description: 'Kích hoạt công cụ thiết kế mặt bằng kho 2D, thay thế hoàn toàn cấu trúc sơ đồ phân cấp mặc định.',
        icon: HardHat,
        category: 'specialized',
        default_enabled: false
    }
]

export const SOLUTION_PRESETS: SolutionPreset[] = [
    {
        id: 'standard',
        name: 'Kho Tiêu Chuẩn',
        description: 'Quản lý kho cơ bản, nhập xuất và theo dõi tồn kho.',
        icon: Package,
        recommended_modules: ['lot_accounting_sync']
    },
    {
        id: 'manufacturing',
        name: 'Kho Sản Xuất',
        description: 'Dành cho các đơn vị có hoạt động chế biến, san chiết, đóng gói lại.',
        icon: Factory,
        recommended_modules: ['lot_accounting_sync', 'auto_unbundle_lot']
    },
    {
        id: 'retail',
        name: 'Kho Bán Lẻ / Phân Phối',
        description: 'Tự động quy đổi đơn vị khi bán lẻ (ví dụ: Thùng -> Hộp).',
        icon: Store,
        recommended_modules: ['lot_accounting_sync', 'auto_unbundle_order']
    },
    {
        id: 'construction',
        name: 'Kho Công Trình',
        description: 'Quản lý vật tư, công cụ dụng cụ cấp phát cho đội thi công.',
        icon: HardHat,
        recommended_modules: ['lot_accounting_sync', 'site_inventory_manager']
    }
]
