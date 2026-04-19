'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Printer, Download, FileSpreadsheet, Scissors } from 'lucide-react'
import { toJpeg } from 'html-to-image'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'
import { EditableText } from '@/components/print/PrintHelpers'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { exportInventoryReportToExcel } from '@/lib/inventoryReportExcelExport'
import { advancedMatchSearch } from '@/lib/searchUtils'
import { canonicalizeUnit } from '@/lib/unitConversion'

// Types
interface InventoryItem {
    id: string
    productCode: string
    productName: string
    internalCode?: string | null
    internalName?: string | null
    unit: string
    opening: number
    qtyIn: number
    qtyOut: number
    balance: number
    productGroup?: string
    isUnconvertible?: boolean
    categoryIds?: string[]
    categoryName?: string | null
}

interface LotItem {
    id: string
    lotCode: string
    productSku: string
    productName: string
    internalCode?: string | null
    internalName?: string | null
    productUnit: string
    quantity: number
    batchCode: string
    inboundDate: string | null
    positions: { code: string }[] | null
    supplierName: string
    tags: string[]
    kg: number // New field
    kgRate?: number; // New: 1 unit = X kg
    productId: string; // New: Precise product lookup
    categoryIds: string[]; // Added: Category IDs for the product
    baseUnit: string;  // New: Precise base unit
}

interface ReconciliationItem {
    productId: string
    productCode: string
    productName: string
    internalCode?: string | null
    internalName?: string | null
    unit: string
    accountingBalance: number
    lotBalance: number
    diff: number
}

interface GroupedLot {
    key: string;
    productSku: string;
    productName: string;
    internalCode?: string | null;
    internalName?: string | null;
    productUnit: string;
    totalQuantity: number;
    totalKg: number; // New field
    kgRate?: number; // New
    categoryName?: string; // New field
    variants: Map<string, { totalQuantity: number, totalKg: number, items: LotItem[] }>; 
    items: LotItem[];
}

