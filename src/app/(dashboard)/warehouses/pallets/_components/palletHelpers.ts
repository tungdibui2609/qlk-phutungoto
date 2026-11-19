import { supabase } from '@/lib/supabaseClient'
import { normalizeSearchString } from '@/lib/searchUtils'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { parseDateToISO, validateAndFormatDate } from '@/lib/dateUtils'
import { DEFAULT_STAMP_DICT } from '@/lib/stampDecoder'
import { decodeSTT } from '@/lib/numberUtils'
import type { BoxLabelItem, PalletLot, WarehouseProduct, ApproveLotProductLine } from './types'

/**
 * Tự động giải mã lại toàn bộ thông tin con dấu:
 * - Dòng 1 (stamp_line1): Giải mã Mã quy cách / SKU, tên sản phẩm ngoại lệ (12 số), đặc tính (có hạt/không hạt, giống, loại...).
 * - Dòng 2 (stamp_line2): Giải mã vùng nguyên liệu (tỉnh), nhà máy (tổ), ngày đóng gói, ngày nguyên liệu.
 * Đảm bảo đồng bộ và ghi đè triệt để thông tin cũ khi người dùng chỉnh sửa Dòng 1 hoặc Dòng 2.
 */
export function applyStampDecodeToMeta(meta: Record<string, any>): Record<string, any> {
    const next: Record<string, any> = { ...meta, scan_type: 'stamp' }

    // 1. GIẢI MÃ DÒNG 1 (MÃ QUY CÁCH / SKU / TÊN SẢN PHẨM / ĐẶC TÍNH)
    if (meta.stamp_line1) {
        const cleanL1 = String(meta.stamp_line1).trim()
        const l1Digits = cleanL1.replace(/\D/g, '')

        if (l1Digits.length >= 12) {
            const spec12 = l1Digits.substring(0, 12)
            const matchName = DEFAULT_STAMP_DICT.special_12?.[spec12]
            next.sku = spec12
            if (matchName) {
                next.product_name = matchName
                next.special_12_code = spec12
                next.special_12_name = matchName
                const nameParts = matchName.split(' - ').map((s: string) => s.trim())
                if (nameParts.length >= 2) {
                    next.spec = nameParts.slice(1).join(' - ')
                }
            } else {
                // Phân rã theo từ điển mặc định
                const fruitCode = l1Digits.substring(0, 1)
                const styleCode = l1Digits.substring(1, 3)
                const varCode = l1Digits.substring(3, 5)
                const gradeCode = l1Digits.substring(5, 7)
                const specCode = l1Digits.substring(7, 9)
                const methodCode = l1Digits.substring(9, 12)

                const fruitName = DEFAULT_STAMP_DICT.fruit_type?.[fruitCode] || ''
                const styleName = DEFAULT_STAMP_DICT.freeze_style?.[styleCode] || ''
                const varName = DEFAULT_STAMP_DICT.variety?.[varCode] || ''
                const gradeName = DEFAULT_STAMP_DICT.product_grade?.[gradeCode] || ''
                const specName = DEFAULT_STAMP_DICT.package_spec?.[specCode] || ''
                const methodName = DEFAULT_STAMP_DICT.freeze_method?.[methodCode] || ''

                const title = [fruitName, styleName, varName, gradeName].filter(Boolean).join(' ')
                if (title) next.product_name = title
                if (specName || methodName) next.spec = [specName, methodName].filter(Boolean).join(' - ')
            }
        }
    }

    // 2. GIẢI MÃ DÒNG 2 (NHÀ MÁY / NGÀY THÁNG / NHÀ CUNG CẤP / VÙNG NGUYÊN LIỆU)
    const l2Digits = String(meta.stamp_line2 || '').replace(/\D/g, '')

    if (l2Digits.length >= 1) {
        const fCode = l2Digits.substring(0, 1)
        const fName = DEFAULT_STAMP_DICT.factory?.[fCode] || `Nhà máy ${fCode}`
        next.shift_group = fName
        next.production_place = fName
        next.factory = fName
    }
    if (l2Digits.length >= 5) {
        const dd = l2Digits.substring(1, 3)
        const mm = l2Digits.substring(3, 5)
        const pkg = cleanDateForDB(`${dd}/${mm}`)
        if (pkg) next.packaging_date = pkg
    }
    if (l2Digits.length >= 11) {
        const dd = l2Digits.substring(5, 7)
        const mm = l2Digits.substring(7, 9)
        const yy = l2Digits.substring(9, 11)
        let raw = cleanDateForDB(`${dd}/${mm}/20${yy}`)
        // Nếu vị trí 5..11 không ra ngày hợp lệ (do OCR đọc thừa số) và chuỗi đủ dài, thử vị trí 6..12
        if (!raw && l2Digits.length >= 12) {
            const altDd = l2Digits.substring(6, 8)
            const altMm = l2Digits.substring(8, 10)
            const altYy = l2Digits.substring(10, 12)
            raw = cleanDateForDB(`${altDd}/${altMm}/20${altYy}`)
        }
        if (raw) next.raw_material_date = raw
    }
    if (l2Digits.length >= 14) {
        const sCode = l2Digits.substring(11, 14)
        next.supplier = sCode
        next.supplier_code = sCode

        // Lấy 2 số đuôi của Dòng 2 (vị trí 14..15 hoặc 2 số cuối cùng)
        const pCode = l2Digits.length >= 16 ? l2Digits.substring(14, 16) : l2Digits.slice(-2)
        const pName = DEFAULT_STAMP_DICT.province?.[pCode] || `Tỉnh mã ${pCode}`
        next.region = pName
        next.province = pName
        next.province_code = pCode
        next.material_zone = pName
        next.material_zones = [pName]
    }
    return next
}

