import { Combine, ArrowRightLeft, Scissors, HardHat, Package, Factory, Store, ShieldCheck } from 'lucide-react'

export type ModuleCategory = 'core' | 'automation' | 'specialized'

export interface UtilityModule {
    id: string
    name: string
    description: string
    icon: any
    category: ModuleCategory
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
        name: 'Quản lý Cấp Phát Công Trình',
        description: 'Theo dõi xuất vật tư tiêu hao theo tổ đội và sổ theo dõi mượn/trả công cụ dụng cụ.',
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
