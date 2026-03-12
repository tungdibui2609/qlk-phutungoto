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
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
    const [allZones, setAllZones] = useState<any[]>([])
    const [posToZoneMap, setPosToZoneMap] = useState<Record<string, string>>({})
    const [zoneHierarchy, setZoneHierarchy] = useState<Record<string, string | null>>({})
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())
    const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})

    const { systemType } = useSystem()
    const { convertUnit, unitNameMap, conversionMap } = useUnitConversion()

    useEffect(() => {
        setSelectedZoneId(null)
        fetchBranches()
        fetchLots()

        // 🟢 Real-time Subscription: Listen for changes in positions
        const channel = supabase
            .channel('inventory-by-lot-positions')
            .on(
                'postgres_changes',
                {
                    event: '*',
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

        let allData: any[] = []
        let fetchFrom = 0
        const FETCH_PAGE_SIZE = 1000

        try {
            // 1. Fetch ALL Zones and Zone Positions mapping for the system
            const PAGE_SIZE_MAP = 1000
            
            // 1a. Fetch ALL Zones
            let allZonesData: any[] = []
            let zonesFrom = 0
            while (true) {
                const { data, error } = await supabase
                    .from('zones')
                    .select('*')
                    .eq('system_type', systemType)
                    .range(zonesFrom, zonesFrom + PAGE_SIZE_MAP - 1)
                
                if (error) throw error
                if (!data || data.length === 0) break
                allZonesData = [...allZonesData, ...data]
                if (data.length < PAGE_SIZE_MAP) break
                zonesFrom += PAGE_SIZE_MAP
            }
            
            setAllZones(allZonesData)
            const hierarchy: Record<string, string | null> = {}
            allZonesData.forEach((z: any) => {
                hierarchy[z.id] = z.parent_id
            })
            setZoneHierarchy(hierarchy)

            // 1b. Fetch ALL Zone-Position Mappings
            let allZPData: any[] = []
            let zpFrom = 0
            while (true) {
                const { data, error } = await supabase
                    .from('zone_positions')
                    .select('zone_id, position_id')
                    .range(zpFrom, zpFrom + PAGE_SIZE_MAP - 1)
                
                if (error) throw error
                if (!data || data.length === 0) break
                allZPData = [...allZPData, ...data]
                if (data.length < PAGE_SIZE_MAP) break
                zpFrom += PAGE_SIZE_MAP
            }

            const mapping: Record<string, string> = {}
            allZPData.forEach((item: any) => {
                if (item.position_id && item.zone_id) {
                    mapping[item.position_id] = item.zone_id
                }
            })
            setPosToZoneMap(mapping)

            // 1c. Fetch ALL Categories
            const { data: catData, error: catError } = await supabase
                .from('categories')
                .select('id, name')
            if (catError) throw catError
            const cMap: Record<string, string> = {}
            catData?.forEach(c => cMap[c.id] = c.name)
            setCategoryMap(cMap)

            // 2. Fetch LOTs
            while (true) {
                const { data: pageData, error: pageError } = await supabase
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
                                 system_type,
                                 category_id
                             )
                         ),
                         products (name, unit, product_code:id, sku, system_type, category_id),
                        suppliers(name),
                        positions!positions_lot_id_fkey(id, code),
                        lot_tags(tag, lot_item_id)
                    `)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .range(fetchFrom, fetchFrom + FETCH_PAGE_SIZE - 1)

                if (pageError) {
                    console.error('Error fetching page of lots:', pageError)
                    break
                }
                if (!pageData || pageData.length === 0) break
                allData = [...allData, ...pageData]
                if (pageData.length < FETCH_PAGE_SIZE) break
                fetchFrom += FETCH_PAGE_SIZE
            }

            // Filter by systemType & Branch in memory
            const filtered = allData.filter(lot => {
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
                    const lotWarehouse = (lot.warehouse_name || '').trim()
                    const targetBranch = selectedBranch.trim()
                    if (lotWarehouse !== targetBranch) return false
                }

                return true;
            });
            setLots(filtered as unknown as Lot[])
        } catch (err) {
            console.error('Error in fetchLots loop:', err)
        } finally {
            setLoading(false)
        }
    }

    const groupedInventory = useMemo(() => {
        const searchLower = (searchTerm || '').toLowerCase()

        // 1. Helper for Zone Filtering
        const isDescendantOrSelf = (targetId: string, searchId: string): boolean => {
            if (targetId === searchId) return true
            let current = zoneHierarchy[targetId]
            while (current) {
                if (current === searchId) return true
                current = zoneHierarchy[current]
            }
            return false
        }

        // 2. Perform Filtering on LOTs first
        const filteredLots = lots.filter(lot => {
            // Zone Filter
            if (selectedZoneId) {
                const matchesZone = lot.positions?.some((p: any) => {
                    const zId = posToZoneMap[p.id]
                    return zId && isDescendantOrSelf(zId, selectedZoneId)
                })
                if (!matchesZone) return false
            }

            // Simple Search Filter on Lot level (to keep relevant lots)
            // If LOT has items, they will be filtered individually later
            if (!searchTerm) return true

            const keywords = searchTerm.split(';').map(k => k.trim().toLowerCase()).filter(Boolean)
            if (keywords.length === 0) return true

            const matchInLot = keywords.some(key => 
                lot.code.toLowerCase().includes(key) ||
                (lot.products?.name?.toLowerCase() || '').includes(key) ||
                (lot.products?.sku?.toLowerCase() || '').includes(key) ||
                (lot.products?.category_id && categoryMap[lot.products.category_id]?.toLowerCase().includes(key)) ||
                (lot.suppliers?.name?.toLowerCase() || '').includes(key) ||
                (lot.lot_tags?.some(t => t.tag.toLowerCase().includes(key)))
            )
            
            // If lot items exist, we check if any item matches
            const matchInItems = lot.lot_items?.some(item => 
                keywords.some(key => 
                    (item.products?.name?.toLowerCase() || '').includes(key) ||
                    (item.products?.sku?.toLowerCase() || '').includes(key) ||
                    (item.products?.category_id && categoryMap[item.products.category_id]?.toLowerCase().includes(key))
                )
            )

            return matchInLot || matchInItems
        })

        const groups = new Map<string, GroupedProduct>()

        // 3. Aggregate only the matching lots
        filteredLots.forEach(lot => {
            const processItem = (
                sku: string,
                name: string,
                unit: string,
                qty: number,
                itemId: string | null,
                productId: string | null,
                baseUnit: string | null,
                categoryId: string | null
            ) => {
                // Secondary Search Filter on specific Variant/Item data
                if (searchTerm) {
                    const keywords = searchTerm.split(';').map(k => k.trim().toLowerCase()).filter(Boolean)
                    if (keywords.length > 0) {
                        const matchesFields = keywords.some(key => 
                            name.toLowerCase().includes(key) || 
                            sku.toLowerCase().includes(key) ||
                            (categoryId && categoryMap[categoryId]?.toLowerCase().includes(key))
                        )
                        
                        const itemTags = lot.lot_tags?.filter(t => t.lot_item_id === itemId || !t.lot_item_id).map(t => t.tag.toLowerCase()) || []
                        const matchesTags = keywords.some(key => itemTags.some(t => t.includes(key)))
                        
                        const matchesLotCode = keywords.some(key => lot.code.toLowerCase().includes(key))

                        if (!matchesFields && !matchesTags && !matchesLotCode) {
                            return // Skip this variant/item if it doesn't match search
                        }
                    }
                }

                let displayQty = qty
                let displayUnit = unit
                let key = `${sku}__${unit}`

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
                    key = `${sku}__${unit}__UNCONVERTIBLE`
                }

                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        productSku: sku,
                        productCode: sku,
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

                let tags: string[] = []
                if (lot.lot_tags) {
                    const itemTags = lot.lot_tags.filter(t => t.lot_item_id === itemId).map(t => t.tag)
                    const generalTags = lot.lot_tags.filter(t => !t.lot_item_id).map(t => t.tag)
                    tags = [...new Set([...itemTags, ...generalTags])].sort()
                }

                const compositeTag = tags.length > 0 ? tags.join('; ') : 'Không có mã phụ'
                const currentVariantQty = group.variants.get(compositeTag) || 0
                group.variants.set(compositeTag, currentVariantQty + displayQty)
            }

            if (lot.lot_items && lot.lot_items.length > 0) {
                lot.lot_items.forEach(item => {
                    if (item.products) {
                        processItem(
                            item.products.sku,
                            item.products.name,
                            item.unit || item.products.unit,
                             item.quantity || 0,
                             item.id,
                             item.product_id,
                             item.products.unit,
                             item.products.category_id ?? null
                         )
                     }
                 })
             } else if (lot.products) {
                 processItem(
                     lot.products.sku,
                     lot.products.name,
                     lot.products.unit,
                     lot.quantity || 0,
                     null,
                     lot.product_id,
                     lot.products.unit,
                     lot.products.category_id ?? null
                 )
             }
        })

        return Array.from(groups.values()).sort((a, b) => a.productSku.localeCompare(b.productSku))

    }, [lots, searchTerm, targetUnitId, unitNameMap, conversionMap, units, convertUnit, selectedZoneId, posToZoneMap, zoneHierarchy, categoryMap])

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
        selectedZoneId,
        setSelectedZoneId,
        allZones,
        targetUnitId,
        setTargetUnitId,
        branches,
        groupedInventory,
        expandedProducts,
        toggleExpand,
        systemType
    }
}
