
import { DollarSign, FileText, Truck, Calendar, User, ShoppingCart, ShieldCheck, MapPin, Image, Minimize } from 'lucide-react'

export interface OrderModule {
    id: string
    name: string
    description: string
    icon: any
    type: 'inbound' | 'outbound' // To distinguish between Inbound and Outbound modules
}

export const INBOUND_MODULES: OrderModule[] = [
    {
        id: 'inbound_basic',
        name: 'Thông tin cơ bản (Mặc định)',
        description: 'Mã phiếu, Kho nhập, Ngày tạo, Diễn giải',
        icon: FileText,
        type: 'inbound'
    },
    {
        id: 'inbound_supplier',
        name: 'Thông tin Nhà cung cấp',
        description: 'Tên NCC, Địa chỉ, Số điện thoại liên hệ',
        icon: User,
        type: 'inbound'
    },
    {
        id: 'inbound_type',
        name: 'Phân loại phiếu',
        description: 'Chọn loại phiếu nhập (từ SX, NCC, Chuyển kho...)',
        icon: FileText,
        type: 'inbound'
    },
    {
        id: 'inbound_financials',
        name: 'Tài chính & Thuế',
        description: 'Đơn giá, Thành tiền, Chiết khấu, VAT',
        icon: DollarSign,
        type: 'inbound'
    },
    {
        id: 'inbound_documents',
        name: 'Chứng từ kèm theo',
        description: 'Số hóa đơn, Số phiếu giao hàng, Chứng từ gốc',
        icon: FileText,
        type: 'inbound'
    },
    {
        id: 'inbound_logistics',
        name: 'Vận chuyển & Kho bãi',
        description: 'Biển số xe, Tên tài xế, Vị trí kho nhập',
        icon: Truck,
        type: 'inbound'
    },
    {
        id: 'inbound_images',
        name: 'Hình ảnh hóa đơn',
        description: 'Chụp hoặc tải lên ảnh hóa đơn, chứng từ',
        icon: Image,
        type: 'inbound'
    },
    {
        id: 'inbound_accounting',
        name: 'Hạch toán Kế toán',
        description: 'Tài khoản Nợ/Có, Diễn giải hạch toán',
        icon: ShieldCheck,
        type: 'inbound'
    },
    {
        id: 'inbound_ui_compact',
        name: 'Giao diện thu gọn',
        description: 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)',
        icon: Minimize,
        type: 'inbound'
    }
]

export const OUTBOUND_MODULES: OrderModule[] = [
    {
        id: 'outbound_basic',
        name: 'Thông tin cơ bản (Mặc định)',
        description: 'Mã phiếu, Kho xuất, Diễn giải',
        icon: ShoppingCart,
        type: 'outbound'
    },
    {
        id: 'outbound_customer',
        name: 'Thông tin Khách hàng',
        description: 'Khách hàng, Địa chỉ, Số điện thoại',
        icon: User,
        type: 'outbound'
    },
    {
        id: 'outbound_type',
        name: 'Phân loại phiếu',
        description: 'Chọn loại phiếu xuất (Xuất bán, Hủy, Chuyển kho...)',
        icon: FileText,
        type: 'outbound'
    },
    {
        id: 'outbound_financials',
        name: 'Tài chính & Doanh thu',
        description: 'Đơn giá, Tổng tiền, Chiết khấu thương mại, Thuế',
        icon: DollarSign,
        type: 'outbound'
    },
    {
        id: 'outbound_images',
        name: 'Hình ảnh chứng từ',
        description: 'Chụp hoặc tải lên ảnh phiếu xuất, biên bản',
        icon: Image,
        type: 'outbound'
    },
    {
        id: 'outbound_logistics',
        name: 'Giao nhận & Vận chuyển',
        description: 'Địa điểm giao hàng, Phương thức vận chuyển, Người nhận',
        icon: MapPin,
        type: 'outbound'
    },
    {
        id: 'outbound_documents',
        name: 'Chứng từ xuất kho',
        description: 'Lệnh xuất kho, Hợp đồng kinh tế',
        icon: FileText,
        type: 'outbound'
    },
    {
        id: 'outbound_accounting',
        name: 'Hạch toán Kế toán',
        description: 'Tài khoản Nợ/Có, Doanh thu, Giá vốn',
        icon: ShieldCheck,
        type: 'outbound'
    },
    {
        id: 'outbound_ui_compact',
        name: 'Giao diện thu gọn',
        description: 'Sử dụng màn hình tạo phiếu nhỏ hơn (Compact Mode)',
        icon: Minimize,
        type: 'outbound'
    }
]

export function getAllOrderModules(): OrderModule[] {
    return [...INBOUND_MODULES, ...OUTBOUND_MODULES]
}
