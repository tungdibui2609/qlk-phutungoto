import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { normalizeSearchString, advancedMatchSearch } from '@/lib/searchUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { 
    normalizeUnit, 
    isKg, 
    extractWeightFromName,
    MAIN_PACKAGE_UNITS 
} from '@/lib/unitConversion'

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
    
    // Sync with external filters if provided
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
    const [branches, setBranches] = useState<{ id: string, name: string, is_default?: boolean }[]>([])
    const [allZones, setAllZones] = useState<any[]>([])
    const [rawZones, setRawZones] = useState<any[]>([])
    const [rawPositions, setRawPositions] = useState<any[]>([])
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

        // Real-time Subscription: Listen for changes in positions
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
            setBranches(data as any)
            const branchList = data as any[]
            const defaultBranch = branchList.find(b => b.is_default)
            if (defaultBranch) {
                setSelectedBranch(defaultBranch.name)
            }
        }
    }

    async function fetchLots(showLoading = true) {
        if (showLoading) setLoading(true)

        try {
            const fetchAll = async (tableName: string, selectStr: string = '*', filterFn?: (q: any) => any) => {
                let results: any[] = []
                let from = 0
                const PAGE_SIZE = 1000
                while (true) {
                    let query = supabase
                        .from(tableName as any)
                        .select(selectStr)
                        .order('id', { ascending: true })
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

            let sysCode = (systemType || 'FROZEN').trim().toUpperCase()
            if (sysCode === 'FROZEN') sysCode = 'KHO_DONG_LANH'
            else if (sysCode === 'DRY') sysCode = 'KHO_VAT_TU_BAO_BI'

            //@ts-ignore
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
                fetchAll('lots', '*', (q: any) => q.eq('system_code', sysCode)),
                fetchAll('lot_items', '*'),
                fetchAll('products', '*', (q: any) => q.or(`system_code.eq.${sysCode},system_type.eq.${sysCode}`)),
                fetchAll('suppliers', 'id, name'),
                fetchAll('lot_tags', 'tag, lot_id, lot_item_id'),
                fetchAll('positions', 'id, code, lot_id', (q: any) => q.eq('system_type', sysCode)),
                fetchAll('zone_positions', 'position_id, zone_id'),
                fetchAll('product_category_rel', 'product_id, category_id'),
                fetchAll('zones', '*', (q: any) => q.eq('system_type', sysCode)),
                fetchAll('categories', 'id, name')
            ])

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

            const allPositionsWithZones = allLotPositions.map((p: any) => ({
                ...p,
                zone_id: pToZMap[p.id] || null
            }))
            
            const { zones: groupedZones } = groupWarehouseData(allZonesData, allPositionsWithZones)
            setAllZones(groupedZones)
            setRawZones(allZonesData)
            setRawPositions(allPositionsWithZones)
            
            const hierarchy: Record<string, string | null> = {}
            allZonesData.forEach((z: any) => {
                hierarchy[z.id] = z.parent_id
            })
            setZoneHierarchy(hierarchy)

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
                if (sysCode && lot.system_code && lot.system_code.toUpperCase() !== sysCode) return false
                if (selectedBranch && selectedBranch !== "Tất cả") {
                    const lotWarehouse = (lot.warehouse_name || '').trim()
                    const targetBranch = selectedBranch.trim()
                    if (lotWarehouse !== targetBranch) return false
                }
                return true
            })
            setLots(filtered as any)
        } catch (err: any) {
            console.error('Error in fetchLots:', err)
            alert('Lỗi tải dữ liệu tồn kho: ' + (err.message || 'Unknown error'))
        } finally {
            setLoading(false)
        }
    }

    const groupedInventory = useMemo(() => {
        const searchVal = searchTerm || ''
        
        const getCatNames = (p: any) => {
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

        const getCatIds = (p: any) => {
            if (!p) return []
            const ids: string[] = []
            if (p.category_id) ids.push(p.category_id)
            if (p.product_category_rel) {
                p.product_category_rel.forEach((rel: any) => {
                    if (rel.category_id) ids.push(rel.category_id)
                })
            }
            return ids
        }

        const getSearchable = (p: any, l: any, mode: string) => {
            const res: string[] = []
            if (mode === 'all' || mode === 'code') {
                if (l.code) res.push(l.code)
                if (p?.sku) res.push(p.sku)
                if (p?.internal_code) res.push(p.internal_code)
            }
            if (mode === 'all' || mode === 'name') {
                if (p?.name) res.push(p.name)
                if (p?.internal_name) res.push(p.internal_name)
            }
            if (mode === 'all' || mode === 'tag') {
                l.lot_tags?.forEach((t: any) => res.push(t.tag))
            }
            if (mode === 'all' || mode === 'position') {
                l.positions?.forEach((pos: any) => res.push(pos.code))
            }
            if (mode === 'all' || mode === 'category') {
                getCatNames(p).forEach(cn => res.push(cn))
            }
            if (mode === 'all') {
                if (l.suppliers?.name) res.push(l.suppliers.name)
                if (l.notes) res.push(l.notes)
                if (l.warehouse_name) res.push(l.warehouse_name)
            }
            return res
        }

        const { virtualToRealMap } = groupWarehouseData(rawZones, rawPositions)

        const filteredLots = lots.filter(lot => {
            if (selectedZoneId) {
                const resolveRealIds = (id: string): string[] => {
                    const mapped = virtualToRealMap?.get(id)
                    return mapped ? mapped : [id]
                }

                const baseRealIds = resolveRealIds(selectedZoneId)
                const allAllowedRealIds = new Set<string>()
                
                baseRealIds.forEach(rid => {
                    allAllowedRealIds.add(rid)
                    const descendants = (parentId: string) => {
                        const children = rawZones.filter((z: any) => z.parent_id === parentId)
                        children.forEach((c: any) => {
                            allAllowedRealIds.add(c.id)
                            descendants(c.id)
                        })
                    }
                    descendants(rid)
                })

                const matchesZone = lot.positions?.some((p: any) => {
                    const zId = posToZoneMap[p.id]
                    return zId && allAllowedRealIds.has(zId)
                })
                if (!matchesZone) return false
            }
            if (selectedCategoryIds.length > 0) {
                const lotCatIds = getCatIds(lot.products)
                const matchesCategory = lotCatIds.some(id => selectedCategoryIds.includes(id))
                const matchesItemCategory = lot.lot_items?.some(item => getCatIds(item.products).some(id => selectedCategoryIds.includes(id)))
                if (!matchesCategory && !matchesItemCategory) return false
            }
            if (!searchVal) return true
            const matchInLot = advancedMatchSearch(getSearchable(lot.products, lot, searchMode), searchVal)
            const matchInItems = lot.lot_items?.some(item => advancedMatchSearch(getSearchable(item.products, lot, searchMode), searchVal))
            return matchInLot || matchInItems
        })

        const groups = new Map<string, GroupedProduct>()

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
                if (searchVal) {
                    const itemSearchVals = getSearchable(productCategoryRel ? { name, sku, category_id: categoryId, product_category_rel: productCategoryRel } : { name, sku, category_id: categoryId }, lot, searchMode)
                    if (!advancedMatchSearch(itemSearchVals, searchVal)) return
                }

                let displayQty = qty
                let displayUnit = unit
                let key = `${sku}__${unit}`
                let isUnconvertible = false

                const targetUnit = targetUnitId ? units.find(u => u.id === targetUnitId) : null
                const isTargetKg = targetUnit && isKg(targetUnit.name)
                const hasWeightSuffix = extractWeightFromName(unit) !== null

                const isConvertible = targetUnitId && productId && baseUnit && (
                    baseUnit.toLowerCase() === targetUnit?.name?.toLowerCase() ||
                    conversionMap.get(productId)?.has(targetUnitId) ||
                    (isTargetKg && hasWeightSuffix)
                )

                if (targetUnitId && isConvertible) {
                    const rate = conversionMap.get(productId)?.get(targetUnitId)
                    const suffix = (rate && rate > 1 && !targetUnit!.name.includes('(')) ? ` (${rate}kg)` : ''
                    displayUnit = targetUnit!.name + suffix
                    displayQty = convertUnit(productId, unit, targetUnit!.name, qty, baseUnit)
                    key = `${sku}__${targetUnitId}`
                } else if (targetUnitId) {
                    key = `${sku}__${unit}__UNCONVERTIBLE`
                    isUnconvertible = true
                }
                
                if (!displayUnit.includes('(')) {
                    const normU = normalizeUnit(displayUnit)
                    const productRates = productId ? conversionMap.get(productId) : null
                    let rate = undefined

                    if (productRates) {
                        // Find a unit ID that matches the display name AND has a rule for this product
                        const matchingUnit = units.find(u => {
                            const n = normalizeUnit(u.name)
                            return (n === normU || n.replace(/\s*\([^)]*\)/, '').trim() === normU) && productRates.has(u.id)
                        })
                        if (matchingUnit) {
                            rate = productRates.get(matchingUnit.id)
                        }
                    }

                    if (rate && rate > 1) {
                        displayUnit = displayUnit + ` (${rate}kg)`
                    }
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

    }, [lots, searchTerm, searchMode, targetUnitId, unitNameMap, conversionMap, units, convertUnit, selectedZoneId, posToZoneMap, zoneHierarchy, categoryMap, selectedCategoryIds, rawZones, rawPositions])

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
