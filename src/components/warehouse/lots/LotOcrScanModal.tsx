// @ts-nocheck
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { 
    Smartphone, 
    X, 
    RefreshCw, 
    Trash2, 
    Box, 
    Layers, 
    Search, 
    CheckCircle2, 
    AlertCircle, 
    Calendar, 
    Scale, 
    Tag, 
    Stamp, 
    FileText, 
    LayoutGrid, 
    Table as TableIcon,
    Link2,
    Clock,
    MapPin,
    Users,
    Copy,
    Check,
    ExternalLink,
    Eye,
    Maximize2,
    ChevronDown,
    ChevronUp,
    Factory,
    Truck,
    Info,
    Sparkles,
    ShieldCheck
} from 'lucide-react'
import { decodeSTT } from '@/lib/numberUtils'
import { syncDatesFromBoxesToLot } from '@/lib/lotDateSync'

// Color theme system matching stamp rules
const COLOR_THEMES: Record<string, { label: string; hexPreview: string; bgClass: string; textClass: string; borderClass: string }> = {
    purple: { label: 'Tím', hexPreview: '#8b5cf6', bgClass: 'bg-purple-100 dark:bg-purple-950/70', textClass: 'text-purple-700 dark:text-purple-300', borderClass: 'border-purple-200 dark:border-purple-800' },
    blue: { label: 'Xanh dương', hexPreview: '#2563eb', bgClass: 'bg-blue-100 dark:bg-blue-950/70', textClass: 'text-blue-700 dark:text-blue-300', borderClass: 'border-blue-200 dark:border-blue-800' },
    emerald: { label: 'Xanh lá', hexPreview: '#059669', bgClass: 'bg-emerald-100 dark:bg-emerald-950/70', textClass: 'text-emerald-700 dark:text-emerald-300', borderClass: 'border-emerald-200 dark:border-emerald-800' },
    amber: { label: 'Vàng cam', hexPreview: '#d97706', bgClass: 'bg-amber-100 dark:bg-amber-950/70', textClass: 'text-amber-700 dark:text-amber-300', borderClass: 'border-amber-200 dark:border-amber-800' },
    cyan: { label: 'Xanh cyan', hexPreview: '#0891b2', bgClass: 'bg-cyan-100 dark:bg-cyan-950/70', textClass: 'text-cyan-700 dark:text-cyan-300', borderClass: 'border-cyan-200 dark:border-cyan-800' },
    fuchsia: { label: 'Hồng tím', hexPreview: '#c026d3', bgClass: 'bg-fuchsia-100 dark:bg-fuchsia-950/70', textClass: 'text-fuchsia-700 dark:text-fuchsia-300', borderClass: 'border-fuchsia-200 dark:border-fuchsia-800' },
    rose: { label: 'Đỏ hồng', hexPreview: '#e11d48', bgClass: 'bg-rose-100 dark:bg-rose-950/70', textClass: 'text-rose-700 dark:text-rose-300', borderClass: 'border-rose-200 dark:border-rose-800' }
}

const DEFAULT_LINE1_CONFIG = {
    title: 'Dòng 1: Phân cấp & Quy cách',
    total_length: 14,
    has_delimiter: true,
    delimiter_char: '-',
    fields: [
        { key: 'fruit_type', name: 'Chủng loại', shortName: 'Chủng loại', start: 0, length: 1, type: 'dictionary', dictCategory: 'fruit_type', color: 'purple' },
        { key: 'freeze_style', name: 'Hình thức cấp đông', shortName: 'Hình thức', start: 1, length: 2, type: 'dictionary', dictCategory: 'freeze_style', color: 'blue' },
        { key: 'variety', name: 'Giống trái cây', shortName: 'Giống', start: 3, length: 2, type: 'dictionary', dictCategory: 'variety', color: 'emerald' },
        { key: 'product_grade', name: 'Phân loại phẩm cấp', shortName: 'Phẩm cấp', start: 5, length: 2, type: 'dictionary', dictCategory: 'product_grade', color: 'amber' },
        { key: 'package_spec', name: 'Quy cách đóng gói', shortName: 'Quy cách', start: 7, length: 2, type: 'dictionary', dictCategory: 'package_spec', color: 'cyan' },
        { key: 'freeze_method', name: 'Phương pháp cấp đông', shortName: 'Phương pháp', start: 9, length: 3, type: 'dictionary', dictCategory: 'freeze_method', color: 'fuchsia' },
        { key: 'customer_quality', name: 'Chất lượng theo KH', shortName: 'Chất lượng', start: 13, length: 1, type: 'dictionary', dictCategory: 'customer_quality', color: 'rose', afterDelimiter: true }
    ]
}

const DEFAULT_LINE2_CONFIG = {
    title: 'Dòng 2: Truy xuất & Nguồn gốc',
    total_length: 16,
    has_delimiter: false,
    delimiter_char: '-',
    fields: [
        { key: 'factory', name: 'Nhà máy chế biến', shortName: 'Nhà máy', start: 0, length: 1, type: 'dictionary', dictCategory: 'factory', color: 'rose' },
        { key: 'pkg_date', name: 'Ngày đóng gói', shortName: 'Đóng gói', start: 1, length: 4, type: 'date_ddmm', format: 'DD/MM', color: 'amber' },
        { key: 'inbound_date', name: 'Ngày nhập nguyên liệu', shortName: 'Nhập NL', start: 5, length: 6, type: 'date_ddmmyy', format: 'DD/MM/20YY', color: 'purple' },
        { key: 'supplier', name: 'Nhà cung cấp', shortName: 'Nhà CC', start: 11, length: 3, type: 'supplier', dictCategory: 'supplier', color: 'cyan' },
        { key: 'province', name: 'Vùng nguyên liệu (Tỉnh)', shortName: 'Vùng NL', start: 14, length: 2, type: 'dictionary', dictCategory: 'province', color: 'emerald' }
    ]
}

const DEFAULT_DICT: Record<string, Record<string, string>> = {
    fruit_type: { 
        '1': 'TP cấp đông sầu riêng', 
        '2': 'TP cấp đông mít',
        '3': 'TP cấp đông dưa hấu',
        '4': 'TP cấp đông nhãn'
    },
    freeze_style: { 
        '01': 'Cấp đông nguyên trái', 
        '02': 'Cấp đông múi' 
    },
    variety: { 
        '01': 'Monthong (Dona)', 
        '02': 'Ri-6', 
        '03': 'Musang King', 
        '04': 'Black Thorn',
        '05': 'Chín Hóa'
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
        '3': 'Phước An, Đắk Lắk'
    },
    supplier: {
        '001': 'HTX Nông Nghiệp Krông Pắc',
        '047': 'Nông hộ liên kết 047',
        '716': 'Vùng trồng 716'
    },
    province: { 
        '66': 'Đắk Lắk', 
        '71': 'Bến Tre', 
        '67': 'Đắk Nông', 
        '68': 'Lâm Đồng', 
        '64': 'Gia Lai', 
        '62': 'Kon Tum', 
        '77': 'Bà Rịa - Vũng Tàu', 
        '79': 'Hồ Chí Minh', 
        '80': 'Long An', 
        '82': 'Tiền Giang', 
        '84': 'Trà Vinh', 
        '86': 'Vĩnh Long', 
        '87': 'Đồng Tháp', 
        '89': 'An Giang', 
        '91': 'Kiên Giang', 
        '92': 'Cần Thơ', 
        '93': 'Hậu Giang', 
        '94': 'Sóc Trăng', 
        '95': 'Bạc Liêu', 
        '96': 'Cà Mau',
        '09': 'Tỉnh mã 09'
    }
}

