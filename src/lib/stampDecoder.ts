// Hệ thống giải mã chuẩn quy tắc tem dập mực Chánh Thu
// Hỗ trợ giải mã 12 trường thông tin từ Dòng 1 & Dòng 2

export const DEFAULT_STAMP_DICT: Record<string, Record<string, string>> = {
    fruit_type: {
        '1': 'TP cấp đông sầu riêng',
        '2': 'Sầu riêng tươi',
        '3': 'Xoài cấp đông'
    },
    freeze_style: {
        '01': 'Cấp đông nguyên trái',
        '02': 'Cấp đông múi',
        '03': 'Cấp đông nguyên quả hút chân không',
        '04': 'Cắt hạt lựu'
    },
    variety: {
        '01': 'Monthong (Dona)',
        '02': 'Ri-6',
        '03': 'Musang King',
        '04': 'Black Thorn'
    },
    product_grade: {
        '01': 'Loại VIP',
        '02': 'Loại A',
        '03': 'Loại B',
        '04': 'Loại C'
    },
    package_spec: {
        '01': '1 Túi/ thùng',
        '02': '2 Túi/ thùng',
        '04': '4 Túi/ thùng',
        '08': '8 Túi/ thùng'
    },
    freeze_method: {
        '001': 'Hầm đông',
        '002': 'Nitơ',
        '003': 'IQF',
        '040': 'Hầm đông (040)'
    },
    customer_quality: {
        '0': 'Không phân chia',
        '1': 'Tiêu chuẩn khách hàng 1',
        '2': 'Tiêu chuẩn khách hàng 2'
    },
    factory: {
        '1': 'Nhà máy Bến Tre',
        '2': 'Nhà máy Đắk Lắk',
        '3': 'Cơ sở Phước An'
    },
    province: {
        '66': 'Đắk Lắk',
        '71': 'Bến Tre',
        '67': 'Đắk Nông',
        '68': 'Lâm Đồng',
        '64': 'Gia Lai',
        '09': 'Tỉnh mã 09',
        '63': 'Tiền Giang'
    }
}

export interface DecodedStampInfo {
    isStamp: boolean
    stampLine1: string
    stampLine2: string
    code: string
    // Dòng 1
    fruitTypeCode: string
    fruitTypeName: string
    freezeStyleCode: string
    freezeStyleName: string
    varietyCode: string
    varietyName: string
    productGradeCode: string
    productGradeName: string
    packageSpecCode: string
    packageSpecName: string
    freezeMethodCode: string
    freezeMethodName: string
    customerQualityCode: string
    customerQualityName: string
    // Dòng 2
    factoryCode: string
    factoryName: string
    packagingDateStr: string // DD/MM
    packagingDateComparable: string | null // YYYY-MM-DD
    rawMaterialDateStr: string // DD/MM/YYYY
    rawMaterialDateComparable: string | null // YYYY-MM-DD
    supplierCode: string
    supplierName: string
    provinceCode: string
    provinceName: string
    // Mở rộng
    palletStt: string
    productTitle: string
    shiftGroup: string
    spec: string
    searchableTokens: string[]
}

