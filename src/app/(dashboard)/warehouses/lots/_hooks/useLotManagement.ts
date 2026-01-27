import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'

export type Lot = Database['public']['Tables']['lots']['Row'] & {
    system_code?: string
    lot_items: (Database['public']['Tables']['lot_items']['Row'] & {
        products: { name: string; unit: string | null; product_code?: string; sku: string; cost_price?: number | null } | null
        unit?: string | null
    })[] | null
    suppliers: { name: string } | null
    qc_info: { name: string } | null
    positions: { code: string }[] | null
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
    const { currentSystem } = useSystem()
    const { showToast, showConfirm } = useToast()
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Data for Selection
    const [products, setProducts] = useState<Product[]>([])
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [qcList, setQCList] = useState<QCInfo[]>([])
    const [units, setUnits] = useState<Unit[]>([])
    const [productUnits, setProductUnits] = useState<ProductUnit[]>([])
    const [branches, setBranches] = useState<any[]>([])

    // Module Configuration
    const [lotModules, setLotModules] = useState<string[] | null>(null)

    useEffect(() => {
        if (currentSystem?.code) {
            fetchLots()
        }
        fetchCommonData()
    }, [currentSystem])

    async function fetchCommonData() {
        if (!currentSystem?.code) return

        const [prodRes, suppRes, qcRes, branchRes, unitRes, pUnitRes, sysConfigRes] = await Promise.all([
            supabase.from('products').select('*').eq('system_type', currentSystem.code).order('name'),
            supabase.from('suppliers').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('qc_info').select('*').eq('system_code', currentSystem.code).order('name'),
            supabase.from('branches').select('*').order('is_default', { ascending: false }).order('name'),
            supabase.from('units').select('*'),
            supabase.from('product_units').select('*'),
            supabase.from('system_configs').select('lot_modules').eq('system_code', currentSystem.code).single()
        ])

        if (prodRes.data) setProducts(prodRes.data)
        if (suppRes.data) setSuppliers(suppRes.data)
        if (qcRes.data) setQCList(qcRes.data)
        if (branchRes.data) setBranches(branchRes.data)
        if (unitRes.data) setUnits(unitRes.data)
        if (pUnitRes.data) setProductUnits(pUnitRes.data)

        // Handle config
        const config = (sysConfigRes.data as any)
        let mods: string[] = []
        if (config && config.lot_modules) {
            if (Array.isArray(config.lot_modules)) mods = config.lot_modules
            else if (typeof config.lot_modules === 'string') {
                try { mods = JSON.parse(config.lot_modules) } catch (e) { mods = [] }
            }
        }
        setLotModules(mods)
    }

    async function fetchLots() {
        if (!currentSystem?.code) return;

        setLoading(true)
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
                positions (code),
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

    const isModuleEnabled = (moduleId: string) => {
        if (!lotModules) return true // Default enabled if no config
        return lotModules.includes(moduleId)
    }

    /**
     * Checks if a specific logic utility is enabled (stored in systems.modules.utility_modules)
     */
    const isUtilityEnabled = (utilityId: string) => {
        if (!currentSystem?.modules) return false
        const modules = typeof currentSystem.modules === 'string'
            ? JSON.parse(currentSystem.modules)
            : currentSystem.modules
        return Array.isArray(modules?.utility_modules) && modules.utility_modules.includes(utilityId)
    }

    const filteredLots = lots.filter(lot =>
        lot.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lot.notes && lot.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return {
        // State
        lots: filteredLots,
        rawLots: lots,
        loading,
        searchTerm,
        setSearchTerm,
        lotModules,

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
        isModuleEnabled,
        isUtilityEnabled,
        fetchCommonData
    }
}
