import { useState, useEffect } from 'react'
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
    const [pageSize, setPageSize] = useState(20)
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
                    fetchLots(false)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [currentSystem])

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
            let query = supabase
                .from('lots')
                .select(`
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
                    positions (
                        id,
                        code,
                        zone_positions !left (zone_id)
                    ),
                    lot_tags (tag, lot_item_id),
                    products (name, unit, sku, cost_price)
                `, { count: 'exact' })
                .eq('system_code', currentSystem.code)
            // Filter out exported status by default?
            // .neq('status', 'exported') 

            // 1. Position Filter
            if (positionFilter === 'assigned') {
                // Lots that HAVE positions
                // Supabase filtering on 1-many existence is tricky without !inner join
                // But we are selecting positions. If we use !inner on positions, it filters lots.
                query = query.not('positions', 'is', null) // strict null check on relation? No.
                // We need to use !inner to enforce existence
                // But we already defined select string. We can't re-define join type easily in JS client?
                // Actually we can just apply a filter on the joined table if we use !inner in the select string.
                // Let's modify the select string dynamically?
            }

            // Implementation Strategy for filters:
            // Since complex filtering (OR across tables, Existence checks) is hard in one go,
            // we will find matching LOT IDs first if needed, then fetch range.

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
            // Strategy: Pre-fetch occupied LOT IDs to filter efficiently
            if (positionFilter !== 'all' || selectedZoneId) {
                let positionQuery = supabase
                    .from('positions')
                    .select('lot_id, zone_positions!inner(zone_id)')
                    .eq('system_type', currentSystem.code)
                    .not('lot_id', 'is', null)

                if (selectedZoneId) {
                    positionQuery = positionQuery.eq('zone_positions.zone_id', selectedZoneId)
                }

                // We get all lot_ids that match the position criteria
                const { data: posData } = await positionQuery
                const validLotIds = Array.from(new Set(posData?.map(p => p.lot_id).filter(Boolean) as string[])) || []

                if (positionFilter === 'assigned') {
                    if (validLotIds.length > 0) {
                        query = query.in('id', validLotIds)
                    } else {
                        // User wants assigned, but no positions are assigned -> return empty
                        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
                    }
                } else if (positionFilter === 'unassigned') {
                    if (validLotIds.length > 0) {
                        // If we are filtering by Zone, 'unassigned' in a zone context is ambiguous. 
                        // Usually means "Lots NOT in this zone"? Or "Lots NOT in ANY zone"?
                        // Standard "Unassigned" means "Not in any position".
                        // If selectedZoneId is present, Unassigned + Zone is mutually exclusive?
                        // UI should probably disable Unassigned if Zone is selected, or this means "Unassigned lots" (global)
                        // Let's assume Unassigned means "Global Unassigned" regardless of zone selector, 
                        // OR if zone is selected, "Lots in this zone"? No.
                        // Let's stick to Global Unassigned if filter is 'unassigned'.
                        if (selectedZoneId) {
                            // "Unassigned" + "Zone A" -> Logic conflict. 
                            // If user selects "Unassigned", they want lots not on map. Zone filter should be ignored or reset.
                            // But if they persist, we just treat as Global Unassigned.
                            // Effectively we ignore selectedZoneId for UNASSIGNED filter?
                            // Let's filter out ALL occupied lots.

                            // Re-fetch ALL occupied IDs for global unassigned check
                            const { data: allBusy } = await supabase
                                .from('positions')
                                .select('lot_id')
                                .eq('system_type', currentSystem.code)
                                .not('lot_id', 'is', null)

                            const allBusyIds = allBusy?.map(p => p.lot_id) || []
                            if (allBusyIds.length > 0) query = query.not('id', 'in', allBusyIds)
                        } else {
                            query = query.not('id', 'in', validLotIds)
                        }
                    }
                } else if (positionFilter === 'all' && selectedZoneId) {
                    // Show only lots in this zone
                    if (validLotIds.length > 0) {
                        query = query.in('id', validLotIds)
                    } else {
                        query = query.eq('id', '00000000-0000-0000-0000-000000000000')
                    }
                }
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
