
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Search, Loader2, Printer, ChevronRight, ChevronDown } from 'lucide-react'
import { Database } from '@/lib/database.types'
import { useSystem } from '@/contexts/SystemContext'
import { TagDisplay } from '../lots/TagDisplay'

type Lot = Database['public']['Tables']['lots']['Row'] & {
    lot_items: (Database['public']['Tables']['lot_items']['Row'] & {
        unit: string | null
        products: { name: string; unit: string; product_code?: string; sku: string; system_type: string } | null
    })[] | null
    suppliers: { name: string } | null
    positions: { code: string }[] | null
    lot_tags: { tag: string; lot_item_id: string | null }[] | null
    // Legacy support
    products: { name: string; unit: string; product_code?: string; sku: string; system_type: string } | null
}

interface GroupedProduct {
    key: string
    productSku: string
    productCode: string
    productName: string
    unit: string
    totalQuantity: number
    variants: Map<string, number> // CompositeTag -> Quantity
    lotCodes: string[]
}

export default function InventoryByLot() {
    const [lots, setLots] = useState<Lot[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const { systemType } = useSystem()
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set())

    useEffect(() => {
        fetchLots()
    }, [])

    async function fetchLots() {
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
                        name,
                        unit,
                        sku,
                        product_code:id,
                        system_type
                    )
                ),
                products (name, unit, product_code:id, sku, system_type),
                suppliers(name),
                positions(code),
                lot_tags(tag, lot_item_id)
            `)
            .eq('status', 'active')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching lots:', error)
        } else if (data) {
            // Filter by systemType in memory
            const filtered = (data as any[]).filter(lot => {
                if (systemType) {
                    // Check main product
                    if (lot.products && lot.products.system_type === systemType) return true;
                    // Check items
                    if (lot.lot_items && lot.lot_items.some((item: any) => item.products?.system_type === systemType)) return true;
                    return false;
                }
                return true;
            });
            setLots(filtered as unknown as Lot[])
        }
        setLoading(false)
    }

    const groupedInventory = useMemo(() => {
        const groups = new Map<string, GroupedProduct>()

        lots.forEach(lot => {
            // Helper to process a single item logic
            const processItem = (
                sku: string,
                name: string,
                unit: string,
                qty: number,
                itemId: string | null
            ) => {
                const key = `${sku}__${unit}`
                if (!groups.has(key)) {
                    groups.set(key, {
                        key,
                        productSku: sku,
                        productCode: sku, // Using SKU as code for display
                        productName: name,
                        unit: unit,
                        totalQuantity: 0,
                        variants: new Map(),
                        lotCodes: []
                    })
                }
                const group = groups.get(key)!
                group.totalQuantity += qty
                if (!group.lotCodes.includes(lot.code)) group.lotCodes.push(lot.code)

                // Determine Tag/Variant
                let tags: string[] = []
                if (lot.lot_tags) {
                    // Item specific tags
                    const itemTags = lot.lot_tags.filter(t => t.lot_item_id === itemId).map(t => t.tag)
                    // General tags (assume apply to all items)
                    const generalTags = lot.lot_tags.filter(t => !t.lot_item_id).map(t => t.tag)
                    tags = [...new Set([...itemTags, ...generalTags])].sort()
                }

                const compositeTag = tags.length > 0 ? tags.join('; ') : 'Không có mã phụ' // Or 'Chưa phân loại'

                // Aggregate into variant
                const currentVariantQty = group.variants.get(compositeTag) || 0
                group.variants.set(compositeTag, currentVariantQty + qty)
            }

            if (lot.lot_items && lot.lot_items.length > 0) {
                lot.lot_items.forEach(item => {
                    // Filter item by system type if needed (double check against page filter logic)
                    // Ideally we used the page logic filtered list so valid items are here.
                    if (item.products) {
                        const itemUnit = item.unit || item.products.unit
                        const qty = item.quantity || 0
                        processItem(item.products.sku, item.products.name, itemUnit, qty, item.id)
                    }
                })
            } else if (lot.products) {
                // Legacy
                processItem(lot.products.sku, lot.products.name, lot.products.unit, lot.quantity || 0, null)
            }
        })

        // Search Filter
        const searchLower = searchTerm.toLowerCase()
        const result = Array.from(groups.values()).filter(g =>
            g.productSku.toLowerCase().includes(searchLower) ||
            g.productName.toLowerCase().includes(searchLower) ||
            Array.from(g.variants.keys()).some(k => k.toLowerCase().includes(searchLower))
        )

        // Sort by SKU
        return result.sort((a, b) => a.productSku.localeCompare(b.productSku))

    }, [lots, searchTerm])


    const toggleExpand = (key: string) => {
        const newSet = new Set(expandedProducts)
        if (newSet.has(key)) newSet.delete(key)
        else newSet.add(key)
        setExpandedProducts(newSet)
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                <div className="flex-1 w-full">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Tìm kiếm</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Mã hàng, Tên hàng, Mã phụ..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                </div>
                <button
                    onClick={() => {
                        const params = new URLSearchParams()
                        params.set('type', 'lot')
                        if (systemType) params.set('systemType', systemType)
                        if (searchTerm) params.set('search', searchTerm)
                        params.set('to', new Date().toISOString().split('T')[0])
                        window.open(`/print/inventory?${params.toString()}`, '_blank')
                    }}
                    className="p-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-md bg-white dark:bg-stone-800"
                    title="In báo cáo"
                >
                    <Printer className="w-5 h-5" />
                </button>
            </div>

            {/* Table */}
            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 font-medium">
                            <tr>
                                <th className="px-4 py-3">Mã SP</th>
                                <th className="px-4 py-3">Tên sản phẩm</th>
                                <th className="px-4 py-3 text-right">Số lượng</th>
                                <th className="px-4 py-3 text-center">ĐVT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Đang tải dữ liệu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : groupedInventory.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                                        Không tìm thấy dữ liệu.
                                    </td>
                                </tr>
                            ) : (
                                groupedInventory.map((item) => {
                                    const isExpanded = expandedProducts.has(item.key)
                                    const hasVariants = item.variants.size > 0
                                    // Count distinct variant tags (excluding 'No tag' perhaps, or just count keys)
                                    const variantCount = item.variants.size

                                    return (
                                        <React.Fragment key={item.key}>
                                            <tr
                                                className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors cursor-pointer ${isExpanded ? 'bg-stone-50 dark:bg-stone-800/50' : ''}`}
                                                onClick={() => toggleExpand(item.key)}
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
                                                    {item.totalQuantity.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-center text-stone-500">{item.unit}</td>
                                            </tr>
                                            {/* Expanded Variants */}
                                            {isExpanded && (
                                                <tr className="bg-stone-50/50 dark:bg-stone-900/50">
                                                    <td colSpan={4} className="p-0">
                                                        <div className="border-t border-dashed border-stone-200 dark:border-stone-800">
                                                            {Array.from(item.variants.entries()).sort((a, b) => b[1] - a[1]).map(([tag, qty], idx) => {
                                                                // If tag is 'Không có mã phụ', maybe show it differently?
                                                                const isNoTag = tag === 'Không có mã phụ';

                                                                return (
                                                                    <div key={idx} className="flex items-center justify-between px-4 py-2 pl-12 border-b border-dashed border-stone-200 dark:border-stone-800 last:border-0 hover:bg-white dark:hover:bg-stone-900 transition-colors">
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <ChevronRight size={14} className="text-stone-400" />
                                                                            {/* If we have TagDisplay, use it? Or simple text. QLK uses styled text. */}
                                                                            {isNoTag ? (
                                                                                <span className="italic text-stone-400">{tag}</span>
                                                                            ) : (
                                                                                <TagDisplay
                                                                                    tags={[tag]}
                                                                                    placeholderMap={{ '@': item.productSku }}
                                                                                />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-4 text-sm">
                                                                            <span className="font-medium text-stone-700 dark:text-stone-300">{qty.toLocaleString()}</span>
                                                                            <span className="text-stone-500 w-8 text-center">{item.unit}</span>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="text-xs text-stone-500 text-right mt-2">
                * Dữ liệu được nhóm theo Sản phẩm và Mã phụ
            </div>
        </div>
    )
}
