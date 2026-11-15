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
import { fetchDefaultBranchName } from '@/lib/branches'
import { normalizeUnit, formatUnitWeight } from '@/lib/unitConversion'
import { parseDateToISO } from '@/lib/dateUtils'
import { DEFAULT_STAMP_DICT } from '@/lib/stampDecoder'
import { ManualLinkLotModal } from './ManualLinkLotModal'
import { UnlinkedBoxesDetailModal } from './UnlinkedBoxesDetailModal'
import { EditSingleBoxModal } from './EditSingleBoxModal'
import { BulkEditBoxesModal } from './BulkEditBoxesModal'
import { EditPalletInfoModal } from './EditPalletInfoModal'
import { ApproveOrEditLotModal } from './ApproveOrEditLotModal'
import { LinkedPalletsTab } from './LinkedPalletsTab'
import { UnlinkedPalletsTab } from './UnlinkedPalletsTab'

import type {
    BoxLabelItem,
    PalletLot,
    UnlinkedPalletGroup,
    WarehouseProduct,
    ApproveLotProductLine,
} from './types'
import {
    applyStampDecodeToMeta,
    healStampBoxesInDB,
    cleanDateForDB,
    extractPackagingDate,
    extractProductionDate,
    extractRawMaterialDate,
    getAvailableUnitsForProduct,
    getProductAliases,
    STAMP_CODE_TO_SKU_MAP,
    findBestMatchingProduct,
    detectPalletProductLines,
    getBoxIndex,
    syncPalletTagToLot,
    exportPalletToExcel,
} from './palletHelpers'

