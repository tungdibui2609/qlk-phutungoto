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
        products: { name: string; unit: string | null; product_code?: string; sku: string; cost_price?: number | null } | null
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
    products?: { name: string; unit: string | null; product_code?: string; sku?: string; cost_price?: number | null } | null
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

    const [searchTerm, setSearchTerm] = useState('')
    const [positionFilter, setPositionFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [dateFilterField, setDateFilterField] = useState<DateFilterField>('created_at')
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')

    // Data for Selection
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [qcList, setQCList] = useState<QCInfo[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [productUnits, setProductUnits] = useState<ProductUnit[]>([])
    const [branches, setBranches] = useState<any[]>([])

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
                    // Use Ref to get LATEST fetchLots with current state (filters)
                    fetchLotsRef.current(false)
                }
            )
            .subscribe()

        return () => {
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
    }, [searchTerm, positionFilter, selectedZoneId, dateFilterField, startDate, endDate])

    // Effect for page change ONLY
    useEffect(() => {
        if (!currentSystem?.code) return
        fetchLots()
    }, [page, pageSize])


    async function fetchCommonData() {
        if (!currentSystem?.code) return

        const [prodRes, suppRes, qcRes, branchRes, unitRes, pUnitRes] = await Promise.all([
            supabase.from('products').select('*').eq('system_type', currentSystem.code).order('name'),
            supabase.from('suppliers').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('qc_info').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('units').select('*'),
            supabase.from('product_units').select('*')
        ])

        if (prodRes.data) setProducts(prodRes.data)
        if (suppRes.data) setSuppliers(suppRes.data)
        if (qcRes.data) setQCList(qcRes.data)
        if (branchRes.data) setBranches(branchRes.data)
        if (unitRes.data) setUnits(unitRes.data)
        if (pUnitRes.data) setProductUnits(pUnitRes.data)
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
                        product_code:id
                    ),
                    unit
                ),
                suppliers (name),
                qc_info (name),
                lot_tags (tag, lot_item_id),
                products (name, unit, sku, cost_price)
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
                if (positionFilter === 'assigned' || selectedZoneId) {
                    selectQuery += `, positions!inner(id, code, zone_positions!left(zone_id))`
                } else {
                    selectQuery += `, positions(id, code, zone_positions!left(zone_id))`
                }

                query = supabase
                    .from('lots')
                    .select(selectQuery, { count: 'exact' })
                    .eq('system_code', currentSystem.code)
                    .neq('status', 'exported')
                    .neq('status', 'hidden')
            }

            // Implementation Strategy for filters:
            // Since complex filtering (OR across tables, Existence checks) is hard in one go,
            // we use RPC for unassigned, and matching IDs for search term.

            let matchingIds: string[] | null = null

            // 1. Search Term Logic (Deep Search)
            if (searchTerm) {
                const term = `%${searchTerm}%`
                // Find products matching
                const { data: prods } = await supabase.from('products').select('id').ilike('name', term).eq('system_type', currentSystem.code)
                const prodIds = prods?.map(p => p.id) || []

                // Find suppliers matching
                const { data: supps } = await supabase.from('suppliers').select('id').ilike('name', term).eq('system_code', currentSystem.code)
                const suppIds = supps?.map(s => s.id) || []

                // Find lots with these products or suppliers OR code/note match
                // We'll use an RPC or raw OR query if possible. 
                // Alternatively, fetch IDs from lot_items where product_id in prodIds
                let itemLotIds: string[] = []
                if (prodIds.length > 0) {
                    const { data: items } = await supabase.from('lot_items').select('lot_id').in('product_id', prodIds)
                    if (items) itemLotIds = items.map(i => i.lot_id)
                }

                // Construct OR filter for top-level lots
                let orConditions = [`code.ilike.${term}`]
                if (itemLotIds.length > 0) orConditions.push(`id.in.(${itemLotIds.join(',')})`)
                if (suppIds.length > 0) orConditions.push(`supplier_id.in.(${suppIds.join(',')})`)

                // Note: .or() with large lists can be slow/error prone URL length. 
                // If lists are huge, this breaks. But for now mostly okay.
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
                // Filter by specific zone using the embedded resource
                // Since we used !inner on positions, we can safely filter on it
                query = query.eq('positions.zone_positions.zone_id', selectedZoneId)
            }

            // Pagination
            const from = page * pageSize
            const to = from + pageSize - 1

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to)

            if (error) {
                console.error('Error fetching lots:', error)
                showToast('Lỗi tải dữ liệu: ' + error.message, 'error')
            } else if (data) {
                setLots(data as unknown as Lot[])
                setTotalLots(count || 0)
            }
        } catch (err: any) {
            console.error('Error in fetchLots:', err)
        } finally {
            setLoading(false)
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

        // Common Data
        products,
        suppliers,
        qcList,
        units,
        productUnits,
        branches,

        // Actions
        fetchLots,
        handleDeleteLot,
        handleToggleStar,
        isModuleEnabled: hasModule,
        isUtilityEnabled: hasModule,
        fetchCommonData
    }
}