/**
 * Tự động đồng bộ/sửa lỗi metadata trong DB cho các thùng dấu mực có thông tin vùng/ngày bị lệch so với Dòng 2 hiện tại.
 */
export async function healStampBoxesInDB(boxes: BoxLabelItem[]) {
    const fixes: { id: string; metadata: Record<string, any> }[] = []
    for (const b of boxes) {
        const m = b.metadata || {}
        const isStamp = m.scan_type === 'stamp' || !!m.stamp_line1 || !!m.stamp_line2 || b.code?.startsWith('STAMP-')
        if (!isStamp || (!m.stamp_line1 && !m.stamp_line2)) continue
        const healed = applyStampDecodeToMeta(m)
        if (
            healed.region !== m.region || 
            healed.province !== m.province || 
            healed.material_zone !== m.material_zone || 
            healed.shift_group !== m.shift_group || 
            healed.raw_material_date !== m.raw_material_date || 
            healed.packaging_date !== m.packaging_date ||
            healed.product_name !== m.product_name ||
            healed.sku !== m.sku ||
            healed.spec !== m.spec
        ) {
            fixes.push({ id: b.id, metadata: healed })
            b.metadata = healed
        }
    }
    for (let i = 0; i < fixes.length; i += 15) {
        await Promise.all(fixes.slice(i, i + 15).map(f =>
            (supabase.from('box_labels') as any).update({ metadata: f.metadata }).eq('id', f.id)
        ))
    }
}

/**
 * Chuẩn hóa chuỗi ngày quét từ thùng (VD: "15/10", "15/10/2026", "2026-10-15") về định dạng ISO YYYY-MM-DD hợp lệ cho cột DATE của PostgreSQL
 * Tự động loại bỏ và validate triệt để ngày tháng sai phạm vi (tránh crash DB với mã lỗi out of range).
 */
export function cleanDateForDB(dateStr?: string | null): string | null {
    if (!dateStr || typeof dateStr !== 'string') return null
    const trimmed = dateStr.trim()
    if (!trimmed) return null

    const iso = parseDateToISO(trimmed)
    if (iso) return iso

    // Hỗ trợ dạng con tem ghi DD/MM hoặc DD-MM (VD: "15/10" -> gán năm hiện tại)
    const dmMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
    if (dmMatch) {
        const [, dStr, mStr] = dmMatch
        const currentYear = new Date().getFullYear()
        return validateAndFormatDate(currentYear, parseInt(mStr, 10), parseInt(dStr, 10))
    }

    return null
}

/**
 * Trích xuất Ngày đóng gói từ thùng:
 * - Tem nhãn: lấy từ packaging_date
 * - Con dấu: lấy từ Dòng 2 ký tự 1..4 (DDMM)
 */
export function extractPackagingDate(box: BoxLabelItem): string | null {
    const meta = box.metadata || {}
    if (meta.packaging_date) {
        const d = cleanDateForDB(meta.packaging_date)
        if (d) return d
    }
    if (meta.stamp_line2) {
        const cleanL2 = String(meta.stamp_line2).replace(/\D/g, '')
        if (cleanL2.length >= 5) {
            const dd = cleanL2.substring(1, 3)
            const mm = cleanL2.substring(3, 5)
            return cleanDateForDB(`${dd}/${mm}`)
        }
    }
    return null
}

/**
 * Trích xuất Ngày sản xuất từ thùng:
 * - Tem nhãn: lấy từ production_date hoặc peeling_date
 * - Con dấu: KHÔNG có ngày sản xuất -> TUYỆT ĐỐI để trống (null), không tự ý thêm ngày
 */
