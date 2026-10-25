'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import {
    Search, RefreshCw, Layers, Trash2, X,
    Package, Loader2, ArrowLeft, Download,
    Edit3, Check, Calendar, MapPin, Users,
    Tag, AlertCircle, FileSpreadsheet, Link2,
    Unlink, CheckCircle2, AlertTriangle, Zap,
    ArrowUpRight, Eye, Sparkles, Clock, Factory,
    Sliders, Plus, LayoutGrid, List
} from 'lucide-react'
import { advancedMatchSearch, normalizeSearchString } from '@/lib/searchUtils'
import { decodeSTT, encodeSTT } from '@/lib/numberUtils'
import { syncDatesFromBoxesToLot } from '@/lib/lotDateSync'
import { Combobox } from '@/components/ui/Combobox'
import { generateUniqueLotCode } from '@/lib/lotCodeGenerator'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { parseDateToISO } from '@/lib/dateUtils'
import { DEFAULT_STAMP_DICT } from '@/lib/stampDecoder'

/**
 * Tự động giải mã lại vùng nguyên liệu (tỉnh), nhà máy (tổ), ngày tháng từ Dòng 2 con dấu.
 * Giúp đồng bộ và ghi đè triệt để các thông tin cũ do OCR đọc sai (ví dụ trước đó Dòng 2 đuôi 88 gán nhầm "Tỉnh mã 88", sau đó sửa lại đuôi 66).
 */
