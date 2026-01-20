import { Car, Package, Thermometer, Truck, Box } from 'lucide-react'

export interface ProductModule {
    id: string
    name: string
    description: string
    icon: any
    fields: ModuleField[]
}

export interface ModuleField {
    key: string
    label: string
    type: 'text' | 'number' | 'date' | 'select' | 'textarea'
    options?: string[] // For select type
    required?: boolean
    placeholder?: string
    suffix?: string // e.g. "kg", "cm"
    group: string // To group fields visually
}

export const PRODUCT_MODULES: ProductModule[] = [
    {
        id: 'automotive_parts',
        name: 'Phụ tùng Ô tô',
        description: 'Quản lý mã phụ tùng, OEM, dòng xe tương thích',
        icon: Car,
        fields: [
            { key: 'oem_number', label: 'Mã OEM', type: 'text', group: 'Thông tin kỹ thuật', placeholder: 'VD: 123-456' },
            { key: 'model_compatibility', label: 'Dòng xe tương thích', type: 'text', group: 'Thông tin kỹ thuật', placeholder: 'VD: Ranger, Everest' },
            { key: 'manufacturer', label: 'Hãng sản xuất', type: 'text', group: 'Thông tin kỹ thuật' },
            { key: 'warranty_months', label: 'Bảo hành (tháng)', type: 'number', group: 'Thông tin kỹ thuật' },
        ]
    },
    {
        id: 'food_safety',
        name: 'An toàn Thực phẩm',
        description: 'Quản lý hạn sử dụng, ngày sản xuất, nhiệt độ bảo quản',
        icon: Thermometer,
        fields: [
            { key: 'expiry_date', label: 'Hạn sử dụng', type: 'date', required: true, group: 'An toàn thực phẩm' },
            { key: 'production_date', label: 'Ngày sản xuất', type: 'date', group: 'An toàn thực phẩm' },
            { key: 'storage_temp', label: 'Nhiệt độ bảo quản', type: 'text', group: 'An toàn thực phẩm', placeholder: 'VD: -18 độ C' },
            { key: 'ingredients', label: 'Thành phần', type: 'textarea', group: 'An toàn thực phẩm' },
        ]
    },
    {
        id: 'packaging',
        name: 'Bao bì & Đóng gói',
        description: 'Quản lý kích thước, chất liệu, quy cách đóng gói',
        icon: Package,
        fields: [
            { key: 'material', label: 'Chất liệu', type: 'text', group: 'Thông số bao bì', placeholder: 'VD: Carton, Nhựa PE' },
            { key: 'dimensions', label: 'Kích thước (DxRxC)', type: 'text', group: 'Thông số bao bì', placeholder: 'VD: 30x20x10 cm' },
            { key: 'thickness', label: 'Độ dày', type: 'number', group: 'Thông số bao bì', suffix: 'mm' },
            { key: 'recycle_info', label: 'Thông tin tái chế', type: 'text', group: 'Thông số bao bì' },
        ]
    },
    {
        id: 'logistics',
        name: 'Vận chuyển & Kho bãi',
        description: 'Quản lý trọng lượng, thể tích, kích thước pallet',
        icon: Truck,
        fields: [
            { key: 'weight_kg', label: 'Trọng lượng', type: 'number', group: 'Vận chuyển', suffix: 'kg' },
            { key: 'volume_m3', label: 'Thể tích', type: 'number', group: 'Vận chuyển', suffix: 'm3' },
            { key: 'pallet_size', label: 'Kích thước Pallet', type: 'text', group: 'Vận chuyển' },
            { key: 'stacking_limit', label: 'Giới hạn xếp chồng', type: 'number', group: 'Vận chuyển', suffix: 'tầng' },
        ]
    }
]

export function getFieldsForModules(moduleIds: string[]): ModuleField[] {
    if (!moduleIds || !Array.isArray(moduleIds)) return []

    // Flatten fields from all selected modules
    const fields: ModuleField[] = []

    moduleIds.forEach(modId => {
        const mod = PRODUCT_MODULES.find(m => m.id === modId)
        if (mod) {
            fields.push(...mod.fields)
        }
    })

    return fields
}
