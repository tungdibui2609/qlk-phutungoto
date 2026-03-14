import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
interface ProductInfo {
    name: string
    unit: string
    product_code?: string
    sku: string
    system_type: string
    category_id?: string | null
    product_category_rel?: { category_id: string }[]
}

export interface Lot {
    id: string
    code: string
    product_id: string | null
    quantity: number | null
    status: string | null
    warehouse_name: string | null
    created_at: string
    lot_items?: any[]
    products?: ProductInfo | null
    suppliers?: { name: string } | null
    positions?: { id: string, code: string }[]
    lot_tags?: { tag: string, lot_item_id: string | null }[]
}

export interface GroupedProduct {
    key: string
    productSku: string
    productCode: string
    productName: string
    unit: string
    totalQuantity: number
    variants: Map<string, number>
    lotCodes: string[]
    categoryIds: string[]
}
import { groupWarehouseData } from '@/lib/warehouseUtils'

export function useInventoryByLot(
    units: any[],
    externalFilters?: {
        searchTerm?: string
        selectedBranch?: string
        selectedCategoryIds?: string[]
        targetUnitId?: string | null
        selectedZoneId?: string | null
    }
) {
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)
    const [internalSearchTerm, setInternalSearchTerm] = useState('')
    const [internalBranch, setInternalBranch] = useState('Tất cả')
    const [internalSelectedZoneId, setInternalSelectedZoneId] = useState<string | null>(null)
    const [internalTargetUnitId, setInternalTargetUnitId] = useState<string | null>(null)
    
    // Sycn with external filters if provided
    const searchTerm = externalFilters?.searchTerm !== undefined ? externalFilters.searchTerm : internalSearchTerm
    const setSearchTerm = externalFilters?.searchTerm !== undefined ? (() => {}) : setInternalSearchTerm
    
    const selectedBranch = externalFilters?.selectedBranch !== undefined ? externalFilters.selectedBranch : internalBranch
    const setSelectedBranch = externalFilters?.selectedBranch !== undefined ? (() => {}) : setInternalBranch

    const targetUnitId = externalFilters?.targetUnitId !== undefined ? externalFilters.targetUnitId : internalTargetUnitId
    const setTargetUnitId = externalFilters?.targetUnitId !== undefined ? (() => {}) : setInternalTargetUnitId

    const selectedZoneId = externalFilters?.selectedZoneId !== undefined ? externalFilters.selectedZoneId : internalSelectedZoneId
    const setSelectedZoneId = externalFilters?.selectedZoneId !== undefined ? (() => {}) : setInternalSelectedZoneId

    const selectedCategoryIds = externalFilters?.selectedCategoryIds || []
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
            console.log(`Fetched ${allZonesData.length} zones for system ${systemType}`)
            

            // 1b. Fetch Positions and their Zone mappings
            let positionsData: any[] = []
            let posFrom = 0
            while (true) {
                const { data, error } = await supabase
                    .from('positions')
                    .select('id, code, system_type')
                    .range(posFrom, posFrom + PAGE_SIZE_MAP - 1)
                
                if (error) throw error
                if (!data || data.length === 0) break
                positionsData = [...positionsData, ...data]
                if (data.length < PAGE_SIZE_MAP) break
                posFrom += PAGE_SIZE_MAP
            }

            let zpData: any[] = []
            let zpFrom = 0
            while (true) {
                const { data, error } = await supabase
                    .from('zone_positions')
                    .select('zone_id, position_id')
                    .range(zpFrom, zpFrom + PAGE_SIZE_MAP - 1)
                
                if (error) throw error
                if (!data || data.length === 0) break
                zpData = [...zpData, ...data]
                if (data.length < PAGE_SIZE_MAP) break
                zpFrom += PAGE_SIZE_MAP
            }

            // Create a mapping of position_id -> zone_id
            const posToZoneInternal = new Map<string, string>()
            zpData.forEach(item => {
                if (item.position_id && item.zone_id) {
                    posToZoneInternal.set(item.position_id, item.zone_id)
                }
            })

            // Attach zone_id to positions for the grouping util
            const allPositionsData = positionsData.map(p => ({
                ...p,
                zone_id: posToZoneInternal.get(p.id) || null
            }))

            console.log(`Fetched ${allZonesData.length} zones, ${allPositionsData.length} positions and ${zpData.length} mappings`)

            // 1c. Apply Grouping Logic (Gom ô)
            console.log('Applying groupWarehouseData...')
            const { zones: groupedZones, positions: groupedPositions } = groupWarehouseData(allZonesData, allPositionsData)
            console.log(`Grouping complete. Zones: ${groupedZones.length}, Positions: ${groupedPositions.length}`)
            
            setAllZones(groupedZones)
            
            // Rebuild hierarchy from grouped zones
            const hierarchy: Record<string, string | null> = {}
            groupedZones.forEach((z: any) => {
                hierarchy[z.id] = z.parent_id
            })
            setZoneHierarchy(hierarchy)

            // Rebuild Position to Zone mapping using grouped positions
            const mapping: Record<string, string> = {}
            groupedPositions.forEach((p: any) => {
                if (p.id && p.zone_id) {
                    mapping[p.id] = p.zone_id
                }
            })
            setPosToZoneMap(mapping)

            // 1d. Fetch ALL Categories
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
                                 category_id,
                                 product_category_rel(category_id)
                             )
                         ),
                         products (
                            name,
                            unit,
                            product_code:id,
                            sku,
                            system_type,
                            category_id,
                            product_category_rel(category_id)
                        ),
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
        } catch (err: any) {
            console.error('Error in fetchLots loop:', err)
            // Try to log more details if it's an Error object
            if (err instanceof Error) {
                console.error('Error message:', err.message)
                console.error('Stack trace:', err.stack)
            }
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

            // 🟢 Category Filter
            if (selectedCategoryIds.length > 0) {
                const getProductCategoryIds = (p: any) => {
                    if (!p) return []
                    const ids = []
                    if (p.category_id) ids.push(p.category_id)
                    if (p.product_category_rel) {
                        p.product_category_rel.forEach((rel: any) => ids.push(rel.category_id))
                    }
                    return ids
                }

                const lotCatIds = getProductCategoryIds(lot.products)
                const matchesCategory = lotCatIds.some(id => selectedCategoryIds.includes(id))
                
                const matchesItemCategory = lot.lot_items?.some(item => {
                    const itemCatIds = getProductCategoryIds(item.products)
                    return itemCatIds.some(id => selectedCategoryIds.includes(id))
                })

                if (!matchesCategory && !matchesItemCategory) return false
            }

            // Simple Search Filter on Lot level (to keep relevant lots)
            // If LOT has items, they will be filtered individually later
            if (!searchTerm) return true

            const keywords = searchTerm.split(';').map(k => k.trim().toLowerCase()).filter(Boolean)
            if (keywords.length === 0) return true

            const matchInLot = keywords.some(key => {
                const p = lot.products
                const catNames: string[] = []
                if (p?.category_id && categoryMap[p.category_id]) catNames.push(categoryMap[p.category_id].toLowerCase())
                if (p?.product_category_rel) {
                    p.product_category_rel.forEach((rel: any) => {
                        if (categoryMap[rel.category_id]) catNames.push(categoryMap[rel.category_id].toLowerCase())
                    })
                }

                return lot.code.toLowerCase().includes(key) ||
                    (p?.name?.toLowerCase() || '').includes(key) ||
                    (p?.sku?.toLowerCase() || '').includes(key) ||
                    catNames.some(cn => cn.includes(key)) ||
                    (lot.suppliers?.name?.toLowerCase() || '').includes(key) ||
                    (lot.lot_tags?.some(t => t.tag.toLowerCase().includes(key)))
            })
            
            // If lot items exist, we check if any item matches
            const matchInItems = lot.lot_items?.some(item => {
                const p = item.products
                const catNames: string[] = []
                if (p?.category_id && categoryMap[p.category_id]) catNames.push(categoryMap[p.category_id].toLowerCase())
                if (p?.product_category_rel) {
                    p.product_category_rel.forEach((rel: any) => {
                        if (categoryMap[rel.category_id]) catNames.push(categoryMap[rel.category_id].toLowerCase())
                    })
                }

                return keywords.some(key => 
                    (p?.name?.toLowerCase() || '').includes(key) ||
                    (p?.sku?.toLowerCase() || '').includes(key) ||
                    catNames.some(cn => cn.includes(key))
                )
            })

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
                categoryId: string | null,
                productCategoryRel?: { category_id: string }[]
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

                const catIds: string[] = []
                if (categoryId) catIds.push(categoryId)
                productCategoryRel?.forEach(rel => {
                    if (rel.category_id && !catIds.includes(rel.category_id)) catIds.push(rel.category_id)
                })

                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        productSku: sku,
                        productCode: sku,
                        productName: name,
                        unit: displayUnit,
                        totalQuantity: 0,
                        variants: new Map(),
                        lotCodes: [],
                        categoryIds: catIds
                    })
                }
                const group = groups.get(key)!
                group.totalQuantity += displayQty
                if (!group.lotCodes.includes(lot.code)) group.lotCodes.push(lot.code)
                
                // Ensure all categories are collected if they differ between lots (unlikely but safe)
                catIds.forEach(cid => {
                    if (!group.categoryIds.includes(cid)) group.categoryIds.push(cid)
                })

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
                             item.products.category_id ?? null,
                             item.products.product_category_rel
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
                     lot.products.category_id ?? null,
                     lot.products.product_category_rel
                 )
             }
        })

        return Array.from(groups.values()).sort((a, b) => a.productSku.localeCompare(b.productSku))

    }, [lots, searchTerm, targetUnitId, unitNameMap, conversionMap, units, convertUnit, selectedZoneId, posToZoneMap, zoneHierarchy, categoryMap, selectedCategoryIds])

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
        systemType,
        categoryMap
    }
}
