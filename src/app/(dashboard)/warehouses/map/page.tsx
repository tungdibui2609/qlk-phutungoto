'use client'
import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Map, Settings, Package, MapPin } from 'lucide-react'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import LayoutConfigPanel from '@/components/warehouse/LayoutConfigPanel'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { useSystem } from '@/contexts/SystemContext'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

function WarehouseMapContent() {
    const { systemType } = useSystem() // Get systemType
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [layouts, setLayouts] = useState<ZoneLayout[]>([])
    // ... [abbreviated] ...
    const [loading, setLoading] = useState(true)
    // Filter state
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    const searchParams = useSearchParams()
    const router = useRouter()
    const assignLotId = searchParams.get('assignLotId')

    // LOT Assignment State
    const [assignLot, setAssignLot] = useState<{ id: string, code: string } | null>(null)

    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
    const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (assignLotId) {
            fetchLotDetails(assignLotId)
        } else {
            setAssignLot(null)
        }
    }, [assignLotId])

    async function fetchLotDetails(id: string) {
        const { data } = await supabase.from('lots').select('id, code').eq('id', id).single()
        if (data) setAssignLot(data)
    }

    async function handlePositionClick(pos: Position) {
        if (assignLot && assignLotId) {
            // Assignment Logic
            const isAssignedToThisLot = pos.lot_id === assignLotId
            const newLotId = isAssignedToThisLot ? null : assignLotId

            // Optimistic update
            setPositions(prev => prev.map(p =>
                p.id === pos.id ? { ...p, lot_id: newLotId } : p
            ))

            // DB Update
            const { error } = await (supabase
                .from('positions') as any)
                .update({ lot_id: newLotId })
                .eq('id', pos.id)

            if (error) {
                alert('Lỗi cập nhật vị trí: ' + error.message)
                // Revert if error (optional, but good practice)
                fetchData() // Simple revert by refetch
            }
        } else {
            // Normal Selection
            setSelectedPosition(pos)
        }
    }


    // Design mode state
    const [isDesignMode, setIsDesignMode] = useState(false)
    const [configuringZone, setConfiguringZone] = useState<Zone | null>(null)

    // Collapsed zones
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())

    const [lotInfo, setLotInfo] = useState<Record<string, { code: string, product_name: string, unit?: string, sku?: string, inbound_date?: string, created_at?: string, quantity: number }>>({})

    useEffect(() => {
        fetchData()
    }, [systemType]) // Add dependency

    async function fetchData() {
        setLoading(true)

        // Filter positions and zones by system_type
        const [posRes, zoneRes, zpRes, invRes, layoutRes, lotsRes] = await Promise.all([
            supabase.from('positions').select('*').eq('system_type', systemType).order('code'),
            supabase.from('zones').select('*').eq('system_type', systemType).order('level').order('code'),
            supabase.from('zone_positions').select('*'),
            supabase.from('inventory' as any).select('position_id').gt('quantity', 0),
            supabase.from('zone_layouts').select('*'),
            supabase.from('lots').select('id, code, quantity, inbound_date, created_at, products(name, unit, sku)')
        ])

        const posData = posRes.data || []
        const zoneData = zoneRes.data || []
        const zpData = zpRes.data || []
        const invData = invRes.data || []
        const layoutData = layoutRes.data || []
        const lotsData = lotsRes.data || []

        // Map positions with zone_id
        const posWithZone: PositionWithZone[] = (posData as any[]).map(pos => {
            const zp = (zpData as any[]).find(zp => zp.position_id === pos.id)
            return { ...pos, zone_id: zp?.zone_id || null }
        })

        // Build Lot Info Map
        const lotInfoMap: Record<string, { code: string, product_name: string, unit?: string, sku?: string, inbound_date?: string, created_at?: string, quantity: number }> = {};
        (lotsData as any[]).forEach((l: any) => {
            lotInfoMap[l.id] = {
                code: l.code,
                product_name: l.products?.name,
                unit: l.products?.unit,
                sku: l.products?.sku,
                inbound_date: l.inbound_date,
                created_at: l.created_at,
                quantity: l.quantity
            }
        })

        setPositions(posWithZone)
        setZones(zoneData)
        setLayouts(layoutData)
        setLotInfo(lotInfoMap)
        setOccupiedIds(new Set((invData as any[]).map(i => i.position_id)))
        setLoading(false)
    }

    // Filter positions by all filters
    const filteredPositions = useMemo(() => {
        let result = positions

        // Filter by search term
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            result = result.filter(p => {
                const posCode = p.code.toLowerCase()
                const lot = p.lot_id ? lotInfo[p.lot_id] : null
                const lotCode = lot?.code?.toLowerCase() || ''
                const productName = lot?.product_name?.toLowerCase() || ''
                const sku = lot?.sku?.toLowerCase() || ''

                return posCode.includes(term) ||
                    lotCode.includes(term) ||
                    productName.includes(term) ||
                    sku.includes(term)
            })
        }

        // Filter by zone
        if (selectedZoneId) {
            // Get all descendant zone IDs
            const getDescendantIds = (parentId: string): string[] => {
                const children = zones.filter(z => z.parent_id === parentId)
                const descendantIds = children.map(c => c.id)
                children.forEach(child => {
                    descendantIds.push(...getDescendantIds(child.id))
                })
                return descendantIds
            }
            const validZoneIds = new Set([selectedZoneId, ...getDescendantIds(selectedZoneId)])
            result = result.filter(p => p.zone_id && validZoneIds.has(p.zone_id))
        }

        return result
    }, [positions, selectedZoneId, searchTerm, zones, lotInfo])

    // Filter zones to pass to grid
    const filteredZones = useMemo(() => {
        if (!selectedZoneId) return zones

        // Helper to find all descendants
        const getDescendantIds = (parentId: string): Set<string> => {
            const ids = new Set<string>()
            const collect = (pId: string) => {
                const children = zones.filter(z => z.parent_id === pId)
                children.forEach(c => {
                    ids.add(c.id)
                    collect(c.id)
                })
            }
            collect(parentId)
            return ids
        }

        const allowedIds = getDescendantIds(selectedZoneId)
        allowedIds.add(selectedZoneId)

        return zones.filter(z => allowedIds.has(z.id))
    }, [zones, selectedZoneId])

    // Convert layouts array to map for easy lookup
    const layoutsMap = useMemo(() => {
        const map: Record<string, ZoneLayout> = {}
        layouts.forEach(l => { if (l.zone_id) map[l.zone_id] = l })
        return map
    }, [layouts])

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
            if (existing) {
                return prev.map(l => l.zone_id === updatedLayout.zone_id ? updatedLayout : l)
            }
            return [...prev, updatedLayout]
        })
        setConfiguringZone(null)
    }

    function handleBatchSave(updatedLayouts: ZoneLayout[]) {
        setLayouts(prev => {
            const newLayouts = [...prev]
            for (const updated of updatedLayouts) {
                const idx = newLayouts.findIndex(l => l.zone_id === updated.zone_id)
                if (idx >= 0) {
                    newLayouts[idx] = updated
                } else {
                    newLayouts.push(updated)
                }
            }
            return newLayouts
        })
    }

    // Get sibling zones (same parent_id)
    function getSiblingZones(zone: Zone): Zone[] {
        return zones.filter(z => z.parent_id === zone.parent_id)
    }

    // Count stats
    const totalPositions = positions.length
    const totalZones = zones.length

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Map className="text-blue-600" size={28} />
                        Sơ đồ Kho
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {totalPositions} vị trí | {totalZones} zone
                    </p>
                </div>

                {/* Design Mode Toggle */}
                <button
                    onClick={() => setIsDesignMode(!isDesignMode)}
                    className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${isDesignMode
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                >
                    <Settings size={18} />
                    {isDesignMode ? 'Thoát Thiết kế' : 'Thiết kế Layout'}
                </button>
            </div>

            {/* Design mode hint */}
            {isDesignMode && (
                <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                    💡 Bấm nút <strong>"Cấu hình"</strong> trên mỗi zone để điều chỉnh số cột và cách bố trí.
                </div>
            )}

            {/* LOT Assignment Mode Banner */}
            {assignLot && (
                <div className="sticky top-4 z-40 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4 shadow-lg animate-in slide-in-from-top-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-300">
                            <MapPin size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-purple-900 dark:text-purple-100">
                                Đang gán vị trí cho LOT: <span className="font-mono text-lg">{assignLot.code}</span>
                            </h3>
                            <p className="text-sm text-purple-700 dark:text-purple-300">
                                Bấm vào các ô vị trí bên dưới để gán hoặc bỏ gán.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.push('/warehouses/lots')}
                            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors shadow-sm"
                        >
                            Quay lại
                        </button>
                        <button
                            onClick={() => router.push('/warehouses/lots')}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold transition-colors shadow-md shadow-purple-500/20"
                        >
                            Hoàn tất
                        </button>
                    </div>
                </div>
            )}

            {/* Horizontal Zone Filter - Level-based cascading */}
            <HorizontalZoneFilter
                selectedZoneId={selectedZoneId}
                onZoneSelect={setSelectedZoneId}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}

            />

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-6 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-500">Chú thích:</span>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"></div>
                    <span>Trống</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border border-green-400 rounded bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                        <Package size={10} className="text-green-600" />
                    </div>
                    <span>Có hàng</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border border-blue-500 rounded bg-blue-50 dark:bg-blue-900/30"></div>
                    <span>Đang chọn</span>
                </div>
            </div>

            {/* Main Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <p className="text-gray-400">Đang tải...</p>
                </div>
            ) : (
                <FlexibleZoneGrid
                    zones={filteredZones}
                    positions={filteredPositions}
                    layouts={layoutsMap}
                    occupiedIds={occupiedIds}
                    lotInfo={lotInfo}
                    collapsedZones={collapsedZones}
                    selectedPositionId={selectedPosition?.id}
                    isDesignMode={isDesignMode}
                    onToggleCollapse={toggleZoneCollapse}
                    onPositionClick={handlePositionClick}
                    onConfigureZone={setConfiguringZone}
                    highlightLotId={assignLotId}
                />
            )}

            {/* Layout Config Panel (Floating) */}
            {configuringZone && (
                <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-left-5">
                    <LayoutConfigPanel
                        zone={configuringZone}
                        layout={layoutsMap[configuringZone.id] || null}
                        siblingZones={getSiblingZones(configuringZone)}
                        onSave={handleLayoutSave}
                        onBatchSave={handleBatchSave}
                        onClose={() => setConfiguringZone(null)}
                    />
                </div>
            )}

            {/* Selected position detail */}
            {selectedPosition && (
                <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-72 z-50 animate-in slide-in-from-bottom-5">
                    <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-gray-900 dark:text-white">Chi tiết vị trí</h4>
                        <button
                            onClick={() => setSelectedPosition(null)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Mã:</span>
                            <span className="font-mono font-bold">{selectedPosition.code}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Trạng thái:</span>
                            <span className={occupiedIds.has(selectedPosition.id) ? 'text-green-600' : 'text-gray-400'}>
                                {occupiedIds.has(selectedPosition.id) ? 'Có hàng' : 'Trống'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function WarehouseMapPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-500">Đang tải bản đồ...</div>}>
            <WarehouseMapContent />
        </Suspense>
    )
}
