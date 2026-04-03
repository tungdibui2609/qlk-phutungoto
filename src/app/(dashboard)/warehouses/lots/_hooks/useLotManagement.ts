import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { matchSearch, advancedMatchSearch, normalizeSearchString, calculateSearchScore } from '@/lib/searchUtils'
import { matchDateRange } from '@/lib/dateUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'
import { SearchMode } from '@/app/(dashboard)/warehouses/map/_hooks/useMapFilters'

export type Lot = Database['public']['Tables']['lots']['Row'] & {
    system_code?: string
    lot_items: (Database['public']['Tables']['lot_items']['Row'] & {
        products: { name: string; unit: string | null; product_code?: string; sku: string; weight_kg?: number | null; cost_price?: number | null; internal_code?: string | null; internal_name?: string | null } | null
        unit?: string | null
    })[] | null
    suppliers: { name: string } | null
    qc_info: { name: string } | null
    positions: {
        id: string
        code: string
        zone_positions?: { zone_id: string }[] | null
    }[] | null
    lot_tags?: { tag: string; lot_item_id: string | null }[] | null
    // Production link
    productions?: { code: string; name: string } | null
    // Legacy support for display if needed
    products?: { name: string; unit: string | null; product_code?: string; sku?: string; weight_kg?: number | null; cost_price?: number | null; internal_code?: string | null; internal_name?: string | null } | null
    images?: any
    metadata?: any
    // Added for type safety in forms/filters
    qc_id?: string | null
    packaging_date?: string | null
    warehouse_name?: string | null
    raw_material_date?: string | null
    production_code?: string | null
    production_id?: string | null
    daily_seq?: number | null
    batch_code?: string | null
}

export type Product = Database['public']['Tables']['products']['Row']
export type Supplier = any
export type QCInfo = any
export type Unit = any
export type ProductUnit = any

