
'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSystem } from '@/contexts/SystemContext'
import { Loader2 } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'

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
    }>
}

interface HierarchyNode {
    name: string
    fullPath: string
    totalQuantity: number
    unit: string
    products: TagInvItem['products']
    children: HierarchyNode[]
    isProductNode?: boolean
    productDetails?: TagInvItem['products'][0]
}

export default function InventoryByTag() {
    const { systemType } = useSystem()
    const [tagItems, setTagItems] = useState<TagInvItem[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())

    // Fetch Data
    useEffect(() => {
        async function loadTagInventory() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (systemType) params.set('systemType', systemType)

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
    }, [systemType])

    // Build hierarchical tree
    const hierarchicalTags = useMemo(() => {
        const roots: HierarchyNode[] = []
        const nodeMap = new Map<string, HierarchyNode>()

        for (const tagItem of tagItems) {
            for (const product of tagItem.products) {
                // Replace @ with productCode
                const expandedTag = tagItem.tag.replace(/@/g, product.productCode || '?')
                const parts = expandedTag.split('>').map(p => p.trim())
                let currentPath = ''

                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i]
                    const parentPath = currentPath
                    currentPath = currentPath ? `${currentPath} > ${part}` : part

                    if (!nodeMap.has(currentPath)) {
                        const node: HierarchyNode = {
                            name: part,
                            fullPath: currentPath,
                            totalQuantity: 0,
                            unit: tagItem.unit,
                            products: [],
                            children: [],
                            isProductNode: false
                        }
                        nodeMap.set(currentPath, node)

                        if (parentPath) {
                            const parent = nodeMap.get(parentPath)
                            if (parent && !parent.children.find(c => c.fullPath === currentPath)) {
                                parent.children.push(node)
                            }
                        } else {
                            if (!roots.find(r => r.fullPath === currentPath)) {
                                roots.push(node)
                            }
                        }
                    }

                    // Check if node is product level
                    const node = nodeMap.get(currentPath)
                    if (node && part === product.productCode) {
                        node.isProductNode = true
                        node.productDetails = product
                    }
                }

                // Add quantity to leaf node
                const leafNode = nodeMap.get(currentPath) // expandedTag might map to currentPath logic above?
                // Wait, currentPath at end of loop IS the full path equal to expandedTag (normalized with ' > ')

                if (leafNode) {
                    leafNode.totalQuantity += product.quantity
                    // Add product details to leaf if not exists
                    if (!leafNode.products.find(p => p.productCode === product.productCode)) {
                        leafNode.products.push(product)
                    }
                }
            }
        }

        // Aggregate totals up the tree
        function aggregateNode(node: HierarchyNode): number {
            let total = node.totalQuantity
            // If leaf node, it already has quantity summing from products loop above
            // But if it has children, we must sum children too?
            // Actually, in the loop above, we only added qty to the LEAF node of that specific path.
            // Parent nodes were initialized with 0.
            // So we strictly sum children for parents.

            // Wait, what if a tag is a subset? e.g. "A" and "A > B".
            // If we have products assigned to "A" directly, they would be added to node "A".
            // If we have products assigned to "A > B", they are added to node "B" (child of A).
            // So Total(A) = Direct(A) + Total(B).

            // My loop above: `leafNode.totalQuantity += product.quantity`
            // `leafNode` is the node corresponding to `expandedTag`.
            // So yes, direct assignment is captured.
            // Now we just need to add children totals.

            for (const child of node.children) {
                total += aggregateNode(child)
            }
            node.totalQuantity = total
            return total
        }

        roots.forEach(aggregateNode)
        return roots
    }, [tagItems])

    // Recursive Node Component
    const TagTreeNode = ({
        node,
        level,
        expandedTags,
        setExpandedTags
    }: {
        node: HierarchyNode
        level: number
        expandedTags: Set<string>
        setExpandedTags: React.Dispatch<React.SetStateAction<Set<string>>>
    }) => {
        const isExpanded = expandedTags.has(node.fullPath)
        const hasChildren = node.children.length > 0
        const hasProducts = node.products.length > 0
        const isProductNode = node.isProductNode

        const canExpand = hasChildren || hasProducts

        const toggleExpand = () => {
            if (!canExpand) return
            const newSet = new Set(expandedTags)
            if (isExpanded) newSet.delete(node.fullPath)
            else newSet.add(node.fullPath)
            setExpandedTags(newSet)
        }

        // bg colors based on level
        const bgColors = [
            'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        ]

        return (
            <div style={{ marginLeft: level * 24 }} className={level > 0 ? 'mt-2' : ''}>
                <div className={`rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden`}>
                    <div
                        onClick={toggleExpand}
                        className={`w-full px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors ${canExpand ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50' : ''}`}
                    >
                        <div className="flex items-start sm:items-center gap-3 w-full">
                            {/* Icon */}
                            <div className="mt-1 sm:mt-0 shrink-0">
                                {canExpand ? (
                                    <svg
                                        className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                ) : <span className="w-4 h-4 inline-block" />}
                            </div>

                            {isProductNode ? (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-left w-full">
                                    <div className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 shrink-0">{node.name}</div>
                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 break-words">{node.productDetails?.productName}</div>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2 w-full">
                                    <span className={`px-2.5 py-1 rounded-full text-sm font-medium ${bgColors[level % bgColors.length]}`}>
                                        {node.name}
                                    </span>
                                    {hasChildren && <span className="text-xs text-zinc-400 whitespace-nowrap">({node.children.length} nhóm con)</span>}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 pl-7 sm:pl-0 self-end sm:self-auto">
                            <span className="text-lg font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
                                {formatQuantityFull(node.totalQuantity)}
                            </span>
                            <span className="text-sm text-zinc-500">{node.unit}</span>
                        </div>
                    </div>

                    {/* Breakdown of direct products (if expanded) - only show if NOT a product node to avoid duplicate info, or if needed */}
                    {isExpanded && hasProducts && !isProductNode && (
                        <div className="border-t border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                            {node.products.map((p, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-2 pl-12 border-b border-dashed border-zinc-200 dark:border-zinc-800 last:border-0 text-sm gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-zinc-500">{p.productCode}</span>
                                        <span className="text-zinc-700 dark:text-zinc-300">{p.productName}</span>
                                    </div>
                                    <div className="flex items-center gap-4 pl-0 sm:pl-4 self-end sm:self-auto">
                                        <span className="font-medium">{formatQuantityFull(p.quantity)}</span>
                                        <span className="text-xs text-zinc-400">{p.lotCount} LOT</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Children */}
                {isExpanded && hasChildren && (
                    <div className="mt-1">
                        {node.children.map(child => (
                            <TagTreeNode
                                key={child.fullPath}
                                node={child}
                                level={level + 1}
                                expandedTags={expandedTags}
                                setExpandedTags={setExpandedTags}
                            />
                        ))}
                    </div>
                )}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                <span className="text-stone-500">Đang tải dữ liệu...</span>
            </div>
        )
    }

    if (hierarchicalTags.length === 0) {
        return (
            <div className="p-8 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl">
                <p className="text-stone-500">Không có dữ liệu tồn kho theo mã phụ</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {hierarchicalTags.map(root => (
                <TagTreeNode
                    key={root.fullPath}
                    node={root}
                    level={0}
                    expandedTags={expandedTags}
                    setExpandedTags={setExpandedTags}
                />
            ))}
        </div>
    )
}
