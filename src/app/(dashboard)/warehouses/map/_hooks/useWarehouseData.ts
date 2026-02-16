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
    const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())
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
            ...l,
            items,
            tags: accumulatedTags,
            qc_name: l.qc_info?.name,
            supplier_name: l.suppliers?.name
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
            const [posData, zoneData, zpData, layoutData, lotsData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code')),
                fetchAllZonesPos(),
                fetchAll('zone_layouts'),
                fetchAll('lots', undefined, '*, suppliers(name), qc_info(name), products(name, unit, sku), lot_items(id, product_id, quantity, unit, products(name, unit, sku)), lot_tags(tag, lot_item_id)')
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
                    ...l,
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
                    if (totalQty > 0) occupied.add(pos.id)
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
    }, [accessToken, systemType])

    // Load Data Effect
    useEffect(() => {
        const currentUserId = session?.user?.id
        if (systemType && (lastUserIdRef.current !== currentUserId)) {
            lastUserIdRef.current = currentUserId
            if (currentUserId) fetchData()
        }
        if (systemType && accessToken && positions.length === 0 && !loading) {
            fetchData()
        }
    }, [systemType, session?.user?.id, accessToken, fetchData, positions.length, loading])

    // Realtime Subscription
    useEffect(() => {
        if (systemType && accessToken) {
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

                        setPositions(prev => prev.map(p =>
                            p.id === updatedPos.id ? { ...p, lot_id: updatedPos.lot_id } : p
                        ))

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
        totalZones: zones.length
    }
}