export function useLotManagement() {
    const { currentSystem, hasModule } = useSystem()
    const { showToast, showConfirm } = useToast()
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)

    // Pagination State
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(21)
    const [totalLots, setTotalLots] = useState(0)
    const [unassignedTotal, setUnassignedTotal] = useState(0)

    const [searchTerm, setSearchTerm] = useState('')
    const [searchMode, setSearchMode] = useState<SearchMode>('all')
    const [positionFilter, setPositionFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [dateFilterField, setDateFilterField] = useState<DateFilterField>('created_at')
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')

    // FIFO Toggle (local, defaults to OFF)
    const [fifoActive, setFifoActive] = useState(false)
    const isFifoAvailable = hasModule('fifo_priority')
    const isFifoActive = isFifoAvailable && fifoActive

    // Data for Selection
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [qcList, setQCList] = useState<QCInfo[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [productUnits, setProductUnits] = useState<ProductUnit[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [existingTags, setExistingTags] = useState<string[]>([])
    const [productions, setProductions] = useState<any[]>([])

    // Use Ref to access latest fetchLots in subscription without re-subscribing
    const fetchLotsRef = useRef(fetchLots)
    fetchLotsRef.current = fetchLots

    useEffect(() => {
        if (currentSystem?.code) {
            // Reset page when system changes
            setPage(0)
            fetchLots()
        }
        fetchCommonData()

        // Debounce timer for realtime events
        let realtimeDebounceTimer: NodeJS.Timeout | null = null

        // 🟢 Real-time Subscription: Listen for changes in positions
        const channel = supabase
            .channel('lot-management-positions')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen for ALL changes (UPDATE, INSERT, DELETE)
                    schema: 'public',
                    table: 'positions'
                },
                (payload) => {
                    // Use Debounce to avoid 100 API calls for 100 rapid position updates
                    if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer)
                    realtimeDebounceTimer = setTimeout(() => {
                        fetchLotsRef.current(false)
                    }, 500)
                }
            )
            .subscribe()

        return () => {
            if (realtimeDebounceTimer) clearTimeout(realtimeDebounceTimer)
            supabase.removeChannel(channel)
        }
    }, [currentSystem?.code])

    // Re-fetch when filters change (debounce search term?)
    // For now, let the UI trigger fetchLots explicitly or we add effects here?
    // Let's add an effect for filters to trigger fetch, but debounce searchTerm
    useEffect(() => {
        if (!currentSystem?.code) return

        const timer = setTimeout(() => {
            setPage(0) // Reset to first page on filter change
            fetchLots()
        }, 500)

        return () => clearTimeout(timer)
    }, [searchTerm, searchMode, positionFilter, selectedZoneId, dateFilterField, startDate, endDate, fifoActive])

    // Effect for page change ONLY
    useEffect(() => {
        if (!currentSystem?.code) return
        fetchLots()
    }, [page, pageSize])


    // Helper to fetch all records with pagination (overcomes Supabase 1000 default)
    async function fetchAllPaginated(table: string, filter?: (query: any) => any, selectFields = '*', pageSize = 1000) {
        let allData: any[] = []
        let from = 0
        while (true) {
            let query = (supabase.from(table as any) as any).select(selectFields).range(from, from + pageSize - 1)
            if (filter) query = filter(query)
            const { data, error } = await query
            if (error) { console.error(`Error fetching ${table}:`, error); break }
            if (!data || data.length === 0) break
            allData = [...allData, ...data]
            if (data.length < pageSize) break
            from += pageSize
        }
        return allData
    }

    async function fetchCommonData() {
        if (!currentSystem?.code) return

        const [prodData, suppData, qcData, branchData, unitData, pUnitData, tagData, productionData] = await Promise.all([
            fetchAllPaginated('products', q => q.eq('system_type', currentSystem!.code).order('name')),
            fetchAllPaginated('suppliers', q => q.eq('system_code', currentSystem!.code).order('name')),
            fetchAllPaginated('qc_info', q => q.eq('system_code', currentSystem!.code).order('name')),
            fetchAllPaginated('branches', q => q.order('is_default', { ascending: false }).order('name')),
            fetchAllPaginated('units'),
            fetchAllPaginated('product_units'),
            fetchAllPaginated('lot_tags', q => q.eq('lots.system_code', currentSystem!.code).order('tag'), 'tag, lots!inner(system_code)'),
            fetchAllPaginated('productions', q => q.order('code', { ascending: false }), '*, products:product_id(*), production_lots(*, products(*))')
        ])

        setProducts(prodData)
        setSuppliers(suppData)
        setQCList(qcData)
        setBranches(branchData)
        setUnits(unitData)
        setProductUnits(pUnitData)
        setProductions(productionData)
        
        const uniqueTags = Array.from(new Set(tagData.map((t: any) => t.tag))).filter(Boolean) as string[]
        setExistingTags(uniqueTags)
    }

    async function fetchLots(showLoading = true) {
        if (!currentSystem?.code) return;

        if (showLoading) setLoading(true)

        try {
            // 1. Dynamic Select Query Builder
            let selectQuery = `
    *,
    raw_material_date,
    production_code,
    production_id,
    productions(code, name),
    packaging_date,
    warehouse_name,
    images,
    metadata,
    lot_items(
        id,
        quantity,
        product_id,
        products(
            name,
            unit,
            sku,
            cost_price,
            internal_code,
            internal_name,
            product_code: id,
            weight_kg,
            product_category_rel(categories(name))
        ),
        unit
    ),
    suppliers(name),
    qc_info(name),
    lot_tags(tag, lot_item_id),
    products(name, unit, sku, weight_kg, cost_price, internal_code, internal_name, product_category_rel(categories(name)))
        `

            let query: any;

            // === PRE-STEP: Zone filter — resolve lot IDs BEFORE building main query ===
            // This 2-step approach ensures pagination works correctly.
            // PostgREST nested !inner filters + pagination cause incorrect counts,
            // so we first find lot_ids from positions, then filter lots by id.
            let zoneLotIds: string[] | null = null;
            if (selectedZoneId && positionFilter !== 'unassigned') {
                // Strategy: MIRROR the warehouse map's logic exactly.
                // Use MANUAL pagination for zone_positions (same as map's fetchAllZonesPos)

                // 1. Fetch ALL zones (PAGINATED — Supabase defaults to 1000 max!)
                let rawZones: any[] = []
                let zoneFrom = 0
                const ZONE_PAGE = 1000
                while (true) {
                    const { data: zonePage, error: zoneErr } = await supabase
                        .from('zones')
                        .select('id, parent_id, system_type')
                        .eq('system_type', currentSystem.code)
                        .order('id')
                        .range(zoneFrom, zoneFrom + ZONE_PAGE - 1)
                    if (zoneErr) { console.error('[Zone Filter] Error fetching zones:', zoneErr); break }
                    if (!zonePage || zonePage.length === 0) break
                    rawZones = [...rawZones, ...zonePage]
                    if (zonePage.length < ZONE_PAGE) break
                    zoneFrom += ZONE_PAGE
                }

                // 2. Fetch ALL zone_positions (manual pagination, matching map exactly)
                let allZpData: any[] = []
                let zpFrom = 0
                const ZP_PAGE = 1000
                while (true) {
                    const { data: zpPage, error: zpErr } = await supabase
                        .from('zone_positions')
                        .select('zone_id, position_id, positions!inner(system_type)')
                        .eq('positions.system_type' as any, currentSystem.code)
                        .order('zone_id', { ascending: true })
                        .order('position_id', { ascending: true })
                        .range(zpFrom, zpFrom + ZP_PAGE - 1) as any
                    if (zpErr) { console.error('[Zone Filter] Error fetching zone_positions:', zpErr); break }
                    if (!zpPage || zpPage.length === 0) break
                    allZpData = [...allZpData, ...zpPage]
                    if (zpPage.length < ZP_PAGE) break
                    zpFrom += ZP_PAGE
                }

                // 3. Fetch ALL positions with lot_id (manual pagination)
                let allOccupiedPosData: any[] = []
                let posFrom = 0
                const POS_PAGE = 1000
                while (true) {
                    const { data: posPage, error: posErr } = await (supabase
                        .from('positions') as any)
                        .select('id, lot_id')
                        .eq('system_type', currentSystem.code)
                        .not('lot_id', 'is', null)
                        .range(posFrom, posFrom + POS_PAGE - 1)
                    if (posErr) { console.error('[Zone Filter] Error fetching positions:', posErr); break }
                    if (!posPage || posPage.length === 0) break
                    allOccupiedPosData = [...allOccupiedPosData, ...posPage]
                    if (posPage.length < POS_PAGE) break
                    posFrom += POS_PAGE
                }

                // Build zpLookup: position_id → zone_id (same as map)
                const zpLookup: Record<string, string> = {}
                allZpData.forEach((zp: any) => {
                    if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id
                })

                // Resolve target zone IDs (selected zone + all descendants)
                const selectedIsRealZone = (rawZones as any[]).some((z: any) => z.id === selectedZoneId)
                let allTargetZoneIds = new Set<string>()

                const getDescendantIds = (parentId: string): string[] => {
                    const children = (rawZones as any[]).filter(z => z.parent_id === parentId)
                    const descendantIds = children.map(z => z.id)
                    children.forEach(child => {
                        descendantIds.push(...getDescendantIds(child.id))
                    })
                    return descendantIds
                }

                if (selectedIsRealZone) {
                    allTargetZoneIds.add(selectedZoneId)
                    getDescendantIds(selectedZoneId).forEach(dId => allTargetZoneIds.add(dId))
                } else {
                    // Virtual zone — resolve via groupWarehouseData
                    const allPosForGrouping = await fetchAllPaginated('positions',
                        q => (q as any).eq('system_type', currentSystem.code),
                        'id, code, system_type'
                    )
                    const { virtualToRealMap } = groupWarehouseData(rawZones as any[], allPosForGrouping as any[])
                    const mapped = virtualToRealMap?.get(selectedZoneId)
                    const baseRealIds = mapped ? mapped : [selectedZoneId]
                    baseRealIds.forEach(id => {
                        allTargetZoneIds.add(id)
                        getDescendantIds(id).forEach(dId => allTargetZoneIds.add(dId))
                    })
                }
                // Filter occupied positions by zone membership
                const allLotIds = new Set<string>()
                allOccupiedPosData.forEach((pos: any) => {
                    const posZoneId = zpLookup[pos.id]
                    if (posZoneId && allTargetZoneIds.has(posZoneId) && pos.lot_id) {
                        allLotIds.add(pos.lot_id)
                    }
                })

                zoneLotIds = Array.from(allLotIds)
            }

            if (positionFilter === 'unassigned') {
                // Unassigned: Use RPC for scalable filtering
                // Left Join on positions is still needed to fetch (empty) positions array for type consistency
                selectQuery += `, positions!positions_lot_id_fkey(id, code, zone_positions!left(zone_id))`

                query = (supabase.rpc as any)('get_unassigned_lots', { p_system_code: currentSystem.code })
                    .select(selectQuery, { count: 'exact' })
                // RPC handles system_code and status check internally
            } else {
                // Standard Logic — use left join for positions (zone filtering done via lot IDs now)
                if (positionFilter === 'assigned') {
                    selectQuery += `, positions!positions_lot_id_fkey!inner(id, code, zone_positions!left(zone_id))`
                } else {
                    selectQuery += `, positions!positions_lot_id_fkey(id, code, zone_positions!left(zone_id))`
                }

                query = supabase
                    .from('lots')
                    .select(selectQuery, { count: 'exact' })
                if (currentSystem?.code) {
                    query = query.eq('system_code', currentSystem.code)
                }
                query = query.neq('status', 'hidden').neq('status', 'exported')

                // Apply zone lot filter if we resolved lot IDs
                if (zoneLotIds !== null) {
                    if (zoneLotIds.length === 0) {
                        // No lots in this zone — return empty
                        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
                    } else {
                        // Filter by the resolved lot IDs
                        query = query.in('id', zoneLotIds.slice(0, 1000))
                    }
                }
            }

            // Implementation Strategy for filters:
            // Since complex filtering (OR across tables, Existence checks) is hard in one go,
            // we use RPC for unassigned, and matching IDs for search term.

            let matchingIds: string[] | null = null

            // 1. Search Term Logic (Deep Search)
            if (searchTerm) {
                // Escape special LIKE characters (% and _) to prevent SQL parsing issues
                const escapeLike = (s: string) => s.replace(/[%_]/g, '\\$&');
                const normalizedTerm = normalizeSearchString(searchTerm);
                const unaccentedTerm = normalizeSearchString(searchTerm, true);
                const escapedTerm = escapeLike(normalizedTerm);
                const term = `%${escapedTerm}%`;

                // Helper to match accent-insensitive locally
                const localMatch = (value: string | null | undefined) => {
                    const v = normalizeSearchString(String(value || ''));
                    const vu = normalizeSearchString(String(value || ''), true);
                    return (
                        v === normalizedTerm ||
                        vu === unaccentedTerm ||
                        v.startsWith(normalizedTerm) ||
                        vu.startsWith(unaccentedTerm) ||
                        v.includes(normalizedTerm) ||
                        vu.includes(unaccentedTerm)
                    );
                };

                // Check UUID
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm);

                // Prefer local filtering on preloaded products to support accent-insensitive search
                let prodIds: string[] = [];
                if (products && products.length > 0) {
                    prodIds = products
                        .filter(p =>
                            localMatch(p.name) ||
                            localMatch((p as any).sku) ||
                            localMatch((p as any).internal_code) ||
                            localMatch((p as any).internal_name) ||
                            (isUUID && p.id === searchTerm)
                        )
                        .map(p => p.id);
                    
                    // Debug log if products loaded but none match
                    if (prodIds.length === 0 && searchTerm.length > 2) {
                        console.log('[Search Debug] Products loaded but no local match for:', searchTerm);
                        console.log('[Search Debug] Sample products:', products.slice(0, 3).map(p => p.name));
                    }
                } else {
                    // Fallback to server query if products not loaded yet
                    console.log('[Search Debug] Products not loaded, using fallback query for:', searchTerm);
                    let orConditionsProd = [`name.ilike.${term}`, `sku.ilike.${term}`, `internal_code.ilike.${term}`, `internal_name.ilike.${term}`];
                    if (isUUID) orConditionsProd.push(`id.eq.${searchTerm}`);
                    const { data: prods, error: prodError } = await (supabase.from('products') as any).select('id').or(orConditionsProd.join(',')).eq('system_type', currentSystem.code);
                    if (prodError) {
                        console.error('[Search Debug] Error fetching products:', prodError);
                    }
                    prodIds = prods?.map((p: any) => p.id) || [];
                }

                // Suppliers - prefer local filtering
                let suppIds: string[] = [];
                if (suppliers && suppliers.length > 0) {
                    suppIds = suppliers.filter((s: any) => localMatch(s.name)).map((s: any) => s.id);
                } else {
                    const { data: supps } = await (supabase.from('suppliers') as any).select('id').ilike('name', term).eq('system_code', currentSystem.code);
                    suppIds = supps?.map((s: any) => s.id) || [];
                }

                // QC - prefer local filtering
                let qcIds: string[] = [];
                if (qcList && qcList.length > 0) {
                    qcIds = qcList.filter((q: any) => localMatch(q.name)).map((q: any) => q.id);
                } else {
                    const { data: qcs } = await (supabase.from('qc_info') as any).select('id').ilike('name', term).eq('system_code', currentSystem.code);
                    qcIds = qcs?.map((q: any) => q.id) || [];
                }

                // Advanced parser for server-side
                const orQueries = searchTerm.split(';').map((q: any) => q.trim()).filter(Boolean);
                let finalOrConditions: string[] = [];

                for (const orQuery of orQueries) {
                    const andParts = orQuery.split('&').map((q: any) => q.trim()).filter(Boolean);
                    if (andParts.length === 0) continue;

                    // For each OR group, we want to find lots that match ALL andParts
                    // Since Supabase .or() is (A OR B OR C), we need to resolve ANDs first.
                    // A simple way is to find lot IDs that match each part and then intersect them.
                    
                    let groupLotIds: string[] | null = null;

                    for (const part of andParts) {
                        const partNormalized = normalizeSearchString(part);
                        const partTerm = `%${part}%`;
                        const partUnaccented = `%${normalizeSearchString(part, true)}%`;
                        
                        let currentMatchIds: string[] = [];

                        if (searchMode === 'all') {
                            // Fetch all IDs for this part
                            const { data: pMatched } = await (supabase.from('products') as any).select('id').or(`name.ilike.${partTerm},sku.ilike.${partTerm},internal_code.ilike.${partTerm}`).eq('system_code', currentSystem.code);
                            const pIds = pMatched?.map((p: any) => p.id) || [];
                            
                            const tagLots = await fetchAllPaginated('lot_tags', (q) => (q as any).ilike('tag', `%${partNormalized}%`), 'lot_id');
                            const tagLotIds = (tagLots || []).map((t: any) => t.lot_id).filter(Boolean);

                            let itemLotIds: string[] = [];
                            if (pIds.length > 0) {
                                const { data: items } = await (supabase.from('lot_items') as any).select('lot_id').in('product_id', pIds);
                                if (items) itemLotIds.push(...items.map((i: any) => i.lot_id));
                                const { data: direct } = await (supabase.from('lots') as any).select('id').in('product_id', pIds).eq('system_code', currentSystem.code);
                                if (direct) itemLotIds.push(...direct.map((l: any) => l.id));
                            }
                            
                            const { data: posLots } = await (supabase.from('positions') as any).select('lot_id').ilike('code', partTerm).not('lot_id', 'is', null);
                            const posIds = (posLots?.map((p: any) => p.lot_id).filter(Boolean) || []) as string[];

                             // Production Orders search in 'all' mode
                            const { data: prodMatched } = await (supabase.from('productions') as any).select('id').or(`code.ilike.${partTerm},name.ilike.${partTerm}`).eq('company_id', currentSystem.company_id);
                            const prodIdsInAll = prodMatched?.map((p: any) => p.id) || [];
                            let prodLotIds: string[] = [];
                            if (prodIdsInAll.length > 0) {
                                const { data: linkedLots } = await (supabase.from('lots') as any).select('id').in('production_id', prodIdsInAll).eq('system_code', currentSystem.code);
                                if (linkedLots) prodLotIds = linkedLots.map((l: any) => l.id);
                            }

                            const { data: lotsDirect } = await (supabase.from('lots') as any).select('id')
                                .or(`code.ilike.${partTerm},notes.ilike.${partTerm},production_code.ilike.${partTerm}`)
                                .eq('system_code', currentSystem.code);
                            const directIds = lotsDirect?.map((l: any) => l.id) || [];

                            currentMatchIds = Array.from(new Set([...itemLotIds, ...tagLotIds, ...posIds, ...directIds, ...prodLotIds]));
                        }
                        else if (searchMode === 'production') {
                            const { data: prodMatched } = await (supabase.from('productions') as any).select('id').or(`code.ilike.${partTerm},name.ilike.${partTerm}`).eq('company_id', currentSystem.company_id);
                            const prodIds = prodMatched?.map((p: any) => p.id) || [];
                            if (prodIds.length > 0) {
                                const { data: linkedLots } = await (supabase.from('lots') as any).select('id').in('production_id', prodIds).eq('system_code', currentSystem.code);
                                if (linkedLots) currentMatchIds.push(...linkedLots.map((l: any) => l.id));
                            }
                        }
                        else if (searchMode === 'name') {
                            const { data: pMatched } = await (supabase.from('products') as any).select('id').or(`name.ilike.${partTerm},internal_name.ilike.${partTerm}`).eq('system_type', currentSystem.code);
                            const pIds = pMatched?.map((p: any) => p.id) || [];
                            if (pIds.length > 0) {
                                const { data: items } = await (supabase.from('lot_items') as any).select('lot_id').in('product_id', pIds);
                                if (items) currentMatchIds.push(...items.map((i: any) => i.lot_id));
                                const { data: direct } = await (supabase.from('lots') as any).select('id').in('product_id', pIds).eq('system_code', currentSystem.code);
                                if (direct) currentMatchIds.push(...direct.map((l: any) => l.id));
                            }
                        }
                        else if (searchMode === 'code') {
                            const { data: pMatched } = await (supabase.from('products') as any).select('id').or(`sku.ilike.${partTerm},internal_code.ilike.${partTerm}`).eq('system_type', currentSystem.code);
                            const pIds = pMatched?.map((p: any) => p.id) || [];
                            const { data: lotsDirect } = await (supabase.from('lots') as any).select('id').ilike('code', partTerm).eq('system_code', currentSystem.code);
                            const directIds = lotsDirect?.map((l: any) => l.id) || [];
                            
                            let itemLotIds: string[] = [];
                            if (pIds.length > 0) {
                                const { data: items } = await (supabase.from('lot_items') as any).select('lot_id').in('product_id', pIds);
                                if (items) itemLotIds.push(...items.map((i: any) => i.lot_id));
                            }
                            currentMatchIds = Array.from(new Set([...itemLotIds, ...directIds]));
                        }
                        else if (searchMode === 'tag') {
                            const tagLots = await fetchAllPaginated('lot_tags', (q) => (q as any).ilike('tag', `%${partNormalized}%`), 'lot_id');
                            currentMatchIds = (tagLots || []).map((t: any) => t.lot_id).filter(Boolean);
                        }
                        else if (searchMode === 'position') {
                            const { data: posLots } = await (supabase.from('positions') as any).select('lot_id').ilike('code', partTerm).not('lot_id', 'is', null);
                            currentMatchIds = (posLots?.map((p: any) => p.lot_id).filter(Boolean) || []) as string[];
                        }
                        else if (searchMode === 'category') {
                             const { data: matchedCats } = await (supabase.from('categories') as any).select('id').or(`name.ilike.${partTerm},name.ilike.${partUnaccented}`).eq('system_type', currentSystem.code);
                             const catIds = matchedCats?.map((c: any) => c.id) || [];
                             if (catIds.length > 0) {
                                 const { data: rels } = await (supabase.from('product_category_rel') as any).select('product_id').in('category_id', catIds);
                                 const pIds = rels?.map((r: any) => r.product_id) || [];
                                 if (pIds.length > 0) {
                                     const { data: items } = await (supabase.from('lot_items') as any).select('lot_id').in('product_id', pIds);
                                     if (items) currentMatchIds.push(...items.map((i: any) => i.lot_id));
                                     const { data: directLots } = await (supabase.from('lots') as any).select('id').in('product_id', pIds).eq('system_code', currentSystem.code);
                                     if (directLots) currentMatchIds.push(...directLots.map((l: any) => l.id));
                                 }
                             }
                        }

                        // Intersect IDs for AND
                        if (groupLotIds === null) groupLotIds = currentMatchIds;
                        else groupLotIds = groupLotIds.filter(id => currentMatchIds.includes(id));
                        
                        if (groupLotIds.length === 0) break; // Optimization
                    }

                    if (groupLotIds && groupLotIds.length > 0) {
                        finalOrConditions.push(`id.in.(${groupLotIds.slice(0, 500).join(',')})`);
                    } else if (andParts.length > 0) {
                        // If no lots match this AND group, we add a dummy filter so the OR doesn't ignore the failure
                        finalOrConditions.push(`id.eq.00000000-0000-0000-0000-000000000000`);
                    }
                }

                if (finalOrConditions.length > 0) {
                    query = query.or(finalOrConditions.join(','));
                } else {
                    query = query.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            }

            // 2. Date Range
            if (startDate && endDate) {
                // Adjust end date to end of day
                const end = new Date(endDate)
                end.setHours(23, 59, 59, 999)
                query = query.gte(dateFilterField, startDate).lte(dateFilterField, end.toISOString())
            }

            // Pagination
            const from = page * pageSize
            const to = from + pageSize - 1

            // Ordering: FIFO-aware when toggle is active
            if (isFifoActive) {
                // FIFO: oldest inbound_date first (nulls last), then created_at ascending
                query = query
                    .order('inbound_date', { ascending: true, nullsFirst: false })
                    .order('created_at', { ascending: true })
            } else {
                query = query.order('created_at', { ascending: false })
            }

            const { data, error, count } = await query
                .range(from, to)

            if (error) {
                console.error('Error fetching lots:', JSON.stringify(error, null, 2))
                showToast('Lỗi tải dữ liệu: ' + error.message, 'error')
            } else if (data) {
                let sortedLots = data as unknown as Lot[];

                if (searchTerm) {
                    const getSearchable = (l: Lot) => {
                        const res: string[] = []
                        if (l.code) res.push(l.code)
                        if (l.suppliers?.name) res.push(l.suppliers.name)
                        if (l.qc_info?.name) res.push(l.qc_info.name)
                        
                        const extractProductSearchVals = (p: any) => {
                            if (!p) return
                            if (p.name) res.push(p.name)
                            if (p.internal_name) res.push(p.internal_name)
                            if (p.sku) res.push(p.sku)
                            if (p.internal_code) res.push(p.internal_code)
                            
                            // Categories
                            const rel = p.product_category_rel
                            if (Array.isArray(rel)) {
                                rel.forEach((r: any) => {
                                    if (r.categories?.name) res.push(r.categories.name)
                                })
                            } else if (rel?.categories?.name) {
                                res.push(rel.categories.name)
                            }
                        }

                        // From lot_items
                        l.lot_items?.forEach((it: any) => {
                            extractProductSearchVals(it.products)
                        })

                        // From direct products property (fallback)
                        if (l.products) {
                            extractProductSearchVals(l.products)
                        }

                        if (l.notes) res.push(l.notes)
                        l.lot_tags?.forEach((t: any) => res.push(t.tag))
                        l.positions?.forEach((p: any) => res.push(p.code))
                        
                        if (l.productions?.code) res.push(l.productions.code)
                        if (l.productions?.name) res.push(l.productions.name)
                        
                        return res
                    }

                    // Client-side refinement for Cross-field AND logic
                    // This ensures "Xoai & A-01" works even if server-side OR was too broad
                    sortedLots = sortedLots.filter(l => advancedMatchSearch(getSearchable(l), searchTerm))

                    sortedLots.sort((a, b) => {
                        return calculateSearchScore(b, searchTerm) - calculateSearchScore(a, searchTerm)
                    });
                }

                setLots(sortedLots)
                setTotalLots(searchTerm ? sortedLots.length : (count || 0))

                // Also fetch a separate count for unassigned if not currently filtered by unassigned
                if (positionFilter === 'unassigned') {
                    setUnassignedTotal(count || 0)
                } else {
                    // Quick count for unassigned only using robust join logic
                    const { count: unassignedCount } = await (supabase.from('lots') as any)
                        .select('id, positions!positions_lot_id_fkey(id)', { count: 'exact', head: true })
                        .eq('system_code', currentSystem.code)
                        .is('positions', null)
                        .neq('status', 'hidden')
                        .neq('status', 'exported');
                    setUnassignedTotal(unassignedCount || 0)
                }
            }
        } catch (err: any) {
            console.error('Error in fetchLots:', err)
        } finally {
            setLoading(false)
        }
    }

    async function fetchUnassignedLotsForBulkAssign(limit: number): Promise<Lot[]> {
        if (!currentSystem?.code) return [];

        try {
            let selectQuery = `
    *,
    packaging_date,
    warehouse_name,
    images,
    metadata,
    lot_items(
        id,
        quantity,
        product_id,
        products(name, unit, sku, cost_price, internal_code, internal_name, product_code: id),
        unit
    ),
    suppliers(name),
    qc_info(name),
    lot_tags(tag, lot_item_id),
    products(name, unit, sku, cost_price, internal_code, internal_name),
    positions!positions_lot_id_fkey(id, code, zone_positions(zone_id))
        `;

            let query = (supabase.rpc as any)('get_unassigned_lots', { p_system_code: currentSystem.code })
                .select(selectQuery);

            if (searchTerm) {
                // Escape special LIKE characters (% and _) to prevent SQL parsing issues
                const escapeLike = (s: string) => s.replace(/[%_]/g, '\\$&');
                const normalizedTerm = normalizeSearchString(searchTerm);
                const unaccentedTerm = normalizeSearchString(searchTerm, true);
                const escapedTerm = escapeLike(normalizedTerm);
                const term = `%${escapedTerm}%`;

                const localMatch = (value: string | null | undefined) => {
                    const v = normalizeSearchString(String(value || ''));
                    const vu = normalizeSearchString(String(value || ''), true);
                    return (
                        v === normalizedTerm ||
                        vu === unaccentedTerm ||
                        v.startsWith(normalizedTerm) ||
                        vu.startsWith(unaccentedTerm) ||
                        v.includes(normalizedTerm) ||
                        vu.includes(unaccentedTerm)
                    );
                };

                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm);

                let prodIds: string[] = [];
                if (products && products.length > 0) {
                    prodIds = products
                        .filter((p: any) =>
                            localMatch(p.name) ||
                            localMatch((p as any).sku) ||
                            localMatch((p as any).internal_code) ||
                            localMatch((p as any).internal_name) ||
                            (isUUID && p.id === searchTerm)
                        )
                        .map((p: any) => p.id);
                } else {
                    let orConditionsProd = [`name.ilike.${term}`, `sku.ilike.${term}`, `internal_code.ilike.${term}`, `internal_name.ilike.${term}`];
                    if (isUUID) orConditionsProd.push(`id.eq.${searchTerm}`);
                    const { data: prods } = await (supabase.from('products') as any).select('id').or(orConditionsProd.join(',')).eq('system_type', currentSystem.code);
                    prodIds = prods?.map((p: any) => p.id) || [];
                }

                let suppIds: string[] = [];
                if (suppliers && suppliers.length > 0) {
                    suppIds = suppliers.filter(s => localMatch(s.name)).map(s => s.id);
                } else {
                    const { data: supps } = await (supabase.from('suppliers') as any).select('id').ilike('name', term).eq('system_code', currentSystem.code);
                    suppIds = supps?.map((s: any) => s.id) || [];
                }

                const tagLots = await fetchAllPaginated('lot_tags', (q) => (q as any).ilike('tag', `%${escapedTerm}%`), 'lot_id');
                const tagLotIds = (tagLots || []).map((t: any) => t.lot_id).filter(Boolean);

                let qcIds: string[] = [];
                if (qcList && qcList.length > 0) {
                    qcIds = qcList.filter(q => localMatch(q.name)).map(q => q.id);
                } else {
                    const { data: qcs } = await (supabase.from('qc_info') as any).select('id').ilike('name', term).eq('system_code', currentSystem.code);
                    qcIds = qcs?.map((q: any) => q.id) || [];
                }

                let itemLotIds: string[] = [];
                if (prodIds.length > 0) {
                    const CHUNK = 500;
                    for (let i = 0; i < prodIds.length; i += CHUNK) {
                        const slice = prodIds.slice(i, i + CHUNK);
                        const { data: items } = await (supabase.from('lot_items') as any).select('lot_id').in('product_id', slice);
                        if (items) itemLotIds.push(...items.map((i: any) => i.lot_id));
                    }
                    
                    // Also search in lots.product_id directly (for lots created without lot_items)
                    const { data: lotsWithProductId } = await (supabase.from('lots') as any)
                        .select('id')
                        .in('product_id', prodIds)
                        .eq('system_code', currentSystem.code);
                    if (lotsWithProductId) {
                        itemLotIds.push(...lotsWithProductId.map((l: any) => l.id));
                    }
                }

                const combinedLotIds = Array.from(new Set([...itemLotIds, ...tagLotIds])).slice(0, 300);
                const safeSuppIds = suppIds.slice(0, 50);
                const safeQcIds = qcIds.slice(0, 50);

                let orConditions = [`code.ilike.${term}`, `notes.ilike.${term}`, `metadata->>extra_info.ilike.${term}`];
                if (combinedLotIds.length > 0) orConditions.push(`id.in.(${combinedLotIds.join(',')})`);
                if (safeSuppIds.length > 0) orConditions.push(`supplier_id.in.(${safeSuppIds.join(',')})`);
                if (safeQcIds.length > 0) orConditions.push(`qc_id.in.(${safeQcIds.join(',')})`);

                query = query.or(orConditions.join(','));
            }

            if (startDate && endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.gte(dateFilterField, startDate).lte(dateFilterField, end.toISOString());
            }

            if (selectedZoneId) {
                const { data: allZones } = await (supabase.from('zones') as any).select('id, parent_id').eq('system_type', currentSystem.code);
                if (allZones) {
                    const descendantIds = new Set<string>([selectedZoneId]);
                    let changed = true;
                    while (changed) {
                        changed = false;
                        for (const zone of (allZones as any[])) {
                            if (zone.parent_id && descendantIds.has(zone.parent_id) && !descendantIds.has(zone.id)) {
                                descendantIds.add(zone.id);
                                changed = true;
                            }
                        }
                    }
                    const zoneIds = Array.from(descendantIds);
                    query = query.in('positions.zone_positions.zone_id', zoneIds);
                }
            }

            if (isFifoActive) {
                query = query.order('inbound_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            const { data, error } = await query.range(0, limit - 1);

            if (error) {
                console.error('Error fetching unassigned lots for bulk assign:', error);
                throw error;
            }

            let resultLots = (data || []) as unknown as Lot[];

            if (searchTerm) {
                resultLots.sort((a, b) => calculateSearchScore(b, searchTerm) - calculateSearchScore(a, searchTerm));
            }

            return resultLots;
        } catch (err) {
            console.error('Error in fetchUnassignedLotsForBulkAssign:', err);
            throw err;
        }
    }

    async function fetchUntaggedLotsForBulkAssign(limit: number): Promise<Lot[]> {
        if (!currentSystem?.code) return [];

        try {
            let selectQuery = `
    *,
    packaging_date,
    warehouse_name,
    images,
    metadata,
    lot_items(
        id,
        quantity,
        product_id,
        products(name, unit, sku, cost_price, internal_code, internal_name, product_code: id),
        unit
    ),
    suppliers(name),
    qc_info(name),
    lot_tags(tag, lot_item_id),
    products(name, unit, sku, cost_price, internal_code, internal_name),
    positions!positions_lot_id_fkey(id, code, zone_positions(zone_id))
        `;

            let query = supabase
                .from('lots')
                .select(selectQuery)
                .eq('system_code', currentSystem.code)
                .neq('status', 'hidden');

            if (searchTerm) {
                // Escape special LIKE characters (% and _) to prevent SQL parsing issues
                const escapeLike = (s: string) => s.replace(/[%_]/g, '\\$&');
                const normalizedTerm = normalizeSearchString(searchTerm);
                const unaccentedTerm = normalizeSearchString(searchTerm, true);
                const escapedTerm = escapeLike(normalizedTerm);
                const term = `%${escapedTerm}%`;

                const localMatch = (value: string | null | undefined) => {
                    const v = normalizeSearchString(String(value || ''));
                    const vu = normalizeSearchString(String(value || ''), true);
                    return (
                        v === normalizedTerm ||
                        vu === unaccentedTerm ||
                        v.startsWith(normalizedTerm) ||
                        vu.startsWith(unaccentedTerm) ||
                        v.includes(normalizedTerm) ||
                        vu.includes(unaccentedTerm)
                    );
                };

                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm);

                let prodIds: string[] = [];
                if (products && products.length > 0) {
                    prodIds = products
                        .filter(p =>
                            localMatch(p.name) ||
                            localMatch((p as any).sku) ||
                            localMatch((p as any).internal_code) ||
                            localMatch((p as any).internal_name) ||
                            (isUUID && p.id === searchTerm)
                        )
                        .map(p => p.id);
                } else {
                    let orConditionsProd = [`name.ilike.${term}`, `sku.ilike.${term}`, `internal_code.ilike.${term}`, `internal_name.ilike.${term}`];
                    if (isUUID) orConditionsProd.push(`id.eq.${searchTerm}`);
                    const { data: prods } = await (supabase.from('products') as any).select('id').or(orConditionsProd.join(',')).eq('system_type', currentSystem.code);
                    prodIds = prods?.map((p: any) => p.id) || [];
                }

                let suppIds: string[] = [];
                if (suppliers && suppliers.length > 0) {
                    suppIds = suppliers.filter(s => localMatch(s.name)).map(s => s.id);
                } else {
                    const { data: supps } = await (supabase.from('suppliers') as any).select('id').ilike('name', term).eq('system_code', currentSystem.code);
                    suppIds = supps?.map((s: any) => s.id) || [];
                }

                let qcIds: string[] = [];
                if (qcList && qcList.length > 0) {
                    qcIds = qcList.filter(q => localMatch(q.name)).map(q => q.id);
                } else {
                    const { data: qcs } = await (supabase.from('qc_info') as any).select('id').ilike('name', term).eq('system_code', currentSystem.code);
                    qcIds = qcs?.map((q: any) => q.id) || [];
                }

                let itemLotIds: string[] = [];
                if (prodIds.length > 0) {
                    const CHUNK = 500;
                    for (let i = 0; i < prodIds.length; i += CHUNK) {
                        const slice = prodIds.slice(i, i + CHUNK);
                        const { data: items } = await (supabase.from('lot_items') as any).select('lot_id').in('product_id', slice);
                        if (items) itemLotIds.push(...items.map((i: any) => i.lot_id));
                    }
                }

                const combinedLotIds = Array.from(new Set(itemLotIds)).slice(0, 300);
                const safeSuppIds = suppIds.slice(0, 50);
                const safeQcIds = qcIds.slice(0, 50);

                let orConditions = [`code.ilike.${term}`, `notes.ilike.${term}`, `metadata->>extra_info.ilike.${term}`];
                if (combinedLotIds.length > 0) orConditions.push(`id.in.(${combinedLotIds.join(',')})`);
                if (safeSuppIds.length > 0) orConditions.push(`supplier_id.in.(${safeSuppIds.join(',')})`);
                if (safeQcIds.length > 0) orConditions.push(`qc_id.in.(${safeQcIds.join(',')})`);

                query = query.or(orConditions.join(','));
            }

            if (startDate && endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query = query.gte(dateFilterField, startDate).lte(dateFilterField, end.toISOString());
            }

            // Fetch ALL lots then filter untagged client-side for accuracy
            // Use pagination to overcome Supabase limits
            let allData: any[] = []
            let fetchFrom = 0
            const FETCH_PAGE_SIZE = 1000
            while (true) {
                const { data: pageData, error: pageError } = await (query as any)
                    .order('created_at', { ascending: false })
                    .range(fetchFrom, fetchFrom + FETCH_PAGE_SIZE - 1)
                if (pageError) throw pageError
                if (!pageData || pageData.length === 0) break
                allData = [...allData, ...pageData]
                if (pageData.length < FETCH_PAGE_SIZE) break
                fetchFrom += FETCH_PAGE_SIZE
            }
            const data = allData
            const error = null;

            if (error) {
                console.error('Error in fetchUntaggedLotsForBulkAssign query:', error);
                throw error;
            }

            console.log(`[BulkTag] Fetched ${data?.length || 0} lots for system ${currentSystem.code}.Target limit: ${limit} `);
            let resultLots = ((data || []) as Lot[]).filter(l => !l.lot_tags || l.lot_tags.length === 0);
            console.log(`[BulkTag] Found ${resultLots.length} untagged lots after filtering.`);

            if (positionFilter === 'unassigned') {
                resultLots = resultLots.filter(l => !l.positions || l.positions.length === 0);
            } else if (positionFilter === 'assigned') {
                resultLots = resultLots.filter(l => l.positions && l.positions.length > 0);
            }

            return resultLots.slice(0, limit);
        } catch (err) {
            console.error('Error in fetchUntaggedLotsForBulkAssign:', err);
            throw err;
        }
    }

    async function handleDeleteLot(id: string): Promise<boolean> {
        if (!await showConfirm('Bạn có chắc chắn muốn xóa LOT này?')) return false

        const { error } = await (supabase
            .from('lots') as any)
            .delete()
            .eq('id', id)

        if (error) {
            showToast('Lỗi xóa LOT: ' + error.message, 'error')
            return false
        } else {
            showToast('Đã xóa LOT thành công', 'success')
            // refetch for correct pagination
            fetchLots(false)
            return true
        }
    }

    const handleToggleStar = async (lot: Lot) => {
        const metadata = lot.metadata ? { ...lot.metadata } : {};
        metadata.is_starred = !metadata.is_starred;

        const { error } = await (supabase
            .from('lots') as any)
            .update({ metadata: metadata as any })
            .eq('id', lot.id);

        if (error) {
            console.error('Error toggling star:', error);
            showToast('Lỗi khi đánh dấu: ' + error.message, 'error');
        } else {
            // Optimistic update
            setLots(lots.map((l: any) => l.id === lot.id ? { ...l, metadata } : l));
        }
    };


    return {
        // State
        lots, // Now contains only one page
        rawLots: lots, // naming compatibility
        loading,
        searchTerm,
        setSearchTerm,
        searchMode,
        setSearchMode,
        positionFilter,
        setPositionFilter,
        setSelectedZoneId, // Zone filter effectively disabled for now or needs updates
        dateFilterField,
        setDateFilterField,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        selectedZoneId,

        // Pagination
        page,
        setPage,
        pageSize,
        setPageSize,
        totalLots,
        unassignedTotal,

        // Common Data
        products,
        suppliers,
        qcList,
        units,
        productUnits,
        branches,
        existingTags,
        productions,

        // Actions
        fetchLots,
        fetchUnassignedLotsForBulkAssign,
        fetchUntaggedLotsForBulkAssign,
        handleDeleteLot,
        handleToggleStar,
        isModuleEnabled: hasModule,
        isUtilityEnabled: hasModule,
        fetchCommonData,

        // FIFO
        isFifoAvailable,
        isFifoActive,
        toggleFifo: () => setFifoActive(prev => !prev)
    }
}
