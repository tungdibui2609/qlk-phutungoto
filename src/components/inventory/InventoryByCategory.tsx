'use client'

import React, { useMemo, useState } from 'react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { ChevronDown, Loader2 } from 'lucide-react'
import { GroupedProduct } from './by-lot/types'

interface InventoryByCategoryProps {
    groupedInventory: GroupedProduct[]
    loading: boolean
    categoryMap: Record<string, string>
    displayInternalCode: boolean
    selectedCategoryIds: string[]
}

interface CategorySummary {
    name: string
    totalQuantity: number
    items: GroupedProduct[]
}

export default function InventoryByCategory({ 
    groupedInventory, 
    loading,
    categoryMap,
    displayInternalCode,
    selectedCategoryIds
}: InventoryByCategoryProps) {
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

    const categorySummaries = useMemo(() => {
        const summaries: Record<string, CategorySummary> = {}

        groupedInventory.forEach(item => {
            const catName = item.categoryId ? categoryMap[item.categoryId] || 'Chưa phân loại' : 'Chưa phân loại'
            
            if (!summaries[catName]) {
                summaries[catName] = {
                    name: catName,
                    totalQuantity: 0,
                    items: []
                }
            }
            summaries[catName].totalQuantity += item.totalQuantity
            summaries[catName].items.push(item)
        })

        return Object.values(summaries).sort((a, b) => a.name.localeCompare(b.name))
    }, [groupedInventory, categoryMap])

    const toggleExpand = (catName: string) => {
        const next = new Set(expandedCategories)
        if (next.has(catName)) next.delete(catName)
        else next.add(catName)
        setExpandedCategories(next)
    }

    if (loading) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tải dữ liệu...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 font-medium">
                        <tr>
                            <th className="px-4 py-3">Danh mục / Sản phẩm</th>
                            <th className="px-4 py-3 text-right">Tồn kho (LOT)</th>
                            <th className="px-4 py-3 text-center">ĐVT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                        {categorySummaries.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                                    Không có dữ liệu tồn kho theo danh mục.
                                </td>
                            </tr>
                        ) : (
                            categorySummaries.map((cat) => (
                                <React.Fragment key={cat.name}>
                                    <tr 
                                        className="bg-orange-50/30 dark:bg-orange-900/10 cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                                        onClick={() => toggleExpand(cat.name)}
                                    >
                                        <td className="px-4 py-3 font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                            <ChevronDown className={`w-4 h-4 transition-transform ${expandedCategories.has(cat.name) ? '' : '-rotate-90'}`} />
                                            {cat.name}
                                            <span className="text-[10px] font-normal text-stone-400 ml-1">({cat.items.length} SP)</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold tabular-nums text-stone-900 dark:text-stone-100">{formatQuantityFull(cat.totalQuantity)}</td>
                                        <td></td>
                                    </tr>
                                    {expandedCategories.has(cat.name) && cat.items.map((item, idx) => (
                                        <tr key={`${cat.name}-${idx}`} className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors border-l-4 border-l-orange-500/20">
                                            <td className="px-4 py-3 pl-8">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-stone-900 dark:text-stone-100">{item.productName}</span>
                                                    <span className="text-[10px] font-mono text-stone-400 uppercase">{item.productSku}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums font-medium text-stone-700 dark:text-stone-300">{formatQuantityFull(item.totalQuantity)}</td>
                                            <td className="px-4 py-3 text-center text-stone-400 text-xs">{item.unit}</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