export function extractProductionDate(box: BoxLabelItem): string | null {
    const meta = box.metadata || {}
    const isStamp = meta.scan_type === 'stamp' || !!meta.stamp_line1 || !!meta.stamp_line2 || box.code?.startsWith('STAMP-')
    if (isStamp) {
        return null // Con dấu tuyệt đối không có ngày sản xuất
    }
    if (meta.production_date) {
        return cleanDateForDB(meta.production_date)
    }
    if (meta.peeling_date) {
        return cleanDateForDB(meta.peeling_date)
    }
    return null
}

/**
 * Trích xuất Ngày nhập nguyên liệu từ thùng:
 * - Con dấu: lấy từ Dòng 2 ký tự 5..10 (DDMMYY)
 * - Tem nhãn: KHÔNG có ngày nhập nguyên liệu -> TUYỆT ĐỐI để trống (null), không tự ý thêm ngày
 */
export function extractRawMaterialDate(box: BoxLabelItem): string | null {
    const meta = box.metadata || {}
    const isStamp = meta.scan_type === 'stamp' || !!meta.stamp_line1 || !!meta.stamp_line2 || box.code?.startsWith('STAMP-')
    if (!isStamp && !meta.raw_material_date) {
        return null // Tem nhãn tuyệt đối không có ngày nhập nguyên liệu
    }

    if (meta.raw_material_date) {
        const d = cleanDateForDB(meta.raw_material_date)
        if (d) return d
    }
    if (meta.stamp_line2) {
        const cleanL2 = String(meta.stamp_line2).replace(/\D/g, '')
        if (cleanL2.length >= 11) {
            const dd = cleanL2.substring(5, 7)
            const mm = cleanL2.substring(7, 9)
            const yy = cleanL2.substring(9, 11)
            const parsed = cleanDateForDB(`${dd}/${mm}/20${yy}`)
            if (parsed) return parsed

            // Nếu vị trí 5..11 không ra ngày hợp lệ (do OCR đọc thừa số) và chuỗi đủ dài, thử vị trí 6..12
            if (cleanL2.length >= 12) {
                const altDd = cleanL2.substring(6, 8)
                const altMm = cleanL2.substring(8, 10)
                const altYy = cleanL2.substring(10, 12)
                const altParsed = cleanDateForDB(`${altDd}/${altMm}/20${altYy}`)
                if (altParsed) return altParsed
            }
        }
    }
    if (isStamp && meta.inbound_date) {
        return cleanDateForDB(meta.inbound_date)
    }
    return null
}


/**
 * Trích xuất danh sách các đơn vị tính khả dụng cho sản phẩm (kèm hậu tố khối lượng chuẩn, VD: Thùng (20kg), Kg)
 * Đồng bộ 100% với logic cấu hình của màn hình Tạo Lot (LotForm)
 */
export function getAvailableUnitsForProduct(
    product: WarehouseProduct | undefined | null,
    productUnits: any[],
    units: any[],
    defaultBoxWeight: number = 20
): string[] {
    const available = new Set<string>()
    if (!product) {
        available.add('Kg')
        available.add(formatUnitWeight('Thùng', defaultBoxWeight || 20))
        return Array.from(available)
    }

    const baseUnit = product.unit || 'Kg'
    let baseWeight = Number(product.weight_kg) || 0
    const normBase = normalizeUnit(baseUnit)
    if (baseWeight <= 0 && (normBase === 'kg' || normBase === 'kilogram')) {
        baseWeight = 1
    }

    // 1. Thêm Base unit (VD: 'Kg')
    const formattedBaseUnit = formatUnitWeight(baseUnit, baseWeight)
    if (baseUnit) available.add(formattedBaseUnit)

    // 2. Thêm các đơn vị từ bảng product_units đã gán cho sản phẩm này
    const pUnitsOfProduct = productUnits.filter((pu: any) => pu.product_id === product.id)
    pUnitsOfProduct.forEach((pu: any) => {
        const u = units.find((ux: any) => ux.id === pu.unit_id)
        if (u) {
            const normU = normalizeUnit(u.name)
            if (normU === normalizeUnit(baseUnit)) return

            const weight = (pu.conversion_rate || 1) * baseWeight
            const labelStr = formatUnitWeight(u.name, weight)
            available.add(labelStr)
        }
    })

    // 3. Đảm bảo luôn có đơn vị "Thùng" kèm khối lượng thùng thực tế (VD: Thùng (20kg))
    const hasThung = Array.from(available).some(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))
    if (!hasThung) {
        const boxWeight = defaultBoxWeight > 0 ? defaultBoxWeight : 20
        available.add(formatUnitWeight('Thùng', boxWeight))
    }

    return Array.from(available)
}

