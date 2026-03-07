import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { matchSearch } from '@/lib/searchUtils'
import { matchDateRange } from '@/lib/dateUtils'
import { DateFilterField } from '@/components/warehouse/DateRangeFilter'

export type Lot = Database['public']['Tables']['lots']['Row'] & {
    system_code?: string
    lot_items: (Database['public']['Tables']['lot_items']['Row'] & {
        products: { name: string; unit: string | null; product_code?: string; sku: string; cost_price?: number | null; internal_code?: string | null; internal_name?: string | null } | null
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
    // Legacy support for display if needed
    products?: { name: string; unit: string | null; product_code?: string; sku?: string; cost_price?: number | null; internal_code?: string | null; internal_name?: string | null } | null
    images?: any
    metadata?: any
}

export type Product = Database['public']['Tables']['products']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type QCInfo = Database['public']['Tables']['qc_info']['Row']
export type Unit = Database['public']['Tables']['units']['Row']
export type ProductUnit = Database['public']['Tables']['product_units']['Row']

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
    }, [searchTerm, positionFilter, selectedZoneId, dateFilterField, startDate, endDate, fifoActive])

    // Effect for page change ONLY
    useEffect(() => {
        if (!currentSystem?.code) return
        fetchLots()
    }, [page, pageSize])


    async function fetchCommonData() {
        if (!currentSystem?.code) return

        const [prodRes, suppRes, qcRes, branchRes, unitRes, pUnitRes, tagRes] = await Promise.all([
            supabase.from('products').select('*').eq('system_type', currentSystem.code).order('name'),
            supabase.from('suppliers').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('qc_info').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('units').select('*'),
            supabase.from('product_units').select('*'),
            supabase.from('lot_tags').select('tag').order('tag')
        ])

        if (prodRes.data) setProducts(prodRes.data)
        if (suppRes.data) setSuppliers(suppRes.data)
        if (qcRes.data) setQCList(qcRes.data)
        if (branchRes.data) setBranches(branchRes.data)
        if (unitRes.data) setUnits(unitRes.data)
        if (pUnitRes.data) setProductUnits(pUnitRes.data)
        if (tagRes.data) {
            const uniqueTags = Array.from(new Set(tagRes.data.map(t => t.tag))).filter(Boolean)
            setExistingTags(uniqueTags)
        }
    }

    async function fetchLots(showLoading = true) {
        if (!currentSystem?.code) return;

        if (showLoading) setLoading(true)

        try {
            // 1. Dynamic Select Query Builder
            let selectQuery = `
                *,
                packaging_date,
                warehouse_name,
                images,
                metadata,
                lot_items (
                    id,
                    quantity,
                    product_id,
                    products (
                        name,
                        unit,
                        sku,
                        cost_price,
                        internal_code,
                        internal_name,
                        product_code:id
                    ),
                    unit
                ),
                suppliers (name),
                qc_info (name),
                lot_tags (tag, lot_item_id),
                products (name, unit, sku, cost_price, internal_code, internal_name)
            `

            let query: any;

            if (positionFilter === 'unassigned') {
                // Unassigned: Use RPC for scalable filtering
                // Left Join on positions is still needed to fetch (empty) positions array for type consistency
                selectQuery += `, positions(id, code, zone_positions!left(zone_id))`

                query = (supabase.rpc as any)('get_unassigned_lots', { p_system_code: currentSystem.code })
                    .select(selectQuery, { count: 'exact' })
                // RPC handles system_code and status check internally
            } else {
                // Standard Logic
                if (selectedZoneId) {
                    selectQuery += `, positions!inner(id, code, zone_positions!inner(zone_id))`
                } else if (positionFilter === 'assigned') {
                    selectQuery += `, positions!inner(id, code, zone_positions!left(zone_id))`
                } else {
                    selectQuery += `, positions(id, code, zone_positions!left(zone_id))`
                }

                query = supabase
                    .from('lots')
                    .select(selectQuery, { count: 'exact' })
                if (currentSystem?.code) {
                    query = query.eq('system_code', currentSystem.code)
                }
                query = query.neq('status', 'hidden')
            }

            // Implementation Strategy for filters:
            // Since complex filtering (OR across tables, Existence checks) is hard in one go,
            // we use RPC for unassigned, and matching IDs for search term.

            let matchingIds: string[] | null = null

            // 1. Search Term Logic (Deep Search)
            if (searchTerm) {
                const term = `%${searchTerm}%`
                let orConditionsProd = [`name.ilike.${term}`, `sku.ilike.${term}`, `internal_code.ilike.${term}`, `internal_name.ilike.${term}`]

                // Safe check if searchTerm is a UUID to search in 'id' column without crashing postgres
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm)
                if (isUUID) {
                    orConditionsProd.push(`id.eq.${searchTerm}`)
                }

                // Find products matching name, sku, or valid UUID id
                const { data: prods } = await supabase.from('products').select('id, name, sku').or(orConditionsProd.join(',')).eq('system_type', currentSystem.code)
                let prodIds = prods?.map(p => p.id) || []

                // Prioritize exact matches
                if (prods && prods.length > 0) {
                    const sLower = searchTerm.toLowerCase();
                    const exactMatches = prods.filter(p =>
                        (p.sku && p.sku.toLowerCase() === sLower) ||
                        (p.name && p.name.toLowerCase() === sLower) ||
                        ((p as any).internal_code && (p as any).internal_code.toLowerCase() === sLower) ||
                        ((p as any).internal_name && (p as any).internal_name.toLowerCase() === sLower)
                    );
                    if (exactMatches.length > 0) {
                        prodIds = exactMatches.map(p => p.id);
                    }
                }

                // Find suppliers matching
                const { data: supps } = await supabase.from('suppliers').select('id').ilike('name', term).eq('system_code', currentSystem.code)
                const suppIds = supps?.map(s => s.id) || []

                // Find tags matching
                const { data: tags } = await supabase.from('lot_tags').select('lot_id').ilike('tag', term)
                const tagLotIds = tags?.map(t => t.lot_id) || []

                // Find QC matching
                const { data: qcs } = await supabase.from('qc_info').select('id').ilike('name', term).eq('system_code', currentSystem.code)
                const qcIds = qcs?.map(q => q.id) || []

                // Find lots with these products or suppliers OR code/note match
                // We'll use an RPC or raw OR query if possible. 
                // Alternatively, fetch IDs from lot_items where product_id in prodIds
                let itemLotIds: string[] = []
                if (prodIds.length > 0) {
                    const { data: items } = await supabase.from('lot_items').select('lot_id').in('product_id', prodIds)
                    if (items) {
                        itemLotIds = items.map(i => i.lot_id)
                    }
                }

                // Combine all lot IDs found from children records
                const combinedLotIds = Array.from(new Set([...itemLotIds, ...tagLotIds])).slice(0, 300) // Limit to 300 to avoid 414 URI Too Long errors
                const safeSuppIds = suppIds.slice(0, 50)
                const safeQcIds = qcIds.slice(0, 50)

                // Construct OR filter for top-level lots
                let orConditions = [
                    `code.ilike.${term}`,
                    `notes.ilike.${term}`,
                    `metadata->>extra_info.ilike.${term}`
                ]
                if (combinedLotIds.length > 0) orConditions.push(`id.in.(${combinedLotIds.join(',')})`)
                if (safeSuppIds.length > 0) orConditions.push(`supplier_id.in.(${safeSuppIds.join(',')})`)
                if (safeQcIds.length > 0) orConditions.push(`qc_id.in.(${safeQcIds.join(',')})`)

                // Note: .or() with large lists can be slow/error prone URL length. 
                // We sliced it to prevent server crashes on extremely generic searches.
                query = query.or(orConditions.join(','))
            }

            // 2. Date Range
            if (startDate && endDate) {
                // Adjust end date to end of day
                const end = new Date(endDate)
                end.setHours(23, 59, 59, 999)
                query = query.gte(dateFilterField, startDate).lte(dateFilterField, end.toISOString())
            }

            // 3. Position / Zone Filter
            // 'assigned' is handled by !inner join implicitly (lots must have positions)
            // 'unassigned' is handled by RPC call above.

            if (selectedZoneId) {
                // Fetch all zones to find descendants of selectedZoneId
                // This is needed because positions are assigned to leaf zones,
                // but user may select a parent zone (warehouse, section, etc.)
                const { data: allZones } = await supabase
                    .from('zones')
                    .select('id, parent_id')
                    .eq('system_type', currentSystem.code)

                if (allZones) {
                    // Build set of all descendant zone IDs including the selected one
                    const descendantIds = new Set<string>([selectedZoneId])
                    let changed = true
                    while (changed) {
                        changed = false
                        for (const zone of allZones) {
                            if (zone.parent_id && descendantIds.has(zone.parent_id) && !descendantIds.has(zone.id)) {
                                descendantIds.add(zone.id)
                                changed = true
                            }
                        }
                    }

                    const zoneIds = Array.from(descendantIds)
                    query = query.in('positions.zone_positions.zone_id', zoneIds)
                }
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
                console.error('Error fetching lots:', error)
                showToast('Lỗi tải dữ liệu: ' + error.message, 'error')
            } else if (data) {
                let sortedLots = data as unknown as Lot[];

                if (searchTerm) {
                    const sLower = searchTerm.toLowerCase();
                    sortedLots.sort((a, b) => {
                        const aExact = (a.code && a.code.toLowerCase() === sLower) ||
                            a.lot_items?.some(i => (i.products?.sku && i.products.sku.toLowerCase() === sLower) || (i.products?.name && i.products.name.toLowerCase() === sLower) || (i.products?.internal_code && i.products.internal_code.toLowerCase() === sLower) || (i.products?.internal_name && i.products.internal_name.toLowerCase() === sLower));
                        const bExact = (b.code && b.code.toLowerCase() === sLower) ||
                            b.lot_items?.some(i => (i.products?.sku && i.products.sku.toLowerCase() === sLower) || (i.products?.name && i.products.name.toLowerCase() === sLower) || (i.products?.internal_code && i.products.internal_code.toLowerCase() === sLower) || (i.products?.internal_name && i.products.internal_name.toLowerCase() === sLower));

                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;
                        return 0;
                    });
                }

                setLots(sortedLots)
                setTotalLots(count || 0)

                // Also fetch a separate count for unassigned if not currently filtered by unassigned
                if (positionFilter === 'unassigned') {
                    setUnassignedTotal(count || 0)
                } else {
                    // Quick count for unassigned only using robust join logic
                    const { count: unassignedCount } = await supabase.from('lots')
                        .select('id, positions!left(id)', { count: 'exact', head: true })
                        .eq('system_code', currentSystem.code)
                        .is('positions', null)
                        .neq('status', 'hidden');
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
                lot_items (
                    id,
                    quantity,
                    product_id,
                    products (name, unit, sku, cost_price, internal_code, internal_name, product_code:id),
                    unit
                ),
                suppliers (name),
                qc_info (name),
                lot_tags (tag, lot_item_id),
                products (name, unit, sku, cost_price, internal_code, internal_name),
                positions(id, code, zone_positions!left(zone_id))
            `;

            let query = (supabase.rpc as any)('get_unassigned_lots', { p_system_code: currentSystem.code })
                .select(selectQuery);

            if (searchTerm) {
                const term = `%${searchTerm}%`;
                let orConditionsProd = [`name.ilike.${term}`, `sku.ilike.${term}`, `internal_code.ilike.${term}`, `internal_name.ilike.${term}`];
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm);
                if (isUUID) orConditionsProd.push(`id.eq.${searchTerm}`);

                const { data: prods } = await supabase.from('products').select('id, name, sku').or(orConditionsProd.join(',')).eq('system_type', currentSystem.code);
                let prodIds = prods?.map(p => p.id) || [];

                if (prods && prods.length > 0) {
                    const sLower = searchTerm.toLowerCase();
                    const exactMatches = prods.filter(p =>
                        (p.sku && p.sku.toLowerCase() === sLower) ||
                        (p.name && p.name.toLowerCase() === sLower) ||
                        ((p as any).internal_code && (p as any).internal_code.toLowerCase() === sLower) ||
                        ((p as any).internal_name && (p as any).internal_name.toLowerCase() === sLower)
                    );
                    if (exactMatches.length > 0) prodIds = exactMatches.map(p => p.id);
                }

                const { data: supps } = await supabase.from('suppliers').select('id').ilike('name', term).eq('system_code', currentSystem.code);
                const suppIds = supps?.map(s => s.id) || [];

                const { data: tags } = await supabase.from('lot_tags').select('lot_id').ilike('tag', term);
                const tagLotIds = tags?.map(t => t.lot_id) || [];

                const { data: qcs } = await supabase.from('qc_info').select('id').ilike('name', term).eq('system_code', currentSystem.code);
                const qcIds = qcs?.map(q => q.id) || [];

                let itemLotIds: string[] = [];
                if (prodIds.length > 0) {
                    const { data: items } = await supabase.from('lot_items').select('lot_id').in('product_id', prodIds);
                    if (items) itemLotIds = items.map(i => i.lot_id);
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
                const { data: allZones } = await supabase.from('zones').select('id, parent_id').eq('system_type', currentSystem.code);
                if (allZones) {
                    const descendantIds = new Set<string>([selectedZoneId]);
                    let changed = true;
                    while (changed) {
                        changed = false;
                        for (const zone of allZones) {
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
                const sLower = searchTerm.toLowerCase();
                resultLots.sort((a, b) => {
                    const aExact = (a.code && a.code.toLowerCase() === sLower) ||
                        a.lot_items?.some(i => (i.products?.sku && i.products.sku.toLowerCase() === sLower) || (i.products?.name && i.products.name.toLowerCase() === sLower) || (i.products?.internal_code && i.products.internal_code.toLowerCase() === sLower) || (i.products?.internal_name && i.products.internal_name.toLowerCase() === sLower));
                    const bExact = (b.code && b.code.toLowerCase() === sLower) ||
                        b.lot_items?.some(i => (i.products?.sku && i.products.sku.toLowerCase() === sLower) || (i.products?.name && i.products.name.toLowerCase() === sLower) || (i.products?.internal_code && i.products.internal_code.toLowerCase() === sLower) || (i.products?.internal_name && i.products.internal_name.toLowerCase() === sLower));
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;
                    return 0;
                });
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
                lot_items (
                    id,
                    quantity,
                    product_id,
                    products (name, unit, sku, cost_price, internal_code, internal_name, product_code:id),
                    unit
                ),
                suppliers (name),
                qc_info (name),
                lot_tags (tag, lot_item_id),
                products (name, unit, sku, cost_price, internal_code, internal_name),
                positions(id, code, zone_positions!left(zone_id))
            `;

            let query = supabase
                .from('lots')
                .select(selectQuery)
                .eq('system_code', currentSystem.code)
                .neq('status', 'hidden');

            if (searchTerm) {
                const term = `%${searchTerm}%`;
                let orConditionsProd = [`name.ilike.${term}`, `sku.ilike.${term}`, `internal_code.ilike.${term}`, `internal_name.ilike.${term}`];
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(searchTerm);
                if (isUUID) orConditionsProd.push(`id.eq.${searchTerm}`);

                const { data: prods } = await supabase.from('products').select('id, name, sku').or(orConditionsProd.join(',')).eq('system_type', currentSystem.code);
                let prodIds = prods?.map(p => p.id) || [];

                if (prods && prods.length > 0) {
                    const sLower = searchTerm.toLowerCase();
                    const exactMatches = prods.filter(p =>
                        (p.sku && p.sku.toLowerCase() === sLower) ||
                        (p.name && p.name.toLowerCase() === sLower) ||
                        ((p as any).internal_code && (p as any).internal_code.toLowerCase() === sLower) ||
                        ((p as any).internal_name && (p as any).internal_name.toLowerCase() === sLower)
                    );
                    if (exactMatches.length > 0) prodIds = exactMatches.map(p => p.id);
                }

                const { data: supps } = await supabase.from('suppliers').select('id').ilike('name', term).eq('system_code', currentSystem.code);
                const suppIds = supps?.map(s => s.id) || [];

                const { data: qcs } = await supabase.from('qc_info').select('id').ilike('name', term).eq('system_code', currentSystem.code);
                const qcIds = qcs?.map(q => q.id) || [];

                let itemLotIds: string[] = [];
                if (prodIds.length > 0) {
                    const { data: items } = await supabase.from('lot_items').select('lot_id').in('product_id', prodIds);
                    if (items) itemLotIds = items.map(i => i.lot_id);
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

            const { data } = await (query as any).order('created_at', { ascending: false });

            let resultLots = ((data || []) as Lot[]).filter(l => !l.lot_tags || l.lot_tags.length === 0);

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

    async function handleDeleteLot(id: string) {
        if (!await showConfirm('Bạn có chắc chắn muốn xóa LOT này?')) return

        const { error } = await supabase
            .from('lots')
            .delete()
            .eq('id', id)

        if (error) {
            showToast('Lỗi xóa LOT: ' + error.message, 'error')
        } else {
            // Clear position references immediately
            await supabase.from('positions').update({ lot_id: null }).eq('lot_id', id)

            showToast('Đã xóa LOT thành công', 'success')
            // refetch for correct pagination
            fetchLots(false)
        }
    }

    const handleToggleStar = async (lot: Lot) => {
        const metadata = lot.metadata ? { ...lot.metadata } : {};
        metadata.is_starred = !metadata.is_starred;

        const { error } = await supabase
            .from('lots')
            .update({ metadata: metadata as any })
            .eq('id', lot.id);

        if (error) {
            console.error('Error toggling star:', error);
            showToast('Lỗi khi đánh dấu: ' + error.message, 'error');
        } else {
            // Optimistic update
            setLots(lots.map(l => l.id === lot.id ? { ...l, metadata } : l));
        }
    };


    return {
        // State
        lots, // Now contains only one page
        rawLots: lots, // naming compatibility
        loading,
        searchTerm,
        setSearchTerm,
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
