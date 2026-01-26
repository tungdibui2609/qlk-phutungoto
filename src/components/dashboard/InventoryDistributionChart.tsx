'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { supabase } from '@/lib/supabaseClient'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { Loader2, RefreshCw } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { Database } from '@/lib/database.types'

type LotItem = Database['public']['Tables']['lot_items']['Row'] & {
    unit: string | null
    products: {
        sku: string
        name: string
        unit: string
    } | null
}

type Lot = Database['public']['Tables']['lots']['Row'] & {
    lot_items: LotItem[] | null
    // Legacy support
    products: {
        sku: string
        name: string
        unit: string
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
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [lots, setLots] = useState<Lot[]>([])
    const { toBaseAmount, getBaseToKgRate, unitNameMap, conversionMap, loading: conversionLoading } = useUnitConversion()

    // Fetch Data
    const fetchData = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('lots')
            .select(`
                *,
                lot_items (
                    id,
                    quantity,
                    unit,
                    product_id,
                    products (
                        sku,
                        name,
                        unit
                    )
                ),
                products (
                    sku,
                    name,
                    unit
                )
            `)
            .eq('status', 'active')
            .eq('system_code', systemType)

        if (data) {
            setLots(data as unknown as Lot[])
        }
        setLoading(false)
    }

    useEffect(() => {
        if (systemType) {
            fetchData()
        }
    }, [systemType])

    const chartData = useMemo(() => {
        if (conversionLoading || lots.length === 0) return { data: [], totalWeight: 0 }

        const aggregation = new Map<string, number>()

        lots.forEach(lot => {
            const process = (
                pid: string,
                sku: string,
                qty: number,
                unit: string,
                baseUnit: string
            ) => {
                // Convert to KG
                const kgRate = getBaseToKgRate(pid, baseUnit)
                if (kgRate !== null) {
                    const baseQty = toBaseAmount(pid, unit, qty, baseUnit)
                    const kgQty = baseQty * kgRate

                    const current = aggregation.get(sku) || 0
                    aggregation.set(sku, current + kgQty)
                }
            }

            if (lot.lot_items && lot.lot_items.length > 0) {
                lot.lot_items.forEach(item => {
                    if (item.products && item.products.sku) {
                        const u = item.unit || item.products.unit
                        process(item.product_id, item.products.sku, item.quantity, u, item.products.unit)
                    }
                })
            } else if (lot.products && lot.products.sku) {
                // Legacy
                const u = lot.quantity ? (lot as any).unit || lot.products.unit : lot.products.unit // Assuming unit on lot if quantity exists
                // Note: The 'lots' table doesn't strictly have a 'unit' column in types, but legacy might imply it matches product or is implicit.
                // Let's rely on product unit if undefined.
                const q = lot.quantity || 0
                if (lot.product_id) {
                    process(lot.product_id, lot.products.sku, q, u, lot.products.unit)
                }
            }
        })

        // Format for Chart
        const totalWeight = Array.from(aggregation.values()).reduce((a, b) => a + b, 0)

        let data = Array.from(aggregation.entries()).map(([name, value]) => ({
            name,
            value,
            percentage: totalWeight > 0 ? (value / totalWeight) * 100 : 0
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
                <button
                    onClick={fetchData}
                    className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
                >
                    <RefreshCw size={14} />
                    Làm mới
                </button>
            </div>

            <div className="h-[300px] w-full relative">
                {/* Center Label */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10">
                    <p className="text-sm text-stone-500 font-medium">Tổng tồn kho</p>
                    <p className="text-3xl font-bold text-emerald-600">
                        {totalWeight.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}
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
                            formatter={(value: any) => [`${Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} KG`, 'Khối lượng']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Custom Legend */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                {processedData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="flex items-baseline gap-1 text-sm overflow-hidden">
                            <span className="font-medium text-stone-700 truncate max-w-[100px]" title={entry.name}>
                                {entry.name}
                            </span>
                            <span className="text-stone-500 text-xs whitespace-nowrap">
                                ({entry.percentage.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%)
                            </span>
                        </div>
                    </div>
                ))}
            </div>

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
