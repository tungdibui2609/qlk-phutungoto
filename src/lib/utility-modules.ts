import { Combine, ArrowRightLeft, Scissors, HardHat } from 'lucide-react'

export interface UtilityModule {
    id: string
    name: string
    description: string
    icon: any
    default_enabled?: boolean
}

export const UTILITY_MODULES: UtilityModule[] = [
    {
        id: 'lot_accounting_sync',
        name: 'Đồng bộ Kho - Kế toán (LOT)',
        description: 'Tự động tạo hàng chờ nhập/xuất và đồng bộ dữ liệu chênh lệch khi thay đổi LOT.',
        icon: ArrowRightLeft,
        default_enabled: true
    },
    {
        id: 'auto_unbundle_order',
        name: 'Bẻ gói Kế toán (PNK/PXK)',
        description: 'Tự động tạo phiếu chuyển đổi (AUTO) khi xuất hàng lẻ đơn vị (ví dụ: bẻ Bao thành Gói).',
        icon: Combine,
        default_enabled: false
    },
    {
        id: 'auto_unbundle_lot',
        name: 'Bẻ gói Kho (LOT/Vị trí)',
        description: 'Cho phép thực hiện thao tác chia tách LOT và bẻ đơn vị tính trực tiếp tại sơ đồ kho.',
        icon: Scissors,
        default_enabled: true
    },
    {
        id: 'site_inventory_manager',
        name: 'Quản lý Cấp Phát Công Trình',
        description: 'Theo dõi xuất vật tư tiêu hao theo tổ đội và sổ theo dõi mượn/trả công cụ dụng cụ.',
        icon: HardHat,
        default_enabled: false
    }
]
