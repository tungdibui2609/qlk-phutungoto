'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { ChevronUp, ChevronDown, Layers, X, Maximize2 } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import MultiSelectActionBar from '@/components/warehouse/map/MultiSelectActionBar'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import LayoutConfigPanel from '@/components/warehouse/LayoutConfigPanel'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { useSystem } from '@/contexts/SystemContext'
import { LotTagModal } from '@/components/lots/LotTagModal'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { QrCodeModal } from '@/app/(dashboard)/warehouses/lots/_components/QrCodeModal'
import { QuickBulkExportModal } from '@/components/warehouse/map/QuickBulkExportModal'
import { usePositionActionManager } from '@/components/warehouse/map/PositionActionManager'
import { MapFilterBar } from '@/components/warehouse/map/MapFilterBar'
import { useWarehouseData } from './_hooks/useWarehouseData'
import { useMapFilters } from './_hooks/useMapFilters'
import { MapHeader } from './_components/MapHeader'
import { MapBanners } from './_components/MapBanners'
import { ZoneCollapseControls } from './_components/ZoneCollapseControls'
import { MapSearchStats } from './_components/MapSearchStats'
import { LotBulkPrintModal } from '@/components/warehouse/map/LotBulkPrintModal'
import { SelectWarehouseModal } from '@/components/warehouse/map/SelectWarehouseModal'
import { SelectHallModal } from '@/components/warehouse/map/SelectHallModal'
import { SelectMoveDestinationModal } from '@/components/warehouse/map/SelectMoveDestinationModal'
import { groupWarehouseData, sortPositionsByBinPriority } from '@/lib/warehouseUtils'

type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

