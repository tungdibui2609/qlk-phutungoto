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
    ArrowUpRight, Eye, Sparkles, Clock, Factory
} from 'lucide-react'
import { advancedMatchSearch, normalizeSearchString } from '@/lib/searchUtils'
import { decodeSTT, encodeSTT } from '@/lib/numberUtils'
import { syncDatesFromBoxesToLot } from '@/lib/lotDateSync'
import { Combobox } from '@/components/ui/Combobox'
import { generateUniqueLotCode } from '@/lib/lotCodeGenerator'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { parseDateToISO } from '@/lib/dateUtils'

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
 * Trích xuất Ngày đóng gói từ thùng (tem nhãn hoặc Dòng 2 con dấu: ký tự 1..4 là DDMM)
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
 * Trích xuất Ngày nhập nguyên liệu từ thùng (Dòng 2 con dấu: ký tự 5..10 là DDMMYY)
 */
function extractRawMaterialDate(box: BoxLabelItem): string | null {
    const meta = box.metadata || {}
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
    // Mobile scanner lưu ngày nhập nguyên liệu từ con dấu vào production_date hoặc inbound_date
    const isStamp = meta.scan_type === 'stamp' || !!meta.stamp_line1 || !!meta.stamp_line2 || box.code?.startsWith('STAMP-')
    if (isStamp && meta.production_date) {
        return cleanDateForDB(meta.production_date)
    }
    return null
}

interface BoxLabelItem {
    id: string
    code: string
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
    const [customRawMaterialDate, setCustomRawMaterialDate] = useState<string>('')
    const [customPeelingDate, setCustomPeelingDate] = useState<string>('')
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
    const [isSavingEdit, setIsSavingEdit] = useState(false)

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

            // 2. Fetch Unlinked Boxes (lot_id IS NULL)
            const { data: unlinkedData, error: unlinkedErr } = await supabase
                .from('box_labels')
                .select(`
                    id,
                    code,
                    quantity,
                    unit,
                    status,
                    semi_finished_lot_code,
                    finished_lot_code,
                    created_at,
                    metadata,
                    products ( name, sku, internal_name )
                `)
                .is('lot_id', null)
                .order('created_at', { ascending: false })
                .limit(500)

            if (unlinkedErr) throw unlinkedErr

