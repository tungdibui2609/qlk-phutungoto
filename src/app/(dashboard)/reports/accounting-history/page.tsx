'use client'
import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, Download, Calendar, Boxes, Building2, User, FileText, Filter, Layers, ChevronDown, ChevronRight, ChevronUp, DollarSign, ArrowUpRight, ArrowDownLeft, PackageSearch, PackageOpen, TrendingUp, Check, X, Tag, RotateCw, LayoutList, Columns } from 'lucide-react'
import { format, startOfMonth, endOfMonth, isBefore, parseISO } from 'date-fns'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { getMatchingUnitName, isKg, normalizeUnit } from '@/lib/unitConversion'
import { Scale } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { exportAccountingHistoryToExcel } from '@/lib/accountingHistoryExcelExport'
import { ProductSearchInput } from '@/components/shared/ProductSearchInput'
import { matchSearch, calculateSearchScore } from '@/lib/searchUtils'

type OrderType = {
    id: string
    name: string
    code: string
    scope: 'inbound' | 'outbound' | 'both'
}

// Bảng units có nhiều dòng trùng tên giữa các phân hệ nên không thể chỉ so khớp đơn vị gốc bằng ID.
function isSameUnitName(a: string | null | undefined, b: string | null | undefined) {
    const na = getMatchingUnitName(a)
    const nb = getMatchingUnitName(b)
    return (!!na && !!nb && na === nb) || (isKg(na) && isKg(nb))
}

type ProductMovement = {
    productId: string
    sku: string
    name: string
    categoryIds: string[]
    primaryCategoryName?: string
    unit: string
    opening: number
    inboundItems: Record<string, number> // orderTypeId -> quantity
    outboundItems: Record<string, number> // orderTypeId -> quantity
    totalIn: number
    totalOut: number
    closing: number
    vouchers: Set<string>
}

type DailyMovement = {
    date: string
    productId: string
    sku: string
    name: string
    categoryIds: string[]
    primaryCategoryName?: string
    unit: string
    totalIn: number
    totalOut: number
    vouchers: Set<string>
}