function WarehouseMapContent() {
    const { showToast, showConfirm } = useToast()
    const { systemType, currentSystem, hasModule } = useSystem()
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

    // 2. Filter Hook
    const {
        selectedZoneId, setSelectedZoneId,
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
        setHidePendingExport
    } = useMapFilters({ positions, zones, lotInfo, isFifoEnabled: hasModule('fifo_priority'), pendingExportPosIds })

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
    const [taggingLotIds, setTaggingLotIds] = useState<string[] | null>(null)
    const [viewingLot, setViewingLot] = useState<any>(null)
    const [qrLot, setQrLot] = useState<any>(null)
    const [bulkPrintLotIds, setBulkPrintLotIds] = useState<string[] | null>(null)
    const [isMapControlsOpen, setIsMapControlsOpen] = useState(false)
    const [pageBreakZoneIds, setPageBreakZoneIds] = useState<Set<string>>(new Set())
    const [isGrouped, setIsGrouped] = useState(true)
    const [mergedZones, setMergedZones] = useState<Set<string>>(new Set())

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

    function handlePositionSelect(positionIdOrIds: string | string[]) {
        const targetIds = Array.isArray(positionIdOrIds) ? positionIdOrIds : [positionIdOrIds]

        if (assignLot && assignLotId) {
            // Assignment / Move Logic - focusing on first ID if multi-select but usually it should be single action applied to all
            // For now, let's just handle the first one or apply to all if it makes sense. 
            // In assignment mode, usually we assign ONE lot to ONE or MORE positions.

            const isMoveMode = searchParams.get('mode') === 'move'
            if (isMoveMode) {
                // Move logic for multiple positions: 
                // If targeting a virtual cell, we clear current lot from its old positions and move to ALL real IDs in the target cell?
                // Actually, move usually means move ONE lot from old pos to ONE new pos. 
                // If it's a virtual cell, it might be confusing. For now, let's keep it simple: take the first ID.
                const positionId = targetIds[0]
                if (occupiedIds.has(positionId)) {
                    showToast('Vị trí này đã có hàng, vui lòng chọn một vị trí trống khác.', 'warning')
                    return
                }

                // 1. Find the old position(s) of this lot and clear them
                const oldPositions = positions.filter(p => p.lot_id === assignLotId)
                const updates: { id: string, lot_id: string | null }[] = []
                oldPositions.forEach(p => updates.push({ id: p.id, lot_id: null }))

                // 2. Assign to the newly selected position(s)
                targetIds.forEach(id => updates.push({ id, lot_id: assignLotId }))

                // Optimistic UI update
                setPositions(prev => prev.map(p => {
                    const upd = updates.find(u => u.id === p.id)
                    return upd ? { ...p, lot_id: upd.lot_id } : p
                }))

                // DB Updates
                const updatePromises = (updates as any[]).map((u: any) =>
                    ((supabase as any).from('positions').update({ lot_id: u.lot_id }).eq('id', u.id) as any)
                )

                Promise.all(updatePromises).then(results => {
                    const hasError = results.some(r => r.error)
                    if (hasError) {
                        showToast('Có lỗi xảy ra khi dời vị trí!', 'error')
                        fetchData()
                    } else {
                        showToast('Đã dời vị trí thành công!', 'success')
                        router.push('/warehouses/map')
                    }
                })

                return
            }

            // Normal Assignment Mode (Toggle)
            const firstPos = positions.find(p => p.id === targetIds[0])
            const isAssignedToThisLot = firstPos?.lot_id === assignLotId
            const newLotId = isAssignedToThisLot ? null : assignLotId

            // Optimistic update
            setPositions(prev => prev.map(p =>
                targetIds.includes(p.id) ? { ...p, lot_id: newLotId } : p
            ))

            // DB Update
            const promises = (targetIds as any[]).map((id: any) =>
                ((supabase as any).from('positions').update({ lot_id: newLotId }).eq('id', id) as any)
            )

            Promise.all(promises).then(results => {
                const hasError = results.some(r => r.error)
                if (hasError) {
                    showToast('Có lỗi xảy ra khi cập nhật vị trí', 'error')
                    fetchData()
                }
            })
        } else {
            // Multi-select toggle
            setSelectedPositionIds(prev => {
                const next = new Set(prev)
                const allSelected = targetIds.every(id => next.has(id))

                if (allSelected) {
                    targetIds.forEach(id => next.delete(id))
                } else {
                    targetIds.forEach(id => next.add(id))
                }
                return next
            })
        }
    }

    const selectedPositions = useMemo(() => {
        return positions.filter(p => selectedPositionIds.has(p.id))
    }, [positions, selectedPositionIds])

    const selectedLotIds = useMemo(() => {
        const lotIds = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIds.add(p.lot_id)
        })
        return lotIds
    }, [selectedPositions])

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

    const { handlePositionMenu, PositionActionUI } = usePositionActionManager({
        currentSystemCode: currentSystem?.code,
        onRefreshMap: fetchData,
        onRefreshLot: refreshLotInfo
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

    function handleExportOrder(positionIds: string[], lotIds: string[]) {
        const params = new URLSearchParams()
        if (positionIds.length > 0) params.set('posIds', positionIds.join(','))
        if (lotIds.length > 0) params.set('lotIds', lotIds.join(','))
        router.push(`/work/export-order?${params.toString()}`)
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

    const handleBulkDeleteLot = async (lotIds: string[]) => {
        if (!lotIds.length) return
        if (!await showConfirm(`Bạn có chắc chắn muốn xóa ${lotIds.length} LOT đã chọn?`)) return

        try {
            const chunkSize = 500;
            for (let i = 0; i < lotIds.length; i += chunkSize) {
                const chunk = lotIds.slice(i, i + chunkSize);

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

            // Refresh map data
            fetchData()
            setSelectedPositionIds(new Set())
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

    async function handleMoveToHall(hallId: string) {
        setIsSelectHallOpen(false)
        if (selectedPositionIds.size === 0) return

        // Get lot IDs to move
        const lotIdsToMove = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIdsToMove.add(p.lot_id)
        })

        if (lotIdsToMove.size === 0) return

        // Find all descendant zones of the selected Hall (including the Hall itself)
        const hallZoneIds = new Set<string>([hallId])
        let added = true
        while (added) {
            added = false
            for (const z of zones) {
                if (z.parent_id && hallZoneIds.has(z.parent_id) && !hallZoneIds.has(z.id)) {
                    hallZoneIds.add(z.id)
                    added = true
                }
            }
        }

        // Find available positions in the Hall's zones
        // Find available positions in the Hall's zones and sort by Bin-priority
        const rawAvailable = positions.filter(p => p.zone_id && hallZoneIds.has(p.zone_id) && !p.lot_id)
        const availablePositions = sortPositionsByBinPriority(rawAvailable as any[])

        if (availablePositions.length < lotIdsToMove.size) {
            showToast(`Không đủ vị trí trống trong Sảnh này. Cần ${lotIdsToMove.size}, nhưng chỉ còn ${availablePositions.length} vị trí.`, 'error')
            return
        }

        const lotsArr = Array.from(lotIdsToMove)
        const oldPosIdsToClear = selectedPositions.filter(p => p.lot_id).map(p => p.id)
        
        const clearUpdates: any[] = oldPosIdsToClear.map(id => ({ id, lot_id: null }))
        const assignUpdates: any[] = lotsArr.map((lotId, i) => ({ id: availablePositions[i].id, lot_id: lotId }))

        // Optimistic UI update
        setPositions(prev => prev.map(p => {
            const clearUpd = clearUpdates.find(u => u.id === p.id)
            if (clearUpd) return { ...p, lot_id: null }
            const assignUpd = assignUpdates.find(u => u.id === p.id)
            if (assignUpd) return { ...p, lot_id: assignUpd.lot_id }
            return p
        }))

        // DB Updates
        try {
            const chunkSize = 20; // Smaller chunks for individual updates to avoid massive parallel overhead
            
            // Phase 1: Clear old positions
            for (let i = 0; i < clearUpdates.length; i += chunkSize) {
                const chunk = clearUpdates.slice(i, i + chunkSize);
                const results = await Promise.all(
                    (chunk as any[]).map((u: any) => ((supabase as any).from('positions').update({ lot_id: null }).eq('id', u.id) as any))
                )
                const error = (results as any).find((r: any) => r.error)?.error
                if (error) throw error
            }

            // Phase 2: Assign to new positions
            for (let i = 0; i < assignUpdates.length; i += chunkSize) {
                const chunk = assignUpdates.slice(i, i + chunkSize);
                const results = await Promise.all(
                    (chunk as any[]).map((u: any) => ((supabase as any).from('positions').update({ lot_id: u.lot_id }).eq('id', u.id) as any))
                )
                const error = (results as any).find((r: any) => r.error)?.error
                if (error) throw error
            }

            showToast('Đã di chuyển hàng thành công!', 'success')
            setSelectedPositionIds(new Set())
            fetchData()
        } catch (error: any) {
            console.error('Move to Hall error:', error)
            showToast('Lỗi khi di chuyển: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    async function handleMoveItems(targetZoneId: string) {
        setIsMoveModalOpen(false)
        if (selectedPositionIds.size === 0) return

        // Get lot IDs to move
        const lotIdsToMove = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIdsToMove.add(p.lot_id)
        })

        if (lotIdsToMove.size === 0) return

        // Find all descendant zones of the selected target Zone (including the target itself)
        const targetZoneIds = new Set<string>([targetZoneId])
        let added = true
        while (added) {
            added = false
            for (const z of zones) {
                if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) {
                    targetZoneIds.add(z.id)
                    added = true
                }
            }
        }

        // Find available positions in the target Zone's descendant zones
        // Find available positions in the target Zone's descendant zones and sort by Bin-priority
        const rawAvailable = positions.filter(p => p.zone_id && targetZoneIds.has(p.zone_id) && !p.lot_id)
        const availablePositions = sortPositionsByBinPriority(rawAvailable as any[])

        console.log(`Moving items: targetZoneId=${targetZoneId}, descendantZones=${targetZoneIds.size}, available=${availablePositions.length}, toMove=${lotIdsToMove.size}`)

        if (availablePositions.length < lotIdsToMove.size) {
            showToast(`Không đủ vị trí trống trong Khu vực này. Cần ${lotIdsToMove.size}, nhưng chỉ còn ${availablePositions.length} vị trí.`, 'error')
            return
        }

        const lotsArr = Array.from(lotIdsToMove)
        const oldPosIdsToClear = selectedPositions.filter(p => p.lot_id).map(p => p.id)

        const clearUpdates: any[] = oldPosIdsToClear.map(id => ({ id, lot_id: null }))
        const assignUpdates: any[] = lotsArr.map((lotId, i) => ({ id: availablePositions[i].id, lot_id: lotId }))

        // Optimistic UI update
        setPositions(prev => prev.map(p => {
            const clearUpd = clearUpdates.find(u => u.id === p.id)
            if (clearUpd) return { ...p, lot_id: null }
            const assignUpd = assignUpdates.find(u => u.id === p.id)
            if (assignUpd) return { ...p, lot_id: assignUpd.lot_id }
            return p
        }))

        // DB Updates
        try {
            const chunkSize = 20;

            // Phase 1: Clear old positions
            for (let i = 0; i < clearUpdates.length; i += chunkSize) {
                const chunk = clearUpdates.slice(i, i + chunkSize);
                const results = await Promise.all(
                    (chunk as any[]).map((u: any) => ((supabase as any).from('positions').update({ lot_id: null }).eq('id', u.id) as any))
                )
                const error = (results as any).find((r: any) => r.error)?.error
                if (error) throw error
            }

            // Phase 2: Assign to new positions
            for (let i = 0; i < assignUpdates.length; i += chunkSize) {
                const chunk = assignUpdates.slice(i, i + chunkSize);
                const results = await Promise.all(
                    (chunk as any[]).map((u: any) => ((supabase as any).from('positions').update({ lot_id: u.lot_id }).eq('id', u.id) as any))
                )
                const error = (results as any).find((r: any) => r.error)?.error
                if (error) throw error
            }

            showToast('Đã di chuyển hàng thành công!', 'success')
            setSelectedPositionIds(new Set())
            fetchData()
        } catch (error: any) {
            console.error('Move Items error:', error)
            showToast('Lỗi khi di chuyển: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
        }
    }

    async function handleAutoAssignWarehouse(warehouseId: string) {
        setIsAutoAssignModalOpen(false)
        if (selectedPositionIds.size === 0) return

        // 1. Get unique lots from selected positions
        const lotIdsToMove = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIdsToMove.add(p.lot_id)
        })

        if (lotIdsToMove.size === 0) {
            showToast('Không có LOT nào trong các ô được chọn.', 'warning')
            return
        }

        // 2. Find all Halls under the selected Warehouse (Root Zone)
        // Get all descendant zones first
        const allDescendants = new Set<string>([warehouseId])
        let added = true
        while (added) {
            added = false
            for (const z of zones) {
                if (z.parent_id && allDescendants.has(z.parent_id) && !allDescendants.has(z.id)) {
                    allDescendants.add(z.id)
                    added = true
                }
            }
        }

        // Filter Halls among descendants and sort by name
        const warehouseHalls = zones
            .filter(z => allDescendants.has(z.id) && (z as any).is_hall)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))

        if (warehouseHalls.length === 0) {
            showToast('Kho này chưa được cấu hình Sảnh.', 'error')
            return
        }

        // 3. Collect empty positions from each hall sequentially
        let availablePositions: any[] = []
        for (const hall of warehouseHalls) {
            // Find all descendant zones of this hall
            const hallZoneIds = new Set<string>([hall.id])
            let hAdded = true
            while (hAdded) {
                hAdded = false
                for (const z of zones) {
                    if (z.parent_id && hallZoneIds.has(z.parent_id) && !hallZoneIds.has(z.id)) {
                        hallZoneIds.add(z.id)
                        hAdded = true
                    }
                }
            }

            const rawHallPositions = positions.filter(p => p.zone_id && hallZoneIds.has(p.zone_id) && !p.lot_id)
            const sortedHallPositions = sortPositionsByBinPriority(rawHallPositions as any[])
            availablePositions = [...availablePositions, ...sortedHallPositions]

            if (availablePositions.length >= lotIdsToMove.size) break
        }

        if (availablePositions.length < lotIdsToMove.size) {
            showToast(`Không đủ vị trí trống trong Kho này. Cần ${lotIdsToMove.size}, nhưng chỉ còn ${availablePositions.length} vị trí.`, 'error')
            return
        }

        const lotsArr = Array.from(lotIdsToMove)
        const oldPosIdsToClear = selectedPositions.filter(p => p.lot_id).map(p => p.id)

        const clearUpdates: any[] = oldPosIdsToClear.map(id => ({ id, lot_id: null }))
        const assignUpdates: any[] = lotsArr.map((lotId, i) => ({ id: availablePositions[i].id, lot_id: lotId }))

        // 4. Execute Updates
        try {
            const chunkSize = 20;

            // Phase 1: Clear old positions
            for (let i = 0; i < clearUpdates.length; i += chunkSize) {
                const chunk = clearUpdates.slice(i, i + chunkSize);
                const results = await Promise.all(
                    (chunk as any[]).map((u: any) => ((supabase as any).from('positions').update({ lot_id: null }).eq('id', u.id) as any))
                )
                const error = (results as any).find((r: any) => r.error)?.error
                if (error) throw error
            }

            // Phase 2: Assign to new positions
            for (let i = 0; i < assignUpdates.length; i += chunkSize) {
                const chunk = assignUpdates.slice(i, i + chunkSize);
                const results = await Promise.all(
                    (chunk as any[]).map((u: any) => ((supabase as any).from('positions').update({ lot_id: u.lot_id }).eq('id', u.id) as any))
                )
                const error = (results as any).find((r: any) => r.error)?.error
                if (error) throw error
            }

            showToast(`Đã gán thành công ${lotsArr.length} LOT vào Kho mới!`, 'success')
            setSelectedPositionIds(new Set())
            fetchData()
        } catch (error: any) {
            console.error('Auto Assign error:', error)
            showToast('Lỗi khi gán tự động: ' + (error.message || 'Không xác định'), 'error')
            fetchData()
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

    if (!systemType) return <div>Vui lòng chọn kho hàng.</div>
    if (loading && positions.length === 0) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                totalPositions={totalPositions}
                totalZones={totalZones}
                systemType={systemType}
                selectedZoneId={selectedZoneId}
                searchTerm={searchTerm}
                isDesignMode={isDesignMode}
                setIsDesignMode={setIsDesignMode}
                isMobile={isMobile}
                displayInternalCode={displayInternalCode}
                setDisplayInternalCode={setDisplayInternalCode}
            />

            <MapBanners
                isDesignMode={isDesignMode}
                assignLot={assignLot}
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
                    />
                );
            })()}

            {(() => {
                const { zones: displayZones, positions: displayPositions } = isGrouped
                    ? groupWarehouseData(filteredZones, filteredPositions)
                    : { zones: filteredZones, positions: filteredPositions }

                return (
                    <MapSearchStats
                        filteredPositions={displayPositions}
                        zones={displayZones}
                        lotInfo={lotInfo}
                        searchTerm={searchTerm}
                        onPositionSelect={handlePositionSelect}
                        onPositionMenu={(pos, e) => handlePositionMenu(pos, e)}
                        onViewDetails={fetchFullLotDetails}
                        selectedPositionIds={selectedPositionIds}
                        onBulkSelect={handleBulkSelect}
                        isFifoEnabled={isFifoActive}
                        isFifoAvailable={isFifoAvailable}
                        onToggleFifo={toggleFifo}
                        isGrouped={isGrouped}
                    />
                )
            })()}

            {/* Map Grid Area - Hide when searching */}
            {!searchTerm && (
                <div className="space-y-4">
                    {/* Process grouped data if enabled */}
                    {(() => {
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
                    })()}
                </div>
            )}
            <div className="fixed bottom-6 right-6 z-[60] shadow-2xl transition-all duration-300 hover:scale-[1.02] flex justify-end">
                {!isMapControlsOpen ? (
                    <button
                        onClick={() => setIsMapControlsOpen(true)}
                        className="bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100 rounded-full p-3 shadow-lg hover:scale-110 transition flex items-center justify-center border border-slate-600 dark:border-slate-500 hover:bg-slate-700 dark:hover:bg-slate-600 animate-in fade-in"
                        title="Mở công cụ bản đồ"
                    >
                        <Layers size={22} className="text-emerald-400" />
                    </button>
                ) : (
                    <div className="flex bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full p-1 border border-slate-200 dark:border-slate-700 shadow-sm animate-in zoom-in-95 duration-200">
                        {/* Mở rộng Group */}
                        <div className="flex relative items-center mr-1 pr-2 border-r border-slate-300 dark:border-slate-600">
                            <span className="text-[10px] text-slate-500 font-bold px-3 uppercase tracking-wider">Mở</span>
                            <button
                                onClick={() => {
                                    // Mở Cấp 1: Xóa Root(Kho) khỏi Set. Chỉ gập list Dãy/Sảnh.
                                    setCollapsedZones(new Set(zones.filter(z => z.parent_id).map(z => z.id)))
                                }}
                                className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
                                title="Bung list Kho tải các Dãy (Ẩn Vị trí)"
                            >
                                <ChevronDown size={14} />
                                Cấp 1 (Dãy)
                            </button>
                            <button
                                onClick={() => {
                                    // Mở Cấp 2: Show hết sạch
                                    setCollapsedZones(new Set())
                                }}
                                className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-1 flex items-center gap-1 font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                                title="Mở bung toàn bộ mọi Vị trí"
                            >
                                <ChevronDown size={14} />
                                Cấp 2 (Vị trí)
                            </button>
                        </div>

                        {/* Gom ô Group */}
                        <div className="flex relative items-center ml-1 pl-2 border-l border-slate-300 dark:border-slate-600">
                            <button
                                onClick={() => setIsGrouped(!isGrouped)}
                                className={`px-3 py-2 rounded-full text-xs transition flex items-center gap-1 font-medium ${isGrouped ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'} border border-transparent`}
                                title={isGrouped ? "Tắt chế độ gom ô" : "Bật chế độ gom ô"}
                            >
                                <Layers size={14} className={isGrouped ? 'text-white' : 'text-indigo-500'} />
                                {isGrouped ? 'Đang Gom ô' : 'Gom ô'}
                            </button>
                            {isGrouped && (
                                <button
                                    onClick={() => {
                                        // Get all displayed zones
                                        const { zones: displayZones } = groupWarehouseData(filteredZones, filteredPositions)
                                        const levelZoneIds = displayZones.filter(z => z.id.startsWith('v-lvl-')).map(z => z.id)
                                        const allMerged = levelZoneIds.every(id => mergedZones.has(id))
                                        if (allMerged) {
                                            // Unmerge all
                                            setMergedZones(new Set())
                                        } else {
                                            // Merge all
                                            setMergedZones(prev => {
                                                const next = new Set(prev)
                                                levelZoneIds.forEach(id => next.add(id))
                                                return next
                                            })
                                        }
                                    }}
                                    className={`px-3 py-2 rounded-full text-xs transition flex items-center gap-1 font-medium ml-1 ${
                                        mergedZones.size > 0
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                                    }`}
                                    title={mergedZones.size > 0 ? "Tắt gộp ô toàn bộ" : "Gộp ô toàn bộ (hàng cồng kềnh)"}
                                >
                                    <Maximize2 size={14} />
                                    {mergedZones.size > 0 ? 'Đang gộp hết' : 'Gộp ô hết'}
                                </button>
                            )}
                        </div>

                        {/* Thu gọn Group */}
                        <div className="flex relative items-center">
                            <span className="text-[10px] text-slate-500 font-bold px-3 uppercase tracking-wider">Thu</span>
                            <button
                                onClick={() => {
                                    // Thu Cấp 1 (Gập Vị trí): Gom tất cả Zone có Parent vào Set
                                    setCollapsedZones(new Set(zones.filter(z => z.parent_id).map(z => z.id)))
                                }}
                                className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1 font-medium"
                                title="Thu gọn Vị trí (Chỉ xem Vỏ Sảnh/Dãy)"
                            >
                                <ChevronUp size={14} className="text-slate-400" />
                                Vị trí
                            </button>
                            <button
                                onClick={() => {
                                    // Thu Cấp 2 (Tất cả): Gom tất cả Root Zone (!z.parent_id) vào Set
                                    const allZoneIds = zones.map(z => z.id)
                                    setCollapsedZones(new Set(allZoneIds))
                                }}
                                className="px-3 py-2 text-slate-600 dark:text-slate-300 rounded-full text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-1 flex items-center gap-1 font-medium"
                                title="Thu gọn Tất cả (Chỉ nhìn thấy Kho)"
                            >
                                <ChevronUp size={14} className="text-slate-400" />
                                Kho
                            </button>

                            {/* Nút Đóng Mini Menu */}
                            <button
                                onClick={() => setIsMapControlsOpen(false)}
                                className="p-1.5 mx-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700"
                                title="Đóng công cụ"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
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
                onTag={(lotIds) => setTaggingLotIds(lotIds)}
                onDeleteTags={handleBulkDeleteTags}
                onDeleteLot={handleBulkDeleteLot}
                onOpenSelectHall={() => setIsSelectHallOpen(true)}
                onOpenMove={() => setIsMoveModalOpen(true)}
                onOpenAutoAssignWarehouse={() => setIsAutoAssignModalOpen(true)}
            />

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
            />

            {bulkPrintLotIds && (
                <LotBulkPrintModal
                    lotIds={bulkPrintLotIds}
                    onClose={() => setBulkPrintLotIds(null)}
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

            {configuringZone && (
                <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8">
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
        </div>
    )
}

export default function WarehouseMapPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
            <WarehouseMapContent />
        </Suspense>
    )
}
