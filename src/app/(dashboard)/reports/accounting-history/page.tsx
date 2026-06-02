'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, Download, Calendar, Boxes, Building2, User, FileText, Filter, Layers, ChevronDown, DollarSign, ArrowUpRight, ArrowDownLeft, PackageSearch, TrendingUp, Check, X } from 'lucide-react'
import { format, startOfMonth, endOfMonth, isBefore, parseISO } from 'date-fns'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { Scale } from 'lucide-react'
import { useToast } from '@/components/ui/ToastProvider'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { exportAccountingHistoryToExcel } from '@/lib/accountingHistoryExcelExport'

type OrderType = {
    id: string
    name: string
    code: string
    scope: 'inbound' | 'outbound' | 'both'
}

type ProductMovement = {
    productId: string
    sku: string
    name: string
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
    const [orderTypes, setOrderTypes] = useState<OrderType[]>([])
    const [movements, setMovements] = useState<ProductMovement[]>([])
    const [dailyMovements, setDailyMovements] = useState<DailyMovement[]>([])
    const [selectedVouchersProduct, setSelectedVouchersProduct] = useState<any | null>(null)
    const [units, setUnits] = useState<any[]>([])
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])

    const { showToast } = useToast()
    const { companyInfo } = usePrintCompanyInfo()
    const [exporting, setExporting] = useState(false)

    const { convertUnit, conversionMap, unitNameMap, loading: loadingConversion } = useUnitConversion()

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
                .select('id, sku, name, unit, product_category_rel(category_id, is_primary, categories(id, name))')
                .eq('system_type', systemType)

            if (!prodData) return
            setProducts(prodData)

            // 2. Fetch Order Types
            const { data: typeData } = await (supabase.from('order_types') as any)
                .select('*')
                .eq('is_active', true)
                .or(`system_code.eq.${systemType},system_code.is.null`)
            setOrderTypes(typeData || [])

            // 2b. Fetch All Units
            const { data: unitData } = await supabase.from('units').select('id, name').order('name')
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
                if (!targetUnitId) return false
                const prod = prodData.find((p: any) => p.id === productId)
                if (!prod || !prod.unit) return false

                const baseUnitId = unitNameMap.get(prod.unit.toLowerCase())

                // Convertible if target is base unit OR a conversion rate exists
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
                    const primaryRel = prod?.product_category_rel?.find((r: any) => r.is_primary === true || r.is_primary === 'true')
                    const primaryCategoryName = primaryRel?.categories?.name || '-'

                    movementMap[key] = {
                        productId,
                        sku: prod?.sku || 'N/A',
                        name: prod?.name || 'Unknown',
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
                    const primaryRel = prod?.product_category_rel?.find((r: any) => r.is_primary === true || r.is_primary === 'true')
                    const primaryCategoryName = primaryRel?.categories?.name || '-'

                    dailyMap[key] = {
                        date: dateKey,
                        productId: item.product_id,
                        sku: prod?.sku || 'N/A',
                        name: prod?.name || 'Unknown',
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
                    const primaryRel = prod?.product_category_rel?.find((r: any) => r.is_primary === true || r.is_primary === 'true')
                    const primaryCategoryName = primaryRel?.categories?.name || '-'

                    dailyMap[key] = {
                        date: dateKey,
                        productId: item.product_id,
                        sku: prod?.sku || 'N/A',
                        name: prod?.name || 'Unknown',
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

    const filteredMovements = movements.filter(m => {
        const matchesSearch = m.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.name.toLowerCase().includes(searchTerm.toLowerCase())
        const matchesProducts = selectedProductIds.length === 0 || selectedProductIds.includes(m.productId)
        return matchesSearch && matchesProducts
    }).filter(m => m.opening !== 0 || m.totalIn !== 0 || m.totalOut !== 0)

    // Dynamic columns for Order Types
    const inboundTypes = orderTypes.filter(t => t.scope === 'inbound' || t.scope === 'both')
    const outboundTypes = orderTypes.filter(t => t.scope === 'outbound' || t.scope === 'both')

    // Summaries
    const summary = useMemo(() => {
        return filteredMovements.reduce((acc, curr) => ({
            products: acc.products + 1,
            opening: acc.opening + curr.opening,
            inbound: acc.inbound + curr.totalIn,
            outbound: acc.outbound + curr.totalOut,
            closing: acc.closing + curr.closing
        }), { products: 0, opening: 0, inbound: 0, outbound: 0, closing: 0 })
    }, [filteredMovements])

    const handleExportExcel = async () => {
        const currentData = viewMode === 'summary' ? filteredMovements : dailyMovements.filter(m => {
            const matchesSearch = m.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.name.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesProducts = selectedProductIds.length === 0 || selectedProductIds.includes(m.productId)
            return matchesSearch && matchesProducts
        })

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
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">Tổng sản phẩm</p>
                    <div className="flex items-end justify-between">
                        <h3 className="text-2xl font-black text-stone-900 dark:text-white tabular-nums">{summary.products}</h3>
                        <div className="p-1 px-2 rounded-lg bg-stone-100 dark:bg-slate-800 text-stone-500 text-[10px] font-bold">SP</div>
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

            {/* Filters Section */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-stone-200 dark:border-slate-800 shadow-sm sticky top-4 z-10 space-y-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search & Product MultiSelect Group */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Tìm mã SP, tên sản phẩm..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800/50 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                            />
                        </div>

                        <ProductMultiSelect
                            products={products}
                            selectedIds={selectedProductIds}
                            onChange={setSelectedProductIds}
                        />
                    </div>

                    {/* Date Range Picker Group */}
                    <div className="flex items-center gap-1 p-1 bg-stone-100/80 dark:bg-slate-800/80 rounded-2xl border border-stone-200/50 dark:border-slate-700/50">
                        <div className="relative group flex-1 min-w-[140px]">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500" size={16} />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full pl-9 pr-2 py-2 rounded-xl bg-transparent text-xs focus:outline-none transition-all font-black text-stone-700 dark:text-stone-200 appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="px-1 text-stone-400 font-bold text-[10px] uppercase tracking-widest">đến</div>
                        <div className="relative group flex-1 min-w-[140px]">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-indigo-500" size={16} />
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full pl-9 pr-2 py-2 rounded-xl bg-transparent text-xs focus:outline-none transition-all font-black text-stone-700 dark:text-stone-200 appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-stone-100 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="relative flex items-center group">
                            <Scale size={14} className="absolute left-3 text-stone-400 pointer-events-none group-focus-within:text-indigo-500 transition-colors" />
                            <select
                                value={targetUnitId || ''}
                                onChange={(e) => setTargetUnitId(e.target.value || null)}
                                className="pl-9 pr-10 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-[11px] font-black text-stone-600 dark:text-stone-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none appearance-none transition-all cursor-pointer min-w-[140px] uppercase tracking-wider"
                            >
                                <option value="">Đơn vị gốc</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                            <div className="absolute right-3 pointer-events-none text-stone-400">
                                <ChevronDown size={14} />
                            </div>
                        </div>

                        <button
                            onClick={() => fetchData()}
                            className="px-5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-[11px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all uppercase tracking-widest border border-indigo-100 dark:border-indigo-900/50"
                        >
                            Làm mới dữ liệu
                        </button>
                    </div>

                    {selectedProductIds.length > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg animate-in fade-in zoom-in-95">
                            <Filter size={12} className="text-amber-500" />
                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                                Đang lọc {selectedProductIds.length} sản phẩm
                            </span>
                            <button 
                                onClick={() => setSelectedProductIds([])}
                                className="ml-1 p-0.5 hover:bg-amber-200 dark:hover:bg-amber-900/50 rounded transition-colors text-amber-600"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* NXT Table or Daily Log Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden text-[11px]">
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
                                {dailyMovements.filter(m => {
                                    const matchesSearch = m.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        m.name.toLowerCase().includes(searchTerm.toLowerCase())
                                    const matchesProducts = selectedProductIds.length === 0 || selectedProductIds.includes(m.productId)
                                    return matchesSearch && matchesProducts
                                }).map((mov, idx) => (
                                    <tr key={`${mov.date}-${mov.productId}-${idx}`} className="group hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 transition-colors">
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
                                <PackageSearch className="opacity-20" size={48} />
                            </div>
                            <p className="text-stone-500 font-medium">Không có biến động hàng hóa trong kỳ này</p>
                        </div>
                    ) : (
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
                                    <tr key={`${mov.productId}-${mov.unit}-${idx}`} className="group hover:bg-indigo-50/20 dark:hover:bg-indigo-900/5 transition-colors">
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

            const baseUnitId = (prod && prod.unit) ? unitNameMap.get(prod.unit.toLowerCase()) : null
            const canConvert = targetUnitId && prod && (
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

    const filtered = products.filter((p: any) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
    )

    const toggle = (id: string) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((sid: string) => sid !== id))
        } else {
            onChange([...selectedIds, id])
        }
    }

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium flex items-center justify-between"
            >
                <div className="flex items-center gap-2 truncate text-stone-600 dark:text-stone-300">
                    <Boxes size={18} className="text-stone-400 flex-shrink-0" />
                    <span className="truncate">
                        {selectedIds.length === 0 ? "Tất cả sản phẩm" : `Đã chọn ${selectedIds.length} sản phẩm`}
                    </span>
                </div>
                <ChevronDown size={16} className={`text-stone-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={14} />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Tìm nhanh..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-stone-50 dark:bg-slate-800 border border-stone-100 dark:border-slate-700 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto space-y-1 [scrollbar-width:thin] pr-1">
                        {filtered.length === 0 ? (
                            <div className="py-8 text-center text-stone-400 text-xs">Không tìm thấy sản phẩm</div>
                        ) : (
                            filtered.map((p: any) => (
                                <label
                                    key={p.id}
                                    className="flex items-center gap-3 p-2 hover:bg-stone-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors group"
                                >
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                                        selectedIds.includes(p.id) 
                                        ? 'bg-indigo-500 border-indigo-500 text-white' 
                                        : 'border-stone-300 dark:border-slate-600'
                                    }`}>
                                        {selectedIds.includes(p.id) && <Check size={12} strokeWidth={4} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">{p.name}</div>
                                        <div className="text-[10px] text-stone-400 font-mono">{p.sku}</div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={selectedIds.includes(p.id)}
                                        onChange={() => toggle(p.id)}
                                    />
                                </label>
                            ))
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