export default function PrintInventoryPage() {
    const searchParams = useSearchParams()
    const type = searchParams.get('type') || 'accounting'
    const systemType = searchParams.get('systemType') || ''
    const dateFrom = searchParams.get('dateFrom') || searchParams.get('from') || ''
    const dateTo = searchParams.get('dateTo') || searchParams.get('to') || new Date().toISOString().split('T')[0]
    const warehouse = searchParams.get('warehouse') || ''
    const searchTerm = searchParams.get('q') || searchParams.get('search') || ''
    const convertToKg = searchParams.get('convertToKg') === 'true'
    const isInternalCodeDisplay = searchParams.get('internalCode') === 'true'
    const isSnapshot = searchParams.get('snapshot') === '1'
    const zoneId = searchParams.get('zoneId') || ''
    const targetUnitId = searchParams.get('targetUnitId') || ''
    const categoryIdsParam = searchParams.get('categoryIds') || ''
    const searchModeParam = searchParams.get('searchMode') || 'all'
    const token = searchParams.get('token')

    // Check for company info in params (from screenshot service)
    const cmpName = searchParams.get('cmp_name')
    const cmpAddress = searchParams.get('cmp_address')
    const cmpPhone = searchParams.get('cmp_phone')
    const cmpEmail = searchParams.get('cmp_email')
    const cmpLogo = searchParams.get('cmp_logo')
    const cmpShort = searchParams.get('cmp_short')

    const initialCompanyInfo = cmpName ? {
        name: cmpName,
        address: cmpAddress,
        phone: cmpPhone,
        email: cmpEmail,
        logo_url: cmpLogo,
        short_name: cmpShort,
    } as CompanyInfo : null

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [allUnits, setAllUnits] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [accountingItems, setAccountingItems] = useState<InventoryItem[]>([])
    const [lotItems, setLotItems] = useState<LotItem[]>([])
    const [groupedLots, setGroupedLots] = useState<GroupedLot[]>([])
    const [reconcileItems, setReconcileItems] = useState<ReconciliationItem[]>([])

    // Unit Conversion Support
    const { convertUnit, getBaseAmount: toBaseAmount, getBaseToKgRate, conversionMap, unitNameMap } = useUnitConversion()

    // Zone states for recursive filtering
    const [posToZoneMap, setPosToZoneMap] = useState<Record<string, string>>({})
    const [zoneHierarchy, setZoneHierarchy] = useState<Record<string, string | null>>({})

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token,
        initialCompanyInfo,
        fallbackToProfile: !initialCompanyInfo // Only fallback if we don't have enough info from params
    })

    // Editable States
    const [editReportTitle, setEditReportTitle] = useState('')
    const [signTitle1, setSignTitle1] = useState('Người Lập Biểu')
    const [signTitle2, setSignTitle2] = useState('Thủ Kho')
    const [signTitle3, setSignTitle3] = useState('Giám Đốc')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    
    // Grouped accounting items for category-based display
    const groupedAccountingItems = React.useMemo(() => {
        if (type !== 'accounting') return []
        const groups: { [key: string]: InventoryItem[] } = {}
        accountingItems.forEach(item => {
            const cat = item.categoryName || 'Chưa phân loại'
            if (!groups[cat]) groups[cat] = []
            groups[cat].push(item)
        })
        return Object.entries(groups).sort((a, b) => {
            if (a[0] === 'Chưa phân loại') return 1
            if (b[0] === 'Chưa phân loại') return -1
            return a[0].localeCompare(b[0])
        })
    }, [accountingItems, type])

    // Page breaks state
    const [pageBreaks, setPageBreaks] = useState<Set<string>>(new Set())
    const togglePageBreak = (key: string) => {
        setPageBreaks(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // Capture and snapshot state
    const [isDownloading, setIsDownloading] = useState(false)
    const { isCapturing, downloadTimer, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `ton-kho-${dateTo || new Date().toISOString().split('T')[0]}`
    })
    const isSnapshotMode = isSnapshot || isCapturing
    const isDownloadingState = isDownloading || isCapturing

    useEffect(() => {
        const reportDate = dateTo || new Date().toISOString().split('T')[0]
        document.title = `Ton kho - ${reportDate}`
    }, [dateTo])

    useEffect(() => {
        // Hydrate editable fields from params if present
        if (searchParams.get('editReportTitle')) setEditReportTitle(searchParams.get('editReportTitle')!)

        if (searchParams.get('signTitle1')) setSignTitle1(searchParams.get('signTitle1')!)
        if (searchParams.get('signTitle2')) setSignTitle2(searchParams.get('signTitle2')!)
        if (searchParams.get('signTitle3')) setSignTitle3(searchParams.get('signTitle3')!)

        if (searchParams.get('signPerson1')) setSignPerson1(searchParams.get('signPerson1')!)
        if (searchParams.get('signPerson2')) setSignPerson2(searchParams.get('signPerson2')!)
        if (searchParams.get('signPerson3')) setSignPerson3(searchParams.get('signPerson3')!)

    }, [searchParams])

    useEffect(() => {
        fetchData()

        // Set default title based on type
        const reportType = searchParams.get('type') || 'accounting'
        if (reportType === 'accounting') setEditReportTitle('BÁO CÁO TỔNG HỢP NHẬP XUẤT TỒN')
        else if (reportType === 'lot') setEditReportTitle('BÁO CÁO TỒN KHO THEO LOT')
        else if (reportType === 'category') setEditReportTitle('BÁO CÁO TỒN KHO THEO DANH MỤC')
        else if (reportType === 'tags') setEditReportTitle('BÁO CÁO TỒN KHO THEO MÃ PHỤ')
        else if (reportType === 'reconciliation') setEditReportTitle('BẢNG ĐỐI CHIẾU TỒN KHO VS KẾ TOÁN')

    }, [type, systemType, dateFrom, dateTo, warehouse, zoneId, categoryIdsParam, convertToKg, conversionMap, unitNameMap]) // Re-run when conversion data is ready

    async function fetchData() {
        setLoading(true)
        setError(null)
        try {
            // 0. Fetch Shared Data (Units & Categories)
            const [unitRes, catRes, catRelRes] = await Promise.all([
                supabase.from('units').select('*').eq('is_active', true).order('name'),
                supabase.from('categories').select('*').order('name'),
                supabase.from('product_category_rel').select('id, product_id, category_id')
            ])

            const fetchedUnits = unitRes.data || []
            const fetchedCategories = catRes.data || []
            const catRelData = catRelRes.data || []

            setAllUnits(fetchedUnits)
            setCategories(fetchedCategories)

            // Build Product -> Categories Map for Multi-Category Support
            const prodToCatMap = new Map<string, string[]>()
            catRelData.forEach((rel: any) => {
                if (!prodToCatMap.has(rel.product_id)) prodToCatMap.set(rel.product_id, [])
                prodToCatMap.get(rel.product_id)!.push(rel.category_id)
            })

            const preFetchedDataStr = searchParams.get('data')
            if (preFetchedDataStr) {
                try {
                    const data = JSON.parse(preFetchedDataStr)
                    if (data.ok) {
                        if (data.items) setAccountingItems(data.items)
                        if (data.lotItems) setLotItems(data.lotItems)
                        if (data.reconcileItems) setReconcileItems(data.reconcileItems)
                        setLoading(false)
                        return 
                    }
                } catch (e) {
                    console.error('Failed to parse pre-fetched data', e)
                }
            }

            if (token) {
                await supabase.auth.setSession({ access_token: token, refresh_token: '' })
            }

            const activeHierarchy: Record<string, string | null> = {}
            const activePosMap: Record<string, string> = {}
            const PAGE_SIZE_FIXED = 1000

            // Common Zone & Position Fetching for Lot/Category/Tags/Reconciliation
            if (type !== 'accounting') {
                // 1. Fetch Zones
                let zonesFrom = 0
                while (true) {
                    const { data, error } = await supabase.from('zones').select('id, parent_id').eq('system_type', systemType).range(zonesFrom, zonesFrom + PAGE_SIZE_FIXED - 1)
                    if (error) throw error
                    if (!data || data.length === 0) break
                    (data as any[]).forEach(z => { activeHierarchy[z.id] = z.parent_id })
                    if (data.length < PAGE_SIZE_FIXED) break
                    zonesFrom += PAGE_SIZE_FIXED
                }
                setZoneHierarchy(activeHierarchy)

                // 2. Fetch Positions
                let zpFrom = 0
                while (true) {
                    const { data, error } = await supabase.from('zone_positions').select('zone_id, position_id').range(zpFrom, zpFrom + PAGE_SIZE_FIXED - 1)
                    if (error) throw error
                    if (!data || data.length === 0) break
                    (data as any[]).forEach(item => {
                        if (item.position_id && item.zone_id) activePosMap[item.position_id] = item.zone_id
                    })
                    if (data.length < PAGE_SIZE_FIXED) break
                    zpFrom += PAGE_SIZE_FIXED
                }
                setPosToZoneMap(activePosMap)
            }

            const isDescendantOrSelf = (targetId: string, searchId: string, hierarchy: Record<string, string | null>): boolean => {
                if (!targetId || !searchId) return false
                if (targetId === searchId) return true
                let current = hierarchy[targetId]
                while (current) {
                    if (current === searchId) return true
                    current = hierarchy[current]
                }
                return false
            }

            if (type === 'accounting') {
                const params = new URLSearchParams()
                if (systemType) params.set('systemType', systemType)
                if (dateFrom) params.set('dateFrom', dateFrom)
                if (dateTo) params.set('dateTo', dateTo)
                if (warehouse) params.set('warehouse', warehouse)
                if (searchTerm) params.set('q', searchTerm)
                if (convertToKg) params.set('convertToKg', 'true')
                if (targetUnitId) params.set('targetUnitId', targetUnitId)
                if (categoryIdsParam) params.set('categoryIds', categoryIdsParam)

                const headers: HeadersInit = {}
                if (token) headers['Authorization'] = `Bearer ${token}`

                const res = await fetch(`/api/inventory?${params.toString()}`, { headers })
                if (!res.ok) {
                    const errText = await res.text().catch(() => '')
                    throw new Error(`Fetch failed: ${res.status} ${errText}`)
                }
                const data = await res.json()
                if (data.ok) setAccountingItems(data.items)
                else throw new Error(data.error || 'Unknown error')
            }
            else if (type === 'lot' || type === 'category' || type === 'tags') {
                let allLots: any[] = []
                let lotsFrom = 0
                while (true) {
                    let query = supabase.from('lots').select(`
                            *,
                            products(name, unit, sku, system_type, internal_code, internal_name, category_id),
                            suppliers(name),
                            productions(code),
                            lot_tags(tag),
                            lot_items(id, quantity, unit, product_id, lot_tags(tag), products(name, sku, unit)),
                            positions!positions_lot_id_fkey(id, code)
                        `)
                        .eq('status', 'active')
                        .order('created_at', { ascending: false })
                        .range(lotsFrom, lotsFrom + PAGE_SIZE_FIXED - 1)

                    const { data: pageData, error: pageError } = await query
                    if (pageError) throw pageError
                    if (!pageData || pageData.length === 0) break
                    allLots = [...allLots, ...pageData]
                    if (pageData.length < PAGE_SIZE_FIXED) break
                    lotsFrom += PAGE_SIZE_FIXED
                }

                if (allLots.length > 0) {
                    let mapped: LotItem[] = allLots.flatMap((lot: any) => {
                        let systemTypeMatch = true
                        if (systemType) {
                            const sysCode = systemType.trim().toUpperCase()
                            const lotSys = (lot.system_code || '').trim().toUpperCase()
                            if (sysCode && lotSys && lotSys !== sysCode) {
                                systemTypeMatch = false
                            }
                        }
                        if (!systemTypeMatch) return []

                        if (warehouse && warehouse !== 'Tất cả') {
                            const lotWarehouse = (lot.warehouse_name || '').trim()
                            const targetBranch = warehouse.trim()
                            if (lotWarehouse !== targetBranch) return []
                        }

                        const lotTags = (lot.lot_tags || []).map((t: any) => t.tag).filter(Boolean) as string[]
                        const sxCode = lot.production_code || lot.batch_code || lot.productions?.code;
                        if (sxCode) {
                            lotTags.push(`LSX: ${sxCode}`)
                        }
                        const lotData = {
                            lotCode: lot.code,
                            batchCode: lot.batch_code || '-',
                            inboundDate: lot.inbound_date || null,
                            positions: lot.positions,
                            supplierName: lot.suppliers?.name || '-',
                            tags: lotTags
                        }

                        if (lot.lot_items && lot.lot_items.length > 0) {
                            return lot.lot_items.map((item: any, idx: number) => {
                                const itemTags = (item.lot_tags || []).map((t: any) => t.tag).filter(Boolean) as string[]
                                return {
                                    ...lotData,
                                    id: item.id || `${lot.id}-item-${idx}`,
                                    productSku: item.products?.sku || 'N/A',
                                    productName: item.products?.name || 'Unknown',
                                    internalCode: item.products?.internal_code || null,
                                    internalName: item.products?.internal_name || null,
                                    productUnit: item.unit || item.products?.unit || '-',
                                    quantity: item.quantity,
                                    kg: 0,
                                    productId: item.product_id || item.products?.product_code || '',
                                    categoryIds: Array.from(new Set([
                                        ...(item.products?.category_id ? [item.products.category_id] : []),
                                        ...(prodToCatMap.get(item.product_id || item.products?.product_code || '') || [])
                                    ])),
                                    baseUnit: item.products?.unit || '',
                                    tags: Array.from(new Set([...itemTags, ...lotTags])) 
                                }
                            })
                        } else if (lot.products) {
                            return [{
                                ...lotData,
                                id: lot.id,
                                productSku: lot.products.sku || 'N/A',
                                productName: lot.products.name,
                                internalCode: lot.products.internal_code || null,
                                internalName: lot.products.internal_name || null,
                                productUnit: lot.products.unit,
                                quantity: lot.quantity,
                                kg: 0,
                                productId: lot.product_id || lot.products.product_code || '',
                                categoryIds: Array.from(new Set([
                                    ...(lot.products.category_id ? [lot.products.category_id] : []),
                                    ...(prodToCatMap.get(lot.product_id || lot.products.product_code || '') || [])
                                ])),
                                baseUnit: lot.products.unit || ''
                            }]
                        }
                        return []
                    })

                    if (zoneId) {
                        mapped = mapped.filter((item: any) => {
                            // Check item's positions against zoneId (recursive)
                            return item.positions?.some((p: any) => {
                                const posZoneId = activePosMap[p.id]
                                if (!posZoneId) return false
                                
                                // Helper to check if current zone is descendant or self of zoneId
                                const isMatch = (current: string | null): boolean => {
                                    if (!current) return false
                                    if (current === zoneId) return true
                                    return isMatch(activeHierarchy[current] || null)
                                }
                                return isMatch(posZoneId)
                            })
                        })
                    }

                    const filtered = mapped.filter((item: any) => {
                        if (!searchTerm) return true

                        const getSearchable = () => {
                            if (searchModeParam === 'name') return [item.productName, item.internalName || '']
                            if (searchModeParam === 'code') return [item.productSku, item.internalCode || '', item.lotCode]
                            if (searchModeParam === 'position') return item.positions?.map((p: any) => p.code) || []
                            if (searchModeParam === 'tag') return item.tags || []
                            if (searchModeParam === 'category') {
                                return item.categoryIds?.map((cid: string) => (fetchedCategories as any[]).find(c => c.id === cid)?.name || '') || []
                            }
                            // searchMode === 'all'
                            return [
                                item.productName, item.internalName || '',
                                item.productSku, item.internalCode || '',
                                item.lotCode,
                                ...(item.positions?.map((p: any) => p.code) || []),
                                ...(item.tags || []),
                                ...(item.categoryIds?.map((cid: string) => (fetchedCategories as any[]).find(c => c.id === cid)?.name || '') || [])
                            ]
                        }

                        return advancedMatchSearch(getSearchable(), searchTerm)
                    })

                    const selectedCategoryIds = categoryIdsParam ? categoryIdsParam.split(',').filter(Boolean) : []
                    let categoryFiltered = filtered
                    if (selectedCategoryIds.length > 0) {
                        categoryFiltered = filtered.filter((item: any) => {
                            return item.categoryIds && item.categoryIds.some((id: string) => selectedCategoryIds.includes(id))
                        })
                    }

                    setLotItems(categoryFiltered)

                    const groupsMap = new Map<string, GroupedLot>()
                    const reportType = type || 'lot'

                    categoryFiltered.forEach(item => {
                        let displayQty = item.quantity
                        let displayUnit = item.productUnit
                        
                        if (item.productId && item.baseUnit) {
                            const baseQty = toBaseAmount(item.productId, item.productUnit, item.quantity, item.baseUnit)
                            const kgRate = getBaseToKgRate(item.productId, item.baseUnit)
                            if (kgRate !== null) {
                                item.kg = baseQty * kgRate
                                const oneBaseQty = toBaseAmount(item.productId, item.productUnit, 1, item.baseUnit)
                                item.kgRate = oneBaseQty * kgRate
                            }
                        }

                        const targetUnit = targetUnitId ? (fetchedUnits as any[]).find((u: any) => u.id === targetUnitId) : null
                        if (targetUnitId && targetUnit && item.productId && item.baseUnit) {
                            displayUnit = (targetUnit as any).name
                            displayQty = convertUnit(item.productId, item.productUnit, (targetUnit as any).name, item.quantity, item.baseUnit)
                        }

                        if (reportType === 'category') {
                            let itemCatIds: (string | null)[] = item.categoryIds && item.categoryIds.length > 0 ? Array.from(new Set(item.categoryIds)) : [null]
                            
                            // If user has specific categories selected, only show those categories in the report
                            if (selectedCategoryIds.length > 0) {
                                itemCatIds = itemCatIds.filter(cid => cid && selectedCategoryIds.includes(cid))
                            }

                            itemCatIds.forEach(catId => {
                                const category = catId ? (fetchedCategories as any[]).find(c => c.id === catId) : null
                                const groupHeader = (category as any)?.name || 'Chưa phân loại'
                                const groupKey = `${groupHeader}__${item.productSku}__${canonicalizeUnit(displayUnit)}`
                                addToGroups(groupKey, groupHeader, displayUnit, displayQty, item, groupsMap)
                            })
                        } else {
                            const groupKey = `${item.productSku}__${canonicalizeUnit(displayUnit)}`
                            addToGroups(groupKey, '', displayUnit, displayQty, item, groupsMap)
                        }
                    })

                    setGroupedLots(Array.from(groupsMap.values()).sort((a: any, b: any) => {
                        if (reportType === 'category') {
                            const catComp = (a.categoryName || '').localeCompare(b.categoryName || '')
                            if (catComp !== 0) return catComp
                        }
                        return a.productSku.localeCompare(b.productSku)
                    }))
                }
            }
            else if (type === 'reconciliation') {
                const params = new URLSearchParams()
                params.set('dateTo', dateTo)
                params.set('systemType', systemType)
                if (warehouse) params.set('warehouse', warehouse)

                const headers: HeadersInit = {}
                if (token) headers['Authorization'] = `Bearer ${token}`

                const accRes = await fetch(`/api/inventory?${params.toString()}`, { headers })
                if (!accRes.ok) throw new Error(`Acc Fetch failed: ${accRes.status}`)
                const accData = await accRes.json()
                const accItems: InventoryItem[] = accData.ok ? accData.items : []

                let allReconcileLots: any[] = []
                let rLotsFrom = 0
                while (true) {
                    const { data: pageData, error: pageError } = await supabase
                        .from('lots')
                        .select(`
                            id, product_id, quantity, warehouse_name,
                            products(name, sku, unit, system_type, internal_code, internal_name),
                            positions!positions_lot_id_fkey(id, code)
                        `)
                        .eq('status', 'active')
                        .range(rLotsFrom, rLotsFrom + PAGE_SIZE_FIXED - 1)

                    if (pageError) throw pageError
                    if (!pageData || pageData.length === 0) break
                    allReconcileLots = [...allReconcileLots, ...pageData]
                    if (pageData.length < PAGE_SIZE_FIXED) break
                    rLotsFrom += PAGE_SIZE_FIXED
                }

                const lots = allReconcileLots.filter((lot: any) => {
                    if (systemType && lot.products?.system_type !== systemType) return false
                    if (zoneId) {
                         return lot.positions?.some((p: any) => isDescendantOrSelf(activePosMap[p.id], zoneId, activeHierarchy))
                    }
                    return true
                })

                const lotMap = new Map<string, number>()
                const productDetails = new Map<string, { code: string, name: string, unit: string, internalCode?: string | null, internalName?: string | null }>()

                lots?.forEach((lot: any) => {
                    if (!lot.product_id) return
                    const current = lotMap.get(lot.product_id) || 0
                    lotMap.set(lot.product_id, current + (lot.quantity || 0))

                    if (lot.products && !productDetails.has(lot.product_id)) {
                        productDetails.set(lot.product_id, {
                            code: lot.products.sku,
                            name: lot.products.name,
                            internalCode: lot.products.internal_code,
                            internalName: lot.products.internal_name,
                            unit: lot.products.unit
                        })
                    }
                })

                const comparisonMap = new Map<string, ReconciliationItem>()
                accItems.forEach(acc => {
                    const lotQty = lotMap.get(acc.id) || 0
                    comparisonMap.set(acc.id, {
                        productId: acc.id,
                        productCode: acc.productCode,
                        productName: acc.productName,
                        internalCode: acc.internalCode,
                        internalName: acc.internalName,
                        unit: acc.unit,
                        accountingBalance: acc.balance,
                        lotBalance: lotQty,
                        diff: acc.balance - lotQty
                    })
                    lotMap.delete(acc.id)
                })

                lotMap.forEach((qty, productId) => {
                    const details = productDetails.get(productId)
                    comparisonMap.set(productId, {
                        productId: productId,
                        productCode: details?.code || 'N/A',
                        productName: details?.name || 'Unknown',
                        internalCode: details?.internalCode || null,
                        internalName: details?.internalName || null,
                        unit: details?.unit || '',
                        accountingBalance: 0,
                        lotBalance: qty,
                        diff: 0 - qty
                    })
                })

                setReconcileItems(Array.from(comparisonMap.values()).sort((a, b) => a.productCode.localeCompare(b.productCode)))
            }
        } catch (e: any) {
            console.error(e)
            setError(e.message || String(e))
        } finally {
            setLoading(false)
        }
    }

    // Helper function for grouping lots
    function addToGroups(groupKey: string, groupHeader: string, displayUnit: string, displayQty: number, item: LotItem, groupsMap: Map<string, GroupedLot>) {
        if (!groupsMap.has(groupKey)) {
            groupsMap.set(groupKey, {
                key: groupKey,
                productSku: item.productSku,
                productName: item.productName,
                internalCode: item.internalCode,
                internalName: item.internalName,
                productUnit: displayUnit,
                categoryName: groupHeader, 
                totalQuantity: 0,
                totalKg: 0,
                kgRate: item.kgRate, 
                variants: new Map<string, { totalQuantity: number, totalKg: number, items: LotItem[] }>(),
                items: []
            })
        }
        const g = groupsMap.get(groupKey)!
        g.totalQuantity += displayQty || 0
        g.totalKg += item.kg || 0
        g.items.push(item)

        // Ensure LSX is included in tags if available (Sync with Web logic)
        let finalTags = [...(item.tags || [])];
        if (item.lotCode) {
            // We need to find the production code for this lot. 
            // Since we're in the groupsMap context, let's assume the item object carries it or we fallback to what's in tags.
            // But wait, the item already has tags assigned in fetchData.
        }
        
        const cleanTags = finalTags.map(t => t.replace(/@/g, '').replace(/>+/g, '; ').trim()).filter(Boolean);
        const compositeTag = cleanTags.length > 0 ? cleanTags.join('; ') : 'Không có mã phụ'
        const currentV = g.variants.get(compositeTag) || { totalQuantity: 0, totalKg: 0, items: [] }
        g.variants.set(compositeTag, {
            totalQuantity: currentV.totalQuantity + (displayQty || 0),
            totalKg: currentV.totalKg + (item.kg || 0),
            items: [...currentV.items, item]
        })
    }

    const handlePrint = () => {
        window.print()
    }

    const handleDownload = () => {
        const reportDate = dateTo || new Date().toISOString().split('T')[0]
        handleCapture(false, `ton-kho-${reportDate}.jpg`)
    }

    const handleExportExcel = async () => {
        let dateTitle = ''
        if (type === 'accounting') {
            dateTitle = `Từ ngày: ${dateFrom ? new Date(dateFrom).toLocaleDateString('vi-VN') : '...'} đến ngày: ${new Date(dateTo).toLocaleDateString('vi-VN')}`
        } else if (type === 'lot') {
            dateTitle = `Ngày báo cáo: ${new Date(dateTo).toLocaleDateString('vi-VN')}`
        } else {
            dateTitle = `Ngày báo cáo: ${new Date().toLocaleDateString('vi-VN')}`
        }

        await exportInventoryReportToExcel({
            type: type as any,
            dateTitle,
            warehouse: warehouse || 'Tất cả',
            items: (type === 'lot' || type === 'category' || type === 'tags') ? groupedLots : (type === 'accounting' ? accountingItems : reconcileItems),
            companyInfo
        })
    }

    // Auto-export if requested via URL
    useEffect(() => {
        const exportType = searchParams.get('export')
        if (!loading && !error && (accountingItems.length > 0 || groupedLots.length > 0 || reconcileItems.length > 0) && exportType === 'excel') {
            const timer = setTimeout(() => {
                handleExportExcel()
                // Remove the export param from URL to prevent infinite loop on refresh
                const newUrl = new URL(window.location.href)
                newUrl.searchParams.delete('export')
                window.history.replaceState({}, '', newUrl.toString())
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [loading, error, accountingItems, groupedLots, reconcileItems])

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2" /> Đang tải dữ liệu...</div>

    if (error) return <div id="print-ready" data-ready="true" className="flex h-screen items-center justify-center text-red-600 font-bold">Lỗi tải dữ liệu: {error}</div>

    return (
        <div id="print-ready" data-ready={!loading ? "true" : undefined} className={`bg-white h-fit min-h-0 mx-auto text-black pt-0 px-6 pb-6 print:p-4 text-[13px] ${isCapturing ? 'shadow-none !w-[1150px]' : 'w-[210mm]'}`}>
            {isCapturing && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    #print-ready {
                        width: 1150px !important;
                        margin: 0 !important;
                        padding: 40px 60px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        box-sizing: border-box !important;
                    }
                `}} />
            )}
            {/* Print page break styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    @page {
                        margin: 10mm 8mm;
                    }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                    tr { page-break-inside: avoid; break-inside: avoid; }
                    .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
                    #print-ready {
                        width: 100% !important;
                        padding: 0 !important;
                    }
                }
                `}} />
            {/* Toolbar */}
            <div className={`fixed top-4 right-4 z-50 print:hidden flex gap-2 ${isSnapshotMode ? 'hidden' : ''}`}>
                <button
                    onClick={handleDownload}
                    disabled={isDownloadingState}
                    className={`flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-lg transition-all ${isDownloadingState ? 'opacity-70 cursor-wait' : ''}`}
                >
                    {isDownloadingState ? (
                        <>
                            <Loader2 size={20} className="animate-spin" />
                            Đang tạo... ({downloadTimer}s)
                        </>
                    ) : (
                        <>
                            <Download size={20} />
                            Tải ảnh phiếu
                        </>
                    )}
                </button>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 shadow-lg"
                >
                    <FileSpreadsheet size={20} /> Xuất Excel
                </button>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg"
                >
                    <Printer size={20} /> In báo cáo
                </button>
            </div>

            {/* Header with Shared Component - Force compact to match original layout, can be 'large' if desired */}
            <div className="mb-6">
                <PrintHeader
                    companyInfo={companyInfo}
                    logoSrc={logoSrc}
                    size="large"
                    rightContent={null}
                />
            </div>

            {/* Report Title (Editable) */}
            <div className="text-center mb-6">
                <div className="flex justify-center">
                    <EditableText
                        value={editReportTitle}
                        onChange={setEditReportTitle}
                        className="text-2xl font-bold uppercase text-center w-full"
                        style={{ fontFamily: "'Times New Roman', Times, serif" }}
                        isSnapshot={isSnapshotMode}
                    />
                </div>

                {/* Date Range info */}
                {type === 'accounting' && (
                    <p className="italic mt-1">
                        Từ ngày {new Date(dateFrom || new Date()).toLocaleDateString('vi-VN')} đến ngày {new Date(dateTo).toLocaleDateString('vi-VN')}
                    </p>
                )}
                {(type === 'lot' || type === 'category' || type === 'tags' || type === 'reconciliation') && (
                    <p className="italic mt-1">
                        Tính đến ngày {new Date(dateTo).toLocaleDateString('vi-VN')}
                    </p>
                )}
            </div>

            {/* Content Table */}
            <div className="mb-8">
                {warehouse && <p className="font-medium mb-1 text-left">Kho: {warehouse}</p>}
                {type === 'accounting' && (
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-1 w-10">STT</th>
                                <th className="border border-black p-1">Tên Sản Phẩm</th>
                                <th className="border border-black p-1">Mã SP</th>
                                <th className="border border-black p-1 w-16">ĐVT</th>
                                <th className="border border-black p-1 text-right w-20">Tồn Đầu</th>
                                <th className="border border-black p-1 text-right w-20">Nhập</th>
                                <th className="border border-black p-1 text-right w-20">Xuất</th>
                                <th className="border border-black p-1 text-right w-20">Tồn Cuối</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                let sttCounter = 1;
                                return groupedAccountingItems.map(([categoryName, items]) => {
                                    const totals = items.reduce((acc, item) => ({
                                        opening: acc.opening + (item.opening || 0),
                                        qtyIn: acc.qtyIn + (item.qtyIn || 0),
                                        qtyOut: acc.qtyOut + (item.qtyOut || 0),
                                        balance: acc.balance + (item.balance || 0),
                                    }), { opening: 0, qtyIn: 0, qtyOut: 0, balance: 0 });

                                    return (
                                        <React.Fragment key={categoryName}>
                                            <tr className="bg-orange-50/50 font-bold">
                                                <td colSpan={8} className="border border-black p-1 text-orange-800 uppercase italic text-[11px]">
                                                    <div className="flex justify-between items-center w-full px-1">
                                                        <span>DANH MỤC: {categoryName}</span>
                                                        <div className="flex gap-4 text-[10px] font-bold italic">
                                                            <span>Tồn Đầu: {formatQuantityFull(totals.opening)}</span>
                                                            <span>Nhập: {formatQuantityFull(totals.qtyIn)}</span>
                                                            <span>Xuất: {formatQuantityFull(totals.qtyOut)}</span>
                                                            <span>Tồn Cuối: {formatQuantityFull(totals.balance)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                            {items.map((item, idx) => {
                                                const displayCode = isInternalCodeDisplay && item.internalCode ? item.internalCode : item.productCode || 'N/A'
                                                const displayName = isInternalCodeDisplay && item.internalName ? item.internalName : item.productName
                                                const stt = sttCounter++
                                                const breakKey = `acc-${stt}`
                                                const hasBreak = pageBreaks.has(breakKey)

                                                return (
                                                    <React.Fragment key={`${item.id}-${idx}`}>
                                                        {stt > 1 && (
                                                            <tr className={`print:hidden ${hasBreak ? '' : 'h-0'}`}>
                                                                <td colSpan={8} className="p-0 border-0 relative">
                                                                    <button
                                                                        onClick={() => togglePageBreak(breakKey)}
                                                                        className={`w-full flex items-center justify-center gap-1 text-[10px] py-0.5 transition-all group hover:bg-blue-50 ${hasBreak ? 'bg-blue-100 border-y-2 border-dashed border-blue-500' : 'opacity-0 hover:opacity-100'}`}
                                                                    >
                                                                        <Scissors size={10} className={hasBreak ? 'text-blue-600' : 'text-stone-400'} />
                                                                        <span className={hasBreak ? 'text-blue-600 font-bold' : 'text-stone-400'}>{hasBreak ? '✂ Ngắt trang' : 'Ngắt trang'}</span>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {hasBreak && <tr className="hidden print:table-row" style={{ pageBreakBefore: 'always' }}><td colSpan={8} className="p-0 border-0 h-0"></td></tr>}
                                                        <tr className={item.isUnconvertible ? 'bg-orange-100 print:bg-transparent' : ''}>
                                                            <td className="border border-black p-1 text-center">{stt}</td>
                                                            <td className="border border-black p-1">
                                                                {displayName}
                                                                {item.isUnconvertible && <span className="ml-1 text-[10px] italic text-red-600 print:text-black">(*)</span>}
                                                            </td>
                                                            <td className="border border-black p-1">{displayCode}</td>
                                                            <td className="border border-black p-2 text-center text-stone-600 font-bold">{item.unit}</td>
                                                            <td className="border border-black p-1 text-right">{formatQuantityFull(item.opening)}</td>
                                                            <td className="border border-black p-1 text-right">{formatQuantityFull(item.qtyIn)}</td>
                                                            <td className="border border-black p-1 text-right">{formatQuantityFull(item.qtyOut)}</td>
                                                            <td className="border border-black p-1 text-right font-bold">{formatQuantityFull(item.balance)}</td>
                                                        </tr>
                                                    </React.Fragment>
                                                )
                                            })}
                                        </React.Fragment>
                                    )
                                })
                            })()}
                        </tbody>
                    </table>
                )}

                {(type === 'lot' || type === 'category' || type === 'tags') && (
                    <table className="w-full border-collapse border border-black text-[12px]">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-black p-2 w-10 text-center font-bold">STT</th>
                                <th className="border border-black p-2 w-28 font-bold">Mã SP</th>
                                <th className="border border-black p-2 font-bold min-w-[200px]">Tên sản phẩm</th>
                                {type !== 'category' && <th className="border border-black p-2 w-48 font-bold">Mã phụ / Phân loại</th>}
                                <th className="border border-black p-2 w-16 text-center font-bold">ĐVT</th>
                                <th className="border border-black p-2 w-24 text-right font-bold">Số lượng</th>
                                <th className="border border-black p-2 w-24 text-right font-bold">Quy đổi (Kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedLots.length === 0 ? (
                                <tr><td colSpan={7} className="border border-black p-4 text-center text-stone-500">Không có dữ liệu</td></tr>
                            ) : (
                                groupedLots.map((group, gIdx) => {
                                    const reportType = searchParams.get('type') || 'lot'
                                    const prevGroup = gIdx > 0 ? groupedLots[gIdx - 1] : null
                                    const showCategoryHeader = reportType === 'category' && group.categoryName && group.categoryName !== prevGroup?.categoryName

                                    // Calculate category totals if header is shown
                                    let catTotalQty = 0
                                    let catTotalKg = 0
                                    if (showCategoryHeader) {
                                        const catItems = groupedLots.filter(g => g.categoryName === group.categoryName)
                                        catTotalQty = catItems.reduce((sum, item) => sum + (item.totalQuantity || 0), 0)
                                        catTotalKg = catItems.reduce((sum, item) => sum + (item.totalKg || 0), 0)
                                    }

                                    const displayCode = isInternalCodeDisplay && group.internalCode ? group.internalCode : group.productSku || 'N/A'
                                    const displayName = isInternalCodeDisplay && group.internalName ? group.internalName : group.productName

                                    const variantEntries = Array.from(group.variants.entries()).sort((a, b) => {
                                        if (a[0] === 'Không có mã phụ') return 1
                                        if (b[0] === 'Không có mã phụ') return -1
                                        return a[0].localeCompare(b[0])
                                    })

                                    const hasRealVariants = variantEntries.length > 1 || (variantEntries.length === 1 && variantEntries[0][0] !== 'Không có mã phụ')
                                    const totalVariantRows = variantEntries.length

                                    const breakKey = `lot-${gIdx}`
                                    const hasBreak = pageBreaks.has(breakKey)

                                    return (
                                        <React.Fragment key={group.key}>
                                            {/* Category Header Row */}
                                            {showCategoryHeader && (
                                                <tr className="bg-orange-100 font-bold border-t-2 border-black">
                                                    <td className="border border-black p-2 text-orange-800" colSpan={type === 'category' ? 6 : 7}>
                                                        <div className="flex justify-between items-center">
                                                            <span>DANH MỤC: {group.categoryName}</span>
                                                            <div className="flex gap-4 text-[11px] font-normal italic">
                                                                <span>Tổng SL: {formatQuantityFull(catTotalQty)}</span>
                                                                <span>Tổng KG: {formatQuantityFull(catTotalKg)}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                            {/* Page break button */}
                                            {gIdx > 0 && (
                                                <tr className={`print:hidden ${hasBreak ? '' : 'h-0'}`}>
                                                    <td colSpan={7} className="p-0 border-0 relative">
                                                        <button
                                                            onClick={() => togglePageBreak(breakKey)}
                                                            className={`w-full flex items-center justify-center gap-1 text-[10px] py-0.5 transition-all group hover:bg-blue-50 ${hasBreak ? 'bg-blue-100 border-y-2 border-dashed border-blue-500' : 'opacity-0 hover:opacity-100'}`}
                                                        >
                                                            <Scissors size={10} className={hasBreak ? 'text-blue-600' : 'text-stone-400'} />
                                                            <span className={hasBreak ? 'text-blue-600 font-bold' : 'text-stone-400'}>{hasBreak ? '✂ Ngắt trang' : 'Ngắt trang'}</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            )}
                                            {hasBreak && <tr className="hidden print:table-row" style={{ pageBreakBefore: 'always' }}><td colSpan={7} className="p-0 border-0 h-0"></td></tr>}
                                            {/* 1. Main Product Summary Row */}
                                            <tr className="bg-white font-bold h-10">
                                                <td className="border border-black p-2 text-center text-stone-500">{gIdx + 1}</td>
                                                <td className="border border-black p-2">{displayCode}</td>
                                                <td className="border border-black p-2" colSpan={type === 'category' ? 1 : 2}>{displayName}</td>
                                                <td className="border border-black p-2 text-center text-stone-600 font-bold">
                                                    <div>{group.productUnit}</div>
                                                </td>
                                                <td className="border border-black p-2 text-right">{formatQuantityFull(group.totalQuantity)}</td>
                                                <td className="border border-black p-2 text-right text-stone-700 font-bold bg-stone-50/50">{formatQuantityFull(group.totalKg)}</td>
                                            </tr>

                                            {/* 2. Detail Rows (Variants/Lots) with LSX Support */}
                                            {type !== 'category' && hasRealVariants && (() => {
                                                const lsxGroups = new Map<string, { totalQty: number, totalKg: number, items: { tag: string, qty: number, kg: number }[] }>()
                                                const nonLsxItems: { tag: string, qty: number, kg: number }[] = []

                                                variantEntries.forEach(([tagStr, vData]: [string, any]) => {
                                                    const qty = vData.totalQuantity || 0
                                                    const kg = vData.totalKg || 0

                                                    if (tagStr.includes('LSX: ')) {
                                                        const parts = tagStr.split('; ').map((p: string) => p.trim())
                                                        const lsxPart = parts.find((p: string) => p.startsWith('LSX: '))
                                                        if (lsxPart) {
                                                            const otherParts = parts.filter((p: string) => !p.startsWith('LSX: '))
                                                            const subTags = otherParts.length > 0 ? otherParts.join('; ') : 'Không có mã phụ'
                                                            if (!lsxGroups.has(lsxPart)) {
                                                                lsxGroups.set(lsxPart, { totalQty: 0, totalKg: 0, items: [] })
                                                            }
                                                            const vGroup = lsxGroups.get(lsxPart)!
                                                            vGroup.totalQty += qty
                                                            vGroup.totalKg += kg
                                                            vGroup.items.push({ tag: subTags, qty, kg })
                                                            return
                                                        }
                                                    }
                                                    nonLsxItems.push({ tag: tagStr, qty, kg })
                                                })

                                                const rows: React.ReactNode[] = []

                                                // Render LSX Groups
                                                Array.from(lsxGroups.entries()).sort((a, b) => b[1].totalQty - a[1].totalQty).forEach(([lsxName, vGroup], idx) => {
                                                    rows.push(
                                                        <tr key={`lsx-${idx}`} className="bg-orange-50 font-bold border-l-4 border-orange-400 h-9">
                                                            <td className="border border-black p-1 text-center font-mono text-[9px] bg-orange-100/50">{idx + 1}</td>
                                                            <td className="border border-black p-1 pl-4 text-orange-800" colSpan={3}>
                                                                <div className="flex items-center gap-1">
                                                                    <span>◆ {lsxName}</span>
                                                                </div>
                                                            </td>
                                                            <td className="border border-black p-1 text-center italic text-stone-500">{group.productUnit}</td>
                                                            <td className="border border-black p-1 text-right text-orange-700">{formatQuantityFull(vGroup.totalQty)}</td>
                                                            <td className="border border-black p-1 text-right text-orange-700 font-bold">{formatQuantityFull(vGroup.totalKg)}</td>
                                                        </tr>
                                                    )

                                                    vGroup.items.sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty)).forEach((sub, sIdx) => {
                                                        const isNoTag = sub.tag === 'Không có mã phụ'
                                                        rows.push(
                                                            <tr key={`lsx-${idx}-sub-${sIdx}`} className="bg-white border-l-4 border-orange-200 h-8">
                                                                <td className="border border-black p-1"></td>
                                                                <td className="border border-black p-1 pl-10 italic text-stone-500" colSpan={3}>
                                                                    <span>↳ {isNoTag ? '(Gốc / Không mã phụ)' : sub.tag}</span>
                                                                </td>
                                                                <td className="border border-black p-1 text-center text-stone-400">{group.productUnit}</td>
                                                                <td className="border border-black p-1 text-right text-stone-600">{formatQuantityFull(sub.qty)}</td>
                                                                <td className="border border-black p-1 text-right text-stone-600 font-medium">{formatQuantityFull(sub.kg)}</td>
                                                            </tr>
                                                        )
                                                    })
                                                })

                                                // Render Non-LSX Items
                                                nonLsxItems.sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty)).forEach((sub, sIdx) => {
                                                    const isNoTag = sub.tag === 'Không có mã phụ'
                                                    rows.push(
                                                        <tr key={`nonlsx-${sIdx}`} className={isNoTag ? "bg-amber-50 font-semibold border-l-4 border-amber-300 h-8" : "bg-white h-8"}>
                                                            <td className="border border-black p-1"></td>
                                                            <td className="border border-black p-1 pl-4" colSpan={3}>
                                                                <span className={isNoTag ? "italic text-amber-700" : "text-stone-600"}>
                                                                    {isNoTag ? 'Gốc ( còn lại )' : `▪ ${sub.tag}`}
                                                                </span>
                                                            </td>
                                                            <td className="border border-black p-1 text-center text-stone-400">{group.productUnit}</td>
                                                            <td className="border border-black p-1 text-right font-medium text-stone-800">{formatQuantityFull(sub.qty)}</td>
                                                            <td className="border border-black p-1 text-right font-medium text-stone-800">{formatQuantityFull(sub.kg)}</td>
                                                        </tr>
                                                    )
                                                })

                                                return <>{rows}</>
                                            })()}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                )}

                {type === 'reconciliation' && (
                    <table className="w-full border-collapse border border-black text-sm">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-1">Mã SP</th>
                                <th className="border border-black p-1">Tên Sản Phẩm</th>
                                <th className="border border-black p-1 text-center">ĐVT</th>
                                <th className="border border-black p-1 text-right">Tồn Kế Toán</th>
                                <th className="border border-black p-1 text-right">Tổng LOT</th>
                                <th className="border border-black p-1 text-right">Chênh Lệch</th>
                                <th className="border border-black p-1 text-center">Trạng Thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reconcileItems.length === 0 ? (
                                <tr><td colSpan={7} className="border border-black p-4 text-center">Dữ liệu khớp hoàn toàn hoặc không có dữ liệu</td></tr>
                            ) : (
                                reconcileItems.map((item) => {
                                    const displayCode = isInternalCodeDisplay && item.internalCode ? item.internalCode : item.productCode || 'N/A'
                                    const displayName = isInternalCodeDisplay && item.internalName ? item.internalName : item.productName

                                    return (
                                        <tr key={item.productId} className={item.diff !== 0 ? 'bg-orange-50 print:bg-transparent' : ''}>
                                            <td className="border border-black p-1">{displayCode}</td>
                                            <td className="border border-black p-1">{displayName}</td>
                                            <td className="border border-black p-2 text-center text-stone-600 font-bold">{item.unit}</td>
                                            <td className="border border-black p-1 text-right">{formatQuantityFull(item.accountingBalance)}</td>
                                            <td className="border border-black p-1 text-right">{formatQuantityFull(item.lotBalance)}</td>
                                            <td className={`border border-black p-1 text-right font-bold ${item.diff !== 0 ? 'text-red-600 print:text-black' : ''}`}>
                                                {item.diff > 0 ? '+' : ''}{formatQuantityFull(item.diff)}
                                            </td>
                                            <td className="border border-black p-1 text-center">
                                                {item.diff !== 0 ? 'Lệch' : 'Khớp'}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Footer Signatures (Editable) */}
            <div className="flex justify-between mt-8 break-inside-avoid">
                <div className="text-center w-1/3">
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signTitle1} onChange={setSignTitle1} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                    </div>
                    <p className="italic text-xs">(Ký, họ tên)</p>
                    <div className="h-24"></div>
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signPerson1} onChange={setSignPerson1} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshotMode} />
                    </div>
                </div>
                <div className="text-center w-1/3">
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signTitle2} onChange={setSignTitle2} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                    </div>
                    <p className="italic text-xs">(Ký, họ tên)</p>
                    <div className="h-24"></div>
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signPerson2} onChange={setSignPerson2} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshotMode} />
                    </div>
                </div>
                <div className="text-center w-1/3">
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signTitle3} onChange={setSignTitle3} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                    </div>
                    <p className="italic text-xs">(Ký, họ tên, đóng dấu)</p>
                    <div className="h-24"></div>
                    <div className="inline-block min-w-[200px]">
                        <EditableText value={signPerson3} onChange={setSignPerson3} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshotMode} />
                    </div>
                </div>
            </div>
            {/* Snapshot Specific Styles - Fixes height and width issue */}
            {isSnapshot && (
                <style dangerouslySetInnerHTML={{
                    __html: `
                    html, body {
                        background: white !important;
                        height: fit-content !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: hidden !important;
                    }
                    .min-h-screen {
                        min-height: 0 !important;
                        height: auto !important;
                    }
                    body::before {
                        display: none !important;
                    }
                    #print-ready {
                        width: 794px !important;
                        height: fit-content !important;
                        padding: 20px !important;
                        margin: 0 !important;
                        max-width: none !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                        background: white !important;
                    }
                    /* Ensure table fits */
                    #print-ready table {
                        width: 100% !important;
                        font-size: 11px !important;
                    }
                    #print-ready th, #print-ready td {
                        padding: 4px 2px !important;
                    }
                `}} />
            )}

            {/* Dummy QR for screenshot service cropping */}
            <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
                alt="QR"
                className="block w-full h-[1px] opacity-0 pointer-events-none"
            />
        </div>
    )
}