/**
 * Tạo danh sách tên viết tắt (aliases/acronyms/initials) cho sản phẩm:
 * 1. Kế thừa aliases đã khai báo trong cơ sở dữ liệu
 * 2. Kế thừa internal_name và internal_code
 * 3. Tự động sinh tên viết tắt thông minh từ các chữ cái đầu (VD: Mít đỏ -> md, Dona C -> dnc...)
 */
export function getProductAliases(p: WarehouseProduct): string {
    const list = new Set<string>()

    // 1. Tên viết tắt đã khai báo trong DB
    if (p.aliases) {
        p.aliases
            .split(/[,;\n]/)
            .map(a => a.trim())
            .filter(Boolean)
            .forEach(a => list.add(a))
    }

    // 2. Mã nội bộ & tên nội bộ
    if (p.internal_name && p.internal_name.trim()) list.add(p.internal_name.trim())
    if (p.internal_code && p.internal_code.trim()) list.add(p.internal_code.trim())

    // 3. Tự động sinh viết tắt thông minh từ tên sản phẩm gốc
    if (p.name) {
        const rawName = p.name.trim()

        // Lược bỏ các từ ngữ phổ thông để lấy tên chính
        const cleanName = rawName
            .replace(/\b(sầu riêng|sau rieng|cấp đông|cap dong|nguyên trái|nguyen trai|múi|mui|dạng|dang|loại|loai)\b/gi, '')
            .replace(/[(),/\\-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

        if (cleanName.length >= 2) {
            list.add(cleanName.toLowerCase())
            list.add(normalizeSearchString(cleanName, true))
        }

        // Tách chữ cái đầu của toàn bộ tên (VD: Mít đỏ cấp đông A -> mdcda, md)
        const words = rawName
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(w => w.length > 0)

        if (words.length >= 2) {
            const initials = words.map(w => w[0]).join('').toLowerCase()
            list.add(initials)
            list.add(normalizeSearchString(initials, true))
        }

        // Tách chữ cái đầu từ tên rút gọn (VD: Dona C -> dc, Dona C vụn -> dncv)
        const cleanWords = cleanName
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .split(/\s+/)
            .filter(w => w.length > 0)

        if (cleanWords.length >= 2) {
            const shortInitials = cleanWords.map(w => w[0]).join('').toLowerCase()
            list.add(shortInitials)
            list.add(normalizeSearchString(shortInitials, true))
        }

        // Nếu có dấu / hoặc - tách các phân nhánh (VD: Dona/Monthong C -> dona c, monthong c)
        if (rawName.includes('/') || rawName.includes('-')) {
            const parts = rawName.split(/[\/\-]/).map(pt => pt.trim()).filter(Boolean)
            parts.forEach(pt => {
                const sub = pt.replace(/\b(sầu riêng|cấp đông)\b/gi, '').trim().toLowerCase()
                if (sub.length >= 2) {
                    list.add(sub)
                    list.add(normalizeSearchString(sub, true))
                }
            })
        }
    }

    return Array.from(list).filter(Boolean).join(', ')
}

// Bảng ánh xạ chuẩn xác 100% từ Mã quy cách con dấu 12 số sang Mã SKU sản phẩm thành phẩm trong kho
export const STAMP_CODE_TO_SKU_MAP: Record<string, string> = {
    '102010401001': 'TP101020104.001', // Monthong C Không hạt
    '102010402001': 'TP101020104.002', // Monthong C Có hạt
    '102020401001': 'TP101020204.001', // Ri6 C Có hạt
    '102020402001': 'TP101020204.002', // Ri6 C Tách hạt
    '102010201001': 'TP101020102.01.001', // Monthong A 1 túi Hầm đông
    '102010201002': 'TP101020102.01.002', // Monthong A 1 túi Nito
    '102010201004': 'TP101020102.01.004', // Monthong A 1 túi múi to Hầm đông
    '102010201005': 'TP101020102.01.005', // Monthong A 1 túi múi nhỏ Hầm đông
    '102010204001': 'TP101020102.04.001', // Monthong A 4 túi Hầm đông
    '102010301001': 'TP101020103.01.001', // Monthong B 1 túi Hầm đông
    '102010301002': 'TP101020103.01.002', // Monthong B 1 túi Nito
    '102010301004': 'TP101020103.01.004', // Monthong B 1 túi múi to Hầm đông
    '102010301005': 'TP101020103.01.005', // Monthong B 1 túi múi nhỏ Hầm đông
    '102010304001': 'TP101020103.04.001', // Monthong B 4 túi Hầm đông
    '102020201001': 'TP101020202.01.001', // Ri6 A 1 túi Hầm đông
    '102020204001': 'TP101020202.04.001', // Ri6 A 4 túi Hầm đông
    '102020301001': 'TP101020203.01.001', // Ri6 B 1 túi Hầm đông
    '102020304001': 'TP101020203.04.001', // Ri6 B 4 túi Hầm đông
    '102020701000': 'TP101020207.01.00', // Ri6 khay có hạt
    '101010202002': 'TP1010102.02.002', // Ri6 A Nito
    '101010202004': 'TP1010102.02.004', // Ri6 A Nito thùng tạm
    '101010402004': 'TP1010104.02.004', // Musaking A Nito thùng tạm
    '101010403004': 'TP1010104.03.004', // Musaking B Nito thùng tạm
    '101010102004': 'TP1010101.02.004', // Monthong A Nito thùng tạm
}

export function findBestMatchingProduct(
    boxes: BoxLabelItem[],
    products: WarehouseProduct[],
    configuredStampMap?: Record<string, string>
): { product: WarehouseProduct | null; matchScore: number; matchReason: string } {
    if (!products || products.length === 0 || !boxes || boxes.length === 0) {
        return { product: null, matchScore: 0, matchReason: '' }
    }

    const sampleBox = boxes.find(b => b.metadata?.stamp_line1 || b.metadata?.product_name || b.metadata?.sku) || boxes[0]
    const boxMeta = sampleBox.metadata || {}
    let rawStampL1 = boxMeta.stamp_line1 || ''
    if (!rawStampL1 && sampleBox.code?.startsWith('STAMP-')) {
        const parts = sampleBox.code.split('-')
        if (parts[1]) rawStampL1 = parts[1]
    }

    // ── CẤP 0: ƯU TIÊN TUYỆT ĐỐI (100% ĐỊNH DANH TRỰC TIẾP TỪ CON DẤU MỰC SANG SKU) ──
    const l1Digits = rawStampL1.replace(/\D/g, '')
    if (l1Digits.length >= 12) {
        const spec12 = l1Digits.substring(0, 12)
        
        // 1. Tra cứu trực tiếp từ Cài đặt quy tắc con dấu (stamp-rules) hoặc bảng chuẩn sẵn có
        const rawTargetSku = configuredStampMap?.[spec12] || STAMP_CODE_TO_SKU_MAP[spec12]
        const targetSku = rawTargetSku ? rawTargetSku.trim() : ''
        if (targetSku) {
            const exactProduct = products.find(p => (p.sku || '').trim() === targetSku)
            if (exactProduct) {
                return {
                    product: exactProduct,
                    matchScore: 9999,
                    matchReason: `Khớp chuẩn xác 100% từ Cài đặt quy tắc con dấu (${spec12}) sang SKU (${exactProduct.sku}) - ${exactProduct.name}`
                }
            }
        }

        // 2. TỰ ĐỘNG & LINH HOẠT: Nếu người dùng thêm sản phẩm mới và nhập mã 12 số vào Mã nội bộ (internal_code), Tên phụ (aliases), hoặc SKU
        const dynamicMatchedProduct = products.find(p => {
            if (p.internal_code && p.internal_code.trim() === spec12) return true
            if (p.aliases) {
                const aliasList = p.aliases.split(',').map((a: string) => a.trim().replace(/\D/g, ''))
                if (aliasList.includes(spec12)) return true
            }
            if (p.sku && p.sku.replace(/\D/g, '').includes(spec12)) return true
            return false
        })

        if (dynamicMatchedProduct) {
            return {
                product: dynamicMatchedProduct,
                matchScore: 9999,
                matchReason: `Khớp tự động 100% từ mã con dấu (${spec12}) qua Mã phụ/Mã nội bộ của sản phẩm (${dynamicMatchedProduct.sku}) - ${dynamicMatchedProduct.name}`
            }
        }
    }

    // NẾU LÀ CON DẤU MỰC: Dòng 1 (stamp_line1) là căn cứ tối cao, giải mã trực tiếp để luôn cập nhật ngay khi vừa sửa Dòng 1
    let rawBoxProductName = ''
    if (rawStampL1) {
        if (l1Digits.length >= 12) {
            const spec12 = l1Digits.substring(0, 12)
            const spec12Name = DEFAULT_STAMP_DICT.special_12?.[spec12]
            if (spec12Name) {
                rawBoxProductName = spec12Name
            }
        }
    }
    if (!rawBoxProductName) {
        rawBoxProductName = boxMeta.product_name || sampleBox.products?.name || ''
    }

    const rawBoxSku = boxMeta.sku || sampleBox.products?.sku || (rawStampL1 ? rawStampL1.replace(/\D/g, '').substring(0, 12) : '')
    const rawSpec = boxMeta.spec || ''

    const cleanStr = (s: string) =>
        s
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()

    // Lược bỏ các phần mở rộng phương thức cấp đông / đóng gói thường gặp ở đuôi tên con dấu ngoại lệ (VD: - Hầm đông, - Nito, - Hàng đóng thùng tạm...)
    const normalizedBoxName = rawBoxProductName
        .replace(/\s*-\s*(hầm đông|ham dong|nito|hàng đóng thùng tạm|hang dong thung tam|đóng thùng tạm|dong thung tam)\s*$/gi, '')
        .replace(/\s*\(\s*\d+\s*túi\s*\)\s*/gi, ' ')
        .trim()

    const cleanBoxName = cleanStr(normalizedBoxName)
    const rawCleanBoxName = cleanStr(rawBoxProductName)
    const cleanBoxSku = cleanStr(rawBoxSku)

    const stampDigits = rawStampL1.replace(/\D/g, '')

    let bestMatch: WarehouseProduct | null = null
    let maxScore = -1
    let bestReason = ''

    for (const p of products) {
        let score = 0
        const reasons: string[] = []
        const cleanPName = cleanStr(p.name || '')
        const cleanPSku = cleanStr(p.sku || '')
        const pSkuDigits = (p.sku || '').replace(/\D/g, '')

        // 0. ƯU TIÊN TUYỆT ĐỐI: Khớp trực tiếp diễn giải tiếng Việt từ Quy tắc ngoại lệ con dấu (Độ khớp 99% - 100%)
        if (cleanBoxName && cleanPName) {
            if (cleanBoxName === cleanPName || rawCleanBoxName === cleanPName) {
                score += 1000
                reasons.push('Khớp 100% tên từ quy tắc ngoại lệ con dấu')
            } else if (cleanBoxName.includes(cleanPName) || cleanPName.includes(cleanBoxName)) {
                score += 500
                reasons.push('Khớp tên từ quy tắc con dấu')
            } else {
                // Kiểm tra tỷ lệ trùng từ quan trọng
                const boxWords = cleanBoxName.split(' ').filter(w => w.length > 1)
                const pWords = cleanPName.split(' ').filter(w => w.length > 1)
                const matchedWords = boxWords.filter(w => pWords.includes(w))
                const overlapRatio = matchedWords.length / Math.max(boxWords.length, pWords.length)
                if (overlapRatio >= 0.75) {
                    score += Math.round(overlapRatio * 300)
                    reasons.push(`Khớp ${Math.round(overlapRatio * 100)}% từ tên con dấu`)
                }
            }
        }

        // 1. Kiểm tra SKU số đóng dấu (ví dụ 102010402001)
        if (stampDigits && pSkuDigits && (stampDigits.includes(pSkuDigits) || pSkuDigits.includes(stampDigits.slice(0, 8)))) {
            score += 50
            reasons.push('Khớp mã số con dấu')
        } else if (cleanBoxSku && cleanPSku && (cleanBoxSku.includes(cleanPSku) || cleanPSku.includes(cleanBoxSku))) {
            score += 40
            reasons.push('Khớp mã SKU')
        }

        // 2. Đặc biệt phân biệt nghiêm ngặt: CÓ HẠT vs KHÔNG HẠT
        const isBoxCoHat = cleanBoxName.includes('co hat') || (cleanBoxName.includes('hat') && !cleanBoxName.includes('khong hat') && !cleanBoxName.includes('bo hat') && !cleanBoxName.includes('tach hat'))
        const isBoxKhongHat = cleanBoxName.includes('khong hat') || cleanBoxName.includes('bo hat') || cleanBoxName.includes('ko hat') || cleanBoxName.includes('tach hat')

        const isPCoHat = cleanPName.includes('co hat') || (cleanPName.includes('hat') && !cleanPName.includes('khong hat') && !cleanPName.includes('bo hat') && !cleanPName.includes('tach hat'))
        const isPKhongHat = cleanPName.includes('khong hat') || cleanPName.includes('bo hat') || cleanPName.includes('ko hat') || cleanPName.includes('tach hat')

        if (isBoxCoHat && isPCoHat) {
            score += 50
            reasons.push('Có hạt')
        } else if (isBoxKhongHat && isPKhongHat) {
            score += 50
            reasons.push('Không hạt')
        } else if ((isBoxCoHat && isPKhongHat) || (isBoxKhongHat && isPCoHat)) {
            score -= 2000 // Phạt cực nặng để TUYỆT ĐỐI không bao giờ khớp Có Hạt sang Không Hạt hoặc ngược lại
        }

        // 3. Phân biệt giống Sầu riêng: Ri6 vs Monthong / Dona
        if (cleanBoxName.includes('ri6') && cleanPName.includes('ri6')) {
            score += 25
            reasons.push('Giống Ri6')
        } else if ((cleanBoxName.includes('monthong') || cleanBoxName.includes('dona')) && (cleanPName.includes('monthong') || cleanPName.includes('dona'))) {
            score += 25
            reasons.push('Giống Monthong/Dona')
        }

        // 4. Khớp phân loại/hạng (A, B, C)
        const grades = ['c', 'b', 'a']
        for (const g of grades) {
            const gradeWord = ` ${g} `
            const boxHasGrade = cleanBoxName.includes(`loai ${g}`) || cleanBoxName.includes(`mui ${g}`) || cleanBoxName.includes(`hang ${g}`) || ` ${cleanBoxName} `.includes(gradeWord) || cleanStr(rawSpec) === g
            const pHasGrade = cleanPName.includes(`loai ${g}`) || cleanPName.includes(`mui ${g}`) || cleanPName.includes(`hang ${g}`) || ` ${cleanPName} `.includes(gradeWord)

            if (boxHasGrade && pHasGrade) {
                score += 20
                reasons.push(`Loại ${g.toUpperCase()}`)
                break
            }
        }

        // 5. Khớp các từ khóa khác (cấp đông, múi, nguyên trái, hầm đông...)
        const keywords = ['cap dong', 'mui', 'nguyen trai', 'sau rieng', 'ham dong']
        for (const kw of keywords) {
            if (cleanBoxName.includes(kw) && cleanPName.includes(kw)) {
                score += 8
            }
        }

        if (score > maxScore) {
            maxScore = score
            bestMatch = p
            bestReason = reasons.join(' · ')
        }
    }

    return {
        product: maxScore > 15 ? bestMatch : (products[0] || null),
        matchScore: maxScore,
        matchReason: bestReason || (bestMatch ? 'Gợi ý từ danh mục' : '')
    }
}


/**
 * Tự động nhận diện và phân loại toàn bộ thùng trong Pallet thành các dòng sản phẩm riêng biệt:
 * Hỗ trợ các Pallet hỗn hợp (mix 2 hoặc nhiều sản phẩm cùng 1 Pallet / LOT).
 */
export function detectPalletProductLines(
    boxes: BoxLabelItem[],
    products: WarehouseProduct[],
    configuredStampMap?: Record<string, string>,
    productUnits: any[] = [],
    units: any[] = []
): ApproveLotProductLine[] {
    if (!boxes || boxes.length === 0 || !products || products.length === 0) {
        return []
    }

    const groupMap = new Map<string, {
        product: WarehouseProduct
        boxes: BoxLabelItem[]
        matchReason: string
        stamp_code?: string
    }>()

    for (const b of boxes) {
        const match = findBestMatchingProduct([b], products, configuredStampMap)
        const targetProd = match.product || products[0]
        if (!targetProd) continue

        const pId = targetProd.id
        if (!groupMap.has(pId)) {
            let spec12 = ''
            const rawStampL1 = b.metadata?.stamp_line1 || (b.code?.startsWith('STAMP-') ? b.code.split('-')[1] : '')
            if (rawStampL1) {
                const digits = rawStampL1.replace(/\D/g, '')
                if (digits.length >= 12) spec12 = digits.substring(0, 12)
            }
            groupMap.set(pId, {
                product: targetProd,
                boxes: [],
                matchReason: match.matchReason,
                stamp_code: spec12 || undefined
            })
        }
        groupMap.get(pId)!.boxes.push(b)
    }

    if (groupMap.size === 0) {
        const defaultProd = products[0]
        const totalW = boxes.reduce((acc, b) => acc + (Number(b.quantity) || 20), 0)
        const availUnits = getAvailableUnitsForProduct(defaultProd, productUnits, units, boxes[0]?.quantity || 20)
        const thungUnit = availUnits.find(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))
        return [{
            id: `line-${Date.now()}-0`,
            product_id: defaultProd.id,
            product: defaultProd,
            quantity: boxes.length,
            weight: Math.round(totalW * 100) / 100,
            unit: thungUnit || availUnits[0] || 'Thùng (20kg)',
            box_ids: boxes.map(b => b.id),
            matchReason: 'Mặc định'
        }]
    }

    const lines: ApproveLotProductLine[] = []
    let index = 0
    groupMap.forEach((val, pId) => {
        const prod = val.product
        const lineBoxes = val.boxes
        const lineWeight = lineBoxes.reduce((acc, b) => acc + (Number(b.quantity) || 20), 0)
        const sampleWeight = lineBoxes.find(b => Number(b.quantity) > 0)?.quantity || (lineBoxes.length > 0 ? lineWeight / lineBoxes.length : 20)
        const availUnits = getAvailableUnitsForProduct(prod, productUnits, units, Number(sampleWeight) || 20)
        const thungUnit = availUnits.find(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))

        lines.push({
            id: `line-${Date.now()}-${index++}`,
            product_id: pId,
            product: prod,
            quantity: lineBoxes.length,
            weight: Math.round(lineWeight * 100) / 100,
            unit: thungUnit || availUnits[0] || 'Thùng (20kg)',
            box_ids: lineBoxes.map(b => b.id),
            stamp_code: val.stamp_code,
            matchReason: val.matchReason
        })
    })

    return lines
}

