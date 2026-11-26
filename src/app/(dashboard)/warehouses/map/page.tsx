'use client'

import { useState, useMemo, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { ChevronUp, ChevronDown, Layers, X, Maximize2, Bookmark, FileSpreadsheet, Printer, Trash2, Eye, ListFilter } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import MultiSelectActionBar from '@/components/warehouse/map/MultiSelectActionBar'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import LayoutConfigPanel from '@/components/warehouse/LayoutConfigPanel'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { useSystem } from '@/contexts/SystemContext'
import { useUser } from '@/contexts/UserContext'
import { LotTagModal } from '@/components/lots/LotTagModal'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { QrCodeModal } from '@/app/(dashboard)/warehouses/lots/_components/QrCodeModal'
import { QuickBulkExportModal } from '@/components/warehouse/map/QuickBulkExportModal'
import { CreateExportTaskModal } from '@/components/export/CreateExportTaskModal'
import { usePositionActionManager } from '@/components/warehouse/map/PositionActionManager'
import { MarkPositionModal } from '@/components/warehouse/map/MarkPositionModal'
import { MarkedPositionsListModal } from '@/components/warehouse/map/MarkedPositionsListModal'
import { MapFilterBar } from '@/components/warehouse/map/MapFilterBar'
import { useWarehouseData } from './_hooks/useWarehouseData'
import { useMapFilters } from './_hooks/useMapFilters'
import { useMarkedPositions } from './_hooks/useMarkedPositions'
import { useLockedPositions } from './_hooks/useLockedPositions'
import { useLoosePositions } from './_hooks/useLoosePositions'
import { LoosePositionModal } from '@/components/warehouse/map/LoosePositionModal'
import { PackageOpen } from 'lucide-react'
import { MapHeader } from './_components/MapHeader'
import { MapBanners } from './_components/MapBanners'
import { ZoneCollapseControls } from './_components/ZoneCollapseControls'
import { MapSearchStats } from './_components/MapSearchStats'
import { LotBulkPrintModal } from '@/components/warehouse/map/LotBulkPrintModal'
import { logLotsDeletion } from '@/lib/lotDeleteLogger'
import { WarehouseHistoryModal } from './_components/WarehouseHistoryModal'
import { WarehouseAdjustmentReviewModal } from './_components/WarehouseAdjustmentReviewModal'
import { WarehouseAdjustmentReviewDock } from './_components/WarehouseAdjustmentReviewDock'
import { MarkedFilterBanner, MapFloatingControls } from './_components/MapFloatingControls'
import { useVisualMapReview } from './_hooks/useVisualMapReview'
import { useMapPositionMovements } from './_hooks/useMapPositionMovements'
import { SelectWarehouseModal } from '@/components/warehouse/map/SelectWarehouseModal'
import { SelectHallModal } from '@/components/warehouse/map/SelectHallModal'
import { SelectMoveDestinationModal } from '@/components/warehouse/map/SelectMoveDestinationModal'
import { LotBulkCloneModal } from '@/components/warehouse/lots/LotBulkCloneModal'
import { LotBulkChangeProductModal } from '@/components/warehouse/lots/LotBulkChangeProductModal'
import { LotBulkChangeUnitModal } from '@/components/warehouse/lots/LotBulkChangeUnitModal'
import { LotBulkEditDatesModal } from '@/components/warehouse/lots/LotBulkEditDatesModal'
import { LotBulkAssignModal } from '@/components/warehouse/lots/LotBulkAssignModal'
import { groupWarehouseData, sortPositionsByBinPriority } from '@/lib/warehouseUtils'
import { exportMarkedPositionsToExcel } from '@/lib/warehouseExcelExport'
import WarehouseLayoutViewer from '@/components/warehouse/layout-manager/WarehouseLayoutViewer'
import { logActivity } from '@/lib/audit'

type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

function WarehouseMapContent() {
    const { showToast, showConfirm } = useToast()
    const { systemType, currentSystem, hasModule } = useSystem()
    const { profile } = useUser()
    const is2DLayoutEnabled = hasModule('warehouse_layout_2d')
    const searchParams = useSearchParams()
    const router = useRouter()
    const assignLotId = searchParams.get('assignLotId')

    // 1. Data Hook
    const {
        positions,
        setPositions,
        zones,
        layouts,
        setLayouts,
        occupiedIds,
        setOccupiedIds,
        lotInfo,
        loading,
        errorMsg,
        recentlyUpdatedPositionIds,
        fetchData,
        refreshLotInfo,
        totalPositions,
        totalZones,
        collapsedZones,
        setCollapsedZones,
        pendingExportPosIds
    } = useWarehouseData()

    // 2. Marked Positions Hook
    const {
        markedPositionIds,
        markedNotes,
        markedCount,
        isMarked,
        getMarkNote,
        toggleMark,
        markPositions,
        unmarkPositions,
        updateMarkNote,
        clearAllMarks,
        onlyShowMarked,
        setOnlyShowMarked,
        toggleOnlyShowMarked,
        exportMarkedExcel,
        printMarked
    } = useMarkedPositions({
        systemType,
        systemName: currentSystem?.name,
        initialModules: currentSystem?.modules
    })

    const [isMarkedListModalOpen, setIsMarkedListModalOpen] = useState(false)
    const [bulkMarkTargetIds, setBulkMarkTargetIds] = useState<string[] | null>(null)
    const [isExportOrderModalOpen, setIsExportOrderModalOpen] = useState(false)
    const [isPreparingExportOrder, setIsPreparingExportOrder] = useState(false)
    const [exportOrderModalData, setExportOrderModalData] = useState<{
        positionIds: string[]
        lotIds: string[]
        items: any[]
    }>({ positionIds: [], lotIds: [], items: [] })

    // 2.5. Locked Positions Hook
    const {
        lockedPositionIds,
        isLocked,
        toggleLock
    } = useLockedPositions({
        systemType,
        initialModules: currentSystem?.modules
    })

    // 2.6. Loose Positions Hook (Ô Hàng Lẻ)
    const {
        loosePositions,
        isLoose,
        getLooseConfig,
        setLoose,
        toggleLooseStatus,
        setAllLooseStatus,
        removeLoose
    } = useLoosePositions({
        systemType,
        initialModules: currentSystem?.modules
    })

    const [looseModalTargetPositions, setLooseModalTargetPositions] = useState<any[] | null>(null)

    const handleOpenLooseModal = (posOrPosIds: any) => {
        let targetList: any[] = []
        if (Array.isArray(posOrPosIds)) {
            targetList = posOrPosIds.map(id => {
                const found = positions.find(p => p.id === id)
                return found || { id, code: id }
            })
        } else if (typeof posOrPosIds === 'string') {
            const found = positions.find(p => p.id === posOrPosIds)
            targetList = [found || { id: posOrPosIds, code: posOrPosIds }]
        } else if (posOrPosIds && posOrPosIds.id) {
            targetList = [posOrPosIds]
        }
        setLooseModalTargetPositions(targetList)
    }

    // 3. Filter Hook
    const {
        selectedZoneId, setSelectedZoneId,
        selectedCategoryId, setSelectedCategoryId,
        selectedUnits, setSelectedUnits,
        selectedTags, setSelectedTags,
        availableUnits,
        availableTags,
        searchTerm, setSearchTerm,
        searchMode, setSearchMode,
        dateFilterField, setDateFilterField,
        startDate, setStartDate,
        endDate, setEndDate,
        filteredPositions,
        filteredZones,
        isFifoAvailable,
        isFifoActive,
        toggleFifo,
        hidePendingExport,
        setHidePendingExport,
        excludeTags,
        toggleExcludeTags,
        // Deep Scan (OCR / Tem con dấu)
        isDeepScanMode,
        setIsDeepScanMode,
        toggleDeepScanMode,
        deepScanTerm,
        setDeepScanTerm,
        deepDateField,
        setDeepDateField,
        deepStartDate,
        setDeepStartDate,
        deepEndDate,
        setDeepEndDate,
        deepRegion,
        setDeepRegion,
        deepFactory,
        setDeepFactory,
        deepGrade,
        setDeepGrade,
        deepVariety,
        setDeepVariety,
        deepPackageSpec,
        setDeepPackageSpec,
        resetDeepScanFilters,
        deepScanActiveCount,
        deepScanMatchingBoxesCount
    } = useMapFilters({
        positions,
        zones,
        lotInfo,
        isFifoEnabled: hasModule('fifo_priority'),
        pendingExportPosIds,
        onlyShowMarked,
        markedPositionIds,
        markedNotes
    })

    // Đánh dấu nhanh tất cả các vị trí đang được lọc (hỗ trợ chế độ chuyên sâu và kiểm kê)
    const handleBulkMarkFilteredPositions = () => {
        if (!filteredPositions || filteredPositions.length === 0) return
        const idsToMark: string[] = []
        filteredPositions.forEach(p => {
            if ((p as any).realIds && Array.isArray((p as any).realIds)) {
                idsToMark.push(...(p as any).realIds)
            } else if (p.id) {
                idsToMark.push(p.id)
            }
        })
        if (idsToMark.length > 0) {
            markPositions(idsToMark)
            showToast(`Đã đánh dấu ${idsToMark.length} vị trí tìm thấy vào danh sách kiểm tra / xuất kho`, 'success')
        }
    }

    // Categories list for filter
    const [categories, setCategories] = useState<any[]>([])
    useEffect(() => {
        if (!systemType) return
        supabase.from('categories')
            .select('id, name')
            .eq('system_type', systemType)
            .order('name')
            .then(({ data }) => {
                if (data) setCategories(data)
            })
    }, [systemType])

    // Auto expand root zones when a filter (category, unit, tag or search) is selected
    useEffect(() => {
        if (selectedCategoryId || selectedUnits.length > 0 || selectedTags.length > 0 || searchTerm) {
            setCollapsedZones(new Set())
        }
    }, [selectedCategoryId, selectedUnits, selectedTags, searchTerm, setCollapsedZones])

    // 3. UI State
    const [isMobile, setIsMobile] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [isDesignMode, setIsDesignMode] = useState(false)
    const [displayInternalCode, setDisplayInternalCode] = useState(true)
    const [assignLot, setAssignLot] = useState<{ id: string, code: string } | null>(null)
    const [configuringZone, setConfiguringZone] = useState<Zone | null>(null)

    // Multi-select & Modals
    const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(new Set())
    const [isBulkExportOpen, setIsBulkExportOpen] = useState(false)
    const [isSelectHallOpen, setIsSelectHallOpen] = useState(false)
    const [isAutoAssignModalOpen, setIsAutoAssignModalOpen] = useState(false)
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
    const [isBulkChangeProductOpen, setIsBulkChangeProductOpen] = useState(false)
    const [bulkChangeLotIds, setBulkChangeLotIds] = useState<string[] | null>(null)
    const [isBulkChangeUnitOpen, setIsBulkChangeUnitOpen] = useState(false)
    const [bulkChangeUnitLotIds, setBulkChangeUnitLotIds] = useState<string[] | null>(null)
    const [bulkChangeUnitStats, setBulkChangeUnitStats] = useState<Record<string, { selected: number, total: number }>>({})
    const [preselectedProductId, setPreselectedProductId] = useState<string | undefined>(undefined)
    const [isBulkEditDatesOpen, setIsBulkEditDatesOpen] = useState(false)
    const [bulkEditDateLotIds, setBulkEditDateLotIds] = useState<string[] | null>(null)
    const [isBulkAssignPositionOpen, setIsBulkAssignPositionOpen] = useState(false)
    const [bulkAssignPositionLotIds, setBulkAssignPositionLotIds] = useState<string[] | null>(null)
    const [products, setProducts] = useState<any[]>([])
    const [taggingLotIds, setTaggingLotIds] = useState<string[] | null>(null)
    const [viewingLot, setViewingLot] = useState<any>(null)
    const [qrLot, setQrLot] = useState<any>(null)
    const [bulkPrintLotIds, setBulkPrintLotIds] = useState<string[] | null>(null)
    const [isMapControlsOpen, setIsMapControlsOpen] = useState(false)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [pageBreakZoneIds, setPageBreakZoneIds] = useState<Set<string>>(new Set())
    const [isGrouped, setIsGrouped] = useState(true)
    const [mergedZones, setMergedZones] = useState<Set<string>>(new Set())

    useEffect(() => {
        const systemCode = currentSystem?.code
        if (!systemCode) return
        let isMounted = true
        async function loadProducts(code: string) {
            let allProducts: any[] = []
            let page = 0
            const pageSize = 1000
            while (true) {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('system_type', code)
                    .order('name')
                    .range(page * pageSize, (page + 1) * pageSize - 1)

                if (error || !data || data.length === 0) break
                allProducts = allProducts.concat(data)
                if (data.length < pageSize) break
                page++
            }
            if (isMounted) {
                setProducts(allProducts)
            }
        }
        loadProducts(systemCode)
        return () => { isMounted = false }
    }, [currentSystem?.code])

    const handleOpenBulkChangeProduct = (lotIds: string[]) => {
        if (!lotIds || lotIds.length === 0) return
        setBulkChangeLotIds(lotIds)

        // Try to preselect source product if all selected lots have a common product
        let foundProductId: string | undefined = undefined
        const selectedLotItems: any[] = []
        lotIds.forEach(id => {
            const lot = lotInfo[id]
            if (lot && lot.items) {
                selectedLotItems.push(...lot.items)
            }
        })

        if (selectedLotItems.length > 0 && products.length > 0) {
            const firstItem = selectedLotItems[0]
            const matchedProduct = products.find(p => p.sku === firstItem.sku || p.name === firstItem.product_name)
            if (matchedProduct) {
                foundProductId = matchedProduct.id
            }
        }

        setPreselectedProductId(foundProductId)
        setIsBulkChangeProductOpen(true)
    }

    const handleOpenBulkChangeUnit = (lotIds: string[]) => {
        if (!lotIds || lotIds.length === 0) {
            showToast('Các vị trí đã chọn chưa có LOT nào để đổi đơn vị', 'warning')
            return
        }
        const stats: Record<string, { selected: number, total: number }> = {}
        lotIds.forEach(id => {
            const lotPositions = positions.filter(p => p.lot_id === id)
            stats[id] = {
                total: lotPositions.length,
                selected: lotPositions.filter(p => selectedPositionIds.has(p.id)).length
            }
        })
        setBulkChangeUnitLotIds(lotIds)
        setBulkChangeUnitStats(stats)
        setIsBulkChangeUnitOpen(true)
    }

    const handleOpenBulkEditDates = (lotIds: string[]) => {
        if (!lotIds || lotIds.length === 0) {
            showToast('Các vị trí đã chọn không có LOT nào để đổi ngày', 'warning')
            return
        }
        setBulkEditDateLotIds(lotIds)
        setIsBulkEditDatesOpen(true)
    }

    const handleOpenBulkAssignPosition = (lotIds: string[]) => {
        if (!lotIds || lotIds.length === 0) {
            showToast('Các vị trí đã chọn không có LOT nào để gán vị trí', 'warning')
            return
        }
        setBulkAssignPositionLotIds(lotIds)
        setIsBulkAssignPositionOpen(true)
    }

    const toggleMergeZone = (zoneId: string) => {
        setMergedZones(prev => {
            const next = new Set(prev)
            if (next.has(zoneId)) next.delete(zoneId)
            else next.add(zoneId)
            return next
        })
    }

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Lot Assignment Setup
    useEffect(() => {
        if (assignLotId) {
            supabase.from('lots').select('id, code').eq('id', assignLotId).single()
                .then(({ data }) => data && setAssignLot(data))
        } else {
            setAssignLot(null)
        }
    }, [assignLotId])

    // Warehouse Adjustment Proposals & Visual Map Review Hook
    const {
        isProposalsModalOpen,
        setIsProposalsModalOpen,
        pendingProposalCount,
        refreshProposalCount,
        handleFocusPosition,
        visualReviewProposal,
        setVisualReviewProposal,
        visualReviewIndex,
        setVisualReviewIndex,
        isProcessingVisualReview,
        visualReviewItemsMap,
        visualReviewTargetMap,
        zoneProposalCounts,
        handleExpandProposalZones,
        currentVisualPositionId,
        handleFocusPositionOnMap,
        handleStartVisualReview,
        handleSelectVisualReviewItem,
        handleApproveVisualItem,
        handleApproveAllVisualProposal,
    } = useVisualMapReview({
        systemType,
        zones,
        positions,
        isGrouped,
        profile,
        setSearchTerm,
        setSelectedZoneId,
        setCollapsedZones,
        fetchData,
        showToast,
    })

    // Position Movements, Staging Queue & Auto-Assign Hook
    const {
        selectedPositions,
        selectedLotIds,
        updatePositionsWithLog,
        handlePositionSelect,
        handleMoveToHall,
        handleMoveItems,
        handleSwapLots,
        handleMoveLotToPosition,
        handleMoveLotToZoneShape,
        unassignedLots,
        loadingUnassignedLots,
        fetchUnassignedLots,
        handleAssignStagingLotToPosition,
        handleAssignStagingLotToZoneShape,
        handleAutoAssignWarehouse,
    } = useMapPositionMovements({
        positions,
        setPositions,
        zones,
        occupiedIds,
        lockedPositionIds,
        selectedPositionIds,
        setSelectedPositionIds,
        assignLot,
        assignLotId,
        isMoveMode: searchParams.get('mode') === 'move',
        currentSystem,
        systemType,
        profile,
        fetchData,
        showToast,
        router,
        setIsSelectHallOpen,
        setIsMoveModalOpen,
        setIsAutoAssignModalOpen,
    })

    // Module enablement check for LotDetails
    const isModuleEnabled = useMemo(() => {
        return (moduleId: string) => {
            if (!currentSystem) return true

            // Simple check based on loaded system modules
            const allModules = new Set<string>()
            if (currentSystem.modules) {
                if (Array.isArray(currentSystem.modules)) {
                    currentSystem.modules.forEach(m => allModules.add(m))
                } else if (typeof currentSystem.modules === 'string') {
                    currentSystem.modules.split(',').forEach(m => allModules.add(m.trim().replace(/"/g, '').replace(/\[/g, '').replace(/\]/g, '')))
                }
            }
            if (Array.isArray(currentSystem.inbound_modules)) currentSystem.inbound_modules.forEach(m => allModules.add(m))
            if (Array.isArray(currentSystem.outbound_modules)) currentSystem.outbound_modules.forEach(m => allModules.add(m))

            // Fallback for current viewing lot data existence
            if (viewingLot) {
                if (moduleId === 'inbound_date' && viewingLot.inbound_date) return true
                if (moduleId === 'packaging_date' && viewingLot.packaging_date) return true
                if (moduleId === 'peeling_date' && viewingLot.peeling_date) return true
                if (moduleId === 'batch_code' && viewingLot.batch_code) return true
                if (moduleId === 'supplier_info' && viewingLot.suppliers) return true
                if (moduleId === 'qc_info' && viewingLot.qc_info) return true
                if (moduleId === 'extra_info' && viewingLot.metadata?.extra_info) return true
            }
            return allModules.has(moduleId) || hasModule(moduleId)
        }
    }, [currentSystem, viewingLot, hasModule])

    const [bulkCloningLot, setBulkCloningLot] = useState<any | null>(null)

    const handleCloneLot = (lotId: string) => {
        const lotObj = lotInfo[lotId] || { id: lotId }
        setBulkCloningLot(lotObj)
    }

    const { handlePositionMenu, openMarkModalForPosition, PositionActionUI } = usePositionActionManager({
        currentSystemCode: currentSystem?.code,
        onRefreshMap: fetchData,
        onRefreshLot: refreshLotInfo,
        onCloneLot: handleCloneLot,
        onToggleMark: (pos) => toggleMark(pos.id),
        onMarkWithNote: (pos, note) => markPositions([pos.id], note),
        onUnmarkPosition: (posId) => unmarkPositions([posId]),
        isMarked: (id) => isMarked(id),
        getMarkNote: (id) => getMarkNote(id),
        onToggleLock: (ids) => toggleLock(ids),
        isLocked: (id) => isLocked(id),
        onOpenLooseModal: (pos) => handleOpenLooseModal(pos),
        onToggleLooseStatus: (posId) => toggleLooseStatus(posId),
        onRemoveLoosePosition: (posId) => removeLoose([posId]),
        isLoose: (id) => isLoose(id),
        getLooseConfig: (id) => getLooseConfig(id),
        lotInfo
    })

    async function fetchFullLotDetails(lotId: string) {
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`*, created_at, productions(code, name), suppliers(name), qc_info(name), lot_items(id, quantity, unit, products(name, sku, unit)), positions!positions_lot_id_fkey(code), lot_tags(tag, lot_item_id)`)
                .eq('id', lotId)
                .single()
            if (error) throw error
            
            // Ensure productions is an object, not an array of one
            if (data && Array.isArray((data as any).productions)) {
                (data as any).productions = (data as any).productions[0] || null
            }
            
            setViewingLot(data)
        } catch (error: any) {
            console.error('Error fetching lot details:', error)
            showToast('Không thể tải chi tiết LOT: ' + error.message, 'error')
        }
    }

    // --- Layout Handlers ---

    function toggleZoneCollapse(zoneId: string) {
        setCollapsedZones((prev: Set<string>) => {
            const next = new Set(prev)
            if (next.has(zoneId)) next.delete(zoneId)
            else next.add(zoneId)
            return next
        })
    }

    function handleLayoutSave(updatedLayout: ZoneLayout) {
        setLayouts(prev => {
            const existing = prev.find(l => l.zone_id === updatedLayout.zone_id)
            if (existing) return prev.map(l => l.zone_id === updatedLayout.zone_id ? updatedLayout : l)
            return [...prev, updatedLayout]
        })
    }

    function handleBatchLayoutSave(updatedLayouts: ZoneLayout[]) {
        setLayouts(prev => {
            let next = [...prev]
            updatedLayouts.forEach(updatedLayout => {
                const existing = next.find(l => l.zone_id === updatedLayout.zone_id)
                if (existing) {
                    next = next.map(l => l.zone_id === updatedLayout.zone_id ? updatedLayout : l)
                } else {
                    next = [...next, updatedLayout]
                }
            })
            return next
        })
    }

    async function handleExportOrder(positionIds: string[], lotIds: string[]) {
        if (isPreparingExportOrder) return
        if (positionIds.length === 0 && lotIds.length === 0) return

        try {
            setIsPreparingExportOrder(true)

            const finalLotIds = new Set(lotIds)
            const lotToPositionMap: Record<string, string> = {}

            if (positionIds.length > 0) {
                const { data: posData, error: posError } = await supabase
                    .from('positions')
                    .select('id, lot_id')
                    .in('id', positionIds)

                if (posError) throw posError

                posData?.forEach((p: any) => {
                    if (p.lot_id) {
                        finalLotIds.add(p.lot_id)
                        lotToPositionMap[p.lot_id] = p.id
                    }
                })
            }

            const uniqueLotIds = Array.from(finalLotIds)
            if (uniqueLotIds.length === 0) {
                showToast('Không tìm thấy LOT nào trong các vị trí đã chọn', 'error')
                return
            }

            const { data: lotsData, error } = await supabase
                .from('lots')
                .select(`
                    id, code,
                    lot_items (
                        id, product_id, quantity, unit,
                        products ( name, sku )
                    ),
                    positions!positions_lot_id_fkey (id, code)
                `)
                .in('id', uniqueLotIds)

            if (error) throw error

            const items: any[] = []
            lotsData?.forEach((lot: any) => {
                let defaultPositionId = lotToPositionMap[lot.id]
                if (!defaultPositionId && lot.positions && lot.positions.length > 0) {
                    defaultPositionId = lot.positions[0].id
                }

                if (lot.lot_items) {
                    lot.lot_items.forEach((li: any) => {
                        items.push({
                            lot_id: lot.id,
                            product_id: li.product_id,
                            quantity: li.quantity,
                            unit: li.unit,
                            product_name: li.products?.name,
                            sku: li.products?.sku,
                            position_id: defaultPositionId || null
                        })
                    })
                }
            })

            setExportOrderModalData({
                positionIds,
                lotIds: uniqueLotIds,
                items
            })
            setIsExportOrderModalOpen(true)
        } catch (error: any) {
            console.error(error)
            showToast('Lỗi tải thông tin hàng hóa: ' + error.message, 'error')
        } finally {
            setIsPreparingExportOrder(false)
        }
    }

    function handleBulkSelect(ids: string[], shouldSelect: boolean) {
        setSelectedPositionIds(prev => {
            const next = new Set(prev)
            ids.forEach(id => {
                if (shouldSelect) next.add(id)
                else next.delete(id)
            })
            return next
        })
    }

    const handleBulkUnassignPosition = async (positionIds: string[]) => {
        if (!positionIds.length) return

        const occupiedPositionsToUnassign = positions.filter(p => positionIds.includes(p.id) && p.lot_id)

        if (occupiedPositionsToUnassign.length === 0) {
            showToast('Các vị trí được chọn đều đang trống.', 'warning')
            return
        }

        const count = occupiedPositionsToUnassign.length
        if (!await showConfirm(`Bạn có chắc chắn muốn gỡ vị trí của ${count} ô đã chọn?\nLúc này LOT sẽ được chuyển sang trạng thái chưa gán và sơ đồ kho vị trí đó sẽ trống.`)) return

        const updates = occupiedPositionsToUnassign.map(p => ({
            id: p.id,
            lot_id: null
        }))

        // Optimistic UI update
        const positionIdSet = new Set(occupiedPositionsToUnassign.map(p => p.id))
        setPositions(prev => prev.map(p => {
            if (positionIdSet.has(p.id)) {
                return { ...p, lot_id: null }
            }
            return p
        }))
        setOccupiedIds(prev => {
            const next = new Set(prev)
            occupiedPositionsToUnassign.forEach(p => next.delete(p.id))
            return next
        })

        try {
            await updatePositionsWithLog(updates)
            showToast(`Đã gỡ vị trí của ${count} ô thành công! LOT đã chuyển sang trạng thái chưa gán.`, 'success')
            setSelectedPositionIds(new Set())
            fetchData()
        } catch (error: any) {
            console.error('Unassign positions error:', error)
            showToast('Lỗi khi gỡ vị trí: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    const handleBulkDeleteLot = async (lotIds: string[]) => {
        if (!lotIds.length) return
        if (!await showConfirm(`Bạn có chắc chắn muốn xóa ${lotIds.length} LOT đã chọn?`)) return

        try {
            const chunkSize = 500;
            for (let i = 0; i < lotIds.length; i += chunkSize) {
                const chunk = lotIds.slice(i, i + chunkSize);

                // 0. Lưu snapshot vào audit_logs với action = 'DELETE' để bảo toàn lịch sử tra cứu & khôi phục
                await logLotsDeletion(supabase, chunk);

                // 1. Clear lot_id in positions (Reference)
                const { error: posError } = await ((supabase as any)
                    .from('positions')
                    .update({ lot_id: null })
                    .in('lot_id', chunk as any[]) as any)

                if (posError) throw posError

                // 2. Delete lot_tags (Child)
                const { error: tagError } = await (supabase
                    .from('lot_tags')
                    .delete()
                    .in('lot_id', chunk) as any)

                if (tagError) {
                    console.warn('Could not delete all tags, continuing...', tagError)
                }

                // 3. Delete lot_items (Child)
                const { error: itemError } = await (supabase
                    .from('lot_items')
                    .delete()
                    .in('lot_id', chunk) as any)

                if (itemError) throw itemError

                // 4. Finally delete lots (Owner)
                const { error: lotError } = await (supabase
                    .from('lots')
                    .delete()
                    .in('id', chunk) as any)

                if (lotError) throw lotError
            }

            showToast(`Đã xóa ${lotIds.length} LOT thành công`, 'success')

            // Optimistic UI update
            const lotIdSet = new Set(lotIds)
            setPositions(prev => prev.map(p => {
                if (p.lot_id && lotIdSet.has(p.lot_id)) {
                    return { ...p, lot_id: null }
                }
                return p
            }))
            setOccupiedIds(prev => {
                const next = new Set(prev)
                positions.forEach(p => {
                    if (p.lot_id && lotIdSet.has(p.lot_id)) {
                        next.delete(p.id)
                    }
                })
                return next
            })
            setSelectedPositionIds(new Set())

            // Sync fresh data in background without collapsing zones
            fetchData()
        } catch (error: any) {
            console.error('Bulk delete error:', error)
            showToast(error.message || "Lỗi khi xóa LOT (có thể do ràng buộc dữ liệu khác)", 'error')
        }
    }

    async function handleBulkDeleteTags(lotIds: string[]) {
        if (!lotIds.length) return
        if (!await showConfirm(`Bạn có chắc chắn muốn xóa TOÀN BỘ mã phụ của ${lotIds.length} LOT đã chọn?`)) return

        try {
            const chunkSize = 200;
            let successCount = 0;

            for (let i = 0; i < lotIds.length; i += chunkSize) {
                const chunk = lotIds.slice(i, i + chunkSize);

                // Delete all tags except system history tags
                const { error } = await supabase
                    .from('lot_tags')
                    .delete()
                    .in('lot_id', chunk)
                    .not('tag', 'ilike', 'MERGED_%')
                    .not('tag', 'ilike', 'SPLIT_%')

                if (error) {
                    console.error('Error deleting tags for chunk:', error);
                    throw error;
                }
                successCount += chunk.length;
            }

            showToast(`Đã xóa mã phụ của ${successCount} LOT thành công`, 'success')
            lotIds.forEach(id => refreshLotInfo(id))
        } catch (error: any) {
            console.error('Bulk delete tags error:', error)
            showToast(error.message || "Lỗi khi xóa mã phụ", 'error')
        }
    }

    const handleBulkExport = () => {
        setIsBulkExportOpen(true)
    }

    const handleBulkPrint = (lotIds: string[]) => {
        setBulkPrintLotIds(lotIds)
    }

    const handleExportSelectedExcel = async (selPositions: any[]) => {
        const targetPositions = positions.filter(p => {
            if (lockedPositionIds.has(p.id)) return false
            if (selectedPositionIds.has(p.id)) return true
            const realIds = (p as any).realIds
            return realIds && Array.isArray(realIds) && realIds.some((id: string) => selectedPositionIds.has(id))
        })

        const positionsToExport = (targetPositions.length > 0 ? targetPositions : selPositions).filter(p => !lockedPositionIds.has(p.id))

        if (positionsToExport.length === 0) {
            showToast('Chưa có vị trí nào được chọn để xuất Excel', 'warning')
            return
        }

        try {
            await exportMarkedPositionsToExcel({
                systemName: currentSystem?.name || systemType || 'Kho',
                positions: positionsToExport,
                lotInfo,
                zones,
                title: `Vị trí đã chọn (${positionsToExport.length} vị trí)`
            })
            showToast(`Đã xuất Excel thành công cho ${positionsToExport.length} vị trí đã chọn`, 'success')
        } catch (e: any) {
            console.error('Error exporting selected positions to Excel:', e)
            showToast('Lỗi khi xuất file Excel: ' + (e?.message || 'Không xác định'), 'error')
        }
    }

    const handleTogglePageBreak = (zoneId: string) => {
        setPageBreakZoneIds(prev => {
            const next = new Set(prev)
            if (next.has(zoneId)) next.delete(zoneId)
            else next.add(zoneId)
            return next
        })
    }

    // Convert layouts array to record for FlexibleZoneGrid
    const layoutRecord = useMemo(() => {
        const rec: Record<string, ZoneLayout> = {}
        const safeLayouts = layouts || []
        safeLayouts.forEach(l => {
            if (l.zone_id) rec[l.zone_id] = l
        })
        return rec
    }, [layouts])

    // Phân loại tổng số vị trí chính thức và vị trí sảnh
    const { officialPositionsCount, hallPositionsCount } = useMemo(() => {
        const zoneMap = new Map<string, any>()
        zones.forEach(z => zoneMap.set(z.id, z))

        const isHall = (zoneId?: string | null): boolean => {
            let currId = zoneId
            const seen = new Set<string>()
            while (currId && !seen.has(currId)) {
                seen.add(currId)
                const z = zoneMap.get(currId)
                if (!z) break
                if ((z as any).is_hall) return true
                const nameUpper = (z.name || '').trim().toUpperCase()
                if (
                    nameUpper.startsWith('SẢNH') ||
                    nameUpper.startsWith('SÀNH') ||
                    nameUpper.startsWith('SANH') ||
                    nameUpper.includes('SẢNH') ||
                    nameUpper.includes('SÀNH')
                ) return true
                currId = z.parent_id
            }
            return false
        }

        let hallCount = 0
        let officialCount = 0
        positions.forEach(p => {
            if (lockedPositionIds.has(p.id)) return
            if (isHall(p.zone_id)) {
                hallCount++
            } else {
                officialCount++
            }
        })

        return { officialPositionsCount: officialCount, hallPositionsCount: hallCount }
    }, [positions, zones, lockedPositionIds])

    if (!systemType) return <div>Vui lòng chọn kho hàng.</div>
    if (loading && positions.length === 0) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
    )
    if (errorMsg) return (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200">
            Error: {errorMsg}
        </div>
    )

    return (
        <div className="space-y-4">
            <MapHeader
                totalPositions={officialPositionsCount + hallPositionsCount}
                totalZones={totalZones}
                officialPositionsCount={officialPositionsCount}
                hallPositionsCount={hallPositionsCount}
                systemType={systemType}
                selectedZoneId={selectedZoneId}
                selectedCategoryId={selectedCategoryId}
                searchTerm={searchTerm}
                isDesignMode={isDesignMode}
                setIsDesignMode={setIsDesignMode}
                isMobile={isMobile}
                displayInternalCode={displayInternalCode}
                setDisplayInternalCode={setDisplayInternalCode}
                onOpenHistory={() => setIsHistoryOpen(true)}
                onOpenProposals={() => setIsProposalsModalOpen(true)}
                pendingProposalCount={pendingProposalCount}
            />

            <MapBanners
                isDesignMode={isDesignMode}
                assignLot={assignLot}
            />

            {/* Banner khi đang lọc các vị trí đánh dấu kiểm tra */}
            <MarkedFilterBanner
                onlyShowMarked={onlyShowMarked}
                markedCount={markedCount}
                setIsMarkedListModalOpen={setIsMarkedListModalOpen}
                printMarked={printMarked}
                onExportMarkedExcel={() => exportMarkedExcel(positions, lotInfo, zones)}
                setOnlyShowMarked={setOnlyShowMarked}
                clearAllMarks={clearAllMarks}
            />

            {/* Memoize grouped data for filters */}
            {(() => {
                const groupedData = isGrouped 
                    ? groupWarehouseData(zones, positions) 
                    : { zones, positions };
                const groupedZones = (groupedData as any).zones;
                
                return (
                    <MapFilterBar
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        searchMode={searchMode}
                        onSearchModeChange={setSearchMode}
                        selectedZoneId={selectedZoneId}
                        onZoneSelect={setSelectedZoneId}
                        zoneHighlightCounts={zoneProposalCounts}
                        dateFilterField={dateFilterField}
                        onDateFieldChange={setDateFilterField}
                        startDate={startDate}
                        onStartDateChange={setStartDate}
                        endDate={endDate}
                        onEndDateChange={setEndDate}
                        showMobileFilters={showMobileFilters}
                        toggleMobileFilters={() => setShowMobileFilters(!showMobileFilters)}
                        zones={groupedZones}
                        grouped={isGrouped}
                        hidePendingExport={hidePendingExport}
                        onHidePendingExportChange={setHidePendingExport}
                        excludeTags={excludeTags}
                        onToggleExcludeTags={toggleExcludeTags}
                        categories={categories}
                        selectedCategoryId={selectedCategoryId}
                        onCategorySelect={setSelectedCategoryId}
                        availableUnits={availableUnits}
                        selectedUnits={selectedUnits}
                        onUnitsChange={setSelectedUnits}
                        availableTags={availableTags}
                        selectedTags={selectedTags}
                        onTagsChange={setSelectedTags}
                        products={products}
                        onlyShowMarked={onlyShowMarked}
                        onToggleOnlyShowMarked={toggleOnlyShowMarked}
                        markedCount={markedCount}
                        // Deep Scan props
                        isDeepScanMode={isDeepScanMode}
                        onToggleDeepScanMode={toggleDeepScanMode}
                        deepScanTerm={deepScanTerm}
                        onDeepScanTermChange={setDeepScanTerm}
                        deepDateField={deepDateField}
                        onDeepDateFieldChange={setDeepDateField}
                        deepStartDate={deepStartDate}
                        onDeepStartDateChange={setDeepStartDate}
                        deepEndDate={deepEndDate}
                        onDeepEndDateChange={setDeepEndDate}
                        deepRegion={deepRegion}
                        onDeepRegionChange={setDeepRegion}
                        deepFactory={deepFactory}
                        onDeepFactoryChange={setDeepFactory}
                        deepGrade={deepGrade}
                        onDeepGradeChange={setDeepGrade}
                        deepVariety={deepVariety}
                        onDeepVarietyChange={setDeepVariety}
                        deepPackageSpec={deepPackageSpec}
                        onDeepPackageSpecChange={setDeepPackageSpec}
                        onResetDeepScan={resetDeepScanFilters}
                        deepScanStats={{ totalPositions: filteredPositions.length, matchingBoxes: deepScanMatchingBoxesCount }}
                        onBulkMarkFilteredPositions={handleBulkMarkFilteredPositions}
                    />
                );
            })()}

            {(() => {
                const { zones: displayZones, positions: displayPositions } = isGrouped
                    ? groupWarehouseData(filteredZones, filteredPositions)
                    : { zones: filteredZones, positions: filteredPositions }

                const selectedCatName = categories.find(c => c.id === selectedCategoryId)?.name
                const effectiveSearchTerm = isDeepScanMode 
                    ? (() => {
                        const parts: string[] = []
                        const activeSearch = searchTerm || deepScanTerm
                        if (activeSearch.trim()) parts.push(`"${activeSearch.trim()}"`)
                        if (deepStartDate || deepEndDate) {
                            const dateLabel = deepDateField === 'packaging_date' ? 'Ngày ĐG' : deepDateField === 'peeling_date' ? 'Ngày bóc múi' : deepDateField === 'raw_material_date' ? 'Ngày nhập NL' : 'Ngày nhập kho'
                            parts.push(`${dateLabel}: ${deepStartDate || '...'} → ${deepEndDate || '...'}`)
                        }
                        if (deepFactory !== 'all') {
                            const fNames: Record<string, string> = { '1': 'Nhà máy 1 (Bến Tre)', '2': 'Nhà máy 2 (Đắk Lắk)', '3': 'Cơ sở 3 (Phước An)' }
                            parts.push(`Nhà máy: ${fNames[deepFactory] || deepFactory}`)
                        }
                        if (deepRegion !== 'all') {
                            const rNames: Record<string, string> = { '66': 'Đắk Lắk (66)', '71': 'Bến Tre (71)', '09': 'Tỉnh mã 09', '67': 'Đắk Nông (67)', '68': 'Lâm Đồng (68)', '64': 'Gia Lai (64)', '63': 'Tiền Giang (63)' }
                            parts.push(`Vùng: ${rNames[deepRegion] || deepRegion}`)
                        }
                        if (deepGrade !== 'all') parts.push(`Hạng: ${deepGrade}`)
                        if (deepVariety !== 'all') parts.push(`Giống: ${deepVariety}`)
                        if (deepPackageSpec !== 'all') parts.push(`Quy cách: ${deepPackageSpec}`)
                        return parts.length > 0 ? parts.join(' • ') : 'Tất cả vị trí quét tem OCR'
                    })()
                    : searchTerm

                return (
                    <MapSearchStats
                        filteredPositions={displayPositions}
                        zones={displayZones}
                        lotInfo={lotInfo}
                        searchTerm={effectiveSearchTerm}
                        categoryName={selectedCatName}
                        selectedUnits={selectedUnits}
                        selectedTags={selectedTags}
                        onPositionSelect={handlePositionSelect}
                        onPositionMenu={(pos, e) => handlePositionMenu(pos, e)}
                        onViewDetails={fetchFullLotDetails}
                        selectedPositionIds={selectedPositionIds}
                        onBulkSelect={handleBulkSelect}
                        isFifoEnabled={isFifoActive}
                        isFifoAvailable={isFifoAvailable}
                        onToggleFifo={toggleFifo}
                        isGrouped={isGrouped}
                        markedPositionIds={markedPositionIds}
                        markedNotes={markedNotes}
                    />
                )
            })()}

            {/* Map Grid Area - Always show so users can see matched locations inline */}
            <div className="space-y-4">
                {is2DLayoutEnabled ? (
                    <div className="mb-8">
                        <WarehouseLayoutViewer 
                            positions={positions}
                            filteredPositions={filteredPositions}
                            searchTerm={isDeepScanMode ? (deepScanTerm || 'deep_scan') : searchTerm}
                            onPositionClick={(pos) => {
                                if (assignLot) {
                                    handlePositionSelect(pos.id || pos);
                                }
                            }}
                            onPositionSelect={(posId) => handlePositionSelect(posId)}
                            selectedPositionIds={selectedPositionIds}
                            onViewLotDetails={(lotId) => fetchFullLotDetails(lotId)}
                            onExportLot={(posId, lotId) => handleExportOrder(posId ? [posId] : [], [lotId])}
                            onUnassignPosition={(posId) => handleBulkUnassignPosition([posId])}
                            onMoveLot={(posId) => {
                                setSelectedPositionIds(new Set([posId]));
                                setIsMoveModalOpen(true);
                            }}
                            onPrintQr={(lot) => setQrLot(lot)}
                            onAssignLot={(shape) => {
                                router.push(`/warehouses/lots?assignZone=${encodeURIComponent(shape.code || shape.label || '')}`);
                            }}
                            selectedZone={zones.find(z => z.id === selectedZoneId)}
                            lotInfo={lotInfo}
                            isAssignmentMode={!!assignLot}
                            onSwapLots={handleSwapLots}
                            onMoveLotToPosition={handleMoveLotToPosition}
                            onMoveLotToZoneShape={handleMoveLotToZoneShape}
                            onRefreshData={fetchData}
                            unassignedLots={unassignedLots}
                            loadingUnassignedLots={loadingUnassignedLots}
                            onAssignStagingLotToPosition={handleAssignStagingLotToPosition}
                            onAssignStagingLotToZoneShape={handleAssignStagingLotToZoneShape}
                            onRefreshUnassignedLots={fetchUnassignedLots}
                        />
                    </div>
                ) : (
                    /* Process grouped data if enabled */
                    (() => {
                        const { zones: displayZones, positions: displayPositions } = isGrouped
                            ? groupWarehouseData(filteredZones, filteredPositions)
                            : { zones: filteredZones, positions: filteredPositions }

                        return (
                            <div className="min-w-0">
                                <FlexibleZoneGrid
                                    zones={displayZones}
                                    positions={displayPositions}
                                    layouts={layoutRecord}
                                    lotInfo={lotInfo}
                                    searchTerm={isDeepScanMode ? (deepScanTerm || 'deep_scan') : searchTerm}
                                    selectedCategoryId={selectedCategoryId}
                                    occupiedIds={occupiedIds}
                                    selectedPositionIds={selectedPositionIds}
                                    collapsedZones={collapsedZones}
                                    onToggleCollapse={toggleZoneCollapse}
                                    onUpdateCollapsedZones={setCollapsedZones}
                                    onPositionSelect={handlePositionSelect}
                                    onPositionMenu={(pos, e) => handlePositionMenu(pos, e)}
                                    onViewDetails={(lotId) => fetchFullLotDetails(lotId)}
                                    isDesignMode={isDesignMode}
                                    onConfigureZone={setConfiguringZone}
                                    isAssignmentMode={!!assignLot}
                                    highlightingPositionIds={recentlyUpdatedPositionIds}
                                    displayInternalCode={displayInternalCode}
                                    isGrouped={isGrouped}
                                    onBulkSelect={handleBulkSelect}
                                    pageBreakIds={pageBreakZoneIds}
                                    onTogglePageBreak={handleTogglePageBreak}
                                    mergedZones={mergedZones}
                                    onToggleMergeZone={toggleMergeZone}
                                    markedPositionIds={markedPositionIds}
                                    markedNotes={markedNotes}
                                    onEditMarkNote={(pos) => openMarkModalForPosition(pos)}
                                    lockedPositionIds={lockedPositionIds}
                                    loosePositions={loosePositions}
                                    visualReviewItemsMap={visualReviewItemsMap}
                                    visualReviewTargetMap={visualReviewTargetMap}
                                    zoneProposalCounts={zoneProposalCounts}
                                    currentVisualPositionId={currentVisualPositionId}
                                    onSelectVisualReviewItem={handleSelectVisualReviewItem}
                                    onPrintZone={(zoneId) => {
                                        const params = new URLSearchParams()
                                        params.set('systemType', systemType)
                                        params.set('zoneId', zoneId)
                                        if (searchTerm) params.set('search', searchTerm)
                                        if (displayInternalCode) params.set('internalCode', 'true')
                                        if (pageBreakZoneIds.size > 0) params.set('pageBreaks', Array.from(pageBreakZoneIds).join(','))
                                        window.open(`/print/warehouse-map?${params.toString()}`, '_blank')
                                    }}
                                />
                            </div>
                        )
                    })()
                )}
            </div>
            <MapFloatingControls
                isMapControlsOpen={isMapControlsOpen}
                setIsMapControlsOpen={setIsMapControlsOpen}
                zones={zones}
                filteredZones={filteredZones}
                filteredPositions={filteredPositions}
                setCollapsedZones={setCollapsedZones}
                isGrouped={isGrouped}
                setIsGrouped={setIsGrouped}
                mergedZones={mergedZones}
                setMergedZones={setMergedZones}
                loosePositions={loosePositions}
                setAllLooseStatus={setAllLooseStatus}
            />
            {/* Spacer to prevent MultiSelectActionBar from covering the last items */}
            {selectedPositionIds.size > 0 && <div className="h-48 md:h-64 print:hidden" />}

            <MultiSelectActionBar
                selectedPositionIds={selectedPositionIds}
                positions={positions}
                lotInfo={lotInfo}
                onClear={() => setSelectedPositionIds(new Set())}
                onExportOrder={handleExportOrder}
                onBulkExport={handleBulkExport}
                onBulkPrint={handleBulkPrint}
                onBulkEditDates={handleOpenBulkEditDates}
                onTag={(lotIds) => setTaggingLotIds(lotIds)}
                onDeleteTags={handleBulkDeleteTags}
                onDeleteLot={handleBulkDeleteLot}
                onUnassignPosition={handleBulkUnassignPosition}
                onOpenSelectHall={() => setIsSelectHallOpen(true)}
                onOpenMove={() => setIsMoveModalOpen(true)}
                onOpenAutoAssignWarehouse={() => setIsAutoAssignModalOpen(true)}
                onBulkAssignPosition={handleOpenBulkAssignPosition}
                onCloneLot={handleCloneLot}
                onBulkChangeProduct={handleOpenBulkChangeProduct}
                onBulkChangeUnit={handleOpenBulkChangeUnit}
                onToggleMark={(posIds) => toggleMark(posIds)}
                onOpenMarkModal={(posIds) => setBulkMarkTargetIds(posIds)}
                onUnmarkPositions={(posIds) => unmarkPositions(posIds)}
                isMarked={(id) => isMarked(id)}
                onToggleLock={(posIds) => toggleLock(posIds)}
                isLocked={(id) => isLocked(id)}
                onOpenLooseModal={(posIds) => handleOpenLooseModal(posIds)}
                onExportExcel={handleExportSelectedExcel}
            />

            {isBulkChangeProductOpen && (
                <LotBulkChangeProductModal
                    lotIds={bulkChangeLotIds || Array.from(selectedLotIds)}
                    preselectedProductId={preselectedProductId}
                    products={products}
                    onClose={() => {
                        setIsBulkChangeProductOpen(false)
                        setBulkChangeLotIds(null)
                    }}
                    onSuccess={() => {
                        setIsBulkChangeProductOpen(false)
                        setBulkChangeLotIds(null)
                        fetchData()
                        setSelectedPositionIds(new Set())
                    }}
                />
            )}

            {isBulkChangeUnitOpen && (
                <LotBulkChangeUnitModal
                    lotIds={bulkChangeUnitLotIds || []}
                    lotPositionStats={bulkChangeUnitStats}
                    onClose={() => {
                        setIsBulkChangeUnitOpen(false)
                        setBulkChangeUnitLotIds(null)
                        setBulkChangeUnitStats({})
                    }}
                    onSuccess={() => {
                        setIsBulkChangeUnitOpen(false)
                        setBulkChangeUnitLotIds(null)
                        setBulkChangeUnitStats({})
                        fetchData()
                        setSelectedPositionIds(new Set())
                    }}
                />
            )}

            {isBulkEditDatesOpen && (
                <LotBulkEditDatesModal
                    lotIds={bulkEditDateLotIds || []}
                    selectedLots={(bulkEditDateLotIds || []).map(id => lotInfo[id]).filter(Boolean)}
                    onClose={() => {
                        setIsBulkEditDatesOpen(false)
                        setBulkEditDateLotIds(null)
                    }}
                    onSuccess={() => {
                        setIsBulkEditDatesOpen(false)
                        setBulkEditDateLotIds(null)
                        fetchData()
                        setSelectedPositionIds(new Set())
                    }}
                />
            )}

            {isBulkAssignPositionOpen && bulkAssignPositionLotIds && bulkAssignPositionLotIds.length > 0 && (
                <LotBulkAssignModal
                    selectedLotIds={bulkAssignPositionLotIds}
                    selectedLots={bulkAssignPositionLotIds.map(id => {
                        const lotPos = positions.filter(p => p.lot_id === id)
                        return {
                            id,
                            code: lotInfo[id]?.code || id,
                            positions: lotPos.map(p => ({ id: p.id, code: p.code }))
                        } as any
                    })}
                    onClose={() => {
                        setIsBulkAssignPositionOpen(false)
                        setBulkAssignPositionLotIds(null)
                    }}
                    onSuccess={(close = true) => {
                        setSelectedPositionIds(new Set())
                        if (close) {
                            setIsBulkAssignPositionOpen(false)
                            setBulkAssignPositionLotIds(null)
                        }
                        fetchData()
                    }}
                />
            )}

            <SelectWarehouseModal
                isOpen={isAutoAssignModalOpen}
                onClose={() => setIsAutoAssignModalOpen(false)}
                onConfirm={handleAutoAssignWarehouse}
                zones={zones}
            />

            <SelectHallModal
                isOpen={isSelectHallOpen}
                onClose={() => setIsSelectHallOpen(false)}
                onConfirm={handleMoveToHall}
                zones={zones}
            />

            <SelectMoveDestinationModal
                isOpen={isMoveModalOpen}
                onClose={() => setIsMoveModalOpen(false)}
                onConfirm={handleMoveItems}
                zones={zones}
                positions={positions}
                selectedPositions={selectedPositions}
            />

            {bulkPrintLotIds && (
                <LotBulkPrintModal
                    lotIds={bulkPrintLotIds}
                    onClose={() => setBulkPrintLotIds(null)}
                />
            )}

            {bulkCloningLot && (
                <LotBulkCloneModal
                    lot={bulkCloningLot}
                    onClose={() => setBulkCloningLot(null)}
                    onSuccess={() => {
                        setBulkCloningLot(null)
                        fetchData()
                    }}
                />
            )}

            {isBulkExportOpen && (
                <QuickBulkExportModal
                    lotIds={Array.from(selectedLotIds)}
                    onClose={() => setIsBulkExportOpen(false)}
                    onSuccess={() => {
                        setIsBulkExportOpen(false)
                        fetchData()
                        setSelectedPositionIds(new Set())
                    }}
                    lotInfo={lotInfo}
                />
            )}

            <CreateExportTaskModal
                isOpen={isExportOrderModalOpen}
                initialData={exportOrderModalData}
                onClose={() => setIsExportOrderModalOpen(false)}
                onSuccess={() => {
                    setIsExportOrderModalOpen(false)
                    fetchData()
                    setSelectedPositionIds(new Set())
                }}
            />

            {configuringZone && (
                <div className="fixed bottom-6 right-6 z-100 animate-in slide-in-from-right-8">
                    <LayoutConfigPanel
                        zone={configuringZone}
                        layout={layouts.find(l => l.zone_id === configuringZone.id) || null}
                        siblingZones={zones.filter(z => z.parent_id === configuringZone.parent_id)}
                        allZones={zones}
                        allLayouts={layoutRecord}
                        onSave={(layout) => {
                            handleLayoutSave(layout)
                        }}
                        onBatchSave={handleBatchLayoutSave}
                        onClose={() => setConfiguringZone(null)}
                    />
                </div>
            )}

            {taggingLotIds && (
                <LotTagModal
                    lotIds={taggingLotIds}
                    onClose={() => setTaggingLotIds(null)}
                    onSuccess={() => {
                        setTaggingLotIds(null)
                        taggingLotIds.forEach(id => refreshLotInfo(id))
                    }}
                />
            )}

            {viewingLot && (
                <LotDetailsModal
                    lot={viewingLot}
                    onClose={() => setViewingLot(null)}
                    onOpenQr={(lot) => {
                        setQrLot(lot);
                        setViewingLot(null);
                    }}
                    isModuleEnabled={isModuleEnabled}
                />
            )}

            {qrLot && (
                <QrCodeModal
                    lot={qrLot as any}
                    onClose={() => setQrLot(null)}
                />
            )}

            {PositionActionUI()}

            <WarehouseHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                currentPositions={filteredPositions.map(p => ({
                    id: p.id,
                    lot_id: p.lot_id,
                    code: (p as any).code || (p as any).position_code || p.id,
                    lot_code: lotInfo[p.lot_id || '']?.lot_code || null
                }))}
            />

            {/* Bulk Mark Position Modal */}
            {bulkMarkTargetIds && (
                <MarkPositionModal
                    isOpen={true}
                    onClose={() => setBulkMarkTargetIds(null)}
                    positions={positions.filter(p => bulkMarkTargetIds.includes(p.id))}
                    currentNote={bulkMarkTargetIds.length === 1 ? getMarkNote(bulkMarkTargetIds[0]) : ''}
                    isAlreadyMarked={bulkMarkTargetIds.every(id => isMarked(id))}
                    onConfirm={(note) => {
                        markPositions(bulkMarkTargetIds, note)
                        setBulkMarkTargetIds(null)
                    }}
                    onUnmark={() => {
                        unmarkPositions(bulkMarkTargetIds)
                        setBulkMarkTargetIds(null)
                    }}
                />
            )}

            {/* Loose Position Modal */}
            {looseModalTargetPositions && (
                <LoosePositionModal
                    isOpen={true}
                    onClose={() => setLooseModalTargetPositions(null)}
                    positions={looseModalTargetPositions}
                    currentConfig={looseModalTargetPositions.length === 1 ? getLooseConfig(looseModalTargetPositions[0].id) : null}
                    isAlreadyLoose={looseModalTargetPositions.some(p => isLoose(p.id))}
                    products={products}
                    onConfirm={(config) => {
                        setLoose(looseModalTargetPositions.map(p => p.id), config)
                        setLooseModalTargetPositions(null)
                        setSelectedPositionIds(new Set())
                    }}
                    onRemoveLoose={() => {
                        removeLoose(looseModalTargetPositions.map(p => p.id))
                        setLooseModalTargetPositions(null)
                        setSelectedPositionIds(new Set())
                    }}
                />
            )}

            {/* Marked Positions Manager Modal */}
            <MarkedPositionsListModal
                isOpen={isMarkedListModalOpen}
                onClose={() => setIsMarkedListModalOpen(false)}
                positions={positions}
                lotInfo={lotInfo}
                zones={zones}
                markedPositionIds={markedPositionIds}
                markedNotes={markedNotes}
                onUpdateNote={(posIdOrIds, note) => updateMarkNote(posIdOrIds, note)}
                onUnmark={(posIdOrIds) => unmarkPositions(Array.isArray(posIdOrIds) ? posIdOrIds : [posIdOrIds])}
                onClearAll={clearAllMarks}
                onExportExcel={() => exportMarkedExcel(positions, lotInfo, zones)}
                onPrint={printMarked}
                onSelectPosition={(posId) => {
                    setSelectedPositionIds(new Set([posId]))
                    if (typeof document !== 'undefined') {
                        const el = document.getElementById(`pos-${posId}`) || document.getElementById(posId)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                }}
            />

            {/* Warehouse Adjustment Proposals Review Modal */}
            <WarehouseAdjustmentReviewModal
                isOpen={isProposalsModalOpen}
                onClose={() => setIsProposalsModalOpen(false)}
                supabase={supabase}
                systemCode={systemType || ''}
                currentUserName={profile?.full_name || profile?.email || 'Quản lý'}
                currentUserId={profile?.id}
                onFocusPosition={handleFocusPosition}
                onStartVisualReview={handleStartVisualReview}
                onProposalApproved={() => {
                    fetchData()
                    refreshProposalCount()
                }}
            />

            {/* Floating Review Dock on Map (Visual Map Review Mode) */}
            {visualReviewProposal && (
                <WarehouseAdjustmentReviewDock
                    proposal={visualReviewProposal}
                    currentIndex={visualReviewIndex}
                    onSelectIndex={(idx) => {
                        setVisualReviewIndex(idx)
                        const target = visualReviewProposal.items[idx]
                        if (target) {
                            handleFocusPositionOnMap(target.position_id, target.position_code)
                        }
                    }}
                    onClose={() => {
                        setVisualReviewProposal(null)
                        showToast('Đã đóng Chế độ duyệt trên bản đồ', 'info')
                    }}
                    onApproveItem={handleApproveVisualItem}
                    onApproveAll={handleApproveAllVisualProposal}
                    onFocusPosition={handleFocusPositionOnMap}
                    onExpandProposalZones={handleExpandProposalZones}
                    isProcessing={isProcessingVisualReview}
                />
            )}
        </div>
    )
}

export default function WarehouseMapPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>}>
            <WarehouseMapContent />
        </Suspense>
    )
}
