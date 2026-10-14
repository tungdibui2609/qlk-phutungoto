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
    Cell,
    LabelList
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
    ChevronDown, 
    ChevronUp,
    ExternalLink,
    Filter,
    ArrowUpDown,
    Award
} from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { Database } from '@/lib/database.types'
import { formatQuantity } from '@/lib/numberUtils'
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

// Color palette for the bars based on volume
const COLOR_PALETTE = [
    '#059669', // Emerald
    '#0284c7', // Sky Blue
    '#d97706', // Amber
    '#7c3aed', // Violet
    '#db2777', // Pink
    '#0d9488', // Teal
    '#ea580c', // Orange
    '#4f46e5', // Indigo
]

// Helper to wrap long product names across multiple lines in SVG
function wrapText(text: string, maxCharsPerLine = 28): string[] {
    if (!text) return ['']
    const words = text.split(/\s+/)
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
        if (!currentLine) {
            currentLine = word
        } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
            currentLine += ' ' + word
        } else {
            lines.push(currentLine)
            currentLine = word
        }
    }
    if (currentLine) {
        lines.push(currentLine)
    }
    return lines.length > 0 ? lines : [text]
}

export default function ContainerStockChart() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [lots, setLots] = useState<Lot[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [showCategoryFilter, setShowCategoryFilter] = useState(false)
    const [onlyConfigured, setOnlyConfigured] = useState(false)
    const [sortBy, setSortBy] = useState<'containers' | 'boxes' | 'name'>('containers')
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

    // Aggregate stock by product and calculate exact containers
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
                    // Fallback: Kg / 20 nếu đơn vị là Kg
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

        // Filter only configured if toggled
        if (onlyConfigured) {
            list = list.filter(item => item.hasConfig)
        }

        // Sorting
        if (sortBy === 'containers') {
            list.sort((a, b) => b.containers - a.containers || b.totalBoxes - a.totalBoxes)
        } else if (sortBy === 'boxes') {
            list.sort((a, b) => b.totalBoxes - a.totalBoxes)
        } else if (sortBy === 'name') {
            list.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        }

        return list
    }, [lots, conversionLoading, selectedCategoryIds, onlyConfigured, sortBy, convertUnit, getBaseAmount])

    // KPI Metrics
    const metrics = useMemo(() => {
        let totalContainers = 0
        let totalBoxes = 0
        let configuredCount = 0
        let topProduct: ProductContainerStat | null = null

        processedData.forEach(item => {
            totalBoxes += item.totalBoxes
            if (item.hasConfig) {
                configuredCount++
                totalContainers += item.containers
                if (!topProduct || item.containers > topProduct.containers) {
                    topProduct = item
                }
            }
        })

        return {
            totalContainers,
            totalBoxes,
            topProduct,
            configuredCount,
            totalProducts: processedData.length,
            maxContainers: topProduct ? (topProduct as any).containers : 1
        }
    }, [processedData])

    if (loading || conversionLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-stone-200 h-[380px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
        )
    }

    const displayList = isExpanded ? processedData : processedData.slice(0, 10)

    return (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Truck className="text-emerald-600" size={24} />
                        <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                            Số lượng Container tồn kho theo từng mặt hàng
                        </h2>
                    </div>
                    <p className="text-stone-500 text-xs sm:text-sm font-medium">
                        Quy đổi chính xác số container tồn kho (ví dụ: 5,5 Cont, 4 Cont, 3 Cont...) theo định mức thùng xuất bán của từng sản phẩm
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Category Filter Button */}
                    <button
                        onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            showCategoryFilter || selectedCategoryIds.length > 0
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                    >
                        <Filter size={13} />
                        Danh mục {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
                    </button>

                    {/* Filter Toggle: Configured Only */}
                    <button
                        onClick={() => setOnlyConfigured(!onlyConfigured)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            onlyConfigured
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                    >
                        {onlyConfigured ? 'Đang lọc: Có định mức' : 'Tất cả sản phẩm'}
                    </button>

                    {/* Sort Selector */}
                    <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs">
                        <ArrowUpDown size={12} className="text-stone-400" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-transparent text-stone-700 font-semibold focus:outline-none cursor-pointer"
                        >
                            <option value="containers">Nhiều Cont nhất</option>
                            <option value="boxes">Nhiều Thùng nhất</option>
                            <option value="name">Tên A-Z</option>
                        </select>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all"
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
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl text-white shadow-md shadow-emerald-500/20">
                    <div className="flex items-center justify-between opacity-90">
                        <span className="text-xs font-bold uppercase tracking-wider">
                            Tổng tồn kho Cont
                        </span>
                        <Truck size={20} />
                    </div>
                    <p className="text-3xl sm:text-4xl font-black mt-2 tracking-tight">
                        {formatQuantity(metrics.totalContainers, 1)}{' '}
                        <span className="text-base font-bold opacity-90">Cont</span>
                    </p>
                    <p className="text-xs opacity-80 mt-1 font-medium">
                        Tổng cộng tất cả các mặt hàng đã có định mức
                    </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-4 rounded-2xl border border-amber-200/80">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                            Tồn nhiều Cont nhất
                        </span>
                        <Award size={20} className="text-amber-600" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-2 truncate">
                        {metrics.topProduct ? `${formatQuantity((metrics.topProduct as any).containers, 1)} Cont` : '--'}
                    </p>
                    <p className="text-xs text-amber-800/80 mt-1 font-semibold break-words leading-tight" title={metrics.topProduct ? (metrics.topProduct as any).name : ''}>
                        {metrics.topProduct ? (metrics.topProduct as any).name : 'Chưa có dữ liệu'}
                    </p>
                </div>

                <div className="bg-gradient-to-br from-stone-50 to-stone-100/60 p-4 rounded-2xl border border-stone-200">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-600 uppercase tracking-wider">
                            Tổng Thùng tồn kho
                        </span>
                        <Package size={20} className="text-stone-500" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-stone-800 mt-2">
                        {formatQuantity(metrics.totalBoxes, 0)}{' '}
                        <span className="text-sm font-bold text-stone-500">Thùng</span>
                    </p>
                    <p className="text-xs text-stone-500 mt-1 font-medium">
                        Toàn bộ các mặt hàng đang lưu trữ
                    </p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-sky-50/40 p-4 rounded-2xl border border-indigo-100">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                            Mặt hàng đã cài Cont
                        </span>
                        <Boxes size={20} className="text-indigo-600" />
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-indigo-900 mt-2">
                        {metrics.configuredCount}{' '}
                        <span className="text-sm font-bold text-indigo-500">/ {metrics.totalProducts} sp</span>
                    </p>
                    <p className="text-xs text-indigo-600 mt-1 font-medium">
                        Đã có quy cách số thùng / 1 container
                    </p>
                </div>
            </div>

            {/* Bar Chart Area */}
            {processedData.length === 0 ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-stone-400 border border-dashed border-stone-200 rounded-xl">
                    <Truck size={40} className="mb-2 opacity-40 text-stone-400" />
                    <p className="text-sm font-medium">Không có dữ liệu mặt hàng phù hợp với bộ lọc</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
                            <span>Biểu đồ số lượng Cont tồn kho</span>
                            <span className="text-xs font-normal normal-case text-stone-400">
                                (Hiển thị Top {Math.min(processedData.length, isExpanded ? processedData.length : 10)} mặt hàng)
                            </span>
                        </h3>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                            Đơn vị: Container (Cont)
                        </span>
                    </div>

                    {/* Chart Container */}
                    <div className="w-full bg-stone-50/50 p-4 rounded-2xl border border-stone-200/80 overflow-x-auto">
                        <div style={{ minWidth: 680, height: Math.max(360, displayList.length * 64) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={displayList}
                                    layout="vertical"
                                    margin={{ top: 16, right: 110, left: 10, bottom: 16 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                                    <XAxis
                                        type="number"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                                        unit=" Cont"
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        width={290}
                                        tick={(props: any) => {
                                            const { x, y, payload } = props
                                            const text = payload.value || ''
                                            const lines = wrapText(text, 28)
                                            const lineHeight = 14
                                            const startDy = -((lines.length - 1) * lineHeight) / 2

                                            return (
                                                <g transform={`translate(${x},${y})`}>
                                                    <title>{text}</title>
                                                    <text
                                                        x={-12}
                                                        y={3}
                                                        textAnchor="end"
                                                        fill="#1e293b"
                                                        fontSize={11}
                                                        fontWeight={700}
                                                    >
                                                        {lines.map((line, idx) => (
                                                            <tspan
                                                                key={idx}
                                                                x={-12}
                                                                dy={idx === 0 ? startDy : lineHeight}
                                                            >
                                                                {line}
                                                            </tspan>
                                                        ))}
                                                    </text>
                                                </g>
                                            )
                                        }}
                                    />
                                <Tooltip
                                    cursor={{ fill: '#f1f5f9' }}
                                    content={({ active, payload }) => {
                                        if (!active || !payload || !payload.length) return null
                                        const data = payload[0].payload as ProductContainerStat
                                        return (
                                            <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xl max-w-sm">
                                                <p className="font-extrabold text-stone-900 text-sm leading-snug">
                                                    {data.name}
                                                </p>
                                                <p className="text-xs font-mono font-bold text-stone-400 mt-0.5">
                                                    SKU: {data.sku}
                                                </p>
                                                <div className="mt-3 pt-3 border-t border-stone-100 space-y-2 text-xs">
                                                    <div className="flex justify-between items-center bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                                                        <span className="text-emerald-800 font-bold">Số lượng Container:</span>
                                                        <span className="font-black text-emerald-700 text-base">
                                                            {formatQuantity(data.containers, 2)} Cont
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-stone-500 font-medium">Tổng thùng tồn kho:</span>
                                                        <span className="font-bold text-stone-800 text-sm">
                                                            {formatQuantity(data.totalBoxes, 0)} Thùng
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-stone-500 font-medium">Định mức 1 Container:</span>
                                                        <span className={`font-bold ${data.hasConfig ? 'text-stone-800' : 'text-rose-500'}`}>
                                                            {data.hasConfig ? `${formatQuantity(data.boxesPerContainer, 0)} Thùng/Cont` : 'Chưa thiết lập'}
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
                                    radius={[0, 8, 8, 0]}
                                    barSize={24}
                                >
                                    <LabelList
                                        dataKey="containers"
                                        position="right"
                                        formatter={(val: any) => val > 0 ? `${formatQuantity(val, 1)} Cont` : '0 Cont'}
                                        style={{
                                            fill: '#0f172a',
                                            fontSize: '13px',
                                            fontWeight: 900
                                        }}
                                    />
                                    {displayList.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.hasConfig ? COLOR_PALETTE[index % COLOR_PALETTE.length] : '#cbd5e1'} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        )}

            {/* Detailed Cards List */}
            <div className="pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">
                        Bảng quy đổi chi tiết theo từng mặt hàng
                    </h3>
                    <span className="text-xs text-stone-500 font-medium">
                        Hiển thị {displayList.length} / {processedData.length} sản phẩm
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {displayList.map((item, idx) => {
                        // Relative percentage compared to the top product for visually balanced progress bars
                        const relativePercent = metrics.maxContainers > 0 && item.hasConfig
                            ? Math.min(100, Math.round((item.containers / metrics.maxContainers) * 100))
                            : 0

                        return (
                            <div
                                key={item.id}
                                className="p-4 rounded-2xl border border-stone-200/90 bg-white hover:border-emerald-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 font-mono">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-[11px] font-mono font-semibold text-stone-400">
                                                    {item.sku}
                                                </span>
                                            </div>
                                            <p className="font-bold text-stone-900 text-sm leading-snug break-words" title={item.name}>
                                                {item.name}
                                            </p>
                                        </div>

                                        {item.hasConfig ? (
                                            <div className="text-right shrink-0">
                                                <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-base sm:text-lg tracking-tight">
                                                    {formatQuantity(item.containers, 1)} <span className="text-xs font-bold">Cont</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <Link
                                                href={`/products/${item.id}`}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 shrink-0 transition-colors"
                                                title="Bấm để cài đặt số thùng/cont cho sản phẩm này"
                                            >
                                                <AlertCircle size={13} />
                                                Chưa cài Cont
                                                <ExternalLink size={10} />
                                            </Link>
                                        )}
                                    </div>

                                    {/* Breakdown Formula */}
                                    <div className="mt-3 pt-2.5 border-t border-stone-100">
                                        {item.hasConfig ? (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-xs text-stone-600">
                                                    <span>
                                                        Tồn: <strong className="text-stone-900 font-bold">{formatQuantity(item.totalBoxes, 0)}</strong> thùng
                                                    </span>
                                                    <span className="text-stone-400">÷</span>
                                                    <span>
                                                        Định mức: <strong className="text-stone-900 font-bold">{formatQuantity(item.boxesPerContainer, 0)}</strong> thùng/cont
                                                    </span>
                                                    <span className="text-stone-400">=</span>
                                                    <span className="font-extrabold text-emerald-700">
                                                        {formatQuantity(item.containers, 2)} Cont
                                                    </span>
                                                </div>
                                                {/* Relative volume bar across products */}
                                                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${relativePercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-stone-500 flex items-center justify-between">
                                                <span>Đang có <strong>{formatQuantity(item.totalBoxes, 0)}</strong> thùng trong kho</span>
                                                <span className="text-rose-500 text-[11px] font-semibold">Chưa có định mức cont</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Expand / Collapse Button */}
                {processedData.length > 10 && (
                    <div className="mt-5 flex justify-center">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="inline-flex items-center gap-1.5 px-6 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition-all shadow-sm"
                        >
                            {isExpanded ? (
                                <>
                                    Thu gọn danh sách
                                    <ChevronUp size={14} />
                                </>
                            ) : (
                                <>
                                    Xem thêm {processedData.length - 10} sản phẩm khác
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