interface DecodedSegment {
    key: string
    name: string
    shortName: string
    code: string
    value: string
    theme: { label: string; hexPreview: string; bgClass: string; textClass: string; borderClass: string }
}

export interface DecodedBoxInfo {
    isStamp: boolean
    stampLine1: string
    stampLine2: string
    l1Segments: DecodedSegment[]
    l2Segments: DecodedSegment[]
    productTitle: string
    fruitType: string
    freezeStyle: string
    variety: string
    productGrade: string
    packageSpec: string
    freezeMethod: string
    customerQuality: string
    factory: string
    packagingDate: string
    inboundDate: string
    supplier: string
    region: string
    traceabilitySummary: string
    // Labels data
    sku: string
    spec: string
    shiftGroup: string
    productionDate: string
    finishedLot: string
    semiFinishedLot: string
}

/**
 * Giải mã chi tiết một thùng hàng
 */
function decodeBoxItem(box: any, dictMap: Record<string, Record<string, string>>, activeFormat: any): DecodedBoxInfo {
    const meta = box.metadata || {}
    const isStamp = meta.scan_type === 'stamp' || !!meta.stamp_line1 || (box.code || '').startsWith('STAMP-')

    const l1Config = activeFormat?.line1_config || DEFAULT_LINE1_CONFIG
    const l2Config = activeFormat?.line2_config || DEFAULT_LINE2_CONFIG

    let stampLine1 = meta.stamp_line1 || ''
    let stampLine2 = meta.stamp_line2 || box.semi_finished_lot_code || box.finished_lot_code || ''

    if (!stampLine1 && (box.code || '').startsWith('STAMP-')) {
        const parts = box.code.split('-')
        if (parts.length >= 3) {
            stampLine1 = parts[1] || ''
            stampLine2 = parts[2] || ''
        }
    }

    // Giải mã Dòng 1
    const cleanL1 = (stampLine1 || '').trim().replace(/\s+/g, '')
    const digitsOnlyL1 = cleanL1.replace(/[^0-9]/g, '')
    const l1Segments: DecodedSegment[] = []

    const fieldsL1 = l1Config.fields || []
    for (const field of fieldsL1) {
        let code = ''
        if (field.afterDelimiter && cleanL1.includes('-')) {
            const parts = cleanL1.split('-')
            code = parts[parts.length - 1] || ''
        } else if (field.afterDelimiter && digitsOnlyL1.length >= 13) {
            code = digitsOnlyL1.substring(13, 14)
        } else if (cleanL1.length >= field.start + field.length) {
            code = cleanL1.substring(field.start, field.start + field.length)
        } else if (digitsOnlyL1.length >= field.start + field.length) {
            code = digitsOnlyL1.substring(field.start, field.start + field.length)
        }

        let value = code ? `Mã ${code}` : '---'
        if (code) {
            if (field.type === 'dictionary' && field.dictCategory) {
                value = dictMap[field.dictCategory]?.[code] || DEFAULT_DICT[field.dictCategory]?.[code] || `Mã ${code}`
            } else if (field.type === 'raw') {
                value = code
            }
        }

        const theme = COLOR_THEMES[field.color] || COLOR_THEMES.purple
        l1Segments.push({
            key: field.key,
            name: field.name,
            shortName: field.shortName || field.name,
            code: code || '?',
            value,
            theme
        })
    }

    // Giải mã Dòng 2
    const cleanL2 = (stampLine2 || '').trim().replace(/[^0-9]/g, '')
    const l2Segments: DecodedSegment[] = []
    const fieldsL2 = l2Config.fields || []

    for (const field of fieldsL2) {
        let code = ''
        if (cleanL2.length >= field.start + field.length) {
            code = cleanL2.substring(field.start, field.start + field.length)
        }

        let value = code ? `Mã ${code}` : '---'
        if (code) {
            if (field.type === 'dictionary' && field.dictCategory) {
                value = dictMap[field.dictCategory]?.[code] || DEFAULT_DICT[field.dictCategory]?.[code] || `Mã ${code}`
            } else if (field.type === 'supplier') {
                const supp = dictMap['supplier']?.[code] || DEFAULT_DICT['supplier']?.[code]
                value = supp ? `${code} (${supp})` : `Mã NCC ${code}`
            } else if (field.type === 'date_ddmm' && code.length === 4) {
                value = `${code.substring(0, 2)}/${code.substring(2, 4)}`
            } else if (field.type === 'date_ddmmyy' && code.length === 6) {
                value = `${code.substring(0, 2)}/${code.substring(2, 4)}/20${code.substring(4, 6)}`
            } else if (field.type === 'raw') {
                value = code
            }
        }

        const theme = COLOR_THEMES[field.color] || COLOR_THEMES.blue
        l2Segments.push({
            key: field.key,
            name: field.name,
            shortName: field.shortName || field.name,
            code: code || '?',
            value,
            theme
        })
    }

    // Trích xuất các trường tóm tắt tiện dụng
    const fruitType = l1Segments.find(s => s.key === 'fruit_type')?.value || ''
    const freezeStyle = l1Segments.find(s => s.key === 'freeze_style')?.value || ''
    const variety = l1Segments.find(s => s.key === 'variety')?.value || ''
    const productGrade = l1Segments.find(s => s.key === 'product_grade')?.value || ''
    const packageSpec = l1Segments.find(s => s.key === 'package_spec')?.value || meta.spec || '---'
    const freezeMethod = l1Segments.find(s => s.key === 'freeze_method')?.value || '---'
    const customerQuality = l1Segments.find(s => s.key === 'customer_quality')?.value || '---'

    const factory = l2Segments.find(s => s.key === 'factory')?.value || meta.shift_group || '---'
    
    // 1. Ngày đóng gói (DD/MM từ Dòng 2 hoặc metadata)
    const packagingDate = l2Segments.find(s => s.key === 'pkg_date')?.value || meta.packaging_date || '---'

    // 2. Ngày nhập nguyên liệu (DD/MM/YYYY từ Dòng 2 quy chuẩn hoặc metadata)
    const inboundDate = l2Segments.find(s => s.key === 'inbound_date')?.value || meta.production_date || meta.raw_material_date || meta.inbound_date || '---'

    // 3. Ngày sản xuất (đặc biệt đối với quét tem nhãn OCR)
    const productionDate = meta.production_date || meta.peeling_date || (!isStamp ? inboundDate : '---')

    const supplier = l2Segments.find(s => s.key === 'supplier')?.value || '---'
    const region = l2Segments.find(s => s.key === 'province')?.value || meta.region || '---'

    // Tiêu đề sản phẩm
    let productTitle = meta.product_name || box.products?.name || ''
    if (!productTitle && isStamp) {
        const parts = [fruitType, variety, freezeStyle, productGrade].filter(p => p && !p.startsWith('Mã ?') && !p.startsWith('---'))
        productTitle = parts.join(' • ')
    }
    if (!productTitle) productTitle = 'Sản phẩm tiêu chuẩn'

    const traceParts = [
        factory !== '---' ? factory : '',
        packagingDate !== '---' ? `ĐG: ${packagingDate}` : '',
        inboundDate !== '---' ? `Nhập NL: ${inboundDate}` : '',
        productionDate !== '---' && !isStamp ? `SX: ${productionDate}` : '',
        supplier !== '---' ? `NCC: ${supplier}` : '',
        region !== '---' ? `Vùng: ${region}` : ''
    ].filter(Boolean)
    const traceabilitySummary = traceParts.length > 0 ? traceParts.join(' • ') : '---'

    return {
        isStamp,
        stampLine1,
        stampLine2,
        l1Segments,
        l2Segments,
        productTitle,
        fruitType,
        freezeStyle,
        variety,
        productGrade,
        packageSpec,
        freezeMethod,
        customerQuality,
        factory,
        packagingDate,
        inboundDate,
        productionDate,
        supplier,
        region,
        traceabilitySummary,
        sku: meta.sku || box.products?.sku || '---',
        spec: meta.spec || packageSpec || '---',
        shiftGroup: meta.shift_group || factory || '---',
        finishedLot: box.finished_lot_code || meta.lot_code || '---',
        semiFinishedLot: box.semi_finished_lot_code || meta.lot_code || '---'
    }
}

