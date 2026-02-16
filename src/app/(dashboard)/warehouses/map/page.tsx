'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { useToast } from '@/components/ui/ToastProvider'
import MultiSelectActionBar from '@/components/warehouse/map/MultiSelectActionBar'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import LayoutConfigPanel from '@/components/warehouse/LayoutConfigPanel'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { useSystem } from '@/contexts/SystemContext'
import { LotTagModal } from '@/components/lots/LotTagModal'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { QuickBulkExportModal } from '@/components/warehouse/map/QuickBulkExportModal'
import { usePositionActionManager } from '@/components/warehouse/map/PositionActionManager'
import { MapFilterBar } from '@/components/warehouse/map/MapFilterBar'
import { useWarehouseData } from './_hooks/useWarehouseData'
import { useMapFilters } from './_hooks/useMapFilters'
import { MapHeader } from './_components/MapHeader'
import { MapBanners } from './_components/MapBanners'
import { ZoneCollapseControls } from './_components/ZoneCollapseControls'
import { MapSearchStats } from './_components/MapSearchStats'

type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

function WarehouseMapContent() {
    const { showToast } = useToast()
    const { systemType, currentSystem } = useSystem()
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
        totalZones
    } = useWarehouseData()

    // 2. Filter Hook
    const {
        selectedZoneId, setSelectedZoneId,
        searchTerm, setSearchTerm,
        dateFilterField, setDateFilterField,
        startDate, setStartDate,
        endDate, setEndDate,
        filteredPositions,
        filteredZones
    } = useMapFilters({ positions, zones, lotInfo })

    // 3. UI State
    const [isMobile, setIsMobile] = useState(false)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [isDesignMode, setIsDesignMode] = useState(false)
    const [assignLot, setAssignLot] = useState<{ id: string, code: string } | null>(null)
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())
    const [configuringZone, setConfiguringZone] = useState<Zone | null>(null)

    // Multi-select & Modals
    const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(new Set())
    const [isBulkExportOpen, setIsBulkExportOpen] = useState(false)
    const [taggingLotId, setTaggingLotId] = useState<string | null>(null)
    const [viewingLot, setViewingLot] = useState<any>(null)
    const [qrLot, setQrLot] = useState<any>(null)

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

    // --- Action Handlers ---

    function handlePositionSelect(positionId: string) {
        if (assignLot && assignLotId) {
            // Assignment Logic
            const pos = positions.find(p => p.id === positionId)
            if (!pos) return

            const isAssignedToThisLot = pos.lot_id === assignLotId
            const newLotId = isAssignedToThisLot ? null : assignLotId

            // Optimistic update
            setPositions(prev => prev.map(p =>
                p.id === positionId ? { ...p, lot_id: newLotId } : p
            ))

            // DB Update
            supabase
                .from('positions')
                .update({ lot_id: newLotId } as any)
                .eq('id', positionId)
                .then(({ error }) => {
                    if (error) {
                        console.warn('Update position error:', error)
                        const rawMsg = (error as any)?.message || ''
                        let displayMsg = rawMsg || 'Có lỗi xảy ra khi cập nhật vị trí'
                        if (rawMsg.includes('unique_lot_in_positions') || rawMsg.includes('duplicate key')) {
                            displayMsg = 'LOT này đã được gán ở vị trí khác! Vui lòng gỡ bỏ khỏi vị trí cũ trước.'
                        }
                        showToast(displayMsg, 'error')
                        fetchData()
                    }
                })
        } else {
            // Multi-select toggle
            setSelectedPositionIds(prev => {
                const next = new Set(prev)
                if (next.has(positionId)) next.delete(positionId)
                else next.add(positionId)
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
            return allModules.has(moduleId)
        }
    }, [currentSystem, viewingLot])

    const { handlePositionMenu, PositionActionUI } = usePositionActionManager({
        currentSystemCode: currentSystem?.code,
        isModuleEnabled,
        onRefreshMap: fetchData
    })

    async function fetchFullLotDetails(lotId: string) {
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`*, created_at, suppliers(name), qc_info(name), lot_items(id, quantity, unit, products(name, sku, unit)), positions(code), lot_tags(tag, lot_item_id)`)
                .eq('id', lotId)
                .single()
            if (error) throw error
            setViewingLot(data)
        } catch (error: any) {
            console.error('Error fetching lot details:', error)
            showToast('Không thể tải chi tiết LOT: ' + error.message, 'error')
        }
    }

    // --- Layout Handlers ---

    function toggleZoneCollapse(zoneId: string) {
        setCollapsedZones(prev => {
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
        setConfiguringZone(null)
    }

    function handleExportOrder(positionIds: string[], lotIds: string[]) {
        const params = new URLSearchParams()
        if (positionIds.length > 0) params.set('posIds', positionIds.join(','))
        if (lotIds.length > 0) params.set('lotIds', lotIds.join(','))
        router.push(`/work/export-order?${params.toString()}`)
    }

    // --- Render ---

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
            />

            <MapBanners
                isDesignMode={isDesignMode}
                assignLot={assignLot}
            />

            <MapFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
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
            />

            <MapSearchStats
                filteredPositions={filteredPositions}
                zones={zones}
                lotInfo={lotInfo}
                searchTerm={searchTerm}
            />

            {/* Map Grid Area */}
            <div className="space-y-4">
                <div className="flex justify-end">
                    <ZoneCollapseControls
                        onExpandAll={() => setCollapsedZones(new Set())}
                        onCollapseAll={() => setCollapsedZones(new Set(zones.map(z => z.id)))}
                    />
                </div>

                <div className="min-w-0">
                    <FlexibleZoneGrid
                        zones={filteredZones}
                        positions={filteredPositions}
                        layouts={layoutRecord}
                        lotInfo={lotInfo}
                        occupiedIds={occupiedIds}
                        selectedPositionIds={selectedPositionIds}
                        collapsedZones={collapsedZones}
                        onToggleCollapse={toggleZoneCollapse}
                        onPositionSelect={handlePositionSelect}
                        onViewDetails={(lotId) => fetchFullLotDetails(lotId)}
                        isDesignMode={isDesignMode}
                        onConfigureZone={setConfiguringZone}
                        isAssignmentMode={!!assignLot}
                        highlightingPositionIds={recentlyUpdatedPositionIds}
                    />
                </div>
            </div>

            {/* Modals & Overlays */}

            <MultiSelectActionBar
                selectedPositionIds={selectedPositionIds}
                positions={positions}
                lotInfo={lotInfo}
                onClear={() => setSelectedPositionIds(new Set())}
                onExportOrder={handleExportOrder}
                onBulkExport={() => setIsBulkExportOpen(true)}
                onTag={(lotId) => setTaggingLotId(lotId)}
            />

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
                <LayoutConfigPanel
                    zone={configuringZone}
                    layout={layouts.find(l => l.zone_id === configuringZone.id) || null}
                    onSave={handleLayoutSave}
                    onClose={() => setConfiguringZone(null)}
                />
            )}

            {taggingLotId && (
                <LotTagModal
                    lotId={taggingLotId}
                    onClose={() => setTaggingLotId(null)}
                    onSuccess={() => {
                        setTaggingLotId(null)
                        refreshLotInfo(taggingLotId)
                    }}
                />
            )}

            {viewingLot && (
                <LotDetailsModal
                    lot={viewingLot}
                    onClose={() => setViewingLot(null)}
                    onOpenQr={(lot) => setQrLot(lot)}
                    isModuleEnabled={isModuleEnabled}
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