export type { ApproveLotProductLine }
export { STAMP_CODE_TO_SKU_MAP }

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
    const [allActiveLots, setAllActiveLots] = useState<{
        id: string
        code: string
        daily_seq: number | null
        status?: string | null
        product_name?: string
        quantity?: number
        created_at?: string
        existingBoxesCount?: number
        existingTotalWeight?: number
    }[]>([])

    // Available Products for Quick Lot Creation & Auto-matching
    const [warehouseProducts, setWarehouseProducts] = useState<WarehouseProduct[]>([])
    const [allUnits, setAllUnits] = useState<any[]>([])
    const [allProductUnits, setAllProductUnits] = useState<any[]>([])
    const [dynamicStampMap, setDynamicStampMap] = useState<Record<string, string>>({})

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
    const [approveProductLines, setApproveProductLines] = useState<ApproveLotProductLine[]>([])
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

    // Edit Linked Lot Modal (Chỉnh sửa toàn bộ LOT đã duyệt & liên kết)
    const [editingLinkedPallet, setEditingLinkedPallet] = useState<PalletLot | null>(null)
    const [editLotSTT, setEditLotSTT] = useState('')
    const [isSavingLinkedLot, setIsSavingLinkedLot] = useState(false)

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
                    packaging_date,
                    peeling_date,
                    raw_material_date,
                    notes,
                    metadata,
                    quantity,
                    product_id,
                    products ( id, name, sku ),
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

            // 1. Linked Pallets (Lots having box_labels attached within the loaded set)
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
                if (b.metadata?.stamp_line1 || b.metadata?.stamp_line2 || b.metadata?.scan_type === 'stamp' || b.code?.startsWith('STAMP-')) {
                    b.metadata = applyStampDecodeToMeta(b.metadata)
                }
                const stt = rawStt.trim().toUpperCase()
                if (!groupMap.has(stt)) {
                    groupMap.set(stt, [])
                }
                groupMap.get(stt)!.push(b)
            })

            // 2.2 TẢI BỔ SUNG CHÍNH XÁC CÁC LOT TRONG KHO CÓ STT HOẶC MÃ KHỚP VỚI CÁC ĐỢT QUÉT (Khắc phục triệt để giới hạn 200 Lô)
            const unlinkedStts = Array.from(groupMap.keys())
            const neededSeqs = Array.from(new Set(unlinkedStts.map(s => encodeSTT(s)).filter((s): s is number => s !== null)))
            const neededCodes = Array.from(new Set(unlinkedStts))

            let allLots: any[] = [...(lotsData || [])]
            const existingLotIds = new Set(allLots.map((l: any) => l.id))

            if (neededSeqs.length > 0 || neededCodes.length > 0) {
                const extraPromises: any[] = []
                if (neededSeqs.length > 0) {
                    extraPromises.push(
                        (supabase.from('lots') as any)
                            .select(`
                                id,
                                code,
                                daily_seq,
                                status,
                                system_code,
                                company_id,
                                created_at,
                                inbound_date,
                                packaging_date,
                                peeling_date,
                                raw_material_date,
                                notes,
                                metadata,
                                quantity,
                                product_id,
                                products ( id, name, sku ),
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
                            .in('daily_seq', neededSeqs)
                    )
                }
                if (neededCodes.length > 0) {
                    extraPromises.push(
                        (supabase.from('lots') as any)
                            .select(`
                                id,
                                code,
                                daily_seq,
                                status,
                                system_code,
                                company_id,
                                created_at,
                                inbound_date,
                                packaging_date,
                                peeling_date,
                                raw_material_date,
                                notes,
                                metadata,
                                quantity,
                                product_id,
                                products ( id, name, sku ),
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
                            .in('code', neededCodes)
                    )
                }

                try {
                    const extraRes = await Promise.all(extraPromises)
                    extraRes.forEach((r: any) => {
                        if (r.data) {
                            r.data.forEach((l: any) => {
                                if (!existingLotIds.has(l.id)) {
                                    existingLotIds.add(l.id)
                                    allLots.push(l)
                                }
                            })
                        }
                    })
                } catch (extraErr) {
                    console.warn('Lỗi tải bổ sung LOT theo STT đợt quét:', extraErr)
                }
            }

            // 2.3 Lưu danh sách LOT hoàn chỉnh cho việc Ghép & Khớp thông minh
            const activeLotsList = allLots.map((l: any) => {
                const existingBoxes = Array.isArray(l.box_labels) ? l.box_labels : []
                const existingWeight = existingBoxes.reduce((sum: number, b: any) => sum + (Number(b.quantity) || 0), 0)
                return {
                    id: l.id,
                    code: l.code,
                    daily_seq: l.daily_seq,
                    status: l.status,
                    quantity: Number(l.quantity) || 0,
                    created_at: l.created_at,
                    product_name: l.products?.name || '',
                    existingBoxesCount: existingBoxes.length,
                    existingTotalWeight: existingWeight
                }
            })
            setAllActiveLots(activeLotsList)

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

                // Nhận diện trùng STT (Trường hợp 3: LOT ĐÃ CÓ TRONG KHO):
                // - Đã có Lô trên Web mang cùng STT/Mã
                // - Lô đó còn trong kho (status !== 'exported')
                // - Lô đó ĐÃ CÓ THÙNG gắn vào (existingBoxesCount > 0) HOẶC ĐÃ CÓ SỐ LƯỢNG TỒN trong kho (quantity > 0)
                const isConflict = !!(
                    matched &&
                    matched.status !== 'exported' &&
                    ((matched.existingBoxesCount || 0) > 0 || (matched.quantity || 0) > 0)
                )

                const palletTag = boxes.map(b => b.metadata?.pallet_tag || b.metadata?.tag).find(Boolean) || null
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

                // 5. Tải trực tiếp bảng quy chuẩn con dấu (stamp_dictionaries) danh mục special_12
                try {
                    const { data: stampRulesData } = await (supabase.from('stamp_dictionaries') as any)
                        .select('code, product_sku')
                        .eq('category', 'special_12')
                        .eq('is_active', true)

                    if (stampRulesData) {
                        const liveMap: Record<string, string> = {}
                        stampRulesData.forEach((r: any) => {
                            if (r.code && r.product_sku) {
                                liveMap[r.code.trim()] = r.product_sku.trim()
                            }
                        })
                        setDynamicStampMap(liveMap)
                    }
                } catch (dictErr) {
                    console.warn('Lỗi tải quy tắc con dấu từ stamp_dictionaries:', dictErr)
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
            const tagFromGroup = group.pallet_tag || group.boxes.map(b => b.metadata?.pallet_tag || b.metadata?.tag).find(Boolean)
            await syncPalletTagToLot(targetLot.id, tagFromGroup)

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
            const tagFromGroup = group.pallet_tag || group.boxes.map(b => b.metadata?.pallet_tag || b.metadata?.tag).find(Boolean)
            await syncPalletTagToLot(targetLot.id, tagFromGroup)

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
                    const tagFromGroup = group.pallet_tag || group.boxes.map(b => b.metadata?.pallet_tag || b.metadata?.tag).find(Boolean)
                    await syncPalletTagToLot(targetLot.id, tagFromGroup)

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
        // Luôn làm tươi (refresh) toàn bộ metadata thùng theo con dấu trước khi duyệt
        const refreshedBoxes = group.boxes.map(b => {
            if (b.metadata?.stamp_line1 || b.metadata?.stamp_line2 || b.metadata?.scan_type === 'stamp' || b.code?.startsWith('STAMP-')) {
                return {
                    ...b,
                    metadata: applyStampDecodeToMeta(b.metadata || {})
                }
            }
            return b
        })
        const refreshedGroup = { ...group, boxes: refreshedBoxes }
        setApproveGroup(refreshedGroup)
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

        // 2. Khớp thông minh Sản Phẩm từ con dấu / tem quét (Hỗ trợ tự động phân loại Pallet hỗn hợp nhiều sản phẩm)
        const detectedLines = detectPalletProductLines(refreshedBoxes, warehouseProducts, dynamicStampMap, allProductUnits, allUnits)
        setApproveProductLines(detectedLines)

        const targetProd = detectedLines[0]?.product || warehouseProducts[0] || null
        setSelectedProductId(targetProd?.id ?? null)
        const primaryMatch = findBestMatchingProduct(refreshedBoxes, warehouseProducts, dynamicStampMap)
        setMatchInfo({ score: primaryMatch.matchScore, reason: primaryMatch.matchReason })

        // 3. Kế thừa mã phụ (Tag)
        setCustomLotTag(group.pallet_tag || group.boxes.map(b => b.metadata?.pallet_tag || b.metadata?.tag).find(Boolean) || '')

        // 4. Kế thừa số lượng thùng (đơn vị: Thùng) & tổng khối lượng (Kg)
        const totalQty = detectedLines.reduce((acc, l) => acc + (Number(l.quantity) || 0), 0)
        const totalW = detectedLines.reduce((acc, l) => acc + (Number(l.weight) || 0), 0)
        setCustomQuantity(totalQty || group.boxes.length)
        setCustomWeight(totalW || group.total_weight)

        // Khớp đơn vị tính chuẩn kèm hậu tố trọng lượng (vd: Thùng (20kg), Kg)
        const defaultUnit = detectedLines[0]?.unit || 'Thùng (20kg)'
        setCustomUnit(defaultUnit)

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

    const handleUpdateProductLine = (lineId: string, updates: Partial<ApproveLotProductLine>) => {
        setApproveProductLines(prev => prev.map(line => {
            if (line.id !== lineId) return line
            const updated = { ...line, ...updates }
            if (updates.product_id && updates.product_id !== line.product_id) {
                const newProd = warehouseProducts.find(p => p.id === updates.product_id) || null
                updated.product = newProd
                const currentWeightPerBox = line.quantity > 0 ? (line.weight / line.quantity) : 20
                const newUnits = getAvailableUnitsForProduct(newProd, allProductUnits, allUnits, currentWeightPerBox)
                const thungOpt = newUnits.find(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))
                updated.unit = thungOpt || newUnits[0] || 'Thùng (20kg)'
            }
            return updated
        }))
    }

    const handleAddProductLine = () => {
        const defaultProd = warehouseProducts[0] || null
        const availUnits = getAvailableUnitsForProduct(defaultProd, allProductUnits, allUnits, 20)
        const thungUnit = availUnits.find(u => normalizeUnit(u).includes('thung') || normalizeUnit(u).includes('thùng'))
        const newLine: ApproveLotProductLine = {
            id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            product_id: defaultProd ? defaultProd.id : '',
            product: defaultProd,
            quantity: 0,
            weight: 0,
            unit: thungUnit || availUnits[0] || 'Thùng (20kg)',
            box_ids: [],
            matchReason: 'Thêm thủ công'
        }
        setApproveProductLines(prev => [...prev, newLine])
    }

    const handleRemoveProductLine = (lineId: string) => {
        if (approveProductLines.length <= 1) {
            showToast('LOT bắt buộc phải có ít nhất 1 dòng sản phẩm', 'warning')
            return
        }
        setApproveProductLines(prev => prev.filter(l => l.id !== lineId))
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
        if (!approveProductLines || approveProductLines.length === 0 || !approveProductLines.some(l => l.product_id)) {
            showToast('Vui lòng chọn ít nhất 1 Sản phẩm cho LOT hàng!', 'warning')
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

            const primaryLine = approveProductLines.find(l => l.product_id) || approveProductLines[0]
            const primaryProductId = primaryLine.product_id
            const totalLotQuantity = approveProductLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0) || group.boxes.length
            const totalLotWeight = approveProductLines.reduce((sum, l) => sum + (Number(l.weight) || 0), 0) || group.total_weight

            const cleanInbound = cleanDateForDB(customInboundDate)
            const cleanRawDates = customRawMaterialDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]
            const cleanPackagingDates = customPackagingDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]
            const cleanPeelingDates = customPeelingDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]

            const cleanPack = cleanPackagingDates.length > 0 ? cleanPackagingDates[cleanPackagingDates.length - 1] : cleanDateForDB(customPackagingDate)
            const cleanRaw = cleanRawDates.length > 0 ? cleanRawDates[0] : cleanDateForDB(customRawMaterialDate)
            const cleanPeeling = cleanPeelingDates.length > 0 ? cleanPeelingDates[0] : cleanDateForDB(customPeelingDate)

            // LOT bắt buộc mang chi nhánh: dùng chi nhánh mặc định của công ty (khai báo tại Cài đặt → Chi nhánh)
            const defaultBranchName = await fetchDefaultBranchName(supabase, currentSystem.company_id || profile?.company_id)

            // 1. Tạo mới bản ghi Lô (lots)
            const lotPayload: any = {
                code: finalLotCode,
                system_code: currentSystem.code,
                warehouse_name: defaultBranchName || null,
                company_id: profile?.company_id || null,
                product_id: primaryProductId,
                daily_seq: dailySeqVal,
                quantity: totalLotQuantity,
                status: 'active',
                inbound_date: cleanInbound || null,
                packaging_date: cleanPack || null,
                raw_material_date: cleanRaw || null,
                peeling_date: cleanPeeling || null,
                notes: customNotes.trim() || null,
                metadata: {
                    created_from_pallet_stt: group.pallet_stt,
                    pallet_tag: customLotTag.trim() || null,
                    tag: customLotTag.trim() || null,
                    unit: primaryLine.unit || 'Thùng',
                    total_weight_kg: totalLotWeight,
                    box_count: group.boxes.length,
                    product_lines: approveProductLines.map(l => ({
                        product_id: l.product_id,
                        sku: l.product?.sku || warehouseProducts.find(p => p.id === l.product_id)?.sku,
                        name: l.product?.name || warehouseProducts.find(p => p.id === l.product_id)?.name,
                        quantity: Number(l.quantity) || 0,
                        weight: Number(l.weight) || 0,
                        unit: l.unit
                    })),
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

            // 2. Tạo các bản ghi chi tiết từng dòng sản phẩm Lô (lot_items)
            const itemPayloads = approveProductLines.map(line => {
                const itemPayload: any = {
                    lot_id: newLotId,
                    product_id: line.product_id,
                    quantity: Number(line.quantity) || 0,
                    initial_quantity: Number(line.quantity) || 0,
                    unit: line.unit || 'Thùng'
                }
                if (profile?.company_id) {
                    itemPayload.company_id = profile.company_id
                }
                return itemPayload
            })

            const { data: insertedItems, error: itemErr } = await (supabase
                .from('lot_items') as any)
                .insert(itemPayloads)
                .select('id, product_id')

            if (itemErr) {
                console.warn('Cảnh báo thêm lot_items:', itemErr.message || itemErr)
            }

            // 3. Ghi mã phụ vào lot_tags nếu có
            if (customLotTag && customLotTag.trim()) {
                const cleanTag = customLotTag.trim().toUpperCase()
                try {
                    let itemsToTag = (insertedItems && insertedItems.length > 0) ? insertedItems : []
                    if (itemsToTag.length === 0) {
                        const { data: refetchedItems } = await supabase
                            .from('lot_items')
                            .select('id, product_id')
                            .eq('lot_id', newLotId)
                        itemsToTag = refetchedItems || []
                    }

                    const tagInserts: any[] = []
                    if (itemsToTag.length > 0) {
                        itemsToTag.forEach((it: any) => {
                            tagInserts.push({
                                lot_id: newLotId,
                                lot_item_id: it.id,
                                tag: cleanTag,
                                added_at: new Date().toISOString()
                            })
                        })
                    } else {
                        // Nếu chưa có item con nào, mới gắn tag vào cấp lot (unassigned)
                        tagInserts.push({
                            lot_id: newLotId,
                            lot_item_id: null,
                            tag: cleanTag,
                            added_at: new Date().toISOString()
                        })
                    }

                    // TUYỆT ĐỐI KHÔNG truyền company_id vào lot_tags (vì bảng lot_tags không có cột này)
                    const { error: tagErr } = await (supabase.from('lot_tags') as any).insert(tagInserts)
                    if (tagErr) {
                        console.warn('Cảnh báo ghi lot_tags:', tagErr.message || tagErr)
                    }
                } catch (tErr) {
                    console.warn('Lỗi ghi lot_tags:', tErr)
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

            // 4. Ghép toàn bộ thùng của Pallet vào LOT mới và gắn đúng từng mã sản phẩm tương ứng
            const assignedBoxIds = new Set<string>()
            for (const line of approveProductLines) {
                if (line.box_ids && line.box_ids.length > 0) {
                    line.box_ids.forEach(id => assignedBoxIds.add(id))
                    const { error: lineBoxErr } = await (supabase
                        .from('box_labels') as any)
                        .update({
                            lot_id: newLotId,
                            product_id: line.product_id,
                            status: 'linked'
                        })
                        .in('id', line.box_ids)

                    if (lineBoxErr) {
                        console.warn(`Lỗi cập nhật box_labels cho dòng sản phẩm ${line.product_id}:`, lineBoxErr)
                    }
                }
            }

            // Bất kỳ thùng nào chưa được gán theo dòng sẽ được liên kết với sản phẩm chính
            const unassignedBoxIds = group.boxes.map(b => b.id).filter(id => !assignedBoxIds.has(id))
            if (unassignedBoxIds.length > 0) {
                const { error: boxErr } = await (supabase
                    .from('box_labels') as any)
                    .update({
                        lot_id: newLotId,
                        product_id: primaryProductId,
                        status: 'linked'
                    })
                    .in('id', unassignedBoxIds)

                if (boxErr) {
                    throw new Error(boxErr.message || boxErr.details || 'Lỗi cập nhật liên kết box_labels')
                }
            }

            // 5. Đồng bộ ngày tháng thùng vào LOT
            try {
                await syncDatesFromBoxesToLot(newLotId, group.boxes)
            } catch (syncErr: any) {
                console.warn('Cảnh báo đồng bộ ngày tháng từ thùng vào LOT:', syncErr?.message || syncErr)
            }

            const successMsg = approveProductLines.length > 1
                ? `🎉 Đã duyệt tạo thành công LOT "${finalLotCode}" (Pallet STT ${group.pallet_stt}) với ${approveProductLines.length} dòng sản phẩm (${group.boxes.length} thùng)!`
                : `🎉 Đã duyệt tạo thành công LOT "${finalLotCode}" cho Pallet STT ${group.pallet_stt} và kết nối ${group.boxes.length} thùng!`

            showToast(successMsg, 'success')
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
    // ACTIONS: EDIT ALL INFO OF LINKED LOT (Sửa toàn bộ thông tin LOT đã liên kết)
    // ─────────────────────────────────────────────────────────────
    const handleOpenEditLinkedLot = (pallet: PalletLot) => {
        setEditingLinkedPallet(pallet)
        setApproveGroup(null)

        // 1. Mã LOT & STT
        setProposedLotCode(pallet.code)
        const currentSTT = pallet.daily_seq ? decodeSTT(pallet.daily_seq) : (pallet.metadata?.created_from_pallet_stt || pallet.code)
        setEditLotSTT(currentSTT)

        // 2. Mã phụ (Tag)
        setCustomLotTag(pallet.metadata?.pallet_tag || pallet.metadata?.tag || '')

        // 3. Ngày tháng
        setCustomInboundDate(pallet.inbound_date ? pallet.inbound_date.split('T')[0] : '')

        const packDates = pallet.metadata?.packaging_dates || (pallet.packaging_date ? [pallet.packaging_date.split('T')[0]] : [])
        const cleanPList = Array.isArray(packDates) ? packDates : []
        setCustomPackagingDates(cleanPList)
        setCustomPackagingDate(cleanPList[cleanPList.length - 1] || '')
        setNewPackagingDateInput('')

        const peelDates = pallet.metadata?.peeling_dates || (pallet.peeling_date ? [pallet.peeling_date.split('T')[0]] : [])
        const cleanPeelList = Array.isArray(peelDates) ? peelDates : []
        setCustomPeelingDates(cleanPeelList)
        setCustomPeelingDate(cleanPeelList[0] || '')
        setNewPeelingDateInput('')

        const rawDates = pallet.metadata?.raw_material_dates || (pallet.raw_material_date ? [pallet.raw_material_date.split('T')[0]] : [])
        const cleanRawList = Array.isArray(rawDates) ? rawDates : []
        setCustomRawMaterialDates(cleanRawList)
        setCustomRawMaterialDate(cleanRawList[0] || '')
        setNewRawMaterialDateInput('')

        // 4. Nơi sản xuất & Vùng nguyên liệu
        const prodPlace = pallet.metadata?.production_place || pallet.metadata?.factory || pallet.box_labels[0]?.metadata?.shift_group || ''
        setCustomProductionPlace(prodPlace)
        const matZone = pallet.metadata?.material_zone || pallet.metadata?.region || pallet.box_labels[0]?.metadata?.region || ''
        setCustomMaterialZone(matZone)

        // 5. Ghi chú
        setCustomNotes(pallet.notes || pallet.metadata?.notes || '')

        // 6. Danh sách sản phẩm của LOT
        if (Array.isArray(pallet.metadata?.product_lines) && pallet.metadata.product_lines.length > 0) {
            const mappedLines: ApproveLotProductLine[] = pallet.metadata.product_lines.map((pl: any, idx: number) => {
                const prod = warehouseProducts.find(p => p.id === pl.product_id || p.sku === pl.sku) || null
                return {
                    id: `line-${idx}-${Date.now()}`,
                    product_id: pl.product_id || prod?.id || '',
                    product: prod,
                    quantity: Number(pl.quantity) || 0,
                    weight: Number(pl.weight) || 0,
                    unit: pl.unit || 'Thùng (20kg)',
                    stamp_code: pl.stamp_code || '',
                    box_ids: pl.box_ids || [],
                    matchReason: 'Kế thừa từ cấu hình LOT'
                }
            })
            setApproveProductLines(mappedLines)
        } else if (pallet.box_labels.length > 0) {
            const detected = detectPalletProductLines(pallet.box_labels, warehouseProducts, dynamicStampMap, allProductUnits, allUnits)
            if (detected.length > 0) {
                setApproveProductLines(detected)
            } else {
                const primaryProd = warehouseProducts.find(p => p.id === pallet.product_id) || (pallet.products ? warehouseProducts.find(p => p.sku === pallet.products?.sku) : warehouseProducts[0])
                const totalWeight = pallet.box_labels.reduce((s, b) => s + (Number(b.quantity) || 0), 0)
                setApproveProductLines([{
                    id: `line-0-${Date.now()}`,
                    product_id: primaryProd?.id || '',
                    product: primaryProd || null,
                    quantity: pallet.box_labels.length,
                    weight: totalWeight,
                    unit: pallet.box_labels[0]?.unit || 'Thùng (20kg)',
                    box_ids: pallet.box_labels.map(b => b.id),
                    matchReason: 'Kế thừa từ LOT hiện tại'
                }])
            }
        } else {
            const primaryProd = warehouseProducts.find(p => p.id === pallet.product_id) || warehouseProducts[0]
            setApproveProductLines([{
                id: `line-0-${Date.now()}`,
                product_id: primaryProd?.id || '',
                product: primaryProd || null,
                quantity: pallet.quantity || 30,
                weight: (pallet.quantity || 30) * 20,
                unit: 'Thùng (20kg)',
                box_ids: [],
                matchReason: 'Kế thừa từ LOT'
            }])
        }
    }

    const handleSaveEditLinkedLot = async () => {
        if (!editingLinkedPallet) return
        if (!proposedLotCode.trim()) {
            showToast('Mã LOT không được để trống', 'warning')
            return
        }
        if (approveProductLines.length === 0) {
            showToast('LOT phải có ít nhất 1 dòng sản phẩm', 'warning')
            return
        }
        const hasInvalidLine = approveProductLines.some(l => !l.product_id)
        if (hasInvalidLine) {
            showToast('Vui lòng chọn đầy đủ sản phẩm cho tất cả các dòng', 'warning')
            return
        }

        setIsSavingLinkedLot(true)
        try {
            const finalLotCode = proposedLotCode.trim().toUpperCase()
            const primaryLine = approveProductLines[0]
            const primaryProductId = primaryLine.product_id
            const totalLotBoxes = approveProductLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0)
            const totalLotWeight = approveProductLines.reduce((sum, l) => sum + (Number(l.weight) || 0), 0)

            const cleanInbound = customInboundDate ? cleanDateForDB(customInboundDate) : null
            const cleanPackagingDates = customPackagingDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]
            const cleanPack = cleanPackagingDates.length > 0 ? cleanPackagingDates[cleanPackagingDates.length - 1] : null
            const cleanRawDates = customRawMaterialDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]
            const cleanRaw = cleanRawDates.length > 0 ? cleanRawDates[0] : null
            const cleanPeelingDates = customPeelingDates.map(d => cleanDateForDB(d)).filter(Boolean) as string[]
            const cleanPeeling = cleanPeelingDates.length > 0 ? cleanPeelingDates[0] : null

            const encodedSeq = encodeSTT(editLotSTT)

            // 1. Cập nhật bảng lots
            const updatedMetadata: any = {
                ...(editingLinkedPallet.metadata || {}),
                created_from_pallet_stt: editLotSTT.trim().toUpperCase(),
                pallet_tag: customLotTag.trim() || null,
                tag: customLotTag.trim() || null,
                unit: primaryLine.unit || 'Thùng',
                total_weight_kg: totalLotWeight,
                box_count: totalLotBoxes,
                product_lines: approveProductLines.map(l => ({
                    product_id: l.product_id,
                    sku: l.product?.sku || warehouseProducts.find(p => p.id === l.product_id)?.sku,
                    name: l.product?.name || warehouseProducts.find(p => p.id === l.product_id)?.name,
                    quantity: Number(l.quantity) || 0,
                    weight: Number(l.weight) || 0,
                    unit: l.unit
                })),
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

            const { error: lotUpdateErr } = await (supabase.from('lots') as any)
                .update({
                    code: finalLotCode,
                    daily_seq: encodedSeq !== null ? encodedSeq : editingLinkedPallet.daily_seq,
                    product_id: primaryProductId,
                    quantity: totalLotBoxes,
                    inbound_date: cleanInbound,
                    packaging_date: cleanPack,
                    raw_material_date: cleanRaw,
                    peeling_date: cleanPeeling,
                    notes: customNotes.trim() || null,
                    metadata: updatedMetadata
                })
                .eq('id', editingLinkedPallet.id)

            if (lotUpdateErr) throw lotUpdateErr

            // 2. Cập nhật lại lot_items
            let insertedLotItems: any[] = []
            try {
                await (supabase.from('lot_items') as any).delete().eq('lot_id', editingLinkedPallet.id)

                const itemPayloads = approveProductLines.map(line => {
                    const itemPayload: any = {
                        lot_id: editingLinkedPallet.id,
                        product_id: line.product_id,
                        quantity: Number(line.quantity) || 0,
                        initial_quantity: Number(line.quantity) || 0,
                        unit: line.unit || 'Thùng'
                    }
                    if (profile?.company_id) {
                        itemPayload.company_id = profile.company_id
                    }
                    return itemPayload
                })
                const { data: newItems, error: itemErr } = await (supabase.from('lot_items') as any)
                    .insert(itemPayloads)
                    .select('id')
                if (newItems) insertedLotItems = newItems
                if (itemErr) console.warn('Cảnh báo cập nhật lot_items:', itemErr)
            } catch (itemErr) {
                console.warn('Cảnh báo cập nhật lot_items:', itemErr)
            }

            // 3. Cập nhật lot_tags nếu có
            await syncPalletTagToLot(editingLinkedPallet.id, customLotTag, insertedLotItems)

            // 4. Đồng bộ lại toàn bộ thùng hàng thuộc LOT này trong box_labels
            if (editingLinkedPallet.box_labels.length > 0) {
                const boxIds = editingLinkedPallet.box_labels.map(b => b.id)
                const { error: boxUpdateErr } = await (supabase.from('box_labels') as any)
                    .update({
                        product_id: primaryProductId,
                        finished_lot_code: finalLotCode,
                        semi_finished_lot_code: finalLotCode
                    })
                    .in('id', boxIds)

                if (boxUpdateErr) console.warn('Cảnh báo cập nhật box_labels product_id:', boxUpdateErr)

                for (const b of editingLinkedPallet.box_labels) {
                    const bMeta = { ...(b.metadata || {}) }
                    if (customProductionPlace.trim()) {
                        bMeta.shift_group = customProductionPlace.trim()
                        bMeta.production_place = customProductionPlace.trim()
                        bMeta.factory = customProductionPlace.trim()
                    }
                    if (customMaterialZone.trim()) {
                        bMeta.region = customMaterialZone.trim()
                        bMeta.province = customMaterialZone.trim()
                        bMeta.material_zone = customMaterialZone.trim()
                        bMeta.material_zones = [customMaterialZone.trim()]
                    }
                    if (editLotSTT.trim()) {
                        bMeta.pallet_stt = editLotSTT.trim().toUpperCase()
                    }
                    if (customLotTag.trim()) {
                        bMeta.pallet_tag = customLotTag.trim().toUpperCase()
                        bMeta.tag = customLotTag.trim().toUpperCase()
                    }
                    await (supabase.from('box_labels') as any)
                        .update({ metadata: bMeta })
                        .eq('id', b.id)
                }
            }

            // 5. Đồng bộ ngày tháng từ thùng vào LOT nếu cần
            try {
                await syncDatesFromBoxesToLot(editingLinkedPallet.id, editingLinkedPallet.box_labels)
            } catch (syncErr) {
                console.warn('Lỗi đồng bộ ngày tháng:', syncErr)
            }

            showToast(`🎉 Đã cập nhật thành công toàn bộ thông tin LOT "${finalLotCode}" (Pallet STT ${editLotSTT.trim().toUpperCase()})!`, 'success')
            setEditingLinkedPallet(null)
            fetchData()
        } catch (err: any) {
            console.error('Lỗi lưu cập nhật LOT đã liên kết:', err)
            showToast('Lỗi khi cập nhật LOT: ' + (err.message || 'Lỗi mạng'), 'error')
        } finally {
            setIsSavingLinkedLot(false)
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
            await exportPalletToExcel(pallet)
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
                <LinkedPalletsTab
                    isLoading={isLoading}
                    filteredLinkedPallets={filteredLinkedPallets}
                    selectedPallet={selectedPallet}
                    setSelectedPallet={setSelectedPallet}
                    showMobileDetail={showMobileDetail}
                    setShowMobileDetail={setShowMobileDetail}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    boxSearchQuery={boxSearchQuery}
                    setBoxSearchQuery={setBoxSearchQuery}
                    filteredBoxes={filteredBoxes}
                    isExporting={isExporting}
                    isUnlinkingId={isUnlinkingId}
                    handleOpenEditLinkedLot={handleOpenEditLinkedLot}
                    handleExportExcel={handleExportExcel}
                    handleUnlinkEntirePallet={handleUnlinkEntirePallet}
                    handleOpenEditBox={handleOpenEditBox}
                    handleUnlinkBox={handleUnlinkBox}
                />
            ) : (
                <UnlinkedPalletsTab
                    isLoading={isLoading}
                    unlinkedGroups={unlinkedGroups}
                    filteredUnlinkedGroups={filteredUnlinkedGroups}
                    paginatedUnlinkedGroups={paginatedUnlinkedGroups}
                    isAutoLinking={isAutoLinking}
                    isLinking={isLinking}
                    unlinkedDateFilter={unlinkedDateFilter}
                    setUnlinkedDateFilter={setUnlinkedDateFilter}
                    unlinkedPage={unlinkedPage}
                    setUnlinkedPage={setUnlinkedPage}
                    unlinkedPageSize={unlinkedPageSize}
                    setUnlinkedPageSize={setUnlinkedPageSize}
                    totalUnlinkedPages={totalUnlinkedPages}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    unlinkedViewMode={unlinkedViewMode}
                    setUnlinkedViewMode={setUnlinkedViewMode}
                    handleAutoLinkAll={handleAutoLinkAll}
                    handleUpdateConflictLot={handleUpdateConflictLot}
                    handleOpenApproveModal={handleOpenApproveModal}
                    handleLinkGroupToLot={handleLinkGroupToLot}
                    handleDeleteUnlinkedGroup={handleDeleteUnlinkedGroup}
                    onPreviewGroup={(group) => {
                        setSelectedBoxIds(new Set())
                        setPreviewGroup(group)
                    }}
                    onOpenManualLink={(group) => {
                        setGroupToLink(group)
                        setLinkLotSearch('')
                        setSelectedLotForLink(group.matchedLot?.id || null)
                    }}
                />
            )}

            <ManualLinkLotModal
                groupToLink={groupToLink}
                setGroupToLink={setGroupToLink}
                linkLotSearch={linkLotSearch}
                setLinkLotSearch={setLinkLotSearch}
                selectedLotForLink={selectedLotForLink}
                setSelectedLotForLink={setSelectedLotForLink}
                filteredLotsForModal={filteredLotsForModal}
                isLinking={isLinking}
                handleLinkGroupToLot={handleLinkGroupToLot}
            />

            <UnlinkedBoxesDetailModal
                previewGroup={previewGroup}
                setPreviewGroup={setPreviewGroup}
                selectedBoxIds={selectedBoxIds}
                setSelectedBoxIds={setSelectedBoxIds}
                handleOpenEditPalletInfo={handleOpenEditPalletInfo}
                handleOpenBulkEdit={handleOpenBulkEdit}
                handleOpenEditBox={handleOpenEditBox}
                handleDeleteSingleBox={handleDeleteSingleBox}
            />

            <EditSingleBoxModal
                editingBox={editingBox}
                setEditingBox={setEditingBox}
                previewGroup={previewGroup}
                editBoxCode={editBoxCode}
                setEditBoxCode={setEditBoxCode}
                editStampLine1={editStampLine1}
                setEditStampLine1={setEditStampLine1}
                editStampLine2={editStampLine2}
                setEditStampLine2={setEditStampLine2}
                editLotCode={editLotCode}
                setEditLotCode={setEditLotCode}
                editWeight={editWeight}
                setEditWeight={setEditWeight}
                editSpec={editSpec}
                setEditSpec={setEditSpec}
                editShiftGroup={editShiftGroup}
                setEditShiftGroup={setEditShiftGroup}
                editProductionDate={editProductionDate}
                setEditProductionDate={setEditProductionDate}
                editPackagingDate={editPackagingDate}
                setEditPackagingDate={setEditPackagingDate}
                editApplyToAllInPallet={editApplyToAllInPallet}
                setEditApplyToAllInPallet={setEditApplyToAllInPallet}
                isSavingEdit={isSavingEdit}
                handleSaveBoxEdit={handleSaveBoxEdit}
            />

            <BulkEditBoxesModal
                isBulkEditOpen={isBulkEditOpen}
                setIsBulkEditOpen={setIsBulkEditOpen}
                previewGroup={previewGroup}
                selectedBoxIds={selectedBoxIds}
                bulkScope={bulkScope}
                setBulkScope={setBulkScope}
                bulkStampLine1={bulkStampLine1}
                setBulkStampLine1={setBulkStampLine1}
                bulkStampLine2={bulkStampLine2}
                setBulkStampLine2={setBulkStampLine2}
                bulkLotCode={bulkLotCode}
                setBulkLotCode={setBulkLotCode}
                bulkWeight={bulkWeight}
                setBulkWeight={setBulkWeight}
                bulkSpec={bulkSpec}
                setBulkSpec={setBulkSpec}
                bulkShiftGroup={bulkShiftGroup}
                setBulkShiftGroup={setBulkShiftGroup}
                bulkProductionDate={bulkProductionDate}
                setBulkProductionDate={setBulkProductionDate}
                bulkPackagingDate={bulkPackagingDate}
                setBulkPackagingDate={setBulkPackagingDate}
                bulkRegenerateCode={bulkRegenerateCode}
                setBulkRegenerateCode={setBulkRegenerateCode}
                isSavingBulkEdit={isSavingBulkEdit}
                handleSaveBulkEdit={handleSaveBulkEdit}
                showToast={showToast}
            />

            <EditPalletInfoModal
                editingPalletInfoGroup={editingPalletInfoGroup}
                setEditingPalletInfoGroup={setEditingPalletInfoGroup}
                editPalletSTT={editPalletSTT}
                setEditPalletSTT={setEditPalletSTT}
                editPalletTag={editPalletTag}
                setEditPalletTag={setEditPalletTag}
                editPalletNotes={editPalletNotes}
                setEditPalletNotes={setEditPalletNotes}
                isSavingPalletInfo={isSavingPalletInfo}
                handleSavePalletInfo={handleSavePalletInfo}
            />

            <ApproveOrEditLotModal
                approveGroup={approveGroup}
                setApproveGroup={setApproveGroup}
                editingLinkedPallet={editingLinkedPallet}
                setEditingLinkedPallet={setEditingLinkedPallet}
                editLotSTT={editLotSTT}
                setEditLotSTT={setEditLotSTT}
                proposedLotCode={proposedLotCode}
                setProposedLotCode={setProposedLotCode}
                customLotTag={customLotTag}
                setCustomLotTag={setCustomLotTag}
                approveProductLines={approveProductLines}
                warehouseProducts={warehouseProducts}
                productOptions={productOptions}
                allUnits={allUnits}
                allProductUnits={allProductUnits}
                isStampModal={isStampModal}
                isGeneratingCode={isGeneratingCode}
                isApproving={isApproving}
                isSavingLinkedLot={isSavingLinkedLot}
                customInboundDate={customInboundDate}
                setCustomInboundDate={setCustomInboundDate}
                customPackagingDates={customPackagingDates}
                newPackagingDateInput={newPackagingDateInput}
                setNewPackagingDateInput={setNewPackagingDateInput}
                customPeelingDates={customPeelingDates}
                newPeelingDateInput={newPeelingDateInput}
                setNewPeelingDateInput={setNewPeelingDateInput}
                customRawMaterialDates={customRawMaterialDates}
                newRawMaterialDateInput={newRawMaterialDateInput}
                setNewRawMaterialDateInput={setNewRawMaterialDateInput}
                customProductionPlace={customProductionPlace}
                setCustomProductionPlace={setCustomProductionPlace}
                customMaterialZone={customMaterialZone}
                setCustomMaterialZone={setCustomMaterialZone}
                customNotes={customNotes}
                setCustomNotes={setCustomNotes}
                handleRegenerateLotCode={handleRegenerateLotCode}
                handleAddProductLine={handleAddProductLine}
                handleRemoveProductLine={handleRemoveProductLine}
                handleUpdateProductLine={handleUpdateProductLine}
                handleAddPackagingDate={handleAddPackagingDate}
                handleRemovePackagingDate={handleRemovePackagingDate}
                handleAddPeelingDate={handleAddPeelingDate}
                handleRemovePeelingDate={handleRemovePeelingDate}
                handleAddRawDate={handleAddRawDate}
                handleRemoveRawDate={handleRemoveRawDate}
                handleSaveEditLinkedLot={handleSaveEditLinkedLot}
                handleConfirmCreateLot={handleConfirmCreateLot}
            />
        </div>
    )
}