interface LotOcrScanModalProps {
    lotId: string
    lotCode: string
    dailySeq?: number | string | null
    lotName?: string
    onClose: () => void
    searchTerm?: string
}

export function LotOcrScanModal({ lotId, lotCode, dailySeq, lotName, onClose, searchTerm: initialSearch = '' }: LotOcrScanModalProps) {
    const { showToast } = useToast()
    const [boxes, setBoxes] = useState<any[]>([])
    const [unlinkedMatchingBoxes, setUnlinkedMatchingBoxes] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUnlinking, setIsUnlinking] = useState<string | null>(null)
    const [isLinkingNow, setIsLinkingNow] = useState(false)
    const [searchQuery, setSearchQuery] = useState(initialSearch)
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
    const [filterType, setFilterType] = useState<'all' | 'label' | 'stamp'>('all')
    const [isExpandedAll, setIsExpandedAll] = useState(true)
    const [selectedBoxForDetail, setSelectedBoxForDetail] = useState<any | null>(null)
    const [copiedBoxCode, setCopiedBoxCode] = useState<string | null>(null)
    const [showBannerStampDetails, setShowBannerStampDetails] = useState(false)

    // Cấu hình con dấu & từ điển từ Supabase
    const [activeFormat, setActiveFormat] = useState<any>(null)
    const [dictMap, setDictMap] = useState<Record<string, Record<string, string>>>(DEFAULT_DICT)

    const sttDisplay = useMemo(() => {
        return decodeSTT(dailySeq) || ''
    }, [dailySeq])

    // Tải cấu hình khuôn dấu & từ điển
    useEffect(() => {
        async function loadStampConfig() {
            try {
                const { data: fmtData } = await supabase
                    .from('stamp_formats')
                    .select('*')
                    .eq('is_active', true)
                    .order('is_default', { ascending: false })
                    .limit(1)
                    .maybeSingle()

                if (fmtData) setActiveFormat(fmtData)

                const { data: dictData } = await supabase
                    .from('stamp_dictionaries')
                    .select('*')
                    .eq('is_active', true)

                if (dictData && dictData.length > 0) {
                    const mapped: Record<string, Record<string, string>> = { ...DEFAULT_DICT }
                    dictData.forEach((item: any) => {
                        if (!mapped[item.category]) mapped[item.category] = {}
                        mapped[item.category][item.code] = item.name
                    })
                    setDictMap(mapped)
                }
            } catch (err) {
                console.warn('Lỗi tải cấu hình con dấu:', err)
            }
        }
        loadStampConfig()
    }, [])

    // Lấy thông tin các thùng đã gắn vào lot này
    const fetchBoxData = useCallback(async () => {
        setIsLoading(true)
        try {
            // 1. Tải danh sách thùng đã gắn vào Lô (lot_id = lotId)
            const { data, error } = await supabase
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
                    products (
                        id,
                        name,
                        sku,
                        internal_code,
                        internal_name
                    )
                `)
                .eq('lot_id', lotId)
                .order('created_at', { ascending: true })

            if (error) throw error

            const sorted = (data || []).sort((a: any, b: any) => {
                const idxA = a.metadata?.box_index !== undefined ? Number(a.metadata.box_index) : parseInt((a.code || '').split('-').pop() || '0', 10)
                const idxB = b.metadata?.box_index !== undefined ? Number(b.metadata.box_index) : parseInt((b.code || '').split('-').pop() || '0', 10)
                return idxA - idxB
            })
            setBoxes(sorted)

            // 2. Nếu Lô chưa có thùng nào và có STT, kiểm tra xem có thùng nào trên điện thoại đã đồng bộ lên với STT này nhưng chưa gán lot_id không
            if ((!data || data.length === 0) && sttDisplay) {
                const { data: pendingData, error: pendingErr } = await supabase
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
                        products (
                            id,
                            name,
                            sku,
                            internal_code,
                            internal_name
                        )
                    `)
                    .is('lot_id', null)
                    .filter('metadata->>pallet_stt', 'eq', sttDisplay.toUpperCase())

                if (!pendingErr && pendingData && pendingData.length > 0) {
                    setUnlinkedMatchingBoxes(pendingData)
                } else {
                    setUnlinkedMatchingBoxes([])
                }
            } else {
                setUnlinkedMatchingBoxes([])
            }
        } catch (err: any) {
            console.error('Lỗi khi tải dữ liệu quét OCR:', err)
            showToast('Không thể tải dữ liệu quét: ' + err.message, 'error')
        } finally {
            setIsLoading(false)
        }
    }, [lotId, sttDisplay, showToast])

    useEffect(() => {
        if (lotId) {
            fetchBoxData()
        }
    }, [lotId, fetchBoxData])

    // Kết nối nhanh các thùng chưa liên kết có cùng STT vào Lô này
    const handleQuickLink = async () => {
        if (unlinkedMatchingBoxes.length === 0) return
        setIsLinkingNow(true)
        try {
            const ids = unlinkedMatchingBoxes.map(b => b.id)
            const { error } = await supabase
                .from('box_labels')
                .update({ lot_id: lotId, status: 'linked' })
                .in('id', ids)

            if (error) throw error

            // Đồng bộ ngày sản xuất và ngày nguyên liệu từ thùng vào Lô
            await syncDatesFromBoxesToLot(lotId, unlinkedMatchingBoxes)

            showToast(`Đã kết nối thành công ${ids.length} thùng vào Lô này theo STT ${sttDisplay}`, 'success')
            await fetchBoxData()
        } catch (err: any) {
            console.error('Lỗi kết nối thùng theo STT:', err)
            showToast('Không thể kết nối: ' + err.message, 'error')
        } finally {
            setIsLinkingNow(false)
        }
    }

    // Gỡ thùng ra khỏi Lô
    const handleUnlink = async (labelId: string, labelCode: string) => {
        const confirmed = window.confirm(`Bạn có chắc chắn muốn gỡ thùng "${labelCode}" ra khỏi Lô này không?`)
        if (!confirmed) return

        setIsUnlinking(labelId)
        try {
            const { error } = await supabase
                .from('box_labels')
                .update({ lot_id: null, status: 'unlinked' })
                .eq('id', labelId)

            if (error) throw error

            setBoxes(prev => prev.filter(item => item.id !== labelId))
            if (selectedBoxForDetail?.id === labelId) {
                setSelectedBoxForDetail(null)
            }
            showToast(`Đã gỡ liên kết thùng ${labelCode} thành công`, 'success')
        } catch (err: any) {
            console.error('Lỗi gỡ liên kết thùng:', err)
            showToast('Không thể gỡ liên kết: ' + err.message, 'error')
        } finally {
            setIsUnlinking(null)
        }
    }

    // Sao chép mã thùng
    const handleCopyBoxCode = (code: string) => {
        navigator.clipboard.writeText(code)
        setCopiedBoxCode(code)
        showToast(`Đã sao chép: ${code}`, 'success')
        setTimeout(() => setCopiedBoxCode(null), 2000)
    }

    // Helper trích xuất số thứ tự thùng
    const getBoxNumber = (box: any): string => {
        if (box.metadata?.box_index !== undefined && box.metadata?.box_index !== null) {
            return String(box.metadata.box_index).padStart(2, '0')
        }
        if (!box.code) return '---'
        const parts = box.code.trim().split('-')
        const last = parts[parts.length - 1]
        return !isNaN(Number(last)) ? String(parseInt(last, 10)).padStart(2, '0') : box.code
    }

    // Lọc danh sách thùng theo tìm kiếm và tab phân loại
    const enrichedBoxes = useMemo(() => {
        return boxes.map(b => ({
            box: b,
            decoded: decodeBoxItem(b, dictMap, activeFormat)
        }))
    }, [boxes, dictMap, activeFormat])

    const filteredBoxes = useMemo(() => {
        return enrichedBoxes.filter(({ box, decoded }) => {
            if (filterType === 'label' && decoded.isStamp) return false
            if (filterType === 'stamp' && !decoded.isStamp) return false

            if (!searchQuery.trim()) return true
            const q = searchQuery.toLowerCase().trim()
            const matchIndex = getBoxNumber(box).includes(q)
            const matchCode = (box.code || '').toLowerCase().includes(q)
            const matchTitle = (decoded.productTitle || '').toLowerCase().includes(q)
            const matchSku = (decoded.sku || '').toLowerCase().includes(q)
            const matchStamp1 = (decoded.stampLine1 || '').toLowerCase().includes(q)
            const matchStamp2 = (decoded.stampLine2 || '').toLowerCase().includes(q)
            const matchFactory = (decoded.factory || '').toLowerCase().includes(q)
            const matchRegion = (decoded.region || '').toLowerCase().includes(q)
            const matchSupplier = (decoded.supplier || '').toLowerCase().includes(q)
            const matchLot = (decoded.finishedLot || decoded.semiFinishedLot || '').toLowerCase().includes(q)
            const matchDate = (decoded.packagingDate || decoded.inboundDate || '').toLowerCase().includes(q)

            return matchIndex || matchCode || matchTitle || matchSku || matchStamp1 || matchStamp2 || matchFactory || matchRegion || matchSupplier || matchLot || matchDate
        })
    }, [enrichedBoxes, searchQuery, filterType])

    // Thống kê tổng hợp
    const stats = useMemo(() => {
        const total = boxes.length
        const totalWeight = boxes.reduce((sum, b) => sum + (parseFloat(b.quantity) || 0), 0)
        const unit = boxes[0]?.unit || 'Kg'
        const stampCount = enrichedBoxes.filter(e => e.decoded.isStamp).length
        const labelCount = total - stampCount

        // Lấy thông tin tiêu chuẩn từ thùng đầu tiên
        const firstDecoded = enrichedBoxes[0]?.decoded

        return {
            total,
            totalWeight,
            unit,
            stampCount,
            labelCount,
            firstDecoded,
            percentStandardPallet: Math.min(100, Math.round((total / 30) * 100))
        }
    }, [boxes, enrichedBoxes])

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* 1. Header Modal */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50 dark:bg-slate-850/90 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0 ring-2 ring-indigo-500/20">
                            <Smartphone size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight">
                                    Thông Tin Quét OCR & Con Dấu Điện Thoại
                                </h3>
                                {sttDisplay && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1 shadow-2xs">
                                        <Tag size={11} /> STT: {sttDisplay}
                                    </span>
                                )}
                                {boxes.length > 0 ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                        <CheckCircle2 size={12} /> Đã kết nối ({boxes.length} thùng)
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20 flex items-center gap-1">
                                        <AlertCircle size={12} /> Chưa có thùng kết nối
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono truncate">
                                <span>Mã Lô: <strong className="text-slate-800 dark:text-slate-200">{lotCode}</strong></span>
                                {lotName && (
                                    <span className="font-sans text-slate-600 dark:text-slate-400 truncate max-w-sm sm:max-w-md">
                                        • {lotName}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Đóng (ESC)"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* 2. Body Modal */}
                <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                    
                    {/* Báo động phát hiện thùng chưa liên kết nhưng cùng STT */}
                    {unlinkedMatchingBoxes.length > 0 && boxes.length === 0 && (
                        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                                    <Link2 size={16} />
                                </div>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                                        Phát hiện {unlinkedMatchingBoxes.length} thùng đã quét từ điện thoại với STT "{sttDisplay}"
                                    </h4>
                                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                        Các thùng này đã được đồng bộ lên hệ thống nhưng chưa được gán mã Lô. Bấm nút bên dưới để liên kết ngay vào Lô này.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleQuickLink}
                                disabled={isLinkingNow}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                                {isLinkingNow ? (
                                    <>
                                        <RefreshCw size={13} className="animate-spin" />
                                        Đang kết nối...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={14} />
                                        Kết nối {unlinkedMatchingBoxes.length} thùng ngay
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-3">
                            <RefreshCw className="text-indigo-500 animate-spin" size={36} />
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Đang tải và giải mã dữ liệu quét OCR từ thiết bị di động...
                            </p>
                        </div>
                    ) : boxes.length > 0 ? (
                        <div className="space-y-4">
                            
                            {/* BANNER TỔNG HỢP GIẢI MÃ SẢN PHẨM & TRUY XUẤT CỦA LÔ */}
                            {stats.firstDecoded && (
                                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-blue-50/80 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-blue-950/30 border border-indigo-100/90 dark:border-indigo-900/50 space-y-3 shadow-xs">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 dark:border-indigo-900/40 pb-2.5">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs shadow-xs">
                                                <Sparkles size={13} />
                                            </span>
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                    Thông Tin Thành Phẩm Chuẩn Hóa Theo Con Dấu / Tem
                                                </div>
                                                <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                                    {stats.firstDecoded.productTitle}
                                                </h4>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {stats.firstDecoded.isStamp && (
                                                <button
                                                    onClick={() => setShowBannerStampDetails(!showBannerStampDetails)}
                                                    className="px-3 py-1 rounded-xl bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800 flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                                                >
                                                    <Box size={12} />
                                                    <span>{showBannerStampDetails ? 'Thu gọn bảng giải mã' : 'Bảng giải mã 2 dòng của Lô'}</span>
                                                </button>
                                            )}
                                            {stats.firstDecoded.isStamp && (
                                                <a
                                                    href={`/tra-cuu-tem?l1=${encodeURIComponent(stats.firstDecoded.stampLine1)}&l2=${encodeURIComponent(stats.firstDecoded.stampLine2)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-all shadow-2xs"
                                                >
                                                    <ExternalLink size={12} />
                                                    <span>Mở Cổng Tra Cứu Tem</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bảng chi tiết 2 cột con dấu mở rộng trong Banner */}
                                    {showBannerStampDetails && stats.firstDecoded.isStamp && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/40 animate-in fade-in duration-150">
                                            {/* Dòng 1 */}
                                            <div className="p-3.5 rounded-2xl bg-slate-900/90 text-white border border-indigo-900/50 space-y-2 text-xs shadow-md">
                                                <div className="font-bold text-amber-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                                    <span className="flex items-center gap-1.5">
                                                        <Box size={14} className="text-amber-400" /> KẾT QUẢ GIẢI MÃ DÒNG 1:
                                                    </span>
                                                    <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {stats.firstDecoded.l1Segments.map((seg: any, idx: number) => (
                                                        <div 
                                                            key={idx}
                                                            className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800"
                                                        >
                                                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}>
                                                                {seg.code}
                                                            </span>
                                                            <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.name}:</span>
                                                            <strong className={`text-xs font-bold truncate ml-auto ${seg.theme.textClass}`}>
                                                                {seg.value}
                                                            </strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Dòng 2 */}
                                            <div className="p-3.5 rounded-2xl bg-slate-900/90 text-white border border-indigo-900/50 space-y-2 text-xs shadow-md">
                                                <div className="font-bold text-emerald-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                                    <span className="flex items-center gap-1.5">
                                                        <Factory size={14} className="text-emerald-400" /> KẾT QUẢ GIẢI MÃ DÒNG 2:
                                                    </span>
                                                    <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    {stats.firstDecoded.l2Segments.map((seg: any, idx: number) => (
                                                        <div 
                                                            key={idx}
                                                            className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800"
                                                        >
                                                            <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}>
                                                                {seg.code}
                                                            </span>
                                                            <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.name}:</span>
                                                            <strong className={`text-xs font-bold truncate ml-auto ${seg.theme.textClass}`}>
                                                                {seg.value}
                                                            </strong>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Các thông số chuẩn hóa bóc tách */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                                        <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Chủng loại</span>
                                            <span className="font-bold text-purple-700 dark:text-purple-300 text-xs truncate block" title={stats.firstDecoded.fruitType}>
                                                {stats.firstDecoded.fruitType || 'TP Cấp đông'}
                                            </span>
                                        </div>
                                        <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Giống & Phẩm cấp</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block" title={`${stats.firstDecoded.variety} • ${stats.firstDecoded.productGrade}`}>
                                                {stats.firstDecoded.variety || '---'} • {stats.firstDecoded.productGrade || '---'}
                                            </span>
                                        </div>
                                        <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Quy cách & Đông</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block" title={`${stats.firstDecoded.packageSpec} • ${stats.firstDecoded.freezeMethod}`}>
                                                {stats.firstDecoded.packageSpec} • {stats.firstDecoded.freezeMethod}
                                            </span>
                                        </div>
                                        <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Nhà máy chế biến</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block" title={stats.firstDecoded.factory}>
                                                {stats.firstDecoded.factory}
                                            </span>
                                        </div>
                                        <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Đóng gói & Nhập NL</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs font-mono truncate block" title={`ĐG: ${stats.firstDecoded.packagingDate} • NL: ${stats.firstDecoded.inboundDate}`}>
                                                ĐG: {stats.firstDecoded.packagingDate} • NL: {stats.firstDecoded.inboundDate}
                                            </span>
                                        </div>
                                        <div className="bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-xl border border-indigo-100/60 dark:border-indigo-900/40">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase block">Vùng & Nhà CC</span>
                                            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate block" title={`${stats.firstDecoded.region} • ${stats.firstDecoded.supplier}`}>
                                                {stats.firstDecoded.region} • {stats.firstDecoded.supplier}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 4 Thẻ Thống Kê Tổng Quan */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {/* Thẻ 1: Tổng số thùng & Tiến độ Pallet */}
                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50/50 dark:from-indigo-950/20 dark:to-blue-950/10 border border-indigo-100 dark:border-indigo-900/40 flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                                            <span className="flex items-center gap-1"><Box size={12} /> Tổng số thùng</span>
                                            <span className="font-mono text-[10px] font-black">{stats.percentStandardPallet}%</span>
                                        </div>
                                        <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tabular-nums">
                                            {stats.total} <span className="text-xs font-semibold text-slate-500">thùng</span>
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${stats.total >= 30 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                style={{ width: `${stats.percentStandardPallet}%` }}
                                            />
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {stats.total >= 30 ? '✅ Đủ chuẩn Pallet (30 thùng)' : `Đã xếp ${stats.total}/30 thùng`}
                                        </div>
                                    </div>
                                </div>

                                {/* Thẻ 2: Tổng trọng lượng */}
                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10 border border-emerald-100 dark:border-emerald-900/40 flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                            <Scale size={12} /> Tổng trọng lượng
                                        </div>
                                        <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                                            {stats.totalWeight.toFixed(2)} <span className="text-xs font-semibold">{stats.unit}</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2">
                                        TB: {(stats.totalWeight / (stats.total || 1)).toFixed(2)} {stats.unit}/thùng
                                    </div>
                                </div>

                                {/* Thẻ 3: Phương thức quét */}
                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/10 border border-purple-100 dark:border-purple-900/40 flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                            <Stamp size={12} /> Phương thức quét
                                        </div>
                                        <div className="text-sm font-black text-purple-700 dark:text-purple-300 mt-1.5 flex items-center gap-1.5">
                                            {stats.stampCount > 0 && stats.labelCount > 0 ? (
                                                'Hỗn hợp tem & dấu'
                                            ) : stats.stampCount > 0 ? (
                                                'Dấu Đóng Mực (Kraft)'
                                            ) : (
                                                'Quét Tem Nhãn (OCR)'
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex gap-2 font-mono">
                                        {stats.stampCount > 0 && <span>Dấu: <strong className="text-purple-600 dark:text-purple-400">{stats.stampCount}</strong></span>}
                                        {stats.labelCount > 0 && <span>Tem: <strong className="text-indigo-600 dark:text-indigo-400">{stats.labelCount}</strong></span>}
                                    </div>
                                </div>

                                {/* Thẻ 4: Truy xuất & Nguồn gốc */}
                                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-100 dark:border-amber-900/40 flex flex-col justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                            <Calendar size={12} /> Ngày đóng gói & Vùng
                                        </div>
                                        <div className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-1.5 truncate">
                                            {stats.firstDecoded?.packagingDate !== '---' ? stats.firstDecoded?.packagingDate : 'Chưa nhận diện'}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 truncate">
                                        Tổ: {stats.firstDecoded?.factory || '---'} • Vùng: {stats.firstDecoded?.region || '---'}
                                    </div>
                                </div>
                            </div>

                            {/* Thanh công cụ tìm kiếm, phân loại & hiển thị */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                                <div className="flex items-center gap-2 flex-1 flex-wrap">
                                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="Tìm mã thùng, STT #01, con dấu, tên SP, nhà máy..."
                                            className="w-full pl-8.5 pr-8 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-200"
                                        />
                                        {searchQuery && (
                                            <button 
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Tabs loại tem */}
                                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs shrink-0">
                                        <button
                                            onClick={() => setFilterType('all')}
                                            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                                filterType === 'all'
                                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            Tất cả ({boxes.length})
                                        </button>
                                        {stats.stampCount > 0 && (
                                            <button
                                                onClick={() => setFilterType('stamp')}
                                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                                    filterType === 'stamp'
                                                        ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-2xs'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                Dấu đóng ({stats.stampCount})
                                            </button>
                                        )}
                                        {stats.labelCount > 0 && (
                                            <button
                                                onClick={() => setFilterType('label')}
                                                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                                    filterType === 'label'
                                                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                }`}
                                            >
                                                Tem OCR ({stats.labelCount})
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Chế độ xem Grid / Table & Mở rộng chi tiết & Refresh */}
                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <button
                                        onClick={() => setIsExpandedAll(!isExpandedAll)}
                                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 flex items-center gap-1 transition-all"
                                        title={isExpandedAll ? 'Thu gọn chi tiết' : 'Mở rộng toàn bộ chi tiết'}
                                    >
                                        {isExpandedAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        <span className="hidden sm:inline">{isExpandedAll ? 'Thu gọn' : 'Hiện đủ thông tin'}</span>
                                    </button>

                                    <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60">
                                        <button
                                            onClick={() => setViewMode('grid')}
                                            className={`p-1.5 rounded-lg transition-all ${
                                                viewMode === 'grid'
                                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                            title="Xem dạng thẻ"
                                        >
                                            <LayoutGrid size={15} />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('table')}
                                            className={`p-1.5 rounded-lg transition-all ${
                                                viewMode === 'table'
                                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                    : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                            title="Xem dạng bảng"
                                        >
                                            <TableIcon size={15} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={fetchBoxData}
                                        className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                                        title="Làm mới dữ liệu"
                                    >
                                        <RefreshCw size={15} />
                                    </button>
                                </div>
                            </div>

                            {/* DANH SÁCH THÙNG: DẠNG THẺ (GRID) HOẶC BẢNG (TABLE) */}
                            {filteredBoxes.length === 0 ? (
                                <div className="py-14 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                                    Không có thùng nào khớp với bộ lọc hoặc từ khóa tìm kiếm "{searchQuery}".
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                    {filteredBoxes.map(({ box, decoded }, idx) => {
                                        const boxNum = getBoxNumber(box)

                                        return (
                                            <div 
                                                key={box.id || idx}
                                                className="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800/90 shadow-2xs hover:shadow-lg hover:border-indigo-500/40 transition-all flex flex-col justify-between relative group space-y-3"
                                            >
                                                {/* Header Thẻ Thùng */}
                                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-8 h-8 rounded-xl bg-slate-900 text-white dark:bg-slate-800 font-mono font-black text-xs flex items-center justify-center border border-slate-700 shadow-2xs">
                                                            #{boxNum}
                                                        </span>
                                                        {decoded.isStamp ? (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                                                <Stamp size={11} /> Dấu Mực Đóng
                                                            </span>
                                                        ) : (
                                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                                                <Tag size={11} /> Tem OCR
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-mono font-black text-xs px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 tabular-nums">
                                                            {box.quantity} {box.unit}
                                                        </span>
                                                        <button
                                                            onClick={() => setSelectedBoxForDetail({ box, decoded })}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                                            title="Xem chi tiết toàn bộ thùng này"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleUnlink(box.id, box.code)}
                                                            disabled={isUnlinking === box.id}
                                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                                            title="Gỡ thùng này ra khỏi Lô"
                                                        >
                                                            {isUnlinking === box.id ? (
                                                                <RefreshCw size={13} className="animate-spin text-red-500" />
                                                            ) : (
                                                                <Trash2 size={13} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Tiêu Đề Sản Phẩm Đã Bóc Tách */}
                                                <div>
                                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        Sản phẩm giải mã
                                                    </div>
                                                    <h5 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5 line-clamp-2">
                                                        {decoded.productTitle}
                                                    </h5>
                                                </div>

                                                {/* KHU VỰC CON DẤU MỰC: Phân tích chi tiết dãy số */}
                                                {decoded.isStamp && (
                                                    <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                                        {/* Dòng 1 */}
                                                        <div>
                                                            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                                                <span className="font-bold text-purple-700 dark:text-purple-300">Dòng 1 (14 số):</span>
                                                                <span className="font-black text-slate-800 dark:text-slate-200 tracking-wider">{decoded.stampLine1 || '---'}</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {decoded.l1Segments.map((seg, sIdx) => (
                                                                    <span
                                                                        key={sIdx}
                                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}
                                                                        title={`${seg.name}: ${seg.value}`}
                                                                    >
                                                                        {seg.code}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Dòng 2 */}
                                                        <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                                                            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                                                <span className="font-bold text-blue-700 dark:text-blue-300">Dòng 2 (16 số):</span>
                                                                <span className="font-black text-slate-800 dark:text-slate-200 tracking-wider">{decoded.stampLine2 || '---'}</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {decoded.l2Segments.map((seg, sIdx) => (
                                                                    <span
                                                                        key={sIdx}
                                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}
                                                                        title={`${seg.name}: ${seg.value}`}
                                                                    >
                                                                        {seg.code}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* KHU VỰC THÔNG TIN BÓC TÁCH CHI TIẾT (Mở rộng hoặc thu gọn) */}
                                                {isExpandedAll && (
                                                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5 text-xs">
                                                        {decoded.isStamp ? (
                                                            <div className="space-y-2.5">
                                                                {/* Kết quả Dòng 1 */}
                                                                <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/50 space-y-1.5 shadow-2xs">
                                                                    <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center justify-between text-[10px] uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800 pb-1.5">
                                                                        <span className="flex items-center gap-1.5">
                                                                            <Box size={13} className="text-amber-500" /> KẾT QUẢ GIẢI MÃ DÒNG 1:
                                                                        </span>
                                                                        <span className="text-[9px] font-normal text-slate-400 lowercase hidden sm:inline">màu tương ứng với đoạn mã</span>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        {decoded.l1Segments.map((seg, sIdx) => (
                                                                            <div 
                                                                                key={sIdx}
                                                                                className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                                                            >
                                                                                <span className={`px-2 py-0.5 rounded font-mono font-black text-[10px] border shrink-0 ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}>
                                                                                    {seg.code}
                                                                                </span>
                                                                                <span className="text-slate-500 dark:text-slate-400 text-[10px] shrink-0 font-medium">{seg.name}:</span>
                                                                                <strong className={`text-[11px] font-bold truncate ml-auto ${seg.theme.textClass}`}>
                                                                                    {seg.value}
                                                                                </strong>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* Kết quả Dòng 2 */}
                                                                <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/50 space-y-1.5 shadow-2xs">
                                                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between text-[10px] uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800 pb-1.5">
                                                                        <span className="flex items-center gap-1.5">
                                                                            <Factory size={13} className="text-emerald-500" /> KẾT QUẢ GIẢI MÃ DÒNG 2:
                                                                        </span>
                                                                        <span className="text-[9px] font-normal text-slate-400 lowercase hidden sm:inline">màu tương ứng với đoạn mã</span>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        {decoded.l2Segments.map((seg, sIdx) => (
                                                                            <div 
                                                                                key={sIdx}
                                                                                className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                                                            >
                                                                                <span className={`px-2 py-0.5 rounded font-mono font-black text-[10px] border shrink-0 ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}>
                                                                                    {seg.code}
                                                                                </span>
                                                                                <span className="text-slate-500 dark:text-slate-400 text-[10px] shrink-0 font-medium">{seg.name}:</span>
                                                                                <strong className={`text-[11px] font-bold truncate ml-auto ${seg.theme.textClass}`}>
                                                                                    {seg.value}
                                                                                </strong>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            /* Tem OCR nhãn thông thường */
                                                            <div className="space-y-1.5 text-xs">
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="text-slate-400">Quy cách & Đông:</span>
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                                        {decoded.packageSpec} • {decoded.freezeMethod}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="text-slate-400">Nhà máy / Cơ sở:</span>
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                                                        {decoded.factory}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="text-slate-400">Ngày đóng gói:</span>
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                                                        {decoded.packagingDate}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="text-slate-400">Ngày nhập NL:</span>
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                                                        {decoded.inboundDate}
                                                                    </span>
                                                                </div>
                                                                {decoded.productionDate !== '---' && (
                                                                    <div className="flex items-center justify-between text-[11px]">
                                                                        <span className="text-slate-400">Ngày sản xuất:</span>
                                                                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                                                            {decoded.productionDate}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="text-slate-400">Vùng & Nhà CC:</span>
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[170px]" title={`${decoded.region} • ${decoded.supplier}`}>
                                                                        {decoded.region} • {decoded.supplier}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center justify-between text-[11px]">
                                                                    <span className="text-slate-400">SKU / Lô BTP:</span>
                                                                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                                                        {decoded.sku} • {decoded.semiFinishedLot}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Footer Thẻ */}
                                                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                                    <button
                                                        onClick={() => handleCopyBoxCode(box.code)}
                                                        className="flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer truncate max-w-[200px]"
                                                        title="Bấm để sao chép mã thùng đầy đủ"
                                                    >
                                                        {copiedBoxCode === box.code ? (
                                                            <Check size={11} className="text-emerald-500 shrink-0" />
                                                        ) : (
                                                            <Copy size={11} className="shrink-0" />
                                                        )}
                                                        <span className="truncate">{box.code}</span>
                                                    </button>
                                                    <span className="flex items-center gap-1 shrink-0">
                                                        <Clock size={11} />
                                                        {new Date(box.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                /* BẢNG DỮ LIỆU ĐẦY ĐỦ (TABLE VIEW) */
                                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-xs min-w-[900px]">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                                    <th className="px-3 py-3 text-center w-12">#</th>
                                                    <th className="px-3 py-3">Mã thùng</th>
                                                    <th className="px-3 py-3">Loại</th>
                                                    <th className="px-3 py-3">Sản phẩm giải mã</th>
                                                    <th className="px-3 py-3">Quy cách & Cấp đông</th>
                                                    <th className="px-3 py-3">Nhà máy & Vùng</th>
                                                    <th className="px-3 py-3">Ngày đóng gói</th>
                                                    <th className="px-3 py-3">Ngày nhập NL</th>
                                                    <th className="px-3 py-3">Ngày sản xuất</th>
                                                    <th className="px-3 py-3">Dãy số gốc</th>
                                                    <th className="px-3 py-3 text-right">Trọng lượng</th>
                                                    <th className="px-3 py-3 text-center">Thời gian</th>
                                                    <th className="px-3 py-3 text-center w-16">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                {filteredBoxes.map(({ box, decoded }, idx) => {
                                                    const boxNum = getBoxNumber(box)

                                                    return (
                                                        <tr key={box.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                                                            <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                #{boxNum}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-[11px] font-medium text-slate-800 dark:text-slate-200">
                                                                <div className="flex items-center gap-1.5 max-w-[170px]">
                                                                    <span className="truncate" title={box.code}>{box.code}</span>
                                                                    <button
                                                                        onClick={() => handleCopyBoxCode(box.code)}
                                                                        className="p-1 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                                                                        title="Sao chép mã thùng"
                                                                    >
                                                                        {copiedBoxCode === box.code ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                                {decoded.isStamp ? (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/25">
                                                                        Dấu đóng
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/25">
                                                                        Tem OCR
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 max-w-[220px]">
                                                                <div className="font-bold text-slate-900 dark:text-white truncate" title={decoded.productTitle}>
                                                                    {decoded.productTitle}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                                    {[decoded.fruitType, decoded.variety, decoded.freezeStyle, decoded.productGrade].filter(p => p && p !== '---').join(' • ')}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-slate-700 dark:text-slate-300">
                                                                <div>{decoded.packageSpec}</div>
                                                                <div className="text-[10px] text-slate-400">{decoded.freezeMethod}</div>
                                                            </td>
                                                            <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-slate-700 dark:text-slate-300">
                                                                <div>{decoded.factory}</div>
                                                                <div className="text-[10px] text-slate-400">{decoded.region}</div>
                                                                {decoded.supplier !== '---' && (
                                                                    <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium truncate max-w-[150px]">
                                                                        NCC: {decoded.supplier}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 whitespace-nowrap text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-200">
                                                                {decoded.packagingDate}
                                                            </td>
                                                            <td className="px-3 py-2.5 whitespace-nowrap text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                                                {decoded.inboundDate}
                                                            </td>
                                                            <td className="px-3 py-2.5 whitespace-nowrap text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                                                {!decoded.isStamp && decoded.productionDate !== '---' ? decoded.productionDate : '---'}
                                                            </td>
                                                            <td className="px-3 py-2.5 font-mono text-[11px]">
                                                                {decoded.isStamp ? (
                                                                    <div className="space-y-0.5 leading-tight">
                                                                        <div className="text-purple-700 dark:text-purple-300">D1: <span className="font-bold">{decoded.stampLine1}</span></div>
                                                                        <div className="text-blue-700 dark:text-blue-300">D2: <span className="font-bold">{decoded.stampLine2}</span></div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[11px] text-slate-400">SKU: {decoded.sku}</div>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                                {box.quantity} {box.unit}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center text-[10px] text-slate-400 font-mono whitespace-nowrap">
                                                                {new Date(box.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        onClick={() => setSelectedBoxForDetail({ box, decoded })}
                                                                        className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors"
                                                                        title="Xem chi tiết"
                                                                    >
                                                                        <Eye size={13} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleUnlink(box.id, box.code)}
                                                                        disabled={isUnlinking === box.id}
                                                                        className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                                                        title="Gỡ thùng"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Trạng thái chưa có dữ liệu */
                        <div className="text-center py-16 px-4 space-y-4 max-w-md mx-auto">
                            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center mx-auto shadow-inner">
                                <Smartphone size={32} />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                    Chưa có dữ liệu quét OCR từ điện thoại
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    Lô này có STT là <span className="font-bold text-amber-600 dark:text-amber-400">{sttDisplay || '(chưa đặt)'}</span>.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-left space-y-2 text-xs text-slate-600 dark:text-slate-400">
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                                    📌 Hướng dẫn thao tác kết nối:
                                </div>
                                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed text-[11px]">
                                    <li>Mở ứng dụng <strong>Pallet Box Scanner</strong> trên điện thoại.</li>
                                    <li>Tại màn hình <strong>Quét Tem</strong> hoặc <strong>Dấu Đóng</strong>, nhập mã Pallet/STT là <strong className="text-amber-600 dark:text-amber-400 font-mono">{sttDisplay || 'STT của Lô này'}</strong>.</li>
                                    <li>Tiến hành quét các thùng hàng (chuẩn 30 thùng/pallet).</li>
                                    <li>Bấm <strong>Đồng bộ lên Web</strong>. Hệ thống sẽ tự động đối chiếu STT và kết nối toàn bộ dữ liệu quét vào đây!</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Footer Modal */}
                <div className="px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-850/80 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Smartphone size={13} className="text-indigo-500" />
                        <span>Đồng bộ tự động thời gian thực qua STT từ ứng dụng di động</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            {/* MODAL PHỤ: XEM CHI TIẾT TOÀN DIỆN MỘT THÙNG HÀNG */}
            {selectedBoxForDetail && (
                <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white font-mono font-black text-sm flex items-center justify-center shadow-md">
                                    #{getBoxNumber(selectedBoxForDetail.box)}
                                </span>
                                <div>
                                    <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                        Chi Tiết Toàn Diện Thùng Hàng #{getBoxNumber(selectedBoxForDetail.box)}
                                    </h4>
                                    <p className="text-[11px] font-mono text-slate-400">
                                        Mã: {selectedBoxForDetail.box.code}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedBoxForDetail(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Tên sản phẩm */}
                        <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                Tên Thành Phẩm Giải Mã Đầy Đủ
                            </span>
                            <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white mt-0.5">
                                {selectedBoxForDetail.decoded.productTitle}
                            </div>
                        </div>

                        {/* Con dấu trực quan: 2 Cột Giải Mã Khớp 100% Giao Diện Image 1 */}
                        {selectedBoxForDetail.decoded.isStamp ? (
                            <div className="space-y-3.5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    {/* Cột 1: KẾT QUẢ GIẢI MÃ DÒNG 1 */}
                                    <div className="p-4 rounded-2xl bg-slate-900/90 text-white border border-indigo-900/50 space-y-2.5 text-xs shadow-md">
                                        <div className="font-bold text-amber-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                            <span className="flex items-center gap-1.5">
                                                <Box size={14} className="text-amber-400" /> KẾT QUẢ GIẢI MÃ DÒNG 1:
                                            </span>
                                            <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {selectedBoxForDetail.decoded.l1Segments.map((seg: any, idx: number) => (
                                                <div 
                                                    key={idx}
                                                    className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
                                                >
                                                    <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}>
                                                        {seg.code}
                                                    </span>
                                                    <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.name}:</span>
                                                    <strong className={`text-xs font-bold truncate ml-auto ${seg.theme.textClass}`}>
                                                        {seg.value}
                                                    </strong>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Cột 2: KẾT QUẢ GIẢI MÃ DÒNG 2 */}
                                    <div className="p-4 rounded-2xl bg-slate-900/90 text-white border border-indigo-900/50 space-y-2.5 text-xs shadow-md">
                                        <div className="font-bold text-emerald-400 flex items-center justify-between text-[11px] uppercase tracking-wider border-b border-slate-700/60 pb-2">
                                            <span className="flex items-center gap-1.5">
                                                <Factory size={14} className="text-emerald-400" /> KẾT QUẢ GIẢI MÃ DÒNG 2:
                                            </span>
                                            <span className="text-[10px] font-normal text-slate-400 lowercase">màu tương ứng với đoạn mã</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {selectedBoxForDetail.decoded.l2Segments.map((seg: any, idx: number) => (
                                                <div 
                                                    key={idx}
                                                    className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors"
                                                >
                                                    <span className={`px-2.5 py-0.5 rounded-lg font-mono font-black text-xs border shrink-0 ${seg.theme.bgClass} ${seg.theme.textClass} ${seg.theme.borderClass}`}>
                                                        {seg.code}
                                                    </span>
                                                    <span className="text-slate-400 text-xs shrink-0 font-medium">{seg.name}:</span>
                                                    <strong className={`text-xs font-bold truncate ml-auto ${seg.theme.textClass}`}>
                                                        {seg.value}
                                                    </strong>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Thông số phụ trợ thùng hàng */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-400 font-bold block">Trọng lượng</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBoxForDetail.box.quantity} {selectedBoxForDetail.box.unit}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-400 font-bold block">STT Pallet</span>
                                        <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{selectedBoxForDetail.box.metadata?.pallet_stt || sttDisplay || '---'}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-400 font-bold block">Mã thùng gốc</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono truncate block" title={selectedBoxForDetail.box.code}>{selectedBoxForDetail.box.code}</span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-400 font-bold block">Thời gian quét máy</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                            {new Date(selectedBoxForDetail.box.created_at).toLocaleString('vi-VN')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* Toàn bộ danh mục trường dữ liệu Tem OCR */
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Trọng lượng</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBoxForDetail.box.quantity} {selectedBoxForDetail.box.unit}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">STT Pallet</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{selectedBoxForDetail.box.metadata?.pallet_stt || sttDisplay || '---'}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Quy cách & Cấp đông</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBoxForDetail.decoded.packageSpec} • {selectedBoxForDetail.decoded.freezeMethod}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Nhà máy / Cơ sở</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBoxForDetail.decoded.factory}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Ngày đóng gói</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{selectedBoxForDetail.decoded.packagingDate}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Ngày nhập nguyên liệu</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{selectedBoxForDetail.decoded.inboundDate}</span>
                                </div>
                                {selectedBoxForDetail.decoded.productionDate !== '---' && (
                                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-400 font-bold block">Ngày sản xuất (Tem OCR)</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{selectedBoxForDetail.decoded.productionDate}</span>
                                    </div>
                                )}
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Vùng nguyên liệu</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBoxForDetail.decoded.region}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Nhà cung cấp</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedBoxForDetail.decoded.supplier}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block">Thời gian quét máy</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                        {new Date(selectedBoxForDetail.box.created_at).toLocaleString('vi-VN')}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Nút hành động trong Modal chi tiết */}
                        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800">
                            {selectedBoxForDetail.decoded.isStamp && (
                                <a
                                    href={`/tra-cuu-tem?l1=${encodeURIComponent(selectedBoxForDetail.decoded.stampLine1)}&l2=${encodeURIComponent(selectedBoxForDetail.decoded.stampLine2)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                                >
                                    <ExternalLink size={13} />
                                    <span>Tra cứu trên Cổng Truy Xuất Tem</span>
                                </a>
                            )}
                            <button
                                onClick={() => handleCopyBoxCode(selectedBoxForDetail.box.code)}
                                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-all ml-auto"
                            >
                                <Copy size={13} />
                                <span>Sao chép mã thùng</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
