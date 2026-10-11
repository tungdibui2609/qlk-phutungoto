import { FileText, ArrowDownToLine, ArrowUpFromLine, Hash, Printer } from 'lucide-react'

export interface PrintModule {
    id: string
    name: string
    description: string
    icon: any
    is_basic?: boolean
}

export const PRINT_MODULES: PrintModule[] = [
    {
        id: 'print_bank_report',
        name: 'Phiếu ngân hàng',
        description: 'In báo cáo, biểu mẫu kê khai tồn kho và chứng từ cầm cố/bảo lãnh ngân hàng.',
        icon: FileText,
        is_basic: true
    },
    {
        id: 'bank_inbound',
        name: 'Nhập ngân hàng',
        description: 'Quản lý và in ấn chứng từ nhập kho phục vụ thủ tục hồ sơ ngân hàng.',
        icon: ArrowDownToLine,
        is_basic: true
    },
    {
        id: 'bank_outbound',
        name: 'Xuất ngân hàng',
        description: 'Quản lý và in ấn chứng từ giải chấp, xuất kho phục vụ thủ tục hồ sơ ngân hàng.',
        icon: ArrowUpFromLine,
        is_basic: true
    },
    {
        id: 'print_sequence_number',
        name: 'In số thứ tự (STT)',
        description: 'In bảng danh sách và biểu mẫu số thứ tự LOT theo ngày / lô sản xuất.',
        icon: Hash,
        is_basic: true
    }
]
