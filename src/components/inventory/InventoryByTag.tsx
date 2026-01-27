'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { Search, Loader2, Warehouse, ChevronDown, ChevronRight, Printer } from 'lucide-react'
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
        isUnconvertible?: boolean
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

export default function InventoryByTag({ units }: { units: any[] }) {
    const { systemType } = useSystem()
    const [tagItems, setTagItems] = useState<TagInvItem[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set())
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [selectedBranch, setSelectedBranch] = useState('Tất cả')
    const [branches, setBranches] = useState<{ id: string, name: string }[]>([])

    // Fetch Branches
    useEffect(() => {
        async function fetchBranches() {
            const { data, error } = await supabase
                .from('branches')
                .select('id, name, is_default')
                .order('is_default', { ascending: false })
                .order('name')

            if (error) {
                console.error('Error fetching branches:', error)
            }
            if (data) {
                setBranches(data)
                const defaultBranch = data.find(b => b.is_default)
                if (defaultBranch) {
                    setSelectedBranch(defaultBranch.name)
                }
            }
        }
        fetchBranches()
    }, [])

    // Fetch Data
    useEffect(() => {
        async function loadTagInventory() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (systemType) params.set('systemType', systemType)
                if (targetUnitId) params.set('targetUnitId', targetUnitId)
                if (selectedBranch && selectedBranch !== "Tất cả") params.set('warehouse', selectedBranch)

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
    }, [systemType, targetUnitId, selectedBranch])

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
                            unit: product.unit || tagItem.unit,
                            products: [],
                            children: []
                        }
                        nodeMap.set(currentPath, node)

                        if (parentPath === '') {
                            roots.push(node)
                        } else {
                            nodeMap.get(parentPath)?.children.push(node)
                        }
                    }

                    const node = nodeMap.get(currentPath)!
                    node.totalQuantity += product.quantity

                    // Only add product info to the leaf node
                    if (i === parts.length - 1) {
                        node.products.push(product)
                        node.isProductNode = true
                        node.productDetails = product
                    }
                }
            }
        }
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
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-end bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm mt-4">
                <div className="w-full md:w-1/2 xl:w-48">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Chi nhánh / Kho</label>
                    <div className="relative">
                        <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                        >
                            <option value="Tất cả">Tất cả chi nhánh</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center justify-between xl:justify-start gap-4 w-full xl:w-auto pt-2 xl:pt-0">
                    <div className="w-full xl:w-48">
                        <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Quy đổi đơn vị</label>
                        <div className="relative">
                            <select
                                value={targetUnitId || ''}
                                onChange={e => setTargetUnitId(e.target.value || null)}
                                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-8"
                            >
                                <option value="">Đơn vị gốc</option>
                                {units.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                        </div>
                    </div>

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
                        className="p-2 mt-6 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-md transition-all active:scale-95"
                        title="In báo cáo"
                    >
                        <Printer className="w-5 h-5" />
                    </button>
                </div>
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
    const hasChildren = node.children.length > 0 || node.isProductNode

    return (
        <>
            <tr
                className={`
                    border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors
                    ${level === 0 ? 'bg-white dark:bg-stone-900 font-semibold' : ''}
                `}
            >
                <td className="px-4 py-3">
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
                        <span className={level === 0 ? 'text-orange-600 dark:text-orange-500' : 'text-stone-700 dark:text-stone-300'}>
                            {node.name}
                        </span>
                    </div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-stone-900 dark:text-stone-100 italic">
                    {formatQuantityFull(node.totalQuantity)}
                </td>
                <td className="px-4 py-3 text-center text-stone-500 font-medium">
                    {node.unit}
                </td>
            </tr>

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
                    {node.isProductNode && node.products.map(p => (
                        <tr key={p.productCode} className="bg-stone-50/50 dark:bg-stone-800/20 border-b border-stone-100 dark:border-stone-800">
                            <td className="px-4 py-2" style={{ paddingLeft: `${(level + 1) * 20 + 24}px` }}>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-stone-500 dark:text-stone-400 bg-stone-200 dark:bg-stone-700 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                            {p.productCode}
                                        </span>
                                        <span className="text-sm text-stone-600 dark:text-stone-400 font-medium">
                                            {p.productName}
                                        </span>
                                        {p.isUnconvertible && (
                                            <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded uppercase font-bold border border-red-200">
                                                Lỗi quy đổi
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-stone-400 italic flex items-center gap-1 mt-0.5 ml-0.5">
                                        <div className="w-1 h-1 rounded-full bg-stone-300" />
                                        {p.lotCount} LOT
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-stone-600 dark:text-stone-400">
                                {formatQuantityFull(p.quantity)}
                            </td>
                            <td className="px-4 py-2 text-center text-stone-400 text-xs">
                                {p.unit}
                            </td>
                        </tr>
                    ))}
                </>
            )}
        </>
    )
}
