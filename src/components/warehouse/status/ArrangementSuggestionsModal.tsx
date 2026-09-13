'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
    X,
    Sparkles,
    Search,
    Package,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Warehouse,
    Filter,
    MoveRight,
    Loader2,
    Layers,
    ChevronDown,
    ExternalLink,
    Settings,
    Printer,
    Copy,
    Check,
    Truck,
    Box,
    RotateCcw,
    Edit3,
    ArrowUpRight,
    ClipboardList,
    Building2,
    SlidersHorizontal,
    ToggleLeft,
    ToggleRight,
    HelpCircle
} from 'lucide-react'
import { FloorSuggestion, CandidateLot, PositionWithZone } from '@/lib/warehouseArrangement'
import { getProductColorStyle } from '@/lib/warehouseUtils'
import {
    PalletConfig,
    getStoredPalletConfig,
    saveStoredPalletConfig,
    resolvePalletQuantity,
    DEFAULT_PALLET_CONFIG,
    ResolvedPalletInfo
} from '@/lib/warehousePalletConfig'

interface ArrangementSuggestionsModalProps {
    suggestions: FloorSuggestion[]
    warehouses: Array<{ id: string, name: string }>
    displayInternalInfo?: boolean
    onClose: () => void
    onMoveLot: (lotId: string, fromPosId: string, toPosId: string, lotCode: string, targetPosCode: string) => Promise<boolean>
    onSelectZone?: (binId: string) => void
}

interface ProductSummaryGroup {
    productKey: string
    productId: string
    productName: string
    sku: string
    internalCode?: string
    internalName?: string
    productColor?: string | null
    unit: string
    palletUnit: string
    qtyPerPallet: number
    palletSource: 'inferred' | 'manual_product' | 'manual_global' | 'db' | 'default'
    palletSourceLabel: string
    inferredSampleCount: number
    emptyPositionsCount: number // = pallets needed
    totalCartonsNeeded: number
    dominantOccupiedCount: number
    targetPositions: Array<{
        posId: string
        posCode: string
        binName: string
        levelName: string
        floorNumber: number
        warehouseName: string
    }>
    hallCandidateLots: CandidateLot[]
    otherCandidateLots: CandidateLot[]
    totalAvailableLotsCount: number
    status: 'sufficient' | 'partial' | 'none'
}

