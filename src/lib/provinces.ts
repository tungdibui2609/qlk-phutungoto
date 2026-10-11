export interface Province {
    code: string // Mã hành chính 2 chữ số (ZZ)
    name: string // Tên tỉnh thành (VD: 'Tỉnh Đắk Lắk', 'Tỉnh Bến Tre')
    shortName: string // Tên gọn (VD: 'Đắk Lắk', 'Bến Tre')
}

// Bảng 5.1.1. Mã hóa vùng nguyên liệu theo danh mục mã số các đơn vị hành chính cấp tỉnh (ZZ)
// Tài liệu: THỦ TỤC TRUY XUẤT NGUỒN GỐC SẢN PHẨM - CHÁNH THU (25 tỉnh thành)
export const VIETNAM_PROVINCES: Province[] = [
    { code: '54', name: 'Tỉnh Phú Yên', shortName: 'Phú Yên' },
    { code: '56', name: 'Tỉnh Khánh Hòa', shortName: 'Khánh Hòa' },
    { code: '58', name: 'Tỉnh Ninh Thuận', shortName: 'Ninh Thuận' },
    { code: '60', name: 'Tỉnh Bình Thuận', shortName: 'Bình Thuận' },
    { code: '62', name: 'Tỉnh Kon Tum', shortName: 'Kon Tum' },
    { code: '64', name: 'Tỉnh Gia Lai', shortName: 'Gia Lai' },
    { code: '66', name: 'Tỉnh Đắk Lắk', shortName: 'Đắk Lắk' },
    { code: '67', name: 'Tỉnh Đắk Nông', shortName: 'Đắk Nông' },
    { code: '68', name: 'Tỉnh Lâm Đồng', shortName: 'Lâm Đồng' },
    { code: '70', name: 'Tỉnh Bình Phước', shortName: 'Bình Phước' },
    { code: '72', name: 'Tỉnh Tây Ninh', shortName: 'Tây Ninh' },
    { code: '74', name: 'Tỉnh Bình Dương', shortName: 'Bình Dương' },
    { code: '75', name: 'Tỉnh Đồng Nai', shortName: 'Đồng Nai' },
    { code: '77', name: 'Tỉnh Bà Rịa – Vũng Tàu', shortName: 'Bà Rịa – Vũng Tàu' },
    { code: '80', name: 'Tỉnh Long An', shortName: 'Long An' },
    { code: '82', name: 'Tỉnh Tiền Giang', shortName: 'Tiền Giang' },
    { code: '83', name: 'Tỉnh Bến Tre', shortName: 'Bến Tre' },
    { code: '84', name: 'Tỉnh Trà Vinh', shortName: 'Trà Vinh' },
    { code: '86', name: 'Tỉnh Vĩnh Long', shortName: 'Vĩnh Long' },
    { code: '87', name: 'Tỉnh Đồng Tháp', shortName: 'Đồng Tháp' },
    { code: '89', name: 'Tỉnh An Giang', shortName: 'An Giang' },
    { code: '91', name: 'Tỉnh Kiên Giang', shortName: 'Kiên Giang' },
    { code: '92', name: 'Thành phố Cần Thơ', shortName: 'Cần Thơ' },
    { code: '93', name: 'Tỉnh Hậu Giang', shortName: 'Hậu Giang' },
    { code: '94', name: 'Tỉnh Sóc Trăng', shortName: 'Sóc Trăng' }
]

/**
 * Tìm tỉnh theo tên hoặc mã
 */
export function findProvince(query: string): Province | undefined {
    if (!query) return undefined
    const q = query.trim().toLowerCase()
    
    // Tìm theo mã trước (vd: '66', '83', '82')
    const byCode = VIETNAM_PROVINCES.find(p => p.code === q)
    if (byCode) return byCode

    // Tìm theo tên chính xác hoặc chứa tên
    const byName = VIETNAM_PROVINCES.find(p => 
        p.name.toLowerCase() === q || 
        p.shortName.toLowerCase() === q ||
        q.includes(p.shortName.toLowerCase()) ||
        p.shortName.toLowerCase().includes(q)
    )
    return byName
}

/**
 * Lấy mã hành chính của tỉnh
 */
export function getProvinceCode(provinceNameOrCode: string): string | null {
    const p = findProvince(provinceNameOrCode)
    return p ? p.code : null
}