export default function AccountingHistoryPage() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [viewMode, setViewMode] = useState<'summary' | 'daily'>('summary')
    const [searchTerm, setSearchTerm] = useState('')
    const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
    const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [orderTypes, setOrderTypes] = useState<OrderType[]>([])
    const [movements, setMovements] = useState<ProductMovement[]>([])
    const [dailyMovements, setDailyMovements] = useState<DailyMovement[]>([])
    const [selectedVouchersProduct, setSelectedVouchersProduct] = useState<any | null>(null)
    const [units, setUnits] = useState<any[]>([])
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
    const [onlyWithMovements, setOnlyWithMovements] = useState(false)
    const [showAllProducts, setShowAllProducts] = useState(false)
    const [tableDisplayMode, setTableDisplayMode] = useState<'compact' | 'full'>('compact')
    const [expandedRowKeys, setExpandedRowKeys] = useState<Set<string>>(new Set())

    const toggleRow = (key: string) => {
        setExpandedRowKeys(prev => {
            const next = new Set(prev)
            if (next.has(key)) {
                next.delete(key)
            } else {
                next.add(key)
            }
            return next
        })
    }

    const toggleExpandAll = () => {
        if (expandedRowKeys.size > 0) {
            setExpandedRowKeys(new Set())
        } else {
            const allKeys = new Set(filteredMovements.map((m, idx) => `${m.productId}_${m.unit}_${idx}`))
            setExpandedRowKeys(allKeys)
        }
    }

    const { showToast } = useToast()
    const { companyInfo } = usePrintCompanyInfo()
    const [exporting, setExporting] = useState(false)

    const { convertUnit, conversionMap, unitNameMap, loading: loadingConversion } = useUnitConversion()

    useEffect(() => {
        setSelectedCategoryIds([])
        setSelectedProductIds([])
        setTargetUnitId(null)
    }, [systemType])

    useEffect(() => {
        fetchData()
    }, [systemType, startDate, endDate, targetUnitId])

    async function fetchAllPaginated(table: string, filter?: (query: any) => any, selectFields = '*', pageSize = 1000) {
        let allData: any[] = []
        let from = 0
        while (true) {
            let query = (supabase.from(table as any) as any).select(selectFields).range(from, from + pageSize - 1)
            if (filter) query = filter(query)
            const { data, error } = await query
            if (error) { console.error(`Error fetching ${table}:`, error); break }
            if (!data || data.length === 0) break
            allData = [...allData, ...data]
            if (data.length < pageSize) break
            from += pageSize
        }
        return allData
    }

    async function fetchData() {
        setLoading(true)
        try {
            // 1. Fetch Products for this system
            const { data: prodData } = await (supabase
                .from('products') as any)
                .select('id, sku, name, unit, aliases, internal_name, internal_code, category_id, product_category_rel(category_id, is_primary, categories(id, name))')
                .eq('system_type', systemType)

            if (!prodData) return
            setProducts(prodData)

            // 1b. Fetch Categories for this system
            const { data: catData } = await (supabase
                .from('categories') as any)
                .select('id, name')
                .eq('system_type', systemType)
                .order('name')

            const catMap = new Map<string, string>()
            ;(catData || []).forEach((c: any) => {
                if (c.id && c.name) catMap.set(c.id, c.name)
            })
            ;(prodData || []).forEach((p: any) => {
                p.product_category_rel?.forEach((r: any) => {
                    const cId = r.category_id || r.categories?.id
                    const cName = r.categories?.name
                    if (cId && cName && !catMap.has(cId)) {
                        catMap.set(cId, cName)
                    }
                })
            })
            const allCats = Array.from(catMap.entries())
                .map(([id, name]) => ({ id, name }))
                .sort((a, b) => a.name.localeCompare(b.name))
            setCategories(allCats)

            const getProductCatInfo = (prod: any) => {
                const catIds = [
                    ...(prod?.product_category_rel?.map((r: any) => r.category_id || r.categories?.id) || []),
                    ...(prod?.category_id ? [prod.category_id] : [])
                ].filter(Boolean) as string[]

                const primaryRel = prod?.product_category_rel?.find((r: any) => r.is_primary === true || r.is_primary === 'true')
                const primaryCategoryName = primaryRel?.categories?.name ||
                    (prod?.category_id ? catMap.get(prod.category_id) : undefined) ||
                    prod?.product_category_rel?.[0]?.categories?.name ||
                    '-'

                return { catIds, primaryCategoryName }
            }

            // 2. Fetch Order Types
            const { data: typeData } = await (supabase.from('order_types') as any)
                .select('*')
                .eq('is_active', true)
                .or(`system_code.eq.${systemType},system_code.is.null`)
            setOrderTypes(typeData || [])

            // 2b. Fetch Units đã được cài đặt cho phân hệ đang làm việc
            const { data: unitData } = await (supabase.from('units') as any)
                .select('id, name')
                .eq('system_code', systemType)
                .eq('is_active', true)
                .order('name')
            setUnits(unitData || [])

            // 3. Fetch Inbound Movements (All history to calculate opening)
            const inboundItems = await fetchAllPaginated('inbound_order_items', q => 
                q.eq('order.system_type', systemType).eq('order.status', 'Completed'),
                `
                    quantity,
                    product_id,
                    unit,
                    order:inbound_orders!inner(code, created_at, order_type_id, status)
                `
            )

            // 4. Fetch Outbound Movements
            const outboundItems = await fetchAllPaginated('outbound_order_items', q => 
                q.eq('order.system_type', systemType).eq('order.status', 'Completed'),
                `
                    quantity,
                    product_id,
                    unit,
                    order:outbound_orders!inner(code, created_at, order_type_id, status)
                `
            )

            // 5. Calculate NXT
            const start = parseISO(startDate)
            const end = parseISO(endDate + 'T23:59:59')

            const movementMap: Record<string, ProductMovement> = {}
            const targetUnit = units.find(u => u.id === targetUnitId)

            // Helper to check if a product can be converted to the target unit
            const isConvertible = (productId: string) => {
                if (!targetUnitId || !targetUnit) return false
                const prod = prodData.find((p: any) => p.id === productId)
                if (!prod || !prod.unit) return false

                const baseUnitId = unitNameMap.get(normalizeUnit(prod.unit))

                // Convertible if target is base unit OR a conversion rate exists
                if (isSameUnitName(prod.unit, targetUnit.name)) return true
                if (baseUnitId === targetUnitId) return true
                const rates = conversionMap.get(productId)
                return !!(rates && rates.has(targetUnitId))
            }

            // Helper to get or create movement entry
            const getMovement = (productId: string, unit: string) => {
                const prod = prodData.find((p: any) => p.id === productId)
                const canConvert = isConvertible(productId)

                const displayUnit = (targetUnit && canConvert) ? targetUnit.name : (unit || '-')
                const key = (targetUnit && canConvert) ? productId : `${productId}_${unit}`

                if (!movementMap[key]) {
                    const { catIds, primaryCategoryName } = getProductCatInfo(prod)

                    movementMap[key] = {
                        productId,
                        sku: prod?.sku || 'N/A',
                        name: prod?.name || 'Unknown',
                        categoryIds: catIds,
                        primaryCategoryName,
                        unit: displayUnit,
                        opening: 0,
                        inboundItems: {},
                        outboundItems: {},
                        totalIn: 0,
                        totalOut: 0,
                        closing: 0,
                        vouchers: new Set()
                    }
                }
                return movementMap[key]
            }

            // Process Inbound
            inboundItems?.forEach((item: any) => {
                if (!item.order) return
                const mov = getMovement(item.product_id, item.unit || '-')
                if (!mov) return

                const prod = prodData.find((p: any) => p.id === item.product_id)
                const canConvert = isConvertible(item.product_id)

                const qty = (targetUnit && canConvert)
                    ? convertUnit(item.product_id, item.unit || null, targetUnit.name, item.quantity, prod?.unit || null)
                    : item.quantity

                const orderDate = parseISO(item.order.created_at)
                if (isBefore(orderDate, start)) {
                    mov.opening += (qty || 0)
                } else if (isBefore(orderDate, end)) {
                    const typeId = item.order.order_type_id || 'untyped'
                    mov.inboundItems[typeId] = (mov.inboundItems[typeId] || 0) + (qty || 0)
                    mov.totalIn += (qty || 0)
                    mov.vouchers.add(item.order.code)
                }
            })

            // Process Outbound
            outboundItems?.forEach((item: any) => {
                if (!item.order) return
                const mov = getMovement(item.product_id, item.unit || '-')
                if (!mov) return

                const prod = prodData.find((p: any) => p.id === item.product_id)
                const canConvert = isConvertible(item.product_id)

                const qty = (targetUnit && canConvert)
                    ? convertUnit(item.product_id, item.unit || null, targetUnit.name, item.quantity, prod?.unit || null)
                    : item.quantity

                const orderDate = parseISO(item.order.created_at)
                if (isBefore(orderDate, start)) {
                    mov.opening -= (qty || 0)
                } else if (isBefore(orderDate, end)) {
                    const typeId = item.order.order_type_id || 'untyped'
                    mov.outboundItems[typeId] = (mov.outboundItems[typeId] || 0) + (qty || 0)
                    mov.totalOut += (qty || 0)
                    mov.vouchers.add(item.order.code)
                }
            })

            // Pre-populate all products into movementMap (even those without any activity)
            prodData.forEach((prod: any) => {
                const canConvert = isConvertible(prod.id)
                const displayUnit = (targetUnit && canConvert) ? targetUnit.name : (prod.unit || '-')
                const key = (targetUnit && canConvert) ? prod.id : `${prod.id}_${displayUnit}`

                if (!movementMap[key]) {
                    const { catIds, primaryCategoryName } = getProductCatInfo(prod)

                    movementMap[key] = {
                        productId: prod.id,
                        sku: prod.sku || 'N/A',
                        name: prod.name || 'Unknown',
                        categoryIds: catIds,
                        primaryCategoryName,
                        unit: displayUnit,
                        opening: 0,
                        inboundItems: {},
                        outboundItems: {},
                        totalIn: 0,
                        totalOut: 0,
                        closing: 0,
                        vouchers: new Set()
                    }
                }
            })

            // Finalize calculation
            Object.values(movementMap).forEach(mov => {
                mov.closing = mov.opening + mov.totalIn - mov.totalOut
            })

            // Process Daily Movements
            const dailyMap: Record<string, DailyMovement> = {}
            
            // Re-process inbound for daily
            inboundItems?.forEach((item: any) => {
                if (!item.order) return
                const orderDate = parseISO(item.order.created_at)
                if (isBefore(orderDate, start) || !isBefore(orderDate, end)) return
                
                const dateKey = format(orderDate, 'yyyy-MM-dd')
                const prod = prodData.find((p: any) => p.id === item.product_id)
                const canConvert = isConvertible(item.product_id)
                const displayUnit = (targetUnit && canConvert) ? targetUnit.name : (item.unit || '-')
                
                const key = `${dateKey}_${item.product_id}_${displayUnit}`
                
                const qty = (targetUnit && canConvert)
                    ? convertUnit(item.product_id, item.unit || null, targetUnit.name, item.quantity, prod?.unit || null)
                    : item.quantity

                if (!dailyMap[key]) {
                    const { catIds, primaryCategoryName } = getProductCatInfo(prod)

                    dailyMap[key] = {
                        date: dateKey,
                        productId: item.product_id,
                        sku: prod?.sku || 'N/A',
                        name: prod?.name || 'Unknown',
                        categoryIds: catIds,
                        primaryCategoryName,
                        unit: displayUnit,
                        totalIn: 0,
                        totalOut: 0,
                        vouchers: new Set()
                    }
                }
                dailyMap[key].totalIn += (qty || 0)
                dailyMap[key].vouchers.add(item.order.code)
            })

            // Re-process outbound for daily
            outboundItems?.forEach((item: any) => {
                if (!item.order) return
                const orderDate = parseISO(item.order.created_at)
                if (isBefore(orderDate, start) || !isBefore(orderDate, end)) return
                
                const dateKey = format(orderDate, 'yyyy-MM-dd')
                const prod = prodData.find((p: any) => p.id === item.product_id)
                const canConvert = isConvertible(item.product_id)
                const displayUnit = (targetUnit && canConvert) ? targetUnit.name : (item.unit || '-')
                
                const key = `${dateKey}_${item.product_id}_${displayUnit}`
                
                const qty = (targetUnit && canConvert)
                    ? convertUnit(item.product_id, item.unit || null, targetUnit.name, item.quantity, prod?.unit || null)
                    : item.quantity

                if (!dailyMap[key]) {
                    const { catIds, primaryCategoryName } = getProductCatInfo(prod)

                    dailyMap[key] = {
                        date: dateKey,
                        productId: item.product_id,
                        sku: prod?.sku || 'N/A',
                        name: prod?.name || 'Unknown',
                        categoryIds: catIds,
                        primaryCategoryName,
                        unit: displayUnit,
                        totalIn: 0,
                        totalOut: 0,
                        vouchers: new Set()
                    }
                }
                dailyMap[key].totalOut += (qty || 0)
                dailyMap[key].vouchers.add(item.order.code)
            })

            // Sort movements by SKU or Name to keep list stable
            const result = Object.values(movementMap).sort((a, b) => a.sku.localeCompare(b.sku))
            setMovements(result)

            const dailyResult = Object.values(dailyMap).sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date)
                if (dateCompare !== 0) return dateCompare
                return a.sku.localeCompare(b.sku)
            })
            setDailyMovements(dailyResult)


        } catch (error) {
            console.error('Error fetching NXT data:', error)
        } finally {
            setLoading(false)
        }
    }

    const productMap = useMemo(() => {
        const map = new Map<string, any>()
        products.forEach(p => map.set(p.id, p))
        return map
    }, [products])

    const filteredMovements = useMemo(() => {
        return movements.filter(m => {
            const prod = productMap.get(m.productId)
            const matchesSearch = !searchTerm.trim() || matchSearch(prod || { name: m.name, sku: m.sku }, searchTerm)
            const matchesCategories = selectedCategoryIds.length === 0 ||
                (m.categoryIds && m.categoryIds.some(cid => selectedCategoryIds.includes(cid)))
            const matchesProducts = selectedProductIds.length === 0 || selectedProductIds.includes(m.productId)
            return matchesSearch && matchesCategories && matchesProducts
        }).filter(m => {
            if (showAllProducts) return true
            if (onlyWithMovements) {
                return m.totalIn !== 0 || m.totalOut !== 0
            }
            return m.opening !== 0 || m.totalIn !== 0 || m.totalOut !== 0
        })
    }, [movements, searchTerm, productMap, selectedCategoryIds, selectedProductIds, showAllProducts, onlyWithMovements])

    const filteredDailyMovements = useMemo(() => {
        return dailyMovements.filter(m => {
            const prod = productMap.get(m.productId)
            const matchesSearch = !searchTerm.trim() || matchSearch(prod || { name: m.name, sku: m.sku }, searchTerm)
            const matchesCategories = selectedCategoryIds.length === 0 ||
                (m.categoryIds && m.categoryIds.some(cid => selectedCategoryIds.includes(cid)))
            const matchesProducts = selectedProductIds.length === 0 || selectedProductIds.includes(m.productId)
            return matchesSearch && matchesCategories && matchesProducts
        }).filter(m => {
            if (onlyWithMovements) {
                return m.totalIn !== 0 || m.totalOut !== 0
            }
            return true
        })
    }, [dailyMovements, searchTerm, productMap, selectedCategoryIds, selectedProductIds, onlyWithMovements])

    // Dynamic columns for Order Types
    const inboundTypes = orderTypes.filter(t => t.scope === 'inbound' || t.scope === 'both')
    const outboundTypes = orderTypes.filter(t => t.scope === 'outbound' || t.scope === 'both')

    // Count products per category
    const categoryProductCounts = useMemo(() => {
        const counts: Record<string, number> = {}
        products.forEach((prod: any) => {
            const catIds = [
                ...(prod.product_category_rel?.map((r: any) => r.category_id || r.categories?.id) || []),
                ...(prod.category_id ? [prod.category_id] : [])
            ].filter(Boolean) as string[]
            catIds.forEach(cid => {
                counts[cid] = (counts[cid] || 0) + 1
            })
        })
        return counts
    }, [products])

    // Products available in ProductMultiSelect (filtered by selected categories if any)
    const availableProducts = useMemo(() => {
        if (selectedCategoryIds.length === 0) return products
        return products.filter(p => {
            const catIds = [
                ...(p.product_category_rel?.map((r: any) => r.category_id || r.categories?.id) || []),
                ...(p.category_id ? [p.category_id] : [])
            ].filter(Boolean) as string[]
            return catIds.some(cid => selectedCategoryIds.includes(cid))
        })
    }, [products, selectedCategoryIds])

    // Summaries
    const summary = useMemo(() => {
        const uniqueProductIds = new Set<string>()
        filteredMovements.forEach(m => {
            if (m.productId) uniqueProductIds.add(m.productId)
        })

        return filteredMovements.reduce((acc, curr) => ({
            products: acc.products + 1,
            opening: acc.opening + curr.opening,
            inbound: acc.inbound + curr.totalIn,
            outbound: acc.outbound + curr.totalOut,
            closing: acc.closing + curr.closing,
            uniqueProducts: uniqueProductIds.size,
            rowCount: filteredMovements.length
        }), { products: 0, opening: 0, inbound: 0, outbound: 0, closing: 0, uniqueProducts: uniqueProductIds.size, rowCount: filteredMovements.length })
    }, [filteredMovements])

    const handleExportExcel = async () => {
        const currentData = viewMode === 'summary' ? filteredMovements : filteredDailyMovements

        if (currentData.length === 0) {
            showToast('Không có dữ liệu để xuất Excel', 'warning')
            return
        }

        setExporting(true)
        try {
            const targetUnit = units.find(u => u.id === targetUnitId)
            await exportAccountingHistoryToExcel({
                viewMode,
                startDate,
                endDate,
                systemType: systemType || '',
                inboundTypes,
                outboundTypes,
                movements: filteredMovements,
                dailyMovements: currentData,
                summary,
                targetUnitName: targetUnit?.name,
                companyInfo
            })
            showToast('Đã xuất file Excel thành công', 'success')
        } catch (error) {
            console.error('Excel export error:', error)
            showToast('Lỗi khi xuất file Excel', 'error')
        } finally {
            setExporting(false)
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-200 dark:border-indigo-800">
                            <Layers size={24} strokeWidth={2.5} />
                        </div>
                        Báo cáo Nhập - Xuất - Tồn (KT)
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 text-sm mt-1 ml-11 italic">
                        Thống kê chi tiết biến động kho theo mục đích nhập xuất.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-stone-100 dark:bg-slate-800 p-1 rounded-xl border border-stone-200 dark:border-slate-700">
                        <button
                            onClick={() => setViewMode('summary')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'summary' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
                        >
                            Tổng hợp kỳ
                        </button>
                        <button
                            onClick={() => setViewMode('daily')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'daily' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'}`}
                        >
                            Nhật ký ngày
                        </button>
                    </div>

                    <button
                        onClick={handleExportExcel}
                        disabled={exporting}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/20 w-fit ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {exporting ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        ) : (
                            <Download size={18} />
                        )}
                        {exporting ? 'Đang xuất...' : 'Xuất Excel'}
                    </button>
                </div>
            </div>

            {/* Dashboard Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Tổng sản phẩm</p>
                        {summary.rowCount > summary.uniqueProducts ? (
                            <span 
                                className="px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold border border-indigo-100 dark:border-indigo-900"
                                title="Tổng số dòng theo từng quy cách hoặc đơn vị tính khác nhau của sản phẩm"
                            >
                                {summary.rowCount} dòng ĐVT
                            </span>
                        ) : (
                            <div className="p-1 px-2 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-500 text-[10px] font-bold">SP</div>
                        )}
                    </div>
                    <div className="flex items-baseline justify-between mt-0.5">
                        <div className="flex items-baseline gap-1.5">
                            <h3 className="text-2xl font-black text-stone-900 dark:text-white tabular-nums">{summary.uniqueProducts}</h3>
                            <span className="text-xs font-bold text-stone-500 dark:text-stone-400">mã SP</span>
                        </div>
                        {summary.rowCount > summary.uniqueProducts && (
                            <span className="text-[10px] text-stone-400 dark:text-stone-500 font-medium">
                                ({summary.rowCount} quy cách)
                            </span>
                        )}
                    </div>
                </div>
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-blue-400 dark:text-blue-500 uppercase tracking-wider mb-1">Tồn đầu kỳ</p>
                    <h3 className="text-2xl font-black text-blue-700 dark:text-blue-400 tabular-nums">{formatQuantityFull(summary.opening)}</h3>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-emerald-400 dark:text-emerald-500 uppercase tracking-wider mb-1">Nhập trong kỳ</p>
                    <div className="flex items-center gap-2">
                        <ArrowDownLeft size={16} className="text-emerald-500" />
                        <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{formatQuantityFull(summary.inbound)}</h3>
                    </div>
                </div>
                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-orange-400 dark:text-orange-500 uppercase tracking-wider mb-1">Xuất trong kỳ</p>
                    <div className="flex items-center gap-2">
                        <ArrowUpRight size={16} className="text-orange-500" />
                        <h3 className="text-2xl font-black text-orange-700 dark:text-orange-400 tabular-nums">{formatQuantityFull(summary.outbound)}</h3>
                    </div>
                </div>
                <div className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/50 shadow-sm">
                    <p className="text-[10px] font-bold text-purple-400 dark:text-purple-500 uppercase tracking-wider mb-1">Tồn cuối kỳ</p>
                    <h3 className="text-2xl font-black text-purple-700 dark:text-purple-400 tabular-nums">{formatQuantityFull(summary.closing)}</h3>
                </div>
            </div>

            {/* Filters Section (Đúng 2 hàng ngang nhỏ gọn, thẩm mỹ) */}
            <div className="bg-white dark:bg-slate-900 p-3 sm:p-3.5 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm sticky top-4 z-40 space-y-2.5">
                {/* Hàng 1: Tìm kiếm sản phẩm + Khoảng thời gian + Nút Làm mới dữ liệu */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 relative z-30">
                    <div className="flex-1 min-w-0">
                        <ProductSearchInput
                            value={searchTerm}
                            onChange={setSearchTerm}
                            products={products}
                            placeholder="Tìm kiếm sản phẩm (hỗ trợ tên đầy đủ, mã SKU, tên gõ tắt ví dụ: dncv, xoai, ri6)..."
                            theme="indigo"
                            className="w-full"
                            inputClassName="py-2 pl-9 pr-9 rounded-xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                            iconSize={16}
                        />
                    </div>

                    {/* Bộ chọn ngày & Nút Làm mới (nằm chung hàng 1 rất gọn gàng) */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 p-1 bg-stone-100/80 dark:bg-slate-800/80 rounded-xl border border-stone-200/60 dark:border-slate-700/60">
                            <div className="relative group w-[125px] sm:w-[135px]">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500" size={13} />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full pl-7 pr-1.5 py-1 bg-transparent text-xs focus:outline-none font-bold text-stone-700 dark:text-stone-200 appearance-none cursor-pointer"
                                />
                            </div>
                            <div className="px-0.5 text-stone-400 font-bold text-[9px] uppercase tracking-wider">đến</div>
                            <div className="relative group w-[125px] sm:w-[135px]">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500" size={13} />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full pl-7 pr-1.5 py-1 bg-transparent text-xs focus:outline-none font-bold text-stone-700 dark:text-stone-200 appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => fetchData()}
                            disabled={loading}
                            className="px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all border border-indigo-200/60 dark:border-indigo-800/40 flex items-center gap-1.5 shadow-xs active:scale-95 shrink-0"
                            title="Tải lại dữ liệu báo cáo"
                        >
                            <RotateCw size={13} className={loading ? "animate-spin" : ""} />
                            <span>Làm mới</span>
                        </button>
                    </div>
                </div>

                {/* Hàng 2: Bộ lọc Danh mục, Sản phẩm, Đơn vị tính, Tất cả SP, Biến động trong kỳ (Dàn đều bằng với Hàng 1) */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100 dark:border-slate-800/60 relative z-20 w-full">
                    <div className="flex-1 min-w-[170px] relative">
                        <CategoryMultiSelect
                            categories={categories}
                            selectedIds={selectedCategoryIds}
                            onChange={setSelectedCategoryIds}
                            productCounts={categoryProductCounts}
                        />
                    </div>

                    <div className="flex-[1.4] min-w-[210px] relative">
                        <ProductMultiSelect
                            products={availableProducts}
                            selectedIds={selectedProductIds}
                            onChange={setSelectedProductIds}
                        />
                    </div>

                    <div className="relative flex items-center group shrink-0">
                        <Scale size={13} className="absolute left-2.5 text-stone-400 pointer-events-none group-focus-within:text-indigo-500 transition-colors" />
                        <select
                            value={targetUnitId || ''}
                            onChange={(e) => setTargetUnitId(e.target.value || null)}
                            className="pl-8 pr-7 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs font-bold text-stone-600 dark:text-stone-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none transition-all cursor-pointer min-w-[125px]"
                        >
                            <option value="">Đơn vị gốc</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <div className="absolute right-2.5 pointer-events-none text-stone-400">
                            <ChevronDown size={13} />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            const next = !showAllProducts
                            setShowAllProducts(next)
                            if (next) setOnlyWithMovements(false)
                        }}
                        title={showAllProducts ? "Đang hiển thị tất cả sản phẩm (bấm để thu gọn chỉ xem sản phẩm có số liệu)" : "Hiển thị toàn bộ danh mục sản phẩm (kể cả không có tồn kho và không phát sinh)"}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 ${
                            showAllProducts 
                                ? 'bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600 shadow-xs' 
                                : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        <Boxes size={13} />
                        <span>Tất cả SP</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            const next = !onlyWithMovements
                            setOnlyWithMovements(next)
                            if (next) setShowAllProducts(false)
                        }}
                        title="Chỉ hiển thị các sản phẩm có phát sinh nhập hoặc xuất trong kỳ này"
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shrink-0 ${
                            onlyWithMovements 
                                ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-xs' 
                                : 'bg-stone-50 dark:bg-slate-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-slate-700 hover:bg-stone-100 dark:hover:bg-slate-700'
                        }`}
                    >
                        <TrendingUp size={13} className={onlyWithMovements ? 'animate-pulse' : ''} />
                        <span>Biến động trong kỳ</span>
                    </button>

                    {/* Filter Badges (nếu có lọc danh mục hoặc sản phẩm) */}
                    {(selectedCategoryIds.length > 0 || selectedProductIds.length > 0) && (
                        <div className="flex items-center gap-1.5 shrink-0">
                            {selectedCategoryIds.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                    <Tag size={12} className="text-indigo-500" />
                                    <span>
                                        {selectedCategoryIds.length === 1
                                            ? `DM: ${categories.find(c => c.id === selectedCategoryIds[0])?.name || selectedCategoryIds[0]}`
                                            : `Lọc ${selectedCategoryIds.length} DM`}
                                    </span>
                                    <button 
                                        onClick={() => setSelectedCategoryIds([])}
                                        className="ml-0.5 p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800/50 rounded transition-colors text-indigo-600 dark:text-indigo-400"
                                        title="Xóa lọc danh mục"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                            {selectedProductIds.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300">
                                    <Filter size={12} className="text-amber-500" />
                                    <span>Lọc {selectedProductIds.length} SP</span>
                                    <button 
                                        onClick={() => setSelectedProductIds([])}
                                        className="ml-0.5 p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800/50 rounded transition-colors text-amber-700 dark:text-amber-300"
                                        title="Xóa lọc sản phẩm"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* NXT Table or Daily Log Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden text-[11px] relative z-0">
                {/* Table Header Toolbar */}
                <div className="px-4 py-3 border-b border-stone-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-stone-50/70 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-stone-800 dark:text-stone-200">
                            {viewMode === 'summary' ? 'Bảng tổng hợp biến động' : 'Nhật ký biến động ngày'}
                        </span>
                        <span className="text-[11px] text-stone-400">
                            ({viewMode === 'summary' ? filteredMovements.length : filteredDailyMovements.length} dòng dữ liệu)
                        </span>
                    </div>

                    {viewMode === 'summary' && (
                        <div className="flex items-center gap-2">
                            {tableDisplayMode === 'compact' && filteredMovements.length > 0 && (
                                <button
                                    type="button"
                                    onClick={toggleExpandAll}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:text-stone-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 rounded-lg shadow-2xs hover:bg-stone-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                                    title={expandedRowKeys.size > 0 ? "Thu gọn toàn bộ chi tiết" : "Bung mở xem chi tiết phân bổ cho tất cả dòng"}
                                >
                                    {expandedRowKeys.size > 0 ? (
                                        <>
                                            <ChevronUp size={13} />
                                            <span>Thu gọn ({expandedRowKeys.size})</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown size={13} />
                                            <span>Mở rộng tất cả chi tiết</span>
                                        </>
                                    )}
                                </button>
                            )}

                            <div className="flex items-center bg-stone-200/70 dark:bg-slate-700/70 p-0.5 rounded-lg text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setTableDisplayMode('compact')}
                                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-[11px] cursor-pointer ${
                                        tableDisplayMode === 'compact'
                                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                                    }`}
                                    title="Chế độ tinh gọn: Vừa vặn màn hình, không cần cuộn ngang, bấm dòng để xem chi tiết phân bổ"
                                >
                                    <LayoutList size={13} />
                                    <span>Bảng tinh gọn</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTableDisplayMode('full')}
                                    className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-[11px] cursor-pointer ${
                                        tableDisplayMode === 'full'
                                            ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                                            : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                                    }`}
                                    title="Chế độ chi tiết: Hiển thị đầy đủ tất cả các cột phân loại phiếu (cuộn ngang)"
                                >
                                    <Columns size={13} />
                                    <span>Đầy đủ cột ({inboundTypes.length + outboundTypes.length} loại)</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="p-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                            <p className="mt-4 text-stone-500 font-medium">Đang hạch toán dữ liệu...</p>
                        </div>
                    ) : viewMode === 'daily' ? (
                        // Daily Log Table
                        <table className="w-full border-collapse border-spacing-0">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50">
                                    <th className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider w-28">Ngày</th>
                                    <th className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider w-24">Mã SP</th>
                                    <th className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider min-w-[200px]">Tên Sản Phẩm</th>
                                    <th className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider w-36">Danh mục chính</th>
                                    <th className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-stone-400 tracking-wider w-16">ĐVT</th>
                                    <th className="px-4 py-4 border-r border-b border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/5 text-center font-black uppercase text-emerald-600 tracking-wider">Nhập kho</th>
                                    <th className="px-4 py-4 border-r border-b border-orange-100 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-900/5 text-center font-black uppercase text-orange-600 tracking-wider">Xuất kho</th>
                                    <th className="px-4 py-4 border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-stone-400 tracking-wider w-16">Phiếu</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredDailyMovements.map((mov, idx) => (
                                    <tr key={`${mov.date}-${mov.productId}-${idx}`} className={`group transition-colors border-b border-stone-200/60 dark:border-slate-800 ${idx % 2 === 1 ? 'bg-stone-100/50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'} hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20`}>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 font-bold text-stone-600 dark:text-stone-400">
                                            {format(parseISO(mov.date), 'dd/MM/yyyy')}
                                        </td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 font-mono font-bold text-stone-400">{mov.sku}</td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800">
                                            <div className="font-bold text-stone-800 dark:text-stone-200">{mov.name}</div>
                                        </td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 text-stone-600 dark:text-stone-400 font-medium">
                                            {mov.primaryCategoryName || '-'}
                                        </td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 text-center text-stone-400 italic">{mov.unit}</td>
                                        <td className="px-4 py-3 border-r border-emerald-100 dark:border-emerald-900 text-center font-black text-emerald-600 tabular-nums bg-emerald-50/20 dark:bg-emerald-900/5">
                                            {mov.totalIn ? formatQuantityFull(mov.totalIn) : '-'}
                                        </td>
                                        <td className="px-4 py-3 border-r border-orange-100 dark:border-orange-900 text-center font-black text-orange-600 tabular-nums bg-orange-50/20 dark:bg-orange-900/5">
                                            {mov.totalOut ? formatQuantityFull(mov.totalOut) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setSelectedVouchersProduct({ id: mov.productId, name: mov.name, sku: mov.sku, unit: mov.unit, date: mov.date })}
                                                className="p-1 px-2 rounded bg-stone-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-stone-500 hover:text-indigo-600 transition-colors font-bold"
                                            >
                                                {mov.vouchers.size}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : filteredMovements.length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="p-4 bg-stone-50 dark:bg-slate-800 rounded-full mb-4">
                                <PackageOpen size={48} className="text-stone-300 dark:text-stone-600" />
                            </div>
                            <h3 className="text-lg font-bold text-stone-700 dark:text-stone-300">Không có dữ liệu phù hợp</h3>
                            <p className="text-sm text-stone-500 max-w-sm mt-1">Không tìm thấy phát sinh nào trong khoảng thời gian và bộ lọc đã chọn.</p>
                        </div>
                    ) : tableDisplayMode === 'compact' ? (
                        // Compact Summary Table (Clean 8 columns fitting screen)
                        <table className="w-full border-collapse border-spacing-0">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50 text-[9.5px]">
                                    <th className="w-10 px-2 py-2 border-r border-b border-stone-200 dark:border-slate-700 text-center text-stone-400">#</th>
                                    <th className="px-3 py-2 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider min-w-[300px]">Sản phẩm</th>
                                    <th className="px-2.5 py-2 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider w-28 sm:w-32">Danh mục</th>
                                    <th className="px-2 py-2 border-r border-b border-stone-200 dark:border-slate-700 text-right font-bold uppercase text-blue-600 dark:text-blue-400 tracking-wider w-20 sm:w-22">Tồn đầu</th>
                                    <th className="px-2 py-2 border-r border-b border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-900/5 text-right font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider w-20 sm:w-24">Tổng Nhập</th>
                                    <th className="px-2 py-2 border-r border-orange-100 dark:border-orange-900/50 bg-orange-50/20 dark:bg-orange-900/5 text-right font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider w-20 sm:w-24">Tổng Xuất</th>
                                    <th className="px-2 py-2 border-r border-purple-100 dark:border-purple-900/50 bg-purple-50/20 dark:bg-purple-900/5 text-right font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider w-20 sm:w-22">Tồn cuối</th>
                                    <th className="px-2 py-2 border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-stone-400 tracking-wider w-16">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredMovements.map((mov, idx) => {
                                    const rowKey = `${mov.productId}_${mov.unit}_${idx}`
                                    const isExpanded = expandedRowKeys.has(rowKey)
                                    const isOdd = idx % 2 === 1
                                    const inboundActiveTypes = inboundTypes.filter(t => (mov.inboundItems[t.id] || 0) > 0)
                                    const outboundActiveTypes = outboundTypes.filter(t => (mov.outboundItems[t.id] || 0) > 0)

                                    return (
                                        <Fragment key={rowKey}>
                                            <tr 
                                                onClick={() => toggleRow(rowKey)}
                                                className={`group cursor-pointer transition-colors border-b border-stone-200/70 dark:border-slate-800 ${
                                                    isExpanded 
                                                        ? 'bg-indigo-50/50 dark:bg-indigo-950/30' 
                                                        : isOdd
                                                            ? 'bg-stone-100/50 dark:bg-slate-800/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20'
                                                            : 'bg-white dark:bg-slate-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20'
                                                }`}
                                            >
                                                {/* # & Expand Chevron */}
                                                <td className="w-10 px-2 py-2 border-r border-stone-100 dark:border-slate-800 text-center align-top">
                                                    <div className="flex items-center justify-center gap-1 pt-0.5">
                                                        <ChevronRight 
                                                            size={12} 
                                                            className={`text-stone-400 transition-transform duration-200 ${
                                                                isExpanded ? 'rotate-90 text-indigo-600 dark:text-indigo-400' : 'group-hover:text-stone-600'
                                                            }`} 
                                                        />
                                                        <span className="text-[9.5px] text-stone-400 tabular-nums">{idx + 1}</span>
                                                    </div>
                                                </td>

                                                {/* Combined Product: Mã + ĐVT ở trên, Tên sản phẩm ở dưới */}
                                                <td className="px-3 py-2 border-r border-stone-100 dark:border-slate-800 min-w-[300px] align-top">
                                                    <div className="space-y-0.5">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-mono text-[9.5px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-100 dark:border-indigo-900/60 shadow-2xs">
                                                                {mov.sku}
                                                            </span>
                                                            <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-100 dark:border-teal-900/50">
                                                                ĐVT: {mov.unit}
                                                            </span>
                                                        </div>
                                                        <div className="font-semibold text-stone-800 dark:text-stone-100 text-[11px] leading-snug">
                                                            {mov.name}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Primary Category */}
                                                <td className="px-2.5 py-2 border-r border-stone-100 dark:border-slate-800 text-stone-600 dark:text-stone-400 font-medium text-[10.5px] w-28 sm:w-32 align-top">
                                                    <div className="pt-0.5 truncate" title={mov.primaryCategoryName || ''}>
                                                        {mov.primaryCategoryName || '-'}
                                                    </div>
                                                </td>

                                                {/* Opening Balance (Thẳng hàng) */}
                                                <td className="px-2 py-2 border-r border-stone-100 dark:border-slate-800 text-right align-top bg-blue-50/10 w-20 sm:w-22">
                                                    <div className="font-bold text-blue-600 dark:text-blue-400 tabular-nums text-[11px] leading-tight">
                                                        {mov.opening ? formatQuantityFull(mov.opening) : '-'}
                                                    </div>
                                                    <div className="h-2.5 text-[8.5px] mt-0.5" />
                                                </td>

                                                {/* Total In (Thẳng hàng) */}
                                                <td className="px-2 py-2 border-r border-emerald-100 dark:border-emerald-900/40 text-right align-top tabular-nums bg-emerald-50/20 dark:bg-emerald-900/5 w-20 sm:w-24">
                                                    <div className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px] leading-tight">
                                                        {mov.totalIn ? formatQuantityFull(mov.totalIn) : '-'}
                                                    </div>
                                                    <div className="h-2.5 text-[8.5px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5 truncate" title={inboundActiveTypes.map(t => `${t.name}: ${formatQuantityFull(mov.inboundItems[t.id])}`).join(', ')}>
                                                        {inboundActiveTypes.length === 1 ? inboundActiveTypes[0].name : inboundActiveTypes.length > 1 ? `${inboundActiveTypes.length} loại` : ''}
                                                    </div>
                                                </td>

                                                {/* Total Out (Thẳng hàng) */}
                                                <td className="px-2 py-2 border-r border-orange-100 dark:border-orange-900/40 text-right align-top tabular-nums bg-orange-50/20 dark:bg-orange-900/5 w-20 sm:w-24">
                                                    <div className="font-bold text-orange-600 dark:text-orange-400 text-[11px] leading-tight">
                                                        {mov.totalOut ? formatQuantityFull(mov.totalOut) : '-'}
                                                    </div>
                                                    <div className="h-2.5 text-[8.5px] text-orange-600/80 dark:text-orange-400/80 font-medium mt-0.5 truncate" title={outboundActiveTypes.map(t => `${t.name}: ${formatQuantityFull(mov.outboundItems[t.id])}`).join(', ')}>
                                                        {outboundActiveTypes.length === 1 ? outboundActiveTypes[0].name : outboundActiveTypes.length > 1 ? `${outboundActiveTypes.length} loại` : ''}
                                                    </div>
                                                </td>

                                                {/* Closing Balance (Thẳng hàng) */}
                                                <td className="px-2 py-2 border-r border-purple-100 dark:border-purple-900/40 text-right align-top tabular-nums bg-purple-50/20 dark:bg-purple-900/5 w-20 sm:w-22">
                                                    <div className="font-black text-purple-600 dark:text-purple-400 tabular-nums text-[11px] leading-tight">
                                                        {formatQuantityFull(mov.closing)}
                                                    </div>
                                                    <div className="h-2.5 text-[8.5px] text-purple-600/80 dark:text-purple-400/80 font-semibold mt-0.5 truncate" title={`Đơn vị tính: ${mov.unit}`}>
                                                        {mov.unit}
                                                    </div>
                                                </td>

                                                {/* Actions / Vouchers */}
                                                <td className="px-1.5 py-2 text-center w-16 align-top" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-1 pt-0.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedVouchersProduct({ id: mov.productId, name: mov.name, sku: mov.sku, unit: mov.unit })}
                                                            className="p-1 px-1.5 rounded-md bg-stone-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-stone-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-bold text-[10.5px] flex items-center gap-1"
                                                            title="Xem chi tiết các chứng từ của sản phẩm này"
                                                        >
                                                            <FileText size={11} />
                                                            <span>{mov.vouchers.size}</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleRow(rowKey)}
                                                            className={`p-1 rounded-md text-[10px] font-semibold transition-colors ${
                                                                isExpanded 
                                                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' 
                                                                    : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
                                                            }`}
                                                            title={isExpanded ? "Thu gọn chi tiết" : "Xem phân bổ nhập xuất theo từng loại"}
                                                        >
                                                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Sub-row Expandable Panel */}
                                            {isExpanded && (
                                                <tr className="bg-stone-50/60 dark:bg-slate-900/50 border-b border-indigo-100 dark:border-indigo-950">
                                                    <td colSpan={8} className="p-2.5 sm:p-3">
                                                        <div className="bg-white dark:bg-slate-900 rounded-xl p-3 sm:p-3.5 border border-stone-200 dark:border-slate-800 shadow-2xs space-y-2.5">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100 dark:border-slate-800">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-900">
                                                                        {mov.sku}
                                                                    </span>
                                                                    <span className="font-bold text-stone-800 dark:text-stone-100 text-[12px]">{mov.name}</span>
                                                                    <span className="text-[10.5px] text-stone-400 italic font-medium">({mov.unit})</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[11px] text-stone-500">
                                                                        Danh mục: <strong className="text-stone-700 dark:text-stone-300">{mov.primaryCategoryName || '-'}</strong>
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSelectedVouchersProduct({ id: mov.productId, name: mov.name, sku: mov.sku, unit: mov.unit })}
                                                                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 dark:text-indigo-400 transition-colors shadow-2xs"
                                                                    >
                                                                        <FileText size={12} />
                                                                        <span>Xem {mov.vouchers.size} chứng từ</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* 2 Blocks: Inbound Breakdown & Outbound Breakdown */}
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                                                {/* Inbound Card */}
                                                                <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/10 p-2.5 space-y-1.5">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-[10.5px]">
                                                                            <ArrowDownLeft size={13} />
                                                                            <span>PHÂN BỔ NHẬP KHO THEO LOẠI</span>
                                                                        </div>
                                                                        <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                                            Tổng: {formatQuantityFull(mov.totalIn)} {mov.unit}
                                                                        </span>
                                                                    </div>
                                                                    <div className="space-y-1 pt-1">
                                                                        {inboundActiveTypes.length === 0 ? (
                                                                            <div className="text-xs text-stone-400 italic py-1 text-center bg-white/60 dark:bg-slate-800/40 rounded-lg">
                                                                                Không có phát sinh nhập trong kỳ
                                                                            </div>
                                                                        ) : (
                                                                            inboundActiveTypes.map(t => {
                                                                                const qty = mov.inboundItems[t.id] || 0
                                                                                const pct = mov.totalIn > 0 ? Math.round((qty / mov.totalIn) * 100) : 0
                                                                                return (
                                                                                    <div key={t.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-emerald-100/60 dark:border-emerald-900/30">
                                                                                        <span className="font-semibold text-stone-700 dark:text-stone-300">{t.name}</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-[10px] text-stone-400 font-medium">({pct}%)</span>
                                                                                            <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatQuantityFull(qty)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                {/* Outbound Card */}
                                                                <div className="rounded-xl border border-orange-100 dark:border-orange-900/40 bg-orange-50/20 dark:bg-orange-950/10 p-2.5 space-y-1.5">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 font-bold text-[10.5px]">
                                                                            <ArrowUpRight size={13} />
                                                                            <span>PHÂN BỔ XUẤT KHO THEO LOẠI</span>
                                                                        </div>
                                                                        <span className="text-[11px] font-black text-orange-600 dark:text-orange-400 tabular-nums">
                                                                            Tổng: {formatQuantityFull(mov.totalOut)} {mov.unit}
                                                                        </span>
                                                                    </div>
                                                                    <div className="space-y-1 pt-1">
                                                                        {outboundActiveTypes.length === 0 ? (
                                                                            <div className="text-xs text-stone-400 italic py-1 text-center bg-white/60 dark:bg-slate-800/40 rounded-lg">
                                                                                Không có phát sinh xuất trong kỳ
                                                                            </div>
                                                                        ) : (
                                                                            outboundActiveTypes.map(t => {
                                                                                const qty = mov.outboundItems[t.id] || 0
                                                                                const pct = mov.totalOut > 0 ? Math.round((qty / mov.totalOut) * 100) : 0
                                                                                return (
                                                                                    <div key={t.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-orange-100/60 dark:border-orange-900/30">
                                                                                        <span className="font-semibold text-stone-700 dark:text-stone-300">{t.name}</span>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="text-[9.5px] text-stone-400 font-medium">({pct}%)</span>
                                                                                            <span className="font-black text-orange-600 dark:text-orange-400 tabular-nums">{formatQuantityFull(qty)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                )
                                                                            })
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Balance Formula Row */}
                                                            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5 text-[10.5px] text-stone-500 bg-stone-50/80 dark:bg-slate-800/60 p-2 rounded-lg border border-stone-200/50 dark:border-slate-700/50">
                                                                <div className="flex flex-wrap items-center gap-2.5">
                                                                    <span>Tồn đầu: <strong className="text-blue-600 dark:text-blue-400 font-bold">{formatQuantityFull(mov.opening)}</strong></span>
                                                                    <span className="text-stone-300 dark:text-stone-600">+</span>
                                                                    <span>Tổng nhập: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatQuantityFull(mov.totalIn)}</strong></span>
                                                                    <span className="text-stone-300 dark:text-stone-600">-</span>
                                                                    <span>Tổng xuất: <strong className="text-orange-600 dark:text-orange-400 font-bold">{formatQuantityFull(mov.totalOut)}</strong></span>
                                                                    <span className="text-stone-300 dark:text-stone-600">=</span>
                                                                    <span>Tồn cuối: <strong className="text-purple-600 dark:text-purple-400 font-black">{formatQuantityFull(mov.closing)}</strong></span>
                                                                </div>
                                                                <span className="italic text-[10px] text-stone-400">Đơn vị: {mov.unit}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    )
                                })}
                            </tbody>
                            <tfoot className="bg-stone-50 dark:bg-slate-800/80 font-black text-stone-900 dark:text-white sticky bottom-0 text-[11px]">
                                <tr>
                                    <td colSpan={3} className="px-3 py-2 text-right uppercase tracking-wider border-t-2 border-indigo-500 text-[10.5px]">
                                        Tổng cộng ({summary.uniqueProducts} mã SP - {summary.rowCount} dòng)
                                    </td>
                                    <td className="px-2 py-2 text-right border-t-2 border-indigo-500 text-blue-600 tabular-nums w-20 sm:w-22">
                                        {formatQuantityFull(summary.opening)}
                                    </td>
                                    <td className="px-2 py-2 text-right border-t-2 border-indigo-500 text-emerald-600 bg-emerald-500/10 tabular-nums w-20 sm:w-24">
                                        {formatQuantityFull(summary.inbound)}
                                    </td>
                                    <td className="px-2 py-2 text-right border-t-2 border-indigo-500 text-orange-600 bg-orange-500/10 tabular-nums w-20 sm:w-24">
                                        {formatQuantityFull(summary.outbound)}
                                    </td>
                                    <td className="px-2 py-2 text-right border-t-2 border-indigo-500 text-purple-600 bg-purple-500/10 tabular-nums w-20 sm:w-22">
                                        {formatQuantityFull(summary.closing)}
                                    </td>
                                    <td className="border-t-2 border-indigo-500 w-16"></td>
                                </tr>
                            </tfoot>
                        </table>
                    ) : (
                        // Full Multi-Column Summary Table (All Order Types Expanded)
                        <table className="w-full border-collapse border-spacing-0">
                            <thead>
                                <tr className="bg-stone-50/80 dark:bg-slate-800/50">
                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider w-24">Mã SP</th>
                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider min-w-[200px]">Tên Sản Phẩm</th>
                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-left font-bold uppercase text-stone-400 tracking-wider w-36">Danh mục chính</th>
                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-blue-500 tracking-wider w-24">Tồn đầu kỳ</th>

                                    {/* Nhập Kho Header */}
                                    <th colSpan={inboundTypes.length + 1} className="px-4 py-2 border-r border-b border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-900/5 text-center font-black uppercase text-emerald-600 tracking-widest border-t-2 border-t-emerald-500">NHẬP KHO</th>

                                    {/* Xuất Kho Header */}
                                    <th colSpan={outboundTypes.length + 1} className="px-4 py-2 border-r border-b border-orange-100 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-900/5 text-center font-black uppercase text-orange-600 tracking-widest border-t-2 border-t-orange-500">XUẤT KHO</th>

                                    <th rowSpan={2} className="px-4 py-4 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-purple-500 tracking-wider w-24">Tồn cuối kỳ</th>
                                    <th rowSpan={2} className="px-4 py-4 border-b border-stone-200 dark:border-slate-700 text-center font-bold uppercase text-stone-400 tracking-wider w-16">Vouchers</th>
                                </tr>
                                <tr className="bg-stone-50/30 dark:bg-slate-800/30 text-[10px]">
                                    {inboundTypes.map(t => (
                                        <th key={t.id} className="px-2 py-3 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold text-stone-500">{t.name}</th>
                                    ))}
                                    <th className="px-2 py-3 border-r border-b border-emerald-200 dark:border-emerald-800 bg-emerald-500/10 text-center font-black text-emerald-600">TỔNG NHẬP</th>

                                    {outboundTypes.map(t => (
                                        <th key={t.id} className="px-2 py-3 border-r border-b border-stone-200 dark:border-slate-700 text-center font-bold text-stone-500">{t.name}</th>
                                    ))}
                                    <th className="px-2 py-3 border-r border-b border-orange-200 dark:border-orange-800 bg-orange-500/10 text-center font-black text-orange-600">TỔNG XUẤT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 dark:divide-slate-800">
                                {filteredMovements.map((mov, idx) => (
                                    <tr key={`${mov.productId}-${mov.unit}-${idx}`} className={`group transition-colors border-b border-stone-200/60 dark:border-slate-800 ${idx % 2 === 1 ? 'bg-stone-100/50 dark:bg-slate-800/40' : 'bg-white dark:bg-slate-900'} hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10`}>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 font-mono font-bold text-stone-400">{mov.sku}</td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800">
                                            <div className="font-bold text-stone-800 dark:text-stone-200">{mov.name}</div>
                                            <div className="text-[10px] text-stone-400 italic">({mov.unit})</div>
                                        </td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 text-stone-600 dark:text-stone-400 font-medium">
                                            {mov.primaryCategoryName || '-'}
                                        </td>
                                        <td className="px-4 py-3 border-r border-stone-100 dark:border-slate-800 text-center font-bold text-blue-600 tabular-nums bg-blue-50/10">
                                            {formatQuantityFull(mov.opening)}
                                        </td>

                                        {/* Inbound Details */}
                                        {inboundTypes.map(t => (
                                            <td key={t.id} className="px-2 py-3 border-r border-stone-100 dark:border-slate-800 text-center text-stone-500 tabular-nums">
                                                {mov.inboundItems[t.id] ? formatQuantityFull(mov.inboundItems[t.id]) : '-'}
                                            </td>
                                        ))}
                                        <td className="px-2 py-3 border-r border-emerald-100 dark:border-emerald-900 text-center font-black text-emerald-600 tabular-nums bg-emerald-50/20 dark:bg-emerald-900/5">
                                            {mov.totalIn ? formatQuantityFull(mov.totalIn) : '-'}
                                        </td>

                                        {/* Outbound Details */}
                                        {outboundTypes.map(t => (
                                            <td key={t.id} className="px-2 py-3 border-r border-stone-100 dark:border-slate-800 text-center text-stone-500 tabular-nums">
                                                {mov.outboundItems[t.id] ? formatQuantityFull(mov.outboundItems[t.id]) : '-'}
                                            </td>
                                        ))}
                                        <td className="px-2 py-3 border-r border-orange-100 dark:border-orange-900 text-center font-black text-orange-600 tabular-nums bg-orange-50/20 dark:bg-orange-900/5">
                                            {mov.totalOut ? formatQuantityFull(mov.totalOut) : '-'}
                                        </td>

                                        <td className="px-4 py-3 border-r border-purple-100 dark:border-purple-900 text-center font-black text-purple-600 tabular-nums bg-purple-50/20 dark:bg-purple-900/5">
                                            {formatQuantityFull(mov.closing)}
                                        </td>

                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center">
                                                <button
                                                    onClick={() => setSelectedVouchersProduct({ id: mov.productId, name: mov.name, sku: mov.sku, unit: mov.unit })}
                                                    className="p-1 px-2 rounded bg-stone-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-stone-500 hover:text-indigo-600 transition-colors font-bold"
                                                >
                                                    {mov.vouchers.size}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-stone-50 dark:bg-slate-800/80 font-black text-stone-900 dark:text-white sticky bottom-0">
                                <tr>
                                    <td colSpan={3} className="px-4 py-4 text-right uppercase tracking-wider border-t-2 border-indigo-500">Tổng cộng kỳ này</td>
                                    <td className="px-4 py-4 text-center border-t-2 border-indigo-500 text-blue-600">{formatQuantityFull(summary.opening)}</td>

                                    {/* Inbound TFoot Spacer & Total */}
                                    <td colSpan={inboundTypes.length} className="px-4 py-4 border-t-2 border-indigo-500"></td>
                                    <td className="px-2 py-4 text-center border-t-2 border-indigo-500 text-emerald-600 bg-emerald-500/10">{formatQuantityFull(summary.inbound)}</td>

                                    {/* Outbound TFoot Spacer & Total */}
                                    <td colSpan={outboundTypes.length} className="px-4 py-4 border-t-2 border-indigo-500"></td>
                                    <td className="px-2 py-4 text-center border-t-2 border-indigo-500 text-orange-600 bg-orange-500/10">{formatQuantityFull(summary.outbound)}</td>

                                    <td className="px-4 py-4 text-center border-t-2 border-indigo-500 text-purple-600 bg-purple-500/10">{formatQuantityFull(summary.closing)}</td>
                                    <td className="border-t-2 border-indigo-500"></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>

            {/* Hint Section */}
            <div className="bg-stone-50 dark:bg-slate-800/50 p-4 rounded-xl border border-dashed border-stone-200 dark:border-slate-800 flex items-start gap-3">
                <div className="p-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 rounded-lg">
                    <TrendingUp size={16} />
                </div>
                <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Ghi chú hạch toán</p>
                    <p className="text-xs text-stone-500 dark:text-slate-400 leading-relaxed">
                        Dữ liệu "Tồn đầu kỳ" được tổng hợp từ toàn bộ các phiếu đã hoàn thành trước ngày bắt đầu chọn.
                        Các cột Nhập/Xuất chi tiết được phân rã dựa trên <strong>Loại phiếu</strong> được cấu hình trong hệ thống.
                        Chỉ các phiếu ở trạng thái <strong>"Hoàn thành"</strong> mới được ghi nhận vào báo cáo này.
                    </p>
                </div>
            </div>

            {/* Voucher Detail Modal */}
            <VoucherDetailModal
                isOpen={!!selectedVouchersProduct}
                onClose={() => setSelectedVouchersProduct(null)}
                productId={selectedVouchersProduct?.id || ''}
                unit={selectedVouchersProduct?.unit || ''}
                productName={selectedVouchersProduct?.name || ''}
                sku={selectedVouchersProduct?.sku || ''}
                startDate={startDate}
                endDate={endDate}
                systemType={systemType}
                orderTypes={orderTypes}
                targetUnitId={targetUnitId}
                units={units}
                products={products}
                targetDate={selectedVouchersProduct?.date}
            />
        </div>
    )
}

function VoucherDetailModal({ isOpen, onClose, productId, unit, productName, sku, startDate, endDate, systemType, orderTypes, targetUnitId, units, products, targetDate }: any) {
    const [loading, setLoading] = useState(false)
    const [vouchers, setVouchers] = useState<any[]>([])
    const { convertUnit, conversionMap, unitNameMap } = useUnitConversion()

    useEffect(() => {
        if (isOpen && productId) {
            fetchVouchers()
        }
    }, [isOpen, productId, unit, startDate, endDate, targetUnitId, targetDate])

    async function fetchVouchers() {
        setLoading(true)
        try {
            const start = targetDate ? targetDate : startDate
            const end = targetDate ? targetDate + 'T23:59:59' : endDate + 'T23:59:59'

            const prod = products.find((p: any) => p.id === productId)
            const targetUnit = units.find((u: any) => u.id === targetUnitId)

            const baseUnitId = (prod && prod.unit) ? unitNameMap.get(normalizeUnit(prod.unit)) : null
            const canConvert = targetUnitId && prod && !!targetUnit && (
                isSameUnitName(prod.unit, targetUnit.name) ||
                baseUnitId === targetUnitId ||
                (conversionMap.get(productId)?.has(targetUnitId))
            )

            // Fetch Inbound
            const queryIn = (supabase
                .from('inbound_order_items') as any)
                .select(`
                    id, quantity, unit,
                    order:inbound_orders!inner(code, created_at, order_type_id, status)
                `)
                .eq('product_id', productId)
                .eq('order.system_type', systemType)
                .eq('order.status', 'Completed')
                .gte('order.created_at', start)
                .lte('order.created_at', end)

            // Fetch Outbound
            const queryOut = (supabase
                .from('outbound_order_items') as any)
                .select(`
                    id, quantity, unit,
                    order:outbound_orders!inner(code, created_at, order_type_id, status)
                `)
                .eq('product_id', productId)
                .eq('order.system_type', systemType)
                .eq('order.status', 'Completed')
                .gte('order.created_at', start)
                .lte('order.created_at', end)

            if (!targetUnitId || !canConvert) {
                queryIn.eq('unit', unit)
                queryOut.eq('unit', unit)
            }

            const { data: inbound } = await queryIn
            const { data: outbound } = await queryOut

            const normalized = [
                ...(inbound || []).filter((v: any) => v.order).map((v: any) => {
                    const qty = (targetUnit && canConvert)
                        ? convertUnit(productId, v.unit || null, targetUnit.name, v.quantity, prod?.unit || null)
                        : v.quantity
                    return { ...v, quantity: qty, displayUnit: (targetUnit && canConvert) ? targetUnit.name : v.unit, type: 'in' }
                }),
                ...(outbound || []).filter((v: any) => v.order).map((v: any) => {
                    const qty = (targetUnit && canConvert)
                        ? convertUnit(productId, v.unit || null, targetUnit.name, v.quantity, prod?.unit || null)
                        : v.quantity
                    return { ...v, quantity: qty, displayUnit: (targetUnit && canConvert) ? targetUnit.name : v.unit, type: 'out' }
                })
            ].sort((a, b) => new Date(b.order.created_at).getTime() - new Date(a.order.created_at).getTime())

            setVouchers(normalized)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-stone-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-stone-100 dark:border-slate-800 flex items-center justify-between bg-stone-50/50 dark:bg-slate-800/50">
                    <div>
                        <h2 className="text-xl font-black text-stone-900 dark:text-white flex items-center gap-2">
                            Biến động: <span className="text-indigo-600 dark:text-indigo-400">{sku}</span>
                        </h2>
                        <p className="text-sm text-stone-500 font-medium">{productName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-stone-400">
                        <ChevronDown size={24} className="rotate-90" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="py-20 text-center">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                        </div>
                    ) : vouchers.length === 0 ? (
                        <div className="py-20 text-center text-stone-400 font-medium">Không tìm thấy phiếu nào</div>
                    ) : (
                        <div className="space-y-3">
                            {vouchers.map((v, i) => {
                                const typeName = orderTypes.find((t: any) => t.id === v.order.order_type_id)?.name || 'Không xác định'
                                return (
                                    <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-stone-100 dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/50 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2 rounded-xl ${v.type === 'in' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                                                }`}>
                                                {v.type === 'in' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                            </div>
                                            <div>
                                                <div className="font-mono font-bold text-sm text-stone-900 dark:text-white uppercase">{v.order.code}</div>
                                                <div className="flex items-center gap-2 text-[10px] uppercase font-black text-stone-400 mt-0.5">
                                                    <span>{typeName}</span>
                                                    <span>•</span>
                                                    <span>{format(parseISO(v.order.created_at), 'dd/MM/yyyy HH:mm')}</span>
                                                    {!targetUnitId && <span className="ml-2 px-1 rounded bg-stone-100 dark:bg-slate-700 text-stone-500">{v.unit}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-lg font-black ${v.type === 'in' ? 'text-emerald-600' : 'text-orange-600'
                                                }`}>
                                                {v.type === 'in' ? '+' : '-'}{formatQuantityFull(v.quantity)}
                                            </div>
                                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                                {v.type === 'in' ? 'Nhập kho' : 'Xuất kho'}
                                                <span className="ml-1 text-indigo-500">({v.displayUnit})</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-stone-50 dark:bg-slate-800/50 text-center border-t border-stone-100 dark:border-slate-800">
                    <button onClick={onClose} className="px-8 py-2.5 bg-white dark:bg-slate-700 border border-stone-200 dark:border-slate-600 rounded-xl text-sm font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 transition-all shadow-sm">
                        Đóng chi tiết
                    </button>
                </div>
            </div>
        </div>
    )
}

function CategoryMultiSelect({ categories, selectedIds, onChange, productCounts = {} }: {
    categories: { id: string; name: string }[]
    selectedIds: string[]
    onChange: (ids: string[]) => void
    productCounts?: Record<string, number>
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filtered = categories.filter((c: any) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((sid: string) => sid !== id))
        } else {
            onChange([...selectedIds, id])
        }
    }

    const selectAll = () => {
        onChange(categories.map(c => c.id))
    }

    const clearAll = () => {
        onChange([])
    }

    const label = useMemo(() => {
        if (selectedIds.length === 0) return "Tất cả danh mục"
        if (selectedIds.length === 1) {
            const cat = categories.find(c => c.id === selectedIds[0])
            return cat ? cat.name : "1 danh mục"
        }
        return `Đã chọn ${selectedIds.length} danh mục`
    }, [selectedIds, categories])

    return (
        <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-800 border text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold flex items-center justify-between ${
                    selectedIds.length > 0 
                        ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-300 font-bold' 
                        : 'border-stone-200 dark:border-slate-700 text-stone-600 dark:text-stone-300'
                }`}
            >
                <div className="flex items-center gap-1.5 truncate">
                    <Tag size={14} className={selectedIds.length > 0 ? "text-indigo-500 flex-shrink-0" : "text-stone-400 flex-shrink-0"} />
                    <span className="truncate font-semibold text-xs">
                        {label}
                    </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {selectedIds.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-black flex items-center justify-center">
                            {selectedIds.length}
                        </span>
                    )}
                    <ChevronDown size={14} className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 p-2.5 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 min-w-full w-[340px] sm:w-[400px] max-w-[92vw]">
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={14} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Tìm danh mục..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-100 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        />
                    </div>

                    <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-stone-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        <button
                            type="button"
                            onClick={selectAll}
                            className="hover:text-indigo-600 transition-colors"
                        >
                            Chọn tất cả ({categories.length})
                        </button>
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                onClick={clearAll}
                                className="text-red-500 hover:text-red-600 transition-colors"
                            >
                                Bỏ chọn tất cả
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto space-y-1 [scrollbar-width:thin] pr-1">
                        {filtered.length === 0 ? (
                            <div className="py-8 text-center text-stone-400 text-xs">Không tìm thấy danh mục</div>
                        ) : (
                            filtered.map((c: any) => {
                                const isSelected = selectedIds.includes(c.id)
                                const count = productCounts[c.id]
                                return (
                                    <label
                                        key={c.id}
                                        className="flex items-center gap-3 p-2 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors group"
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                                            isSelected 
                                            ? 'bg-indigo-500 border-indigo-500 text-white' 
                                            : 'border-stone-300 dark:border-slate-600'
                                        }`}>
                                            {isSelected && <Check size={12} strokeWidth={4} />}
                                        </div>
                                        <div className="flex-1 min-w-0 flex items-center justify-between">
                                            <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">{c.name}</span>
                                            {count !== undefined && (
                                                <span className="text-[10px] font-mono text-stone-400 ml-2 px-1.5 py-0.5 rounded bg-stone-100 dark:bg-slate-800 flex-shrink-0">
                                                    {count} SP
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isSelected}
                                            onChange={() => toggle(c.id)}
                                        />
                                    </label>
                                )
                            })
                        )}
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-stone-100 dark:border-slate-800 flex justify-between items-center px-1">
                            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Đã chọn {selectedIds.length}/{categories.length}</span>
                            <button
                                type="button"
                                onClick={clearAll}
                                className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider"
                            >
                                Xóa lọc
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function ProductMultiSelect({ products, selectedIds, onChange }: any) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const filtered = products
        .filter((p: any) => matchSearch(p, search))
        .sort((a: any, b: any) => calculateSearchScore(b, search) - calculateSearchScore(a, search))

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((sid: string) => sid !== id))
        } else {
            onChange([...selectedIds, id])
        }
    }

    return (
        <div className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold flex items-center justify-between"
            >
                <div className="flex items-center gap-1.5 truncate text-stone-600 dark:text-stone-300">
                    <Boxes size={14} className="text-stone-400 flex-shrink-0" />
                    <span className="truncate text-xs font-semibold">
                        {selectedIds.length === 0 ? "Tất cả sản phẩm" : `Đã chọn ${selectedIds.length} SP`}
                    </span>
                </div>
                <ChevronDown size={14} className={`text-stone-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200 min-w-full w-[420px] sm:w-[500px] max-w-[92vw]">
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={14} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Tìm nhanh theo tên, mã SKU, tên viết tắt..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-100 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        />
                    </div>

                    <div className="flex items-center justify-between px-1 py-1 mb-1 border-b border-stone-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-stone-400">
                        <button
                            type="button"
                            onClick={() => onChange(filtered.map((p: any) => p.id))}
                            className="hover:text-indigo-600 transition-colors"
                        >
                            Chọn tất cả ({filtered.length})
                        </button>
                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-red-500 hover:text-red-600 transition-colors"
                            >
                                Bỏ chọn tất cả
                            </button>
                        )}
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto space-y-1 [scrollbar-width:thin] pr-1">
                        {filtered.length === 0 ? (
                            <div className="py-8 text-center text-stone-400 text-xs">Không tìm thấy sản phẩm</div>
                        ) : (
                            filtered.map((p: any) => {
                                const rawAliases = p.aliases || p.short_name
                                let matchedAlias: string | undefined
                                if (rawAliases && search.trim()) {
                                    const aliasList = String(rawAliases).split(/[,;]/).map((a: string) => a.trim()).filter(Boolean)
                                    matchedAlias = aliasList.find((a: string) => matchSearch(a, search))
                                }

                                return (
                                    <label
                                        key={p.id}
                                        className="flex items-start gap-3 p-2.5 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors group"
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 mt-0.5 ${
                                            selectedIds.includes(p.id) 
                                            ? 'bg-indigo-500 border-indigo-500 text-white' 
                                            : 'border-stone-300 dark:border-slate-600'
                                        }`}>
                                            {selectedIds.includes(p.id) && <Check size={12} strokeWidth={4} />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 leading-snug break-words">
                                                    {p.name}
                                                </span>
                                                {matchedAlias && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                                                        ⚡ {matchedAlias}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                                                SKU: {p.sku}{p.internal_code ? ` | NB: ${p.internal_code}` : ''}
                                            </div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedIds.includes(p.id)}
                                            onChange={() => toggle(p.id)}
                                        />
                                    </label>
                                )
                            })
                        )}
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-stone-100 dark:border-slate-800 flex justify-between items-center px-1">
                            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Đã chọn {selectedIds.length}</span>
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors uppercase tracking-wider"
                            >
                                Xóa tất cả
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