export function getBoxIndex(box: BoxLabelItem): string {
    if (box.metadata?.box_index !== undefined && box.metadata?.box_index !== null) {
        return String(box.metadata.box_index)
    }
    if (!box.code) return '---'
    const parts = box.code.trim().split('-')
    const last = parts[parts.length - 1]
    return !isNaN(Number(last)) ? last : box.code
}

/**
 * Tự động ghi mã phụ (tag) vào bảng lot_tags cho toàn bộ lot_items của LOT (hoặc cấp lot nếu chưa có lot_items).
 * Bảng lot_tags không có cột company_id nên tuyệt đối không truyền company_id.
 */
export async function syncPalletTagToLot(
    lotId: string,
    rawTag?: string | null,
    preloadedItems?: { id: string | null }[]
): Promise<void> {
    if (!rawTag || !rawTag.trim()) return
    const cleanTag = rawTag.trim().toUpperCase()
    try {
        let itemsToTag = preloadedItems && preloadedItems.length > 0 ? preloadedItems : []
        if (itemsToTag.length === 0) {
            const { data: existingItems } = await supabase
                .from('lot_items')
                .select('id')
                .eq('lot_id', lotId)
            itemsToTag = existingItems || []
        }

        const itemsList = itemsToTag.length > 0 ? itemsToTag : [{ id: null }]

        for (const item of itemsList) {
            let query = supabase
                .from('lot_tags')
                .select('id')
                .eq('lot_id', lotId)
                .eq('tag', cleanTag)
            if (item.id) {
                query = query.eq('lot_item_id', item.id)
            } else {
                query = query.is('lot_item_id', null)
            }
            const { data: existTag } = await query.maybeSingle()

            if (!existTag) {
                await (supabase.from('lot_tags') as any).insert({
                    lot_id: lotId,
                    lot_item_id: item.id || null,
                    tag: cleanTag,
                    added_at: new Date().toISOString()
                })
            }
        }
    } catch (tErr) {
        console.warn('Lỗi ghi lot_tags:', tErr)
    }
}

