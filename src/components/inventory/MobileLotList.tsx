import { useState } from 'react'
import { ChevronDown, ChevronRight, Tags } from 'lucide-react'
import { TagDisplay } from '../lots/TagDisplay'
import { formatQuantityFull } from '@/lib/numberUtils'

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
    const [expandedLsx, setExpandedLsx] = useState<Set<string>>(new Set())

    const toggleLsxExpand = (lsxKey: string) => {
        setExpandedLsx(prev => {
            const next = new Set(prev)
            if (next.has(lsxKey)) next.delete(lsxKey)
            else next.add(lsxKey)
            return next
        })
    }

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
                                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${isExpanded
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
                                    <div className="text-xl font-bold text-stone-900">{formatQuantityFull(item.totalQuantity)}</div>
                                    <div className="text-xs text-stone-500">{item.unit}</div>
                                </div>
                            </div>
                        </div>

                        {/* Variants Expansion */}
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
                                    <div key={lsxKey} 
                                        className="bg-orange-50/50 hover:bg-orange-100/50 border-l-[3px] border-orange-400 cursor-pointer overflow-hidden"
                                        onClick={(e) => { e.stopPropagation(); toggleLsxExpand(lsxKey); }}
                                    >
                                        <div className="px-3 py-2.5 flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2 font-bold text-orange-800 flex-1 min-w-0 pr-2">
                                                {isLsxExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
                                                <TagDisplay tags={[lsxName]} />
                                            </div>
                                            <div className="font-bold text-orange-700 whitespace-nowrap">
                                                {formatQuantityFull(group.totalQty)} <span className="text-xs text-orange-400 font-normal">{item.unit}</span>
                                            </div>
                                        </div>
                                        {isLsxExpanded && (
                                            <div className="bg-stone-50 border-t border-orange-100/50 divide-y divide-stone-100">
                                                {group.items.sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty)).map((subItem, sIdx) => {
                                                    const isNoTag = subItem.tag === 'Không có mã phụ'
                                                    return (
                                                        <div key={`${lsxKey}-sub-${sIdx}`} className="p-2.5 pl-9 flex items-center justify-between text-xs bg-white/50">
                                                            <div className="flex-1 min-w-0 pr-3 flex items-center gap-1.5">
                                                                <ChevronRight size={12} className="text-stone-300" />
                                                                {isNoTag ? (
                                                                    <span className="italic text-stone-400">Không có mã phụ</span>
                                                                ) : (
                                                                    <TagDisplay tags={[subItem.tag]} placeholderMap={{ '@': item.productSku }} />
                                                                )}
                                                            </div>
                                                            <div className="font-medium text-stone-700 whitespace-nowrap">
                                                                {formatQuantityFull(subItem.qty)} <span className="text-[10px] text-stone-400 font-normal">{item.unit}</span>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })

                            if (nonLsxItems.length > 0) {
                                rows.push(
                                    <div key={`${item.key}-nonlsx`} className="divide-y divide-stone-100">
                                        {nonLsxItems.sort((a, b) => (a.tag === 'Không có mã phụ' ? 1 : b.tag === 'Không có mã phụ' ? -1 : b.qty - a.qty)).map((subItem, sIdx) => {
                                            const isNoTag = subItem.tag === 'Không có mã phụ'
                                            return (
                                                <div key={`${item.key}-nonlsx-${sIdx}`} className={`p-3 pl-4 flex items-center justify-between text-sm ${isNoTag ? 'bg-amber-50/50 border-l-2 border-amber-400' : ''}`}>
                                                    <div className="flex-1 min-w-0 pr-3 flex items-center gap-2">
                                                        <ChevronRight size={14} className="text-stone-300" />
                                                        {isNoTag ? (
                                                            <span className="italic text-stone-400 text-xs text-amber-700/70">Gốc (còn lại)</span>
                                                        ) : (
                                                            <TagDisplay tags={[subItem.tag]} placeholderMap={{ '@': item.productSku }} />
                                                        )}
                                                    </div>
                                                    <div className="font-medium text-stone-700 whitespace-nowrap">
                                                        {formatQuantityFull(subItem.qty)} <span className="text-xs text-stone-400 font-normal">{item.unit}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            }

                            return <div className="bg-stone-50 border-t border-stone-200">{rows}</div>
                        })()}
                    </div>
                )
            })}
        </div>
    )
}
