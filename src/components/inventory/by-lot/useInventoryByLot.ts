import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { Lot, GroupedProduct } from './types'

export function useInventoryByLot(units: any[]) {
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedBranch, setSelectedBranch] = useState('Tất cả')
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

    const { systemType } = useSystem()
    const { convertUnit, unitNameMap, conversionMap } = useUnitConversion()

    useEffect(() => {
        fetchBranches()
        fetchLots()

        // 🟢 Real-time Subscription: Listen for changes in positions
        // This ensures that when a position is assigned to a LOT on mobile, 
        // the desktop Lot Management page updates automatically.
        const channel = supabase
            .channel('inventory-by-lot-positions')
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
    }, [systemType, selectedBranch])

    async function fetchBranches() {
        const { data, error } = await supabase
            .from('branches')
            .select('id, name, is_default')
            .order('is_default', { ascending: false })
            .order('name')

        if (error) {
            console.error('Error fetching branches:', error)
        }
        if (data) {
            setBranches(data)
            const defaultBranch = data.find(b => b.is_default)
            if (defaultBranch) {
                setSelectedBranch(defaultBranch.name)
            }
        }
    }

    async function fetchLots(showLoading = true) {
        if (showLoading) setLoading(true)
        const { data, error } = await supabase
            .from('lots')
            .select(`
                *,
                lot_items (
                    id,
                    quantity,
                    unit,
                    product_id,
                    products (
                        name,
                        unit,
                        sku,
                        product_code:id,
                        system_type
                    )
                ),
                products (name, unit, product_code:id, sku, system_type),
                suppliers(name),
                positions(code),
                lot_tags(tag, lot_item_id)
            `)
            .eq('status', 'active')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching lots:', error)
        } else if (data) {
            // Filter by systemType & Branch in memory
            const filtered = (data as any[]).filter(lot => {
                // System Type Filter
                let systemTypeCheck = true
                if (systemType) {
                    const hasMainMatch = lot.products && lot.products.system_type === systemType
                    const hasItemMatch = lot.lot_items && lot.lot_items.some((item: any) => item.products?.system_type === systemType)
                    systemTypeCheck = hasMainMatch || hasItemMatch
                }
                if (!systemTypeCheck) return false

                // Branch Filter
                if (selectedBranch && selectedBranch !== "Tất cả") {
                    if (lot.warehouse_name !== selectedBranch) return false
                }

                return true;
            });
            setLots(filtered as unknown as Lot[])
        }
        setLoading(false)
    }

    const groupedInventory = useMemo(() => {
        const groups = new Map<string, GroupedProduct>()

        lots.forEach(lot => {
            // Helper to process a single item logic
            const processItem = (
                sku: string,
                name: string,
                unit: string,
                qty: number,
                itemId: string | null,
                productId: string | null,
                baseUnit: string | null
            ) => {
                let displayQty = qty
                let displayUnit = unit
                let key = `${sku}__${unit}`

                // Logic conversion
                const targetUnit = targetUnitId ? units.find(u => u.id === targetUnitId) : null
                const isConvertible = targetUnitId && productId && baseUnit && (
                    baseUnit.toLowerCase() === targetUnit?.name?.toLowerCase() ||
                    conversionMap.get(productId)?.has(targetUnitId)
                )

                if (targetUnitId && isConvertible) {
                    displayUnit = targetUnit!.name
                    displayQty = convertUnit(productId, unit, targetUnit!.name, qty, baseUnit)
                    key = `${sku}__${targetUnitId}`
                } else if (targetUnitId) {
                    // Not convertible, keep separate
                    key = `${sku}__${unit}__UNCONVERTIBLE`
                }

                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        productSku: sku,
                        productCode: sku, // Using SKU as code for display
                        productName: name,
                        unit: displayUnit,
                        totalQuantity: 0,
                        variants: new Map(),
                        lotCodes: []
                    })
                }
                const group = groups.get(key)!
                group.totalQuantity += displayQty
                if (!group.lotCodes.includes(lot.code)) group.lotCodes.push(lot.code)

                // Determine Tag/Variant
                let tags: string[] = []
                if (lot.lot_tags) {
                    // Item specific tags
                    const itemTags = lot.lot_tags.filter(t => t.lot_item_id === itemId).map(t => t.tag)
                    // General tags (assume apply to all items)
                    const generalTags = lot.lot_tags.filter(t => !t.lot_item_id).map(t => t.tag)
                    tags = [...new Set([...itemTags, ...generalTags])].sort()
                }

                const compositeTag = tags.length > 0 ? tags.join('; ') : 'Không có mã phụ' // Or 'Chưa phân loại'

                // Aggregate into variant
                const currentVariantQty = group.variants.get(compositeTag) || 0
                group.variants.set(compositeTag, currentVariantQty + displayQty)
            }

            if (lot.lot_items && lot.lot_items.length > 0) {
                lot.lot_items.forEach(item => {
                    if (item.products) {
                        const itemUnit = item.unit || item.products.unit
                        const qty = item.quantity || 0
                        processItem(
                            item.products.sku,
                            item.products.name,
                            itemUnit,
                            qty,
                            item.id,
                            item.product_id,
                            item.products.unit
                        )
                    }
                })
            } else if (lot.products) {
                // Legacy
                processItem(
                    lot.products.sku,
                    lot.products.name,
                    lot.products.unit,
                    lot.quantity || 0,
                    null,
                    lot.product_id,
                    lot.products.unit
                )
            }
        })

        // Search Filter
        const searchLower = (searchTerm || '').toLowerCase()
        const result = Array.from(groups.values()).filter(g =>
            g.productSku.toLowerCase().includes(searchLower) ||
            g.productName.toLowerCase().includes(searchLower) ||
            Array.from(g.variants.keys()).some(k => k.toLowerCase().includes(searchLower))
        )

        // Sort by SKU
        return result.sort((a, b) => a.productSku.localeCompare(b.productSku))

    }, [lots, searchTerm, targetUnitId, unitNameMap, conversionMap, units, convertUnit])

    const toggleExpand = (key: string) => {
        const newSet = new Set(expandedProducts)
        if (newSet.has(key)) newSet.delete(key)
        else newSet.add(key)
        setExpandedProducts(newSet)
    }

    return {
        lots,
        loading,
        searchTerm,
        setSearchTerm,
        selectedBranch,
        setSelectedBranch,
        targetUnitId,
        setTargetUnitId,
        branches,
        groupedInventory,
        expandedProducts,
        toggleExpand,
        systemType
    }
}