export function ArrangementSuggestionsModal({
    suggestions,
    warehouses,
    displayInternalInfo = false,
    onClose,
    onMoveLot,
    onSelectZone
}: ArrangementSuggestionsModalProps) {
    // Mode: 'details' (Danh sách ô tầng) | 'summary' (Thống kê tổng xe nâng)
    const [viewMode, setViewMode] = useState<'details' | 'summary'>('details')
    
    // Warehouse Filter
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all')
    
    // Floor Filter: true = chỉ tính từ tầng 2 trở lên (dành cho xe nâng), false = tất cả các tầng
    const [onlyFloor2Plus, setOnlyFloor2Plus] = useState<boolean>(true)
    
    // Detail View Filters
    const [searchTerm, setSearchTerm] = useState('')
    const [filterType, setFilterType] = useState<'all' | 'hall' | 'ready'>('all')

    // Pallet Configuration State
    const [palletConfig, setPalletConfig] = useState<PalletConfig>(DEFAULT_PALLET_CONFIG)
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
    const [tempUseManual, setTempUseManual] = useState<boolean>(false)
    const [tempDefaultQty, setTempDefaultQty] = useState<number>(24)
    const [tempOverrides, setTempOverrides] = useState<Record<string, number>>({})
    const [configSearchTerm, setConfigSearchTerm] = useState('')

    // Inline edit for quantity per pallet in summary table
    const [editingProductKey, setEditingProductKey] = useState<string | null>(null)
    const [inlineEditValue, setInlineEditValue] = useState<string>('')

    // Feedback states
    const [copiedSummary, setCopiedSummary] = useState(false)
    const [expandedProductCards, setExpandedProductCards] = useState<Set<string>>(new Set())

    // Confirm state for moving
    const [confirmingMove, setConfirmingMove] = useState<{
        lot: CandidateLot
        targetPos: PositionWithZone
        suggestion: FloorSuggestion
    } | null>(null)
    const [isMoving, setIsMoving] = useState(false)

    // Expanded candidate cards in details view
    const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

    // Load pallet config on mount
    useEffect(() => {
        const cfg = getStoredPalletConfig()
        setPalletConfig(cfg)
        setTempUseManual(cfg.useManualOverride)
        setTempDefaultQty(cfg.defaultQuantityPerPallet)
        setTempOverrides(cfg.overrides || {})
    }, [])

    const toggleExpandCard = (key: string) => {
        setExpandedCards(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const toggleExpandProduct = (key: string) => {
        setExpandedProductCards(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // 1. Lọc suggestions theo Kho và Chế độ Tầng
    const floorFilteredSuggestions = useMemo(() => {
        return suggestions.filter(s => {
            // Filter by Warehouse
            if (selectedWarehouseId !== 'all') {
                if (s.warehouseId && s.warehouseId !== selectedWarehouseId) return false
            }
            // Filter by Floor: Chỉ tính từ tầng 2 trở lên
            if (onlyFloor2Plus && s.floorNumber < 2) {
                return false
            }
            return true
        })
    }, [suggestions, selectedWarehouseId, onlyFloor2Plus])

    // 2. Suggestions cho chế độ xem Chi tiết (áp dụng thêm search và tab filter)
    const filteredSuggestions = useMemo(() => {
        return floorFilteredSuggestions.filter(s => {
            // Filter by type
            if (filterType === 'hall') {
                const hasHallCandidate = s.candidateLots.some(c => c.isHall)
                if (!hasHallCandidate) return false
            } else if (filterType === 'ready') {
                if (s.candidateLots.length === 0) return false
            }

            // Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase()
                const matchBin = s.binName.toLowerCase().includes(term) || (s.binCode || '').toLowerCase().includes(term)
                const matchLevel = s.levelName.toLowerCase().includes(term)
                const matchProdName = s.dominantProduct.productName.toLowerCase().includes(term)
                const matchSku = s.dominantProduct.sku.toLowerCase().includes(term)
                const matchInternalCode = (s.dominantProduct.internalCode || '').toLowerCase().includes(term)
                const matchInternalName = (s.dominantProduct.internalName || '').toLowerCase().includes(term)
                const matchPos = s.emptyPositions.some(p => p.code.toLowerCase().includes(term))

                if (!matchBin && !matchLevel && !matchProdName && !matchSku && !matchInternalCode && !matchInternalName && !matchPos) {
                    return false
                }
            }

            return true
        })
    }, [floorFilteredSuggestions, filterType, searchTerm])

    // 3. Tính toán BẢNG THỐNG KÊ TỔNG CHO XE NÂNG (nhóm theo sản phẩm và suy luận thông minh)
    const summaryByProduct = useMemo<ProductSummaryGroup[]>(() => {
        interface GroupAccumulator {
            group: ProductSummaryGroup
            inferredList: number[]
            candidateQuantities: number[]
            totalSamples: number
            dbQty?: number | null
        }
        const groups = new Map<string, GroupAccumulator>()

        floorFilteredSuggestions.forEach(s => {
            const prod = s.dominantProduct
            const prodKey = prod.productId || prod.sku

            let entry = groups.get(prodKey)
            if (!entry) {
                const initGroup: ProductSummaryGroup = {
                    productKey: prodKey,
                    productId: prod.productId,
                    productName: prod.productName,
                    sku: prod.sku,
                    internalCode: prod.internalCode,
                    internalName: prod.internalName,
                    productColor: prod.productColor,
                    unit: prod.unit || 'thùng',
                    palletUnit: prod.palletUnit || 'pallet',
                    qtyPerPallet: 24,
                    palletSource: 'default',
                    palletSourceLabel: '',
                    inferredSampleCount: 0,
                    emptyPositionsCount: 0,
                    totalCartonsNeeded: 0,
                    dominantOccupiedCount: 0,
                    targetPositions: [],
                    hallCandidateLots: [],
                    otherCandidateLots: [],
                    totalAvailableLotsCount: 0,
                    status: 'none'
                }
                entry = {
                    group: initGroup,
                    inferredList: [],
                    candidateQuantities: [],
                    totalSamples: 0,
                    dbQty: prod.quantityPerPallet
                }
                groups.set(prodKey, entry)
            }

            // Thu thập quy cách suy luận từ các vị trí thực tế của tầng này
            const infQty = Number(prod.inferredQuantityPerPallet)
            if (!isNaN(infQty) && infQty > 0) {
                entry.inferredList.push(Math.round(infQty))
                entry.totalSamples += (Number(prod.inferredSampleCount) || 1)
            }

            // Cộng dồn số vị trí trống (chính là số pallet cần đưa vào kệ)
            entry.group.emptyPositionsCount += s.emptyCount
            entry.group.dominantOccupiedCount += prod.occupiedPositionsCount

            // Thu thập các vị trí đích
            s.emptyPositions.forEach(p => {
                entry!.group.targetPositions.push({
                    posId: p.id,
                    posCode: p.code,
                    binName: s.binName,
                    levelName: s.levelName,
                    floorNumber: s.floorNumber,
                    warehouseName: s.warehouseName
                })
            })

            // Thu thập các lô ứng viên (tránh trùng lặp theo lotId)
            s.candidateLots.forEach(c => {
                const cNum = Number(c.quantity)
                if (!isNaN(cNum) && cNum > 0) {
                    entry!.candidateQuantities.push(Math.round(cNum))
                }

                const alreadyHall = entry!.group.hallCandidateLots.some(x => x.lotId === c.lotId)
                const alreadyOther = entry!.group.otherCandidateLots.some(x => x.lotId === c.lotId)

                if (!alreadyHall && !alreadyOther) {
                    if (c.isHall) {
                        entry!.group.hallCandidateLots.push(c)
                    } else {
                        entry!.group.otherCandidateLots.push(c)
                    }
                }
            })
        })

        // Hoàn tất tính toán quy cách thông minh và số lượng thùng
        const result: ProductSummaryGroup[] = Array.from(groups.values()).map(({ group, inferredList, candidateQuantities, totalSamples, dbQty }) => {
            // Tìm số lượng suy luận phổ biến nhất từ các vị trí thực tế trên kệ
            let bestInferred: number | null = null
            const sampleList = inferredList.length > 0 ? inferredList : candidateQuantities
            if (sampleList.length > 0) {
                const freq = new Map<number, number>()
                let maxF = 0
                bestInferred = sampleList[0]
                sampleList.forEach(q => {
                    const c = (freq.get(q) || 0) + 1
                    freq.set(q, c)
                    if (c > maxF) {
                        maxF = c
                        bestInferred = q
                    }
                })
            }

            const palletResult: ResolvedPalletInfo = resolvePalletQuantity(
                group.productId,
                group.sku,
                bestInferred,
                dbQty,
                palletConfig
            )

            const totalCartons = group.emptyPositionsCount * palletResult.quantity
            const hallCount = group.hallCandidateLots.length

            let status: 'sufficient' | 'partial' | 'none' = 'none'
            if (hallCount >= group.emptyPositionsCount) {
                status = 'sufficient'
            } else if (hallCount > 0) {
                status = 'partial'
            }

            return {
                ...group,
                qtyPerPallet: palletResult.quantity,
                palletSource: palletResult.source,
                palletSourceLabel: palletResult.sourceLabel,
                inferredSampleCount: totalSamples,
                totalCartonsNeeded: totalCartons,
                totalAvailableLotsCount: hallCount + group.otherCandidateLots.length,
                status
            }
        })

        // Sắp xếp: Ưu tiên loại hàng cần nhiều pallet nhất lên đầu
        return result.sort((a, b) => b.emptyPositionsCount - a.emptyPositionsCount)
    }, [floorFilteredSuggestions, palletConfig])

    // KPI tổng hợp cho chế độ Thống kê tổng
    const totalPalletsNeeded = useMemo(() => {
        return summaryByProduct.reduce((sum, g) => sum + g.emptyPositionsCount, 0)
    }, [summaryByProduct])

    const totalCartonsNeeded = useMemo(() => {
        return summaryByProduct.reduce((sum, g) => sum + g.totalCartonsNeeded, 0)
    }, [summaryByProduct])

    const totalHallPalletsAvailable = useMemo(() => {
        return summaryByProduct.reduce((sum, g) => sum + g.hallCandidateLots.length, 0)
    }, [summaryByProduct])

    const totalFillableImmediately = useMemo(() => {
        return summaryByProduct.reduce((sum, g) => sum + Math.min(g.emptyPositionsCount, g.hallCandidateLots.length), 0)
    }, [summaryByProduct])

    // Summary counts for details view
    const totalFillablePositions = useMemo(() => {
        return floorFilteredSuggestions.reduce((sum, s) => sum + (s.candidateLots.length > 0 ? Math.min(s.emptyCount, s.candidateLots.length) : 0), 0)
    }, [floorFilteredSuggestions])

    const hallCandidateCount = useMemo(() => {
        let count = 0
        floorFilteredSuggestions.forEach(s => {
            count += s.candidateLots.filter(c => c.isHall).length
        })
        return count
    }, [floorFilteredSuggestions])

    // Tên kho hiện tại đang chọn
    const currentWarehouseName = useMemo(() => {
        if (selectedWarehouseId === 'all') return 'Tất cả các kho'
        const w = warehouses.find(x => x.id === selectedWarehouseId)
        return w ? w.name : 'Kho đã chọn'
    }, [selectedWarehouseId, warehouses])

    // Xử lý xác nhận chuyển vị trí
    const handleConfirmMove = async () => {
        if (!confirmingMove) return
        setIsMoving(true)
        try {
            const success = await onMoveLot(
                confirmingMove.lot.lotId,
                confirmingMove.lot.currentPositionId,
                confirmingMove.targetPos.id,
                confirmingMove.lot.lotCode,
                confirmingMove.targetPos.code
            )
            if (success) {
                setConfirmingMove(null)
            }
        } finally {
            setIsMoving(false)
        }
    }

    // Xử lý lưu quy cách Pallet nhanh (Inline Edit)
    const handleSaveInlineEdit = (productKey: string) => {
        const val = parseInt(inlineEditValue, 10)
        if (isNaN(val) || val <= 0) {
            setEditingProductKey(null)
            return
        }

        const newOverrides = {
            ...palletConfig.overrides,
            [productKey]: val
        }
        const newConfig: PalletConfig = {
            ...palletConfig,
            useManualOverride: true, // Khi người dùng chỉnh tay, tự động kích hoạt chế độ ghi đè cho mục này
            overrides: newOverrides
        }

        setPalletConfig(newConfig)
        saveStoredPalletConfig(newConfig)
        setEditingProductKey(null)
    }

    // Xử lý lưu toàn bộ cấu hình từ Modal Cài Đặt
    const handleSaveConfigModal = () => {
        const newConfig: PalletConfig = {
            useManualOverride: tempUseManual,
            defaultQuantityPerPallet: tempDefaultQty > 0 ? tempDefaultQty : DEFAULT_PALLET_CONFIG.defaultQuantityPerPallet,
            overrides: tempOverrides
        }
        setPalletConfig(newConfig)
        saveStoredPalletConfig(newConfig)
        setIsConfigModalOpen(false)
    }

    // Khôi phục mặc định (về chế độ tự động thông minh)
    const handleResetConfig = () => {
        setTempUseManual(false)
        setTempDefaultQty(DEFAULT_PALLET_CONFIG.defaultQuantityPerPallet)
        setTempOverrides({})
    }

    // Sao chép tóm tắt cho xe nâng
    const handleCopySummary = () => {
        if (summaryByProduct.length === 0) return

        let text = `📋 LỆNH CÔNG VIỆC XE NÂNG - ${currentWarehouseName.toUpperCase()}\n`
        text += `Phạm vi: ${onlyFloor2Plus ? 'Chỉ từ tầng 2 trở lên' : 'Tất cả các tầng'}\n`
        text += `Tổng cộng: ${totalPalletsNeeded} Pallet (~${totalCartonsNeeded.toLocaleString()} thùng) | Sẵn sàng ở Sảnh: ${totalHallPalletsAvailable} Pallet\n`
        text += `--------------------------------------------------\n`

        summaryByProduct.forEach((g, idx) => {
            const prodName = displayInternalInfo && g.internalName ? g.internalName : g.productName
            const prodCode = displayInternalInfo && g.internalCode ? g.internalCode : g.sku
            const statusText = g.status === 'sufficient'
                ? 'ĐỦ HÀNG Ở SẢNH'
                : g.status === 'partial'
                ? `CÓ ${g.hallCandidateLots.length}/${g.emptyPositionsCount} PALLET Ở SẢNH`
                : 'CHƯA CÓ HÀNG Ở SẢNH'

            text += `\n${idx + 1}. [${prodCode}] ${prodName}\n`
            text += `   - Cần đưa vào: ${g.emptyPositionsCount} Pallet (~${g.totalCartonsNeeded.toLocaleString()} thùng, quy cách: ${g.qtyPerPallet} thùng/pallet ${g.palletSource === 'inferred' ? '[tự động từ kệ]' : ''})\n`
            text += `   - Trạng thái sảnh: [${statusText}]\n`

            if (g.hallCandidateLots.length > 0) {
                text += `   - Pallet lấy tại Sảnh: ${g.hallCandidateLots.map(l => `${l.lotCode} (${l.currentLocationName})`).join(', ')}\n`
            }
            text += `   - Vị trí đích cần nâng lên: ${g.targetPositions.map(p => p.posCode).join(', ')}\n`
        })

        navigator.clipboard.writeText(text)
        setCopiedSummary(true)
        setTimeout(() => setCopiedSummary(false), 2500)
    }

    // In phiếu xe nâng
    const handlePrintSummary = () => {
        window.print()
    }

    // Lọc danh sách sản phẩm trong modal cài đặt
    const distinctProductsForConfig = useMemo(() => {
        const map = new Map<string, { key: string, name: string, sku: string, internalName?: string, unit: string }>()
        suggestions.forEach(s => {
            const p = s.dominantProduct
            const key = p.productId || p.sku
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: p.productName,
                    sku: p.sku,
                    internalName: p.internalName,
                    unit: p.unit || 'thùng'
                })
            }
        })
        const list = Array.from(map.values())
        if (!configSearchTerm.trim()) return list
        const term = configSearchTerm.toLowerCase()
        return list.filter(p =>
            p.name.toLowerCase().includes(term) ||
            p.sku.toLowerCase().includes(term) ||
            (p.internalName || '').toLowerCase().includes(term)
        )
    }, [suggestions, configSearchTerm])

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200 print:p-0 print:m-0 print:block">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm print:hidden" onClick={onClose}></div>

            {/* Main Modal Container */}
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[94vh] overflow-hidden border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-6 print:border-none print:shadow-none print:max-h-none print:w-full print:rounded-none">
                
                {/* Header */}
                <div className="p-4 sm:p-5 md:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-gradient-to-r from-indigo-50/70 via-white to-amber-50/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-850 print:bg-none print:border-b-2 print:border-black">
                    <div className="flex items-start gap-3.5">
                        <div className="p-3 bg-gradient-to-br from-amber-500 to-indigo-600 rounded-xl text-white shadow-md shadow-indigo-200 dark:shadow-none shrink-0 print:hidden">
                            <Sparkles size={22} className="animate-pulse" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                    GỢI Ý SẮP XẾP & ĐIỀU PHỐI XE NÂNG
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                    {floorFilteredSuggestions.length} ô-tầng thiếu hàng
                                </span>
                                {onlyFloor2Plus && (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60 flex items-center gap-1">
                                        <Truck size={12} />
                                        Chỉ tầng ≥ 2 (Xe nâng)
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed print:text-black">
                                Tổng hợp vị trí còn thiếu trên kệ và gợi ý lô hàng cùng loại từ Sảnh để xe nâng đưa lên, đảm bảo quy chuẩn 1 ô 1 loại hàng.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 print:hidden">
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                            title="Đóng modal"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* View Mode Tabs & Main Controls */}
                <div className="px-4 sm:px-6 pt-3 pb-2 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
                    {/* View Switcher: Details vs Summary */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('summary')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${
                                viewMode === 'summary'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Truck size={15} />
                            <span>THỐNG KÊ TỔNG XE NÂNG</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                {totalPalletsNeeded} pallet
                            </span>
                        </button>

                        <button
                            onClick={() => setViewMode('details')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${
                                viewMode === 'details'
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            <Layers size={15} />
                            <span>CHI TIẾT TỪNG TẦNG</span>
                            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200">
                                {floorFilteredSuggestions.length}
                            </span>
                        </button>
                    </div>

                    {/* Floor Mode & Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Toggle Chỉ tính từ tầng 2 trở lên */}
                        <button
                            onClick={() => setOnlyFloor2Plus(!onlyFloor2Plus)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all border shadow-2xs ${
                                onlyFloor2Plus
                                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                            }`}
                            title="Xe nâng chuyên trách đưa hàng lên tầng cao (từ tầng 2 trở lên)"
                        >
                            <Truck size={14} className={onlyFloor2Plus ? 'animate-bounce' : ''} />
                            <span>{onlyFloor2Plus ? 'Chỉ tầng ≥ 2 (Xe nâng)' : 'Tất cả các tầng'}</span>
                        </button>

                        {/* Nút Cài đặt quy cách Pallet (Kèm trạng thái Tự động hay Thủ công) */}
                        <button
                            onClick={() => {
                                setTempUseManual(palletConfig.useManualOverride)
                                setTempDefaultQty(palletConfig.defaultQuantityPerPallet)
                                setTempOverrides({ ...palletConfig.overrides })
                                setIsConfigModalOpen(true)
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                                palletConfig.useManualOverride
                                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                            }`}
                            title="Quản lý quy cách Pallet: Tự động suy ra từ các vị trí hoặc cài đặt thủ công"
                        >
                            <Settings size={14} />
                            <span>Quy cách Pallet</span>
                            {palletConfig.useManualOverride ? (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                                    Thủ công
                                </span>
                            ) : (
                                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 flex items-center gap-0.5">
                                    <Sparkles size={9} />
                                    Tự động
                                </span>
                            )}
                        </button>

                        {/* Nút In phiếu xe nâng */}
                        <button
                            onClick={handlePrintSummary}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
                            title="In bảng thống kê điều phối xe nâng"
                        >
                            <Printer size={14} />
                            <span>In phiếu</span>
                        </button>

                        {/* Nút Copy tóm tắt */}
                        <button
                            onClick={handleCopySummary}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors"
                            title="Sao chép nội dung tóm tắt để gửi Zalo cho xe nâng"
                        >
                            {copiedSummary ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            <span>{copiedSummary ? 'Đã sao chép!' : 'Sao chép lệnh'}</span>
                        </button>
                    </div>
                </div>

                {/* Sub-toolbar (Warehouse filter + Search + Type tabs) */}
                <div className="p-3 sm:px-6 bg-slate-50/90 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Warehouse selector */}
                        {warehouses.length > 1 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-500">Kho:</span>
                                <select
                                    value={selectedWarehouseId}
                                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                                    className="px-3 py-1.5 text-xs font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="all">Tất cả kho ({suggestions.length} cơ hội)</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Filter tabs (Only in Details mode) */}
                        {viewMode === 'details' && (
                            <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`px-2.5 py-1 rounded-md transition-all ${
                                        filterType === 'all'
                                            ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Tất cả ({floorFilteredSuggestions.length})
                                </button>
                                <button
                                    onClick={() => setFilterType('hall')}
                                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
                                        filterType === 'hall'
                                            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                    Có hàng ở Sảnh ({hallCandidateCount})
                                </button>
                                <button
                                    onClick={() => setFilterType('ready')}
                                    className={`px-2.5 py-1 rounded-md transition-all ${
                                        filterType === 'ready'
                                            ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                                    }`}
                                >
                                    Sẵn sàng lấp đầy
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Search Bar */}
                    <div className="relative min-w-[240px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm ô, vị trí, tên sản phẩm, SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Print Title (Only visible when printing) */}
                <div className="hidden print:block p-6 border-b border-black">
                    <h1 className="text-xl font-black uppercase">
                        BẢNG ĐIỀU PHỐI PALLET CHO XE NÂNG - {currentWarehouseName.toUpperCase()}
                    </h1>
                    <div className="text-sm mt-1">
                        Phạm vi: <strong>{onlyFloor2Plus ? 'Chỉ tính tầng 2 trở lên' : 'Tất cả các tầng'}</strong> | Tổng cộng: <strong>{totalPalletsNeeded} Pallet</strong> (~{totalCartonsNeeded.toLocaleString()} thùng) | Sảnh sẵn sàng: <strong>{totalHallPalletsAvailable} Pallet</strong>
                    </div>
                </div>

                {/* ─── BODY CONTENT ─── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 bg-slate-50/40 dark:bg-slate-900/40 print:bg-white print:p-0 print:overflow-visible">
                    
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {/* CHẾ ĐỘ 1: THỐNG KÊ TỔNG CHO XE NÂNG (FORKLIFT SUMMARY)          */}
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {viewMode === 'summary' && (
                        <div className="space-y-4">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4">
                                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/60 dark:from-indigo-950/30 dark:to-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                                    <div className="text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight flex items-center gap-1.5">
                                        <Truck size={14} />
                                        <span>Pallet Cần Đưa Lên Kệ</span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-2xl sm:text-3xl font-black text-indigo-900 dark:text-indigo-100">
                                            {totalPalletsNeeded}
                                        </span>
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300">
                                            pallet (vị trí)
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                                        Tại {currentWarehouseName} ({onlyFloor2Plus ? 'tầng ≥ 2' : 'mọi tầng'})
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200/80 dark:border-blue-800/60 shadow-2xs">
                                    <div className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-tight flex items-center gap-1.5">
                                        <Box size={14} />
                                        <span>Tổng Thùng Quy Đổi</span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-2xl sm:text-3xl font-black text-blue-900 dark:text-blue-100">
                                            {totalCartonsNeeded.toLocaleString()}
                                        </span>
                                        <span className="text-xs font-bold text-blue-600 dark:text-blue-300">
                                            thùng
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 font-medium flex items-center gap-1">
                                        <span>Tự động suy luận từ các vị trí kệ</span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-950/30 dark:to-amber-900/20 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
                                    <div className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tight flex items-center gap-1.5">
                                        <Building2 size={14} />
                                        <span>Pallet Sẵn Có Ở Sảnh</span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-2xl sm:text-3xl font-black text-amber-900 dark:text-amber-100">
                                            {totalHallPalletsAvailable}
                                        </span>
                                        <span className="text-xs font-bold text-amber-600 dark:text-amber-300">
                                            pallet
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                                        Sẵn sàng nâng ngay: <strong className="text-emerald-600 font-bold">{totalFillableImmediately}</strong> pallet
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/30 dark:to-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
                                    <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-tight flex items-center gap-1.5">
                                        <Package size={14} />
                                        <span>Số Loại Hàng Cần Nâng</span>
                                    </div>
                                    <div className="mt-2 flex items-baseline gap-1.5">
                                        <span className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-100">
                                            {summaryByProduct.length}
                                        </span>
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-300">
                                            mặt hàng
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                                        Quy chuẩn 1 ô 1 loại sản phẩm
                                    </div>
                                </div>
                            </div>

                            {/* Summary Product List */}
                            {summaryByProduct.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl text-emerald-600 mb-2">
                                        <CheckCircle2 size={36} />
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        Không có vị trí nào cần đưa pallet lên!
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                        {onlyFloor2Plus
                                            ? 'Tất cả các kệ từ tầng 2 trở lên của kho này đều đã được lấp đầy hoặc không có vị trí trống.'
                                            : 'Tất cả các vị trí trong kho đều đã được lấp đầy đồng nhất.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                                        <span>BẢNG TỔNG HỢP CẦN NÂNG CHO TỪNG LOẠI HÀNG ({summaryByProduct.length})</span>
                                        <span className="italic text-[11px] text-slate-400 print:hidden">
                                            💡 Hệ thống tự động suy ra quy cách từ số lượng thực tế của các pallet đã có trên kệ
                                        </span>
                                    </div>

                                    {summaryByProduct.map((group) => {
                                        const isExpanded = expandedProductCards.has(group.productKey)
                                        const colorStyle = getProductColorStyle(group.productColor)
                                        const displayProdName = displayInternalInfo && group.internalName ? group.internalName : group.productName
                                        const displayProdCode = displayInternalInfo && group.internalCode ? group.internalCode : group.sku
                                        const isEditing = editingProductKey === group.productKey

                                        return (
                                            <div
                                                key={group.productKey}
                                                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs overflow-hidden transition-all print:border-black print:shadow-none"
                                            >
                                                {/* Header row of Product Summary Card */}
                                                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/50">
                                                    <div className="flex items-start sm:items-center gap-3">
                                                        {/* Color pill indicator */}
                                                        <div
                                                            className="w-3.5 h-12 sm:h-10 rounded-md shrink-0 border border-black/10 shadow-2xs"
                                                            style={colorStyle}
                                                            title={displayProdName}
                                                        />

                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[11px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded shadow-2xs font-mono">
                                                                    {displayProdCode}
                                                                </span>
                                                                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                                                                    {displayProdName}
                                                                </h3>

                                                                {/* Status Badge */}
                                                                {group.status === 'sufficient' ? (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300/60 flex items-center gap-1">
                                                                        <CheckCircle2 size={11} />
                                                                        Đủ hàng ở Sảnh ({group.hallCandidateLots.length}/{group.emptyPositionsCount})
                                                                    </span>
                                                                ) : group.status === 'partial' ? (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60 flex items-center gap-1">
                                                                        <AlertCircle size={11} />
                                                                        Có {group.hallCandidateLots.length}/{group.emptyPositionsCount} pallet ở Sảnh
                                                                    </span>
                                                                ) : (
                                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                                                                        Chưa có hàng ở Sảnh
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                                                                <span>Hiện có trên kệ: <strong className="text-slate-700 dark:text-slate-300 font-bold">{group.dominantOccupiedCount} vị trí</strong></span>
                                                                <span>•</span>
                                                                <span>Cần đưa vào thêm: <strong className="text-indigo-600 dark:text-indigo-400 font-black">{group.emptyPositionsCount} vị trí ({group.emptyPositionsCount} Pallet)</strong></span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Packaging & Quantities Stats */}
                                                    <div className="flex flex-wrap items-center gap-4 self-start lg:self-center">
                                                        {/* Pallet packaging config */}
                                                        <div className="flex flex-col items-start lg:items-end">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                                Quy Cách Pallet
                                                            </div>
                                                            {isEditing ? (
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={inlineEditValue}
                                                                        onChange={(e) => setInlineEditValue(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleSaveInlineEdit(group.productKey)
                                                                            if (e.key === 'Escape') setEditingProductKey(null)
                                                                        }}
                                                                        autoFocus
                                                                        className="w-16 px-1.5 py-0.5 text-xs font-black border border-indigo-500 rounded bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center"
                                                                    />
                                                                    <button
                                                                        onClick={() => handleSaveInlineEdit(group.productKey)}
                                                                        className="p-1 text-white bg-emerald-600 hover:bg-emerald-700 rounded"
                                                                    >
                                                                        <Check size={12} />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingProductKey(group.productKey)
                                                                            setInlineEditValue(String(group.qtyPerPallet))
                                                                        }}
                                                                        className="group/btn flex items-center gap-1 text-xs font-black text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                                        title="Nhấp để sửa nhanh quy cách"
                                                                    >
                                                                        <span>{group.qtyPerPallet} {group.unit}/pallet</span>
                                                                        <Edit3 size={11} className="opacity-0 group-hover/btn:opacity-100 transition-opacity text-slate-400" />
                                                                    </button>

                                                                    {/* Badge nguồn quy cách */}
                                                                    {group.palletSource === 'inferred' && (
                                                                        <span
                                                                            className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-0.5"
                                                                            title={`Tự động tính từ ${group.inferredSampleCount} vị trí đang có hàng trên kệ`}
                                                                        >
                                                                            <Sparkles size={9} className="text-emerald-500" />
                                                                            Tự động ({group.inferredSampleCount} vị trí)
                                                                        </span>
                                                                    )}
                                                                    {group.palletSource === 'manual_product' && (
                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                            Thủ công
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Total Cartons Needed */}
                                                        <div className="flex flex-col items-start lg:items-end pl-3 border-l border-slate-200 dark:border-slate-700">
                                                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                                Tổng Số Lượng
                                                            </div>
                                                            <div className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                                                                {group.totalCartonsNeeded.toLocaleString()} {group.unit}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                ({group.emptyPositionsCount} pallet)
                                                            </div>
                                                        </div>

                                                        {/* Expand Button */}
                                                        <button
                                                            onClick={() => toggleExpandProduct(group.productKey)}
                                                            className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 print:hidden"
                                                        >
                                                            <span>{isExpanded ? 'Ẩn vị trí' : 'Xem vị trí & lô'}</span>
                                                            <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Expanded Details: Rack target positions + Candidate Lots */}
                                                {(isExpanded || false) && (
                                                    <div className="p-4 border-t border-slate-100 dark:border-slate-700/60 bg-white dark:bg-slate-850 space-y-4">
                                                        {/* Target Positions on Rack */}
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                                <Truck size={12} className="text-indigo-600" />
                                                                <span>CÁC VỊ TRÍ ĐÍCH TRÊN KỆ CẦN XE NÂNG ĐƯA VÀO ({group.targetPositions.length})</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {group.targetPositions.map((pos) => (
                                                                    <div
                                                                        key={pos.posId}
                                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs font-mono font-black text-indigo-700 dark:text-indigo-300"
                                                                    >
                                                                        <span>{pos.posCode}</span>
                                                                        <span className="text-[9px] font-sans font-bold text-slate-400">
                                                                            ({pos.binName} - {pos.levelName})
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Source Candidate Lots at Hall */}
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                                                <span className="flex items-center gap-1.5">
                                                                    <Building2 size={12} className="text-amber-500" />
                                                                    <span>LÔ HÀNG CÙNG LOẠI Ở SẢNH CHỜ ({group.hallCandidateLots.length} PALLET)</span>
                                                                </span>
                                                                {group.hallCandidateLots.length > 0 && (
                                                                    <span className="text-amber-600 font-bold lowercase text-[10px]">
                                                                        ưu tiên lấy từ sảnh để đưa lên kệ
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {group.hallCandidateLots.length === 0 ? (
                                                                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-500 flex items-center gap-2 italic">
                                                                    <AlertCircle size={14} className="text-slate-400 shrink-0" />
                                                                    Hiện không có pallet nào của mặt hàng này đang nằm ở Sảnh chờ.
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                    {group.hallCandidateLots.map((candidate) => {
                                                                        const targetPos = group.targetPositions[0]
                                                                        return (
                                                                            <div
                                                                                key={candidate.lotId}
                                                                                className="flex items-center justify-between p-2.5 rounded-lg border border-amber-200/70 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 text-xs"
                                                                            >
                                                                                <div>
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-mono font-black text-slate-800 dark:text-slate-100">
                                                                                            {candidate.lotCode}
                                                                                        </span>
                                                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                                                                                            {candidate.quantity} {candidate.unit}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                                                        Vị trí: <strong className="text-slate-700 dark:text-slate-300 font-mono">{candidate.currentLocationName}</strong>
                                                                                    </div>
                                                                                </div>

                                                                                {targetPos && (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const parentSugg = suggestions.find(s => s.emptyPositions.some(p => p.id === targetPos.posId))
                                                                                            if (parentSugg) {
                                                                                                const actualPos = parentSugg.emptyPositions.find(p => p.id === targetPos.posId)
                                                                                                if (actualPos) {
                                                                                                    setConfirmingMove({
                                                                                                        lot: candidate,
                                                                                                        targetPos: actualPos,
                                                                                                        suggestion: parentSugg
                                                                                                    })
                                                                                                }
                                                                                            }
                                                                                        }}
                                                                                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs"
                                                                                        title={`Chuyển vào vị trí ${targetPos.posCode}`}
                                                                                    >
                                                                                        <span>Nâng vào {targetPos.posCode}</span>
                                                                                        <MoveRight size={12} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {/* CHẾ ĐỘ 2: CHI TIẾT TỪNG TẦNG (DETAILED VIEW)                    */}
                    {/* ═════════════════════════════════════════════════════════════════ */}
                    {viewMode === 'details' && (
                        filteredSuggestions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 mb-3">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">
                                    {floorFilteredSuggestions.length === 0
                                        ? 'Kho hiện tại đã được sắp xếp đồng nhất!'
                                        : 'Không tìm thấy gợi ý phù hợp với bộ lọc'}
                                </h3>
                                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                                    {floorFilteredSuggestions.length === 0
                                        ? onlyFloor2Plus
                                            ? 'Tất cả các tầng từ tầng 2 trở lên đều đã được lấp đầy hoặc không có vị trí trống cần bù hàng.'
                                            : 'Tất cả các ô - tầng đều đã được lấp đầy đồng nhất hoặc không có vị trí trống cần bù hàng.'
                                        : 'Hãy thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.'}
                                </p>
                            </div>
                        ) : (
                            filteredSuggestions.map((suggestion) => {
                                const isExpanded = expandedCards.has(suggestion.key)
                                const colorStyle = getProductColorStyle(suggestion.dominantProduct.productColor)
                                const displayProdName = displayInternalInfo && suggestion.dominantProduct.internalName
                                    ? suggestion.dominantProduct.internalName
                                    : suggestion.dominantProduct.productName
                                const displayProdCode = displayInternalInfo && suggestion.dominantProduct.internalCode
                                    ? suggestion.dominantProduct.internalCode
                                    : suggestion.dominantProduct.sku

                                const hasHallCandidate = suggestion.candidateLots.some(c => c.isHall)
                                const isFloorHigh = suggestion.floorNumber >= 2
                                const inferredQty = suggestion.dominantProduct.inferredQuantityPerPallet

                                return (
                                    <div
                                        key={suggestion.key}
                                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-xs hover:shadow-md transition-all overflow-hidden"
                                    >
                                        {/* Card Header */}
                                        <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/50">
                                            <div className="flex items-start sm:items-center gap-3">
                                                {/* Visual Floor representation */}
                                                <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
                                                    <div className="text-[9px] font-black text-slate-500 uppercase mb-1">
                                                        {suggestion.binName}
                                                    </div>
                                                    <div className="flex gap-1 items-center">
                                                        {Array.from({ length: suggestion.totalPositions }).map((_, idx) => {
                                                            const isSlotOccupied = idx < suggestion.occupiedCount
                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    className={`w-3.5 h-3.5 rounded-xs transition-all ${
                                                                        isSlotOccupied
                                                                            ? ''
                                                                            : 'bg-amber-100 dark:bg-amber-950/40 border border-dashed border-amber-500 animate-pulse'
                                                                    }`}
                                                                    style={isSlotOccupied ? colorStyle : undefined}
                                                                    title={isSlotOccupied ? 'Đã có hàng' : 'Vị trí trống cần lấp'}
                                                                />
                                                            )
                                                        })}
                                                    </div>
                                                    <span className="text-[8px] font-mono font-bold text-slate-400 mt-1">
                                                        {suggestion.occupiedCount}/{suggestion.totalPositions}
                                                    </span>
                                                </div>

                                                {/* Location & Target Info */}
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                                            {suggestion.warehouseName} • {suggestion.aisleName} • {suggestion.binName} • {suggestion.levelName}
                                                        </span>
                                                        {isFloorHigh && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                                Tầng {suggestion.floorNumber} (Xe nâng)
                                                            </span>
                                                        )}
                                                        {hasHallCandidate && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60">
                                                                ⚡ Có hàng ở Sảnh
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                            Còn thiếu {suggestion.emptyCount} vị trí
                                                        </span>
                                                    </div>

                                                    {/* Product Info */}
                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                        <span className="text-[10px] font-black text-white bg-indigo-600 px-2 py-0.5 rounded shadow-xs font-mono">
                                                            {displayProdCode}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                                            {displayProdName}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 italic">
                                                            ({suggestion.dominantProduct.occupiedPositionsCount}/{suggestion.occupiedCount} vị trí hiện tại đã chứa)
                                                        </span>

                                                        {/* Inferred Packaging on this Floor */}
                                                        {inferredQty && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                                                                <Sparkles size={10} className="text-emerald-600" />
                                                                Quy cách: {inferredQty} {suggestion.dominantProduct.unit}/pallet (từ {suggestion.dominantProduct.inferredSampleCount} vị trí có sẵn)
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Empty Positions Codes */}
                                                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-slate-500">
                                                        <span>Mã vị trí còn trống:</span>
                                                        <div className="flex flex-wrap gap-1">
                                                            {suggestion.emptyPositions.map(p => (
                                                                <span key={p.id} className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 text-[10px]">
                                                                    {p.code}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action buttons on card header */}
                                            <div className="flex items-center gap-2 self-end lg:self-center">
                                                {onSelectZone && (
                                                    <button
                                                        onClick={() => {
                                                            onSelectZone(suggestion.binId)
                                                            onClose()
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors"
                                                        title="Xem ô này trên sơ đồ chi tiết"
                                                    >
                                                        <ExternalLink size={13} />
                                                        Xem trên sơ đồ
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => toggleExpandCard(suggestion.key)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                                                        suggestion.candidateLots.length > 0
                                                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                                                    }`}
                                                >
                                                    <span>{isExpanded ? 'Thu gọn' : `Xem ${suggestion.candidateLots.length} lô gợi ý`}</span>
                                                    <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Candidate Lots */}
                                        <div className="p-4 sm:p-5">
                                            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
                                                <span>DANH SÁCH LÔ HÀNG CÙNG LOẠI CÓ THỂ CHUYỂN VÀO ({suggestion.candidateLots.length})</span>
                                                {suggestion.candidateLots.length > 0 && (
                                                    <span className="text-indigo-600 dark:text-indigo-400 font-bold lowercase">
                                                        ưu tiên từ sảnh & kệ lẻ
                                                    </span>
                                                )}
                                            </div>

                                            {suggestion.candidateLots.length === 0 ? (
                                                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs text-slate-500 flex items-center gap-2 italic">
                                                    <AlertCircle size={14} className="text-slate-400 shrink-0" />
                                                    Hiện tại không tìm thấy lô hàng cùng loại nào khác đang nằm ở Sảnh hoặc kệ lẻ để đưa vào vị trí này.
                                                </div>
                                            ) : (
                                                <div className="space-y-2.5">
                                                    {(isExpanded ? suggestion.candidateLots : suggestion.candidateLots.slice(0, 2)).map((candidate) => {
                                                        const targetPosition = suggestion.emptyPositions[0]

                                                        return (
                                                            <div
                                                                key={`${candidate.lotId}-${candidate.currentPositionId}`}
                                                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-850 hover:bg-white dark:hover:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all gap-3"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`p-2 rounded-lg shrink-0 ${candidate.isHall ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600' : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600'}`}>
                                                                        <Package size={16} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="font-mono font-black text-xs text-slate-800 dark:text-slate-100">
                                                                                {candidate.lotCode}
                                                                            </span>
                                                                            <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-tight ${
                                                                                candidate.priority === 1
                                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300/60'
                                                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                                            }`}>
                                                                                {candidate.priorityLabel}
                                                                            </span>
                                                                            <span className="text-[11px] font-bold text-slate-500">
                                                                                {candidate.quantity} {candidate.unit}
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                                                                            <span>Vị trí hiện tại:</span>
                                                                            <strong className="text-slate-700 dark:text-slate-300 font-mono">
                                                                                {candidate.currentLocationName}
                                                                            </strong>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Transfer Button */}
                                                                {targetPosition && (
                                                                    <button
                                                                        onClick={() => setConfirmingMove({
                                                                            lot: candidate,
                                                                            targetPos: targetPosition,
                                                                            suggestion
                                                                        })}
                                                                        className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 self-end sm:self-center"
                                                                    >
                                                                        <span>Chuyển vào {targetPosition.code}</span>
                                                                        <MoveRight size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )
                                                    })}

                                                    {!isExpanded && suggestion.candidateLots.length > 2 && (
                                                        <div className="text-center pt-1">
                                                            <button
                                                                onClick={() => toggleExpandCard(suggestion.key)}
                                                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                                                            >
                                                                + Xem thêm {suggestion.candidateLots.length - 2} lô khác có thể chuyển vào
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500 print:hidden">
                    <div className="flex flex-wrap items-center gap-4">
                        <span>
                            Cơ hội tối ưu: <strong className="text-slate-800 dark:text-slate-200 font-bold">{floorFilteredSuggestions.length}</strong> tầng {onlyFloor2Plus ? '(tầng ≥ 2)' : ''}
                        </span>
                        <span>
                            Tổng Pallet cần nâng: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{totalPalletsNeeded}</strong> pallet (~{totalCartonsNeeded.toLocaleString()} thùng)
                        </span>
                        <span>
                            Lấp đầy ngay từ Sảnh: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{totalFillableImmediately}</strong> vị trí
                        </span>
                    </div>

                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors self-end sm:self-auto"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* MODAL CÀI ĐẶT QUY CÁCH PALLET (CÓ NÚT BẬT / TẮT KÍCH HOẠT)       */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {isConfigModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => setIsConfigModalOpen(false)}></div>

                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 sm:p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                                    <Settings size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800 dark:text-white">
                                        Cài đặt quy cách Pallet
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        Thiết lập số thùng/pallet mặc định hoặc dùng chế độ tự động suy luận thông minh
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsConfigModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="py-4 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            
                            {/* Switch Bật/Tắt Cài Đặt Thủ Công */}
                            <div className={`p-4 rounded-xl border transition-all ${
                                tempUseManual
                                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/80'
                                    : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/80'
                            }`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                                                Chế độ cài đặt thủ công
                                            </span>
                                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${
                                                tempUseManual
                                                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
                                                    : 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100 flex items-center gap-1'
                                            }`}>
                                                {tempUseManual ? 'Đang BẬT' : 'Đang TẮT (Tự động)'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                                            {tempUseManual ? (
                                                <span>
                                                    Quy cách sẽ bị ép buộc theo số thùng do bạn nhập bên dưới, thay vì tự động suy luận.
                                                </span>
                                            ) : (
                                                <span className="flex items-start gap-1">
                                                    <Sparkles size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                                                    <span>
                                                        <strong>Khuyên dùng:</strong> Hệ thống tự động tính quy cách dựa vào số lượng thực tế của các vị trí đã có trong ô/tầng (ví dụ ô có 5/6 vị trí sẽ tự động suy ra quy cách từ 5 vị trí này).
                                                    </span>
                                                </span>
                                            )}
                                        </p>
                                    </div>

                                    {/* Toggle Switch */}
                                    <button
                                        type="button"
                                        onClick={() => setTempUseManual(!tempUseManual)}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                            tempUseManual ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                                        }`}
                                    >
                                        <span
                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                tempUseManual ? 'translate-x-5' : 'translate-x-0'
                                            }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {/* Global Default Input */}
                            <div className={`p-4 rounded-xl border transition-opacity ${
                                tempUseManual
                                    ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50'
                                    : 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-60'
                            }`}>
                                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
                                    Quy cách mặc định chung (Dự phòng)
                                </label>
                                <p className="text-[11px] text-slate-500 mt-0.5 mb-2">
                                    Chỉ sử dụng khi bật thủ công hoặc khi một ô hoàn toàn trống chưa có dữ liệu để suy ra.
                                </p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        value={tempDefaultQty}
                                        onChange={(e) => setTempDefaultQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-28 px-3 py-1.5 text-sm font-black border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        thùng / 1 Pallet
                                    </span>
                                </div>
                            </div>

                            {/* Per-Product Overrides */}
                            <div className={!tempUseManual ? 'opacity-60' : ''}>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">
                                        Cấu hình riêng theo từng sản phẩm
                                    </label>
                                    <span className="text-[10px] text-slate-400">
                                        ({distinctProductsForConfig.length} sản phẩm trong kho)
                                    </span>
                                </div>

                                <div className="relative mb-2">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm sản phẩm để cấu hình riêng..."
                                        value={configSearchTerm}
                                        onChange={(e) => setConfigSearchTerm(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                    />
                                </div>

                                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                    {distinctProductsForConfig.map((prod) => {
                                        const currentVal = tempOverrides[prod.key] ?? tempDefaultQty
                                        const isOverridden = tempOverrides[prod.key] !== undefined

                                        return (
                                            <div
                                                key={prod.key}
                                                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs"
                                            >
                                                <div className="pr-2 truncate">
                                                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                                                        {prod.sku}
                                                    </div>
                                                    <div className="font-bold text-slate-700 dark:text-slate-200 truncate" title={prod.name}>
                                                        {prod.name}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={currentVal}
                                                        onChange={(e) => {
                                                            const val = parseInt(e.target.value, 10)
                                                            setTempOverrides(prev => ({
                                                                ...prev,
                                                                [prod.key]: isNaN(val) ? 1 : Math.max(1, val)
                                                            }))
                                                        }}
                                                        className={`w-16 px-2 py-1 text-xs font-black text-center border rounded-md bg-white dark:bg-slate-900 ${
                                                            isOverridden
                                                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/30'
                                                                : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                                                        }`}
                                                    />
                                                    <span className="text-[11px] text-slate-400">thùng</span>

                                                    {isOverridden && (
                                                        <button
                                                            onClick={() => {
                                                                setTempOverrides(prev => {
                                                                    const next = { ...prev }
                                                                    delete next[prod.key]
                                                                    return next
                                                                })
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-rose-500"
                                                            title="Xóa cấu hình riêng, dùng mặc định chung"
                                                        >
                                                            <RotateCcw size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <button
                                onClick={handleResetConfig}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                            >
                                <RotateCcw size={13} />
                                <span>Khôi phục chuẩn tự động</span>
                            </button>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsConfigModalOpen(false)}
                                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSaveConfigModal}
                                    className="px-4 py-1.5 rounded-lg text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                >
                                    Lưu Cài Đặt
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* MODAL XÁC NHẬN CHUYỂN VỊ TRÍ                                     */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {confirmingMove && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs" onClick={() => !isMoving && setConfirmingMove(null)}></div>

                    <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 mb-4">
                            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl">
                                <Sparkles size={20} />
                            </div>
                            <h3 className="text-base font-black text-slate-800 dark:text-white">
                                Xác nhận chuyển vị trí lô hàng
                            </h3>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                            Bạn có chắc chắn muốn chuyển lô hàng sau vào vị trí còn thiếu trên kệ không?
                        </p>

                        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800 text-xs mb-5">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Mã Lô:</span>
                                <span className="font-mono font-black text-slate-800 dark:text-slate-100">{confirmingMove.lot.lotCode}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Sản phẩm:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-right truncate max-w-[220px]" title={confirmingMove.suggestion.dominantProduct.productName}>
                                    {confirmingMove.suggestion.dominantProduct.productName}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Vị trí hiện tại:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">{confirmingMove.lot.currentLocationName}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                                <span className="text-slate-400">Vị trí đích:</span>
                                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">{confirmingMove.targetPos.code}</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                disabled={isMoving}
                                onClick={() => setConfirmingMove(null)}
                                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                disabled={isMoving}
                                onClick={handleConfirmMove}
                                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-all shadow-xs"
                            >
                                {isMoving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                <span>Xác nhận chuyển</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
