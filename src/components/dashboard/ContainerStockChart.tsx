'use client'

import React, { useEffect, useState, useMemo } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts'
import { supabase } from '@/lib/supabaseClient'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { 
    Loader2, 
    RefreshCw, 
    Truck, 
    Package, 
    Boxes, 
    AlertCircle, 
    CheckCircle2, 
    ChevronDown, 
    ChevronUp,
    ExternalLink,
    Filter
} from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { Database } from '@/lib/database.types'
import { formatQuantityFull } from '@/lib/numberUtils'
import Link from 'next/link'

type LotItem = Database['public']['Tables']['lot_items']['Row'] & {
    unit: string | null
    products: {
        id?: string
        sku: string
        name: string
        unit: string
        boxes_per_container?: number | null
        internal_code: string | null
        internal_name: string | null
        product_category_rel?: { category_id: string }[]
    } | null
}

type Lot = Database['public']['Tables']['lots']['Row'] & {
    lot_items: LotItem[] | null
    products: {
        id?: string
        sku: string
        name: string
        unit: string
        boxes_per_container?: number | null
        internal_code: string | null
        internal_name: string | null
        product_category_rel?: { category_id: string }[]
    } | null
}

interface ProductContainerStat {
    id: string
    sku: string
    name: string
    totalBoxes: number
    boxesPerContainer: number
    containers: number
    categoryIds: string[]
    hasConfig: boolean
}

