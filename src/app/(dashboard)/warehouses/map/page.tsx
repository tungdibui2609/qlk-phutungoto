'use client'
import { useState, useEffect, useMemo, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { Map, Settings, Package, MapPin, Tag } from 'lucide-react'
import MultiSelectActionBar from '@/components/warehouse/map/MultiSelectActionBar'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import LayoutConfigPanel from '@/components/warehouse/LayoutConfigPanel'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { useSystem } from '@/contexts/SystemContext'
import { LotTagModal } from '@/components/lots/LotTagModal'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { QuickBulkExportModal } from '@/components/warehouse/map/QuickBulkExportModal'
import { usePositionActionManager } from '@/components/warehouse/map/PositionActionManager'
import Protected from '@/components/auth/Protected'
import { matchSearch } from '@/lib/searchUtils'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

function WarehouseMapContent() {
    const { systemType, currentSystem } = useSystem()
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [layouts, setLayouts] = useState<ZoneLayout[]>([])

    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Filter state
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    const searchParams = useSearchParams()
    const router = useRouter()
    const assignLotId = searchParams.get('assignLotId')

    // LOT Assignment State
    const [assignLot, setAssignLot] = useState<{ id: string, code: string } | null>(null)
    const [taggingLotId, setTaggingLotId] = useState<string | null>(null)

    // Multi-select state
    const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(new Set())
    const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())
    const [isBulkExportOpen, setIsBulkExportOpen] = useState(false)

    // Design mode state
    const [isDesignMode, setIsDesignMode] = useState(false)
    const [configuringZone, setConfiguringZone] = useState<Zone | null>(null)

    // Collapsed zones
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())
    const [recentlyUpdatedPositionIds, setRecentlyUpdatedPositionIds] = useState<Set<string>>(new Set())

    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})

    // Detail View State
    const [viewingLot, setViewingLot] = useState<any>(null)
    const [qrLot, setQrLot] = useState<any>(null) // For opening QR from details

    // Auth Session State
    const [session, setSession] = useState<any>(null)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session)
        })
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session)
        })
        return () => subscription.unsubscribe()
    }, [])

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
    // Handle position selection (toggle for multi-select)
    function handlePositionSelect(positionId: string) {
        if (assignLot && assignLotId) {
            // Assignment Logic - find position
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
                        alert('Lỗi cập nhật vị trí: ' + error.message)
                        fetchData()
                    }
                })
        } else {
            // Toggle selection for multi-select
            setSelectedPositionIds(prev => {
                const next = new Set(prev)
                if (next.has(positionId)) {
                    next.delete(positionId)
                } else {
                    next.add(positionId)
                }
                return next
            })
        }
    }

    // Clear all selections
    function clearSelection() {
        setSelectedPositionIds(new Set())
    }

    // Get selected positions data for action bar
    const selectedPositions = useMemo(() => {
        return positions.filter(p => selectedPositionIds.has(p.id))
    }, [positions, selectedPositionIds])

    // Get unique LOT IDs from selected positions
    const selectedLotIds = useMemo(() => {
        const lotIds = new Set<string>()
        selectedPositions.forEach(p => {
            if (p.lot_id) lotIds.add(p.lot_id)
        })
        return lotIds
    }, [selectedPositions])

    const accessToken = session?.access_token



    // Provide module config check function for LotDetailsModal
    const isModuleEnabled = useMemo(() => {
        return (moduleId: string) => {
            if (!currentSystem) return true // Default to true if system not loaded yet to avoid hiding data

            // Collect all enabled modules from various fields
            const allModules = new Set<string>()

            // Check 'modules' field (string or array)
            if (currentSystem.modules) {
                if (Array.isArray(currentSystem.modules)) {
                    currentSystem.modules.forEach(m => allModules.add(m))
                } else if (typeof currentSystem.modules === 'string') {
                    try {
                        const parsed = JSON.parse(currentSystem.modules)
                        if (Array.isArray(parsed)) parsed.forEach((m: string) => allModules.add(m))
                    } catch (e) {
                        // Maybe comma separated?
                        currentSystem.modules.split(',').forEach(m => allModules.add(m.trim()))
                    }
                }
            }

            // Check inbound_modules
            if (Array.isArray(currentSystem.inbound_modules)) {
                currentSystem.inbound_modules.forEach(m => allModules.add(m))
            }

            // Check outbound_modules
            if (Array.isArray(currentSystem.outbound_modules)) {
                currentSystem.outbound_modules.forEach(m => allModules.add(m))
            }

            // Fallback: If strict config check fails, but we have data, show it!
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
                .select(`
                    *,
                    created_at,
                    suppliers (name),
                    qc_info (name),
                    lot_items (
                        id, quantity, unit,
                        products (name, sku, unit)
                    ),
                    positions (code),
                    lot_tags (tag, lot_item_id)
                `)
                .eq('id', lotId)
                .single()

            if (error) throw error
            setViewingLot(data)
        } catch (error: any) {
            console.error('Error fetching lot details:', error)
            alert('Không thể tải chi tiết LOT: ' + error.message)
        }
    }

    const lastUserIdRef = useRef<string | null>(null)

    // Smart fetch: Only fetch when systemType changes OR when user *actually* changes (initial load or login/logout)
    // Ignores silent token refreshes where user ID stays the same
    useEffect(() => {
        const currentUserId = session?.user?.id

        // Case 1: System Type changed -> Always fetch
        // Case 2: User changed (e.g. initial load where null -> userId, or switch user) -> Fetch
        if (systemType && (lastUserIdRef.current !== currentUserId)) {
            lastUserIdRef.current = currentUserId
            if (currentUserId) fetchData()
        } else if (systemType && lastUserIdRef.current === currentUserId && currentUserId) {
            // Case 3: Same user, just token refresh -> DO NOTHING (Prevent reload)
        }

        // Safety fallback for initial load race condition
        if (systemType && accessToken && positions.length === 0 && !loading) {
            fetchData()
        }

        // 🟢 Real-time Subscription: Listen for changes in positions
        // This ensures that when a position is assigned to a LOT on mobile,
        // the warehouse map reflects the change immediately.
        if (systemType && accessToken) {
            const channel = supabase
                .channel(`warehouse-map-${systemType}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*', // Listen for all events for now
                        schema: 'public',
                        table: 'positions',
                        filter: `system_type=eq.${systemType}`
                    },
                    (payload) => {
                        const updatedPos = payload.new as Position

                        if (!updatedPos || !updatedPos.id) return

                        // Update local positions state
                        setPositions(prev => prev.map(p =>
                            p.id === updatedPos.id ? { ...p, lot_id: updatedPos.lot_id } : p
                        ))

                        // If a lot is assigned, fetch its full info to display on map
                        if (updatedPos.lot_id) {
                            refreshLotInfo(updatedPos.lot_id)

                            setOccupiedIds(prev => {
                                const next = new Set(prev)
                                next.add(updatedPos.id)
                                return next
                            })
                        } else {
                            setOccupiedIds(prev => {
                                const next = new Set(prev)
                                next.delete(updatedPos.id)
                                return next
                            })
                        }

                        // Trigger visual "blink" highlight
                        setRecentlyUpdatedPositionIds(prev => {
                            const next = new Set(prev)
                            next.add(updatedPos.id)
                            return next
                        })
                        setTimeout(() => {
                            setRecentlyUpdatedPositionIds(prev => {
                                const next = new Set(prev)
                                next.delete(updatedPos.id)
                                return next
                            })
                        }, 1500)
                    }
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [systemType, session?.user?.id, accessToken])

    async function refreshLotInfo(lotId: string) {
        if (!accessToken) return

        const { data: l, error } = await supabase
            .from('lots')
            .select('*, suppliers(name), qc_info(name), products(name, unit, sku), lot_items(id, product_id, quantity, unit, products(name, unit, sku)), lot_tags(tag, lot_item_id)')
            .eq('id', lotId)
            .single()

        if (error || !l) {
            console.error('Error refreshing lot info:', error)
            return
        }

        const lotItems = l.lot_items || []
        const allTags = l.lot_tags || []
        let items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags: string[] }> = []
        let accumulatedTags: string[] = []

        if (lotItems.length > 0) {
            items = lotItems.map((item: any) => {
                const itemTags = allTags
                    .filter((t: any) => t.lot_item_id === item.id)
                    .map((t: any) => t.tag.replace(/@/g, item.products?.sku || ''))
                    .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                accumulatedTags.push(...itemTags)
                return {
                    product_name: item.products?.name || '',
                    sku: item.products?.sku || '',
                    unit: item.unit || item.products?.unit || '',
                    quantity: item.quantity || 0,
                    tags: itemTags
                }
            })
        } else if (l.products) {
            const itemTags = allTags
                .map((t: any) => t.tag.replace(/@/g, l.products?.sku || ''))
                .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
            accumulatedTags.push(...itemTags)
            items = [{
                product_name: l.products.name || '',
                sku: l.products.sku || '',
                unit: l.products.unit || '',
                quantity: l.quantity || 0,
                tags: itemTags
            }]
        }

        const info = {
            ...l, // Spread all fields to be future-proof
            items,
            tags: accumulatedTags,
            qc_name: l.qc_info?.name,
            supplier_name: l.suppliers?.name
        }

        setLotInfo(prev => ({
            ...prev,
            [l.id]: info
        }))
    }

    async function fetchData() {
        if (!accessToken || !systemType) return
        setLoading(true)
        setErrorMsg(null)

        async function fetchAll(table: string, filter?: (query: any) => any, customSelect = '*', limit = 1000) {
            let allRecs: any[] = []
            let from = 0
            while (true) {
                let query = supabase.from(table as any).select(customSelect).range(from, from + limit - 1)
                if (filter) query = filter(query)
                const { data, error } = await query
                if (error) throw error
                if (!data || data.length === 0) break
                allRecs = [...allRecs, ...data]
                if (data.length < limit) break
                from += limit
            }
            return allRecs
        }

        async function fetchAllZonesPos(limit = 1000) {
            let allRecs: any[] = []
            let from = 0
            console.log(`[FetchAllZonesPos] Starting...`)
            while (true) {
                const { data, error } = await supabase
                    .from('zone_positions')
                    .select('zone_id, position_id, positions!inner(system_type)')
                    .eq('positions.system_type', systemType)
                    .range(from, from + limit - 1)
                if (error) {
                    console.error(`[FetchAllZonesPos] Error:`, error)
                    throw error
                }
                if (!data || data.length === 0) break
                allRecs = [...allRecs, ...data]
                console.log(`[FetchAllZonesPos] loaded ${allRecs.length} links...`)
                if (data.length < limit) break
                from += limit
            }
            return allRecs
        }

        try {
            const [posData, zoneData, zpData, layoutData, lotsData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code')),
                fetchAllZonesPos(),
                fetchAll('zone_layouts'),
                fetchAll('lots', undefined, '*, suppliers(name), qc_info(name), products(name, unit, sku), lot_items(id, product_id, quantity, unit, products(name, unit, sku)), lot_tags(tag, lot_item_id)')
            ])

            console.log(`[MapDataSummary] Zones: ${zoneData.length}, Positions: ${posData.length}, Links: ${zpData.length}, Lots: ${lotsData.length}`)

            // Create lookup map for positions -> zone_id (O(N) instead of O(N*M))
            const zpLookup: Record<string, string> = {}
            zpData.forEach((zp: any) => {
                if (zp.position_id && zp.zone_id) {
                    zpLookup[zp.position_id] = zp.zone_id
                }
            })

            // Map positions with zone_id
            const posWithZone: PositionWithZone[] = (posData as any[]).map(pos => {
                return { ...pos, zone_id: zpLookup[pos.id] || null }
            })

            const lotInfoMap: Record<string, any> = {};

            (lotsData as any[]).forEach((l: any) => {
                const lotItems = l.lot_items || []
                const allTags = l.lot_tags || []
                let items: Array<{ product_name: string, sku: string, unit: string, quantity: number, tags: string[] }> = []
                let accumulatedTags: string[] = [] // Collect all tags for search

                if (lotItems.length > 0) {
                    items = lotItems.map((item: any) => {
                        const itemTags = allTags
                            .filter((t: any) => t.lot_item_id === item.id)
                            .map((t: any) => t.tag.replace(/@/g, item.products?.sku || ''))
                            .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                        accumulatedTags.push(...itemTags)
                        return {
                            product_name: item.products?.name,
                            sku: item.products?.sku,
                            unit: item.unit || item.products?.unit,
                            quantity: item.quantity,
                            tags: itemTags
                        }
                    })
                } else if (l.products) {
                    const itemTags = allTags
                        .map((t: any) => t.tag.replace(/@/g, l.products?.sku || ''))
                        .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                    accumulatedTags.push(...itemTags)
                    items = [{
                        product_name: l.products.name,
                        sku: l.products.sku,
                        unit: l.products.unit,
                        quantity: l.quantity,
                        tags: itemTags
                    }]
                }

                lotInfoMap[l.id] = {
                    ...l, // Spread all fields to be future-proof
                    items,
                    tags: accumulatedTags,
                    qc_name: l.qc_info?.name,
                    supplier_name: l.suppliers?.name
                }
            })

            setPositions(posWithZone)
            setZones(zoneData)
            setLayouts(layoutData)
            setLotInfo(lotInfoMap)

            const occupied = new Set<string>()
            posWithZone.forEach(pos => {
                if (pos.lot_id && lotInfoMap[pos.lot_id]) {
                    const lot = lotInfoMap[pos.lot_id]
                    const totalQty = lot.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
                    if (totalQty > 0) {
                        occupied.add(pos.id)
                    }
                }
            })
            setOccupiedIds(occupied)

        } catch (error: any) {
            console.error('Error fetching warehouse data:', error)
            if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
                setErrorMsg("Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.")
            } else {
                setErrorMsg(error.message || "Lỗi không xác định khi tải dữ liệu.")
            }
        } finally {
            setLoading(false)
        }
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

                // 1. Position Code Match
                if (posCode.includes(term)) return true

                // If no lot, we only match by position code
                if (!lot) return false

                // 2. Dynamic deep search using shared utility
                if (matchSearch(lot, searchTerm)) return true

                return false
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
                <Protected permission="warehousemap.manage">
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
                </Protected>
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
            {errorMsg ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-800 max-w-md text-center">
                        <p className="font-bold mb-1">Đã xảy ra lỗi tải dữ liệu</p>
                        <p className="text-sm">{errorMsg}</p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        Tải lại trang
                    </button>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-20">
                    <p className="text-gray-400">Đang tải bản đồ...</p>
                </div>
            ) : (
                <FlexibleZoneGrid
                    zones={filteredZones}
                    positions={filteredPositions}
                    layouts={layoutsMap}
                    occupiedIds={occupiedIds}
                    lotInfo={lotInfo}
                    collapsedZones={collapsedZones}
                    selectedPositionIds={selectedPositionIds}
                    isDesignMode={isDesignMode}
                    onToggleCollapse={toggleZoneCollapse}
                    onPositionSelect={handlePositionSelect}
                    onViewDetails={fetchFullLotDetails}
                    onPositionMenu={handlePositionMenu}
                    onConfigureZone={setConfiguringZone}
                    highlightLotId={assignLotId}
                    highlightingPositionIds={recentlyUpdatedPositionIds}
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
                        allZones={zones}
                        allLayouts={layoutsMap}
                        onClose={() => setConfiguringZone(null)}
                    />
                </div>
            )}

            {/* Multi-Select Action Bar */}
            <MultiSelectActionBar
                selectedPositionIds={selectedPositionIds}
                positions={positions}
                lotInfo={lotInfo}
                onClear={clearSelection}
                onTag={(lotId) => setTaggingLotId(lotId)}
                onBulkExport={() => setIsBulkExportOpen(true)}
            />

            {/* Quick Bulk Export Modal */}
            {isBulkExportOpen && (
                <QuickBulkExportModal
                    lotIds={Array.from(selectedLotIds)}
                    lotInfo={lotInfo}
                    onClose={() => setIsBulkExportOpen(false)}
                    onSuccess={() => {
                        setIsBulkExportOpen(false)
                        clearSelection()
                        fetchData()
                    }}
                />
            )}

            {/* Tagging Modal */}
            {taggingLotId && (
                <LotTagModal
                    lotId={taggingLotId}
                    lotCodeDisplay={lotInfo[taggingLotId]?.code}
                    onClose={() => setTaggingLotId(null)}
                    onSuccess={() => {
                        fetchData()
                    }}
                />
            )}

            {/* Lot Details Modal */}
            <LotDetailsModal
                lot={viewingLot}
                onClose={() => setViewingLot(null)}
                onOpenQr={(lot) => {
                    // Handle QR open if needed, or just log
                    console.log('Open QR for', lot)
                }}
                isModuleEnabled={isModuleEnabled}
            />

            {/* Context Menu & Lot Form */}
            <PositionActionUI />
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
