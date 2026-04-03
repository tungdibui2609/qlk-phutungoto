import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { GroupedProduct } from './types'

interface InventoryTableProps {
    groupedInventory: GroupedProduct[]
    expandedProducts: Set<string>
    toggleExpand: (key: string) => void
    loading: boolean
}

export function InventoryTable({
    groupedInventory,
    expandedProducts,
    toggleExpand,
    loading
}: InventoryTableProps) {
    const [expandedLsx, setExpandedLsx] = useState<Set<string>>(new Set())

    const toggleLsxExpand = (lsxKey: string) => {
        setExpandedLsx(prev => {
            const next = new Set(prev)
            if (next.has(lsxKey)) next.delete(lsxKey)
            else next.add(lsxKey)
            return next
        })
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

    // Check if any product with variants is currently expanded
    const hasAnyExpanded = groupedInventory.some(item => {
        const variantKeys = Array.from(item.variants.keys())
        const hasOnlyNoTag = item.variants.size === 1 && variantKeys[0] === 'Không có mã phụ'
        const hasVariants = item.variants.size > 0 && !hasOnlyNoTag
        return expandedProducts.has(item.key) && hasVariants
    })
    const columnCount = hasAnyExpanded ? 5 : 4

    return (
        <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 font-medium">
                        <tr>
                            <th className="px-4 py-3">Mã SP</th>
                            <th className="px-4 py-3">Tên sản phẩm</th>
                            <th className="px-4 py-3 text-right">Số lượng</th>
                            {hasAnyExpanded && <th className="px-4 py-3 text-right w-28">SL chi tiết</th>}
                            <th className="px-4 py-3 text-center w-20">ĐVT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                        {groupedInventory.length === 0 ? (
                            <tr>
                                <td colSpan={columnCount} className="px-4 py-8 text-center text-stone-500">
                                    Không tìm thấy dữ liệu.
                                </td>
                            </tr>
                        ) : (
                            groupedInventory.map((item) => {
                                const isExpanded = expandedProducts.has(item.key)
                                // Check if product has meaningful variants (not just "Không có mã phụ")
                                const variantKeys = Array.from(item.variants.keys())
                                const hasOnlyNoTag = item.variants.size === 1 && variantKeys[0] === 'Không có mã phụ'
                                const hasVariants = item.variants.size > 0 && !hasOnlyNoTag
                                const variantCount = item.variants.size

                                return (
                                    <React.Fragment key={item.key}>
                                        <tr
                                            className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${hasVariants ? 'cursor-pointer' : ''} ${isExpanded && hasVariants ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-2 border-emerald-500' : ''}`}
                                            onClick={() => hasVariants && toggleExpand(item.key)}
                                        >
                                            <td className="px-4 py-3 font-mono text-emerald-600 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {item.productSku}
                                                    {hasVariants && (
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition ${isExpanded
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                }`}
                                                        >
                                                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                            {variantCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{item.productName}</td>
                                            <td className="px-4 py-3 text-right font-bold text-stone-900 dark:text-stone-100">
                                                {formatQuantityFull(item.totalQuantity)}
                                            </td>
                                            {hasAnyExpanded && (
                                                <td className="px-4 py-3 text-right font-medium text-stone-700 dark:text-stone-300">
                                                    {isExpanded && hasVariants ? formatQuantityFull(item.totalQuantity) : '—'}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-center text-stone-500">{item.unit}</td>
                                        </tr>
                                        {/* Expanded Variants */}
                                        {isExpanded && hasVariants && (() => {
                                            const lsxGroups = new Map<string, { totalQty: number, items: { tag: string, qty: number }[] }>()
                                            const nonLsxItems: { tag: string, qty: number }[] = []

                                            Array.from(item.variants.entries()).forEach(([tagStr, qty]) => {
                                                if (tagStr.includes('LSX: ')) {
                                                    const parts = tagStr.split('; ').map(p => p.trim())
                                                    const lsxPart = parts.find(p => p.startsWith('LSX: '))
                                                    if (lsxPart) {
                                                        const otherParts = parts.filter(p => !p.startsWith('LSX: '))
                                                        const subTags = otherParts.length > 0 ? otherParts.join('; ') : 'Không có mã phụ'
                                                        if (!lsxGroups.has(lsxPart)) {
                                                            lsxGroups.set(lsxPart, { totalQty: 0, items: [] })
                                                        }
                                                        const group = lsxGroups.get(lsxPart)!
                                                        group.totalQty += qty
                                                        group.items.push({ tag: subTags, qty })
                                                        return
                                                    }
                                                }
                                                nonLsxItems.push({ tag: tagStr, qty })
                                            })

                                            const rows: React.ReactNode[] = []

                                            Array.from(lsxGroups.entries()).sort((a, b) => b[1].totalQty - a[1].totalQty).forEach(([lsxName, group], idx) => {
                                                const lsxKey = `${item.key}-${lsxName}`
                                                const isLsxExpanded = expandedLsx.has(lsxKey)

                                                rows.push(
                                                    <tr key={lsxKey} 
                                                        className="bg-orange-50/40 hover:bg-orange-100/50 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 transition-colors cursor-pointer border-l-2 border-orange-400"
                                                        onClick={(e) => { e.stopPropagation(); toggleLsxExpand(lsxKey); }}
                                                    >
                                                        <td className="px-4 py-2 pl-10" colSpan={2}>
                                                            <div className="flex items-center gap-2 text-sm font-bold text-orange-800 dark:text-orange-400">
                                                                {isLsxExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                <TagDisplay tags={[lsxName]} />
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-stone-400">—</td>
                                                        <td className="px-4 py-2 text-right font-bold text-orange-700 dark:text-orange-300">
                                                            {formatQuantityFull(group.totalQty)}
                                                        </td>
                                                        <td className="px-4 py-2 text-center text-stone-500">{item.unit}</td>
                                                    </tr>
                                                )

                                                if (isLsxExpanded) {
                                                    group.items.sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty)).forEach((subItem, sIdx) => {
                                                        const isNoTag = subItem.tag === 'Không có mã phụ'
                                                        rows.push(
                                                            <tr key={`${lsxKey}-sub-${sIdx}`} className="bg-stone-50/50 dark:bg-stone-900/50 transition-colors hover:bg-stone-100/50 dark:hover:bg-stone-800/50 border-l border-orange-200 dark:border-orange-900/30">
                                                                <td className="px-4 py-2 pl-16" colSpan={2}>
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <ChevronRight size={14} className="text-stone-300" />
                                                                        {isNoTag ? (
                                                                            <span className="italic text-stone-400">Không có mã phụ</span>
                                                                        ) : (
                                                                            <TagDisplay tags={[subItem.tag]} placeholderMap={{ '@': item.productSku }} />
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2 text-right text-stone-400">—</td>
                                                                <td className="px-4 py-2 text-right font-medium text-stone-700 dark:text-stone-300">
                                                                    {formatQuantityFull(subItem.qty)}
                                                                </td>
                                                                <td className="px-4 py-2 text-center text-stone-500">{item.unit}</td>
                                                            </tr>
                                                        )
                                                    })
                                                }
                                            })

                                            nonLsxItems.sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty)).forEach((subItem, sIdx) => {
                                                const isNoTag = subItem.tag === 'Không có mã phụ'
                                                rows.push(
                                                    <tr key={`${item.key}-nonlsx-${sIdx}`} className={`transition-colors ${isNoTag ? 'bg-amber-50 dark:bg-amber-900/20 border-l-2 border-amber-400' : 'bg-stone-50/50 dark:bg-stone-900/50 hover:bg-stone-100/50 dark:hover:bg-stone-800/50'}`}>
                                                        <td className="px-4 py-2 pl-10" colSpan={2}>
                                                            <div className="flex items-center gap-2 text-sm">
                                                                <ChevronRight size={14} className="text-stone-400" />
                                                                {isNoTag ? (
                                                                    <span className="italic text-stone-400">Gốc ( còn lại )</span>
                                                                ) : (
                                                                    <TagDisplay tags={[subItem.tag]} placeholderMap={{ '@': item.productSku }} />
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2 text-right text-stone-400">—</td>
                                                        <td className="px-4 py-2 text-right font-medium text-stone-700 dark:text-stone-300">
                                                            {formatQuantityFull(subItem.qty)}
                                                        </td>
                                                        <td className="px-4 py-2 text-center text-stone-500">{item.unit}</td>
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
            </div>
            <div className="text-xs text-stone-500 text-right mt-2 p-2">
                * Dữ liệu được nhóm theo Sản phẩm và Mã phụ
            </div>
        </div>
    )
}