function applyStampDecodeToMeta(meta: Record<string, any>): Record<string, any> {
    const next: Record<string, any> = { ...meta, scan_type: 'stamp' }
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
        const raw = cleanDateForDB(`${dd}/${mm}/20${yy}`)
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
async function healStampBoxesInDB(boxes: BoxLabelItem[]) {
    const fixes: { id: string; metadata: Record<string, any> }[] = []
    for (const b of boxes) {
        const m = b.metadata || {}
        const isStamp = m.scan_type === 'stamp' || !!m.stamp_line2 || b.code?.startsWith('STAMP-')
        if (!isStamp || !m.stamp_line2) continue
        const healed = applyStampDecodeToMeta(m)
        if (
            healed.region !== m.region || 
            healed.province !== m.province || 
            healed.material_zone !== m.material_zone || 
            healed.shift_group !== m.shift_group || 
            healed.raw_material_date !== m.raw_material_date || 
            healed.packaging_date !== m.packaging_date
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
 */
function cleanDateForDB(dateStr?: string | null): string | null {
    if (!dateStr || typeof dateStr !== 'string') return null
    const trimmed = dateStr.trim()
    if (!trimmed) return null

    const iso = parseDateToISO(trimmed)
    if (iso) return iso

    // Hỗ trợ dạng con tem ghi DD/MM hoặc DD-MM (VD: "15/10" -> gán năm hiện tại)
    const dmMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/)
    if (dmMatch) {
        const [, d, m] = dmMatch
        const currentYear = new Date().getFullYear()
        return `${currentYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }

    return null
}

/**
 * Trích xuất Ngày đóng gói từ thùng:
 * - Tem nhãn: lấy từ packaging_date
 * - Con dấu: lấy từ Dòng 2 ký tự 1..4 (DDMM)
 */
function extractPackagingDate(box: BoxLabelItem): string | null {
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
function extractProductionDate(box: BoxLabelItem): string | null {
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
function extractRawMaterialDate(box: BoxLabelItem): string | null {
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
            return cleanDateForDB(`${dd}/${mm}/20${yy}`)
        }
    }
    if (isStamp && meta.inbound_date) {
        return cleanDateForDB(meta.inbound_date)
    }
    return null
}

interface BoxLabelItem {
    id: string
    code: string
    lot_id?: string | null
    quantity: number
    unit: string
    status: string
    semi_finished_lot_code: string | null
    finished_lot_code: string | null
    created_at: string
    metadata?: {
        pallet_stt?: string
        pallet_local_id?: string
        tag?: string | null
        scan_type?: string
        stamp_line1?: string
        stamp_line2?: string
        box_index?: number | string
        sku?: string
        product_name?: string
        spec?: string
        shift_group?: string
        region?: string
        production_date?: string
        packaging_date?: string
        raw_material_date?: string
        [key: string]: any
    } | null
    products: {
        name: string
        sku: string
        internal_name: string | null
    } | null
}

interface PalletLot {
    id: string
    code: string
    daily_seq?: number | null
    status?: string | null
    production_code: string | null
    system_code: string
    company_id: string | null
    created_at: string
    inbound_date: string | null
    quantity: number
    products: { name: string; sku: string } | null
    box_labels: BoxLabelItem[]
}

interface UnlinkedPalletGroup {
    pallet_stt: string
    pallet_tag?: string | null
    pallet_notes?: string | null
    boxes: BoxLabelItem[]
    total_weight: number
    created_at: string
    isConflict?: boolean
    matchedLot?: {
        id: string
        code: string
        daily_seq?: number | null
        product_name?: string
        existingBoxesCount?: number
        existingTotalWeight?: number
    } | null
}

interface WarehouseProduct {
    id: string
    name: string
    sku: string
    unit: string | null
    weight_kg?: number | null
    aliases?: string | null
    internal_name?: string | null
    internal_code?: string | null
}

/**
 * Trích xuất danh sách các đơn vị tính khả dụng cho sản phẩm (kèm hậu tố khối lượng chuẩn, VD: Thùng (20kg), Kg)
 * Đồng bộ 100% với logic cấu hình của màn hình Tạo Lot (LotForm)
 */
function getAvailableUnitsForProduct(
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
function getProductAliases(p: WarehouseProduct): string {
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

function findBestMatchingProduct(
    boxes: BoxLabelItem[],
    products: WarehouseProduct[]
): { product: WarehouseProduct | null; matchScore: number; matchReason: string } {
    if (!products || products.length === 0 || !boxes || boxes.length === 0) {
        return { product: null, matchScore: 0, matchReason: '' }
    }

    const sampleBox = boxes.find(b => b.metadata?.product_name || b.metadata?.sku || b.metadata?.stamp_line1) || boxes[0]
    const boxMeta = sampleBox.metadata || {}
    const rawBoxProductName = boxMeta.product_name || sampleBox.products?.name || ''
    const rawBoxSku = boxMeta.sku || sampleBox.products?.sku || ''
    const rawStampL1 = boxMeta.stamp_line1 || ''
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

        // 2. Đặc biệt phân biệt: CÓ HẠT vs KHÔNG HẠT
        const isBoxCoHat = cleanBoxName.includes('co hat') || (cleanBoxName.includes('hat') && !cleanBoxName.includes('khong hat') && !cleanBoxName.includes('bo hat'))
        const isBoxKhongHat = cleanBoxName.includes('khong hat') || cleanBoxName.includes('bo hat') || cleanBoxName.includes('ko hat')

        const isPCoHat = cleanPName.includes('co hat') || (cleanPName.includes('hat') && !cleanPName.includes('khong hat') && !cleanPName.includes('bo hat'))
        const isPKhongHat = cleanPName.includes('khong hat') || cleanPName.includes('bo hat') || cleanPName.includes('ko hat')

        if (isBoxCoHat && isPCoHat) {
            score += 35
            reasons.push('Có hạt')
        } else if (isBoxKhongHat && isPKhongHat) {
            score += 35
            reasons.push('Không hạt')
        } else if ((isBoxCoHat && isPKhongHat) || (isBoxKhongHat && isPCoHat)) {
            score -= 60 // Trừ mạnh để tuyệt đối không khớp nhầm
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

function getBoxIndex(box: BoxLabelItem): string {
    if (box.metadata?.box_index !== undefined && box.metadata?.box_index !== null) {
        return String(box.metadata.box_index)
    }
    if (!box.code) return '---'
    const parts = box.code.trim().split('-')
    const last = parts[parts.length - 1]
    return !isNaN(Number(last)) ? last : box.code
}

export default function PalletsPageContent() {
    const { currentSystem } = useSystem()
    const { profile } = useUser()
    const { showToast } = useToast()

    // Tab state: 'linked' (Đã kết nối) | 'unlinked' (Chưa kết nối)
    const [activeTab, setActiveTab] = useState<'linked' | 'unlinked'>('linked')

    // Linked Pallets state
    const [linkedPallets, setLinkedPallets] = useState<PalletLot[]>([])
    const [selectedPallet, setSelectedPallet] = useState<PalletLot | null>(null)

    // Unlinked Pallets state
    const [unlinkedGroups, setUnlinkedGroups] = useState<UnlinkedPalletGroup[]>([])
    const [selectedUnlinkedGroup, setSelectedUnlinkedGroup] = useState<UnlinkedPalletGroup | null>(null)
    const [previewGroup, setPreviewGroup] = useState<UnlinkedPalletGroup | null>(null)

    // Available Lots on web (for manual linking & matching)
    const [allActiveLots, setAllActiveLots] = useState<{ id: string; code: string; daily_seq: number | null; status?: string | null; product_name?: string }[]>([])

    // Available Products for Quick Lot Creation & Auto-matching
    const [warehouseProducts, setWarehouseProducts] = useState<WarehouseProduct[]>([])
    const [allUnits, setAllUnits] = useState<any[]>([])
    const [allProductUnits, setAllProductUnits] = useState<any[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [boxSearchQuery, setBoxSearchQuery] = useState('')
    const [isUnlinkingId, setIsUnlinkingId] = useState<string | null>(null)
    const [isExporting, setIsExporting] = useState(false)
    const [showMobileDetail, setShowMobileDetail] = useState(false)

    // Manual Link Modal
    const [groupToLink, setGroupToLink] = useState<UnlinkedPalletGroup | null>(null)
    const [linkLotSearch, setLinkLotSearch] = useState('')
    const [selectedLotForLink, setSelectedLotForLink] = useState<string | null>(null)
    const [isLinking, setIsLinking] = useState(false)

    // Quick Approve & Create Lot Modal
    const [approveGroup, setApproveGroup] = useState<UnlinkedPalletGroup | null>(null)
    const [proposedLotCode, setProposedLotCode] = useState('')
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
    const [customLotTag, setCustomLotTag] = useState('')
    const [customQuantity, setCustomQuantity] = useState<number>(0)
    const [customUnit, setCustomUnit] = useState<string>('Thùng')
    const [customWeight, setCustomWeight] = useState<number>(0)
    const [customInboundDate, setCustomInboundDate] = useState<string>('')
    const [customPackagingDate, setCustomPackagingDate] = useState<string>('')
    const [customPackagingDates, setCustomPackagingDates] = useState<string[]>([])
    const [newPackagingDateInput, setNewPackagingDateInput] = useState('')
    const [customRawMaterialDate, setCustomRawMaterialDate] = useState<string>('')
    const [customRawMaterialDates, setCustomRawMaterialDates] = useState<string[]>([])
    const [newRawMaterialDateInput, setNewRawMaterialDateInput] = useState('')
    const [customPeelingDate, setCustomPeelingDate] = useState<string>('')
    const [customPeelingDates, setCustomPeelingDates] = useState<string[]>([])
    const [newPeelingDateInput, setNewPeelingDateInput] = useState('')
    const [customProductionPlace, setCustomProductionPlace] = useState<string>('')
    const [customMaterialZone, setCustomMaterialZone] = useState<string>('')
    const [customNotes, setCustomNotes] = useState<string>('')
    const [isApproving, setIsApproving] = useState(false)
    const [isGeneratingCode, setIsGeneratingCode] = useState(false)
    const [matchInfo, setMatchInfo] = useState<{ score: number; reason: string } | null>(null)

    // Auto-linking progress
    const [isAutoLinking, setIsAutoLinking] = useState(false)

    // Edit Box Modal
    const [editingBox, setEditingBox] = useState<BoxLabelItem | null>(null)
    const [editWeight, setEditWeight] = useState('')
    const [editLotCode, setEditLotCode] = useState('')
    const [editBoxCode, setEditBoxCode] = useState('')
    const [editStampLine1, setEditStampLine1] = useState('')
    const [editStampLine2, setEditStampLine2] = useState('')
    const [editSpec, setEditSpec] = useState('')
    const [editShiftGroup, setEditShiftGroup] = useState('')
    const [editProductionDate, setEditProductionDate] = useState('')
    const [editPackagingDate, setEditPackagingDate] = useState('')
    const [editApplyToAllInPallet, setEditApplyToAllInPallet] = useState(false)
    const [isSavingEdit, setIsSavingEdit] = useState(false)

    // Chế độ xem cho Tab Chưa kết nối: 'grid' (thẻ gọn 3 hàng) hoặc 'table' (danh sách nhiều hàng)
    const [unlinkedViewMode, setUnlinkedViewMode] = useState<'grid' | 'table'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('PALLET_UNLINKED_VIEW_MODE')
            if (saved === 'grid' || saved === 'table') return saved
        }
        return 'grid'
    })

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('PALLET_UNLINKED_VIEW_MODE', unlinkedViewMode)
        }
    }, [unlinkedViewMode])

    // Phân trang & Bộ lọc thời gian cho Tab Chưa kết nối
    const [unlinkedDateFilter, setUnlinkedDateFilter] = useState<'all' | 'today' | '3days' | '7days'>('all')
    const [unlinkedPage, setUnlinkedPage] = useState(1)
    const [unlinkedPageSize, setUnlinkedPageSize] = useState<number>(18) // 18 pallet = 6 hàng x 3 cột

    // Bulk Edit Modal for Unlinked Boxes
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
    const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set())
    const [bulkScope, setBulkScope] = useState<'all' | 'selected'>('all')
    const [bulkStampLine1, setBulkStampLine1] = useState('')
    const [bulkStampLine2, setBulkStampLine2] = useState('')
    const [bulkLotCode, setBulkLotCode] = useState('')
    const [bulkWeight, setBulkWeight] = useState('')
    const [bulkSpec, setBulkSpec] = useState('')
    const [bulkShiftGroup, setBulkShiftGroup] = useState('')
    const [bulkProductionDate, setBulkProductionDate] = useState('')
    const [bulkPackagingDate, setBulkPackagingDate] = useState('')
    const [bulkRegenerateCode, setBulkRegenerateCode] = useState(true)
    const [isSavingBulkEdit, setIsSavingBulkEdit] = useState(false)

    // Edit Pallet Info Modal (STT, Tag, Notes)
    const [editingPalletInfoGroup, setEditingPalletInfoGroup] = useState<UnlinkedPalletGroup | null>(null)
    const [editPalletSTT, setEditPalletSTT] = useState('')
    const [editPalletTag, setEditPalletTag] = useState('')
    const [editPalletNotes, setEditPalletNotes] = useState('')
    const [isSavingPalletInfo, setIsSavingPalletInfo] = useState(false)

    // Đơn vị tính khả dụng kèm hậu tố chuẩn cho sản phẩm đang chọn trong modal
    const isStampModal = useMemo(() => {
        if (!approveGroup) return false
        return approveGroup.boxes.some(b => 
            b.metadata?.scan_type === 'stamp' || !!b.metadata?.stamp_line1 || !!b.metadata?.stamp_line2 || b.code?.startsWith('STAMP-')
        )
    }, [approveGroup])

    const currentBoxWeight = useMemo(() => {
        if (!approveGroup || approveGroup.boxes.length === 0) return 20
        const sample = approveGroup.boxes.find(b => Number(b.quantity) > 0)
        return sample ? Number(sample.quantity) : (approveGroup.total_weight / approveGroup.boxes.length || 20)
    }, [approveGroup])

    const currentAvailableUnits = useMemo(() => {
        const prod = warehouseProducts.find(p => p.id === selectedProductId)
        return getAvailableUnitsForProduct(prod, allProductUnits, allUnits, currentBoxWeight)
    }, [warehouseProducts, selectedProductId, allProductUnits, allUnits, currentBoxWeight])

    useEffect(() => {
        if (currentAvailableUnits.length > 0) {
            const hasCurrent = currentAvailableUnits.includes(customUnit)
            if (!hasCurrent) {
                const thungOpt = currentAvailableUnits.find(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))
                setCustomUnit(thungOpt || currentAvailableUnits[0])
            }
        }
    }, [currentAvailableUnits, customUnit])

    // ─────────────────────────────────────────────────────────────
    // FETCH DATA
    // ─────────────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        if (!currentSystem?.code) return
        setIsLoading(true)
        try {
            // 1. Fetch all lots in the system (to resolve daily_seq & for linking)
            const { data: lotsData, error: lotsErr } = await supabase
                .from('lots')
                .select(`
                    id,
                    code,
                    daily_seq,
                    status,
                    production_code,
                    system_code,
                    company_id,
                    created_at,
                    inbound_date,
                    quantity,
                    products ( name, sku ),
                    box_labels (
                        id,
                        code,
                        lot_id,
                        quantity,
                        unit,
                        status,
                        semi_finished_lot_code,
                        finished_lot_code,
                        created_at,
                        metadata,
                        products ( name, sku, internal_name )
                    )
                `)
                .eq('system_code', currentSystem.code)
                .order('created_at', { ascending: false })
                .limit(200)

            if (lotsErr) throw lotsErr

            // 1.1 Store active lots for manual linking & matching
            const activeLotsList = (lotsData || []).map((l: any) => {
                const existingBoxes = Array.isArray(l.box_labels) ? l.box_labels : []
                const existingWeight = existingBoxes.reduce((sum: number, b: any) => sum + (Number(b.quantity) || 0), 0)
                return {
                    id: l.id,
                    code: l.code,
                    daily_seq: l.daily_seq,
                    status: l.status,
                    product_name: l.products?.name || '',
                    existingBoxesCount: existingBoxes.length,
                    existingTotalWeight: existingWeight
                }
            })
            setAllActiveLots(activeLotsList)

            // 1.2 Linked Pallets (Lots having box_labels attached)
            const linked = (lotsData || []).filter(
                (l: any) => Array.isArray(l.box_labels) && l.box_labels.length > 0
            ) as PalletLot[]

            linked.forEach(p => {
                p.box_labels.sort((a, b) => {
                    const idxA = parseInt(getBoxIndex(a), 10) || 0
                    const idxB = parseInt(getBoxIndex(b), 10) || 0
                    return idxA - idxB
                })
            })
            setLinkedPallets(linked)

            // Keep selected pallet in sync
            setSelectedPallet(prev => {
                if (!prev) return linked[0] || null
                return linked.find(p => p.id === prev.id) || linked[0] || null
            })

            // 2. Fetch Unlinked Boxes (lot_id IS NULL) - Tự động tải ngầm từng đợt 1000 thùng cho tới khi lấy đủ 100% không bị sót
            let unlinkedData: any[] = []
            let unlinkedFrom = 0
            const unlinkedChunkSize = 1000

            while (true) {
                const { data: chunk, error: chunkErr } = await supabase
                    .from('box_labels')
                    .select(`
                        id,
                        code,
                        lot_id,
                        quantity,
                        unit,
                        status,
                        semi_finished_lot_code,
                        finished_lot_code,
                        created_at,
                        metadata,
                        products ( name, sku, internal_name )
                    `)
                    .eq('system_code', currentSystem.code)
                    .is('lot_id', null)
                    .order('created_at', { ascending: false })
                    .range(unlinkedFrom, unlinkedFrom + unlinkedChunkSize - 1)

                if (chunkErr) {
                    console.error('Lỗi tải thùng chưa kết nối:', chunkErr)
                    throw chunkErr
                }
                if (!chunk || chunk.length === 0) break
                unlinkedData = [...unlinkedData, ...chunk]
                if (chunk.length < unlinkedChunkSize) break
                unlinkedFrom += unlinkedChunkSize
            }

            // 2.1 Group unlinked box_labels by pallet_stt
            const groupMap = new Map<string, BoxLabelItem[]>()
            ;(unlinkedData || []).forEach((b: any) => {
                const rawStt = b.metadata?.pallet_stt
                if (!rawStt) return // Bỏ qua tem in đơn lẻ/QR test không thuộc đợt quét Pallet
                if (b.metadata?.stamp_line2) {
                    b.metadata = applyStampDecodeToMeta(b.metadata)
                }
                const stt = rawStt.trim().toUpperCase()
                if (!groupMap.has(stt)) {
                    groupMap.set(stt, [])
                }
                groupMap.get(stt)!.push(b)
            })

            const groups: UnlinkedPalletGroup[] = []
            groupMap.forEach((boxes, stt) => {
                boxes.sort((a, b) => {
                    const idxA = parseInt(getBoxIndex(a), 10) || 0
                    const idxB = parseInt(getBoxIndex(b), 10) || 0
                    return idxA - idxB
                })
                const total_weight = boxes.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
                const latestCreated = boxes[0]?.created_at || new Date().toISOString()

                // Check if any lot on web matches this STT
                const encodedSeq = encodeSTT(stt)
                const matched = activeLotsList.find(l => {
                    if (encodedSeq !== null && l.daily_seq === encodedSeq) return true
                    if (l.code.toUpperCase() === stt) return true
                    return false
                })

                // Nhận diện trùng STT: Đã có Lô trên Web VÀ Lô đó còn trong kho (chưa xuất) VÀ Lô đó đã có thùng gắn vào
                const isConflict = !!(matched && matched.status !== 'exported' && (matched.existingBoxesCount || 0) > 0)

                const palletTag = boxes.find(b => b.metadata?.tag)?.metadata?.tag || null
                const palletNotes = boxes.map(b => b.metadata?.pallet_notes || b.metadata?.notes).find(Boolean) || null

                groups.push({
                    pallet_stt: stt,
                    pallet_tag: palletTag,
                    pallet_notes: palletNotes,
                    boxes,
                    total_weight,
                    created_at: latestCreated,
                    isConflict,
                    matchedLot: matched || null
                })
            })

            setUnlinkedGroups(groups)
            setSelectedUnlinkedGroup(prev => {
                if (!prev) return groups[0] || null
                return groups.find(g => g.pallet_stt === prev.pallet_stt) || groups[0] || null
            })
            setPreviewGroup(prev => {
                if (!prev) return null
                return groups.find(g => g.pallet_stt === prev.pallet_stt) || null
            })

            // 3. Fetch all products for the current warehouse system (hỗ trợ phân trang, khắc phục giới hạn 300/1000)
            try {
                let allProducts: WarehouseProduct[] = []
                let from = 0
                const pageSize = 1000

                while (true) {
                    let query = (supabase.from('products') as any)
                        .select('id, name, sku, unit, aliases, internal_name, internal_code, weight_kg, system_type')
                        .range(from, from + pageSize - 1)
                        .order('name')

                    if (currentSystem?.code) {
                        query = query.eq('system_type', currentSystem.code)
                    }

                    const { data: pageData, error: pageErr } = await query
                    if (pageErr) {
                        console.error('Lỗi tải products phân trang:', pageErr)
                        break
                    }
                    if (!pageData || pageData.length === 0) break
                    allProducts = [...allProducts, ...pageData]
                    if (pageData.length < pageSize) break
                    from += pageSize
                }

                if (allProducts.length > 0) {
                    setWarehouseProducts(allProducts)
                } else {
                    // Fallback nếu hệ thống không phân biệt system_type
                    const { data: fallbackProds } = await (supabase.from('products') as any)
                        .select('id, name, sku, unit, aliases, internal_name, internal_code, weight_kg')
                        .order('name')
                        .limit(1000)
                    if (fallbackProds) setWarehouseProducts(fallbackProds as WarehouseProduct[])
                }

                // 4. Fetch units & product_units để đồng bộ đơn vị tính kèm hậu tố chuẩn
                try {
                    const [uRes, puRes] = await Promise.all([
                        (supabase.from('units') as any).select('id, name'),
                        (supabase.from('product_units') as any).select('id, product_id, unit_id, conversion_rate')
                    ])
                    if (uRes.data) setAllUnits(uRes.data)
                    if (puRes.data) setAllProductUnits(puRes.data)
                } catch (uErr) {
                    console.warn('Lỗi tải đơn vị tính cho sản phẩm:', uErr)
                }
            } catch (pErr) {
                console.warn('Lỗi tải danh mục sản phẩm cho Pallet:', pErr)
            }
        } catch (err: any) {
            console.error('Lỗi tải dữ liệu Pallet:', err)
            showToast('Không thể tải dữ liệu Pallet: ' + (err.message || 'Lỗi mạng'), 'error')
        } finally {
            setIsLoading(false)
        }
    }, [currentSystem?.code, showToast])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Supabase Realtime subscription
    useEffect(() => {
        if (!currentSystem?.code) return

        const channel = supabase
            .channel('realtime_pallets_page')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'box_labels' }, () => {
                fetchData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lots' }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem?.code, fetchData])

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: UNLINK BOX (Gỡ thùng khỏi Lô)
    // ─────────────────────────────────────────────────────────────
    const handleUnlinkBox = async (box: BoxLabelItem) => {
        if (!selectedPallet) return
        const confirmed = window.confirm(`Bạn có chắc chắn muốn gỡ thùng #${getBoxIndex(box)} (${box.code}) ra khỏi LOT ${selectedPallet.code} không? Thùng sẽ được chuyển vào mục "Chưa kết nối".`)
        if (!confirmed) return

        setIsUnlinkingId(box.id)
        try {
            const { error } = await (supabase
                .from('box_labels') as any)
                .update({ lot_id: null, status: 'unlinked' })
                .eq('id', box.id)

            if (error) throw error

            // Cập nhật lại số lượng thùng trong LOT
            const remainingCount = Math.max(0, selectedPallet.box_labels.length - 1)
            await (supabase.from('lots') as any)
                .update({ quantity: remainingCount })
                .eq('id', selectedPallet.id)

            showToast(`Đã gỡ thùng #${getBoxIndex(box)} ra khỏi LOT ${selectedPallet.code}!`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi khi gỡ thùng: ' + err.message, 'error')
        } finally {
            setIsUnlinkingId(null)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: UNLINK ENTIRE PALLET (Chuyển cả Pallet về Chưa kết nối)
    // ─────────────────────────────────────────────────────────────
    const handleUnlinkEntirePallet = async (pallet: PalletLot) => {
        const palletStt = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : pallet.code
        const confirmed = window.confirm(
            `HỦY KẾT NỐI PALLET: Bạn có chắc muốn ngắt liên kết toàn bộ ${pallet.box_labels.length} thùng của LOT ${pallet.code} (STT: ${palletStt}) không?\n\nToàn bộ thùng sẽ chuyển về mục "Chưa kết nối" để ghép nối lại khi cần.`
        )
        if (!confirmed) return

        try {
            const boxIds = pallet.box_labels.map(b => b.id)
            const { error } = await (supabase
                .from('box_labels') as any)
                .update({
                    lot_id: null,
                    status: 'unlinked',
                    metadata: { pallet_stt: palletStt }
                })
                .in('id', boxIds)

            if (error) throw error

            showToast(`Đã chuyển toàn bộ thùng của STT ${palletStt} sang mục "Chưa kết nối"!`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi khi hủy liên kết Pallet: ' + err.message, 'error')
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: CONNECT UNLINKED PALLET TO A LOT (Ghép nối vào LOT)
    // ─────────────────────────────────────────────────────────────
    const handleLinkGroupToLot = async (group: UnlinkedPalletGroup, targetLotId: string) => {
        const targetLot = allActiveLots.find(l => l.id === targetLotId)
        if (!targetLot) {
            showToast('Không tìm thấy thông tin LOT được chọn!', 'error')
            return
        }

        setIsLinking(true)
        try {
            // Đồng bộ dữ liệu giải mã chuẩn cho các thùng con dấu trước khi ghép vào LOT
            const validProv = group.boxes.map(b => b.metadata?.region).find(r => r && !r.startsWith('Tỉnh mã ') && !r.startsWith('Mã '))
            if (validProv) {
                group.boxes.forEach(b => {
                    if (b.metadata && (!b.metadata.region || b.metadata.region.startsWith('Tỉnh mã '))) {
                        b.metadata.region = validProv
                        b.metadata.province = validProv
                        b.metadata.material_zone = validProv
                        b.metadata.material_zones = [validProv]
                    }
                })
            }
            await healStampBoxesInDB(group.boxes)

            const boxIds = group.boxes.map(b => b.id)
            const { error: boxErr } = await (supabase
                .from('box_labels') as any)
                .update({
                    lot_id: targetLot.id,
                    status: 'linked'
                })
                .in('id', boxIds)

            if (boxErr) throw boxErr

            // Tự động đồng bộ ngày sản xuất / ngày nguyên liệu vào LOT
            await syncDatesFromBoxesToLot(targetLot.id, group.boxes)

            // Cập nhật số lượng thùng trong bảng lots
            await (supabase
                .from('lots') as any)
                .update({ quantity: group.boxes.length })
                .eq('id', targetLot.id)

            // Cập nhật ghi chú nếu có
            if (group.pallet_notes && group.pallet_notes.trim()) {
                try {
                    const { data: currentLot } = await (supabase
                        .from('lots') as any)
                        .select('notes')
                        .eq('id', targetLot.id)
                        .maybeSingle()

                    if (currentLot && !(currentLot as any).notes) {
                        await (supabase.from('lots') as any)
                            .update({ notes: group.pallet_notes.trim() })
                            .eq('id', targetLot.id)
                    }
                } catch (noteErr) {
                    console.warn('Lỗi cập nhật ghi chú lô:', noteErr)
                }
            }

            // Tự động ghi mã phụ (tag) vào bảng lot_tags nếu có
            const tagFromGroup = group.pallet_tag || group.boxes.find(b => b.metadata?.tag)?.metadata?.tag
            if (tagFromGroup && tagFromGroup.trim()) {
                const cleanTag = tagFromGroup.trim().toUpperCase()
                try {
                    const { data: existTag } = await supabase
                        .from('lot_tags')
                        .select('id')
                        .eq('lot_id', targetLot.id)
                        .eq('tag', cleanTag)
                        .maybeSingle()

                    if (!existTag) {
                        await (supabase.from('lot_tags') as any).insert({
                            lot_id: targetLot.id,
                            tag: cleanTag,
                            added_at: new Date().toISOString()
                        })
                    }
                } catch (tErr) {
                    console.warn('Lỗi ghi lot_tags:', tErr)
                }
            }

            showToast(`✅ Đã kết nối ${group.boxes.length} thùng (STT: ${group.pallet_stt}) vào LOT "${targetLot.code}"!`, 'success')
            setGroupToLink(null)
            setSelectedLotForLink(null)
            fetchData()
        } catch (err: any) {
            showToast('Lỗi kết nối LOT: ' + err.message, 'error')
        } finally {
            setIsLinking(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: UPDATE CONFLICT LOT (Cập nhật đợt quét trùng STT vào LOT cũ)
    // ─────────────────────────────────────────────────────────────
    const handleUpdateConflictLot = async (group: UnlinkedPalletGroup, targetLotId: string) => {
        const targetLot = allActiveLots.find(l => l.id === targetLotId)
        if (!targetLot) {
            showToast('Không tìm thấy thông tin LOT được chọn!', 'error')
            return
        }

        const confirmed = window.confirm(
            `CẬP NHẬT LOT: Bạn có chắc muốn THAY THẾ danh sách thùng của LOT ${targetLot.code} (STT: ${group.pallet_stt}) bằng ${group.boxes.length} thùng mới quét này không?\n\n(Hệ thống sẽ xóa các thùng cũ của LOT ra và gán toàn bộ ${group.boxes.length} thùng mới này vào LOT ${targetLot.code})`
        )
        if (!confirmed) return

        setIsLinking(true)
        try {
            // 1. Xóa triệt để các thùng cũ của LOT này để tránh bị nhân đôi / dư thừa thùng rác
            await (supabase
                .from('box_labels') as any)
                .delete()
                .eq('lot_id', targetLot.id)

            // 2. Gán các thùng mới vào LOT
            const boxIds = group.boxes.map(b => b.id)
            const { error: boxErr } = await (supabase
                .from('box_labels') as any)
                .update({
                    lot_id: targetLot.id,
                    status: 'linked'
                })
                .in('id', boxIds)

            if (boxErr) throw boxErr

            // 3. Tự động đồng bộ ngày sản xuất / ngày đóng gói / ngày nguyên liệu vào LOT
            await syncDatesFromBoxesToLot(targetLot.id, group.boxes)

            // 4. Cập nhật số lượng thùng trong bảng lots
            await (supabase
                .from('lots') as any)
                .update({ quantity: group.boxes.length })
                .eq('id', targetLot.id)

            // 5. Cập nhật ghi chú nếu có
            if (group.pallet_notes && group.pallet_notes.trim()) {
                try {
                    await (supabase.from('lots') as any)
                        .update({ notes: group.pallet_notes.trim() })
                        .eq('id', targetLot.id)
                } catch (nErr) {
                    console.warn('Lỗi ghi notes:', nErr)
                }
            }

            // 6. Cập nhật tag nếu có
            const tagFromGroup = group.pallet_tag || group.boxes.find(b => b.metadata?.tag)?.metadata?.tag
            if (tagFromGroup && tagFromGroup.trim()) {
                const cleanTag = tagFromGroup.trim().toUpperCase()
                try {
                    const { data: existTag } = await supabase
                        .from('lot_tags')
                        .select('id')
                        .eq('lot_id', targetLot.id)
                        .eq('tag', cleanTag)
                        .maybeSingle()

                    if (!existTag) {
                        await (supabase.from('lot_tags') as any).insert({
                            lot_id: targetLot.id,
                            tag: cleanTag,
                            added_at: new Date().toISOString()
                        })
                    }
                } catch (tErr) {
                    console.warn('Lỗi ghi lot_tags:', tErr)
                }
            }

            showToast(`✅ Đã cập nhật thành công ${group.boxes.length} thùng mới vào LOT "${targetLot.code}"!`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi khi cập nhật LOT: ' + err.message, 'error')
        } finally {
            setIsLinking(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: AUTO-LINK ALL MATCHED PALLETS (Tự động kết nối tất cả)
    // ─────────────────────────────────────────────────────────────
    const handleAutoLinkAll = async () => {
        const eligible = unlinkedGroups.filter(g => !!g.matchedLot)
        if (eligible.length === 0) {
            showToast('Không có Pallet nào có STT khớp với các LOT hiện tại trên Web mẹ.', 'warning')
            return
        }

        setIsAutoLinking(true)
        let successCount = 0
        try {
            for (const group of eligible) {
                const targetLot = group.matchedLot!
                const boxIds = group.boxes.map(b => b.id)
                const { error } = await (supabase
                    .from('box_labels') as any)
                    .update({
                        lot_id: targetLot.id,
                        status: 'linked'
                    })
                    .in('id', boxIds)

                if (!error) {
                    await syncDatesFromBoxesToLot(targetLot.id, group.boxes)

                    // Cập nhật số lượng thùng trong bảng lots
                    await (supabase.from('lots') as any)
                        .update({ quantity: group.boxes.length })
                        .eq('id', targetLot.id)

                    // Tự động ghi mã phụ (tag) vào bảng lot_tags nếu có
                    const tagFromGroup = group.pallet_tag || group.boxes.find(b => b.metadata?.tag)?.metadata?.tag
                    if (tagFromGroup && tagFromGroup.trim()) {
                        const cleanTag = tagFromGroup.trim().toUpperCase()
                        try {
                            const { data: existTag } = await supabase
                                .from('lot_tags')
                                .select('id')
                                .eq('lot_id', targetLot.id)
                                .eq('tag', cleanTag)
                                .maybeSingle()

                            if (!existTag) {
                                await (supabase.from('lot_tags') as any).insert({
                                    lot_id: targetLot.id,
                                    tag: cleanTag,
                                    added_at: new Date().toISOString()
                                })
                            }
                        } catch (tErr) {
                            console.warn('Lỗi ghi lot_tags tự động:', tErr)
                        }
                    }

                    successCount++
                }
            }

            showToast(`⚡ Đã tự động kết nối thành công ${successCount} / ${eligible.length} Pallet vào LOT tương ứng!`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi tự động kết nối: ' + err.message, 'error')
        } finally {
            setIsAutoLinking(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: DELETE UNLINKED GROUP (Xóa đợt quét thùng chưa kết nối)
    // ─────────────────────────────────────────────────────────────
    const handleDeleteUnlinkedGroup = async (group: UnlinkedPalletGroup) => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn XÓA toàn bộ ${group.boxes.length} thùng chưa kết nối của STT "${group.pallet_stt}" không? Thao tác này không thể hoàn tác.`)
        if (!confirmed) return

        try {
            // 1. Cập nhật giao diện ngay lập tức để người dùng thấy biến mất ngay
            setUnlinkedGroups(prev => prev.filter(g => g.pallet_stt !== group.pallet_stt))
            setSelectedUnlinkedGroup(prev => prev?.pallet_stt === group.pallet_stt ? null : prev)
            setPreviewGroup(prev => prev?.pallet_stt === group.pallet_stt ? null : prev)

            // 2. Xóa các thùng theo ID đã tải
            const boxIds = group.boxes.map(b => b.id)
            if (boxIds.length > 0) {
                await supabase
                    .from('box_labels')
                    .delete()
                    .in('id', boxIds)
            }

            // 3. Xóa triệt để TẤT CẢ các thùng chưa kết nối (lot_id IS NULL) còn sót lại trong DB của STT này (tránh bị tràn phân trang 500 thùng)
            const sttClean = group.pallet_stt.trim()
            await (supabase.from('box_labels') as any)
                .delete()
                .is('lot_id', null)
                .eq('system_code', currentSystem?.code || 'KHO_DONG_LANH')
                .eq('metadata->>pallet_stt', sttClean)

            showToast(`Đã xóa hoàn toàn các thùng của STT ${group.pallet_stt}`, 'success')
            await fetchData()
        } catch (err: any) {
            showToast('Lỗi khi xóa: ' + err.message, 'error')
            await fetchData()
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: QUICK APPROVE & CREATE LOT FROM PALLET (Duyệt tạo Lô ngay)
    // ─────────────────────────────────────────────────────────────
    const productOptions = useMemo(() => {
        return warehouseProducts.map(p => {
            const aliasStr = getProductAliases(p)
            return {
                value: p.id,
                label: `${p.sku} - ${p.name}`,
                name: p.name,
                sku: p.sku,
                unit: p.unit || 'Kg',
                aliases: aliasStr,
                short_name: aliasStr,
                rawAliases: p.aliases || '',
                internal_name: p.internal_name || '',
                internal_code: p.internal_code || ''
            }
        })
    }, [warehouseProducts])

    const handleOpenApproveModal = async (group: UnlinkedPalletGroup) => {
        setApproveGroup(group)
        setIsApproving(false)
        setIsGeneratingCode(true)

        // 1. Sinh mã Lô gợi ý
        let lotCode = ''
        try {
            if (currentSystem?.name) {
                lotCode = await generateUniqueLotCode(supabase, currentSystem.name)
            }
        } catch (e) {
            console.error('Lỗi sinh mã Lô tự động:', e)
        }
        if (!lotCode) {
            lotCode = `DL-LOT-${group.pallet_stt}-${Date.now().toString().slice(-4)}`
        }
        setProposedLotCode(lotCode)
        setIsGeneratingCode(false)

        // 2. Khớp thông minh Sản Phẩm từ con dấu / tem quét
        const match = findBestMatchingProduct(group.boxes, warehouseProducts)
        const targetProd = match.product || warehouseProducts[0] || null
        setSelectedProductId(targetProd?.id ?? null)
        setMatchInfo({ score: match.matchScore, reason: match.matchReason })

        // 3. Kế thừa mã phụ (Tag)
        setCustomLotTag(group.pallet_tag || group.boxes.find(b => b.metadata?.tag)?.metadata?.tag || '')

        // 4. Kế thừa số lượng thùng (đơn vị: Thùng) & tổng khối lượng (Kg)
        setCustomQuantity(group.boxes.length)
        setCustomWeight(group.total_weight)

        // Khớp đơn vị tính chuẩn kèm hậu tố trọng lượng (vd: Thùng (20kg), Kg) khớp với Quản lý sản phẩm & Tạo LOT
        const sampleWeight = group.boxes.find(b => Number(b.quantity) > 0)?.quantity || (group.boxes.length > 0 ? group.total_weight / group.boxes.length : 20)
        const availUnits = getAvailableUnitsForProduct(targetProd, allProductUnits, allUnits, Number(sampleWeight) || 20)
        const thungUnit = availUnits.find(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))
        setCustomUnit(thungUnit || availUnits[0] || 'Thùng (20kg)')

        // 5. Kế thừa ngày tháng từ các thùng (khớp chính xác quy tắc đóng dấu Dòng 2 & tem nhãn)
        const todayStr = new Date().toISOString().slice(0, 10)
        const isStamp = group.boxes.some(b => 
            b.metadata?.scan_type === 'stamp' || !!b.metadata?.stamp_line1 || !!b.metadata?.stamp_line2 || b.code?.startsWith('STAMP-')
        )

        // Quy tắc chính xác:
        // - Dấu mực: Dòng 2 chỉ có Ngày đóng gói (DDMM) & Ngày nhập nguyên liệu (DDMMYY). TUYỆT ĐỐI không có Ngày sản xuất -> để trống.
        // - Tem nhãn: Chỉ có Ngày sản xuất (NSX) & Ngày đóng gói (NĐG). TUYỆT ĐỐI không có Ngày nhập nguyên liệu -> để trống.
        const packDates = Array.from(new Set(group.boxes.map(b => extractPackagingDate(b)).filter(Boolean) as string[])).sort()
        const rawDates = Array.from(new Set(group.boxes.map(b => extractRawMaterialDate(b)).filter(Boolean) as string[])).sort()
        const prodDates = Array.from(new Set(group.boxes.map(b => extractProductionDate(b)).filter(Boolean) as string[])).sort()

        const defaultPackDate = packDates.length > 0 ? packDates[packDates.length - 1] : ''
        const defaultRawDate = isStamp && rawDates.length > 0 ? rawDates[0] : ''
        const defaultProdDate = !isStamp && prodDates.length > 0 ? prodDates[0] : ''

        setCustomInboundDate(todayStr)

        setCustomPackagingDates(packDates)
        setCustomPackagingDate(defaultPackDate)
        setNewPackagingDateInput('')

        const finalRawDates = isStamp ? rawDates : []
        setCustomRawMaterialDates(finalRawDates)
        setCustomRawMaterialDate(defaultRawDate)
        setNewRawMaterialDateInput('')

        const finalProdDates = !isStamp ? prodDates : []
        setCustomPeelingDates(finalProdDates)
        setCustomPeelingDate(defaultProdDate)
        setNewPeelingDateInput('')

        // 6. Kế thừa Nơi sản xuất (Tổ đóng gói) & Vùng nguyên liệu
        // Với thùng con dấu: luôn giải mã lại từ Dòng 2 hiện tại để loại bỏ hoàn toàn vùng cũ do OCR đọc sai trước khi sửa
        const effectiveMetas = group.boxes.map(b => {
            const m = b.metadata || {}
            const stampBox = m.scan_type === 'stamp' || !!m.stamp_line2 || b.code?.startsWith('STAMP-')
            return stampBox && m.stamp_line2 ? applyStampDecodeToMeta(m) : m
        })
        const places = Array.from(new Set(effectiveMetas.map(m => m.shift_group).filter(Boolean)))
        const rawRegions = Array.from(new Set(effectiveMetas.map(m => m.region).filter(Boolean)))
        // Loại bỏ các mã tạm do OCR đọc sai (VD: "Tỉnh mã 88") nếu trong nhóm đã có tỉnh hợp lệ được giải mã chuẩn (VD: "Đắk Lắk")
        const validProvinces = rawRegions.filter(r => !r.startsWith('Tỉnh mã ') && !r.startsWith('Mã '))
        const regions = validProvinces.length > 0 ? validProvinces : rawRegions
        setCustomProductionPlace(places.join(', '))
        setCustomMaterialZone(regions.join(', '))

        // 7. Kế thừa Ghi chú từ app quét (nếu người dùng có nhập ghi chú trên app)
        const syncedNote = group.pallet_notes || group.boxes.map(b => b.metadata?.pallet_notes || b.metadata?.notes).find(Boolean) || ''
        setCustomNotes(syncedNote)
    }

    const handleAddRawDate = () => {
        if (!newRawMaterialDateInput) return
        const clean = cleanDateForDB(newRawMaterialDateInput)
        if (clean && !customRawMaterialDates.includes(clean)) {
            const next = [...customRawMaterialDates, clean].sort()
            setCustomRawMaterialDates(next)
            if (!customRawMaterialDate) setCustomRawMaterialDate(clean)
        }
        setNewRawMaterialDateInput('')
    }

    const handleRemoveRawDate = (dateToRemove: string) => {
        const next = customRawMaterialDates.filter(d => d !== dateToRemove)
        setCustomRawMaterialDates(next)
        if (customRawMaterialDate === dateToRemove) {
            setCustomRawMaterialDate(next[0] || '')
        }
    }

    const handleAddPackagingDate = () => {
        if (!newPackagingDateInput) return
        const clean = cleanDateForDB(newPackagingDateInput)
        if (clean && !customPackagingDates.includes(clean)) {
            const next = [...customPackagingDates, clean].sort()
            setCustomPackagingDates(next)
            if (!customPackagingDate) setCustomPackagingDate(clean)
        }
        setNewPackagingDateInput('')
    }

    const handleRemovePackagingDate = (dateToRemove: string) => {
        const next = customPackagingDates.filter(d => d !== dateToRemove)
        setCustomPackagingDates(next)
        if (customPackagingDate === dateToRemove) {
            setCustomPackagingDate(next[next.length - 1] || '')
        }
    }

    const handleAddPeelingDate = () => {
        if (!newPeelingDateInput) return
        const clean = cleanDateForDB(newPeelingDateInput)
        if (clean && !customPeelingDates.includes(clean)) {
            const next = [...customPeelingDates, clean].sort()
            setCustomPeelingDates(next)
            if (!customPeelingDate) setCustomPeelingDate(clean)
        }
        setNewPeelingDateInput('')
    }

    const handleRemovePeelingDate = (dateToRemove: string) => {
        const next = customPeelingDates.filter(d => d !== dateToRemove)
        setCustomPeelingDates(next)
        if (customPeelingDate === dateToRemove) {
            setCustomPeelingDate(next[0] || '')
        }
    }

    const handleRegenerateLotCode = async () => {
        setIsGeneratingCode(true)
        try {
            if (currentSystem?.name) {
                const code = await generateUniqueLotCode(supabase, currentSystem.name)
                setProposedLotCode(code)
            }
        } catch (e: any) {
            showToast('Lỗi sinh lại mã: ' + e.message, 'error')
        } finally {
            setIsGeneratingCode(false)
        }
    }

    const handleConfirmCreateLot = async () => {
        if (!approveGroup || !currentSystem?.code) return
        if (!proposedLotCode.trim()) {
            showToast('Vui lòng nhập Mã LOT định danh!', 'warning')
            return
        }
        if (!selectedProductId) {
            showToast('Vui lòng chọn Sản phẩm cho LOT hàng!', 'warning')
            return
        }

        setIsApproving(true)
        try {
            const group = approveGroup
            const dailySeqVal = encodeSTT(group.pallet_stt)

            // Kiểm tra xem STT này đã bị LOT nào chiếm giữ trên hệ thống chưa
            if (dailySeqVal !== null) {
                const { data: existLots } = await (supabase.from('lots') as any)
                    .select('id, code, inbound_date')
                    .eq('system_code', currentSystem.code)
                    .eq('daily_seq', dailySeqVal)
                    .neq('status', 'hidden')
                    .neq('status', 'exported')
                    .limit(1)

                if (existLots && existLots.length > 0) {
                    const confirmed = window.confirm(
                        `⚠️ Cảnh báo: STT "${group.pallet_stt}" đã được dùng bởi LOT "${existLots[0].code}".\n` +
                        `Bạn có chắc chắn muốn tiếp tục tạo LOT mới "${proposedLotCode.trim()}" mang cùng STT này không?`
                    )
                    if (!confirmed) {
                        setIsApproving(false)
                        return
                    }
                }
            }

            // Kiểm tra trùng Mã LOT
            const { count: codeCount } = await supabase
                .from('lots')
                .select('*', { count: 'exact', head: true })
                .eq('code', proposedLotCode.trim())
                .eq('system_code', currentSystem.code)

            let finalLotCode = proposedLotCode.trim()
            if (codeCount && codeCount > 0) {
                finalLotCode = await generateUniqueLotCode(supabase, currentSystem.name)
            }

            const selectedProd = warehouseProducts.find(p => p.id === selectedProductId)

            const cleanInbound = cleanDateForDB(customInboundDate)
            const cleanRawDates = customRawMaterialDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]
            const cleanPackagingDates = customPackagingDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]
            const cleanPeelingDates = customPeelingDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]

            const cleanPack = cleanPackagingDates.length > 0 ? cleanPackagingDates[cleanPackagingDates.length - 1] : cleanDateForDB(customPackagingDate)
            const cleanRaw = cleanRawDates.length > 0 ? cleanRawDates[0] : cleanDateForDB(customRawMaterialDate)
            const cleanPeeling = cleanPeelingDates.length > 0 ? cleanPeelingDates[0] : cleanDateForDB(customPeelingDate)

            // 1. Tạo mới bản ghi Lô (lots)
            const lotPayload: any = {
                code: finalLotCode,
                system_code: currentSystem.code,
                company_id: profile?.company_id || null,
                product_id: selectedProductId,
                daily_seq: dailySeqVal,
                quantity: Number(customQuantity) || group.boxes.length,
                status: 'active',
                inbound_date: cleanInbound || null,
                packaging_date: cleanPack || null,
                raw_material_date: cleanRaw || null,
                peeling_date: cleanPeeling || null,
                notes: customNotes.trim() || null,
                metadata: {
                    created_from_pallet_stt: group.pallet_stt,
                    pallet_tag: customLotTag.trim() || null,
                    unit: customUnit || 'Thùng',
                    total_weight_kg: Number(customWeight) || group.total_weight,
                    box_count: group.boxes.length,
                    production_place: customProductionPlace.trim() || null,
                    production_places: customProductionPlace.trim() ? [customProductionPlace.trim()] : [],
                    material_zone: customMaterialZone.trim() || null,
                    material_zones: customMaterialZone.trim() ? [customMaterialZone.trim()] : [],
                    raw_material_date: cleanRaw || null,
                    raw_material_dates: cleanRawDates,
                    manual_raw_material_dates: cleanRawDates,
                    packaging_date: cleanPack || null,
                    packaging_dates: cleanPackagingDates,
                    manual_packaging_dates: cleanPackagingDates,
                    peeling_dates: cleanPeelingDates,
                    manual_peeling_dates: cleanPeelingDates
                }
            }

            const { data: newLot, error: lotErr } = await (supabase
                .from('lots') as any)
                .insert(lotPayload)
                .select('id, code')

            if (lotErr) {
                throw new Error(lotErr.message || lotErr.details || 'Lỗi thêm bản ghi Lô (lots)')
            }

            const lotRecord = Array.isArray(newLot) ? newLot[0] : newLot
            let newLotId = lotRecord?.id

            // Fallback nếu không trả về data từ select
            if (!newLotId) {
                const { data: fallbackLot } = await (supabase.from('lots') as any)
                    .select('id, code')
                    .eq('code', finalLotCode)
                    .eq('system_code', currentSystem.code)
                    .maybeSingle()
                newLotId = fallbackLot?.id
            }

            if (!newLotId) {
                throw new Error('Không lấy được ID của LOT vừa tạo')
            }

            // 2. Tạo bản ghi chi tiết sản phẩm Lô (lot_items)
            const itemPayload: any = {
                lot_id: newLotId,
                product_id: selectedProductId,
                quantity: Number(customQuantity) || group.boxes.length,
                unit: customUnit || 'Thùng'
            }
            if (profile?.company_id) {
                itemPayload.company_id = profile.company_id
            }
            const { error: itemErr } = await (supabase
                .from('lot_items') as any)
                .insert(itemPayload)

            if (itemErr) {
                console.warn('Cảnh báo thêm lot_items:', itemErr.message || itemErr)
            }

            // 3. Ghi mã phụ vào lot_tags nếu có
            if (customLotTag && customLotTag.trim()) {
                const cleanTag = customLotTag.trim().toUpperCase()
                const tagPayload: any = {
                    lot_id: newLotId,
                    tag: cleanTag,
                    added_at: new Date().toISOString()
                }
                if (profile?.company_id) {
                    tagPayload.company_id = profile.company_id
                }
                const { error: tagErr } = await (supabase.from('lot_tags') as any).insert(tagPayload)
                if (tagErr) {
                    console.warn('Cảnh báo ghi lot_tags:', tagErr.message || tagErr)
                }
            }

            // 3.5 Đồng bộ dữ liệu giải mã chuẩn cho các thùng con dấu trước khi kết nối vào LOT
            // Đồng bộ customMaterialZone đã được duyệt vào toàn bộ thùng để trigger DB không đọc sót mã tỉnh cũ
            if (customMaterialZone && customMaterialZone.trim()) {
                const zone = customMaterialZone.trim()
                group.boxes.forEach(b => {
                    if (!b.metadata) b.metadata = {}
                    b.metadata.region = zone
                    b.metadata.province = zone
                    b.metadata.material_zone = zone
                    b.metadata.material_zones = [zone]
                })
            }
            await healStampBoxesInDB(group.boxes)

            // 4. Ghép toàn bộ thùng của Pallet vào LOT mới
            const boxIds = group.boxes.map(b => b.id)
            const { error: boxErr } = await (supabase
                .from('box_labels') as any)
                .update({
                    lot_id: newLotId,
                    status: 'linked'
                })
                .in('id', boxIds)

            if (boxErr) {
                throw new Error(boxErr.message || boxErr.details || 'Lỗi cập nhật liên kết box_labels')
            }

            // 5. Đồng bộ ngày tháng thùng vào LOT
            try {
                await syncDatesFromBoxesToLot(newLotId, group.boxes)
            } catch (syncErr: any) {
                console.warn('Cảnh báo đồng bộ ngày tháng từ thùng vào LOT:', syncErr?.message || syncErr)
            }

            showToast(`🎉 Đã duyệt tạo thành công LOT "${finalLotCode}" cho Pallet STT ${group.pallet_stt} và kết nối ${group.boxes.length} thùng!`, 'success')
            setApproveGroup(null)
            fetchData()
        } catch (err: any) {
            const errDetail = err?.message || err?.details || (typeof err === 'object' ? JSON.stringify(err) : String(err))
            console.warn('Lỗi duyệt tạo LOT:', errDetail)
            showToast('Lỗi khi duyệt tạo LOT: ' + errDetail, 'error')
        } finally {
            setIsApproving(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: EDIT BOX
    // ─────────────────────────────────────────────────────────────
    const handleOpenEditBox = (box: BoxLabelItem) => {
        setEditingBox(box)
        setEditApplyToAllInPallet(false)
        setEditWeight(String(box.quantity || 20))
        setEditLotCode(box.semi_finished_lot_code || box.finished_lot_code || '')
        setEditBoxCode(box.code || '')
        const meta = box.metadata || {}
        setEditStampLine1(meta.stamp_line1 || '')
        setEditStampLine2(meta.stamp_line2 || '')
        setEditSpec(meta.spec || '')
        setEditShiftGroup(meta.shift_group || '')
        setEditProductionDate(meta.production_date || '')
        setEditPackagingDate(meta.packaging_date || '')
    }

    const handleSaveBoxEdit = async () => {
        if (!editingBox) return
        const w = parseFloat(editWeight)
        if (isNaN(w) || w <= 0) {
            showToast('Khối lượng không hợp lệ', 'warning')
            return
        }

        setIsSavingEdit(true)
        try {
            const isStamp = editingBox.metadata?.scan_type === 'stamp' || editingBox.code?.startsWith('STAMP-') || !!editStampLine1 || !!editStampLine2
            const currentMeta = { ...(editingBox.metadata || {}) }
            
            const updatedMeta: any = {
                ...currentMeta,
            }

            if (isStamp) {
                updatedMeta.scan_type = 'stamp'
                updatedMeta.stamp_line1 = editStampLine1.trim()
                updatedMeta.stamp_line2 = editStampLine2.trim()
                
                // Giải mã lại toàn bộ vùng (tỉnh), nhà máy (tổ), ngày ĐG, ngày NL từ Dòng 2 đã sửa
                const decoded = applyStampDecodeToMeta(updatedMeta)
                Object.assign(updatedMeta, decoded)
            } else {
                updatedMeta.spec = editSpec.trim()
                updatedMeta.shift_group = editShiftGroup.trim()
                updatedMeta.production_date = editProductionDate.trim() || null
                updatedMeta.packaging_date = editPackagingDate.trim() || null
            }

            const cleanCode = editBoxCode.trim() || editingBox.code
            const finalLot = editLotCode.trim() || (isStamp ? (editStampLine2.trim() || editingBox.semi_finished_lot_code) : editingBox.finished_lot_code)

            const updatePayload: any = {
                code: cleanCode,
                quantity: w,
                semi_finished_lot_code: finalLot,
                finished_lot_code: finalLot,
                metadata: updatedMeta
            }

            const { error } = await (supabase
                .from('box_labels') as any)
                .update(updatePayload)
                .eq('id', editingBox.id)

            if (error) throw error

            // Xác định danh sách thùng và STT của Pallet hiện tại (hỗ trợ cả tab "Đã kết nối" lẫn "Chưa kết nối")
            const currentPalletBoxes = selectedPallet ? selectedPallet.box_labels : (previewGroup ? previewGroup.boxes : [])
            const currentPalletStt = selectedPallet
                ? (selectedPallet.daily_seq ? decodeSTT(selectedPallet.daily_seq) : selectedPallet.code)
                : (previewGroup?.pallet_stt || 'PALLET')

            // Nếu người dùng chọn đồng bộ cho toàn bộ thùng trong Pallet
            if (isStamp && editApplyToAllInPallet && currentPalletBoxes.length > 1) {
                const otherBoxes = currentPalletBoxes.filter(b => b.id !== editingBox.id)
                const otherUpdates = otherBoxes.map(b => {
                    const m = { ...(b.metadata || {}) }
                    m.scan_type = 'stamp'
                    if (editStampLine1.trim()) m.stamp_line1 = editStampLine1.trim()
                    if (editStampLine2.trim()) m.stamp_line2 = editStampLine2.trim()
                    const dec = applyStampDecodeToMeta(m)
                    Object.assign(m, dec)
                    const l1 = (editStampLine1.trim() || m.stamp_line1 || '').replace(/[^a-zA-Z0-9]/g, '')
                    const l2 = (editStampLine2.trim() || m.stamp_line2 || '').replace(/[^a-zA-Z0-9]/g, '')
                    const idxStr = String(getBoxIndex(b)).padStart(3, '0')
                    const cleanStt = currentPalletStt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                    const newCode = `STAMP-${l1}-${l2}-${cleanStt}-${idxStr}`
                    return {
                        id: b.id,
                        payload: {
                            code: newCode,
                            semi_finished_lot_code: editStampLine2.trim() || b.semi_finished_lot_code,
                            finished_lot_code: editStampLine2.trim() || b.finished_lot_code,
                            metadata: m
                        }
                    }
                })
                for (let i = 0; i < otherUpdates.length; i += 15) {
                    const chunk = otherUpdates.slice(i, i + 15)
                    await Promise.all(chunk.map(u => (supabase.from('box_labels') as any).update(u.payload).eq('id', u.id)))
                }
            }

            // Nếu thùng này thuộc về một LOT đã kết nối, tự động đồng bộ ngay ngày tháng và vùng trồng vào LOT
            const targetLotId = editingBox.lot_id || (selectedPallet ? selectedPallet.id : null)
            if (targetLotId) {
                const allBoxesForSync = currentPalletBoxes.map(b => b.id === editingBox.id ? { ...b, metadata: updatedMeta, quantity: w } : b)
                await syncDatesFromBoxesToLot(targetLotId, allBoxesForSync)
            }

            showToast(
                isStamp && editApplyToAllInPallet && currentPalletBoxes.length > 1
                    ? `✅ Đã cập nhật và đồng bộ toàn bộ ${currentPalletBoxes.length} thùng của Pallet ${currentPalletStt}!`
                    : `✅ Đã cập nhật thùng #${getBoxIndex(editingBox)}!`,
                'success'
            )
            setEditingBox(null)
            await fetchData()
        } catch (err: any) {
            showToast('Lỗi lưu thùng: ' + err.message, 'error')
        } finally {
            setIsSavingEdit(false)
        }
    }

    const handleDeleteSingleBox = async (box: BoxLabelItem) => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa thùng #${getBoxIndex(box)} (${box.code}) khỏi hệ thống? Thao tác này không thể hoàn tác.`)
        if (!confirmed) return

        try {
            const { error } = await supabase
                .from('box_labels')
                .delete()
                .eq('id', box.id)

            if (error) throw error

            if (box.lot_id) {
                const { count } = await supabase.from('box_labels').select('id', { count: 'exact', head: true }).eq('lot_id', box.lot_id)
                await (supabase.from('lots') as any).update({ quantity: count || 0 }).eq('id', box.lot_id)
            }

            showToast(`Đã xóa thùng #${getBoxIndex(box)}!`, 'success')
            await fetchData()
        } catch (err: any) {
            showToast('Lỗi xóa thùng: ' + err.message, 'error')
        }
    }

    const handleOpenBulkEdit = (group: UnlinkedPalletGroup) => {
        const firstBox = group.boxes[0]
        const meta = firstBox?.metadata || {}
        
        setBulkScope(selectedBoxIds.size > 0 ? 'selected' : 'all')
        setBulkStampLine1(meta.stamp_line1 || '')
        setBulkStampLine2(meta.stamp_line2 || '')
        setBulkLotCode(firstBox?.semi_finished_lot_code || firstBox?.finished_lot_code || '')
        setBulkWeight(String(firstBox?.quantity || 20))
        setBulkSpec(meta.spec || '')
        setBulkShiftGroup(meta.shift_group || '')
        setBulkProductionDate(meta.production_date || '')
        setBulkPackagingDate(meta.packaging_date || '')
        setBulkRegenerateCode(true)
        setIsBulkEditOpen(true)
    }

    const handleSaveBulkEdit = async () => {
        if (!previewGroup) return
        
        const targetBoxes = (bulkScope === 'selected' && selectedBoxIds.size > 0)
            ? previewGroup.boxes.filter(b => selectedBoxIds.has(b.id))
            : previewGroup.boxes

        if (targetBoxes.length === 0) {
            showToast('Không có thùng nào để cập nhật', 'warning')
            return
        }

        setIsSavingBulkEdit(true)
        try {
            const w = bulkWeight.trim() ? parseFloat(bulkWeight) : null
            if (w !== null && (isNaN(w) || w <= 0)) {
                showToast('Khối lượng nhập vào không hợp lệ', 'warning')
                setIsSavingBulkEdit(false)
                return
            }

            const isStamp = previewGroup.boxes.some(b => b.metadata?.scan_type === 'stamp' || b.code?.startsWith('STAMP-'))

            const updates = targetBoxes.map(b => {
                const meta = { ...(b.metadata || {}) }
                if (isStamp) {
                    meta.scan_type = 'stamp'
                    if (bulkStampLine1.trim()) meta.stamp_line1 = bulkStampLine1.trim()
                    if (bulkStampLine2.trim()) meta.stamp_line2 = bulkStampLine2.trim()
                    // Giải mã lại toàn bộ vùng (tỉnh), nhà máy (tổ), ngày ĐG, ngày NL từ Dòng 2 mới
                    const decoded = applyStampDecodeToMeta(meta)
                    Object.assign(meta, decoded)
                } else {
                    if (bulkSpec.trim()) meta.spec = bulkSpec.trim()
                    if (bulkShiftGroup.trim()) meta.shift_group = bulkShiftGroup.trim()
                    if (bulkProductionDate.trim()) meta.production_date = bulkProductionDate.trim()
                    if (bulkPackagingDate.trim()) meta.packaging_date = bulkPackagingDate.trim()
                }

                let finalLot = b.finished_lot_code || b.semi_finished_lot_code
                if (bulkLotCode.trim()) {
                    finalLot = bulkLotCode.trim()
                } else if (isStamp && bulkStampLine2.trim()) {
                    finalLot = bulkStampLine2.trim()
                }

                let finalCode = b.code
                if (bulkRegenerateCode) {
                    const l1 = meta.stamp_line1 || ''
                    const l2 = meta.stamp_line2 || ''
                    const idxStr = String(getBoxIndex(b)).padStart(3, '0')
                    const cleanStt = (previewGroup.pallet_stt || 'PALLET').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                    if (isStamp) {
                        const cleanL1 = l1.replace(/[^a-zA-Z0-9]/g, '')
                        const cleanL2 = l2.replace(/[^a-zA-Z0-9]/g, '')
                        finalCode = `STAMP-${cleanL1}-${cleanL2}-${cleanStt}-${idxStr}`
                    } else {
                        const cleanLot = (finalLot || 'LOT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                        const cleanSku = (meta.sku || b.products?.sku || 'SKU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                        finalCode = `BOX-${cleanLot}-${cleanSku}-${cleanStt}-${idxStr}`
                    }
                }

                const payload: any = {
                    metadata: meta,
                    code: finalCode,
                    semi_finished_lot_code: finalLot,
                    finished_lot_code: finalLot
                }
                if (w !== null) {
                    payload.quantity = w
                }

                return {
                    id: b.id,
                    payload
                }
            })

            const chunkSize = 15
            for (let i = 0; i < updates.length; i += chunkSize) {
                const chunk = updates.slice(i, i + chunkSize)
                await Promise.all(
                    chunk.map(item =>
                        (supabase.from('box_labels') as any).update(item.payload).eq('id', item.id)
                    )
                )
            }

            showToast(`🎉 Đã cập nhật thành công ${targetBoxes.length} thùng!`, 'success')
            setIsBulkEditOpen(false)
            setSelectedBoxIds(new Set())
            await fetchData()
        } catch (err: any) {
            showToast('Lỗi cập nhật hàng loạt: ' + err.message, 'error')
        } finally {
            setIsSavingBulkEdit(false)
        }
    }

    const handleOpenEditPalletInfo = (group: UnlinkedPalletGroup) => {
        setEditingPalletInfoGroup(group)
        setEditPalletSTT(group.pallet_stt)
        setEditPalletTag(group.pallet_tag || '')
        setEditPalletNotes(group.pallet_notes || '')
    }

    const handleSavePalletInfo = async () => {
        if (!editingPalletInfoGroup) return
        const newStt = editPalletSTT.trim().toUpperCase()
        if (!newStt) {
            showToast('Mã STT Pallet không được để trống', 'warning')
            return
        }

        setIsSavingPalletInfo(true)
        try {
            const cleanTag = editPalletTag.trim() ? editPalletTag.trim().toUpperCase() : null
            const cleanNotes = editPalletNotes.trim() ? editPalletNotes.trim() : null

            const updates = editingPalletInfoGroup.boxes.map(b => {
                const meta = { ...(b.metadata || {}) }
                meta.pallet_stt = newStt
                meta.tag = cleanTag
                meta.pallet_notes = cleanNotes
                meta.notes = cleanNotes

                let code = b.code
                if (newStt !== editingPalletInfoGroup.pallet_stt) {
                    const oldSttClean = editingPalletInfoGroup.pallet_stt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                    const newSttClean = newStt.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                    code = code.replace(`-${oldSttClean}-`, `-${newSttClean}-`)
                }

                return {
                    id: b.id,
                    payload: {
                        metadata: meta,
                        code
                    }
                }
            })

            const chunkSize = 15
            for (let i = 0; i < updates.length; i += chunkSize) {
                const chunk = updates.slice(i, i + chunkSize)
                await Promise.all(
                    chunk.map(item =>
                        (supabase.from('box_labels') as any).update(item.payload).eq('id', item.id)
                    )
                )
            }

            showToast(`✅ Đã cập nhật thông tin Pallet STT ${newStt}!`, 'success')
            setEditingPalletInfoGroup(null)
            await fetchData()
        } catch (err: any) {
            showToast('Lỗi cập nhật Pallet: ' + err.message, 'error')
        } finally {
            setIsSavingPalletInfo(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // ACTIONS: EXCEL EXPORT
    // ─────────────────────────────────────────────────────────────
    const handleExportExcel = async (pallet: PalletLot) => {
        setIsExporting(true)
        try {
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
            showToast('Xuất báo cáo Excel Pallet thành công!', 'success')
        } catch (err: any) {
            console.error('Export Excel Error:', err)
            showToast('Lỗi xuất Excel: ' + err.message, 'error')
        } finally {
            setIsExporting(false)
        }
    }

    // ─────────────────────────────────────────────────────────────
    // FILTERED LISTS
    // ─────────────────────────────────────────────────────────────
    const filteredLinkedPallets = useMemo(() => {
        if (!searchQuery.trim()) return linkedPallets
        return linkedPallets.filter(p => {
            const stt = p.daily_seq ? decodeSTT(p.daily_seq) : ''
            return (
                advancedMatchSearch(p.code, searchQuery) ||
                advancedMatchSearch(stt, searchQuery) ||
                (p.production_code && advancedMatchSearch(p.production_code, searchQuery)) ||
                (p.products?.name && advancedMatchSearch(p.products.name, searchQuery))
            )
        })
    }, [linkedPallets, searchQuery])

    const filteredUnlinkedGroups = useMemo(() => {
        let result = unlinkedGroups

        // 1. Lọc theo thời gian quét
        if (unlinkedDateFilter !== 'all') {
            const now = new Date()
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
            
            result = result.filter(g => {
                const groupTime = new Date(g.created_at).getTime()
                if (unlinkedDateFilter === 'today') {
                    return groupTime >= startOfToday
                }
                if (unlinkedDateFilter === '3days') {
                    return groupTime >= startOfToday - 2 * 86400000
                }
                if (unlinkedDateFilter === '7days') {
                    return groupTime >= startOfToday - 6 * 86400000
                }
                return true
            })
        }

        // 2. Tìm kiếm theo STT, Tag, Ghi chú
        if (searchQuery.trim()) {
            result = result.filter(g =>
                advancedMatchSearch(g.pallet_stt, searchQuery) ||
                (g.pallet_tag && advancedMatchSearch(g.pallet_tag, searchQuery)) ||
                (g.pallet_notes && advancedMatchSearch(g.pallet_notes, searchQuery))
            )
        }

        return result
    }, [unlinkedGroups, searchQuery, unlinkedDateFilter])

    // Phân trang danh sách Pallet chưa kết nối (chuẩn theo số lượng Pallet)
    const totalUnlinkedPages = useMemo(() => {
        if (unlinkedPageSize <= 0) return 1
        return Math.max(1, Math.ceil(filteredUnlinkedGroups.length / unlinkedPageSize))
    }, [filteredUnlinkedGroups.length, unlinkedPageSize])

    const paginatedUnlinkedGroups = useMemo(() => {
        if (unlinkedPageSize <= 0) return filteredUnlinkedGroups
        const start = (unlinkedPage - 1) * unlinkedPageSize
        return filteredUnlinkedGroups.slice(start, start + unlinkedPageSize)
    }, [filteredUnlinkedGroups, unlinkedPage, unlinkedPageSize])

    const filteredBoxes = useMemo(() => {
        if (!selectedPallet) return []
        if (!boxSearchQuery.trim()) return selectedPallet.box_labels
        return selectedPallet.box_labels.filter(b => {
            const idx = getBoxIndex(b)
            return (
                advancedMatchSearch(b.code, boxSearchQuery) ||
                advancedMatchSearch(idx, boxSearchQuery) ||
                (b.finished_lot_code && advancedMatchSearch(b.finished_lot_code, boxSearchQuery)) ||
                (b.metadata?.sku && advancedMatchSearch(b.metadata.sku, boxSearchQuery)) ||
                (b.metadata?.shift_group && advancedMatchSearch(b.metadata.shift_group, boxSearchQuery))
            )
        })
    }, [selectedPallet, boxSearchQuery])

    const filteredLotsForModal = useMemo(() => {
        if (!linkLotSearch.trim()) return allActiveLots.slice(0, 20)
        return allActiveLots.filter(l => {
            const stt = l.daily_seq ? decodeSTT(l.daily_seq) : ''
            return (
                advancedMatchSearch(l.code, linkLotSearch) ||
                advancedMatchSearch(stt, linkLotSearch) ||
                (l.product_name && advancedMatchSearch(l.product_name, linkLotSearch))
            )
        }).slice(0, 20)
    }, [allActiveLots, linkLotSearch])

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-2 md:p-3 bg-stone-50/50 dark:bg-zinc-950 font-sans">
            {/* ── HEADER (Thu gọn tối đa để nhường diện tích cho danh sách) ──────── */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2 border-b border-stone-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <Layers size={16} />
                    </div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-sm md:text-base font-black text-stone-900 dark:text-zinc-100 tracking-tight">
                            Quản lý Pallet Quét
                        </h1>
                        <span className="hidden lg:inline text-[11px] text-stone-400 dark:text-zinc-500">
                            · Đồng bộ theo STT
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {/* Tab Navigation */}
                    <div className="flex items-center p-0.5 bg-stone-200/60 dark:bg-zinc-800/80 rounded-lg">
                        <button
                            onClick={() => { setActiveTab('linked'); setShowMobileDetail(false); }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                activeTab === 'linked'
                                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            <CheckCircle2 size={13} />
                            <span>Đã kết nối</span>
                            <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                {linkedPallets.length}
                            </span>
                        </button>

                        <button
                            onClick={() => { setActiveTab('unlinked'); setShowMobileDetail(false); }}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                                activeTab === 'unlinked'
                                    ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            <Unlink size={13} />
                            <span>Chưa kết nối</span>
                            {unlinkedGroups.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-extrabold animate-pulse">
                                    {unlinkedGroups.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        title="Tải lại dữ liệu"
                        className="p-1.5 text-stone-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* ── MAIN CONTENT (2 PANELS) ────────────────────────── */}
            {activeTab === 'linked' ? (
                /* TAB 1: ĐÃ KẾT NỐI */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                    {/* PANEL TRÁI: DANH SÁCH LOT / PALLET ĐÃ KẾT NỐI (4 Cols) */}
                    <div className={`lg:col-span-4 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden ${showMobileDetail ? 'hidden lg:flex' : 'flex'}`}>
                        {/* Search Bar */}
                        <div className="p-3 border-b border-stone-100 dark:border-zinc-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                                <input
                                    type="text"
                                    placeholder="Tìm theo STT (C544, F3219...), mã LOT..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-stone-50 dark:bg-zinc-800/60 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Pallet List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800/60 p-2 space-y-1.5">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                                    <Loader2 className="animate-spin mb-2" size={24} />
                                    <span className="text-xs">Đang tải danh sách Pallet...</span>
                                </div>
                            ) : filteredLinkedPallets.length === 0 ? (
                                <div className="text-center py-16 px-4">
                                    <Layers className="mx-auto text-stone-300 dark:text-zinc-600 mb-2" size={36} />
                                    <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                        Không tìm thấy Pallet nào đã kết nối
                                    </p>
                                    <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-1">
                                        Hãy quét tem và đồng bộ từ App di động, hoặc kiểm tra tab "Chưa kết nối".
                                    </p>
                                </div>
                            ) : (
                                filteredLinkedPallets.map(pallet => {
                                    const isSelected = selectedPallet?.id === pallet.id
                                    const count = pallet.box_labels.length
                                    const isFull = count >= 30
                                    const totalWeight = pallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0)
                                    const sttDisplay = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : pallet.code

                                    return (
                                        <div
                                            key={pallet.id}
                                            onClick={() => {
                                                setSelectedPallet(pallet)
                                                setShowMobileDetail(true)
                                            }}
                                            className={`p-3 rounded-xl cursor-pointer transition-all border ${
                                                isSelected
                                                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/40 shadow-xs'
                                                    : 'bg-white dark:bg-zinc-900 border-stone-100 dark:border-zinc-800 hover:border-emerald-300 dark:hover:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40">
                                                        STT: {sttDisplay}
                                                    </span>
                                                    <span className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                                                        ({pallet.code})
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {pallet.status === 'exported' && (
                                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                            Đã xuất kho
                                                        </span>
                                                    )}
                                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                                        isFull
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                                    }`}>
                                                        {count}/30 thùng
                                                    </span>
                                                </div>
                                            </div>

                                            <p className="text-xs font-bold text-stone-800 dark:text-zinc-200 truncate mb-2">
                                                {pallet.products?.name || 'Sản phẩm chưa định danh'}
                                            </p>

                                            {/* Progress Bar 30 boxes */}
                                            <div className="w-full bg-stone-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-2">
                                                <div
                                                    className={`h-full transition-all duration-300 ${isFull ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                    style={{ width: `${Math.min(100, (count / 30) * 100)}%` }}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-zinc-400 pt-1 border-t border-stone-100 dark:border-zinc-800/60">
                                                <span>KL: <strong className="text-stone-800 dark:text-zinc-200">{totalWeight.toFixed(1)} Kg</strong></span>
                                                <span>{new Date(pallet.created_at).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* PANEL PHẢI: CHI TIẾT 30 THÙNG CỦA PALLET ĐANG CHỌN (8 Cols) */}
                    <div className={`lg:col-span-8 flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden ${showMobileDetail ? 'flex' : 'hidden lg:flex'}`}>
                        {!selectedPallet ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-stone-400 py-20">
                                <Layers size={40} className="text-stone-300 dark:text-zinc-600 mb-2" />
                                <p className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                    Chọn một Pallet ở cột bên trái để xem chi tiết 30 thùng
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Header Panel Phải */}
                                <div className="p-4 border-b border-stone-100 dark:border-zinc-800 bg-stone-50/50 dark:bg-zinc-900/50">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowMobileDetail(false)}
                                                className="lg:hidden p-1.5 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-stone-100"
                                            >
                                                <ArrowLeft size={18} />
                                            </button>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="text-lg font-black text-stone-900 dark:text-zinc-100">
                                                        Pallet STT: {selectedPallet.daily_seq ? decodeSTT(selectedPallet.daily_seq) : selectedPallet.code}
                                                    </h2>
                                                    <span className="font-mono text-xs text-stone-500 dark:text-zinc-400">
                                                        [LOT: {selectedPallet.code}]
                                                    </span>
                                                    {selectedPallet.status === 'exported' && (
                                                        <span className="text-[11px] font-black px-2 py-0.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                            🚢 Đã xuất kho / Đã bán
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-stone-600 dark:text-zinc-400 font-medium">
                                                    {selectedPallet.products?.name || 'Chưa gán tên sản phẩm'} · Tiến độ: {selectedPallet.box_labels.length}/30 thùng · Tổng: {selectedPallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0).toFixed(1)} Kg
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleExportExcel(selectedPallet)}
                                                disabled={isExporting}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                                            >
                                                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                                                <span>Xuất Excel Pallet</span>
                                            </button>

                                            <button
                                                onClick={() => handleUnlinkEntirePallet(selectedPallet)}
                                                title="Hủy liên kết Pallet (Chuyển về Chưa kết nối)"
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                                            >
                                                <Unlink size={14} />
                                                <span>Hủy liên kết LOT</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search thùng */}
                                    <div className="mt-3 relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="Tìm nhanh trong 30 thùng: STT, mã thùng, quy cách, tổ..."
                                            value={boxSearchQuery}
                                            onChange={e => setBoxSearchQuery(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                        />
                                    </div>
                                </div>

                                {/* Danh sách 30 thẻ thùng */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    {filteredBoxes.length === 0 ? (
                                        <div className="text-center py-12 text-stone-400 text-xs">
                                            Không có thùng nào khớp với từ khóa tìm kiếm.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                            {filteredBoxes.map(box => {
                                                const idx = getBoxIndex(box)
                                                const meta = box.metadata || {}

                                                return (
                                                    <div
                                                        key={box.id}
                                                        className="p-3 bg-stone-50/70 dark:bg-zinc-800/40 rounded-xl border border-stone-200/80 dark:border-zinc-800 hover:border-emerald-400 transition-all group"
                                                    >
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-7 h-7 flex items-center justify-center font-black text-xs bg-emerald-600 text-white rounded-lg">
                                                                    #{idx}
                                                                </span>
                                                                <div>
                                                                    <p className="font-mono font-bold text-xs text-stone-800 dark:text-zinc-200 truncate max-w-[130px]" title={box.code}>
                                                                        {box.code}
                                                                    </p>
                                                                    <p className="text-[10px] text-stone-500">
                                                                        LOT: <strong className="text-stone-700 dark:text-zinc-300">{box.finished_lot_code || box.semi_finished_lot_code || '---'}</strong>
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleOpenEditBox(box)}
                                                                    title="Sửa thông tin thùng"
                                                                    className="p-1 text-stone-400 hover:text-emerald-600 rounded-md hover:bg-white dark:hover:bg-zinc-700"
                                                                >
                                                                    <Edit3 size={13} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleUnlinkBox(box)}
                                                                    disabled={isUnlinkingId === box.id}
                                                                    title="Gỡ thùng này ra khỏi Pallet"
                                                                    className="p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-white dark:hover:bg-zinc-700 disabled:opacity-50"
                                                                >
                                                                    {isUnlinkingId === box.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Metadata Details (Hỗ trợ cả Tem In OCR lẫn Dấu Đóng Mực) */}
                                                        {meta.scan_type === 'stamp' ? (
                                                            <div className="bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[10px] space-y-1 mb-2">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-extrabold text-[10px] text-amber-700 dark:text-amber-400">📦 ĐÓNG DẤU MỰC</span>
                                                                    <span className="font-mono text-stone-500">#{idx}</span>
                                                                </div>
                                                                <p className="truncate"><strong className="text-stone-500">Dòng 1:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line1 || '---'}</span></p>
                                                                <p className="truncate"><strong className="text-stone-500">Dòng 2:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line2 || '---'}</span></p>
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-1 text-[10px] bg-white dark:bg-zinc-800/80 p-2 rounded-lg border border-stone-100 dark:border-zinc-700/60 mb-2">
                                                                <div>
                                                                    <span className="text-stone-400 block">Quy cách:</span>
                                                                    <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.spec || '---'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-400 block">Tổ / Ca:</span>
                                                                    <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.shift_group || '---'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-400 block">Ngày SX:</span>
                                                                    <span className="font-bold text-amber-600 dark:text-amber-400 truncate block">{meta.production_date || '---'}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-stone-400 block">Ngày ĐG:</span>
                                                                    <span className="font-bold text-stone-700 dark:text-zinc-300 truncate block">{meta.packaging_date || '---'}</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between text-[11px] pt-1">
                                                            <span className="text-stone-400 text-[10px]">Trọng lượng:</span>
                                                            <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                                                                {Number(box.quantity || 20).toFixed(1)} {box.unit}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                /* TAB 2: CHƯA KẾT NỐI (Chờ kết nối LOT) */
                <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-zinc-900 rounded-2xl border border-stone-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                    {/* Toolbar tab Chưa kết nối - Thiết kế siêu gọn gàng trên 1 hàng duy nhất */}
                    <div className="px-3 py-1.5 border-b border-stone-100 dark:border-zinc-800 bg-amber-50/40 dark:bg-amber-950/20 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center gap-1 text-xs font-black text-amber-800 dark:text-amber-300">
                                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                <span>Chờ kết nối ({filteredUnlinkedGroups.length})</span>
                            </span>

                            <button
                                onClick={handleAutoLinkAll}
                                disabled={isAutoLinking || unlinkedGroups.filter(g => !!g.matchedLot).length === 0}
                                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-40"
                                title="Tự động kết nối tất cả các nhóm đã khớp STT"
                            >
                                {isAutoLinking ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                                <span>Tự động kết nối ({unlinkedGroups.filter(g => !!g.matchedLot).length})</span>
                            </button>
                        </div>

                        {/* Date Filter & Search & Chuyển đổi Dạng Lưới / Dạng Danh Sách */}
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end">
                            {/* Date Filter Pill Group */}
                            <div className="flex items-center gap-0.5 bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-[11px] shrink-0">
                                <button
                                    type="button"
                                    onClick={() => { setUnlinkedDateFilter('all'); setUnlinkedPage(1); }}
                                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                        unlinkedDateFilter === 'all'
                                            ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                            : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                                    }`}
                                >
                                    Tất cả
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setUnlinkedDateFilter('today'); setUnlinkedPage(1); }}
                                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                        unlinkedDateFilter === 'today'
                                            ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                            : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                                    }`}
                                >
                                    Hôm nay
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setUnlinkedDateFilter('3days'); setUnlinkedPage(1); }}
                                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                        unlinkedDateFilter === '3days'
                                            ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                            : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                                    }`}
                                >
                                    3 ngày
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setUnlinkedDateFilter('7days'); setUnlinkedPage(1); }}
                                    className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                                        unlinkedDateFilter === '7days'
                                            ? 'bg-white dark:bg-zinc-700 text-stone-900 dark:text-zinc-100 shadow-2xs'
                                            : 'text-stone-500 hover:text-stone-800 dark:text-zinc-400'
                                    }`}
                                >
                                    7 ngày
                                </button>
                            </div>

                            <div className="relative flex-1 min-w-[130px] max-w-[190px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" size={13} />
                                <input
                                    type="text"
                                    placeholder="Tìm STT (G56...)..."
                                    value={searchQuery}
                                    onChange={e => { setSearchQuery(e.target.value); setUnlinkedPage(1); }}
                                    className="w-full pl-8 pr-2.5 py-1 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </div>
                            
                            <div className="flex items-center gap-0.5 bg-white dark:bg-zinc-800 p-0.5 rounded-lg border border-stone-200 dark:border-zinc-700 shrink-0 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setUnlinkedViewMode('grid')}
                                    className={`flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                                        unlinkedViewMode === 'grid'
                                            ? 'bg-amber-500 text-white shadow-2xs'
                                            : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-700'
                                    }`}
                                    title="Xem dạng thẻ (3 cột - hiển thị nhiều hàng)"
                                >
                                    <LayoutGrid size={12} />
                                    <span>Thẻ</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUnlinkedViewMode('table')}
                                    className={`flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded transition-all cursor-pointer ${
                                        unlinkedViewMode === 'table'
                                            ? 'bg-amber-500 text-white shadow-2xs'
                                            : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-700'
                                    }`}
                                    title="Xem dạng danh sách hàng ngang (nhiều hàng nhất)"
                                >
                                    <List size={12} />
                                    <span>Bảng</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Danh sách Pallet chưa kết nối */}
                    <div className="flex-1 overflow-y-auto p-2 md:p-2.5">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 text-stone-400">
                                <Loader2 className="animate-spin mb-2" size={24} />
                                <span className="text-xs">Đang tải danh sách chờ kết nối...</span>
                            </div>
                        ) : filteredUnlinkedGroups.length === 0 ? (
                            <div className="text-center py-16 px-4">
                                <CheckCircle2 className="mx-auto text-emerald-500 mb-2" size={36} />
                                <p className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                                    Tuyệt vời! Không có Pallet nào đang chờ kết nối
                                </p>
                                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-md mx-auto">
                                    Mọi đợt quét từ điện thoại đều đã được ghép đúng vào các LOT hàng trên Web mẹ.
                                </p>
                            </div>
                        ) : unlinkedViewMode === 'table' ? (
                            /* DẠNG BẢNG DANH SÁCH HÀNG NGANG: Hiển thị 12-15 hàng rõ ràng */
                            <div className="border border-stone-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-stone-50 dark:bg-zinc-800/70 border-b border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-zinc-300 text-[11px] uppercase font-bold">
                                        <tr>
                                            <th className="py-2 px-3">STT</th>
                                            <th className="py-2 px-3">Số lượng & Khối lượng</th>
                                            <th className="py-2 px-3">Ghi chú / Thẻ</th>
                                            <th className="py-2 px-3">Trạng thái</th>
                                            <th className="py-2 px-3 text-right">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                        {paginatedUnlinkedGroups.map((group) => {
                                            const hasMatch = !!group.matchedLot
                                            return (
                                                <tr key={group.pallet_stt} className="hover:bg-amber-50/30 dark:hover:bg-zinc-800/40 transition-colors">
                                                    <td className="py-1.5 px-3 font-mono font-black text-stone-900 dark:text-zinc-100">
                                                        <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 text-xs shadow-2xs">
                                                            {group.pallet_stt}
                                                        </span>
                                                    </td>
                                                    <td className="py-1.5 px-3">
                                                        <span className="font-bold text-stone-700 dark:text-zinc-300">{group.boxes.length} thùng</span>
                                                        <span className="mx-1.5 text-stone-300 dark:text-zinc-600">·</span>
                                                        <span className="font-black text-emerald-600 dark:text-emerald-400">{group.total_weight.toFixed(1)} Kg</span>
                                                    </td>
                                                    <td className="py-1.5 px-3">
                                                        {group.pallet_tag && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 dark:text-orange-400 bg-orange-100/70 dark:bg-orange-950/40 px-1.5 py-0.2 rounded border border-orange-200 dark:border-orange-800 mr-1.5">
                                                                <Tag size={10} /> {group.pallet_tag}
                                                            </span>
                                                        )}
                                                        {group.pallet_notes ? (
                                                            <span className="text-[11px] text-stone-600 dark:text-zinc-400 font-medium">
                                                                📝 {group.pallet_notes}
                                                            </span>
                                                        ) : (
                                                            <span className="text-stone-300 dark:text-zinc-600 text-[11px]">---</span>
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 px-3">
                                                        {group.isConflict ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                                                <AlertTriangle size={11} /> Trùng STT: {group.matchedLot!.code}
                                                            </span>
                                                        ) : hasMatch ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                                                <Check size={11} /> Khớp LOT: {group.matchedLot!.code}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                                <Clock size={11} /> Chờ duyệt LOT
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-1.5 px-3 text-right">
                                                        <div className="inline-flex items-center gap-1">
                                                            {group.isConflict ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleUpdateConflictLot(group, group.matchedLot!.id)}
                                                                        disabled={isLinking}
                                                                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                                                                    >
                                                                        Gộp
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleOpenApproveModal(group)}
                                                                        className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold transition-all cursor-pointer"
                                                                    >
                                                                        Tách
                                                                    </button>
                                                                </>
                                                            ) : hasMatch ? (
                                                                <button
                                                                    onClick={() => handleLinkGroupToLot(group, group.matchedLot!.id)}
                                                                    disabled={isLinking}
                                                                    className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                                                >
                                                                    <Check size={11} />
                                                                    <span>Ghép {group.matchedLot!.code}</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleOpenApproveModal(group)}
                                                                    className="px-2.5 py-0.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                                                                >
                                                                    <Sparkles size={11} />
                                                                    <span>⚡ Duyệt Tạo LOT</span>
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => {
                                                                    setSelectedBoxIds(new Set())
                                                                    setPreviewGroup(group)
                                                                }}
                                                                className="p-1 text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                                                                title="Xem chi tiết các thùng"
                                                            >
                                                                <Eye size={12} />
                            								</button>

                                                            <button
                                                                onClick={() => {
                                                                    setGroupToLink(group)
                                                                    setLinkLotSearch('')
                                                                    setSelectedLotForLink(group.matchedLot?.id || null)
                                                                }}
                                                                className="p-1 text-stone-500 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded cursor-pointer"
                                                                title="Ghép thủ công vào LOT khác"
                                                            >
                                                                <Link2 size={12} />
                                                            </button>

                                                            <button
                                                                onClick={() => handleDeleteUnlinkedGroup(group)}
                                                                className="p-1 text-stone-400 hover:text-rose-600 rounded cursor-pointer"
                                                                title="Xóa đợt này"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* DẠNG THẺ SIÊU GỌN: 3 cột, mỗi thẻ chỉ cao ~70px -> Hiển thị trọn vẹn 3-5 hàng (9-15 LOT) cùng lúc mà không cần cuộn chuột */
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {paginatedUnlinkedGroups.map(group => {
                                    const hasMatch = !!group.matchedLot
                                    return (
                                        <div
                                            key={group.pallet_stt}
                                            className={`p-2 rounded-xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-xs ${
                                                hasMatch
                                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                                    : 'bg-white dark:bg-zinc-800/70 border-stone-200 dark:border-zinc-700'
                                            }`}
                                        >
                                            {/* Dòng 1: STT, Số thùng, Khối lượng, Ghi chú + Cụm nút thao tác */}
                                            <div className="flex items-center justify-between gap-1 mb-1.5">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                                    <span className="font-mono font-black text-xs text-stone-900 dark:text-zinc-100 bg-stone-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded border border-stone-200 dark:border-zinc-600 shadow-2xs shrink-0">
                                                        STT: {group.pallet_stt}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-stone-600 dark:text-zinc-300 shrink-0">
                                                        {group.boxes.length} th
                                                    </span>
                                                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                                        {group.total_weight.toFixed(1)} Kg
                                                    </span>
                                                    {group.pallet_tag && (
                                                        <span className="text-[9px] font-bold text-orange-700 dark:text-orange-400 bg-orange-100/90 dark:bg-orange-950/60 px-1 py-0.2 rounded border border-orange-200 dark:border-orange-800 shrink-0">
                                                            {group.pallet_tag}
                                                        </span>
                                                    )}
                                                    {group.pallet_notes && (
                                                        <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100/90 dark:bg-blue-950/60 px-1 py-0.2 rounded border border-blue-200 dark:border-blue-800 max-w-[80px] truncate shrink-0" title={group.pallet_notes}>
                                                            📝 {group.pallet_notes}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Cụm icon phụ: xem thùng, ghép LOT, xóa */}
                                                <div className="flex items-center gap-0.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedBoxIds(new Set())
                                                            setPreviewGroup(group)
                                                        }}
                                                        className="p-1 text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                                                        title={`Xem chi tiết ${group.boxes.length} thùng`}
                                                    >
                                                        <Eye size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setGroupToLink(group)
                                                            setLinkLotSearch('')
                                                            setSelectedLotForLink(group.matchedLot?.id || null)
                                                        }}
                                                        className="p-1 text-stone-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                                                        title="Ghép thủ công vào LOT khác"
                                                    >
                                                        <Link2 size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteUnlinkedGroup(group)}
                                                        className="p-1 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors cursor-pointer"
                                                        title="Xóa đợt quét này"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Dòng 2: Nút hành động chính */}
                                            {group.isConflict ? (
                                                <div className="flex items-center justify-between gap-1 p-1 bg-amber-500/10 dark:bg-amber-950/40 rounded border border-amber-500/30 text-[10px]">
                                                    <span className="font-bold text-amber-800 dark:text-amber-300 truncate max-w-[120px]" title={`Trùng STT: ${group.matchedLot!.code}`}>
                                                        ⚠️ Trùng: {group.matchedLot!.code}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => handleUpdateConflictLot(group, group.matchedLot!.id)}
                                                            disabled={isLinking}
                                                            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer"
                                                            title="Gộp / Cập nhật vào LOT"
                                                        >
                                                            Gộp
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenApproveModal(group)}
                                                            className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold cursor-pointer"
                                                            title="Tách LOT mới riêng"
                                                        >
                                                            Tách
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : hasMatch ? (
                                                <button
                                                    onClick={() => handleLinkGroupToLot(group, group.matchedLot!.id)}
                                                    disabled={isLinking}
                                                    className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-98"
                                                >
                                                    <Check size={12} />
                                                    <span className="truncate">Ghép vào LOT {group.matchedLot!.code}</span>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleOpenApproveModal(group)}
                                                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg font-bold text-xs shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-98"
                                                >
                                                    <Sparkles size={12} />
                                                    <span>⚡ Duyệt Tạo LOT Ngay</span>
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Thanh Phân Trang Cố Định (Pagination Bar) */}
                    {filteredUnlinkedGroups.length > 0 && (
                        <div className="px-3 py-1.5 border-t border-stone-200 dark:border-zinc-800 bg-stone-50/90 dark:bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 text-stone-500 dark:text-zinc-400">
                                <span>
                                    Hiển thị <strong>{(unlinkedPage - 1) * unlinkedPageSize + 1} - {Math.min(unlinkedPage * unlinkedPageSize, filteredUnlinkedGroups.length)}</strong> trong <strong>{filteredUnlinkedGroups.length}</strong> Pallet
                                </span>
                                
                                <select
                                    value={unlinkedPageSize}
                                    onChange={e => {
                                        setUnlinkedPageSize(Number(e.target.value))
                                        setUnlinkedPage(1)
                                    }}
                                    className="px-1.5 py-0.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-bold text-stone-700 dark:text-zinc-300"
                                >
                                    <option value={18}>18 Pallet / trang (6 hàng)</option>
                                    <option value={30}>30 Pallet / trang (10 hàng)</option>
                                    <option value={60}>60 Pallet / trang</option>
                                    <option value={9999}>Xem tất cả</option>
                                </select>
                            </div>

                            {totalUnlinkedPages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setUnlinkedPage(p => Math.max(1, p - 1))}
                                        disabled={unlinkedPage <= 1}
                                        className="px-2 py-0.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-stone-700 dark:text-zinc-300 hover:bg-stone-100 disabled:opacity-40 cursor-pointer transition-colors"
                                    >
                                        ← Trước
                                    </button>

                                    <div className="flex items-center gap-0.5">
                                        {Array.from({ length: totalUnlinkedPages }, (_, i) => i + 1)
                                            .filter(page => page === 1 || page === totalUnlinkedPages || Math.abs(page - unlinkedPage) <= 1)
                                            .map((page, idx, arr) => {
                                                const prevPage = arr[idx - 1]
                                                return (
                                                    <span key={page} className="flex items-center">
                                                        {prevPage && page - prevPage > 1 && (
                                                            <span className="px-1 text-stone-400">...</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => setUnlinkedPage(page)}
                                                            className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs cursor-pointer transition-all ${
                                                                unlinkedPage === page
                                                                    ? 'bg-amber-500 text-white shadow-2xs'
                                                                    : 'text-stone-600 dark:text-zinc-400 hover:bg-stone-200 dark:hover:bg-zinc-800'
                                                            }`}
                                                        >
                                                            {page}
                                                        </button>
                                                    </span>
                                                )
                                            })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setUnlinkedPage(p => Math.min(totalUnlinkedPages, p + 1))}
                                        disabled={unlinkedPage >= totalUnlinkedPages}
                                        className="px-2 py-0.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-stone-700 dark:text-zinc-300 hover:bg-stone-100 disabled:opacity-40 cursor-pointer transition-colors"
                                    >
                                        Sau →
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── MODAL CHỌN LÔ ĐỂ GHÉP NỐI THỦ CÔNG ──────────────── */}
            {groupToLink && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                                    Ghép Pallet STT: {groupToLink.pallet_stt} vào LOT
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Tổng cộng {groupToLink.boxes.length} thùng ({groupToLink.total_weight.toFixed(1)} Kg)
                                </p>
                            </div>
                            <button
                                onClick={() => setGroupToLink(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search Lots */}
                        <div className="my-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                                <input
                                    type="text"
                                    placeholder="Tìm mã LOT, STT, tên sản phẩm..."
                                    value={linkLotSearch}
                                    onChange={e => setLinkLotSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        {/* List of Lots to choose */}
                        <div className="flex-1 overflow-y-auto divide-y divide-stone-100 dark:divide-zinc-800 space-y-1 my-2">
                            {filteredLotsForModal.length === 0 ? (
                                <p className="text-center py-8 text-xs text-stone-400">
                                    Không tìm thấy LOT nào phù hợp.
                                </p>
                            ) : (
                                filteredLotsForModal.map(lot => {
                                    const isSelected = selectedLotForLink === lot.id
                                    const lotStt = lot.daily_seq ? decodeSTT(lot.daily_seq) : ''
                                    return (
                                        <div
                                            key={lot.id}
                                            onClick={() => setSelectedLotForLink(lot.id)}
                                            className={`p-3 rounded-xl cursor-pointer transition-all border ${
                                                isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500'
                                                    : 'hover:bg-stone-50 dark:hover:bg-zinc-800/60 border-transparent'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-xs text-stone-900 dark:text-zinc-100">
                                                        {lot.code}
                                                    </span>
                                                    {lotStt && (
                                                        <span className="font-mono text-[11px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">
                                                            STT: {lotStt}
                                                        </span>
                                                    )}
                                                </div>
                                                {isSelected && <Check size={16} className="text-emerald-600" />}
                                            </div>
                                            {lot.product_name && (
                                                <p className="text-[11px] text-stone-500 mt-1 truncate">
                                                    {lot.product_name}
                                                </p>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setGroupToLink(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={() => selectedLotForLink && handleLinkGroupToLot(groupToLink, selectedLotForLink)}
                                disabled={!selectedLotForLink || isLinking}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isLinking ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Xác Nhận Ghép Vào LOT</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL XEM CHI TIẾT CÁC THÙNG QUÉT (CHƯA KẾT NỐI) ─ */}
            {previewGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-4xl p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                                    <span>Thông Tin Quét STT:</span>
                                    <span className="font-mono text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-lg text-sm">
                                        {previewGroup.pallet_stt}
                                    </span>
                                    {previewGroup.pallet_tag ? (
                                        <span className="text-xs font-bold text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 px-2.5 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center gap-1">
                                            <Tag size={12} /> {previewGroup.pallet_tag}
                                        </span>
                                    ) : null}
                                    {previewGroup.pallet_notes ? (
                                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                                            📝 {previewGroup.pallet_notes}
                                        </span>
                                    ) : null}
                                    <button
                                        onClick={() => handleOpenEditPalletInfo(previewGroup)}
                                        title="Sửa STT / Mã phụ (Tag) / Ghi chú Pallet"
                                        className="p-1 text-stone-400 hover:text-emerald-600 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                </h3>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    Đã quét {previewGroup.boxes.length} thùng · Tổng trọng lượng: {previewGroup.total_weight.toFixed(1)} Kg
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOpenBulkEdit(previewGroup)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                                >
                                    <Sliders size={14} />
                                    <span>Sửa Hàng Loạt {selectedBoxIds.size > 0 ? `(${selectedBoxIds.size} thùng)` : `(${previewGroup.boxes.length} thùng)`}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPreviewGroup(null)
                                        setSelectedBoxIds(new Set())
                                    }}
                                    className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Thanh công cụ lựa chọn thùng */}
                        <div className="flex items-center justify-between px-3 py-2 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 text-xs my-2">
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-stone-700 dark:text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={previewGroup.boxes.length > 0 && selectedBoxIds.size === previewGroup.boxes.length}
                                        onChange={e => {
                                            if (e.target.checked) {
                                                setSelectedBoxIds(new Set(previewGroup.boxes.map(b => b.id)))
                                            } else {
                                                setSelectedBoxIds(new Set())
                                            }
                                        }}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span>Chọn tất cả ({previewGroup.boxes.length} thùng)</span>
                                </label>
                                {selectedBoxIds.size > 0 && (
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/70 px-2 py-0.5 rounded-md">
                                        Đã chọn: {selectedBoxIds.size} / {previewGroup.boxes.length}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedBoxIds.size > 0 && (
                                    <button
                                        onClick={() => setSelectedBoxIds(new Set())}
                                        className="text-[11px] text-stone-500 hover:text-stone-700 dark:hover:text-zinc-300 underline cursor-pointer"
                                    >
                                        Bỏ chọn
                                    </button>
                                )}
                                <span className="text-[11px] text-stone-400 hidden sm:inline">
                                    💡 Sửa lẻ bằng nút ✏️ trên thẻ thùng, hoặc bấm &quot;Sửa Hàng Loạt&quot; để sửa chung.
                                </span>
                            </div>
                        </div>

                        {/* Danh sách thẻ thùng chi tiết */}
                        <div className="flex-1 overflow-y-auto p-2 my-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {previewGroup.boxes.map(box => {
                                const idx = getBoxIndex(box)
                                const meta = box.metadata || {}
                                const isSelected = selectedBoxIds.has(box.id)
                                return (
                                    <div
                                        key={box.id}
                                        className={`p-2.5 rounded-xl border text-xs transition-all relative ${
                                            isSelected 
                                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20' 
                                                : 'bg-stone-50 dark:bg-zinc-800/50 border-stone-200 dark:border-zinc-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {
                                                        setSelectedBoxIds(prev => {
                                                            const next = new Set(prev)
                                                            if (next.has(box.id)) next.delete(box.id)
                                                            else next.add(box.id)
                                                            return next
                                                        })
                                                    }}
                                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                />
                                                <span className="font-black text-xs bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-md">
                                                    #{idx}
                                                </span>
                                                <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                    {Number(box.quantity).toFixed(1)} {box.unit}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleOpenEditBox(box)}
                                                    title="Sửa thông tin thùng này"
                                                    className="p-1 text-stone-400 hover:text-emerald-600 rounded-md hover:bg-white dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                                >
                                                    <Edit3 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteSingleBox(box)}
                                                    title="Xóa thùng này khỏi đợt quét"
                                                    className="p-1 text-stone-400 hover:text-rose-600 rounded-md hover:bg-white dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="font-mono font-bold text-[11px] text-stone-800 dark:text-zinc-200 truncate mb-1" title={box.code}>
                                            {box.code}
                                        </p>
                                        {meta.scan_type === 'stamp' ? (
                                            <div className="bg-amber-50/80 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200/80 dark:border-amber-800/60 text-[10px] space-y-1 mb-1">
                                                <p className="truncate"><strong className="text-stone-500">Dòng 1:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line1 || '---'}</span></p>
                                                <p className="truncate"><strong className="text-stone-500">Dòng 2:</strong> <span className="font-mono font-bold text-stone-800 dark:text-zinc-200">{meta.stamp_line2 || '---'}</span></p>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-stone-500 space-y-0.5">
                                                <p>LOT tem: <strong className="text-stone-700 dark:text-zinc-300">{box.finished_lot_code || box.semi_finished_lot_code || '---'}</strong></p>
                                                <p>Quy cách: <strong className="text-stone-700 dark:text-zinc-300">{meta.spec || '---'}</strong></p>
                                                <p>Tổ: <strong className="text-stone-700 dark:text-zinc-300">{meta.shift_group || '---'}</strong></p>
                                                <p>Ngày SX: <strong className="text-amber-600 dark:text-amber-400">{meta.production_date || '---'}</strong></p>
                                                <p>Ngày ĐG: <strong className="text-stone-700 dark:text-zinc-300">{meta.packaging_date || '---'}</strong></p>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <span className="text-xs text-stone-400">
                                Dữ liệu quét lưu trên hệ thống, có thể sửa đổi và đồng bộ trước khi duyệt tạo hoặc ghép vào LOT.
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleOpenBulkEdit(previewGroup)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
                                >
                                    <Sliders size={14} />
                                    <span>Sửa Hàng Loạt</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setPreviewGroup(null)
                                        setSelectedBoxIds(new Set())
                                    }}
                                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold rounded-xl cursor-pointer"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL SỬA THÔNG TIN THÙNG (SỬA 1 THÙNG) ──────── */}
            {editingBox && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                    <span>Sửa Thùng #{getBoxIndex(editingBox)}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 truncate max-w-[200px]" title={editingBox.code}>
                                        {editingBox.code}
                                    </span>
                                </h3>
                                <p className="text-xs text-stone-400">
                                    Điều chỉnh các chỉ số bị lệch do hình ảnh chụp mờ hoặc sai OCR
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingBox(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-4 overflow-y-auto pr-1">
                            {/* Dành cho thùng đóng dấu mực */}
                            {(editingBox.metadata?.scan_type === 'stamp' || editingBox.code?.startsWith('STAMP-') || editStampLine1 || editStampLine2) ? (
                                <div className="space-y-3 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1">
                                            📦 THÔNG TIN CON DẤU MỰC
                                        </span>
                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                            Khớp với ảnh chụp thực tế
                                        </span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 1 (Mã quy cách / SKU sản phẩm):
                                        </label>
                                        <input
                                            type="text"
                                            value={editStampLine1}
                                            onChange={e => setEditStampLine1(e.target.value)}
                                            placeholder="VD: 102010402001-0"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 2 (Mã ngày &amp; Barcode 16 số):
                                        </label>
                                        <input
                                            type="text"
                                            value={editStampLine2}
                                            onChange={e => {
                                                setEditStampLine2(e.target.value)
                                                if (!editLotCode || editLotCode === editStampLine2) {
                                                    setEditLotCode(e.target.value)
                                                }
                                            }}
                                            placeholder="VD: 2231015102600066"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    {previewGroup && previewGroup.boxes.length > 1 && (
                                        <label className="flex items-center gap-2 p-2 bg-amber-100/70 dark:bg-amber-900/40 rounded-lg text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer select-none border border-amber-300/80 dark:border-amber-700/60">
                                            <input
                                                type="checkbox"
                                                checked={editApplyToAllInPallet}
                                                onChange={e => setEditApplyToAllInPallet(e.target.checked)}
                                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                                            />
                                            <span>Đồng bộ Dòng 1 &amp; Dòng 2 cho toàn bộ {previewGroup.boxes.length} thùng của Pallet {previewGroup.pallet_stt}</span>
                                        </label>
                                    )}
                                </div>
                            ) : (
                                /* Dành cho tem nhãn in OCR */
                                <div className="space-y-3 p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                                    <span className="font-black text-xs text-blue-800 dark:text-blue-300 block">
                                        🏷️ THÔNG TIN TEM NHÃN OCR
                                    </span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Quy cách:
                                            </label>
                                            <input
                                                type="text"
                                                value={editSpec}
                                                onChange={e => setEditSpec(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Tổ / Ca:
                                            </label>
                                            <input
                                                type="text"
                                                value={editShiftGroup}
                                                onChange={e => setEditShiftGroup(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày sản xuất:
                                            </label>
                                            <input
                                                type="text"
                                                value={editProductionDate}
                                                onChange={e => setEditProductionDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày đóng gói:
                                            </label>
                                            <input
                                                type="text"
                                                value={editPackagingDate}
                                                onChange={e => setEditPackagingDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Khối lượng ({editingBox.unit}):
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editWeight}
                                        onChange={e => setEditWeight(e.target.value)}
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Mã LOT:
                                    </label>
                                    <input
                                        type="text"
                                        value={editLotCode}
                                        onChange={e => setEditLotCode(e.target.value)}
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                        Mã Barcode Thùng (Code):
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const idxStr = String(getBoxIndex(editingBox)).padStart(3, '0')
                                            const stt = (editingBox.metadata?.pallet_stt || 'PALLET').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                                            if (editStampLine1 || editStampLine2) {
                                                const l1 = editStampLine1.replace(/[^a-zA-Z0-9]/g, '')
                                                const l2 = editStampLine2.replace(/[^a-zA-Z0-9]/g, '')
                                                setEditBoxCode(`STAMP-${l1}-${l2}-${stt}-${idxStr}`)
                                            } else {
                                                const lot = (editLotCode || 'LOT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                                                const sku = (editingBox.metadata?.sku || editingBox.products?.sku || 'SKU').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                                                setEditBoxCode(`BOX-${lot}-${sku}-${stt}-${idxStr}`)
                                            }
                                        }}
                                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                                    >
                                        ⚡ Tự tạo lại mã theo dữ liệu mới
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={editBoxCode}
                                    onChange={e => setEditBoxCode(e.target.value)}
                                    className="w-full px-3 py-2 font-mono text-xs text-stone-800 dark:text-zinc-200 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setEditingBox(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveBoxEdit}
                                disabled={isSavingEdit}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Lưu Thay Đổi</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL SỬA HÀNG LOẠT CÁC THÙNG ────────────────── */}
            {isBulkEditOpen && previewGroup && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-xl p-6 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                    <span>⚡ Sửa Hàng Loạt Thùng Quét</span>
                                    <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                        STT: {previewGroup.pallet_stt}
                                    </span>
                                </h3>
                                <p className="text-xs text-stone-500">
                                    {(bulkScope === 'selected' && selectedBoxIds.size > 0)
                                        ? `Đang áp dụng cho ${selectedBoxIds.size} thùng đã chọn`
                                        : `Đang áp dụng cho toàn bộ ${previewGroup.boxes.length} thùng của Pallet`}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsBulkEditOpen(false)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Phạm vi áp dụng */}
                        <div className="flex flex-wrap items-center gap-4 px-3 py-2 mt-3 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 text-xs">
                            <span className="font-bold text-stone-700 dark:text-zinc-300">Phạm vi:</span>
                            <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-stone-800 dark:text-zinc-200">
                                <input
                                    type="radio"
                                    name="bulkScope"
                                    checked={bulkScope === 'all'}
                                    onChange={() => setBulkScope('all')}
                                    className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span>Toàn bộ Pallet ({previewGroup.boxes.length} thùng)</span>
                            </label>
                            {selectedBoxIds.size > 0 && (
                                <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-stone-800 dark:text-zinc-200">
                                    <input
                                        type="radio"
                                        name="bulkScope"
                                        checked={bulkScope === 'selected'}
                                        onChange={() => setBulkScope('selected')}
                                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span>Chỉ {selectedBoxIds.size} thùng đang chọn</span>
                                </label>
                            )}
                        </div>

                        {/* Quick fill button */}
                        <div className="flex items-center justify-between p-2.5 my-3 bg-stone-50 dark:bg-zinc-800/60 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 text-xs">
                            <span className="text-stone-600 dark:text-zinc-400">
                                💡 Nhập các trường cần sửa. Ô để trống sẽ giữ nguyên dữ liệu gốc.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    const first = previewGroup.boxes[0]
                                    if (!first) return
                                    const m = first.metadata || {}
                                    if (m.stamp_line1) setBulkStampLine1(m.stamp_line1)
                                    if (m.stamp_line2) setBulkStampLine2(m.stamp_line2)
                                    if (first.quantity) setBulkWeight(String(first.quantity))
                                    const lot = first.finished_lot_code || first.semi_finished_lot_code
                                    if (lot) setBulkLotCode(lot)
                                    if (m.spec) setBulkSpec(m.spec)
                                    if (m.shift_group) setBulkShiftGroup(m.shift_group)
                                    if (m.production_date) setBulkProductionDate(m.production_date)
                                    if (m.packaging_date) setBulkPackagingDate(m.packaging_date)
                                    showToast('Đã sao chép mẫu từ Thùng #1!', 'info')
                                }}
                                className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-zinc-700 hover:bg-stone-100 dark:hover:bg-zinc-600 border border-stone-200 dark:border-zinc-600 rounded-lg font-bold text-stone-700 dark:text-zinc-200 cursor-pointer shadow-2xs"
                            >
                                <span>📋 Lấy mẫu từ Thùng #1</span>
                            </button>
                        </div>

                        {/* Body fields */}
                        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                            {/* Dành cho thùng con dấu */}
                            {previewGroup.boxes.some(b => b.metadata?.scan_type === 'stamp' || b.code?.startsWith('STAMP-')) ? (
                                <div className="space-y-3 p-3.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-800/60">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-xs text-amber-800 dark:text-amber-300">
                                            📦 ĐỒNG BỘ CON DẤU MỰC
                                        </span>
                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                                            Sửa số bị mờ / lệch
                                        </span>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 1 mới (Mã quy cách/SKU con dấu):
                                        </label>
                                        <input
                                            type="text"
                                            value={bulkStampLine1}
                                            onChange={e => setBulkStampLine1(e.target.value)}
                                            placeholder="(Để trống nếu không đổi)"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                            Dòng 2 mới (Mã ngày/LOT con dấu 16 số):
                                        </label>
                                        <input
                                            type="text"
                                            value={bulkStampLine2}
                                            onChange={e => setBulkStampLine2(e.target.value)}
                                            placeholder="(Để trống nếu không đổi)"
                                            className="w-full px-3 py-2 font-mono bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        />
                                    </div>
                                </div>
                            ) : null}

                            {/* Dành cho tem nhãn */}
                            {previewGroup.boxes.some(b => b.metadata?.scan_type !== 'stamp' && !b.code?.startsWith('STAMP-')) ? (
                                <div className="space-y-3 p-3.5 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
                                    <span className="font-black text-xs text-blue-800 dark:text-blue-300 block">
                                        🏷️ ĐỒNG BỘ TEM NHÃN OCR
                                    </span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Quy cách mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkSpec}
                                                onChange={e => setBulkSpec(e.target.value)}
                                                placeholder="(Giữ nguyên nếu để trống)"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Tổ / Ca mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkShiftGroup}
                                                onChange={e => setBulkShiftGroup(e.target.value)}
                                                placeholder="(Giữ nguyên nếu để trống)"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày sản xuất mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkProductionDate}
                                                onChange={e => setBulkProductionDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                Ngày đóng gói mới:
                                            </label>
                                            <input
                                                type="text"
                                                value={bulkPackagingDate}
                                                onChange={e => setBulkPackagingDate(e.target.value)}
                                                placeholder="DD/MM/YYYY"
                                                className="w-full px-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Khối lượng mỗi thùng ({previewGroup.boxes[0]?.unit || 'Kg'}):
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={bulkWeight}
                                        onChange={e => setBulkWeight(e.target.value)}
                                        placeholder="(Giữ nguyên nếu để trống)"
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        Mã LOT chung:
                                    </label>
                                    <input
                                        type="text"
                                        value={bulkLotCode}
                                        onChange={e => setBulkLotCode(e.target.value)}
                                        placeholder="(Giữ nguyên nếu để trống)"
                                        className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 p-3 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-stone-200/80 dark:border-zinc-700/60 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={bulkRegenerateCode}
                                    onChange={e => setBulkRegenerateCode(e.target.checked)}
                                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <div className="text-xs">
                                    <span className="font-bold text-stone-800 dark:text-zinc-200 block">
                                        Tự động tái tạo lại Mã Barcode thùng theo dữ liệu mới
                                    </span>
                                    <span className="text-[11px] text-stone-400">
                                        Đồng bộ chuỗi STAMP-Dòng1-Dòng2-STT-STTThùng để mã barcode luôn khớp 100% với con dấu.
                                    </span>
                                </div>
                            </label>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setIsBulkEditOpen(false)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveBulkEdit}
                                disabled={isSavingBulkEdit}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isSavingBulkEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Xác Nhận Áp Dụng</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL SỬA THÔNG TIN PALLET (STT, TAG, GHI CHÚ) ─ */}
            {editingPalletInfoGroup && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                                    Sửa Thông Tin Pallet
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Cập nhật STT, mã phụ và ghi chú cho toàn bộ các thùng trong Pallet này
                                </p>
                            </div>
                            <button
                                onClick={() => setEditingPalletInfoGroup(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-4">
                            <div>
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                    Mã STT Pallet:
                                </label>
                                <input
                                    type="text"
                                    value={editPalletSTT}
                                    onChange={e => setEditPalletSTT(e.target.value.toUpperCase())}
                                    placeholder="VD: G38"
                                    className="w-full px-3 py-2 font-mono font-bold bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                    Mã Phụ (Tag):
                                </label>
                                <input
                                    type="text"
                                    value={editPalletTag}
                                    onChange={e => setEditPalletTag(e.target.value.toUpperCase())}
                                    placeholder="VD: IQF, XUAT_KHAU... (Để trống nếu không có)"
                                    className="w-full px-3 py-2 font-mono font-bold bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-sm text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                    Ghi Chú Pallet:
                                </label>
                                <textarea
                                    value={editPalletNotes}
                                    onChange={e => setEditPalletNotes(e.target.value)}
                                    rows={2}
                                    placeholder="Ghi chú thêm về đợt quét này..."
                                    className="w-full px-3 py-2 bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-lg text-xs text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setEditingPalletInfoGroup(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSavePalletInfo}
                                disabled={isSavingPalletInfo}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isSavingPalletInfo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Lưu Pallet</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL DUYỆT TẠO LOT MỚI TỪ PALLET QUÉT ─────────── */}
            {approveGroup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl p-6 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-zinc-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                                    <Sparkles size={22} />
                                </div>
                                <div>
                                    <h3 className="font-black text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2">
                                        <span>Duyệt Tạo LOT Mới Từ Pallet</span>
                                        <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                            STT: {approveGroup.pallet_stt}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                                        Kế thừa tự động dữ liệu quét từ điện thoại ({approveGroup.boxes.length} thùng · {approveGroup.total_weight.toFixed(1)} Kg)
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setApproveGroup(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                            {/* 1. Định danh LOT & Mã Phụ (Tag) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-stone-200/80 dark:border-zinc-700/60">
                                <div>
                                    <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                        Mã LOT Định Danh: <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="text"
                                            value={proposedLotCode}
                                            onChange={e => setProposedLotCode(e.target.value.toUpperCase())}
                                            placeholder="VD: DL-LOT-G22..."
                                            className="flex-1 px-3 py-2 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-mono font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRegenerateLotCode}
                                            disabled={isGeneratingCode}
                                            title="Sinh lại mã ngẫu nhiên mới"
                                            className="p-2 bg-white dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700 border border-stone-200 dark:border-zinc-700 rounded-xl text-stone-600 dark:text-zinc-300 cursor-pointer disabled:opacity-50"
                                        >
                                            <RefreshCw size={14} className={isGeneratingCode ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                    <span className="text-[10px] text-stone-400 mt-1 block">Tự động gắn Số Thứ Tự: {approveGroup.pallet_stt}</span>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-stone-700 dark:text-zinc-300 block mb-1 flex items-center gap-1">
                                        <Tag size={13} className="text-orange-500" />
                                        <span>Mã Phụ (Tag):</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={customLotTag}
                                        onChange={e => setCustomLotTag(e.target.value.toUpperCase())}
                                        placeholder="VD: TAG-01, VUNG-TRONG-02..."
                                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                    <span className="text-[10px] text-stone-400 mt-1 block">Đồng bộ từ trường Tag trên app quét</span>
                                </div>
                            </div>

                            {/* 2. Chọn Sản Phẩm & Nhận diện từ Con Dấu */}
                            <div className="p-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                                        <Package size={14} className="text-indigo-600 dark:text-indigo-400" />
                                        <span>Sản Phẩm Của LOT:</span>
                                        <span className="text-rose-500">*</span>
                                    </label>
                                    {matchInfo && matchInfo.score > 15 ? (
                                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/90 dark:bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-300/80 dark:border-emerald-800 flex items-center gap-1">
                                            <CheckCircle2 size={11} /> Khớp tự động: {matchInfo.reason}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-stone-400">Vui lòng chọn hoặc xác nhận đúng biến thể</span>
                                    )}
                                </div>

                                <Combobox
                                    options={productOptions}
                                    value={selectedProductId}
                                    onChange={val => {
                                        setSelectedProductId(val)
                                        const newProd = warehouseProducts.find(p => p.id === val)
                                        const newUnits = getAvailableUnitsForProduct(newProd, allProductUnits, allUnits, currentBoxWeight)
                                        const thungOpt = newUnits.find(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))
                                        if (thungOpt) {
                                            setCustomUnit(thungOpt)
                                        } else if (newUnits[0]) {
                                            setCustomUnit(newUnits[0])
                                        }
                                    }}
                                    placeholder="Tìm kiếm sản phẩm (theo tên, mã SKU, tên viết tắt)..."
                                    className="w-full text-xs"
                                    renderValue={(option) => (
                                        <div className="flex flex-col text-left w-full py-0.5">
                                            <div className="text-[10px] text-zinc-500 font-mono mb-0.5 leading-none">{option.sku}</div>
                                            <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1 leading-tight">
                                                {option.name}
                                            </div>
                                        </div>
                                    )}
                                    renderOption={(option: any) => (
                                        <div className="flex flex-col text-left w-full py-1">
                                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                                <div className="text-xs font-black text-zinc-900 dark:text-zinc-100 font-mono leading-none uppercase">
                                                    {option.sku}
                                                </div>
                                                {option.rawAliases && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                                        ⚡ {option.rawAliases.split(/[,;\n]/)[0]?.trim()}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-zinc-600 dark:text-zinc-400 line-clamp-1 leading-tight font-medium">
                                                {option.name}
                                            </div>
                                        </div>
                                    )}
                                />

                                {selectedProductId && (
                                    <div className="bg-white/90 dark:bg-zinc-900/90 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                            {/* 1. Mã SKU */}
                                            <div>
                                                <label className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 block mb-1">
                                                    Mã SKU:
                                                </label>
                                                <div className="h-9 px-2.5 bg-stone-100/80 dark:bg-zinc-800/80 rounded-xl flex items-center font-mono font-bold text-xs text-stone-900 dark:text-zinc-100 border border-stone-200/80 dark:border-zinc-700/80 truncate">
                                                    {warehouseProducts.find(p => p.id === selectedProductId)?.sku || '---'}
                                                </div>
                                                <span className="text-[10px] text-stone-400 mt-1 block select-none">&nbsp;</span>
                                            </div>

                                            {/* 2. Đơn vị tính */}
                                            <div>
                                                <label className="text-[11px] font-bold text-stone-500 dark:text-zinc-400 block mb-1">
                                                    Đơn vị tính:
                                                </label>
                                                <select
                                                    value={customUnit}
                                                    onChange={e => setCustomUnit(e.target.value)}
                                                    className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl font-bold text-stone-800 dark:text-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                                                >
                                                    {currentAvailableUnits.length > 0 ? (
                                                        currentAvailableUnits.map(u => (
                                                            <option key={u} value={u}>{u}</option>
                                                        ))
                                                    ) : (
                                                        <>
                                                            <option value="Thùng (20kg)">Thùng (20kg)</option>
                                                            <option value="Kg">Kg</option>
                                                        </>
                                                    )}
                                                </select>
                                                <span className="text-[10px] text-stone-400 mt-1 block select-none">&nbsp;</span>
                                            </div>

                                            {/* 3. Số lượng */}
                                            <div>
                                                <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                    Số lượng ({customUnit}):
                                                </label>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    value={customQuantity}
                                                    onChange={e => setCustomQuantity(parseInt(e.target.value, 10) || 0)}
                                                    className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-black text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                <span className="text-[10px] text-stone-400 mt-1 block truncate">{approveGroup.boxes.length} thùng quét</span>
                                            </div>

                                            {/* 4. Khối lượng */}
                                            <div>
                                                <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 block mb-1">
                                                    Khối lượng (Kg):
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={customWeight}
                                                    onChange={e => setCustomWeight(parseFloat(e.target.value) || 0)}
                                                    className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-black text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <span className="text-[10px] text-stone-400 mt-1 block truncate">Tổng: {approveGroup.total_weight.toFixed(1)} Kg</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3. Thông tin ngày tháng của LOT (Hỗ trợ nhiều ngày cho Đóng gói, Sản xuất, Nhập NL) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {/* Ngày nhập kho */}
                                <div className="p-2.5 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-700/80 flex flex-col justify-between">
                                    <div>
                                        <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 block mb-1.5 flex items-center gap-1">
                                            <Calendar size={13} className="text-indigo-500 shrink-0" />
                                            <span>Ngày nhập kho:</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={customInboundDate}
                                            onChange={e => setCustomInboundDate(e.target.value)}
                                            className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <span className="text-[10px] text-stone-400 mt-1 block">Ngày tạo LOT nhập kho</span>
                                </div>

                                {/* Ngày đóng gói */}
                                <div className="p-2.5 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-700/80 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                                <Calendar size={13} className="text-amber-500 shrink-0" />
                                                <span>Ngày đóng gói:</span>
                                            </label>
                                            {customPackagingDates.length > 0 && (
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                                    {customPackagingDates.length} ngày
                                                </span>
                                            )}
                                        </div>

                                        {/* Danh sách các ngày đóng gói đã có */}
                                        {customPackagingDates.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1.5 max-h-20 overflow-y-auto">
                                                {customPackagingDates.map(dStr => (
                                                    <span key={dStr} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-800/60 rounded-md text-[11px] font-bold text-amber-900 dark:text-amber-200 shadow-2xs">
                                                        <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePackagingDate(dStr)}
                                                            className="text-stone-400 hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                                            title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1">
                                            <input
                                                type="date"
                                                value={newPackagingDateInput}
                                                onChange={e => setNewPackagingDateInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPackagingDate(); } }}
                                                className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddPackagingDate}
                                                disabled={!newPackagingDateInput}
                                                className="h-8 px-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all shadow-xs"
                                                title="Thêm ngày đóng gói"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-stone-400 mt-1 block">{isStampModal ? 'Dấu mực: Dòng 2 (DDMM)' : 'Từ tem nhãn (NĐG)'}</span>
                                </div>

                                {/* Ngày sản xuất */}
                                <div className="p-2.5 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-700/80 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                                <Calendar size={13} className="text-orange-500 shrink-0" />
                                                <span>Ngày sản xuất:</span>
                                            </label>
                                            {customPeelingDates.length > 0 && (
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                                                    {customPeelingDates.length} ngày
                                                </span>
                                            )}
                                        </div>

                                        {/* Danh sách các ngày sản xuất đã có */}
                                        {customPeelingDates.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1.5 max-h-20 overflow-y-auto">
                                                {customPeelingDates.map(dStr => (
                                                    <span key={dStr} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-orange-300 dark:border-orange-800/60 rounded-md text-[11px] font-bold text-orange-900 dark:text-orange-200 shadow-2xs">
                                                        <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePeelingDate(dStr)}
                                                            className="text-stone-400 hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                                            title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1">
                                            <input
                                                type="date"
                                                value={newPeelingDateInput}
                                                onChange={e => setNewPeelingDateInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddPeelingDate(); } }}
                                                className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddPeelingDate}
                                                disabled={!newPeelingDateInput}
                                                className="h-8 px-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all shadow-xs"
                                                title="Thêm ngày sản xuất"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-stone-400 mt-1 block">{isStampModal ? 'Dấu mực: để trống' : 'Từ tem nhãn (NSX)'}</span>
                                </div>

                                {/* Ngày nhập NL */}
                                <div className="p-2.5 bg-stone-50 dark:bg-zinc-800/40 rounded-xl border border-stone-200 dark:border-zinc-700/80 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                                                <Calendar size={13} className="text-emerald-500 shrink-0" />
                                                <span>Ngày nhập NL:</span>
                                            </label>
                                            {customRawMaterialDates.length > 0 && (
                                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                                    {customRawMaterialDates.length} ngày
                                                </span>
                                            )}
                                        </div>

                                        {/* Danh sách các ngày nhập NL đã có */}
                                        {customRawMaterialDates.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1.5 max-h-20 overflow-y-auto">
                                                {customRawMaterialDates.map(dStr => (
                                                    <span key={dStr} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white dark:bg-zinc-800 border border-emerald-300 dark:border-emerald-800/60 rounded-md text-[11px] font-bold text-emerald-900 dark:text-emerald-200 shadow-2xs">
                                                        <span>{new Date(dStr).toLocaleDateString('vi-VN')}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveRawDate(dStr)}
                                                            className="text-stone-400 hover:text-rose-600 cursor-pointer p-0.5 rounded"
                                                            title={`Xóa ngày ${new Date(dStr).toLocaleDateString('vi-VN')}`}
                                                        >
                                                            <X size={11} />
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1">
                                            <input
                                                type="date"
                                                value={newRawMaterialDateInput}
                                                onChange={e => setNewRawMaterialDateInput(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRawDate(); } }}
                                                className="w-full h-8 px-2 bg-white dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg text-xs font-medium text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddRawDate}
                                                disabled={!newRawMaterialDateInput}
                                                className="h-8 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer transition-all shadow-xs"
                                                title="Thêm ngày nhập nguyên liệu"
                                            >
                                                <Plus size={13} />
                                            </button>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-stone-400 mt-1 block">{isStampModal ? 'Dấu mực: Dòng 2 (DDMMYY)' : 'Tem nhãn: để trống'}</span>
                                </div>
                            </div>

                            {/* 4. Tổ đóng gói & Vùng nguyên liệu & Ghi chú */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1 flex items-center gap-1">
                                        <Factory size={11} className="text-blue-500" />
                                        <span>Nơi sản xuất / Tổ đóng gói:</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={customProductionPlace}
                                        onChange={e => setCustomProductionPlace(e.target.value)}
                                        placeholder="VD: Tổ 1, Xưởng Chánh Thu..."
                                        className="w-full h-9 px-3 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs text-stone-900 dark:text-zinc-100 focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1 flex items-center gap-1">
                                        <MapPin size={11} className="text-emerald-500" />
                                        <span>Vùng nguyên liệu:</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={customMaterialZone}
                                        onChange={e => setCustomMaterialZone(e.target.value)}
                                        placeholder="VD: Bến Tre, Tây Nguyên..."
                                        className="w-full h-9 px-3 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs text-stone-900 dark:text-zinc-100 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                    Ghi chú LOT hàng:
                                </label>
                                <textarea
                                    value={customNotes}
                                    onChange={e => setCustomNotes(e.target.value)}
                                    placeholder="Nhập ghi chú cho LOT hàng (nếu có)..."
                                    rows={2}
                                    className="w-full px-3 py-1.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs text-stone-900 dark:text-zinc-100 focus:outline-none resize-none placeholder:text-stone-400"
                                />
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <span className="text-[11px] text-stone-400">
                                Khi duyệt, LOT sẽ được tạo trên Web và kết nối tự động toàn bộ {approveGroup.boxes.length} thùng.
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setApproveGroup(null)}
                                    className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmCreateLot}
                                    disabled={isApproving}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {isApproving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    <span>Tạo LOT & Kết Nối Ngay</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
