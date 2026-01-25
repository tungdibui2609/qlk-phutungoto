import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { TagDisplay } from '../lots/TagDisplay'

interface GroupedProduct {
    key: string
    productSku: string
    productCode: string
    productName: string
    unit: string
    totalQuantity: number
    variants: Map<string, number>
    lotCodes: string[]
}

interface MobileLotListProps {
    items: GroupedProduct[]
    expandedProducts: Set<string>
    toggleExpand: (key: string) => void
}

export default function MobileLotList({ items, expandedProducts, toggleExpand }: MobileLotListProps) {
    if (items.length === 0) {
        return (
            <div className="p-8 text-center text-stone-500 bg-white rounded-xl border border-stone-200">
                Không tìm thấy dữ liệu.
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {items.map((item) => {
                const isExpanded = expandedProducts.has(item.key)
                const variantKeys = Array.from(item.variants.keys())
                const hasOnlyNoTag = item.variants.size === 1 && variantKeys[0] === 'Không có mã phụ'
                const hasVariants = item.variants.size > 0 && !hasOnlyNoTag
                const variantCount = item.variants.size

                return (
                    <div
                        key={item.key}
                        className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isExpanded && hasVariants ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-stone-200'}`}
                    >
                        <div
                            className={`p-4 ${hasVariants ? 'cursor-pointer' : ''}`}
                            onClick={() => hasVariants && toggleExpand(item.key)}
                        >
                            <div className="flex justify-between items-start gap-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono text-emerald-600 font-bold text-sm">{item.productSku}</span>
                                        {hasVariants && (
                                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                                isExpanded
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                                                {variantCount} biến thể
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-stone-900 leading-tight">{item.productName}</h3>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-xl font-bold text-stone-900">{item.totalQuantity.toLocaleString()}</div>
                                    <div className="text-xs text-stone-500">{item.unit}</div>
                                </div>
                            </div>
                        </div>

                        {/* Variants Expansion */}
                        {isExpanded && hasVariants && (
                            <div className="bg-stone-50 border-t border-stone-200 divide-y divide-stone-100">
                                {Array.from(item.variants.entries())
                                    .sort((a, b) => {
                                        if (a[0] === 'Không có mã phụ') return 1;
                                        if (b[0] === 'Không có mã phụ') return -1;
                                        return b[1] - a[1];
                                    })
                                    .map(([tag, qty], idx) => {
                                        const isNoTag = tag === 'Không có mã phụ';
                                        return (
                                            <div key={`${item.key}-${idx}`} className={`p-3 pl-4 flex items-center justify-between text-sm ${isNoTag ? 'bg-amber-50/50' : ''}`}>
                                                <div className="flex-1 min-w-0 pr-3">
                                                    {isNoTag ? (
                                                        <span className="italic text-stone-400 text-xs">{item.productSku} (còn lại)</span>
                                                    ) : (
                                                        <TagDisplay tags={[tag]} placeholderMap={{ '@': item.productSku }} />
                                                    )}
                                                </div>
                                                <div className="font-medium text-stone-700 whitespace-nowrap">
                                                    {qty.toLocaleString()} <span className="text-xs text-stone-400 font-normal">{item.unit}</span>
                                                </div>
                                            </div>
                                        )
                                    })
                                }
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
