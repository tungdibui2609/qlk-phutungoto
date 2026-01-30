import { Car, Package, Thermometer, Truck, Box, Image as ImageIcon, DollarSign, Link as LinkIcon, Settings2, Scale } from 'lucide-react'

export interface ProductModule {
    id: string
    name: string
    description: string
    icon: any
    fields: ModuleField[]
    is_basic?: boolean
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
        id: 'images',
        name: 'Hình ảnh',
        description: 'Quản lý hình ảnh đại diện sản phẩm',
        icon: ImageIcon,
        fields: [], // Hardcoded in form
        is_basic: true
    },
    {
        id: 'pricing',
        name: 'Giá cả',
        description: 'Thiết lập giá vốn, giá bán lẻ, giá bán buôn',
        icon: DollarSign,
        fields: []
    },
    {
        id: 'packaging',
        name: 'Quy cách đóng gói',
        description: 'Ghi chú quy cách đóng gói',
        icon: Box,
        fields: [],
        is_basic: true
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
