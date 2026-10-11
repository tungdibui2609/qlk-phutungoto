import { 
    Layers, 
    Tags, 
    Smartphone, 
    Stamp, 
    MapPin, 
    ArrowUpFromLine, 
    FileText, 
    Printer, 
    Boxes,
    QrCode 
} from 'lucide-react'

export interface QrModule {
    id: string
    name: string
    description: string
    icon: any
    is_basic?: boolean
}

export const QR_MODULES: QrModule[] = [
    {
        id: 'qr_pallets',
        name: 'Quản lý Pallet Quét',
        description: 'Quản lý, kiểm đếm và theo dõi danh sách Pallet đã quét tem / mã QR theo thời gian thực.',
        icon: Layers,
        is_basic: true
    },
    {
        id: 'qr_lot_labels',
        name: 'Liên kết Tem Thùng',
        description: 'Quét và gán liên kết mã tem thùng / mã thùng hàng với lô hàng LOT.',
        icon: Tags,
        is_basic: true
    },
    {
        id: 'qr_lot_labels_mobile',
        name: 'Liên kết Tem (Mobile)',
        description: 'Giao diện di động thao tác nhanh quét liên kết tem thùng trực tiếp tại xưởng.',
        icon: Smartphone,
        is_basic: true
    },
    {
        id: 'qr_stamp_lookup',
        name: 'Tra cứu tem',
        description: 'Công cụ tra cứu thông tin chi tiết nguồn gốc và trạng thái của mã tem thùng, dấu đóng.',
        icon: Stamp,
        is_basic: true
    },
    {
        id: 'utility_qr_assign',
        name: 'Gán vị trí (Quét QR)',
        description: 'Quét mã QR để gán nhanh vị trí kho cho Pallet và sản phẩm.',
        icon: MapPin,
        is_basic: true
    },
    {
        id: 'qr_export',
        name: 'Xuất kho (Quét QR)',
        description: 'Thao tác quét mã QR thùng/pallet để thực hiện thủ tục xuất kho chính xác.',
        icon: ArrowUpFromLine,
        is_basic: true
    },
    {
        id: 'qr_export_order',
        name: 'Lệnh xuất (Quét QR)',
        description: 'Quét mã kiểm tra và xuất kho theo lệnh điều động xuất hàng.',
        icon: FileText,
        is_basic: true
    },
    {
        id: 'qr_print_station',
        name: 'Máy in trạm',
        description: 'Quản lý máy in trạm tại các chốt kiểm soát quét mã và in tem nhãn.',
        icon: Printer,
        is_basic: true
    },
    {
        id: 'qr_mobile_access',
        name: 'Mobile (Quét QR)',
        description: 'Trung tâm điều hướng giao diện quét mã QR trên thiết bị di động / máy quét cầm tay.',
        icon: Smartphone,
        is_basic: true
    },
    {
        id: 'qr_production_lot',
        name: 'LOT Sản Xuất',
        description: 'Quét kiểm tra và theo dõi tiến độ LOT thành phẩm trong dây chuyền sản xuất.',
        icon: Boxes,
        is_basic: true
    }
]
