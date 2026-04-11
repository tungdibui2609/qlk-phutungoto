import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

export interface PositionWithZone extends Position {
    zone_id?: string | null
}

export function useWarehouseData() {
    const { systemType } = useSystem()
    const { showToast } = useToast()

    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [layouts, setLayouts] = useState<ZoneLayout[]>([])
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(() => new Set())
    const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())
    const [pendingExportPosIds, setPendingExportPosIds] = useState<Set<string>>(new Set())
    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})

    // UI Feedback State
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [recentlyUpdatedPositionIds, setRecentlyUpdatedPositionIds] = useState<Set<string>>(new Set())

    const [session, setSession] = useState<any>(null)
    const lastUserIdRef = useRef<string | null>(null)

    // Auth Session Check
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
        return () => subscription.unsubscribe()
    }, [])

    const accessToken = session?.access_token

    const refreshLotInfo = useCallback(async (lotId: string) => {
        if (!accessToken) return

        const { data: l, error } = await supabase
            .from('lots')
            .select('*, productions(code, name, production_lots(lot_code, product_id)), suppliers(name), qc_info(name), products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name))), lot_items(id, product_id, quantity, unit, products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name)))), lot_tags(tag, lot_item_id)')
            .eq('id', lotId)
            .single() as any

        if (error || !l) {
            console.error(`Error refreshing lot info for ${lotId}:`, error?.message || 'Lot not found', error)
            return
        }

        const lotItems = l.lot_items || []
        const allTags = l.lot_tags || []
        let items: Array<{ product_name: string, sku: string, internal_code?: string, internal_name?: string, unit: string, quantity: number, tags: string[] }> = []
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
                    internal_code: item.products?.internal_code || '',
                    internal_name: item.products?.internal_name || '',
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
                internal_code: l.products.internal_code || '',
                internal_name: l.products.internal_name || '',
                unit: l.products.unit || '',
                quantity: l.quantity || 0,
                tags: itemTags
            }]
        }

        const prodData = Array.isArray(l.productions) ? l.productions[0] : l.productions
        const palletProductIds = new Set(lotItems.map((i: any) => i.product_id))
        if (l.product_id) palletProductIds.add(l.product_id)

        const matchingProdLots = (prodData?.production_lots || [])
            .filter((pl: any) => palletProductIds.has(pl.product_id))
            .map((pl: any) => pl.lot_code)

        const info = {
            ...l,
            items,
            tags: accumulatedTags,
            qc_name: l.qc_info?.name,
            supplier_name: l.suppliers?.name,
            productions: prodData,
            production_lot_codes: matchingProdLots
        }

        setLotInfo(prev => ({
            ...prev,
            [l.id]: info
        }))
    }, [accessToken])

    const fetchData = useCallback(async () => {
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
            while (true) {
                const { data, error } = await supabase
                    .from('zone_positions')
                    .select('zone_id, position_id, positions!inner(system_type)')
                    .eq('positions.system_type', systemType)
                    .order('zone_id', { ascending: true })
                    .order('position_id', { ascending: true })
                    .range(from, from + limit - 1)

                if (error) throw error
                if (!data || data.length === 0) break

                allRecs = [...allRecs, ...data]
                if (data.length < limit) break
                from += limit
            }
            return allRecs
        }

        try {
            const [posData, zoneData, zpData, layoutData, lotsData, pendingExportData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code').order('id')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code').order('id')),
                fetchAllZonesPos(),
                fetchAll('zone_layouts', q => q.order('id')),
                fetchAll('lots', q => q.eq('system_code', systemType), '*, productions(code, name, production_lots(lot_code, product_id)), suppliers(name), qc_info(name), products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name))), lot_items(id, product_id, quantity, unit, products(name, unit, sku, internal_code, internal_name, product_category_rel(categories(name)))), lot_tags(tag, lot_item_id)') as Promise<any[]>,
                supabase.from('export_task_items').select('position_id, lot_id, export_tasks!inner(status, system_code)').eq('export_tasks.system_code', systemType).in('export_tasks.status', ['Pending', 'Processing'])
            ])

            // Create lookup map for positions -> zone_id
            const zpLookup: Record<string, string> = {}
            zpData.forEach((zp: any) => {
                if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id
            })

            const posWithZone: PositionWithZone[] = (posData as any[]).map(pos => ({
                ...pos,
                zone_id: zpLookup[pos.id] || null
            }))

            const lotInfoMap: Record<string, any> = {};
            (lotsData as any[]).forEach((l: any) => {
                const lotItems = l.lot_items || []
                const allTags = l.lot_tags || []
                let items: Array<{ product_name: string, sku: string, internal_code?: string, internal_name?: string, unit: string, quantity: number, tags: string[] }> = []
                let accumulatedTags: string[] = []

                if (lotItems.length > 0) {
                    items = lotItems.map((item: any) => {
                        const itemTags = allTags
                            .filter((t: any) => t.lot_item_id === item.id)
                            .map((t: any) => t.tag.replace(/@/g, item.products?.sku || ''))
                            .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                        accumulatedTags.push(...itemTags)
                        const rel = (item.products as any)?.product_category_rel
                        const categoryNames = Array.isArray(rel) 
                            ? rel.map((r: any) => r.categories?.name).filter(Boolean)
                            : (rel?.categories?.name ? [rel.categories.name] : [])

                        return {
                            product_name: item.products?.name,
                            sku: item.products?.sku,
                            internal_code: item.products?.internal_code,
                            internal_name: item.products?.internal_name,
                            unit: item.unit || item.products?.unit,
                            quantity: item.quantity,
                            tags: itemTags,
                            categoryNames: categoryNames
                        } as any
                    })
                } else if (l.products) {
                    const itemTags = allTags
                        .map((t: any) => t.tag.replace(/@/g, l.products?.sku || ''))
                        .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                    accumulatedTags.push(...itemTags)
                    const rel = (l.products as any)?.product_category_rel
                    const categoryNames = Array.isArray(rel) 
                        ? rel.map((r: any) => r.categories?.name).filter(Boolean)
                        : (rel?.categories?.name ? [rel.categories.name] : [])

                    items = [{
                        product_name: l.products.name,
                        sku: l.products.sku,
                        internal_code: l.products.internal_code,
                        internal_name: l.products.internal_name,
                        unit: l.products.unit,
                        quantity: l.quantity,
                        tags: itemTags,
                        categoryNames: categoryNames
                    } as any]
                }

                const prodData = Array.isArray(l.productions) ? l.productions[0] : l.productions
                const palletProductIds = new Set(lotItems.map((i: any) => i.product_id))
                if (l.product_id) palletProductIds.add(l.product_id)

                const matchingProdLots = (prodData?.production_lots || [])
                    .filter((pl: any) => palletProductIds.has(pl.product_id))
                    .map((pl: any) => pl.lot_code)

                lotInfoMap[l.id] = {
                    ...l,
                    items,
                    tags: accumulatedTags,
                    qc_name: l.qc_info?.name,
                    supplier_name: l.suppliers?.name,
                    productions: prodData,
                    production_lot_codes: matchingProdLots
                }
            })

            setPositions(posWithZone)
            setZones(zoneData)
            setLayouts(layoutData)
            setLotInfo(lotInfoMap)

            // Auto collapse ONLY Root Zones (Warehouses) on initial load
            // This prevents massive DOM rendering while solving the "double click to expand" issue
            const parentZoneIds = new Set<string>()
            zoneData.forEach((z: any) => {
                if (!z.parent_id) {
                    parentZoneIds.add(z.id)
                }
            })
            setCollapsedZones(parentZoneIds)

            const occupied = new Set<string>()
            posWithZone.forEach(pos => {
                // If it has a lot_id, it's occupied (we've cleaned orphans, but let's be safe)
                if (pos.lot_id) {
                    const lot = lotInfoMap[pos.lot_id]
                    if (lot) {
                        const totalQty = lot.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
                        if (totalQty > 0) {
                            occupied.add(pos.id)
                        }
                    } else {
                        // It has a lot_id but no lot info found? Might be orphan or still loading.
                        // For map purposes, if it has a lot_id, let's treat it as occupied to be safe 
                        // and show it's not available for new assignments.
                        occupied.add(pos.id)
                    }
                }
            })
            setOccupiedIds(occupied)

            // Resolve pending export positions
            const pendingPos = new Set<string>()
            if (pendingExportData.data) {
                pendingExportData.data.forEach((item: any) => {
                    if (item.position_id) {
                        pendingPos.add(item.position_id)
                    } else if (item.lot_id) {
                        posWithZone.forEach(p => {
                            if (p.lot_id === item.lot_id) {
                                pendingPos.add(p.id)
                            }
                        })
                    }
                })
            }
            setPendingExportPosIds(pendingPos)

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
    }, [accessToken, systemType])

    // Load Data Effect
    const hasFetchedRef = useRef(false)
    useEffect(() => {
        const currentUserId = session?.user?.id
        if (systemType && (lastUserIdRef.current !== currentUserId)) {
            lastUserIdRef.current = currentUserId
            if (currentUserId) {
                hasFetchedRef.current = false
                fetchData().then(() => { hasFetchedRef.current = true })
            }
        }
        if (systemType && accessToken && positions.length === 0 && !loading && !hasFetchedRef.current) {
            fetchData().then(() => { hasFetchedRef.current = true })
        }
    }, [systemType, session?.user?.id, accessToken, fetchData, positions.length, loading])

    // Realtime Subscription
    useEffect(() => {
        if (systemType && accessToken) {
            let updateBatch: Position[] = []
            let batchTimeout: NodeJS.Timeout | null = null

            const applyBatch = () => {
                if (updateBatch.length === 0) return

                const batchIds = new Set(updateBatch.map(p => p.id))
                const updatedLots = new Map(updateBatch.map(p => [p.id, p]))

                // Batch positions state update
                setPositions(prev => prev.map(p => {
                    const latest = updatedLots.get(p.id)
                    return latest ? { ...p, lot_id: latest.lot_id } : p
                }))

                // Batch occupied logic
                setOccupiedIds(prev => {
                    const next = new Set(prev)
                    updateBatch.forEach(pos => {
                        if (pos.lot_id) next.add(pos.id)
                        else next.delete(pos.id)
                    })
                    return next
                })

                // Batch recent updates UI effect
                setRecentlyUpdatedPositionIds(prev => {
                    const next = new Set(prev)
                    batchIds.forEach(id => next.add(id))
                    return next
                })

                // Fetch info for new lots concurrently
                const newLotIds = new Set(updateBatch.map(p => p.lot_id).filter(Boolean))
                newLotIds.forEach(lotId => {
                    if (lotId) refreshLotInfo(lotId)
                })

                setTimeout(() => {
                    setRecentlyUpdatedPositionIds(prev => {
                        const next = new Set(prev)
                        batchIds.forEach(id => next.delete(id))
                        return next
                    })
                }, 1500)

                updateBatch = []
                batchTimeout = null
            }

            const channel = supabase
                .channel(`warehouse-map-${systemType}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'positions',
                        filter: `system_type=eq.${systemType}`
                    },
                    (payload) => {
                        const updatedPos = payload.new as Position
                        if (!updatedPos || !updatedPos.id) return

                        updateBatch.push(updatedPos)

                        // Buffer updates within a 200ms window to batch them
                        if (!batchTimeout) {
                            batchTimeout = setTimeout(applyBatch, 300)
                        }
                    }
                )
                .subscribe()

            return () => {
                if (batchTimeout) clearTimeout(batchTimeout)
                supabase.removeChannel(channel)
            }
        }
    }, [systemType, accessToken, refreshLotInfo])

    return {
        positions,
        setPositions,
        zones,
        setZones,
        layouts,
        setLayouts,
        occupiedIds,
        setOccupiedIds,
        lotInfo,
        setLotInfo,
        loading,
        errorMsg,
        recentlyUpdatedPositionIds,
        fetchData,
        refreshLotInfo,
        // Helper derived
        totalPositions: positions.length,
        totalZones: zones.length,
        collapsedZones,
        setCollapsedZones,
        pendingExportPosIds // export pending state
    }
}
