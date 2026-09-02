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

export function extractProductCategories(prod: any) {
    const categoryNames: string[] = []
    const categoryIds: string[] = []
    let primary_category_id: string | null = null
    let primary_category_name: string | null = null

    if (!prod) return { categoryNames, categoryIds, primary_category_id, primary_category_name }

    if (prod.product_category_rel && prod.product_category_rel.length > 0) {
        prod.product_category_rel.forEach((rel: any) => {
            const catId = rel.category_id || rel.categories?.id
            const catName = rel.categories?.name
            if (catId && !categoryIds.includes(catId)) categoryIds.push(catId)
            if (catName && !categoryNames.includes(catName)) categoryNames.push(catName)
            if (rel.is_primary) {
                primary_category_id = catId || null
                primary_category_name = catName || null
            }
        })
        if (!primary_category_id && prod.product_category_rel[0]) {
            const first = prod.product_category_rel[0]
            primary_category_id = first.category_id || first.categories?.id || null
            primary_category_name = first.categories?.name || null
        }
    }

    if (prod.categories) {
        const catId = prod.category_id || prod.categories.id
        const catName = prod.categories.name
        if (catId && !categoryIds.includes(catId)) categoryIds.push(catId)
        if (catName && !categoryNames.includes(catName)) categoryNames.push(catName)
        if (!primary_category_id) {
            primary_category_id = catId || null
            primary_category_name = catName || null
        }
    } else if (prod.category_id) {
        if (!categoryIds.includes(prod.category_id)) categoryIds.push(prod.category_id)
        if (!primary_category_id) {
            primary_category_id = prod.category_id
        }
    }

    return { categoryNames, categoryIds, primary_category_id, primary_category_name }
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
            .select('*, productions(code, name, production_lots(id, lot_code, product_id)), suppliers(name), qc_info(name), products(id, name, unit, sku, internal_code, internal_name, category_id, categories(id, name), product_category_rel(category_id, is_primary, categories(id, name))), lot_items(id, product_id, quantity, unit, products(id, name, unit, sku, internal_code, internal_name, category_id, categories(id, name), product_category_rel(category_id, is_primary, categories(id, name)))), lot_tags(tag, lot_item_id), box_labels(id, code, quantity, unit, semi_finished_lot_code, finished_lot_code, status)')
            .eq('id', lotId)
            .single() as any

        if (error || !l) {
            console.error(`Error refreshing lot info for ${lotId}:`, error?.message || 'Lot not found', error)
            return
        }

        const lotItems = l.lot_items || []
        const allTags = l.lot_tags || []
        let items: any[] = []
        let accumulatedTags: string[] = []

        if (lotItems.length > 0) {
            items = lotItems.map((item: any) => {
                const itemTags = allTags
                    .filter((t: any) => t.lot_item_id === item.id)
                    .map((t: any) => t.tag.replace(/@/g, item.products?.sku || ''))
                    .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                accumulatedTags.push(...itemTags)
                const catInfo = extractProductCategories(item.products)

                return {
                    product_name: item.products?.name || '',
                    sku: item.products?.sku || '',
                    internal_code: item.products?.internal_code || '',
                    internal_name: item.products?.internal_name || '',
                    unit: item.unit || item.products?.unit || '',
                    quantity: item.quantity || 0,
                    tags: itemTags,
                    categoryNames: catInfo.categoryNames,
                    category_ids: catInfo.categoryIds,
                    primary_category_id: catInfo.primary_category_id,
                    primary_category_name: catInfo.primary_category_name
                }
            })
        } else if (l.products) {
            const itemTags = allTags
                .map((t: any) => t.tag.replace(/@/g, l.products?.sku || ''))
                .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
            accumulatedTags.push(...itemTags)
            const catInfo = extractProductCategories(l.products)

            items = [{
                product_name: l.products.name || '',
                sku: l.products.sku || '',
                internal_code: l.products.internal_code || '',
                internal_name: l.products.internal_name || '',
                unit: l.products.unit || '',
                quantity: l.quantity || 0,
                tags: itemTags,
                categoryNames: catInfo.categoryNames,
                category_ids: catInfo.categoryIds,
                primary_category_id: catInfo.primary_category_id,
                primary_category_name: catInfo.primary_category_name
            }]
        }

        const prodData = Array.isArray(l.productions) ? l.productions[0] : l.productions

        // Lọc mã lot sản xuất: ưu tiên dùng production_lot_id (FK trực tiếp)
        // Fallback sang product_id cho dữ liệu legacy chưa có production_lot_id
        const lotProdLotId = l.production_lot_id
        const allProdLots = (prodData?.production_lots || [])
            .filter((pl: any) => {
                if (lotProdLotId) return pl.id === lotProdLotId
                // Fallback: lọc theo product_id
                const lotProductIds = new Set<string>()
                if (lotItems.length > 0) {
                    lotItems.forEach((item: any) => { if (item.product_id) lotProductIds.add(item.product_id) })
                } else if (l.product_id) {
                    lotProductIds.add(l.product_id)
                }
                return lotProductIds.size === 0 || lotProductIds.has(pl.product_id)
            })
            .map((pl: any) => pl.lot_code)
            .filter(Boolean)

        const info = {
            ...l,
            items,
            tags: accumulatedTags,
            qc_name: l.qc_info?.name,
            supplier_name: l.suppliers?.name,
            productions: prodData,
            production_lot_codes: allProdLots
        }

        setLotInfo(prev => ({
            ...prev,
            [l.id]: info
        }))
    }, [accessToken])

    const hasInitializedCollapsedRef = useRef(false)

    useEffect(() => {
        hasInitializedCollapsedRef.current = false
    }, [systemType])

    const fetchData = useCallback(async () => {
        if (!accessToken || !systemType) return
        if (!hasInitializedCollapsedRef.current) {
            setLoading(true)
        }
        setErrorMsg(null)

        async function fetchAll(table: string, filter?: (query: any) => any, customSelect = '*', limit = 5000) {
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

        async function fetchAllZonesPos(limit = 5000) {
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
                fetchAll('positions', q => q.eq('system_type', systemType).order('code').order('id'), '*', 5000),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code').order('id'), '*', 5000),
                fetchAllZonesPos(5000),
                fetchAll('zone_layouts', q => q.order('id'), '*', 5000),
                fetchAll('lots', q => q.eq('system_code', systemType).neq('status', 'Archived'), 'id, code, status, quantity, inbound_date, created_at, daily_seq, peeling_date, packaging_date, system_code, production_lot_id, products(id, name, sku, internal_code, internal_name, category_id, categories(id, name), product_category_rel(category_id, is_primary, categories(id, name))), lot_items(id, product_id, quantity, unit, products(id, name, sku, internal_code, internal_name, category_id, categories(id, name), product_category_rel(category_id, is_primary, categories(id, name)))), lot_tags(tag, lot_item_id), productions(code, name, production_lots(id, lot_code, product_id)), box_labels(code, semi_finished_lot_code, finished_lot_code)', 5000) as Promise<any[]>,
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
                let items: any[] = []
                let accumulatedTags: string[] = []

                if (lotItems.length > 0) {
                    items = lotItems.map((item: any) => {
                        const itemTags = allTags
                            .filter((t: any) => t.lot_item_id === item.id)
                            .map((t: any) => t.tag.replace(/@/g, item.products?.sku || ''))
                            .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                        accumulatedTags.push(...itemTags)
                        const catInfo = extractProductCategories(item.products)

                        return {
                            product_name: item.products?.name,
                            sku: item.products?.sku,
                            internal_code: item.products?.internal_code,
                            internal_name: item.products?.internal_name,
                            unit: item.unit || item.products?.unit,
                            quantity: item.quantity,
                            tags: itemTags,
                            categoryNames: catInfo.categoryNames,
                            category_ids: catInfo.categoryIds,
                            primary_category_id: catInfo.primary_category_id,
                            primary_category_name: catInfo.primary_category_name
                        } as any
                    })
                } else if (l.products) {
                    const itemTags = allTags
                        .map((t: any) => t.tag.replace(/@/g, l.products?.sku || ''))
                        .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                    accumulatedTags.push(...itemTags)
                    const catInfo = extractProductCategories(l.products)

                    items = [{
                        product_name: l.products.name,
                        sku: l.products.sku,
                        internal_code: l.products.internal_code,
                        internal_name: l.products.internal_name,
                        unit: l.products.unit,
                        quantity: l.quantity,
                        tags: itemTags,
                        categoryNames: catInfo.categoryNames,
                        category_ids: catInfo.categoryIds,
                        primary_category_id: catInfo.primary_category_id,
                        primary_category_name: catInfo.primary_category_name
                    } as any]
                }

                const prodData = Array.isArray(l.productions) ? l.productions[0] : l.productions
                const lotProdLotId = l.production_lot_id

                // Lấy mã lot sản xuất trực tiếp từ FK production_lot_id trước để tối ưu hóa hiệu năng
                let allProdLots: string[] = []
                if (l.production_lots) {
                    const pl = l.production_lots
                    allProdLots = Array.isArray(pl)
                        ? pl.map((x: any) => x.lot_code).filter(Boolean)
                        : [pl.lot_code].filter(Boolean)
                } else if (prodData?.production_lots) {
                    // Fallback cho dữ liệu legacy
                    allProdLots = prodData.production_lots
                        .filter((pl: any) => {
                            if (lotProdLotId) return pl.id === lotProdLotId
                            const lotProductIds = new Set<string>()
                            if (lotItems.length > 0) {
                                lotItems.forEach((item: any) => { if (item.product_id) lotProductIds.add(item.product_id) })
                            } else if (l.product_id) {
                                lotProductIds.add(l.product_id)
                            }
                            return lotProductIds.size === 0 || lotProductIds.has(pl.product_id)
                        })
                        .map((pl: any) => pl.lot_code)
                        .filter(Boolean)
                }

                lotInfoMap[l.id] = {
                    ...l,
                    items,
                    tags: accumulatedTags,
                    qc_name: l.qc_info?.name,
                    supplier_name: l.suppliers?.name,
                    productions: prodData,
                    production_lot_codes: allProdLots
                }
            })

            setPositions(posWithZone)
            setZones(zoneData)
            setLayouts(layoutData)
            setLotInfo(lotInfoMap)

            // Auto collapse ONLY Root Zones (Warehouses) on initial load
            // This prevents massive DOM rendering while preserving user's expanded zones on subsequent data refreshes
            if (!hasInitializedCollapsedRef.current) {
                const parentZoneIds = new Set<string>()
                zoneData.forEach((z: any) => {
                    if (!z.parent_id) {
                        parentZoneIds.add(z.id)
                    }
                })
                setCollapsedZones(parentZoneIds)
                hasInitializedCollapsedRef.current = true
            }

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

    const positionsRef = useRef<PositionWithZone[]>([])
    positionsRef.current = positions

    const lotInfoRef = useRef<Record<string, any>>({})
    lotInfoRef.current = lotInfo

    const refreshPendingExports = useCallback(async () => {
        if (!systemType || !accessToken) return
        try {
            const { data } = await supabase
                .from('export_task_items')
                .select('position_id, lot_id, export_tasks!inner(status, system_code)')
                .eq('export_tasks.system_code', systemType)
                .in('export_tasks.status', ['Pending', 'Processing'])

            const currentPos = positionsRef.current
            const pendingPos = new Set<string>()
            if (data) {
                data.forEach((item: any) => {
                    if (item.position_id) {
                        pendingPos.add(item.position_id)
                    } else if (item.lot_id) {
                        currentPos.forEach(p => {
                            if (p.lot_id === item.lot_id) {
                                pendingPos.add(p.id)
                            }
                        })
                    }
                })
            }
            setPendingExportPosIds(pendingPos)
        } catch (err) {
            console.error('Error refreshing pending export positions:', err)
        }
    }, [systemType, accessToken])

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

    // Realtime Subscriptions for positions, lots, lot_items, export_tasks, export_task_items
    useEffect(() => {
        if (!systemType || !accessToken) return

        let posUpdateBatch: Position[] = []
        let posBatchTimeout: NodeJS.Timeout | null = null
        let exportBatchTimeout: NodeJS.Timeout | null = null
        let lotBatchTimeout: NodeJS.Timeout | null = null
        let updatedLotIds = new Set<string>()

        const applyPosBatch = () => {
            if (posUpdateBatch.length === 0) return

            const batch = [...posUpdateBatch]
            posUpdateBatch = []
            posBatchTimeout = null

            const batchIds = new Set(batch.map(p => p.id))
            const updatedPositionsMap = new Map(batch.map(p => [p.id, p]))

            // Batch positions state update
            setPositions(prev => prev.map(p => {
                const latest = updatedPositionsMap.get(p.id)
                return latest ? { ...p, lot_id: latest.lot_id } : p
            }))

            // Batch occupied logic
            setOccupiedIds(prev => {
                const next = new Set(prev)
                batch.forEach(pos => {
                    if (pos.lot_id) {
                        const lot = lotInfoRef.current[pos.lot_id]
                        if (lot && lot.items) {
                            const totalQty = lot.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
                            if (totalQty > 0) next.add(pos.id)
                            else next.delete(pos.id)
                        } else {
                            next.add(pos.id)
                        }
                    } else {
                        next.delete(pos.id)
                    }
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
            const newLotIds = new Set(batch.map(p => p.lot_id).filter(Boolean))
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
        }

        const applyLotBatch = () => {
            if (updatedLotIds.size === 0) return
            const idsToRefresh = Array.from(updatedLotIds)
            updatedLotIds.clear()
            lotBatchTimeout = null

            idsToRefresh.forEach(lotId => {
                refreshLotInfo(lotId)
            })
        }

        const triggerExportRefresh = () => {
            if (exportBatchTimeout) clearTimeout(exportBatchTimeout)
            exportBatchTimeout = setTimeout(() => {
                refreshPendingExports()
            }, 300)
        }

        const channel = supabase
            .channel(`warehouse-map-${systemType}-${Date.now()}`)
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

                    posUpdateBatch.push(updatedPos)
                    if (!posBatchTimeout) {
                        posBatchTimeout = setTimeout(applyPosBatch, 200)
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'lots',
                    filter: `system_code=eq.${systemType}`
                },
                (payload) => {
                    const eventType = payload.eventType
                    if (eventType === 'DELETE') {
                        const oldLot = payload.old as any
                        if (oldLot?.id) {
                            setLotInfo(prev => {
                                const next = { ...prev }
                                delete next[oldLot.id]
                                return next
                            })
                        }
                    } else {
                        const newLot = payload.new as any
                        if (newLot?.id) {
                            updatedLotIds.add(newLot.id)
                            if (!lotBatchTimeout) {
                                lotBatchTimeout = setTimeout(applyLotBatch, 200)
                            }
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'lot_items'
                },
                (payload) => {
                    const lotId = (payload.new as any)?.lot_id || (payload.old as any)?.lot_id
                    if (lotId) {
                        updatedLotIds.add(lotId)
                        if (!lotBatchTimeout) {
                            lotBatchTimeout = setTimeout(applyLotBatch, 200)
                        }
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'export_tasks'
                },
                () => {
                    triggerExportRefresh()
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'export_task_items'
                },
                () => {
                    triggerExportRefresh()
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // Realtime connected
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    console.warn(`[Warehouse Realtime] Channel status: ${status}`)
                }
            })

        return () => {
            if (posBatchTimeout) clearTimeout(posBatchTimeout)
            if (lotBatchTimeout) clearTimeout(lotBatchTimeout)
            if (exportBatchTimeout) clearTimeout(exportBatchTimeout)
            supabase.removeChannel(channel)
        }
    }, [systemType, accessToken, refreshLotInfo, refreshPendingExports])

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
        refreshPendingExports,
        // Helper derived
        totalPositions: positions.length,
        totalZones: zones.length,
        collapsedZones,
        setCollapsedZones,
        pendingExportPosIds // export pending state
    }
}

