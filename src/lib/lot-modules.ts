import { Box, Calendar, Clock, MapPin, Factory, ShieldCheck, Hash, Image, FileText } from 'lucide-react'

export interface LotModule {
    id: string
    name: string
    description: string
    icon: any
}

export const LOT_MODULES: LotModule[] = [
    {
        id: 'packaging_date',
        name: 'Ngày đóng bao bì',
        description: 'Hiển thị trường nhập và thời gian đóng gói bao bì.',
        icon: Box
    },
    {
        id: 'warehouse_name',
        name: 'Kho nhập hàng',
        description: 'Hiển thị và cho phép chọn kho nhập hàng (chi nhánh).',
        icon: MapPin
    },
    {
        id: 'peeling_date',
        name: 'Ngày bóc múi',
        description: 'Hiển thị trường ngày bóc múi.',
        icon: Calendar
    },
    {
        id: 'batch_code',
        name: 'Số Batch/Lô (NCC)',
        description: 'Hiển thị trường nhập số Batch hoặc Lô của nhà cung cấp.',
        icon: Hash
    },
    {
        id: 'supplier_info',
        name: 'Nhà cung cấp',
        description: 'Hiển thị và cho phép chọn nhà cung cấp.',
        icon: Factory
    },
    {
        id: 'qc_info',
        name: 'Nhân viên QC',
        description: 'Hiển thị và cho phép chọn nhân viên kiểm soát chất lượng.',
        icon: ShieldCheck
    },
    {
        id: 'inbound_date',
        name: 'Ngày nhập kho',
        description: 'Hiển thị trường ngày nhập kho.',
        icon: Clock
    },
    {
        id: 'lot_images',
        name: 'Hình ảnh chứng từ / LOT',
        description: 'Cho phép tải lên và hiển thị hình ảnh của LOT.',
        icon: Image
    },
    {
        id: 'extra_info',
        name: 'Thông tin phụ',
        description: 'Trường nhập các thông tin bổ sung khác cho LOT.',
        icon: FileText
    }
]
