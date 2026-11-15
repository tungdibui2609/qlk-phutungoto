export interface StampRule {
    id: string
    category: string
    code: string
    name: string
    description?: string | null
    product_sku?: string | null
    system_code?: string
    is_active: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

export interface StampFieldConfig {
    key: string
    name: string
    shortName: string
    start: number
    length: number
    type: 'dictionary' | 'supplier' | 'date_ddmm' | 'date_ddmmyy' | 'raw'
    dictCategory?: string
    format?: string
    color: string
    afterDelimiter?: boolean
}

export interface StampLineConfig {
    title: string
    total_length: number
    has_delimiter?: boolean
    delimiter_char?: string
    sample?: string
    fields: StampFieldConfig[]
}

export interface StampFormat {
    id: string
    code: string
    name: string
    description?: string | null
    system_code?: string
    is_default: boolean
    is_active: boolean
    line1_config: StampLineConfig
    line2_config: StampLineConfig
    created_at?: string
    updated_at?: string
}

// Bảng màu cho các phân đoạn mã dấu đóng - Đảm bảo độ tương phản cao, chữ đậm sắc nét, dễ đọc trên cả nền sáng và tối
export const COLOR_THEMES: Record<string, { 
    label: string
    cardBadge: string
    cardPill: string
    bgClass: string
    badgeClass: string
    textClass: string
    borderClass: string
    hexPreview: string
}> = {
    purple: {
        label: 'Tím hoa cà',
        cardBadge: 'bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/70 dark:text-purple-200 dark:border-purple-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-purple-950 dark:text-purple-200 border border-purple-300/80 dark:border-purple-700',
        bgClass: 'bg-purple-500/25 text-purple-300 border-purple-500/50',
        badgeClass: 'bg-purple-500/30 text-purple-200 border-purple-400/60 shadow-sm shadow-purple-500/20',
        textClass: 'text-purple-300',
        borderClass: 'border-purple-500',
        hexPreview: '#8b5cf6'
    },
    blue: {
        label: 'Xanh dương đậm',
        cardBadge: 'bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/70 dark:text-blue-200 dark:border-blue-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-blue-950 dark:text-blue-200 border border-blue-300/80 dark:border-blue-700',
        bgClass: 'bg-blue-500/25 text-blue-300 border-blue-500/50',
        badgeClass: 'bg-blue-500/30 text-blue-200 border-blue-400/60 shadow-sm shadow-blue-500/20',
        textClass: 'text-blue-300',
        borderClass: 'border-blue-500',
        hexPreview: '#2563eb'
    },
    emerald: {
        label: 'Xanh lá ngọc',
        cardBadge: 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-emerald-950 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700',
        bgClass: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50',
        badgeClass: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/60 shadow-sm shadow-emerald-500/20',
        textClass: 'text-emerald-300',
        borderClass: 'border-emerald-500',
        hexPreview: '#059669'
    },
    amber: {
        label: 'Vàng hổ phách',
        cardBadge: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700',
        bgClass: 'bg-amber-500/25 text-amber-300 border-amber-500/50',
        badgeClass: 'bg-amber-500/30 text-amber-200 border-amber-400/60 shadow-sm shadow-amber-500/20',
        textClass: 'text-amber-300',
        borderClass: 'border-amber-500',
        hexPreview: '#d97706'
    },
    cyan: {
        label: 'Xanh cyan sáng',
        cardBadge: 'bg-cyan-100 text-cyan-950 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-200 dark:border-cyan-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-cyan-950 dark:text-cyan-200 border border-cyan-300/80 dark:border-cyan-700',
        bgClass: 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50',
        badgeClass: 'bg-cyan-500/30 text-cyan-200 border-cyan-400/60 shadow-sm shadow-cyan-500/20',
        textClass: 'text-cyan-300',
        borderClass: 'border-cyan-500',
        hexPreview: '#0891b2'
    },
    teal: {
        label: 'Xanh mòng két',
        cardBadge: 'bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/70 dark:text-teal-200 dark:border-teal-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-teal-950 dark:text-teal-200 border border-teal-300/80 dark:border-teal-700',
        bgClass: 'bg-teal-500/25 text-teal-300 border-teal-500/50',
        badgeClass: 'bg-teal-500/30 text-teal-200 border-teal-400/60 shadow-sm shadow-teal-500/20',
        textClass: 'text-teal-300',
        borderClass: 'border-teal-500',
        hexPreview: '#0d9488'
    },
    rose: {
        label: 'Hồng đỏ ruby',
        cardBadge: 'bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-rose-950 dark:text-rose-200 border border-rose-300/80 dark:border-rose-700',
        bgClass: 'bg-rose-500/25 text-rose-300 border-rose-500/50',
        badgeClass: 'bg-rose-500/30 text-rose-200 border-rose-400/60 shadow-sm shadow-rose-500/20',
        textClass: 'text-rose-300',
        borderClass: 'border-rose-500',
        hexPreview: '#e11d48'
    },
    sky: {
        label: 'Xanh mây trời',
        cardBadge: 'bg-sky-100 text-sky-950 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-sky-950 dark:text-sky-200 border border-sky-300/80 dark:border-sky-700',
        bgClass: 'bg-sky-500/25 text-sky-300 border-sky-500/50',
        badgeClass: 'bg-sky-500/30 text-sky-200 border-sky-400/60 shadow-sm shadow-sky-500/20',
        textClass: 'text-sky-300',
        borderClass: 'border-sky-500',
        hexPreview: '#0284c7'
    },
    violet: {
        label: 'Tím violet',
        cardBadge: 'bg-violet-100 text-violet-950 border-violet-300 dark:bg-violet-950/70 dark:text-violet-200 dark:border-violet-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-violet-950 dark:text-violet-200 border border-violet-300/80 dark:border-violet-700',
        bgClass: 'bg-violet-500/25 text-violet-300 border-violet-500/50',
        badgeClass: 'bg-violet-500/30 text-violet-200 border-violet-400/60 shadow-sm shadow-violet-500/20',
        textClass: 'text-violet-300',
        borderClass: 'border-violet-500',
        hexPreview: '#7c3aed'
    },
    fuchsia: {
        label: 'Hồng cánh sen',
        cardBadge: 'bg-fuchsia-100 text-fuchsia-950 border-fuchsia-300 dark:bg-fuchsia-950/70 dark:text-fuchsia-200 dark:border-fuchsia-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-fuchsia-950 dark:text-fuchsia-200 border border-fuchsia-300/80 dark:border-fuchsia-700',
        bgClass: 'bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/50',
        badgeClass: 'bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-400/60 shadow-sm shadow-fuchsia-500/20',
        textClass: 'text-fuchsia-300',
        borderClass: 'border-fuchsia-500',
        hexPreview: '#c026d3'
    },
    orange: {
        label: 'Cam tươi rực rỡ',
        cardBadge: 'bg-orange-100 text-orange-950 border-orange-300 dark:bg-orange-950/70 dark:text-orange-200 dark:border-orange-700 shadow-xs',
        cardPill: 'bg-white/90 dark:bg-black/40 text-orange-950 dark:text-orange-200 border border-orange-300/80 dark:border-orange-700',
        bgClass: 'bg-orange-500/25 text-orange-300 border-orange-500/50',
        badgeClass: 'bg-orange-500/30 text-orange-200 border-orange-400/60 shadow-sm shadow-orange-500/20',
        textClass: 'text-orange-300',
        borderClass: 'border-orange-500',
        hexPreview: '#ea580c'
    }
}

export const STAMP_CATEGORIES: Record<string, { 
    label: string
    line: 'line1' | 'line2'
    position: string
    length: string
    description: string
    colorBadge: string
}> = {
    special_12: { 
        label: 'Quy cách ngoại lệ (12 số đầu)', 
        line: 'line1', 
        position: '12 ký tự đầu', 
        length: '12 ký tự', 
        description: 'Bảng mã quy cách đặc biệt / ngoại lệ ưu tiên giải mã trọn gói tên & quy cách sản phẩm',
        colorBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    },
    fruit_type: { 
        label: 'Chủng loại trái cây', 
        line: 'line1', 
        position: 'Ký tự 1', 
        length: '1 ký tự', 
        description: 'Loại trái cây thành phẩm cấp đông (Sầu riêng, Mít, Dưa hấu, Nhãn...)',
        colorBadge: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
    },
    freeze_style: { 
        label: 'Hình thức cấp đông', 
        line: 'line1', 
        position: 'Ký tự 2, 3', 
        length: '2 ký tự', 
        description: 'Nguyên trái, múi, cắt lát...',
        colorBadge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    },
    variety: { 
        label: 'Giống trái cây', 
        line: 'line1', 
        position: 'Ký tự 4, 5', 
        length: '2 ký tự', 
        description: 'Monthong (Dona), Ri-6, Musang King...',
        colorBadge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    },
    product_grade: { 
        label: 'Phân loại thành phẩm', 
        line: 'line1', 
        position: 'Ký tự 6, 7', 
        length: '2 ký tự', 
        description: 'Loại VIP, Loại A, Loại B, Loại C...',
        colorBadge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
    },
    package_spec: { 
        label: 'Quy cách đóng gói', 
        line: 'line1', 
        position: 'Ký tự 8, 9', 
        length: '2 ký tự', 
        description: 'Số lượng túi trong 1 thùng (1 túi/thùng, 4 túi/thùng...)',
        colorBadge: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800'
    },
    freeze_method: { 
        label: 'Phương pháp cấp đông', 
        line: 'line1', 
        position: 'Ký tự 10, 11, 12', 
        length: '3 ký tự', 
        description: 'Hầm đông, Nitơ, IQF...',
        colorBadge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800'
    },
    customer_quality: { 
        label: 'Chất lượng theo khách hàng', 
        line: 'line1', 
        position: 'Ký tự 14', 
        length: '1 ký tự', 
        description: 'Không phân chia (0), hoặc theo tiêu chuẩn riêng của từng khách hàng',
        colorBadge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
    },
    factory: { 
        label: 'Mã nhà máy', 
        line: 'line2', 
        position: 'Ký tự 1 (F)', 
        length: '1 ký tự', 
        description: 'Mã định danh nhà máy chế biến (1: Bến Tre, 2: Đắk Lắk...)',
        colorBadge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
    },
    supplier: { 
        label: 'Mã nhà cung cấp', 
        line: 'line2', 
        position: 'Ký tự 12, 13, 14 (XXX)', 
        length: '3 ký tự', 
        description: 'Mã hóa nhà cung cấp nguyên liệu theo danh sách được duyệt (001, 002, 047...)',
        colorBadge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800'
    },
    province: { 
        label: 'Vùng nguyên liệu (Tỉnh)', 
        line: 'line2', 
        position: 'Ký tự 15, 16 (ZZ)', 
        length: '2 ký tự', 
        description: 'Mã hóa các đơn vị hành chính cấp tỉnh (66: Đắk Lắk, 83: Bến Tre...)',
        colorBadge: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
    }
}

