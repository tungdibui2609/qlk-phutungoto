'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { supabase } from '@/lib/supabaseClient'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { Loader2, RefreshCw, Settings2 } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { Database } from '@/lib/database.types'
import { formatQuantityFull } from '@/lib/numberUtils'

type LotItem = Database['public']['Tables']['lot_items']['Row'] & {
    unit: string | null
    products: {
        sku: string
        name: string
        unit: string
        internal_code: string | null
        internal_name: string | null
        product_category_rel?: { category_id: string }[]
    } | null
}

type Lot = Database['public']['Tables']['lots']['Row'] & {
    lot_items: LotItem[] | null
    // Legacy support
    products: {
        sku: string
        name: string
        unit: string
        internal_code: string | null
        internal_name: string | null
        product_category_rel?: { category_id: string }[]
    } | null
}

const COLORS = [
    '#0ea5e9', // Sky Blue
    '#f97316', // Orange
    '#10b981', // Emerald
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#84cc16', // Lime
]

export default function InventoryDistributionChart() {
    const { systemType, currentSystem, refreshSystems } = useSystem()
    const [loading, setLoading] = useState(true)
    const [lots, setLots] = useState<Lot[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[] | null>(null) // null means all
    const [showCategoryFilter, setShowCategoryFilter] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [isLegendExpanded, setIsLegendExpanded] = useState(false)
    const { getBaseAmount: toBaseAmount, getBaseToKgRate, unitNameMap, conversionMap, loading: conversionLoading } = useUnitConversion()

    // Fetch Data
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
                                sku,
                                name,
                                unit,
                                internal_code,
                                internal_name,
                                product_category_rel (category_id)
                            )
                        ),
                        products (
                            sku,
                            name,
                            unit,
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
            console.error('Error fetching inventory distribution:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const fetchCategories = async () => {
            if (!systemType) return
            const { data } = await supabase
                .from('categories')
                .select('id, name')
                .eq('system_type', systemType)
            if (data) setCategories(data)
        }

        // Load configuration from current system in Database
        const loadSystemConfig = () => {
            if (!currentSystem || !currentSystem.modules) return
            
            const modules = currentSystem.modules as any
            const dashboardConfig = modules.dashboard_config || {}
            
            if (dashboardConfig.allowed_category_ids) {
                setAllowedCategoryIds(dashboardConfig.allowed_category_ids)
            } else {
                setAllowedCategoryIds(null)
            }
        }

        if (systemType) {
            fetchData()
            fetchCategories()
            loadSystemConfig()
        }
    }, [systemType, currentSystem])

    // Save configuration to Database (systems table)
    const saveToDatabase = async (newAllowedIds: string[] | null) => {
        if (!currentSystem?.id) return

        try {
            // Get latest modules to avoid overwritting other configs
            const { data: sysData } = await (supabase
                .from('systems') as any)
                .select('modules')
                .eq('id', currentSystem.id)
                .single()
            
            const currentModules = (sysData?.modules as any) || {}
            
            const updatedModules = {
                ...currentModules,
                dashboard_config: {
                    ...currentModules.dashboard_config,
                    allowed_category_ids: newAllowedIds
                }
            }

            const { error } = await (supabase
                .from('systems') as any)
                .update({ modules: updatedModules })
                .eq('id', currentSystem.id)

            if (error) throw error
            
            // Refresh systems context to sync globally
            refreshSystems()
        } catch (error) {
            console.error('Error saving dashboard config to database:', error)
        }
    }

    const chartData = useMemo(() => {
        if (conversionLoading || lots.length === 0) return { data: [], totalWeight: 0 }

        const aggregation = new Map<string, { value: number, internalName: string | null, internalCode: string | null, sku: string }>()

        lots.forEach(lot => {
            const process = (
                pid: string,
                sku: string,
                qty: number,
                unit: string,
                baseUnit: string,
                internalName: string | null,
                internalCode: string | null,
                categoryIds: string[]
            ) => {
                // Category Filter
                if (selectedCategoryIds.length > 0) {
                    const hasMatch = categoryIds.some(id => selectedCategoryIds.includes(id)) || 
                                   (categoryIds.length === 0 && selectedCategoryIds.includes('none'))
                    if (!hasMatch) return
                }

                // Convert to KG
                const kgRate = getBaseToKgRate(pid, baseUnit)
                if (kgRate !== null) {
                    const baseQty = toBaseAmount(pid, unit, qty, baseUnit)
                    const kgQty = baseQty * kgRate

                    const key = internalCode || sku
                    const current = aggregation.get(key) || { value: 0, internalName, internalCode, sku }
                    aggregation.set(key, { 
                        ...current, 
                        value: current.value + kgQty 
                    })
                }
            }

            if (lot.lot_items && lot.lot_items.length > 0) {
                (lot.lot_items as any[]).forEach(item => {
                    if (item.products && item.products.sku) {
                        const u = item.unit || item.products.unit
                        process(
                            item.product_id, 
                            item.products.sku, 
                            item.quantity, 
                            u, 
                            item.products.unit,
                            item.products.internal_name,
                            item.products.internal_code,
                            item.products.product_category_rel?.map((r: any) => r.category_id) || []
                        )
                    }
                })
            } else if (lot.products && lot.products.sku) {
                // Legacy
                const u = lot.quantity ? (lot as any).unit || lot.products.unit : lot.products.unit
                const q = lot.quantity || 0
                if (lot.product_id) {
                    process(
                        lot.product_id, 
                        lot.products.sku, 
                        q, 
                        u, 
                        lot.products.unit,
                        lot.products.internal_name,
                        lot.products.internal_code,
                        lot.products.product_category_rel?.map((r: any) => r.category_id) || []
                    )
                }
            }
        })

        // Format for Chart
        const totalWeight = Array.from(aggregation.values()).reduce((a, b) => a + b.value, 0)

        let data = Array.from(aggregation.values()).map((item) => ({
            name: item.internalName || item.sku,
            code: item.internalCode || item.sku,
            value: item.value,
            percentage: totalWeight > 0 ? (item.value / totalWeight) * 100 : 0,
            originalSku: item.sku
        }))

        // Sort descending
        data.sort((a, b) => b.value - a.value)

        return { data, totalWeight }
    }, [lots, conversionLoading, toBaseAmount, getBaseToKgRate, unitNameMap, conversionMap])

    const { data: processedData, totalWeight } = chartData || { data: [], totalWeight: 0 }

    if (loading || conversionLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-stone-200 h-[400px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        )
    }

    if (processedData.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-stone-200 h-[400px] flex flex-col items-center justify-center text-stone-400">
                <p>Chưa có dữ liệu tồn kho (KG)</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl p-6 border border-stone-200">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-stone-800">Tỉ lệ phân bố hàng hóa tồn kho</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setShowCategoryFilter(!showCategoryFilter)
                            if (showSettings) setShowSettings(false)
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            showCategoryFilter || selectedCategoryIds.length > 0
                                ? 'bg-orange-50 border-orange-200 text-orange-600'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                    >
                        <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Danh mục {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
                    </button>
                    <button
                        onClick={() => {
                            setShowSettings(!showSettings)
                            if (showCategoryFilter) setShowCategoryFilter(false)
                        }}
                        className={`p-1.5 rounded-lg border transition-all ${
                            showSettings 
                                ? 'bg-indigo-100 border-indigo-200 text-indigo-600' 
                                : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300'
                        }`}
                        title="Cài đặt danh mục hiển thị"
                    >
                        <Settings2 size={18} />
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-stone-200 text-stone-600 hover:border-stone-300 transition-all"
                    >
                        <RefreshCw size={14} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Category selection area */}
            {showCategoryFilter && (
                <div className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Lọc theo danh mục sản phẩm</span>
                        <button 
                            onClick={() => setSelectedCategoryIds([])}
                            className="text-[10px] text-orange-600 hover:underline font-bold"
                        >
                            Xóa tất cả
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {categories
                            .filter(cat => allowedCategoryIds === null || allowedCategoryIds.includes(cat.id))
                            .map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setSelectedCategoryIds(prev => 
                                            prev.includes(cat.id) 
                                                ? prev.filter(id => id !== cat.id)
                                                : [...prev, cat.id]
                                        )
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                        selectedCategoryIds.includes(cat.id)
                                            ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                                            : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        {(allowedCategoryIds === null || allowedCategoryIds.includes('none')) && (
                            <button
                                onClick={() => {
                                    setSelectedCategoryIds(prev => 
                                        prev.includes('none') 
                                            ? prev.filter(id => id !== 'none')
                                            : [...prev, 'none']
                                    )
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    selectedCategoryIds.includes('none')
                                        ? 'bg-stone-500 border-stone-500 text-white shadow-sm'
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                }`}
                            >
                                Chưa phân loại
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Dashboard Settings area */}
            {showSettings && (
                <div className="mb-6 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-indigo-900">Cài đặt danh mục hiển thị</h3>
                            <p className="text-[10px] text-indigo-600 font-medium">Chọn những danh mục bạn muốn xuất hiện trong bộ lọc Dashboard</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    const all = categories.map(c => c.id).concat(['none'])
                                    setAllowedCategoryIds(all)
                                    saveToDatabase(all)
                                }}
                                className="text-[10px] text-indigo-600 hover:underline font-bold"
                            >
                                Chọn tất cả
                            </button>
                            <span className="text-indigo-200 text-[10px]">|</span>
                            <button 
                                onClick={() => {
                                    setAllowedCategoryIds([])
                                    saveToDatabase([])
                                }}
                                className="text-[10px] text-orange-600 hover:underline font-bold"
                            >
                                Bỏ hết
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {categories.map(cat => (
                            <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox"
                                    checked={allowedCategoryIds === null || allowedCategoryIds.includes(cat.id)}
                                    onChange={(e) => {
                                        const current = allowedCategoryIds || categories.map(c => c.id).concat(['none'])
                                        let next: string[]
                                        if (e.target.checked) {
                                            next = [...current, cat.id]
                                        } else {
                                            next = current.filter(id => id !== cat.id)
                                        }
                                        setAllowedCategoryIds(next)
                                        saveToDatabase(next)
                                    }}
                                    className="w-4 h-4 rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs text-stone-700 group-hover:text-indigo-600 transition-colors truncate">{cat.name}</span>
                            </label>
                        ))}
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="checkbox"
                                checked={allowedCategoryIds === null || allowedCategoryIds.includes('none')}
                                onChange={(e) => {
                                    const current = allowedCategoryIds || categories.map(c => c.id).concat(['none'])
                                    let next: string[]
                                    if (e.target.checked) {
                                        next = [...current, 'none']
                                    } else {
                                        next = current.filter(id => id !== 'none')
                                    }
                                    setAllowedCategoryIds(next)
                                    saveToDatabase(next)
                                }}
                                className="w-4 h-4 rounded border-stone-300 text-stone-600 focus:ring-stone-500"
                            />
                            <span className="text-xs text-stone-500 group-hover:text-stone-700 transition-colors">Chưa phân loại</span>
                        </label>
                    </div>

                    <div className="mt-5 flex justify-end">
                        <button
                            onClick={() => setShowSettings(false)}
                            className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-all"
                        >
                            Hoàn tất
                        </button>
                    </div>
                </div>
            )}

            <div className="h-[300px] w-full relative">
                {/* Center Label */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10">
                    <p className="text-sm text-stone-500 font-medium">Tổng tồn kho</p>
                    <p className="text-3xl font-bold text-emerald-600">
                        {formatQuantityFull(totalWeight, 1)}
                    </p>
                    <p className="text-sm text-stone-500 font-medium uppercase">KG</p>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={processedData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {processedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: any, name: any, props: any) => {
                                const payload = props.payload;
                                return [`${formatQuantityFull(value, 1)} KG`, payload.name]
                            }}
                            labelFormatter={(label) => `Sản phẩm: ${label}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Custom Legend */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                {(isLegendExpanded ? processedData : processedData.slice(0, 6)).map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex flex-col text-sm overflow-hidden">
                            <span className="font-bold text-stone-800 truncate" title={entry.name}>
                                {entry.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 font-mono font-black uppercase">
                                    {entry.code}
                                </span>
                                <span className="text-stone-500 text-xs whitespace-nowrap font-medium">
                                    ({formatQuantityFull(entry.percentage, 0)}%)
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {processedData.length > 6 && (
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                        className="px-6 py-1.5 rounded-full bg-stone-50 border border-stone-200 text-[10px] font-black text-orange-600 hover:bg-orange-50 transition-all uppercase tracking-widest flex items-center gap-1.5"
                    >
                        {isLegendExpanded ? 'THU GỌN CHÚ THÍCH' : `XEM THÊM (${processedData.length - 6}+ MÀU SẮC)`}
                        <svg 
                            className={`w-3 h-3 transition-transform duration-300 ${isLegendExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="mt-6 space-y-1 text-xs text-stone-500 border-t border-stone-100 pt-4">
                <p className="font-semibold text-stone-700 mb-2">Chú thích:</p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Tính theo khối lượng (Kg)</li>
                    <li>Tỉ lệ % được tính dựa trên tổng khối lượng tồn kho</li>
                    <li>Dữ liệu được cập nhật từ các lô hàng đang hoạt động</li>
                </ul>
            </div>
        </div>
    )
}
