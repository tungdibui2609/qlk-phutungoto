'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
    X,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Eye,
    RefreshCw,
    FileText,
    ArrowRight,
    Check,
    Loader2,
    Calendar,
    User,
    Layers,
    Filter,
    Search,
    Package,
    TrendingDown,
    TrendingUp,
    BarChart3,
    Download,
    Copy
} from 'lucide-react'
import { renderMovementReportToBlob, ExportActionTag } from './exportMovementImage'
import {
    WarehouseProposal,
    ProposalItem,
    getWarehouseProposals,
    approveWarehouseProposal,
    rejectWarehouseProposal
} from '@/lib/warehouseAdjustmentService'
import { SupabaseClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { matchSearch, calculateSearchScore, normalizeSearchString } from '@/lib/searchUtils'

interface WarehouseAdjustmentReviewModalProps {
    isOpen: boolean
    onClose: () => void
    supabase: SupabaseClient
    systemCode: string
    currentUserName?: string
    currentUserId?: string
    onFocusPosition?: (positionId: string, positionCode?: string) => void
    onProposalApproved?: () => void
    onStartVisualReview?: (proposal: WarehouseProposal, startIndex?: number) => void
    variant?: 'modal' | 'page'
}

interface CatalogProduct {
    id: string
    name: string
    sku: string | null
    aliases: string | null
    internal_code: string | null
    internal_name: string | null
    unit: string | null
}

type MovementKind =
    | 'CLEAR'
    | 'CREATE_LOT'
    | 'ADD_TO_LOT'
    | 'INCREASE'
    | 'DECREASE'
    | 'UNCHANGED'
    | 'MOVE'
    | 'ASSIGN_LOT'
    | 'NOTE'

interface ProductMovementEntry {
    key: string
    proposal: WarehouseProposal
    item: ProposalItem
    itemIndex: number
    timestamp: string
    productName: string
    sku: string | null
    aliases: string | null
    internalCode: string | null
    internalName: string | null
    unit: string
    beforeQty: number | null
    afterQty: number | null
    delta: number
    changeKind: MovementKind
    isApproved: boolean
}

function getTodayDateStr(): string {
    return format(new Date(), 'yyyy-MM-dd')
}

function getProposalDateStr(proposal: WarehouseProposal): string {
    const ts = proposal.approved_at || proposal.created_at
    if (!ts) return ''
    try {
        return format(new Date(ts), 'yyyy-MM-dd')
    } catch {
        return ''
    }
}

function normalizeUnitLabel(unit?: string | null): string {
    const raw = (unit || 'Thùng').trim()
    if (!raw) return 'Thùng'
    return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatNumberVN(n: number): string {
    return Number.isInteger(n)
        ? n.toLocaleString('vi-VN')
        : Number(n.toFixed(2)).toLocaleString('vi-VN')
}

function formatUnitTotalsMap(map: Map<string, number>, prefix = ''): string {
    const entries = Array.from(map.entries()).filter(([, val]) => Math.abs(val) > 0.0001)
    if (entries.length === 0) return '0'
    return entries
        .map(([unit, val]) => {
            const sign = prefix === 'signed' ? (val > 0 ? '+' : '') : prefix
            return `${sign}${formatNumberVN(val)} ${unit}`
        })
        .join(' · ')
}

export function WarehouseAdjustmentReviewModal({
    isOpen,
    onClose,
    supabase,
    systemCode,
    currentUserName,
    currentUserId,
    onFocusPosition,
    onProposalApproved,
    onStartVisualReview,
    variant = 'modal'
}: WarehouseAdjustmentReviewModalProps) {
    const [proposals, setProposals] = useState<WarehouseProposal[]>([])
    const [loading, setLoading] = useState(false)
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
    const [positionQuery, setPositionQuery] = useState('')
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)
    const [isApproving, setIsApproving] = useState(false)
    const [isRejecting, setIsRejecting] = useState(false)
    const [reviewNotes, setReviewNotes] = useState('')

    // Bộ lọc ngày & sản phẩm + chế độ thống kê biến động
    const [dateFilter, setDateFilter] = useState<string>('') // '' = tất cả ngày, 'yyyy-MM-dd' = ngày cụ thể
    const [productQuery, setProductQuery] = useState('')
    const [selectedProductFilter, setSelectedProductFilter] = useState<{
        name: string
        sku: string | null
        aliases: string | null
    } | null>(null)
    const [showProductSuggestions, setShowProductSuggestions] = useState(false)
    const [showMovementReport, setShowMovementReport] = useState(false)
    const [exportingImage, setExportingImage] = useState<'download' | 'copy' | null>(null)
    const [copyImageDone, setCopyImageDone] = useState(false)
    const [productCatalog, setProductCatalog] = useState<CatalogProduct[]>([])
    const productBoxRef = useRef<HTMLDivElement | null>(null)

    // Đóng dropdown gợi ý sản phẩm khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (productBoxRef.current && !productBoxRef.current.contains(e.target as Node)) {
                setShowProductSuggestions(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Tải danh mục sản phẩm theo systemCode để hỗ trợ tìm theo tên viết tắt (aliases) & SKU
    useEffect(() => {
        if (!isOpen || !systemCode) return
        let mounted = true
        ;(async () => {
            try {
                const { data } = await (supabase as any)
                    .from('products')
                    .select('id, name, sku, aliases, internal_code, internal_name, unit')
                    .eq('system_type', systemCode)
                    .order('name', { ascending: true })
                    .limit(1500)
                if (mounted && Array.isArray(data)) {
                    setProductCatalog(data as CatalogProduct[])
                }
            } catch {
                // ignore
            }
        })()
        return () => {
            mounted = false
        }
    }, [isOpen, systemCode, supabase])

    const loadProposals = useCallback(async () => {
        if (!systemCode) return
        setLoading(true)
        try {
            const list = await getWarehouseProposals(supabase, systemCode, statusFilter)
            setProposals(list)
            if (list.length > 0) {
                setSelectedProposalId(prev =>
                    prev && list.some(p => p.id === prev) ? prev : list[0].id
                )
            } else {
                setSelectedProposalId(null)
            }
        } finally {
            setLoading(false)
        }
    }, [supabase, systemCode, statusFilter])

    useEffect(() => {
        if (isOpen) {
            loadProposals()
        }
    }, [isOpen, loadProposals])

    // Map tra cứu nhanh sản phẩm trong catalog theo SKU và tên chuẩn hóa (để ghép aliases)
    const catalogLookup = useMemo(() => {
        const bySku = new Map<string, CatalogProduct>()
        const byName = new Map<string, CatalogProduct>()
        for (const p of productCatalog) {
            if (p.sku) bySku.set(p.sku.trim().toUpperCase(), p)
            if (p.name) byName.set(normalizeSearchString(p.name, true), p)
        }
        return { bySku, byName }
    }, [productCatalog])

    const findCatalogMeta = useCallback(
        (name?: string | null, sku?: string | null): CatalogProduct | null => {
            if (sku) {
                const hit = catalogLookup.bySku.get(sku.trim().toUpperCase())
                if (hit) return hit
            }
            if (name) {
                const hit = catalogLookup.byName.get(normalizeSearchString(name, true))
                if (hit) return hit
            }
            return null
        },
        [catalogLookup]
    )

    // Lọc phiếu theo ngày trước
    const dateFilteredProposals = useMemo(() => {
        if (!dateFilter) return proposals
        return proposals.filter(prop => getProposalDateStr(prop) === dateFilter)
    }, [proposals, dateFilter])

    // Trích xuất toàn bộ các dòng biến động sản phẩm từ các phiếu trong phạm vi ngày đang chọn
    const allMovementEntries = useMemo<ProductMovementEntry[]>(() => {
        const entries: ProductMovementEntry[] = []

        for (const proposal of dateFilteredProposals) {
            const ts = proposal.approved_at || proposal.created_at || ''
            proposal.items.forEach((it, itemIndex) => {
                const isItemApproved = proposal.status === 'APPROVED' || it.status === 'APPROVED'

                if (it.sub_items && it.sub_items.length > 0) {
                    it.sub_items.forEach((sub, sIdx) => {
                        const prodName = (sub.product_name || it.product_name || 'Chưa rõ sản phẩm').trim()
                        const sku = sub.sku || it.sku || null
                        const meta = findCatalogMeta(prodName, sku)
                        const unit = normalizeUnitLabel(sub.unit || it.unit || meta?.unit || 'Thùng')

                        let beforeQty: number | null = Number(sub.current_quantity) || 0
                        let afterQty: number | null = Number(sub.new_quantity) || 0
                        let delta = 0
                        let changeKind: MovementKind = 'UNCHANGED'

                        if (it.action_type === 'CLEAR') {
                            afterQty = 0
                            delta = -beforeQty
                            changeKind = 'CLEAR'
                        } else if (it.action_type === 'SET_QTY') {
                            if (!it.lot_id || sub.is_new) {
                                beforeQty = 0
                                delta = afterQty
                                changeKind = !it.lot_id ? 'CREATE_LOT' : 'ADD_TO_LOT'
                            } else {
                                delta = Number((afterQty - beforeQty).toFixed(2))
                                changeKind = delta > 0 ? 'INCREASE' : delta < 0 ? 'DECREASE' : 'UNCHANGED'
                            }
                        } else {
                            beforeQty = Number(sub.current_quantity) || null
                            afterQty = beforeQty
                            delta = 0
                            changeKind = it.action_type
                        }

                        entries.push({
                            key: `${proposal.id}-${it.id || itemIndex}-sub-${sIdx}`,
                            proposal,
                            item: it,
                            itemIndex,
                            timestamp: ts,
                            productName: prodName,
                            sku,
                            aliases: meta?.aliases || null,
                            internalCode: meta?.internal_code || null,
                            internalName: meta?.internal_name || null,
                            unit,
                            beforeQty,
                            afterQty,
                            delta,
                            changeKind,
                            isApproved: isItemApproved
                        })
                    })
                } else {
                    const prodName = (
                        it.product_name ||
                        (it.action_type === 'NOTE' ? 'Ghi chú (không gắn SP)' : 'Chưa rõ sản phẩm')
                    ).trim()
                    const sku = it.sku || null
                    const meta = findCatalogMeta(prodName, sku)
                    const unit = normalizeUnitLabel(it.unit || meta?.unit || 'Thùng')

                    let beforeQty: number | null =
                        it.current_quantity != null ? Number(it.current_quantity) : null
                    let afterQty: number | null =
                        it.new_quantity != null ? Number(it.new_quantity) : null
                    let delta = 0
                    let changeKind: MovementKind = 'UNCHANGED'

                    if (it.action_type === 'CLEAR') {
                        const prev = beforeQty ?? 0
                        beforeQty = prev
                        afterQty = 0
                        delta = -prev
                        changeKind = 'CLEAR'
                    } else if (it.action_type === 'SET_QTY') {
                        if (!it.lot_id) {
                            beforeQty = 0
                            const next = afterQty ?? 0
                            afterQty = next
                            delta = next
                            changeKind = 'CREATE_LOT'
                        } else {
                            const prev = beforeQty ?? 0
                            const next = afterQty ?? prev
                            beforeQty = prev
                            afterQty = next
                            delta = Number((next - prev).toFixed(2))
                            changeKind = delta > 0 ? 'INCREASE' : delta < 0 ? 'DECREASE' : 'UNCHANGED'
                        }
                    } else if (it.action_type === 'MOVE') {
                        delta = 0
                        changeKind = 'MOVE'
                    } else if (it.action_type === 'ASSIGN_LOT') {
                        delta = 0
                        changeKind = 'ASSIGN_LOT'
                    } else {
                        delta = 0
                        changeKind = 'NOTE'
                    }

                    entries.push({
                        key: `${proposal.id}-${it.id || itemIndex}`,
                        proposal,
                        item: it,
                        itemIndex,
                        timestamp: ts,
                        productName: prodName,
                        sku,
                        aliases: meta?.aliases || null,
                        internalCode: meta?.internal_code || null,
                        internalName: meta?.internal_name || null,
                        unit,
                        beforeQty,
                        afterQty,
                        delta,
                        changeKind,
                        isApproved: isItemApproved
                    })
                }
            })
        }

        // Sắp xếp mới nhất lên đầu
        entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        return entries
    }, [dateFilteredProposals, findCatalogMeta])

    // Danh sách sản phẩm gợi ý (kết hợp sản phẩm có trong phiếu + danh mục products để tìm bằng aliases)
    const productSuggestions = useMemo(() => {
        const map = new Map<
            string,
            {
                name: string
                sku: string | null
                aliases: string | null
                internal_code: string | null
                internal_name: string | null
                countInProposals: number
            }
        >()

        // 1. Đưa các sản phẩm xuất hiện trong các phiếu đang tải lên trước
        for (const e of allMovementEntries) {
            if (!e.productName || e.productName === 'Ghi chú (không gắn SP)') continue
            const k = e.sku
                ? `sku:${e.sku.trim().toUpperCase()}`
                : `name:${normalizeSearchString(e.productName, true)}`
            const existing = map.get(k)
            if (existing) {
                existing.countInProposals += 1
            } else {
                map.set(k, {
                    name: e.productName,
                    sku: e.sku,
                    aliases: e.aliases,
                    internal_code: e.internalCode,
                    internal_name: e.internalName,
                    countInProposals: 1
                })
            }
        }

        // 2. Bổ sung sản phẩm từ catalog (để tìm được ngay cả khi gõ tên viết tắt)
        for (const p of productCatalog) {
            const k = p.sku
                ? `sku:${p.sku.trim().toUpperCase()}`
                : `name:${normalizeSearchString(p.name, true)}`
            if (!map.has(k)) {
                map.set(k, {
                    name: p.name,
                    sku: p.sku,
                    aliases: p.aliases,
                    internal_code: p.internal_code,
                    internal_name: p.internal_name,
                    countInProposals: 0
                })
            }
        }

        const all = Array.from(map.values())
        const q = productQuery.trim()
        if (!q) {
            return all
                .sort((a, b) => b.countInProposals - a.countInProposals || a.name.localeCompare(b.name))
                .slice(0, 18)
        }

        return all
            .filter(p => matchSearch(p, q))
            .sort((a, b) => {
                // Ưu tiên sản phẩm có phát sinh trong phiếu + điểm khớp tìm kiếm cao
                const hasA = a.countInProposals > 0 ? 1 : 0
                const hasB = b.countInProposals > 0 ? 1 : 0
                if (hasA !== hasB) return hasB - hasA
                return calculateSearchScore(b, q) - calculateSearchScore(a, q)
            })
            .slice(0, 20)
    }, [allMovementEntries, productCatalog, productQuery])

    const matchesProductEntry = useCallback(
        (entry: ProductMovementEntry): boolean => {
            if (selectedProductFilter) {
                if (selectedProductFilter.sku && entry.sku) {
                    return (
                        entry.sku.trim().toUpperCase() ===
                        selectedProductFilter.sku.trim().toUpperCase()
                    )
                }
                return (
                    normalizeSearchString(entry.productName, true) ===
                    normalizeSearchString(selectedProductFilter.name, true)
                )
            }
            const q = productQuery.trim()
            if (!q) return true
            return matchSearch(
                {
                    name: entry.productName,
                    sku: entry.sku,
                    aliases: entry.aliases,
                    internal_code: entry.internalCode,
                    internal_name: entry.internalName
                },
                q
            )
        },
        [selectedProductFilter, productQuery]
    )

    const hasProductFilter = Boolean(selectedProductFilter || productQuery.trim())
    const normalizedPosQuery = positionQuery.trim().toUpperCase()

    // Các dòng biến động sau khi lọc theo sản phẩm + vị trí
    const filteredMovementEntries = useMemo(() => {
        return allMovementEntries.filter(entry => {
            if (hasProductFilter && !matchesProductEntry(entry)) return false
            if (normalizedPosQuery) {
                const matchSrc = (entry.item.position_code || '').toUpperCase().includes(normalizedPosQuery)
                const matchDst = (entry.item.target_position_code || '')
                    .toUpperCase()
                    .includes(normalizedPosQuery)
                if (!matchSrc && !matchDst) return false
            }
            return true
        })
    }, [allMovementEntries, hasProductFilter, matchesProductEntry, normalizedPosQuery])

    // Thống kê biến động (chỉ tính các dòng ĐÃ DUYỆT để số liệu xuất/nhập chính xác 100%)
    const approvedMovementStats = useMemo(() => {
        const approvedEntries = filteredMovementEntries.filter(e => e.isApproved)
        const decreasedByUnit = new Map<string, number>()
        const increasedByUnit = new Map<string, number>()
        const netByUnit = new Map<string, number>()
        let decreaseCount = 0
        let increaseCount = 0
        let moveCount = 0
        let assignCount = 0
        let noteCount = 0

        // Gom theo từng sản phẩm để hiển thị bảng tổng hợp khi xem toàn bộ biến động trong ngày
        const byProduct = new Map<
            string,
            {
                name: string
                sku: string | null
                aliases: string | null
                decreased: Map<string, number>
                increased: Map<string, number>
                net: Map<string, number>
                count: number
                byKind: Map<MovementKind, { count: number; qtyByUnit: Map<string, number> }>
            }
        >()

        for (const e of approvedEntries) {
            if (e.delta < 0) {
                const abs = Math.abs(e.delta)
                decreasedByUnit.set(e.unit, (decreasedByUnit.get(e.unit) || 0) + abs)
                netByUnit.set(e.unit, (netByUnit.get(e.unit) || 0) - abs)
                decreaseCount++
            } else if (e.delta > 0) {
                increasedByUnit.set(e.unit, (increasedByUnit.get(e.unit) || 0) + e.delta)
                netByUnit.set(e.unit, (netByUnit.get(e.unit) || 0) + e.delta)
                increaseCount++
            }

            if (e.changeKind === 'MOVE') moveCount++
            if (e.changeKind === 'ASSIGN_LOT') assignCount++
            if (e.changeKind === 'NOTE') noteCount++

            const pKey = e.sku
                ? `sku:${e.sku.trim().toUpperCase()}`
                : `name:${normalizeSearchString(e.productName, true)}`
            let group = byProduct.get(pKey)
            if (!group) {
                group = {
                    name: e.productName,
                    sku: e.sku,
                    aliases: e.aliases,
                    decreased: new Map(),
                    increased: new Map(),
                    net: new Map(),
                    count: 0,
                    byKind: new Map()
                }
                byProduct.set(pKey, group)
            }
            group.count++
            if (e.delta < 0) {
                const abs = Math.abs(e.delta)
                group.decreased.set(e.unit, (group.decreased.get(e.unit) || 0) + abs)
                group.net.set(e.unit, (group.net.get(e.unit) || 0) - abs)
            } else if (e.delta > 0) {
                group.increased.set(e.unit, (group.increased.get(e.unit) || 0) + e.delta)
                group.net.set(e.unit, (group.net.get(e.unit) || 0) + e.delta)
            }

            let kindBucket = group.byKind.get(e.changeKind)
            if (!kindBucket) {
                kindBucket = { count: 0, qtyByUnit: new Map() }
                group.byKind.set(e.changeKind, kindBucket)
            }
            kindBucket.count++
            if (e.delta !== 0) {
                const abs = Math.abs(e.delta)
                kindBucket.qtyByUnit.set(e.unit, (kindBucket.qtyByUnit.get(e.unit) || 0) + abs)
            }
        }

        const buildActionTags = (
            byKind: Map<MovementKind, { count: number; qtyByUnit: Map<string, number> }>
        ): ExportActionTag[] => {
            const tags: ExportActionTag[] = []
            const order: Array<{
                kind: MovementKind
                label: string
                sign: '+' | '-' | ''
                tone: ExportActionTag['tone']
            }> = [
                { kind: 'CLEAR', label: 'Xuất rỗng', sign: '-', tone: 'rose' },
                { kind: 'DECREASE', label: 'Điều chỉnh giảm', sign: '-', tone: 'amber' },
                { kind: 'CREATE_LOT', label: 'Tạo Lot mới', sign: '+', tone: 'emerald' },
                { kind: 'ADD_TO_LOT', label: 'Thêm vào Lot', sign: '+', tone: 'emerald' },
                { kind: 'INCREASE', label: 'Điều chỉnh tăng', sign: '+', tone: 'sky' },
                { kind: 'MOVE', label: 'Chuyển ô', sign: '', tone: 'sky' },
                { kind: 'ASSIGN_LOT', label: 'Gắn STT', sign: '', tone: 'purple' },
                { kind: 'NOTE', label: 'Ghi chú', sign: '', tone: 'slate' },
                { kind: 'UNCHANGED', label: 'Điều chỉnh (0)', sign: '', tone: 'slate' }
            ]

            for (const cfg of order) {
                const b = byKind.get(cfg.kind)
                if (!b || b.count === 0) continue
                if (cfg.sign) {
                    const qtyStr = formatUnitTotalsMap(b.qtyByUnit, cfg.sign)
                    tags.push({
                        label: qtyStr !== '0' ? `${cfg.label} (${qtyStr})` : `${cfg.label} (${b.count})`,
                        tone: cfg.tone
                    })
                } else {
                    tags.push({
                        label: `${cfg.label} (${b.count})`,
                        tone: cfg.tone
                    })
                }
            }
            return tags
        }

        const productSummaryList = Array.from(byProduct.values())
            .map(g => ({
                ...g,
                actionTags: buildActionTags(g.byKind)
            }))
            .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))

        return {
            approvedEntries,
            decreasedByUnit,
            increasedByUnit,
            netByUnit,
            decreaseCount,
            increaseCount,
            moveCount,
            assignCount,
            noteCount,
            productSummaryList
        }
    }, [filteredMovementEntries])

    // Lọc danh sách phiếu bên trái theo Ngày + Vị trí + Sản phẩm
    const filteredProposals = useMemo(() => {
        if (!normalizedPosQuery && !hasProductFilter) return dateFilteredProposals
        const matchedProposalIds = new Set(filteredMovementEntries.map(e => e.proposal.id))
        return dateFilteredProposals.filter(prop => matchedProposalIds.has(prop.id))
    }, [dateFilteredProposals, normalizedPosQuery, hasProductFilter, filteredMovementEntries])

    const selectedProposal = useMemo(() => {
        return filteredProposals.find(p => p.id === selectedProposalId) || filteredProposals[0] || null
    }, [filteredProposals, selectedProposalId])

    const pendingCount = useMemo(() => {
        return proposals.filter(p => p.status === 'PENDING').length
    }, [proposals])

    const positionHistoryEntries = useMemo(() => {
        if (!normalizedPosQuery) return []
        const entries: Array<{ proposal: WarehouseProposal; item: ProposalItem; itemIndex: number }> = []
        for (const prop of filteredProposals) {
            prop.items.forEach((it, idx) => {
                const matchSrc = (it.position_code || '').toUpperCase().includes(normalizedPosQuery)
                const matchDst = (it.target_position_code || '').toUpperCase().includes(normalizedPosQuery)
                if (matchSrc || matchDst) {
                    entries.push({ proposal: prop, item: it, itemIndex: idx })
                }
            })
        }
        return entries
    }, [filteredProposals, normalizedPosQuery])

    const handleOpenTodayMovements = () => {
        if (!showMovementReport) {
            setShowMovementReport(true)
            setStatusFilter('APPROVED')
            if (!dateFilter) {
                setDateFilter(getTodayDateStr())
            }
        } else {
            setShowMovementReport(false)
        }
    }

    const handleExportMovementImage = async (action: 'download' | 'copy') => {
        if (exportingImage) return
        setExportingImage(action)
        try {
            const dateLabel = dateFilter
                ? `Ngày: ${format(new Date(`${dateFilter}T00:00:00`), 'dd/MM/yyyy')}`
                : 'Tất cả ngày'

            const title = selectedProductFilter
                ? selectedProductFilter.name
                : productQuery.trim()
                ? `Sản phẩm khớp "${productQuery.trim()}"`
                : `Tổng hợp biến động sản phẩm (${approvedMovementStats.productSummaryList.length} SP)`

            const subtitleParts: string[] = [`Phân hệ: ${systemCode || 'KHO'}`]
            if (selectedProductFilter?.sku) subtitleParts.push(`SKU: ${selectedProductFilter.sku}`)

            const mode: 'summary' | 'detail' = hasProductFilter ? 'detail' : 'summary'

            const summaryRows = approvedMovementStats.productSummaryList.map(r => ({
                name: r.name,
                sku: r.sku,
                actionTags: r.actionTags,
                decreasedText: formatUnitTotalsMap(r.decreased, '-'),
                increasedText: formatUnitTotalsMap(r.increased, '+'),
                netText: formatUnitTotalsMap(r.net, 'signed'),
                count: r.count
            }))

            const detailRows = approvedMovementStats.approvedEntries.map(e => {
                const badge = getMovementKindBadge(e.changeKind, e.delta, e.unit)
                const qtyText =
                    e.beforeQty !== null &&
                    e.afterQty !== null &&
                    (e.item.action_type === 'SET_QTY' || e.item.action_type === 'CLEAR')
                        ? `${formatNumberVN(e.beforeQty)} ➔ ${formatNumberVN(e.afterQty)} ${e.unit}`
                        : '---'
                return {
                    timeText: e.timestamp ? format(new Date(e.timestamp), 'dd/MM HH:mm') : '---',
                    positionText:
                        e.item.action_type === 'MOVE' && e.item.target_position_code
                            ? `${e.item.position_code} ➔ ${e.item.target_position_code}`
                            : e.item.position_code,
                    actionText: badge.label,
                    qtyText,
                    isDecrease: e.delta < 0,
                    isIncrease: e.delta > 0,
                    noteText: e.item.note || '',
                    userText: `${e.proposal.code ? `${e.proposal.code} · ` : ''}${e.proposal.created_by_name || 'NV'}${
                        e.proposal.approved_by_name ? ` · Duyệt: ${e.proposal.approved_by_name}` : ''
                    }`
                }
            })

            const blob = await renderMovementReportToBlob({
                title,
                subtitle: subtitleParts.join(' · '),
                dateLabel,
                decreasedTotal:
                    approvedMovementStats.decreaseCount > 0
                        ? formatUnitTotalsMap(approvedMovementStats.decreasedByUnit, '-')
                        : '0',
                decreaseCount: approvedMovementStats.decreaseCount,
                increasedTotal:
                    approvedMovementStats.increaseCount > 0
                        ? formatUnitTotalsMap(approvedMovementStats.increasedByUnit, '+')
                        : '0',
                increaseCount: approvedMovementStats.increaseCount,
                netTotal: formatUnitTotalsMap(approvedMovementStats.netByUnit, 'signed'),
                totalActions: approvedMovementStats.approvedEntries.length,
                moveCount: approvedMovementStats.moveCount,
                assignCount: approvedMovementStats.assignCount,
                mode,
                summaryRows,
                detailRows
            })

            const triggerDownload = () => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                const dateSlug = dateFilter || format(new Date(), 'yyyy-MM-dd')
                a.href = url
                a.download = `bien-dong-sp-${dateSlug}.png`
                document.body.appendChild(a)
                a.click()
                a.remove()
                setTimeout(() => URL.revokeObjectURL(url), 1500)
            }

            if (action === 'copy' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
                try {
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                    setCopyImageDone(true)
                    setTimeout(() => setCopyImageDone(false), 2500)
                    return
                } catch {
                    // Fallback tải file nếu trình duyệt chặn clipboard
                    triggerDownload()
                    return
                }
            }

            triggerDownload()
        } catch (err: any) {
            alert(`❌ Không thể xuất ảnh PNG: ${err?.message || 'Lỗi không xác định'}`)
        } finally {
            setExportingImage(null)
        }
    }

    const handleApprove = async () => {
        if (!selectedProposal || isApproving) return
        if (!window.confirm(`Bạn có chắc chắn muốn DUYỆT phiếu đề xuất và cập nhật ${selectedProposal.items.length} vị trí vào sơ đồ kho?`)) {
            return
        }

        setIsApproving(true)
        try {
            const res = await approveWarehouseProposal(supabase, selectedProposal, {
                id: currentUserId,
                name: currentUserName || 'Quản lý',
                notes: reviewNotes.trim() || undefined
            })

            if (res.success) {
                alert(`✅ Đã duyệt thành công và cập nhật ${res.appliedCount || selectedProposal.items.length} vị trí vào sơ đồ kho!`)
                setReviewNotes('')
                if (onProposalApproved) {
                    onProposalApproved()
                }
                await loadProposals()
            } else {
                alert(`❌ Lỗi khi duyệt: ${res.error}`)
            }
        } finally {
            setIsApproving(false)
        }
    }

    const handleReject = async () => {
        if (!selectedProposal || isRejecting) return
        const reason = window.prompt('Nhập lý do từ chối đề xuất này (tùy chọn):', reviewNotes)
        if (reason === null) return

        setIsRejecting(true)
        try {
            const res = await rejectWarehouseProposal(supabase, selectedProposal.id, {
                id: currentUserId,
                name: currentUserName || 'Quản lý',
                notes: reason.trim() || undefined
            })

            if (res.success) {
                alert('Đã từ chối phiếu đề xuất.')
                setReviewNotes('')
                await loadProposals()
            } else {
                alert(`❌ Lỗi: ${res.error}`)
            }
        } finally {
            setIsRejecting(false)
        }
    }

    const getMovementKindBadge = (kind: MovementKind, delta: number, unit: string) => {
        switch (kind) {
            case 'CLEAR':
                return {
                    label: `Xuất rỗng (-${formatNumberVN(Math.abs(delta))} ${unit})`,
                    className: 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                }
            case 'DECREASE':
                return {
                    label: `Giảm SL (${formatNumberVN(delta)} ${unit})`,
                    className: 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                }
            case 'CREATE_LOT':
                return {
                    label: `Tạo Lot mới (+${formatNumberVN(delta)} ${unit})`,
                    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                }
            case 'ADD_TO_LOT':
                return {
                    label: `Thêm SP vào Lot (+${formatNumberVN(delta)} ${unit})`,
                    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                }
            case 'INCREASE':
                return {
                    label: `Tăng SL (+${formatNumberVN(delta)} ${unit})`,
                    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                }
            case 'MOVE':
                return {
                    label: 'Chuyển vị trí',
                    className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                }
            case 'ASSIGN_LOT':
                return {
                    label: 'Gắn STT Lot',
                    className: 'bg-purple-500/15 text-purple-300 border-purple-500/40'
                }
            case 'NOTE':
                return {
                    label: 'Chỉ ghi chú',
                    className: 'bg-slate-800 text-slate-300 border-slate-700'
                }
            default:
                return {
                    label: 'Không đổi SL (0)',
                    className: 'bg-slate-800 text-slate-300 border-slate-700'
                }
        }
    }

    const renderItemCard = (
        proposal: WarehouseProposal,
        it: ProposalItem,
        idx: number,
        displayIndex: number,
        showProposalMeta: boolean = false
    ) => {
        const isItemApproved = it.status === 'APPROVED' || proposal.status === 'APPROVED'
        return (
            <div
                key={`${proposal.id}-${it.id || idx}`}
                className="rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/40 p-4 transition space-y-3"
            >
                {showProposalMeta && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                <Clock className="w-3 h-3" />
                                {proposal.created_at ? format(new Date(proposal.created_at), 'dd/MM/yyyy HH:mm:ss') : '---'}
                            </span>
                            {proposal.code && (
                                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                                    {proposal.code}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-slate-400">
                                <User className="w-3 h-3 text-blue-400" />
                                {proposal.created_by_name || 'Nhân viên'}
                            </span>
                        </div>
                        <div>
                            {proposal.status === 'PENDING' && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    Chờ duyệt
                                </span>
                            )}
                            {proposal.status === 'APPROVED' && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Đã duyệt
                                </span>
                            )}
                            {proposal.status === 'REJECTED' && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                    Từ chối
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Hàng 1: STT, Mã vị trí, Thao tác, Trước -> Sau, Nút soi */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-400 font-mono text-xs font-bold flex items-center justify-center">
                            {displayIndex + 1}
                        </span>

                        <div>
                            <span className="font-bold text-slate-100 text-sm font-mono bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700">
                                {it.position_code}
                            </span>
                            {it.warehouse_name && (
                                <span className="ml-2 text-xs text-slate-500">
                                    {it.warehouse_name}
                                </span>
                            )}
                        </div>

                        {it.action_type === 'CLEAR' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                🔴 Xuất rỗng ô
                            </span>
                        )}
                        {it.action_type === 'SET_QTY' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                {!it.lot_id ? '🟢 Tạo Lot mới' : '🟡 Sửa số lượng'}
                            </span>
                        )}
                        {it.action_type === 'MOVE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                                🔵 Chuyển vị trí
                            </span>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                🏷️ Gắn STT Lot
                            </span>
                        )}
                        {it.action_type === 'NOTE' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                📝 Chỉ ghi chú
                            </span>
                        )}

                        {isItemApproved && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                ✓ Đã duyệt
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 ml-auto">
                        {it.action_type === 'CLEAR' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 line-through">
                                    {it.current_quantity ?? 'Có hàng'} {it.unit || 'thùng'}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-rose-400" />
                                <span className="font-bold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                                    Trống ô (0)
                                </span>
                            </div>
                        )}
                        {it.action_type === 'SET_QTY' && !(it.sub_items && it.sub_items.length > 1) && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">
                                    {it.current_quantity ?? '--'}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                                <span className="font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                                    {it.new_quantity} {it.unit || 'thùng'}
                                </span>
                            </div>
                        )}
                        {it.action_type === 'MOVE' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400 font-mono">
                                    {it.position_code}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="font-bold text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 font-mono">
                                    {it.target_position_code || 'Vị trí mới'}
                                </span>
                            </div>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-slate-400">Gắn STT:</span>
                                <span className="font-bold text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-700/40 font-mono">
                                    {it.lot_stt || it.lot_code || '---'}
                                </span>
                            </div>
                        )}

                        <button
                            onClick={() => {
                                if (onStartVisualReview && proposal.status === 'PENDING') {
                                    onStartVisualReview(proposal, idx)
                                    onClose()
                                } else if (onFocusPosition) {
                                    onFocusPosition(it.position_id, it.position_code)
                                    onClose()
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 transition text-xs font-semibold border border-slate-700 hover:border-amber-400 whitespace-nowrap"
                            title="Xem ô này trên sơ đồ kho"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Soi trên bản đồ</span>
                        </button>
                    </div>
                </div>

                {/* Hàng 2: Thông tin Mặt hàng & Lô (nếu có) */}
                {it.sub_items && it.sub_items.length > 1 ? (
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/70">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Pallet hỗn hợp ({it.sub_items.length} SP)
                            </span>
                            {it.lot_stt && (
                                <span className="text-purple-300 font-bold font-mono bg-purple-950/50 px-2 py-0.5 rounded border border-purple-700/50 text-[11px]">
                                    STT: {it.lot_stt}
                                </span>
                            )}
                            {it.lot_code && (
                                <span className="text-xs text-blue-400 font-mono">
                                    Lot: {it.lot_code}
                                </span>
                            )}
                            {it.action_type === 'SET_QTY' && (
                                <span className="text-xs text-amber-400 font-semibold ml-auto">
                                    Tổng sau sửa: {it.new_quantity} {it.unit || 'thùng'}
                                </span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {it.sub_items.map((sub, sIdx) => (
                                <div key={sIdx} className="bg-slate-900/80 rounded-lg px-3 py-1.5 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                                    <div className="min-w-0">
                                        <div className="font-medium text-slate-200 truncate">
                                            {sub.product_name}
                                        </div>
                                        {sub.sku && (
                                            <div className="text-[10px] text-slate-500 font-mono">
                                                SKU: {sub.sku}
                                            </div>
                                        )}
                                    </div>
                                    {it.action_type === 'SET_QTY' && (
                                        <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                            <span className="text-slate-400">{sub.current_quantity}</span>
                                            <ArrowRight className="w-3 h-3 text-amber-400" />
                                            <span className={`font-bold px-1.5 py-0.5 rounded border ${sub.new_quantity === 0 ? 'text-rose-400 bg-rose-950/40 border-rose-800/40' : 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'}`}>
                                                {sub.new_quantity} {sub.unit || 'th'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : it.action_type === 'ASSIGN_LOT' && it.lot_found === false ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded-lg px-3 py-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>
                            Không tìm thấy Lot nào khớp STT <strong className="font-mono">{it.lot_stt || '---'}</strong> trong phân hệ kho hiện tại.
                        </span>
                    </div>
                ) : (it.product_name || it.lot_code || it.action_type !== 'NOTE') ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 pt-1 border-t border-slate-800/70">
                        <span className="font-medium text-slate-200">
                            {it.product_name || (it.action_type === 'NOTE' ? 'Ô trống' : 'Hàng đông lạnh')}
                        </span>
                        {it.lot_stt && (
                            <span className="text-purple-300 font-bold font-mono bg-purple-950/50 px-2 py-0.5 rounded border border-purple-700/50 text-[11px]">
                                STT: {it.lot_stt}
                            </span>
                        )}
                        {it.lot_code && (
                            <span className="text-blue-400 font-mono bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40 text-[11px]">
                                Lot: {it.lot_code}
                            </span>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && it.new_quantity != null && (
                            <span className="text-emerald-300 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 text-[11px]">
                                SL: {it.new_quantity} {it.unit || 'Thùng'}
                            </span>
                        )}
                        {it.action_type === 'ASSIGN_LOT' && it.target_position_code && it.target_position_code !== it.position_code && (
                            <span className="text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 text-[11px]">
                                Đang ở ô {it.target_position_code} ➔ chuyển sang {it.position_code}
                            </span>
                        )}
                    </div>
                ) : null}

                {/* Hàng 3: Ghi chú thực tế */}
                {it.note && (
                    <div className={`rounded-lg px-3 py-2 border text-xs leading-relaxed ${
                        it.action_type === 'NOTE'
                            ? 'bg-emerald-950/40 border-emerald-700/40 text-emerald-200'
                            : 'bg-slate-900 border-slate-700/80 text-amber-200'
                    }`}>
                        <span className="font-bold mr-1.5">💬 Ghi chú:</span>
                        <span className="whitespace-pre-wrap break-words">{it.note}</span>
                    </div>
                )}
            </div>
        )
    }

    if (!isOpen) return null

    const isShowingMovementPanel = showMovementReport || hasProductFilter
    const todayStr = getTodayDateStr()
    const isPage = variant === 'page'

    const content = (
        <div
            className={
                isPage
                    ? 'w-full h-[calc(100vh-5.5rem)] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-xl flex flex-col overflow-hidden text-slate-100'
                    : 'relative w-full h-full max-w-none bg-slate-900 border border-slate-700/80 rounded-none sm:rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100'
            }
        >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-slate-100">
                                    Duyệt Đề Xuất Điều Chỉnh Vị Trí Kho
                                </h2>
                                {pendingCount > 0 && (
                                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        {pendingCount} chờ duyệt
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400">
                                Tiếp nhận ghi nháp từ App, phê duyệt cập nhật sơ đồ kho và theo dõi biến động theo sản phẩm
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleOpenTodayMovements}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                                showMovementReport
                                    ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/60'
                                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-emerald-700/50'
                            }`}
                            title="Xem tổng hợp biến động sản phẩm (xuất/xóa, tạo mới/tăng giảm) trên các phiếu đã duyệt"
                        >
                            <BarChart3 className="w-4 h-4" />
                            <span>Biến động SP</span>
                        </button>
                        <button
                            onClick={() => loadProposals()}
                            disabled={loading}
                            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
                            title="Làm mới"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {!isPage && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 px-6 py-2.5 bg-slate-950/60 border-b border-slate-800 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Lọc trạng thái */}
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 mr-0.5 flex items-center gap-1">
                                <Filter className="w-3.5 h-3.5" /> Lọc:
                            </span>
                            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map(st => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                                        statusFilter === st
                                            ? 'bg-blue-600 text-white shadow-sm'
                                            : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                    }`}
                                >
                                    {st === 'PENDING' && 'Chờ duyệt'}
                                    {st === 'APPROVED' && 'Đã duyệt'}
                                    {st === 'REJECTED' && 'Đã từ chối'}
                                    {st === 'ALL' && 'Tất cả'}
                                </button>
                            ))}
                        </div>

                        {/* Lọc theo ngày */}
                        <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
                            <button
                                type="button"
                                onClick={() => setDateFilter(dateFilter === todayStr ? '' : todayStr)}
                                className={`px-2.5 py-1 rounded-md font-semibold transition border ${
                                    dateFilter === todayStr
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                        : 'bg-slate-800/80 text-slate-400 border-slate-700/60 hover:text-slate-200'
                                }`}
                            >
                                Hôm nay
                            </button>
                            <div className="relative flex items-center">
                                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                                <input
                                    type="date"
                                    value={dateFilter}
                                    onChange={e => setDateFilter(e.target.value)}
                                    className="pl-7 pr-2 py-1 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                                    title="Chọn ngày lọc phiếu"
                                />
                            </div>
                            {dateFilter && (
                                <button
                                    type="button"
                                    onClick={() => setDateFilter('')}
                                    className="px-1.5 py-1 rounded-md bg-slate-800 text-slate-400 hover:text-white"
                                    title="Xem tất cả ngày"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Ô lọc theo sản phẩm (có gợi ý tên viết tắt / SKU / tên SP) */}
                        <div ref={productBoxRef} className="relative flex items-center pl-2 border-l border-slate-800">
                            <Package className="w-3.5 h-3.5 text-emerald-400 absolute left-4.5 pointer-events-none" />
                            <input
                                type="text"
                                value={selectedProductFilter ? selectedProductFilter.name : productQuery}
                                onFocus={() => setShowProductSuggestions(true)}
                                onChange={e => {
                                    setSelectedProductFilter(null)
                                    setProductQuery(e.target.value)
                                    setShowProductSuggestions(true)
                                }}
                                placeholder="Lọc theo sản phẩm (tên viết tắt, SKU)..."
                                className="w-60 sm:w-72 pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-emerald-700/50 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 text-xs"
                            />
                            {(selectedProductFilter || productQuery) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedProductFilter(null)
                                        setProductQuery('')
                                    }}
                                    className="absolute right-2 text-slate-400 hover:text-white"
                                    title="Xóa lọc sản phẩm"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {/* Dropdown gợi ý sản phẩm (Autocomplete) */}
                            {showProductSuggestions && (
                                <div className="absolute left-2 top-full mt-1.5 w-[360px] max-h-72 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-30 p-1.5 space-y-1">
                                    {productSuggestions.length === 0 ? (
                                        <div className="px-3 py-4 text-center text-xs text-slate-500">
                                            Không tìm thấy sản phẩm phù hợp
                                        </div>
                                    ) : (
                                        productSuggestions.map((p, idx) => (
                                            <button
                                                key={`${p.sku || p.name}-${idx}`}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedProductFilter({
                                                        name: p.name,
                                                        sku: p.sku,
                                                        aliases: p.aliases
                                                    })
                                                    setProductQuery('')
                                                    setShowProductSuggestions(false)
                                                    if (statusFilter === 'PENDING') {
                                                        setStatusFilter('APPROVED')
                                                    }
                                                }}
                                                className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 transition flex items-start justify-between gap-2"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {p.aliases && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                                                ⚡ {p.aliases}
                                                            </span>
                                                        )}
                                                        {p.sku && (
                                                            <span className="font-mono text-[10px] text-sky-400 font-semibold">
                                                                {p.sku}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-semibold text-slate-100 leading-snug mt-0.5 line-clamp-2">
                                                        {p.name}
                                                    </div>
                                                </div>
                                                {p.countInProposals > 0 && (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold shrink-0">
                                                        {p.countInProposals} lượt
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Ô tìm kiếm theo mã vị trí */}
                        <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                            <input
                                type="text"
                                value={positionQuery}
                                onChange={e => setPositionQuery(e.target.value)}
                                placeholder="Tìm mã vị trí (K2D1...)"
                                className="w-44 pl-8 pr-7 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs"
                            />
                            {positionQuery ? (
                                <button
                                    onClick={() => setPositionQuery('')}
                                    className="absolute right-2 text-slate-400 hover:text-white"
                                    title="Xóa tìm kiếm vị trí"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="text-slate-400">
                        <span>
                            Tổng số: <strong className="text-slate-200">{filteredProposals.length}</strong> phiếu
                        </span>
                    </div>
                </div>

                {/* Body: Split 2 columns */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Proposal List */}
                    <div className="w-72 shrink-0 border-r border-slate-800 bg-slate-900/50 flex flex-col">
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {loading && proposals.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                                    <span>Đang tải danh sách...</span>
                                </div>
                            ) : filteredProposals.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-center p-4 text-slate-400">
                                    <FileText className="w-10 h-10 text-slate-600 mb-2" />
                                    <p className="font-semibold text-slate-300">
                                        Không có phiếu đề xuất nào khớp bộ lọc
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Thử chọn tab &quot;Đã duyệt&quot; / &quot;Tất cả&quot; hoặc bỏ lọc ngày/sản phẩm.
                                    </p>
                                </div>
                            ) : (
                                filteredProposals.map(prop => {
                                    const isSelected = prop.id === selectedProposal?.id
                                    return (
                                        <div
                                            key={prop.id}
                                            onClick={() => {
                                                setSelectedProposalId(prop.id)
                                                setShowMovementReport(false)
                                            }}
                                            className={`p-3 rounded-xl cursor-pointer border transition ${
                                                isSelected && !isShowingMovementPanel
                                                    ? 'bg-blue-950/40 border-blue-500/80 shadow-md shadow-blue-950/50'
                                                    : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-1 mb-1">
                                                <span className="font-semibold text-xs text-slate-200 truncate flex-1">
                                                    {prop.title || 'Điều chỉnh vị trí'}
                                                </span>
                                                {prop.status === 'PENDING' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                                        Chờ duyệt
                                                    </span>
                                                )}
                                                {prop.status === 'APPROVED' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                                        Đã duyệt
                                                    </span>
                                                )}
                                                {prop.status === 'REJECTED' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 whitespace-nowrap">
                                                        Từ chối
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                                                <User className="w-3 h-3 text-slate-500" />
                                                <span className="truncate">{prop.created_by_name || 'Nhân viên'}</span>
                                                <span>•</span>
                                                <span>{prop.items.length} vị trí</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                <span>
                                                    {prop.created_at
                                                        ? format(new Date(prop.created_at), 'dd/MM/yyyy HH:mm')
                                                        : ''}
                                                </span>
                                            </div>

                                            {prop.notes ? (
                                                <p className="text-[11px] text-amber-200/80 bg-amber-950/30 px-2 py-1 rounded mt-1.5 line-clamp-1 border border-amber-900/40">
                                                    💬 {prop.notes}
                                                </p>
                                            ) : null}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Product Movement Report OR Position History OR Selected Proposal Details */}
                    <div className="flex-1 flex flex-col bg-slate-900/30 overflow-hidden">
                        {isShowingMovementPanel ? (
                            <>
                                {/* Thanh tiêu đề & KPI Biến động sản phẩm */}
                                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/75 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <BarChart3 className="w-5 h-5 text-emerald-400 shrink-0" />
                                            <div className="min-w-0">
                                                <h3 className="text-sm font-bold text-white truncate">
                                                    {selectedProductFilter
                                                        ? `Biến động sản phẩm: ${selectedProductFilter.name}`
                                                        : productQuery.trim()
                                                        ? `Biến động sản phẩm khớp "${productQuery.trim()}"`
                                                        : 'Tổng hợp biến động sản phẩm (Phiếu đã duyệt)'}
                                                </h3>
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                                    <span>
                                                        Ngày:{' '}
                                                        <strong className="text-amber-300">
                                                            {dateFilter
                                                                ? format(new Date(`${dateFilter}T00:00:00`), 'dd/MM/yyyy')
                                                                : 'Tất cả ngày'}
                                                        </strong>
                                                    </span>
                                                    {selectedProductFilter?.sku && (
                                                        <span className="font-mono text-sky-400">
                                                            • SKU: {selectedProductFilter.sku}
                                                        </span>
                                                    )}
                                                    {statusFilter !== 'APPROVED' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setStatusFilter('APPROVED')}
                                                            className="text-emerald-400 underline hover:text-emerald-300"
                                                        >
                                                            (Chuyển sang tab Đã duyệt)
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleExportMovementImage('copy')}
                                                disabled={exportingImage !== null}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white border border-sky-400/60 transition disabled:opacity-50"
                                                title="Copy tấm ảnh PNG vào bộ nhớ tạm để dán thẳng (Ctrl+V) vào Zalo"
                                            >
                                                {exportingImage === 'copy' ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : copyImageDone ? (
                                                    <Check className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                                <span>{copyImageDone ? 'Đã copy! Dán vào Zalo' : 'Copy ảnh (Zalo)'}</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleExportMovementImage('download')}
                                                disabled={exportingImage !== null}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/60 transition disabled:opacity-50"
                                                title="Tải file ảnh PNG sắc nét về máy"
                                            >
                                                {exportingImage === 'download' ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Download className="w-3.5 h-3.5" />
                                                )}
                                                <span>Tải ảnh PNG</span>
                                            </button>

                                            {hasProductFilter && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProductFilter(null)
                                                        setProductQuery('')
                                                    }}
                                                    className="text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
                                                >
                                                    Xem tất cả SP
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowMovementReport(false)
                                                    setSelectedProductFilter(null)
                                                    setProductQuery('')
                                                }}
                                                className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
                                            >
                                                Quay lại xem phiếu
                                            </button>
                                        </div>
                                    </div>

                                    {/* 4 Thẻ KPI Tổng hợp (chỉ tính các phiếu ĐÃ DUYỆT) */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                                        <div className="rounded-xl bg-rose-950/35 border border-rose-500/30 px-3.5 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
                                                <TrendingDown className="w-3.5 h-3.5" />
                                                <span>Xuất / Xóa / Giảm SL</span>
                                            </div>
                                            <div className="text-sm font-black text-rose-400 font-mono mt-1">
                                                {approvedMovementStats.decreaseCount > 0
                                                    ? formatUnitTotalsMap(approvedMovementStats.decreasedByUnit, '-')
                                                    : '0'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {approvedMovementStats.decreaseCount} lượt giảm đã duyệt
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-emerald-950/35 border border-emerald-500/30 px-3.5 py-2.5">
                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                                <span>Tạo mới / Nhập / Tăng SL</span>
                                            </div>
                                            <div className="text-sm font-black text-emerald-400 font-mono mt-1">
                                                {approvedMovementStats.increaseCount > 0
                                                    ? formatUnitTotalsMap(approvedMovementStats.increasedByUnit, '+')
                                                    : '0'}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {approvedMovementStats.increaseCount} lượt tăng đã duyệt
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-slate-950/70 border border-slate-700/80 px-3.5 py-2.5">
                                            <div className="text-[11px] font-semibold text-slate-300">
                                                Biến động ròng (Tăng − Giảm)
                                            </div>
                                            <div className="text-sm font-black text-sky-300 font-mono mt-1">
                                                {formatUnitTotalsMap(approvedMovementStats.netByUnit, 'signed')}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                Chênh lệch tồn ròng từ phiếu duyệt
                                            </div>
                                        </div>

                                        <div className="rounded-xl bg-slate-950/70 border border-slate-700/80 px-3.5 py-2.5">
                                            <div className="text-[11px] font-semibold text-slate-300">
                                                Tổng lượt tác động (Đã duyệt)
                                            </div>
                                            <div className="text-sm font-black text-amber-300 font-mono mt-1">
                                                {approvedMovementStats.approvedEntries.length} lượt
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                Chuyển ô: {approvedMovementStats.moveCount} · Gắn STT: {approvedMovementStats.assignCount}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Nội dung chi tiết biến động */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                    {/* Nếu chưa chọn 1 SP cụ thể: hiện bảng tổng hợp theo từng sản phẩm để bấm lọc nhanh */}
                                    {!hasProductFilter && approvedMovementStats.productSummaryList.length > 0 && (
                                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                                            <div className="px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-200">
                                                <span>Tổng hợp theo từng sản phẩm ({approvedMovementStats.productSummaryList.length} SP)</span>
                                                <span className="text-[11px] font-normal text-slate-400">
                                                    Bấm vào 1 sản phẩm để xem chi tiết biến đổi
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs text-left">
                                                    <thead className="bg-slate-900/90 text-slate-400 text-[11px]">
                                                        <tr>
                                                            <th className="px-3.5 py-2 font-semibold">Sản phẩm</th>
                                                            <th className="px-3 py-2 font-semibold text-right text-rose-300">Xuất / Xóa / Giảm</th>
                                                            <th className="px-3 py-2 font-semibold text-right text-emerald-300">Tạo mới / Tăng</th>
                                                            <th className="px-3 py-2 font-semibold text-right text-sky-300">Biến động ròng</th>
                                                            <th className="px-3 py-2 font-semibold text-center">Lượt</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800/80">
                                                        {approvedMovementStats.productSummaryList.map((row, rIdx) => (
                                                            <tr
                                                                key={`${row.sku || row.name}-${rIdx}`}
                                                                onClick={() =>
                                                                    setSelectedProductFilter({
                                                                        name: row.name,
                                                                        sku: row.sku,
                                                                        aliases: row.aliases
                                                                    })
                                                                }
                                                                className="hover:bg-slate-800/60 cursor-pointer transition"
                                                            >
                                                                <td className="px-3.5 py-2.5">
                                                                    <div className="font-semibold text-slate-100">
                                                                        {row.name}
                                                                    </div>
                                                                    {row.actionTags.length > 0 && (
                                                                        <div className="flex flex-wrap items-center gap-1 mt-1">
                                                                            {row.actionTags.map((tag, tIdx) => {
                                                                                const toneClass =
                                                                                    tag.tone === 'rose'
                                                                                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                                                                                        : tag.tone === 'emerald'
                                                                                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                                                                                        : tag.tone === 'amber'
                                                                                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                                                                                        : tag.tone === 'sky'
                                                                                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/35'
                                                                                        : tag.tone === 'purple'
                                                                                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/35'
                                                                                        : 'bg-slate-800 text-slate-300 border-slate-700'
                                                                                return (
                                                                                    <span
                                                                                        key={tIdx}
                                                                                        className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${toneClass}`}
                                                                                    >
                                                                                        {tag.label}
                                                                                    </span>
                                                                                )
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-mono font-bold text-rose-400 whitespace-nowrap">
                                                                    {formatUnitTotalsMap(row.decreased, '-')}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                                                                    {formatUnitTotalsMap(row.increased, '+')}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-mono font-bold text-sky-300 whitespace-nowrap">
                                                                    {formatUnitTotalsMap(row.net, 'signed')}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-center font-mono text-slate-300">
                                                                    {row.count}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Timeline chi tiết từng lần biến đổi */}
                                    <div className="space-y-2.5">
                                        <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                                            <span>
                                                Chi tiết từng lần biến động ({filteredMovementEntries.length} dòng)
                                            </span>
                                        </div>

                                        {filteredMovementEntries.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm">
                                                <Package className="w-8 h-8 mb-2 opacity-40" />
                                                <span>Không có biến động sản phẩm nào trong điều kiện lọc hiện tại.</span>
                                            </div>
                                        ) : (
                                            filteredMovementEntries.map(entry => {
                                                const kindBadge = getMovementKindBadge(
                                                    entry.changeKind,
                                                    entry.delta,
                                                    entry.unit
                                                )
                                                return (
                                                    <div
                                                        key={entry.key}
                                                        className="rounded-xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/40 p-3.5 transition space-y-2"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="inline-flex items-center gap-1 font-semibold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                                                                    <Clock className="w-3 h-3" />
                                                                    {entry.timestamp
                                                                        ? format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm')
                                                                        : '---'}
                                                                </span>
                                                                <span className="font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                                                    {entry.item.position_code}
                                                                    {entry.item.action_type === 'MOVE' &&
                                                                    entry.item.target_position_code
                                                                        ? ` ➔ ${entry.item.target_position_code}`
                                                                        : ''}
                                                                </span>
                                                                <span
                                                                    className={`px-2 py-0.5 rounded border text-[11px] font-bold ${kindBadge.className}`}
                                                                >
                                                                    {kindBadge.label}
                                                                </span>
                                                                {entry.isApproved ? (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                                        ✓ Đã duyệt
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                                        Chưa duyệt
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                {entry.beforeQty !== null && entry.afterQty !== null && (entry.item.action_type === 'SET_QTY' || entry.item.action_type === 'CLEAR') && (
                                                                    <span className="text-xs font-mono text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                                                                        {formatNumberVN(entry.beforeQty)} ➔{' '}
                                                                        <strong className={entry.delta < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                                                            {formatNumberVN(entry.afterQty)} {entry.unit}
                                                                        </strong>
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (onFocusPosition) {
                                                                            onFocusPosition(
                                                                                entry.item.position_id,
                                                                                entry.item.position_code
                                                                            )
                                                                            onClose()
                                                                        }
                                                                    }}
                                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 transition text-[11px] font-semibold border border-slate-700"
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    <span>Soi ô</span>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                                            <div className="font-semibold text-slate-100">
                                                                {entry.productName}
                                                                {entry.sku && (
                                                                    <span className="ml-2 text-[11px] font-mono text-sky-400">
                                                                        ({entry.sku})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                                                {entry.proposal.code && (
                                                                    <span className="font-mono text-slate-300">
                                                                        {entry.proposal.code}
                                                                    </span>
                                                                )}
                                                                <span>
                                                                    Gửi: {entry.proposal.created_by_name || 'NV'}
                                                                    {entry.proposal.approved_by_name
                                                                        ? ` · Duyệt: ${entry.proposal.approved_by_name}`
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {entry.item.note && (
                                                            <div className="text-[11px] text-amber-200 bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                                                💬 {entry.item.note}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : normalizedPosQuery ? (
                            <>
                                <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <Search className="w-4 h-4 text-amber-400" />
                                        <h3 className="text-sm font-bold text-white">
                                            Lịch sử nháp vị trí{' '}
                                            <span className="font-mono text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                                                {positionQuery.trim().toUpperCase()}
                                            </span>
                                        </h3>
                                        <span className="text-xs text-slate-400">
                                            ({positionHistoryEntries.length} lần nháp)
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setPositionQuery('')}
                                        className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700"
                                    >
                                        Xóa lọc vị trí
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                    {positionHistoryEntries.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-sm">
                                            <Search className="w-8 h-8 mb-2 opacity-40" />
                                            <span>Không có lần nháp nào khớp vị trí &quot;{positionQuery.trim()}&quot; trong mục đang lọc.</span>
                                        </div>
                                    ) : (
                                        positionHistoryEntries.map((entry, listIdx) =>
                                            renderItemCard(entry.proposal, entry.item, entry.itemIndex, listIdx, true)
                                        )
                                    )}
                                </div>
                            </>
                        ) : selectedProposal ? (
                            <>
                                {/* Proposal meta bar */}
                                <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-base font-bold text-white">
                                                    {selectedProposal.title}
                                                </h3>
                                                {selectedProposal.code && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 font-mono">
                                                        {selectedProposal.code}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                                <span className="flex items-center gap-1.5">
                                                    <User className="w-3.5 h-3.5 text-blue-400" />
                                                    Người gửi: <strong className="text-slate-200">{selectedProposal.created_by_name || 'Nhân viên'}</strong>
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                                    {selectedProposal.created_at
                                                        ? format(new Date(selectedProposal.created_at), 'dd/MM/yyyy HH:mm:ss')
                                                        : ''}
                                                </span>
                                            </div>

                                            {selectedProposal.notes && (
                                                <div className="mt-2 text-xs bg-amber-950/40 border border-amber-800/50 text-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                    <span className="font-semibold text-amber-400">Ghi chú ca:</span>
                                                    <span>{selectedProposal.notes}</span>
                                                </div>
                                            )}

                                            {selectedProposal.status === 'APPROVED' && selectedProposal.approved_at && (
                                                <div className="mt-2 text-xs bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                    <span>
                                                        Đã duyệt bởi <strong>{selectedProposal.approved_by_name || 'Quản lý'}</strong> lúc {format(new Date(selectedProposal.approved_at), 'dd/MM/yyyy HH:mm')}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="text-right flex flex-col items-end gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400">Tổng điều chỉnh:</span>
                                                <span className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-300 font-bold text-xs border border-blue-500/30">
                                                    {selectedProposal.items.length} vị trí
                                                </span>
                                            </div>

                                            {/* Nút Kích Hoạt Chế Độ Duyệt Trực Quan Trên Bản Đồ */}
                                            {selectedProposal.status === 'PENDING' && onStartVisualReview && (
                                                <button
                                                    onClick={() => {
                                                        onStartVisualReview(selectedProposal, 0)
                                                        onClose()
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs shadow-md shadow-amber-950 transition hover:scale-105 active:scale-95 border border-amber-400"
                                                    title="Mở sơ đồ kho, làm nổi bật các ô và duyệt trực tiếp trên bản đồ"
                                                >
                                                    <span>🗺️ Soi & Duyệt trên Bản Đồ</span>
                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* List of items */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                                    {selectedProposal.items.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-44 text-slate-500 text-sm">
                                            <FileText className="w-8 h-8 mb-2 opacity-50" />
                                            <span>Phiếu này không có dữ liệu vị trí chi tiết.</span>
                                        </div>
                                    ) : (
                                        selectedProposal.items.map((it, idx) =>
                                            renderItemCard(selectedProposal, it, idx, idx, false)
                                        )
                                    )}
                                </div>

                                {/* Footer actions */}
                                {selectedProposal.status === 'PENDING' && (
                                    <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-4">
                                        <div className="flex-1 max-w-md">
                                            <input
                                                type="text"
                                                value={reviewNotes}
                                                onChange={e => setReviewNotes(e.target.value)}
                                                placeholder="Ghi chú phản hồi của người duyệt (tùy chọn)..."
                                                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                            />
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={handleReject}
                                                disabled={isRejecting || isApproving}
                                                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 border border-rose-800/60 transition disabled:opacity-50 flex items-center gap-1.5"
                                            >
                                                {isRejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                <span>Từ chối</span>
                                            </button>

                                            <button
                                                onClick={handleApprove}
                                                disabled={isApproving || isRejecting}
                                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 active:scale-95 transition shadow-lg shadow-emerald-950/50 flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {isApproving ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        <span>Đang cập nhật sơ đồ...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        <span>DUYỆT & CẬP NHẬT VÀO SƠ ĐỒ</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                                <Layers className="w-12 h-12 text-slate-700 mb-2" />
                                <span>Chọn một phiếu đề xuất ở danh sách bên trái để xem</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
    )

    if (isPage) {
        return content
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-1.5">
            {content}
        </div>
    )
}