            // 2.1 Group unlinked box_labels by pallet_stt
            const groupMap = new Map<string, BoxLabelItem[]>()
            ;(unlinkedData || []).forEach((b: any) => {
                const rawStt = b.metadata?.pallet_stt
                if (!rawStt) return // Bỏ qua tem in đơn lẻ/QR test không thuộc đợt quét Pallet
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
            `CẬP NHẬT LOT: Bạn có chắc muốn THAY THẾ danh sách thùng của LOT ${targetLot.code} (STT: ${group.pallet_stt}) bằng ${group.boxes.length} thùng mới quét này không?\n\n(Hệ thống sẽ gỡ các thùng cũ của LOT ra và gán toàn bộ ${group.boxes.length} thùng mới này vào LOT ${targetLot.code})`
        )
        if (!confirmed) return

        setIsLinking(true)
        try {
            // 1. Gỡ các thùng cũ của LOT này
            await (supabase
                .from('box_labels') as any)
                .update({ lot_id: null, status: 'unlinked' })
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
            const boxIds = group.boxes.map(b => b.id)
            const { error } = await supabase
                .from('box_labels')
                .delete()
                .in('id', boxIds)

            if (error) throw error

            showToast(`Đã xóa ${group.boxes.length} thùng của STT ${group.pallet_stt}`, 'success')
            fetchData()
        } catch (err: any) {
            showToast('Lỗi khi xóa: ' + err.message, 'error')
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

        const packDates = group.boxes.map(b => extractPackagingDate(b)).filter(Boolean) as string[]
        const rawDates = group.boxes.map(b => extractRawMaterialDate(b)).filter(Boolean) as string[]
        const prodDates = group.boxes.map(b => cleanDateForDB(b.metadata?.production_date)).filter(Boolean) as string[]

        const defaultPackDate = packDates.length > 0 ? [...packDates].sort().reverse()[0] : todayStr
        const defaultRawDate = rawDates.length > 0 ? [...rawDates].sort()[0] : ''
        const defaultProdDate = prodDates.length > 0 ? [...prodDates].sort()[0] : (isStamp ? '' : defaultPackDate)

        setCustomInboundDate(todayStr)
        setCustomPackagingDate(defaultPackDate)
        setCustomRawMaterialDate(defaultRawDate)
        setCustomPeelingDate(defaultProdDate)

        // 6. Kế thừa Nơi sản xuất (Tổ đóng gói) & Vùng nguyên liệu
        const places = Array.from(new Set(group.boxes.map(b => b.metadata?.shift_group).filter(Boolean)))
        const regions = Array.from(new Set(group.boxes.map(b => b.metadata?.region).filter(Boolean)))
        setCustomProductionPlace(places.join(', '))
        setCustomMaterialZone(regions.join(', '))

        // 7. Kế thừa Ghi chú từ app quét (nếu người dùng có nhập ghi chú trên app)
        const syncedNote = group.pallet_notes || group.boxes.map(b => b.metadata?.pallet_notes || b.metadata?.notes).find(Boolean) || ''
        setCustomNotes(syncedNote)
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
            const cleanPack = cleanDateForDB(customPackagingDate)
            const cleanRaw = cleanDateForDB(customRawMaterialDate)
            const cleanPeeling = cleanDateForDB(customPeelingDate)

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
                    peeling_dates: cleanPeeling ? [cleanPeeling] : []
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
        setEditWeight(String(box.quantity || 20))
        setEditLotCode(box.semi_finished_lot_code || box.finished_lot_code || '')
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
            const { error } = await (supabase
                .from('box_labels') as any)
                .update({
                    quantity: w,
                    semi_finished_lot_code: editLotCode.trim(),
                    finished_lot_code: editLotCode.trim()
                })
                .eq('id', editingBox.id)

            if (error) throw error

            showToast(`Đã cập nhật thùng #${getBoxIndex(editingBox)}!`, 'success')
            setEditingBox(null)
            fetchData()
        } catch (err: any) {
            showToast('Lỗi lưu thùng: ' + err.message, 'error')
        } finally {
            setIsSavingEdit(false)
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
        if (!searchQuery.trim()) return unlinkedGroups
        return unlinkedGroups.filter(g => advancedMatchSearch(g.pallet_stt, searchQuery))
    }, [unlinkedGroups, searchQuery])

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
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 md:p-6 bg-stone-50/50 dark:bg-zinc-950 font-sans">
            {/* ── HEADER ────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-stone-200 dark:border-zinc-800">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <Layers size={22} />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black text-stone-900 dark:text-zinc-100 tracking-tight">
                                Quản lý Pallet Quét (App Mobile)
                            </h1>
                            <p className="text-xs text-stone-500 dark:text-zinc-400">
                                LOT do Web tạo · Điện thoại quét OCR và tự động kết nối theo STT
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Tab Navigation */}
                    <div className="flex items-center p-1 bg-stone-200/60 dark:bg-zinc-800/80 rounded-xl">
                        <button
                            onClick={() => { setActiveTab('linked'); setShowMobileDetail(false); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'linked'
                                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            <CheckCircle2 size={14} />
                            <span>Đã kết nối</span>
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                {linkedPallets.length}
                            </span>
                        </button>

                        <button
                            onClick={() => { setActiveTab('unlinked'); setShowMobileDetail(false); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'unlinked'
                                    ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-xs'
                                    : 'text-stone-600 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100'
                            }`}
                        >
                            <Unlink size={14} />
                            <span>Chưa kết nối</span>
                            {unlinkedGroups.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-extrabold animate-pulse">
                                    {unlinkedGroups.length}
                                </span>
                            )}
                        </button>
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        title="Tải lại dữ liệu"
                        className="p-2 text-stone-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
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
                    {/* Toolbar tab Chưa kết nối */}
                    <div className="p-4 border-b border-stone-100 dark:border-zinc-800 bg-amber-50/40 dark:bg-amber-950/20">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl">
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <h2 className="text-sm md:text-base font-black text-stone-900 dark:text-zinc-100">
                                        Danh Sách Thùng / Pallet Chờ Kết Nối Vào LOT
                                    </h2>
                                    <p className="text-xs text-stone-500 dark:text-zinc-400">
                                        Các thùng tem được gửi lên từ điện thoại khi Web mẹ chưa tạo LOT khớp STT. Bạn có thể tự động hoặc ghép thủ công vào bất kỳ LOT nào.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAutoLinkAll}
                                    disabled={isAutoLinking || unlinkedGroups.filter(g => !!g.matchedLot).length === 0}
                                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {isAutoLinking ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
                                    <span>Tự động kết nối ({unlinkedGroups.filter(g => !!g.matchedLot).length})</span>
                                </button>
                            </div>
                        </div>

                        {/* Search trong tab Chưa kết nối */}
                        <div className="mt-3 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo STT (C544, G588...)..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl text-xs text-stone-800 dark:text-zinc-200 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Danh sách Pallet chưa kết nối */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-stone-400">
                                <Loader2 className="animate-spin mb-2" size={26} />
                                <span className="text-xs">Đang tải danh sách chờ kết nối...</span>
                            </div>
                        ) : filteredUnlinkedGroups.length === 0 ? (
                            <div className="text-center py-20 px-4">
                                <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={42} />
                                <p className="text-sm font-bold text-stone-800 dark:text-zinc-200">
                                    Tuyệt vời! Không có Pallet nào đang chờ kết nối
                                </p>
                                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-1 max-w-md mx-auto">
                                    Mọi đợt quét từ điện thoại đều đã được ghép đúng vào các LOT hàng trên Web mẹ.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredUnlinkedGroups.map(group => {
                                    const hasMatch = !!group.matchedLot
                                    return (
                                        <div
                                            key={group.pallet_stt}
                                            className={`p-4 rounded-2xl border transition-all ${
                                                hasMatch
                                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                                    : 'bg-stone-50/60 dark:bg-zinc-800/40 border-stone-200 dark:border-zinc-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono font-black text-sm text-stone-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-2xs">
                                                        STT: {group.pallet_stt}
                                                    </span>
                                                    {group.pallet_tag ? (
                                                        <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400 bg-orange-100/80 dark:bg-orange-950/50 px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800 flex items-center gap-1">
                                                            <Tag size={11} /> {group.pallet_tag}
                                                        </span>
                                                    ) : null}
                                                    {group.pallet_notes ? (
                                                        <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100/80 dark:bg-blue-950/50 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1 max-w-[180px] truncate" title={group.pallet_notes}>
                                                            📝 {group.pallet_notes}
                                                        </span>
                                                    ) : null}
                                                    <span className="text-xs font-bold text-stone-600 dark:text-zinc-400">
                                                        {group.boxes.length} thùng
                                                    </span>
                                                </div>

                                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                    {group.total_weight.toFixed(1)} Kg
                                                </span>
                                            </div>

                                            {/* Gợi ý nếu đã có LOT khớp STT */}
                                            {group.isConflict ? (
                                                <div className="p-3 bg-amber-500/10 dark:bg-amber-950/40 rounded-xl border-2 border-amber-500/40 dark:border-amber-700/60 mb-3 text-xs space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-extrabold text-xs">
                                                            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                                                            <span>⚠️ TRÙNG STT VỚI LOT ĐÃ CÓ</span>
                                                        </div>
                                                        <span className="text-[10px] bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-full font-black">
                                                            Cần quyết định
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="bg-white/80 dark:bg-zinc-900/80 p-2 rounded-lg border border-amber-200 dark:border-amber-900 text-[11px] space-y-1">
                                                        <p className="text-stone-700 dark:text-zinc-300">
                                                            📦 <strong className="text-stone-900 dark:text-zinc-100">LOT hiện tại:</strong>{' '}
                                                            <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{group.matchedLot!.code}</span>{' '}
                                                            ({group.matchedLot!.existingBoxesCount} thùng · {group.matchedLot!.existingTotalWeight?.toFixed(1)} Kg)
                                                            {group.matchedLot!.product_name ? ` · ${group.matchedLot!.product_name}` : ''}
                                                        </p>
                                                        <p className="text-stone-700 dark:text-zinc-300">
                                                            📲 <strong className="text-stone-900 dark:text-zinc-100">Đợt quét mới:</strong>{' '}
                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{group.boxes.length} thùng</span> ({group.total_weight.toFixed(1)} Kg)
                                                        </p>
                                                    </div>

                                                    <p className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 pt-0.5">
                                                        Chọn hướng xử lý cho đợt quét mới này:
                                                    </p>

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                                                        <button
                                                            onClick={() => handleUpdateConflictLot(group, group.matchedLot!.id)}
                                                            disabled={isLinking}
                                                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer disabled:opacity-50 transition-all text-center"
                                                            title="Cập nhật thay thế danh sách thùng cũ của LOT bằng đợt quét mới"
                                                        >
                                                            <RefreshCw size={12} />
                                                            <span>Cập nhật LOT</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleOpenApproveModal(group)}
                                                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer transition-all text-center"
                                                            title="Duyệt đợt quét này thành một LOT mới riêng biệt, giữ nguyên LOT cũ"
                                                        >
                                                            <Sparkles size={12} />
                                                            <span>Tách LOT mới</span>
                                                        </button>

                                                        <button
                                                            onClick={() => handleDeleteUnlinkedGroup(group)}
                                                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer transition-all text-center"
                                                            title="Hủy bỏ các thùng mới vừa đẩy lên nhầm, giữ nguyên LOT cũ"
                                                        >
                                                            <Trash2 size={12} />
                                                            <span>Hủy đợt mới</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : hasMatch ? (
                                                <div className="p-2.5 bg-emerald-100/70 dark:bg-emerald-950/60 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 mb-3 text-xs">
                                                    <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold mb-1">
                                                        <Zap size={14} className="fill-emerald-600 text-emerald-600" />
                                                        <span>Phát hiện LOT khớp trên Web!</span>
                                                    </div>
                                                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                                                        LOT: <strong className="font-mono">{group.matchedLot!.code}</strong> {group.matchedLot!.product_name ? `(${group.matchedLot!.product_name})` : ''}
                                                    </p>
                                                    <button
                                                        onClick={() => handleLinkGroupToLot(group, group.matchedLot!.id)}
                                                        disabled={isLinking}
                                                        className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
                                                    >
                                                        <Check size={14} />
                                                        <span>Ghép ngay vào LOT {group.matchedLot!.code}</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 mb-3 text-xs space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300 font-bold">
                                                            <Zap size={14} className="fill-indigo-600 text-indigo-600 dark:fill-indigo-400 dark:text-indigo-400" />
                                                            <span>Chưa có LOT "{group.pallet_stt}"</span>
                                                        </div>
                                                        <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                                                            Chờ duyệt LOT
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                                                        Kế thừa thông tin con dấu & tự động kết nối {group.boxes.length} thùng này ngay lập tức.
                                                    </p>
                                                    <button
                                                        onClick={() => handleOpenApproveModal(group)}
                                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer transition-all"
                                                    >
                                                        <Sparkles size={14} />
                                                        <span>⚡ Duyệt Tạo LOT Ngay</span>
                                                    </button>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200/60 dark:border-zinc-700/60 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => setPreviewGroup(group)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700 text-stone-800 dark:text-zinc-200 border border-stone-200 dark:border-zinc-700 rounded-lg font-bold transition-colors cursor-pointer"
                                                    >
                                                        <Eye size={13} />
                                                        <span>Xem {group.boxes.length} thùng</span>
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setGroupToLink(group)
                                                            setLinkLotSearch('')
                                                            setSelectedLotForLink(group.matchedLot?.id || null)
                                                        }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-200/80 hover:bg-stone-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-stone-800 dark:text-zinc-200 rounded-lg font-bold transition-colors cursor-pointer"
                                                    >
                                                        <Link2 size={13} />
                                                        <span>Ghép LOT</span>
                                                    </button>

                                                    {hasMatch && (
                                                        <button
                                                            onClick={() => handleOpenApproveModal(group)}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg font-bold transition-colors cursor-pointer"
                                                            title="Duyệt tạo LOT mới riêng cho Pallet này"
                                                        >
                                                            <Sparkles size={13} />
                                                            <span>Tạo LOT mới</span>
                                                        </button>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => handleDeleteUnlinkedGroup(group)}
                                                    title="Xóa đợt quét này"
                                                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
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
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-3xl p-5 shadow-2xl border border-stone-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <div>
                                <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                                    <span>Thông Tin Quét STT:</span>
                                    <span className="font-mono text-emerald-600 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-lg">
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
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Đã quét {previewGroup.boxes.length} thùng · Tổng trọng lượng: {previewGroup.total_weight.toFixed(1)} Kg
                                </p>
                            </div>
                            <button
                                onClick={() => setPreviewGroup(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Danh sách thẻ thùng chi tiết */}
                        <div className="flex-1 overflow-y-auto p-2 my-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {previewGroup.boxes.map(box => {
                                const idx = getBoxIndex(box)
                                const meta = box.metadata || {}
                                return (
                                    <div
                                        key={box.id}
                                        className="p-2.5 bg-stone-50 dark:bg-zinc-800/50 rounded-xl border border-stone-200 dark:border-zinc-700 text-xs"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-black text-xs bg-emerald-600 text-white w-6 h-6 flex items-center justify-center rounded-md">
                                                #{idx}
                                            </span>
                                            <span className="font-black text-emerald-600 dark:text-emerald-400">
                                                {Number(box.quantity).toFixed(1)} {box.unit}
                                            </span>
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

                        <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <span className="text-xs text-stone-400">
                                Dữ liệu quét OCR lưu trên hệ thống, không làm thay đổi thông tin của LOT Web mẹ.
                            </span>
                            <button
                                onClick={() => setPreviewGroup(null)}
                                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold rounded-xl"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MODAL SỬA THÔNG TIN THÙNG ─────────────────────── */}
            {editingBox && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
                            <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                                Sửa Thùng #{getBoxIndex(editingBox)}
                            </h3>
                            <button
                                onClick={() => setEditingBox(null)}
                                className="text-stone-400 hover:text-stone-600 dark:hover:text-zinc-200"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 my-4">
                            <div>
                                <label className="text-xs font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                    Mã Thùng:
                                </label>
                                <p className="font-mono text-xs text-stone-800 dark:text-zinc-200 bg-stone-100 dark:bg-zinc-800 p-2.5 rounded-lg">
                                    {editingBox.code}
                                </p>
                            </div>

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

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
                            <button
                                onClick={() => setEditingBox(null)}
                                className="px-4 py-2 text-xs font-bold text-stone-600 dark:text-zinc-400 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-xl"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveBoxEdit}
                                disabled={isSavingEdit}
                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer"
                            >
                                {isSavingEdit ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Lưu Thay Đổi</span>
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

                            {/* 3. Thông tin ngày tháng của LOT (Hiển thị đầy đủ 4 trường ngày) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div>
                                    <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} className="text-indigo-500 shrink-0" />
                                            <span className="truncate">Ngày nhập kho:</span>
                                        </span>
                                    </label>
                                    <input
                                        type="date"
                                        value={customInboundDate}
                                        onChange={e => setCustomInboundDate(e.target.value)}
                                        className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} className="text-amber-500 shrink-0" />
                                            <span className="truncate">Ngày đóng gói:</span>
                                        </span>
                                    </label>
                                    <input
                                        type="date"
                                        value={customPackagingDate}
                                        onChange={e => setCustomPackagingDate(e.target.value)}
                                        className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} className="text-orange-500 shrink-0" />
                                            <span className="truncate">Ngày sản xuất:</span>
                                        </span>
                                    </label>
                                    <input
                                        type="date"
                                        value={customPeelingDate}
                                        onChange={e => setCustomPeelingDate(e.target.value)}
                                        className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-stone-600 dark:text-zinc-400 block mb-1">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} className="text-emerald-500 shrink-0" />
                                            <span className="truncate">Ngày nhập NL:</span>
                                        </span>
                                    </label>
                                    <input
                                        type="date"
                                        value={customRawMaterialDate}
                                        onChange={e => setCustomRawMaterialDate(e.target.value)}
                                        title="Ngày nhập nguyên liệu"
                                        className="w-full h-9 px-2.5 bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-stone-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
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