// Chuyển đổi định dạng ngày (DD/MM, DD/MM/YYYY, YYYY-MM-DD, DDMMYY, DDMM) thành YYYY-MM-DD
export function parseDateToComparable(val: string | null | undefined): string | null {
    if (!val) return null
    const s = String(val).trim()
    if (!s || s === '---') return null

    // 1. ISO hoặc YYYY-MM-DD
    const ymdMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (ymdMatch) {
        return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`
    }

    // 2. DD/MM/YYYY hoặc DD-MM-YYYY
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`
    }

    // 3. DD/MM (ghép với năm hiện tại)
    const dmMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
    if (dmMatch) {
        const currentYear = new Date().getFullYear()
        return `${currentYear}-${dmMatch[2].padStart(2, '0')}-${dmMatch[1].padStart(2, '0')}`
    }

    // 4. 6 chữ số liền nhau DDMMYY (ví dụ: 260014 hoặc 080926 -> 2026-09-08)
    if (/^\d{6}$/.test(s)) {
        const year = `20${s.substring(4, 6)}`
        const month = s.substring(2, 4)
        const day = s.substring(0, 2)
        // Kiểm tra hợp lệ tháng (01-12)
        const mNum = parseInt(month, 10)
        if (mNum >= 1 && mNum <= 12) {
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        }
        return `${year}-${month}-${day}`
    }

    // 5. 4 chữ số liền nhau DDMM (ví dụ: 1109 -> 2026-09-11)
    if (/^\d{4}$/.test(s)) {
        const currentYear = new Date().getFullYear()
        const month = s.substring(2, 4)
        const day = s.substring(0, 2)
        return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    return null
}

/**
 * Giải mã toàn diện con tem / thùng hàng theo cấu trúc chuẩn 12 trường
 */
export function decodeStampBox(box: any, dictMap?: Record<string, Record<string, string>>): DecodedStampInfo {
    const dict = dictMap || DEFAULT_STAMP_DICT
    const meta = box.metadata || {}
    const code = box.code || ''

    let stampLine1 = meta.stamp_line1 || ''
    let stampLine2 = meta.stamp_line2 || box.semi_finished_lot_code || box.finished_lot_code || ''

    if (!stampLine1 && code.startsWith('STAMP-')) {
        const parts = code.split('-')
        if (parts.length >= 3) {
            stampLine1 = parts[1] || ''
            stampLine2 = parts[2] || ''
        }
    }

    const isStamp = meta.scan_type === 'stamp' || !!meta.stamp_line1 || code.startsWith('STAMP-')

    // 1. Phân tích Dòng 1 (13-14 số)
    // Cấu trúc mặc định:
    // [0]: Fruit Type (1 số)
    // [1-2]: Freeze Style (2 số)
    // [3-4]: Variety (2 số)
    // [5-6]: Product Grade (2 số)
    // [7-8]: Package Spec (2 số)
    // [9-11]: Freeze Method (3 số)
    // [12/sau dấu -]: Customer Quality (1 số)
    const cleanL1 = (stampLine1 || '').trim().replace(/[^0-9\-]/g, '')
    const digitsOnlyL1 = cleanL1.replace(/[^0-9]/g, '')

    let fruitTypeCode = ''
    let freezeStyleCode = ''
    let varietyCode = ''
    let productGradeCode = ''
    let packageSpecCode = ''
    let freezeMethodCode = ''
    let customerQualityCode = ''

    if (digitsOnlyL1.length >= 1) fruitTypeCode = digitsOnlyL1.substring(0, 1)
    if (digitsOnlyL1.length >= 3) freezeStyleCode = digitsOnlyL1.substring(1, 3)
    if (digitsOnlyL1.length >= 5) varietyCode = digitsOnlyL1.substring(3, 5)
    if (digitsOnlyL1.length >= 7) productGradeCode = digitsOnlyL1.substring(5, 7)
    if (digitsOnlyL1.length >= 9) packageSpecCode = digitsOnlyL1.substring(7, 9)
    if (digitsOnlyL1.length >= 12) freezeMethodCode = digitsOnlyL1.substring(9, 12)
    
    if (cleanL1.includes('-')) {
        const parts = cleanL1.split('-')
        customerQualityCode = parts[parts.length - 1] || ''
    } else if (digitsOnlyL1.length >= 13) {
        customerQualityCode = digitsOnlyL1.substring(12, 13)
    }

    // 2. Phân tích Dòng 2 (16 số)
    // Cấu trúc mặc định:
    // [0]: Factory (1 số)
    // [1-4]: Packaging Date (4 số - DDMM)
    // [5-10]: Raw Material Date (6 số - DDMMYY)
    // [11-13]: Supplier (3 số)
    // [14-15]: Province / Region (2 số)
    const digitsOnlyL2 = (stampLine2 || '').trim().replace(/[^0-9]/g, '')

    let factoryCode = ''
    let rawPkgDate = ''
    let rawMatDate = ''
    let supplierCode = ''
    let provinceCode = ''

    if (digitsOnlyL2.length >= 1) factoryCode = digitsOnlyL2.substring(0, 1)
    if (digitsOnlyL2.length >= 5) rawPkgDate = digitsOnlyL2.substring(1, 5)
    if (digitsOnlyL2.length >= 11) rawMatDate = digitsOnlyL2.substring(5, 11)
    if (digitsOnlyL2.length >= 14) supplierCode = digitsOnlyL2.substring(11, 14)
    if (digitsOnlyL2.length >= 16) provinceCode = digitsOnlyL2.substring(14, 16)

    // Lookup names from dictionaries
    const fruitTypeName = dict.fruit_type?.[fruitTypeCode] || DEFAULT_STAMP_DICT.fruit_type[fruitTypeCode] || (fruitTypeCode ? `Mã ${fruitTypeCode}` : '')
    const freezeStyleName = dict.freeze_style?.[freezeStyleCode] || DEFAULT_STAMP_DICT.freeze_style[freezeStyleCode] || (freezeStyleCode ? `Mã ${freezeStyleCode}` : '')
    const varietyName = dict.variety?.[varietyCode] || DEFAULT_STAMP_DICT.variety[varietyCode] || (varietyCode ? `Mã ${varietyCode}` : '')
    const productGradeName = dict.product_grade?.[productGradeCode] || DEFAULT_STAMP_DICT.product_grade[productGradeCode] || (productGradeCode ? `Mã ${productGradeCode}` : '')
    const packageSpecName = dict.package_spec?.[packageSpecCode] || DEFAULT_STAMP_DICT.package_spec[packageSpecCode] || meta.spec || (packageSpecCode ? `Mã ${packageSpecCode}` : '')
    const freezeMethodName = dict.freeze_method?.[freezeMethodCode] || DEFAULT_STAMP_DICT.freeze_method[freezeMethodCode] || (freezeMethodCode ? `Mã ${freezeMethodCode}` : '')
    const customerQualityName = dict.customer_quality?.[customerQualityCode] || DEFAULT_STAMP_DICT.customer_quality[customerQualityCode] || (customerQualityCode ? `Mã ${customerQualityCode}` : '')

    // Factory fallback: check meta.shift_group
    let factoryName = dict.factory?.[factoryCode] || DEFAULT_STAMP_DICT.factory[factoryCode] || ''
    if (!factoryName && meta.shift_group) {
        factoryName = meta.shift_group
        if (factoryName.includes('Bến Tre')) factoryCode = '1'
        else if (factoryName.includes('Đắk Lắk')) factoryCode = '2'
        else if (factoryName.includes('Phước An')) factoryCode = '3'
    } else if (factoryName && !factoryCode) {
        if (factoryName.includes('Bến Tre')) factoryCode = '1'
        else if (factoryName.includes('Đắk Lắk')) factoryCode = '2'
        else if (factoryName.includes('Phước An')) factoryCode = '3'
    }

    // Packaging date (DD/MM)
    let packagingDateStr = meta.packaging_date || meta.pkg_date || ''
    if (!packagingDateStr && rawPkgDate.length === 4) {
        packagingDateStr = `${rawPkgDate.substring(0, 2)}/${rawPkgDate.substring(2, 4)}`
    }
    const packagingDateComparable = parseDateToComparable(packagingDateStr || rawPkgDate)

    // Raw material date (DD/MM/YYYY)
    let rawMaterialDateStr = meta.raw_material_date || meta.production_date || ''
    if (!rawMaterialDateStr && rawMatDate.length === 6) {
        rawMaterialDateStr = `${rawMatDate.substring(0, 2)}/${rawMatDate.substring(2, 4)}/20${rawMatDate.substring(4, 6)}`
    }
    const rawMaterialDateComparable = parseDateToComparable(rawMaterialDateStr || rawMatDate)

    // Supplier
    const supplierName = dict.supplier?.[supplierCode] || (supplierCode ? `NCC ${supplierCode}` : '')

    // Province / Region
    let provinceName = dict.province?.[provinceCode] || DEFAULT_STAMP_DICT.province[provinceCode] || ''
    if (!provinceName && meta.region) {
        provinceName = meta.region
        if (provinceName.includes('66') || provinceName.toLowerCase().includes('đắk lắk')) provinceCode = '66'
        else if (provinceName.includes('71') || provinceName.toLowerCase().includes('bến tre')) provinceCode = '71'
        else if (provinceName.includes('09')) provinceCode = '09'
    }

    const palletStt = meta.pallet_stt || ''
    const productTitle = meta.product_name || box.products?.name || [fruitTypeName, varietyName, productGradeName].filter(Boolean).join(' ') || ''
    const shiftGroup = meta.shift_group || factoryName || ''
    const spec = meta.spec || packageSpecName || ''

    // Collect all tokens for robust fuzzy matching
    const tokens = new Set<string>()
    const addToken = (v: any) => {
        if (!v) return
        const str = String(v).trim().toLowerCase()
        if (str && str !== '---' && str !== '?') {
            tokens.add(str)
            // Thêm các từ riêng lẻ
            str.split(/\s+/).forEach(w => { if (w.length > 1) tokens.add(w) })
        }
    }

    addToken(code)
    addToken(stampLine1)
    addToken(stampLine2)
    addToken(palletStt)
    addToken(productTitle)
    addToken(fruitTypeCode)
    addToken(fruitTypeName)
    addToken(freezeStyleCode)
    addToken(freezeStyleName)
    addToken(varietyCode)
    addToken(varietyName)
    addToken(productGradeCode)
    addToken(productGradeName)
    addToken(packageSpecCode)
    addToken(packageSpecName)
    addToken(freezeMethodCode)
    addToken(freezeMethodName)
    addToken(customerQualityCode)
    addToken(customerQualityName)
    addToken(factoryCode)
    addToken(factoryName)
    addToken(packagingDateStr)
    addToken(rawMaterialDateStr)
    addToken(supplierCode)
    addToken(supplierName)
    addToken(provinceCode)
    addToken(provinceName)
    addToken(shiftGroup)
    addToken(spec)

    return {
        isStamp,
        stampLine1,
        stampLine2,
        code,
        fruitTypeCode,
        fruitTypeName,
        freezeStyleCode,
        freezeStyleName,
        varietyCode,
        varietyName,
        productGradeCode,
        productGradeName,
        packageSpecCode,
        packageSpecName,
        freezeMethodCode,
        freezeMethodName,
        customerQualityCode,
        customerQualityName,
        factoryCode,
        factoryName,
        packagingDateStr,
        packagingDateComparable,
        rawMaterialDateStr,
        rawMaterialDateComparable,
        supplierCode,
        supplierName,
        provinceCode,
        provinceName,
        palletStt,
        productTitle,
        shiftGroup,
        spec,
        searchableTokens: Array.from(tokens)
    }
}

/**
 * Kiểm tra xem một thùng hàng có khớp với các tiêu chí tìm kiếm chuyên sâu không
 */
export function matchBoxDeepCriteria(
    boxInfo: DecodedStampInfo,
    criteria: {
        term?: string
        dateField?: 'packaging_date' | 'peeling_date' | 'raw_material_date' | 'inbound_date'
        startDate?: string
        endDate?: string
        region?: string
        factory?: string
        grade?: string
        variety?: string
        packageSpec?: string
    }
): boolean {
    const { term, dateField = 'packaging_date', startDate, endDate, region, factory, grade, variety, packageSpec } = criteria

    // 1. Term matching
    if (term && term.trim()) {
        const cleanTerm = term.trim().toLowerCase()
        const matched = boxInfo.searchableTokens.some(t => t.includes(cleanTerm)) ||
            boxInfo.code.toLowerCase().includes(cleanTerm) ||
            boxInfo.stampLine1.toLowerCase().includes(cleanTerm) ||
            boxInfo.stampLine2.toLowerCase().includes(cleanTerm) ||
            boxInfo.palletStt.toLowerCase().includes(cleanTerm) ||
            boxInfo.productTitle.toLowerCase().includes(cleanTerm)

        if (!matched) return false
    }

    // 2. Date range matching
    if (startDate || endDate) {
        let boxDateComparable: string | null = null
        if (dateField === 'packaging_date') {
            boxDateComparable = boxInfo.packagingDateComparable
        } else if (dateField === 'raw_material_date' || dateField === 'peeling_date') {
            boxDateComparable = boxInfo.rawMaterialDateComparable
        } else if (dateField === 'inbound_date') {
            boxDateComparable = boxInfo.packagingDateComparable || boxInfo.rawMaterialDateComparable
        }

        if (!boxDateComparable) return false
        if (startDate && boxDateComparable < startDate) return false
        if (endDate && boxDateComparable > endDate) return false
    }

    // 3. Region / Province matching
    if (region && region !== 'all') {
        const rLower = region.trim().toLowerCase()
        const matchCode = boxInfo.provinceCode && (boxInfo.provinceCode === rLower || boxInfo.provinceCode.endsWith(rLower))
        const matchName = boxInfo.provinceName && boxInfo.provinceName.toLowerCase().includes(rLower)
        const matchL2 = boxInfo.stampLine2 && boxInfo.stampLine2.endsWith(rLower)
        if (!matchCode && !matchName && !matchL2) return false
    }

    // 4. Factory matching
    if (factory && factory !== 'all') {
        const fLower = factory.trim().toLowerCase()
        const matchCode = boxInfo.factoryCode && boxInfo.factoryCode === fLower
        const matchName = boxInfo.factoryName && boxInfo.factoryName.toLowerCase().includes(fLower)
        const matchGroup = boxInfo.shiftGroup && boxInfo.shiftGroup.toLowerCase().includes(fLower)
        const matchL2 = boxInfo.stampLine2 && boxInfo.stampLine2.startsWith(fLower)

        // Hỗ trợ map chữ số 1, 2, 3 với tên nhà máy
        let matchSpecial = false
        if (fLower === '1' && (boxInfo.factoryName.toLowerCase().includes('bến tre') || boxInfo.shiftGroup.toLowerCase().includes('bến tre'))) matchSpecial = true
        if (fLower === '2' && (boxInfo.factoryName.toLowerCase().includes('đắk lắk') || boxInfo.shiftGroup.toLowerCase().includes('đắk lắk'))) matchSpecial = true
        if (fLower === '3' && (boxInfo.factoryName.toLowerCase().includes('phước an') || boxInfo.shiftGroup.toLowerCase().includes('phước an'))) matchSpecial = true

        if (!matchCode && !matchName && !matchGroup && !matchL2 && !matchSpecial) return false
    }

    // 5. Product Grade matching
    if (grade && grade !== 'all') {
        const gLower = grade.trim().toLowerCase()
        const matchCode = boxInfo.productGradeCode && boxInfo.productGradeCode === gLower
        const matchName = boxInfo.productGradeName && boxInfo.productGradeName.toLowerCase().includes(gLower)
        const matchTitle = boxInfo.productTitle && boxInfo.productTitle.toLowerCase().includes(gLower)

        let matchSpecial = false
        if (gLower.includes('vip') && (boxInfo.productGradeCode === '01' || boxInfo.productTitle.toLowerCase().includes('vip'))) matchSpecial = true
        if (gLower === 'loại a' && (boxInfo.productGradeCode === '02' || boxInfo.productTitle.toLowerCase().includes('loại a'))) matchSpecial = true
        if (gLower === 'loại b' && (boxInfo.productGradeCode === '03' || boxInfo.productTitle.toLowerCase().includes('loại b'))) matchSpecial = true
        if (gLower === 'loại c' && (boxInfo.productGradeCode === '04' || boxInfo.productTitle.toLowerCase().includes('loại c'))) matchSpecial = true

        if (!matchCode && !matchName && !matchTitle && !matchSpecial) return false
    }

    // 6. Variety matching
    if (variety && variety !== 'all') {
        const vLower = variety.trim().toLowerCase()
        const matchCode = boxInfo.varietyCode && boxInfo.varietyCode === vLower
        const matchName = boxInfo.varietyName && boxInfo.varietyName.toLowerCase().includes(vLower)
        const matchTitle = boxInfo.productTitle && boxInfo.productTitle.toLowerCase().includes(vLower)

        let matchSpecial = false
        if ((vLower.includes('monthong') || vLower.includes('dona')) && (boxInfo.varietyCode === '01' || boxInfo.productTitle.toLowerCase().includes('monthong') || boxInfo.productTitle.toLowerCase().includes('dona'))) matchSpecial = true
        if ((vLower.includes('ri-6') || vLower.includes('ri6')) && (boxInfo.varietyCode === '02' || boxInfo.productTitle.toLowerCase().includes('ri-6') || boxInfo.productTitle.toLowerCase().includes('ri6'))) matchSpecial = true
        if (vLower.includes('musang') && (boxInfo.varietyCode === '03' || boxInfo.productTitle.toLowerCase().includes('musang'))) matchSpecial = true
        if (vLower.includes('thorn') && (boxInfo.varietyCode === '04' || boxInfo.productTitle.toLowerCase().includes('thorn'))) matchSpecial = true

        if (!matchCode && !matchName && !matchTitle && !matchSpecial) return false
    }

    // 7. Package Spec matching
    if (packageSpec && packageSpec !== 'all') {
        const sLower = packageSpec.trim().toLowerCase()
        const matchCode = boxInfo.packageSpecCode && boxInfo.packageSpecCode === sLower
        const matchName = boxInfo.packageSpecName && boxInfo.packageSpecName.toLowerCase().includes(sLower)
        const matchSpec = boxInfo.spec && boxInfo.spec.toLowerCase().includes(sLower)

        let matchSpecial = false
        if (sLower.includes('1 túi') && (boxInfo.packageSpecCode === '01' || boxInfo.spec.toLowerCase().includes('1 túi'))) matchSpecial = true
        if (sLower.includes('2 túi') && (boxInfo.packageSpecCode === '02' || boxInfo.spec.toLowerCase().includes('2 túi'))) matchSpecial = true
        if (sLower.includes('4 túi') && (boxInfo.packageSpecCode === '04' || boxInfo.spec.toLowerCase().includes('4 túi'))) matchSpecial = true
        if (sLower.includes('8 túi') && (boxInfo.packageSpecCode === '08' || boxInfo.spec.toLowerCase().includes('8 túi'))) matchSpecial = true

        if (!matchCode && !matchName && !matchSpec && !matchSpecial) return false
    }

    return true
}
