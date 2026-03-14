import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { normalizeSearchString } from '@/lib/searchUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'

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

export function useInventoryByLot(
    units: any[],
    externalFilters?: {
        searchTerm?: string
        searchMode?: 'all' | 'name' | 'code' | 'tag' | 'position' | 'category'
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
    const searchMode = externalFilters?.searchMode || 'all'
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
            // 0. Helper for paginated fetch on any table
            const fetchAll = async (tableName: string, selectStr: string = '*', filterFn?: (q: any) => any) => {
                let results: any[] = []
                let from = 0
                const PAGE_SIZE = 1000
                while (true) {
                    let query = supabase
                        .from(tableName as any)
                        .select(selectStr)
                        .range(from, from + PAGE_SIZE - 1)
                    
                    if (filterFn) {
                        query = filterFn(query)
                    }

                    const { data, error } = await query
                    if (error) throw error
                    if (!data || data.length === 0) break
                    results = [...results, ...data]
                    if (data.length < PAGE_SIZE) break
                    from += PAGE_SIZE
                }
                return results
            }

            // 2. Fetch all components separately
            const sysCode = (systemType || 'FROZEN').trim().toUpperCase()
            console.log('Fetching inventory data for system:', sysCode)

            // Define individual fetch promises to handle errors independently if needed
            const fetchLotsData = fetchAll('lots', '*', (q: any) => q.eq('system_code', sysCode))
            const fetchItemsData = fetchAll('lot_items', '*')
            const fetchProductsData = fetchAll('products', '*', (q: any) => q.or(`system_code.eq.${sysCode},system_type.eq.${sysCode}`))
            const fetchSuppliersData = fetchAll('suppliers', 'id, name')
            const fetchTagsData = fetchAll('lot_tags', 'tag, lot_id, lot_item_id')
            const fetchPositionsData = fetchAll('positions', 'id, code, lot_id', (q: any) => q.eq('system_type', sysCode))
            const fetchZonePosData = fetchAll('zone_positions', 'position_id, zone_id')
            const fetchCatRelData = fetchAll('product_category_rel', 'product_id, category_id')

            const [
                allLots, 
                allLotItems, 
                allProducts, 
                allSuppliers, 
                allTags, 
                allLotPositions,
                allZonePositions,
                allCatRels,
                allZonesData,
                allCategories
            ] = await Promise.all([
                fetchLotsData,
                fetchItemsData,
                fetchProductsData,
                fetchSuppliersData,
                fetchTagsData,
                fetchPositionsData,
                fetchZonePosData,
                fetchCatRelData,
                fetchAll('zones', '*', (q: any) => q.eq('system_type', sysCode)),
                fetchAll('categories', 'id, name')
            ])

            console.log(`Fetched component data: Lots: ${allLots.length}, Items: ${allLotItems.length}, Products: ${allProducts.length}, Categories: ${allCategories.length}`)

            // 3. Build Maps for Efficiency
            const cMap: Record<string, string> = {}
            allCategories.forEach((c: any) => cMap[c.id] = c.name)
            setCategoryMap(cMap)

            const productMap = new Map()
            const prodToCatRelMap = new Map()
            allCatRels.forEach((rel: any) => {
                if (!prodToCatRelMap.has(rel.product_id)) prodToCatRelMap.set(rel.product_id, [])
                prodToCatRelMap.get(rel.product_id).push({ category_id: rel.category_id })
            })

            allProducts.forEach((p: any) => {
                productMap.set(p.id, {
                    ...p,
                    product_code: p.id,
                    product_category_rel: prodToCatRelMap.get(p.id) || []
                })
            })
            
            const supplierMap = new Map()
            allSuppliers.forEach((s: any) => supplierMap.set(s.id, s))

            const lotItemsMap = new Map()
            allLotItems.forEach((item: any) => {
                if (!lotItemsMap.has(item.lot_id)) lotItemsMap.set(item.lot_id, [])
                const prod = productMap.get(item.product_id)
                lotItemsMap.get(item.lot_id).push({
                    ...item,
                    products: prod || null
                })
            })

            const lotTagsMap = new Map()
            allTags.forEach((t: any) => {
                if (!lotTagsMap.has(t.lot_id)) lotTagsMap.set(t.lot_id, [])
                lotTagsMap.get(t.lot_id).push(t)
            })

            const lotPositionsMap = new Map()
            allLotPositions.forEach((p: any) => {
                if (p.lot_id) {
                    if (!lotPositionsMap.has(p.lot_id)) lotPositionsMap.set(p.lot_id, [])
                    lotPositionsMap.get(p.lot_id).push(p)
                }
            })

            const pToZMap: Record<string, string> = {}
            allZonePositions.forEach((zp: any) => {
                pToZMap[zp.position_id] = zp.zone_id
            })
            setPosToZoneMap(pToZMap)

            // Re-apply grouping logic with ALL fresh data
            const allPositionsWithZones = allLotPositions.map((p: any) => ({
                ...p,
                zone_id: pToZMap[p.id] || null
            }))
            
            const { zones: groupedZones, positions: _ } = groupWarehouseData(allZonesData, allPositionsWithZones)
            setAllZones(groupedZones)
            
            const hierarchy: Record<string, string | null> = {}
            allZonesData.forEach((z: any) => {
                hierarchy[z.id] = z.parent_id
            })
            setZoneHierarchy(hierarchy)

            // 4. Assemble and Filter
            const assembled = allLots
                .filter((lot: any) => lot.status === 'active')
                .map((lot: any) => {
                    const prod = productMap.get(lot.product_id)
                    return {
                        ...lot,
                        products: prod || null,
                        suppliers: supplierMap.get(lot.supplier_id) || null,
                        lot_items: lotItemsMap.get(lot.id) || [],
                        lot_tags: lotTagsMap.get(lot.id) || [],
                        positions: lotPositionsMap.get(lot.id) || []
                    }
                })

            const filtered = assembled.filter((lot: any) => {
                // System Filter (Secondary safety)
                if (sysCode && lot.system_code && lot.system_code.toUpperCase() !== sysCode) return false
                
                // Branch Filter
                if (selectedBranch && selectedBranch !== "Tất cả") {
                    const lotWarehouse = (lot.warehouse_name || '').trim()
                    const targetBranch = selectedBranch.trim()
                    if (lotWarehouse !== targetBranch) return false
                }
                return true
            })
            setLots(filtered as any)
        } catch (err: any) {
            console.error('Error in fetchLots loop:', err)
            // supbase error fix: if err is object, log its properties
            let errMsg = 'Lỗi khi tải dữ liệu.'
            if (err && typeof err === 'object') {
                errMsg = err.message || err.details || JSON.stringify(err)
            }
            // Show alert to user for better visibility
            alert('Lỗi tải dữ liệu tồn kho: ' + errMsg)
        } finally {
            setLoading(false)
        }
    }

    const groupedInventory = useMemo(() => {
        const searchVal = searchTerm || ''
        
        const internalMatchSearch = (val: string | null | undefined, query: string) => {
            if (!query) return true
            if (!val) return false
            const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
            const nVal = normalize(val)
            
            const orParts = query.split(/[;,]/).map(p => p.trim()).filter(Boolean)
            return orParts.some(orPart => {
                const andParts = orPart.split('&').map(p => p.trim()).filter(Boolean)
                return andParts.every(andPart => {
                    return nVal.includes(normalize(andPart))
                })
            })
        }

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
            if (!searchVal) return true

            const getProductCategoryNames = (p: any) => {
                if (!p) return []
                const names: string[] = []
                if (p.category_id && categoryMap[p.category_id]) names.push(categoryMap[p.category_id])
                if (p.product_category_rel) {
                    p.product_category_rel.forEach((rel: any) => {
                        if (rel.category_id && categoryMap[rel.category_id]) names.push(categoryMap[rel.category_id])
                    })
                }
                return names
            }

            const matchInLot = 
               ((searchMode === 'all' || searchMode === 'code') && internalMatchSearch(lot.code, searchVal)) || 
               ((searchMode === 'all' || searchMode === 'name') && (lot.products && internalMatchSearch(lot.products.name, searchVal))) ||
               ((searchMode === 'all' || searchMode === 'code') && (lot.products && internalMatchSearch(lot.products.sku, searchVal))) ||
               ((searchMode === 'all') && (lot.suppliers?.name && internalMatchSearch(lot.suppliers.name, searchVal))) ||
               ((searchMode === 'all' || searchMode === 'tag') && (lot.lot_tags?.some(t => internalMatchSearch(t.tag, searchVal)))) ||
               ((searchMode === 'all' || searchMode === 'category') && getProductCategoryNames(lot.products).some(name => internalMatchSearch(name, searchVal))) ||
               ((searchMode === 'all' || searchMode === 'position') && lot.positions?.some(p => internalMatchSearch(p.code, searchVal)))

            const matchInItems = lot.lot_items?.some(item => {
                const p = item.products
                if (!p) return false
                return (
                    ((searchMode === 'all' || searchMode === 'name') && internalMatchSearch(p.name, searchVal)) ||
                    ((searchMode === 'all' || searchMode === 'code') && internalMatchSearch(p.sku, searchVal)) ||
                    ((searchMode === 'all' || searchMode === 'category') && getProductCategoryNames(p).some(name => internalMatchSearch(name, searchVal)))
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
                if (searchVal) {
                    const matchesFields = (searchMode === 'all' || searchMode === 'name') && internalMatchSearch(name, searchVal)
                    const matchesCode = (searchMode === 'all' || searchMode === 'code') && (internalMatchSearch(sku, searchVal) || internalMatchSearch(lot.code, searchVal))
                    
                    const itemCatNames: string[] = []
                    if (categoryId && categoryMap[categoryId]) itemCatNames.push(categoryMap[categoryId])
                    productCategoryRel?.forEach(rel => {
                        if (rel.category_id && categoryMap[rel.category_id]) {
                            itemCatNames.push(categoryMap[rel.category_id])
                        }
                    })
                    const matchesCat = (searchMode === 'all' || searchMode === 'category') && itemCatNames.some(cn => internalMatchSearch(cn, searchVal))
                    
                    const itemTags = lot.lot_tags?.filter((t: any) => t.lot_item_id === itemId || !t.lot_item_id).map((t: any) => t.tag) || []
                    const matchesTags = (searchMode === 'all' || searchMode === 'tag') && itemTags.some(t => internalMatchSearch(t, searchVal))
                    
                    const matchesPos = (searchMode === 'all' || searchMode === 'position') && lot.positions?.some((p: any) => internalMatchSearch(p.code, searchVal))

                    if (!matchesFields && !matchesCode && !matchesCat && !matchesTags && !matchesPos) {
                        return // Skip this variant/item if it doesn't match search
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

    }, [lots, searchTerm, searchMode, targetUnitId, unitNameMap, conversionMap, units, convertUnit, selectedZoneId, posToZoneMap, zoneHierarchy, categoryMap, selectedCategoryIds])

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
        searchMode,
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