export default function ContainerStockChart() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [lots, setLots] = useState<Lot[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [showCategoryFilter, setShowCategoryFilter] = useState(false)
    const [filterMode, setFilterMode] = useState<'all' | 'configured' | 'full_cont'>('all')
    const [isExpanded, setIsExpanded] = useState(false)

    const { getBaseAmount, convertUnit, loading: conversionLoading } = useUnitConversion()

    // Fetch active lots
    const fetchData = async () => {
        if (!systemType) return
        setLoading(true)

        try {
            let allLots: Lot[] = []
            let from = 0
            const limit = 1000
            let hasMore = true

            while (hasMore) {
                const { data, error } = await supabase
                    .from('lots')
                    .select(`
                        id,
                        code,
                        status,
                        system_code,
                        product_id,
                        quantity,
                        lot_items (
                            id,
                            quantity,
                            unit,
                            product_id,
                            products (
                                id,
                                sku,
                                name,
                                unit,
                                boxes_per_container,
                                internal_code,
                                internal_name,
                                product_category_rel (category_id)
                            )
                        ),
                        products (
                            id,
                            sku,
                            name,
                            unit,
                            boxes_per_container,
                            internal_code,
                            internal_name,
                            product_category_rel (category_id)
                        )
                    `)
                    .eq('status', 'active')
                    .eq('system_code', systemType)
                    .range(from, from + limit - 1)

                if (error) throw error

                if (data && data.length > 0) {
                    allLots = [...allLots, ...data as unknown as Lot[]]
                    if (data.length < limit) {
                        hasMore = false
                    } else {
                        from += limit
                    }
                } else {
                    hasMore = false
                }
            }

            setLots(allLots)
        } catch (err: any) {
            console.error('Error fetching lots for container chart:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchCategories = async () => {
        if (!systemType) return
        const { data } = await supabase
            .from('categories')
            .select('id, name')
            .eq('system_type', systemType)
        if (data) setCategories(data)
    }

    useEffect(() => {
        if (systemType) {
            fetchData()
            fetchCategories()
        }
    }, [systemType])

    // Aggregate stock by product and calculate containers
    const processedData = useMemo(() => {
        if (conversionLoading || lots.length === 0) return []

        const aggregation = new Map<string, ProductContainerStat>()

        const processItem = (
            pid: string,
            prod: {
                id?: string
                sku: string
                name: string
                unit: string
                boxes_per_container?: number | null
                internal_code: string | null
                internal_name: string | null
                product_category_rel?: { category_id: string }[]
            },
            quantity: number,
            unit: string | null
        ) => {
            const categoryIds = prod.product_category_rel?.map(r => r.category_id) || []

            // Check Category Filter
            if (selectedCategoryIds.length > 0) {
                const hasMatch = categoryIds.some(id => selectedCategoryIds.includes(id)) ||
                    (categoryIds.length === 0 && selectedCategoryIds.includes('none'))
                if (!hasMatch) return
            }

            // Calculate number of boxes (Thùng)
            let boxCount = 0
            const unitStr = unit || prod.unit || ''
            const isDirectBox = /thùng|thung|sọt|sot|hộp|hop|bao|két/i.test(unitStr)

            if (isDirectBox) {
                boxCount = quantity || 0
            } else {
                // If in Kg or other unit, convert to Thùng
                const converted = convertUnit(pid, unitStr, 'Thùng', quantity, prod.unit)
                if (converted > 0 && converted !== quantity) {
                    boxCount = converted
                } else {
                    // Fallback to base Kg / 20 if unit is Kg
                    const baseKg = getBaseAmount(pid, unitStr, quantity, prod.unit)
                    boxCount = baseKg > 0 ? baseKg / 20 : quantity
                }
            }

            const key = pid || prod.sku
            const existing = aggregation.get(key)
            const boxesPerContainer = prod.boxes_per_container || 0

            if (existing) {
                existing.totalBoxes += boxCount
                existing.containers = boxesPerContainer > 0 ? existing.totalBoxes / boxesPerContainer : 0
            } else {
                aggregation.set(key, {
                    id: prod.id || pid,
                    sku: prod.sku,
                    name: prod.name || prod.internal_name || prod.sku,
                    totalBoxes: boxCount,
                    boxesPerContainer,
                    containers: boxesPerContainer > 0 ? boxCount / boxesPerContainer : 0,
                    categoryIds,
                    hasConfig: boxesPerContainer > 0
                })
            }
        }

        lots.forEach(lot => {
            if (lot.lot_items && lot.lot_items.length > 0) {
                (lot.lot_items as any[]).forEach(item => {
                    if (item.products && item.products.sku) {
                        processItem(item.product_id, item.products, item.quantity || 0, item.unit)
                    }
                })
            } else if (lot.products && lot.products.sku) {
                const u = lot.quantity ? (lot as any).unit || lot.products.unit : lot.products.unit
                processItem(lot.product_id || '', lot.products, lot.quantity || 0, u)
            }
        })

        let list = Array.from(aggregation.values())

        // Apply view mode filter
        if (filterMode === 'configured') {
            list = list.filter(item => item.hasConfig)
        } else if (filterMode === 'full_cont') {
            list = list.filter(item => item.hasConfig && item.containers >= 1.0)
        }

        // Sort descending by containers
        list.sort((a, b) => b.containers - a.containers)

        return list
    }, [lots, conversionLoading, selectedCategoryIds, filterMode, convertUnit, getBaseAmount])

    // KPI Metrics
    const metrics = useMemo(() => {
        let totalContainers = 0
        let totalBoxes = 0
        let fullContCount = 0
        let configuredCount = 0

        processedData.forEach(item => {
            totalBoxes += item.totalBoxes
            if (item.hasConfig) {
                configuredCount++
                totalContainers += item.containers
                if (item.containers >= 1.0) {
                    fullContCount++
                }
            }
        })

        return {
            totalContainers,
            totalBoxes,
            fullContCount,
            configuredCount,
            totalProducts: processedData.length
        }
    }, [processedData])

    // Color based on container volume readiness
    const getBarColor = (item: ProductContainerStat) => {
        if (!item.hasConfig) return '#94a3b8' // Slate for unconfigured
        if (item.containers >= 1.0) return '#10b981' // Emerald for full/more
        if (item.containers >= 0.5) return '#f59e0b' // Amber for half cont
        return '#0284c7' // Ocean blue for < 0.5 cont
    }

    if (loading || conversionLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-stone-200 h-[380px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
        )
    }

    const displayList = isExpanded ? processedData : processedData.slice(0, 8)

    return (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Truck className="text-emerald-600" size={22} />
                        <h2 className="text-xl font-bold text-stone-900 tracking-tight">
                            Ước tính Container xuất bán
                        </h2>
                    </div>
                    <p className="text-stone-500 text-xs sm:text-sm font-medium">
                        Quy đổi số lượng tồn kho sang container dựa trên định mức thùng xuất bán của từng mặt hàng
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter Button */}
                    <button
                        onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            showCategoryFilter || selectedCategoryIds.length > 0
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                    >
                        <Filter size={13} />
                        Danh mục {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
                    </button>

                    {/* Filter Mode Toggle */}
                    <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
                        <button
                            onClick={() => setFilterMode('all')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                                filterMode === 'all'
                                    ? 'bg-white text-stone-900 shadow-sm'
                                    : 'text-stone-500 hover:text-stone-900'
                            }`}
                        >
                            Tất cả
                        </button>
                        <button
                            onClick={() => setFilterMode('configured')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                                filterMode === 'configured'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-stone-500 hover:text-stone-900'
                            }`}
                        >
                            Có định mức
                        </button>
                        <button
                            onClick={() => setFilterMode('full_cont')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                                filterMode === 'full_cont'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-stone-500 hover:text-stone-900'
                            }`}
                        >
                            Đủ cont (≥1)
                        </button>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-800 transition-all"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw size={13} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Category Filter Drawer */}
            {showCategoryFilter && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                            Lọc theo danh mục sản phẩm
                        </span>
                        <button
                            onClick={() => setSelectedCategoryIds([])}
                            className="text-xs text-emerald-600 hover:underline font-bold"
                        >
                            Xóa bộ lọc
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => {
                                    setSelectedCategoryIds(prev =>
                                        prev.includes(cat.id)
                                            ? prev.filter(id => id !== cat.id)
                                            : [...prev, cat.id]
                                    )
                                }}
                                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                                    selectedCategoryIds.includes(cat.id)
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4 rounded-xl border border-emerald-200/80">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                            Tổng Cont ước tính
                        </span>
                        <Truck size={18} className="text-emerald-600" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
                        {formatQuantityFull(metrics.totalContainers, 2)}{' '}
                        <span className="text-sm font-bold text-emerald-600">Cont</span>
                    </p>
                    <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">
                        Quy đổi từ các mặt hàng đã có định mức
                    </p>
                </div>

                <div className="bg-gradient-to-br from-stone-50 to-amber-50/30 p-4 rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                            Tổng Thùng tồn kho
                        </span>
                        <Package size={18} className="text-amber-600" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-stone-800 mt-2">
                        {formatQuantityFull(metrics.totalBoxes, 0)}{' '}
                        <span className="text-sm font-bold text-stone-500">Thùng</span>
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1 font-medium">
                        Toàn bộ các lô hàng đang lưu kho
                    </p>
                </div>

                <div className="bg-gradient-to-br from-stone-50 to-sky-50/40 p-4 rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                            Đủ Cont xuất bán
                        </span>
                        <CheckCircle2 size={18} className="text-emerald-500" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-stone-800 mt-2">
                        {metrics.fullContCount}{' '}
                        <span className="text-sm font-bold text-stone-500">Mặt hàng</span>
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1 font-medium">
                        Có số tồn từ 1.0 Container trở lên
                    </p>
                </div>

                <div className="bg-gradient-to-br from-stone-50 to-indigo-50/30 p-4 rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                            Đã cấu hình định mức
                        </span>
                        <Boxes size={18} className="text-indigo-500" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-stone-800 mt-2">
                        {metrics.configuredCount}{' '}
                        <span className="text-sm font-bold text-stone-400">/ {metrics.totalProducts}</span>
                    </p>
                    <p className="text-[11px] text-stone-500 mt-1 font-medium">
                        Sản phẩm đã thiết lập thùng/cont
                    </p>
                </div>
            </div>

            {/* Chart Area */}
            {processedData.length === 0 ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-stone-400 border border-dashed border-stone-200 rounded-xl">
                    <Truck size={40} className="mb-2 opacity-40 text-stone-400" />
                    <p className="text-sm font-medium">Không có dữ liệu mặt hàng phù hợp với bộ lọc</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">
                            Biểu đồ số lượng Cont tồn kho (Top {Math.min(processedData.length, isExpanded ? processedData.length : 8)} mặt hàng)
                        </h3>
                        <div className="flex items-center gap-3 text-xs font-medium text-stone-500">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                                ≥ 1 Cont
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                                0.5 - 0.99 Cont
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block" />
                                &lt; 0.5 Cont
                            </span>
                        </div>
                    </div>

                    <div className="w-full" style={{ height: Math.max(280, displayList.length * 48) }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={displayList}
                                layout="vertical"
                                margin={{ top: 8, right: 30, left: 10, bottom: 8 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                <XAxis
                                    type="number"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                                    unit=" Cont"
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    width={220}
                                    tick={(props: any) => {
                                        const { x, y, payload } = props
                                        const text = payload.value || ''
                                        const truncated = text.length > 28 ? `${text.substring(0, 26)}...` : text
                                        return (
                                            <g transform={`translate(${x},${y})`}>
                                                <title>{text}</title>
                                                <text
                                                    x={-8}
                                                    y={4}
                                                    textAnchor="end"
                                                    fill="#334155"
                                                    fontSize={12}
                                                    fontWeight={600}
                                                >
                                                    {truncated}
                                                </text>
                                            </g>
                                        )
                                    }}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    content={({ active, payload }) => {
                                        if (!active || !payload || !payload.length) return null
                                        const data = payload[0].payload as ProductContainerStat
                                        return (
                                            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl border border-stone-200 shadow-xl max-w-sm">
                                                <p className="font-bold text-stone-900 text-sm leading-snug">
                                                    {data.name}
                                                </p>
                                                <p className="text-xs font-mono font-bold text-indigo-600 mt-1">
                                                    SKU: {data.sku}
                                                </p>
                                                <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 text-xs">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-stone-500 font-medium">Số Container ước tính:</span>
                                                        <span className="font-extrabold text-emerald-600 text-sm">
                                                            {formatQuantityFull(data.containers, 2)} Cont
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-stone-500 font-medium">Số thùng tồn kho:</span>
                                                        <span className="font-bold text-stone-800">
                                                            {formatQuantityFull(data.totalBoxes, 0)} Thùng
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-stone-500 font-medium">Định mức 1 Container:</span>
                                                        <span className={`font-bold ${data.hasConfig ? 'text-stone-800' : 'text-rose-500'}`}>
                                                            {data.hasConfig ? `${formatQuantityFull(data.boxesPerContainer, 0)} Thùng/Cont` : 'Chưa thiết lập'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    }}
                                />
                                <Bar
                                    dataKey="containers"
                                    name="Số Cont"
                                    radius={[0, 6, 6, 0]}
                                    barSize={20}
                                >
                                    {displayList.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Detailed Cards List */}
            <div className="pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-stone-800">
                        Chi tiết tiến độ gom Cont theo từng sản phẩm
                    </h3>
                    <span className="text-xs text-stone-400 font-medium">
                        Hiển thị {displayList.length} / {processedData.length} sản phẩm
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayList.map(item => {
                        const percentOfOneCont = item.boxesPerContainer > 0
                            ? Math.min(100, Math.round((item.totalBoxes / item.boxesPerContainer) * 100))
                            : 0

                        return (
                            <div
                                key={item.id}
                                className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-white hover:border-emerald-300 transition-all duration-200"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-stone-800 text-xs sm:text-sm leading-snug line-clamp-2" title={item.name}>
                                            {item.name}
                                        </p>
                                        <p className="text-[11px] font-mono font-semibold text-stone-400 mt-0.5">
                                            {item.sku}
                                        </p>
                                    </div>

                                    {item.hasConfig ? (
                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                                            item.containers >= 1.0
                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                : item.containers >= 0.5
                                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                : 'bg-sky-100 text-sky-800 border border-sky-200'
                                        }`}>
                                            {formatQuantityFull(item.containers, 2)} Cont
                                        </span>
                                    ) : (
                                        <Link
                                            href={`/products/${item.id}`}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 shrink-0"
                                            title="Bấm để cài đặt số thùng/cont cho sản phẩm này"
                                        >
                                            <AlertCircle size={11} />
                                            Chưa cài Cont
                                            <ExternalLink size={9} />
                                        </Link>
                                    )}
                                </div>

                                {/* Progress bar towards filling next/first container */}
                                {item.hasConfig ? (
                                    <div className="mt-2.5 space-y-1">
                                        <div className="flex justify-between text-[11px] font-medium text-stone-500">
                                            <span>
                                                Tồn: <strong className="text-stone-800">{formatQuantityFull(item.totalBoxes, 0)}</strong> thùng
                                            </span>
                                            <span>
                                                Định mức: <strong>{formatQuantityFull(item.boxesPerContainer, 0)}</strong> thùng/cont
                                            </span>
                                        </div>
                                        <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    item.containers >= 1.0 ? 'bg-emerald-500' : 'bg-amber-500'
                                                }`}
                                                style={{ width: `${percentOfOneCont}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 text-[11px] text-stone-500">
                                        Đang có <strong>{formatQuantityFull(item.totalBoxes, 0)}</strong> thùng trong kho nhưng chưa cấu hình định mức 1 container.
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Expand / Collapse Button */}
                {processedData.length > 8 && (
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition-all shadow-sm"
                        >
                            {isExpanded ? (
                                <>
                                    Thu gọn danh sách
                                    <ChevronUp size={14} />
                                </>
                            ) : (
                                <>
                                    Xem thêm {processedData.length - 8} sản phẩm
                                    <ChevronDown size={14} />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
