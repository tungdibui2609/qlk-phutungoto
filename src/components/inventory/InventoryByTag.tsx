'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, ChevronDown, Printer, Filter, X } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { canonicalizeUnit } from '@/lib/unitConversion'

// Types matching API response
interface TagInvItem {
    tag: string
    totalQuantity: number
    unit: string
    products: Array<{
        productCode: string
        productName: string
        quantity: number
        unit: string
        lotCount: number
        lotCodes?: string[]
        isUnconvertible?: boolean
    }>
}

interface UnitTotal {
    qty: number
    display: string
}

interface HierarchyNode {
    name: string
    fullPath: string
    unitTotals: Map<string, UnitTotal>
    children: HierarchyNode[]
    // Node sinh ra từ cấp SẢN PHẨM ("@") trong chuỗi mã phụ: đại diện cho CHÍNH sản phẩm đó
    isSkuLevel?: boolean
    productName?: string
    lotCodes: Set<string>
    hasUnconvertible?: boolean
}

export default function InventoryByTag({
    units,
    systemType,
    selectedBranch,
    targetUnitId,
    searchTerm,
    searchMode,
    onClearFilters
}: {
    units: any[],
    systemType: string,
    selectedBranch: string,
    targetUnitId: string | null,
    searchTerm?: string,
    searchMode?: string,
    onClearFilters?: () => void
}) {
    const [tagItems, setTagItems] = useState<TagInvItem[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

    const targetUnitName = targetUnitId ? units.find(u => u.id === targetUnitId)?.name : null
    const activeFilters = [
        selectedBranch && selectedBranch !== 'Tất cả' ? `Kho: ${selectedBranch}` : null,
        targetUnitName ? `Quy đổi: ${targetUnitName}` : null,
        searchTerm ? `Tìm kiếm: "${searchTerm}" (${searchMode === 'all' ? 'Tổng hợp' : searchMode})` : null,
    ].filter(Boolean) as string[]

    // Fetch Data
    useEffect(() => {
        async function loadTagInventory() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (systemType) params.set('systemType', systemType)
                if (targetUnitId) params.set('targetUnitId', targetUnitId)
                if (selectedBranch && selectedBranch !== "Tất cả") params.set('warehouse', selectedBranch)
                if (searchTerm) params.set('q', searchTerm)
                if (searchMode) params.set('searchMode', searchMode)

                const res = await fetch(`/api/inventory/by-tag?${params.toString()}`)
                const j = await res.json()

                if (j?.ok && Array.isArray(j.items)) {
                    setTagItems(j.items)
                } else {
                    setTagItems([])
                }
            } catch (error) {
                console.error("Failed to load tag inventory", error)
                setTagItems([])
            } finally {
                setLoading(false)
            }
        }

        if (systemType) {
            loadTagInventory()
        }
    }, [systemType, targetUnitId, selectedBranch, searchTerm, searchMode])

    // Build hierarchical tree
    const hierarchicalTags = useMemo(() => {
        const roots: HierarchyNode[] = []
        const nodeMap = new Map<string, HierarchyNode>()

        const ensureNode = (path: string, parentPath: string, isSkuLevel: boolean, name: string, productName?: string) => {
            if (!nodeMap.has(path)) {
                const node: HierarchyNode = {
                    name,
                    fullPath: path,
                    unitTotals: new Map(),
                    children: [],
                    lotCodes: new Set(),
                    isSkuLevel,
                    productName
                }
                nodeMap.set(path, node)
                if (parentPath === '') roots.push(node)
                else nodeMap.get(parentPath)?.children.push(node)
            }
            return nodeMap.get(path)!
        }

        // Cấp SẢN PHẨM: tag lớn chứa sản phẩm, và các tag phía sau là tag CON của sản phẩm đó
        const addProductLevel = (parentPath: string, product: TagInvItem['products'][0]) => {
            const sku = product.productCode || '?'
            const path = parentPath ? `${parentPath} > @::${sku}` : `@::${sku}`
            const node = ensureNode(path, parentPath, true, sku, product.productName)
            for (const code of product.lotCodes ?? []) node.lotCodes.add(code)
            if (product.isUnconvertible) node.hasUnconvertible = true
            return node
        }

        const addQuantity = (node: HierarchyNode, product: TagInvItem['products'][0], fallbackUnit: string) => {
            const display = product.unit || fallbackUnit || ''
            const key = canonicalizeUnit(display)
            const current = node.unitTotals.get(key)
            if (current) current.qty += product.quantity
            else node.unitTotals.set(key, { qty: product.quantity, display })
        }

        for (const tagItem of tagItems) {
            for (const product of tagItem.products) {
                const segments = tagItem.tag.split('>').map(p => p.trim())
                const hasSkuSegment = segments.some(s => s.includes('@'))
                let currentPath = ''

                for (const segment of segments) {
                    const parentPath = currentPath

                    let node: HierarchyNode
                    if (segment.includes('@')) {
                        node = addProductLevel(parentPath, product)
                    } else {
                        currentPath = parentPath ? `${parentPath} > ${segment}` : segment
                        node = ensureNode(currentPath, parentPath, false, segment)
                    }

                    currentPath = node.fullPath
                    addQuantity(node, product, tagItem.unit)
                }

                // Chuỗi không có "@" (ví dụ chỉ "TRUNG HÙNG") nghĩa là tag lớn chứa thẳng sản phẩm,
                // nên phải ghép về đúng cùng một dòng sản phẩm với chuỗi "TRUNG HÙNG>@>..."
                if (!hasSkuSegment) {
                    addQuantity(addProductLevel(currentPath, product), product, tagItem.unit)
                }
            }
        }

        const sortChildren = (node: HierarchyNode) => {
            node.children.sort((a, b) => {
                if (a.isSkuLevel !== b.isSkuLevel) return a.isSkuLevel ? 1 : -1
                const totalOf = (n: HierarchyNode) => Array.from(n.unitTotals.values()).reduce((s, v) => s + v.qty, 0)
                return totalOf(b) - totalOf(a) || a.name.localeCompare(b.name)
            })
            node.children.forEach(sortChildren)
        }
        roots.forEach(sortChildren)

        return roots
    }, [tagItems])

    const toggleExpand = (path: string) => {
        const newSet = new Set(expandedTags)
        if (newSet.has(path)) newSet.delete(path)
        else newSet.add(path)
        setExpandedTags(newSet)
    }

    if (loading && tagItems.length === 0) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
                    <Filter className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                        Đang thu hẹp số liệu theo:
                    </span>
                    {activeFilters.map(label => (
                        <span key={label} className="text-xs px-2 py-1 rounded bg-white dark:bg-stone-800 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-medium">
                            {label}
                        </span>
                    ))}
                    {onClearFilters && (
                        <button
                            onClick={onClearFilters}
                            className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:text-amber-950 underline underline-offset-2"
                        >
                            <X className="w-3.5 h-3.5" />
                            Hiện toàn bộ
                        </button>
                    )}
                </div>
            )}

            <div className="flex justify-end pr-4">
                <button
                    onClick={() => {
                        const params = new URLSearchParams()
                        params.set('type', 'tags')
                        if (systemType) params.set('systemType', systemType)
                        if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
                        if (targetUnitId) params.set('targetUnitId', targetUnitId)
                        params.set('to', new Date().toISOString().split('T')[0])
                        window.open(`/print/inventory?${params.toString()}`, '_blank')
                    }}
                    className="p-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-md transition-all active:scale-95 flex items-center gap-2"
                >
                    <Printer className="w-5 h-5" />
                    <span className="text-sm font-medium">In báo cáo</span>
                </button>
            </div>

            <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-stone-50 dark:bg-stone-800 font-medium text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                                <th className="px-4 py-3 min-w-[300px]">Phân loại mã phụ</th>
                                <th className="px-4 py-3 text-right">Tồn kho</th>
                                <th className="px-4 py-3 text-center">Đơn vị</th>
                            </tr>
                        </thead>
                        <tbody>
                            {hierarchicalTags.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                                        Không tìm thấy dữ liệu tồn kho theo mã phụ
                                    </td>
                                </tr>
                            ) : (
                                hierarchicalTags.map(root => (
                                    <TagTreeNode
                                        key={root.fullPath}
                                        node={root}
                                        expandedTags={expandedTags}
                                        onToggle={toggleExpand}
                                        level={0}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function TagTreeNode({ node, expandedTags, onToggle, level }: {
    node: HierarchyNode
    expandedTags: Set<string>
    onToggle: (path: string) => void
    level: number
}) {
    const isExpanded = expandedTags.has(node.fullPath)
    const hasChildren = node.children.length > 0
    const unitRows = Array.from(node.unitTotals.values())
        .sort((a, b) => b.qty - a.qty)
        .map(v => [v.display, v.qty] as [string, number])

    return (
        <>
            {unitRows.map(([unitName, unitQty], rowIdx) => (
            <tr
                key={`${node.fullPath}__${unitName}`}
                className={`
                    border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors
                    ${level === 0 ? 'bg-white dark:bg-stone-900 font-semibold' : ''}
                    ${node.isSkuLevel ? 'bg-stone-50/70 dark:bg-stone-800/30' : ''}
                `}
            >
                {rowIdx === 0 && (
                    <td className="px-4 py-3 align-middle" rowSpan={unitRows.length}>
                        <div
                            className="flex items-center gap-2 cursor-pointer select-none"
                            style={{ paddingLeft: `${level * 20}px` }}
                            onClick={() => onToggle(node.fullPath)}
                        >
                            {hasChildren ? (
                                <ChevronDown
                                    className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                                />
                            ) : (
                                <div className="w-4 h-4" />
                            )}
                            {node.isSkuLevel ? (
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            {node.name}
                                        </span>
                                        <span className="text-sm text-stone-600 dark:text-stone-400 font-medium">
                                            {node.productName}
                                        </span>
                                        {node.hasUnconvertible && (
                                            <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded uppercase font-bold border border-red-200">
                                                Lỗi quy đổi
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-stone-400 italic flex items-center gap-1 mt-0.5 ml-0.5">
                                        <div className="w-1 h-1 rounded-full bg-stone-300" />
                                        {node.lotCodes.size} LOT
                                    </span>
                                </div>
                            ) : (
                                <span className={level === 0 ? 'text-orange-600 dark:text-orange-500' : 'text-stone-700 dark:text-stone-300'}>
                                    {node.name}
                                </span>
                            )}
                            {unitRows.length > 1 && (
                                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                    {unitRows.length} đơn vị
                                </span>
                            )}
                        </div>
                    </td>
                )}
                <td className="px-4 py-3 text-right font-mono font-medium text-stone-900 dark:text-stone-100 italic">
                    {formatQuantityFull(unitQty)}
                </td>
                <td className="px-4 py-3 text-center text-stone-500 font-medium">
                    {unitName || '—'}
                </td>
            </tr>
            ))}

            {isExpanded && (
                <>
                    {node.children.map(child => (
                        <TagTreeNode
                            key={child.fullPath}
                            node={child}
                            expandedTags={expandedTags}
                            onToggle={onToggle}
                            level={level + 1}
                        />
                    ))}
                </>
            )}
        </>
    )
}
