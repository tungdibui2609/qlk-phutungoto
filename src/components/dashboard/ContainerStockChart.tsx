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
    Award,
    Settings2,
    Search,
    X,
    Check
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

const DEFAULT_TOP_N = 10

// Helper to wrap long product names across multiple lines in SVG
function wrapText(text: string, maxCharsPerLine = 34): string[] {
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

class ChartErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ContainerStockChart render error:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-white rounded-2xl p-6 border border-rose-200 bg-rose-50/30">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="text-rose-500 shrink-0" size={24} />
                        <div>
                            <h3 className="text-sm font-bold text-rose-900">
                                Đã xảy ra lỗi khi hiển thị Biểu đồ Container
                            </h3>
                            <p className="text-xs text-rose-600 mt-0.5">
                                {this.state.error?.message || 'Lỗi không xác định'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
                    >
                        Thử tải lại biểu đồ
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export default function ContainerStockChart() {
    return (
        <ChartErrorBoundary>
            <ContainerStockChartInner />
        </ChartErrorBoundary>
    )
}

function ContainerStockChartInner() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [lots, setLots] = useState<Lot[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [showCategoryFilter, setShowCategoryFilter] = useState(false)
    const [onlyConfigured, setOnlyConfigured] = useState(false)
    const [sortBy, setSortBy] = useState<'containers' | 'boxes' | 'name'>('containers')
    const [isExpanded, setIsExpanded] = useState(false)
    const [pinnedIds, setPinnedIds] = useState<string[]>([])
    const [chartCategoryIds, setChartCategoryIds] = useState<string[]>([])
    const [topN, setTopN] = useState<number>(DEFAULT_TOP_N)
    const [activeChartCategoryTab, setActiveChartCategoryTab] = useState<string>('')
    const [isChartExpanded, setIsChartExpanded] = useState<boolean>(false)
    const [showPicker, setShowPicker] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')

    const [isSavingDb, setIsSavingDb] = useState(false)
    const settingsStorageKey = systemType ? `container_chart_settings_${systemType}` : null

    // Load chart settings: localStorage cache first (instant), then sync latest from Supabase
    useEffect(() => {
        if (!systemType) return

        // 1. Instant local render from cache
        if (settingsStorageKey) {
            try {
                const raw = localStorage.getItem(settingsStorageKey)
                if (raw) {
                    const s = JSON.parse(raw)
                    setPinnedIds(Array.isArray(s.pinnedIds) ? s.pinnedIds : [])
                    setChartCategoryIds(Array.isArray(s.categoryIds) ? s.categoryIds : [])
                    setTopN(Number(s.topN) > 0 ? Number(s.topN) : DEFAULT_TOP_N)
                }
            } catch {
                // ignore
            }
        }

        // 2. Fetch shared settings from Supabase database so all devices stay in sync
        const fetchDbSettings = async () => {
            try {
                const { data, error } = await (supabase.from('dashboard_chart_settings' as any) as any)
                    .select('*')
                    .eq('id', `container_chart_${systemType}`)
                    .maybeSingle()

                if (!error && data) {
                    const d = data as any
                    const pIds = Array.isArray(d.pinned_ids) ? (d.pinned_ids as string[]) : []
                    const cIds = Array.isArray(d.category_ids) ? (d.category_ids as string[]) : []
                    const tn = Number(d.top_n) > 0 ? Number(d.top_n) : DEFAULT_TOP_N

                    setPinnedIds(pIds)
                    setChartCategoryIds(cIds)
                    setTopN(tn)

                    // Keep local storage cache up to date
                    if (settingsStorageKey) {
                        localStorage.setItem(settingsStorageKey, JSON.stringify({
                            pinnedIds: pIds,
                            categoryIds: cIds,
                            topN: tn
                        }))
                    }
                }
            } catch (err) {
                console.warn('Failed to fetch chart settings from Supabase:', err)
            }
        }

        fetchDbSettings()
    }, [settingsStorageKey, systemType])

    const saveSettings = async (next: { pinnedIds?: string[]; categoryIds?: string[]; topN?: number }) => {
        const merged = {
            pinnedIds: next.pinnedIds ?? pinnedIds,
            categoryIds: next.categoryIds ?? chartCategoryIds,
            topN: next.topN ?? topN
        }
        // Immediate UI update
        setPinnedIds(merged.pinnedIds)
        setChartCategoryIds(merged.categoryIds)
        setTopN(merged.topN)

        // Cache locally for instant loading next time
        if (settingsStorageKey) {
            localStorage.setItem(settingsStorageKey, JSON.stringify(merged))
        }

        // Persist to Supabase database so all devices and computers see the same view
        if (systemType) {
            setIsSavingDb(true)
            try {
                await (supabase.from('dashboard_chart_settings' as any) as any).upsert({
                    id: `container_chart_${systemType}`,
                    system_code: systemType,
                    pinned_ids: merged.pinnedIds,
                    category_ids: merged.categoryIds,
                    top_n: merged.topN,
                    updated_at: new Date().toISOString()
                })
            } catch (err) {
                console.error('Error saving chart settings to database:', err)
            } finally {
                setIsSavingDb(false)
            }
        }
    }

    const updatePinned = (ids: string[]) => saveSettings({ pinnedIds: ids })

    const togglePinned = (id: string) => {
        updatePinned(pinnedIds.includes(id) ? pinnedIds.filter(p => p !== id) : [...pinnedIds, id])
    }

    const toggleChartCategory = (id: string) => {
        saveSettings({
            categoryIds: chartCategoryIds.includes(id)
                ? chartCategoryIds.filter(c => c !== id)
                : [...chartCategoryIds, id]
        })
    }

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
            let categoryIds: string[] = []
            if (Array.isArray(prod.product_category_rel)) {
                categoryIds = prod.product_category_rel.map((r: any) => r?.category_id).filter(Boolean)
            } else if (prod.product_category_rel && typeof prod.product_category_rel === 'object' && (prod.product_category_rel as any).category_id) {
                categoryIds = [(prod.product_category_rel as any).category_id]
            }

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

    // Configured categories list for on-chart category filter tabs (Must be before any early return)
    const configuredChartCategories = useMemo(() => {
        if (chartCategoryIds.length === 0) return []
        const list: { id: string; name: string }[] = []
        chartCategoryIds.forEach(id => {
            if (id === 'none') {
                list.push({ id: 'none', name: 'Chưa phân loại' })
            } else {
                const found = categories.find(c => c.id === id)
                if (found) list.push(found)
            }
        })
        return list
    }, [chartCategoryIds, categories])

    // Auto-select "Sầu Riêng" by default as requested
    useEffect(() => {
        if (configuredChartCategories.length > 0 && !activeChartCategoryTab) {
            const sauRieng = configuredChartCategories.find(c =>
                c.name.toLowerCase().includes('sầu riêng') ||
                c.name.toLowerCase().includes('sau rieng')
            )
            if (sauRieng) {
                setActiveChartCategoryTab(sauRieng.id)
            } else {
                setActiveChartCategoryTab(configuredChartCategories[0].id)
            }
        }
    }, [configuredChartCategories, activeChartCategoryTab])

    if (loading || conversionLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-stone-200 h-[380px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
        )
    }

    const displayList = isExpanded ? processedData : processedData.slice(0, 10)

    // Products available to the chart, limited by the chart's display categories
    const chartSource = chartCategoryIds.length > 0
        ? processedData.filter(p => {
            const cIds = Array.isArray(p.categoryIds) ? p.categoryIds : []
            return cIds.some(id => chartCategoryIds.includes(id)) ||
                (cIds.length === 0 && chartCategoryIds.includes('none'))
        })
        : processedData

    // Products configured by user (either pinned or Top N from chartSource)
    const isPinnedMode = pinnedIds.length > 0
    const userConfiguredProducts = isPinnedMode
        ? chartSource.filter(p => pinnedIds.includes(p.id))
        : chartSource.slice(0, topN)

    // Chart list filtered by active single category tab selected on the chart
    const chartList = (activeChartCategoryTab && activeChartCategoryTab !== 'all')
        ? userConfiguredProducts.filter(p => {
            const cIds = Array.isArray(p.categoryIds) ? p.categoryIds : []
            if (activeChartCategoryTab === 'none') {
                return cIds.length === 0
            }
            return cIds.includes(activeChartCategoryTab)
        })
        : userConfiguredProducts

    const CHART_PAGE_SIZE = 8
    const displayedChartList = isChartExpanded ? chartList : chartList.slice(0, CHART_PAGE_SIZE)

    const pickerKeyword = pickerSearch.trim().toLowerCase()
    const pickerList = chartSource.filter(p =>
        !pickerKeyword ||
        p.name.toLowerCase().includes(pickerKeyword) ||
        (p.sku || '').toLowerCase().includes(pickerKeyword)
    )
    const chartSettingsActive = isPinnedMode || chartCategoryIds.length > 0 || topN !== DEFAULT_TOP_N

    return (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <Truck className="text-emerald-600 shrink-0" size={18} />
                        <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                            Số lượng Container tồn kho theo từng mặt hàng
                        </h2>
                    </div>
                    <p className="text-stone-500 text-[11px] sm:text-xs">
                        Quy đổi chính xác số container tồn kho theo định mức thùng xuất bán của từng sản phẩm
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Category Filter Button */}
                    <button
                        onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                            showCategoryFilter || selectedCategoryIds.length > 0
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                    >
                        <Filter size={11} />
                        Danh mục {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
                    </button>

                    {/* Filter Toggle: Configured Only */}
                    <button
                        onClick={() => setOnlyConfigured(!onlyConfigured)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${
                            onlyConfigured
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                    >
                        {onlyConfigured ? 'Có định mức' : 'Tất cả sản phẩm'}
                    </button>

                    {/* Sort Selector */}
                    <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-md px-2 py-0.5 text-[11px]">
                        <ArrowUpDown size={11} className="text-stone-400" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-transparent text-stone-700 font-semibold focus:outline-none cursor-pointer text-[11px]"
                        >
                            <option value="containers">Nhiều Cont nhất</option>
                            <option value="boxes">Nhiều Thùng nhất</option>
                            <option value="name">Tên A-Z</option>
                        </select>
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw size={11} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Category Filter Drawer */}
            {showCategoryFilter && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                            Lọc theo danh mục sản phẩm
                        </span>
                        <button
                            onClick={() => setSelectedCategoryIds([])}
                            className="text-[11px] text-emerald-600 hover:underline font-bold"
                        >
                            Xóa bộ lọc
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
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
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
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

            {/* KPI Cards Row (Compact) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-xl text-white shadow-sm">
                    <div className="flex items-center justify-between opacity-90">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                            Tổng tồn kho Cont
                        </span>
                        <Truck size={15} />
                    </div>
                    <p className="text-xl sm:text-2xl font-black mt-1 tracking-tight">
                        {formatQuantity(metrics.totalContainers, 2)}{' '}
                        <span className="text-xs font-bold opacity-90">Cont</span>
                    </p>
                    <p className="text-[10px] opacity-80 mt-0.5 font-medium truncate">
                        Tất cả mặt hàng có định mức
                    </p>
                </div>

                <div className="bg-gradient-to-br from-amber-50 to-orange-50/40 p-3 rounded-xl border border-amber-200/80">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                            Tồn nhiều Cont nhất
                        </span>
                        <Award size={15} className="text-amber-600" />
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1 truncate">
                        {metrics.topProduct ? `${formatQuantity((metrics.topProduct as any).containers, 2)} Cont` : '--'}
                    </p>
                    <p className="text-[10px] text-amber-800/80 mt-0.5 font-semibold truncate" title={metrics.topProduct ? (metrics.topProduct as any).name : ''}>
                        {metrics.topProduct ? (metrics.topProduct as any).name : 'Chưa có dữ liệu'}
                    </p>
                </div>

                <div className="bg-gradient-to-br from-stone-50 to-stone-100/60 p-3 rounded-xl border border-stone-200">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                            Tổng Thùng tồn kho
                        </span>
                        <Package size={15} className="text-stone-500" />
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-stone-800 mt-1">
                        {formatQuantity(metrics.totalBoxes, 0)}{' '}
                        <span className="text-xs font-bold text-stone-500">Thùng</span>
                    </p>
                    <p className="text-[10px] text-stone-500 mt-0.5 font-medium truncate">
                        Toàn bộ mặt hàng đang lưu
                    </p>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-sky-50/40 p-3 rounded-xl border border-indigo-100">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">
                            Mặt hàng đã cài Cont
                        </span>
                        <Boxes size={15} className="text-indigo-600" />
                    </div>
                    <p className="text-xl sm:text-2xl font-black text-indigo-900 mt-1">
                        {metrics.configuredCount}{' '}
                        <span className="text-xs font-bold text-indigo-500">/ {metrics.totalProducts} sp</span>
                    </p>
                    <p className="text-[10px] text-indigo-600 mt-0.5 font-medium truncate">
                        Đã cài quy cách Thùng / Cont
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-stone-800 uppercase tracking-wider flex items-center gap-2">
                            <span>Biểu đồ số lượng Cont tồn kho</span>
                            <span className="text-xs font-normal normal-case text-stone-400">
                                {isPinnedMode
                                    ? `(${displayedChartList.length}${chartList.length > displayedChartList.length ? `/${chartList.length}` : ''} mặt hàng đã chọn)`
                                    : chartList.length > CHART_PAGE_SIZE && !isChartExpanded
                                        ? `(Hiển thị ${displayedChartList.length}/${chartList.length} mặt hàng)`
                                        : `(${chartList.length} mặt hàng)`}
                                {chartCategoryIds.length > 0 && ` · ${chartCategoryIds.length} danh mục`}
                            </span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPicker(!showPicker)}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border transition-all ${
                                    showPicker || chartSettingsActive
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                }`}
                                title="Cài đặt danh mục và sản phẩm hiển thị trên biểu đồ"
                            >
                                <Settings2 size={13} />
                                Cài đặt hiển thị
                            </button>
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                Đơn vị: Container (Cont)
                            </span>
                        </div>
                    </div>

                    {/* Category tabs directly on the chart (Single select mode, Tat ca at the end) */}
                    {configuredChartCategories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-stone-50/80 rounded-xl border border-stone-200/90 animate-in fade-in duration-200">
                            <span className="text-xs font-bold text-stone-600 flex items-center gap-1.5 pl-1 pr-1">
                                <Filter size={13} className="text-emerald-600" />
                                <span>Danh mục:</span>
                            </span>

                            {/* 1. Category buttons (Single Select) */}
                            {configuredChartCategories.map(cat => {
                                const isSelected = activeChartCategoryTab === cat.id
                                const count = userConfiguredProducts.filter(p => {
                                    const cIds = Array.isArray(p.categoryIds) ? p.categoryIds : []
                                    return cat.id === 'none' ? cIds.length === 0 : cIds.includes(cat.id)
                                }).length

                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => {
                                            setActiveChartCategoryTab(cat.id)
                                            setIsChartExpanded(false)
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                            isSelected
                                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                                                : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                                        }`}
                                    >
                                        <span>{cat.name}</span>
                                        <span className={`text-[11px] px-1.5 py-0.2 rounded-md font-extrabold ${
                                            isSelected
                                                ? 'bg-emerald-700 text-white'
                                                : 'bg-stone-100 text-stone-600'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                )
                            })}

                            {/* 2. Tất cả button at the END */}
                            <button
                                onClick={() => {
                                    setActiveChartCategoryTab('all')
                                    setIsChartExpanded(false)
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    activeChartCategoryTab === 'all'
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
                                        : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                                }`}
                            >
                                <span>Tất cả</span>
                                <span className={`text-[11px] px-1.5 py-0.2 rounded-md font-extrabold ${
                                    activeChartCategoryTab === 'all'
                                        ? 'bg-emerald-700 text-white'
                                        : 'bg-stone-100 text-stone-600'
                                }`}>
                                    {userConfiguredProducts.length}
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Chart Display Settings */}
                    {showPicker && (
                        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-4 animate-in fade-in duration-200">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                                        Cài đặt hiển thị biểu đồ
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold" title="Cấu hình được lưu trên database Supabase, máy nào truy cập cũng đồng bộ">
                                        <Check size={11} strokeWidth={3} />
                                        {isSavingDb ? 'Đang lưu...' : 'Lưu trên Data (đồng bộ mọi máy)'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {chartSettingsActive && (
                                        <button
                                            onClick={() => saveSettings({ pinnedIds: [], categoryIds: [], topN: DEFAULT_TOP_N })}
                                            className="text-xs text-rose-600 hover:underline font-bold"
                                        >
                                            Đặt lại mặc định
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowPicker(false)}
                                        className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* 1. Categories */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                        1. Danh mục hiển thị
                                        <span className="ml-1.5 normal-case font-medium text-stone-400">
                                            {chartCategoryIds.length === 0 ? '(tất cả)' : `(${chartCategoryIds.length} đã chọn)`}
                                        </span>
                                    </span>
                                    {chartCategoryIds.length > 0 && (
                                        <button
                                            onClick={() => saveSettings({ categoryIds: [] })}
                                            className="text-[11px] text-emerald-600 hover:underline font-bold"
                                        >
                                            Hiển thị tất cả
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {[...categories, { id: 'none', name: 'Chưa phân loại' }].map(cat => {
                                        const active = chartCategoryIds.includes(cat.id)
                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => toggleChartCategory(cat.id)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                                                    active
                                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                                }`}
                                            >
                                                {cat.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* 2. Top N */}
                            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stone-200">
                                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                    2. Số sản phẩm hiển thị (Top)
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    value={topN}
                                    disabled={isPinnedMode}
                                    onChange={(e) => {
                                        const v = parseInt(e.target.value, 10)
                                        saveSettings({ topN: Number.isFinite(v) && v > 0 ? v : 1 })
                                    }}
                                    className="w-20 h-8 px-2 text-sm text-center font-bold rounded-lg bg-white border border-stone-200 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                                />
                                {[5, 10, 20, 30].map(n => (
                                    <button
                                        key={n}
                                        disabled={isPinnedMode}
                                        onClick={() => saveSettings({ topN: n })}
                                        className={`h-8 px-2.5 rounded-lg text-xs font-bold border transition-all disabled:opacity-50 ${
                                            topN === n ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                                <button
                                    disabled={isPinnedMode}
                                    onClick={() => saveSettings({ topN: Math.max(chartSource.length, 1) })}
                                    className="h-8 px-2.5 rounded-lg text-xs font-bold border bg-white border-stone-200 text-stone-600 hover:border-stone-300 disabled:opacity-50"
                                >
                                    Tất cả ({chartSource.length})
                                </button>
                                {isPinnedMode && (
                                    <span className="text-[11px] text-amber-600 font-medium">
                                        Đang dùng danh sách sản phẩm chọn tay bên dưới
                                    </span>
                                )}
                            </div>

                            {/* 3. Hand-picked products */}
                            <div className="space-y-2 pt-3 border-t border-stone-200">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                        3. Hoặc chọn sản phẩm cụ thể
                                        <span className="ml-1.5 normal-case font-medium text-emerald-600">
                                            ({pinnedIds.length} đã chọn)
                                        </span>
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {pickerList.length > 0 && (
                                            <button
                                                onClick={() => updatePinned(Array.from(new Set([...pinnedIds, ...pickerList.map(p => p.id)])))}
                                                className="text-[11px] text-emerald-600 hover:underline font-bold"
                                            >
                                                Chọn tất cả {pickerKeyword ? 'kết quả' : ''}
                                            </button>
                                        )}
                                        {isPinnedMode && (
                                            <button
                                                onClick={() => updatePinned([])}
                                                className="text-[11px] text-rose-600 hover:underline font-bold"
                                            >
                                                Bỏ chọn (về Top {topN})
                                            </button>
                                        )}
                                    </div>
                                </div>

                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    placeholder="Tìm theo tên hoặc SKU..."
                                    className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-white border border-stone-200 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                />
                            </div>

                            <div className="max-h-64 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-1.5 pr-1">
                                {pickerList.map(p => {
                                    const checked = pinnedIds.includes(p.id)
                                    const disabled = false
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => togglePinned(p.id)}
                                            disabled={disabled}
                                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${
                                                checked
                                                    ? 'bg-emerald-50 border-emerald-300'
                                                    : 'bg-white border-stone-200 hover:border-stone-300'
                                            } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                        >
                                            <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${
                                                checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-stone-300 bg-white'
                                            }`}>
                                                {checked && <Check size={11} strokeWidth={3} />}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-xs font-semibold text-stone-800 truncate" title={p.name}>{p.name}</span>
                                                <span className="block text-[10px] font-mono text-stone-400">{p.sku}</span>
                                            </span>
                                            <span className={`text-[11px] font-bold shrink-0 ${p.hasConfig ? 'text-emerald-700' : 'text-stone-400'}`}>
                                                {p.hasConfig ? `${formatQuantity(p.containers, 1)} Cont` : 'Chưa cài'}
                                            </span>
                                        </button>
                                    )
                                })}
                                {pickerList.length === 0 && (
                                    <p className="text-xs text-stone-400 col-span-full text-center py-4">Không tìm thấy sản phẩm</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                    {/* Chart Container */}
                    {chartList.length === 0 ? (
                        <div className="h-[200px] flex flex-col items-center justify-center text-stone-400 border border-dashed border-stone-200 rounded-xl text-sm p-4 text-center">
                            <p className="font-semibold text-stone-600">Không có mặt hàng nào thuộc danh mục đang chọn</p>
                            {activeChartCategoryTab !== 'all' && (
                                <button
                                    onClick={() => setActiveChartCategoryTab('all')}
                                    className="mt-2 text-xs text-emerald-600 font-bold hover:underline"
                                >
                                    Xem tất cả ({userConfiguredProducts.length} mặt hàng)
                                </button>
                            )}
                        </div>
                    ) : (
                    <div className="w-full bg-stone-50/50 p-3 sm:p-4 rounded-2xl border border-stone-200/80 overflow-x-auto">
                        <div style={{ minWidth: 640, height: Math.max(280, displayedChartList.length * 52) }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={displayedChartList}
                                    layout="vertical"
                                    margin={{ top: 16, right: 100, left: 4, bottom: 16 }}
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
                                        width={250}
                                        tick={(props: any) => {
                                            if (!props || !props.payload) return null
                                            const { x, y, payload } = props
                                            const text = String(payload?.value || '')
                                            const lines = wrapText(text, 34)
                                            const lineHeight = 14
                                            const startDy = -((lines.length - 1) * lineHeight) / 2

                                            return (
                                                <g transform={`translate(${x || 0},${y || 0})`}>
                                                    <title>{text}</title>
                                                    <text
                                                        x={-246}
                                                        y={3}
                                                        textAnchor="start"
                                                        fill="#1e293b"
                                                        fontSize={11}
                                                        fontWeight={700}
                                                    >
                                                        {lines.map((line, idx) => (
                                                             <tspan
                                                                key={idx}
                                                                x={-246}
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
                                        const hasValidConfig = Boolean(data.hasConfig && data.boxesPerContainer && data.boxesPerContainer > 0)
                                        const fullContainers = hasValidConfig ? Math.floor((data.totalBoxes || 0) / data.boxesPerContainer + 1e-9) : 0
                                        const remainderBoxes = hasValidConfig ? Math.max(0, (data.totalBoxes || 0) - fullContainers * data.boxesPerContainer) : 0
                                        const isExact = remainderBoxes < 0.5
                                        const targetContainers = Math.max(1, Math.floor(isExact ? Math.max(fullContainers, 1) : fullContainers + 1))
                                        const missingBoxes = hasValidConfig && (!isExact || fullContainers === 0)
                                            ? Math.max(0, Math.ceil(targetContainers * data.boxesPerContainer - (data.totalBoxes || 0)))
                                            : 0

                                        return (
                                            <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xl max-w-sm">
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

                                                    {/* Missing boxes to reach next container */}
                                                    {hasValidConfig && (
                                                        <div className={`flex justify-between items-center p-2 rounded-lg border ${
                                                            missingBoxes > 0 
                                                                ? 'bg-amber-50/80 border-amber-200 text-amber-900' 
                                                                : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                                                        }`}>
                                                            <span className="font-semibold text-xs flex items-center gap-1.5">
                                                                <span className={`w-2 h-2 rounded-full shrink-0 ${missingBoxes > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                                {missingBoxes > 0 ? `Còn thiếu để đủ ${targetContainers} Cont:` : 'Đạt chuẩn:'}
                                                            </span>
                                                            <span className="font-bold text-xs">
                                                                {missingBoxes > 0 ? (
                                                                    <>
                                                                        <strong className="text-amber-700 font-black text-sm mr-1">
                                                                            {formatQuantity(missingBoxes, 0)}
                                                                        </strong>
                                                                        Thùng
                                                                    </>
                                                                ) : (
                                                                    <span className="text-emerald-700 font-black">Đã đủ chẵn {targetContainers} Cont</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
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
                                        formatter={(val: any) => val > 0 ? `${formatQuantity(val, 2)} Cont` : '0 Cont'}
                                        style={{
                                            fill: '#0f172a',
                                            fontSize: '13px',
                                            fontWeight: 900
                                        }}
                                    />
                                    {displayedChartList.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={entry.hasConfig ? COLOR_PALETTE[index % COLOR_PALETTE.length] : '#cbd5e1'} 
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Xem thêm / Thu gọn button for chart */}
                    {chartList.length > CHART_PAGE_SIZE && (
                        <div className="mt-3 flex justify-center">
                            <button
                                onClick={() => setIsChartExpanded(!isChartExpanded)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 transition-all shadow-sm border border-stone-200 hover:text-emerald-700 active:scale-95"
                            >
                                {isChartExpanded ? (
                                    <>
                                        <span>Thu gọn biểu đồ (về {CHART_PAGE_SIZE} sản phẩm)</span>
                                        <ChevronUp size={14} className="text-stone-600" />
                                    </>
                                ) : (
                                    <>
                                        <span>Xem thêm {chartList.length - CHART_PAGE_SIZE} sản phẩm khác trên biểu đồ</span>
                                        <ChevronDown size={14} className="text-stone-600" />
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
                    )}
            </div>
        )}

            {/* Detailed Cards List (Compact) */}
            <div className="pt-3 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                        Bảng quy đổi chi tiết theo từng mặt hàng
                    </h3>
                    <span className="text-[11px] text-stone-400 font-medium">
                        Hiển thị {displayList.length} / {processedData.length} sản phẩm
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {displayList.map((item, idx) => {
                        // Bar scaled to the next whole container (e.g. 13,4 Cont -> 14 Cont)
                        const hasValidConfig = Boolean(item.hasConfig && item.boxesPerContainer && item.boxesPerContainer > 0)
                        const fullContainers = hasValidConfig ? Math.floor((item.totalBoxes || 0) / item.boxesPerContainer + 1e-9) : 0
                        const remainderBoxes = hasValidConfig ? Math.max(0, (item.totalBoxes || 0) - fullContainers * item.boxesPerContainer) : 0
                        const isExact = remainderBoxes < 0.5
                        const targetContainers = Math.max(1, Math.floor(isExact ? Math.max(fullContainers, 1) : fullContainers + 1))
                        const missingBoxes = hasValidConfig && (!isExact || fullContainers === 0)
                            ? Math.max(0, Math.ceil(targetContainers * item.boxesPerContainer - (item.totalBoxes || 0)))
                            : 0
                        const totalCapacityBoxes = hasValidConfig ? targetContainers * item.boxesPerContainer : 0
                        const filledPercent = hasValidConfig && totalCapacityBoxes > 0
                            ? Math.min(100, Math.max(0, ((item.totalBoxes || 0) / totalCapacityBoxes) * 100))
                            : 0
                        const showDividers = hasValidConfig && Number.isInteger(targetContainers) && targetContainers > 1 && targetContainers <= 40

                        return (
                            <div
                                key={item.id}
                                className="p-2.5 sm:p-3 rounded-xl border border-stone-200/90 bg-white hover:border-emerald-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-mono">
                                                    #{idx + 1}
                                                </span>
                                                <span className="text-[10px] font-mono font-semibold text-stone-400">
                                                    {item.sku}
                                                </span>
                                            </div>
                                            <p className="font-bold text-stone-900 text-xs leading-snug truncate" title={item.name}>
                                                {item.name}
                                            </p>
                                        </div>

                                        {item.hasConfig ? (
                                            <div className="text-right shrink-0">
                                                <div className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-black text-xs sm:text-sm tracking-tight">
                                                    {formatQuantity(item.containers, 2)} <span className="text-[10px] font-bold">Cont</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <Link
                                                href={`/products/${item.id}`}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 shrink-0 transition-colors"
                                                title="Bấm để cài đặt số thùng/cont cho sản phẩm này"
                                            >
                                                <AlertCircle size={11} />
                                                Chưa cài Cont
                                                <ExternalLink size={9} />
                                            </Link>
                                        )}
                                    </div>

                                    {/* Breakdown Formula */}
                                    <div className="mt-2 pt-1.5 border-t border-stone-100">
                                        {item.hasConfig ? (
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px] text-stone-600">
                                                    <span>
                                                        Tồn: <strong className="text-stone-900 font-bold">{formatQuantity(item.totalBoxes, 0)}</strong> thùng
                                                    </span>
                                                    <span className="text-stone-300">÷</span>
                                                    <span>
                                                        Định mức: <strong className="text-stone-900 font-bold">{formatQuantity(item.boxesPerContainer, 0)}</strong>/cont
                                                    </span>
                                                    <span className="text-stone-300">=</span>
                                                    <span className="font-extrabold text-emerald-700">
                                                        {formatQuantity(item.containers, 2)} Cont
                                                    </span>
                                                </div>
                                                {/* Progress toward the next whole container */}
                                                <div className="pt-0.5">
                                                    <div className="relative w-full h-1.5 bg-amber-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="absolute inset-y-0 left-0 bg-emerald-500 transition-all duration-500"
                                                            style={{ width: `${filledPercent}%` }}
                                                        />
                                                        {showDividers && Array.from({ length: targetContainers - 1 }).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className="absolute inset-y-0 w-px bg-white/70"
                                                                style={{ left: `${((i + 1) / targetContainers) * 100}%` }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5 text-[10px]">
                                                        {missingBoxes > 0 ? (
                                                            <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                                Thiếu <strong className="font-extrabold">{formatQuantity(missingBoxes, 0)}</strong> thùng để đủ {targetContainers} Cont
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                                                <Check size={11} strokeWidth={3} />
                                                                Đủ chẵn {targetContainers} Cont
                                                            </span>
                                                        )}
                                                        <span className="font-bold text-stone-400">{targetContainers} Cont</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-[11px] text-stone-500 flex items-center justify-between">
                                                <span>Đang có <strong>{formatQuantity(item.totalBoxes, 0)}</strong> thùng trong kho</span>
                                                <span className="text-rose-500 text-[10px] font-semibold">Chưa có định mức cont</span>
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
                    <div className="mt-3.5 flex justify-center">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full bg-stone-100 hover:bg-stone-200 text-[11px] font-bold text-stone-700 transition-all shadow-sm"
                        >
                            {isExpanded ? (
                                <>
                                    Thu gọn danh sách
                                    <ChevronUp size={13} />
                                </>
                            ) : (
                                <>
                                    Xem thêm {processedData.length - 10} sản phẩm khác
                                    <ChevronDown size={13} />
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
