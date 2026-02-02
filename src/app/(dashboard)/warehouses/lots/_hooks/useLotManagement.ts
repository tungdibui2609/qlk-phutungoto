import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { matchSearch } from '@/lib/searchUtils'

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
    const [searchTerm, setSearchTerm] = useState('')
    const [positionFilter, setPositionFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [dateFilterField, setDateFilterField] = useState<'created_at' | 'inbound_date' | 'peeling_date' | 'packaging_date'>('created_at')
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
        const { data, error } = await supabase
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
                    zone_positions (zone_id)
                ),
                lot_tags (tag, lot_item_id),
                products (name, unit, sku, cost_price)
            `)
            .eq('system_code', currentSystem.code)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching lots:', error)
        } else if (data) {
            setLots(data as unknown as Lot[])
        }
        setLoading(false)
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
            setLots(lots.filter(lot => lot.id !== id))
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
            setLots(lots.map(l => l.id === lot.id ? { ...l, metadata } : l));
        }
    };


    const filteredLots = lots.filter(lot => {
        // Hide exhausted lots unless searching specifically? 
        // For now, absolute hide as requested.
        if (lot.status === 'exported') return false

        // 1. Position Filter
        const hasPosition = lot.positions && lot.positions.length > 0
        if (positionFilter === 'assigned' && !hasPosition) return false
        if (positionFilter === 'unassigned' && hasPosition) return false

        // 2. Date Range Filter
        if (startDate || endDate) {
            const lotDateStr = lot[dateFilterField]
            if (!lotDateStr) return false

            const lotDate = new Date(lotDateStr)
            lotDate.setHours(0, 0, 0, 0)

            if (startDate) {
                const start = new Date(startDate)
                start.setHours(0, 0, 0, 0)
                if (lotDate < start) return false
            }

            if (endDate) {
                const end = new Date(endDate)
                end.setHours(23, 59, 59, 999)
                if (lotDate > end) return false
            }
        }

        // 3. Zone/Position Filter (Advanced)
        if (selectedZoneId) {
            const lotInSelectedZone = lot.positions?.some(pos => {
                const zps = (pos as any).zone_positions;
                if (Array.isArray(zps)) {
                    return zps.some((zp: any) => zp.zone_id === selectedZoneId);
                } else if (zps && typeof zps === 'object') {
                    return (zps as any).zone_id === selectedZoneId;
                }
                return false;
            });
            if (!lotInSelectedZone) return false;
        }

        // 4. Search Term Filter
        if (!searchTerm) return true

        // Dynamic deep search using shared utility
        return matchSearch(lot, searchTerm)
    })

    return {
        // State
        lots: filteredLots,
        rawLots: lots,
        loading,
        searchTerm,
        setSearchTerm,
        positionFilter,
        setSelectedZoneId,
        dateFilterField,
        setDateFilterField,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        selectedZoneId,

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