export async function exportPalletToExcel(pallet: PalletLot): Promise<void> {
    const ExcelJS = (await import('exceljs')).default
    const { saveAs } = (await import('file-saver')).default

    const workbook = new ExcelJS.Workbook()
    const sttStr = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : pallet.code
    const worksheet = workbook.addWorksheet(`Pallet_${sttStr}`)

    worksheet.columns = [
        { header: 'STT Thùng', key: 'stt', width: 12 },
        { header: 'Mã Thùng Barcode', key: 'code', width: 34 },
        { header: 'Mã LOT Thành Phẩm', key: 'lot_code', width: 22 },
        { header: 'Mã Sản Phẩm (SKU)', key: 'sku', width: 20 },
        { header: 'Tên Sản Phẩm', key: 'product_name', width: 32 },
        { header: 'Quy Cách', key: 'spec', width: 16 },
        { header: 'Tổ / Ca Đóng Gói', key: 'shift', width: 18 },
        { header: 'Vùng Nguyên Liệu', key: 'region', width: 18 },
        { header: 'Ngày Đóng Gói', key: 'packaging_date', width: 16 },
        { header: 'Khối Lượng (Kg)', key: 'weight', width: 16 },
    ]

    pallet.box_labels.forEach(box => {
        worksheet.addRow({
            stt: getBoxIndex(box),
            code: box.code,
            lot_code: box.finished_lot_code || box.semi_finished_lot_code || '---',
            sku: box.metadata?.sku || box.products?.sku || '---',
            product_name: box.metadata?.product_name || box.products?.name || '---',
            spec: box.metadata?.spec || '---',
            shift: box.metadata?.shift_group || '---',
            region: box.metadata?.region || '---',
            packaging_date: box.metadata?.packaging_date || '---',
            weight: Number(box.quantity) || 20,
        })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Pallet_${sttStr}_ChiTiet_${new Date().toISOString().slice(0, 10)}.xlsx`)
}


