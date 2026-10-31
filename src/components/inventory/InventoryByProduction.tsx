'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Loader2, ChevronDown, Filter, X } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'
import { canonicalizeUnit } from '@/lib/unitConversion'

interface ProductRow {
    productCode: string
    productName: string
    quantity: number
    unit: string
    lotCodes: string[]
    isUnconvertible?: boolean
}

interface LotNode {
    lotCode: string
    productionDate: string | null
    products: ProductRow[]
}

interface OrderNode {
    orderCode: string
    orderName: string | null
    lots: LotNode[]
}

const NO_ORDER = 'Chưa gắn lệnh SX'
const NO_LOT = 'Không có mã lot SX'

interface Rollup {
    unitEntries: [string, number][]
    palletCount: number
    hasUnconvertible: boolean
}

// Không bao giờ cộng dồn khác đơn vị: mỗi đơn vị là một dòng riêng.
// Chốt theo dạng chuẩn hóa để "Thùng (20kg)" và "Thùng (20 Kg)" không tách làm hai dòng.
const rollupProducts = (products: ProductRow[]): Rollup => {
    const totals = new Map<string, { qty: number; display: string }>()
    const pallets = new Set<string>()
    let hasUnconvertible = false

    products.forEach(p => {
        const key = canonicalizeUnit(p.unit)
        const current = totals.get(key)
        if (current) current.qty += p.quantity
        else totals.set(key, { qty: p.quantity, display: p.unit || '' })
        p.lotCodes.forEach(c => pallets.add(c))
        if (p.isUnconvertible) hasUnconvertible = true
    })

    return {
        unitEntries: Array.from(totals.values())
            .map(v => [v.display, v.qty] as [string, number])
            .sort((a, b) => b[1] - a[1]),
        palletCount: pallets.size,
        hasUnconvertible
    }
}

export default function InventoryByProduction({
    systemType,
    selectedBranch,
    targetUnitId,
    units,
    searchTerm,
    searchMode,
    onClearFilters
}: {
    systemType: string,
    selectedBranch: string,
    targetUnitId: string | null,
    units: any[],
    searchTerm?: string,
    searchMode?: string,
    onClearFilters?: () => void
}) {
    const [orders, setOrders] = useState<OrderNode[]>([])
    const [loading, setLoading] = useState(false)
    const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())
    const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set())

    const targetUnitName = targetUnitId ? units.find(u => u.id === targetUnitId)?.name : null
    const activeFilters = [
        selectedBranch && selectedBranch !== 'Tất cả' ? `Kho: ${selectedBranch}` : null,
        targetUnitName ? `Quy đổi: ${targetUnitName}` : null,
        searchTerm ? `Tìm kiếm: "${searchTerm}" (${searchMode === 'all' ? 'Tổng hợp' : searchMode})` : null,
    ].filter(Boolean) as string[]

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (systemType) params.set('systemType', systemType)
                if (targetUnitId) params.set('targetUnitId', targetUnitId)
                if (selectedBranch && selectedBranch !== "Tất cả") params.set('warehouse', selectedBranch)
                if (searchTerm) params.set('q', searchTerm)
                if (searchMode) params.set('searchMode', searchMode)

                const res = await fetch(`/api/inventory/by-production?${params.toString()}`)
                const j = await res.json()
                setOrders(j?.ok && Array.isArray(j.items) ? j.items : [])
            } catch (error) {
                console.error("Failed to load production inventory", error)
                setOrders([])
            } finally {
                setLoading(false)
            }
        }

        if (systemType) load()
    }, [systemType, targetUnitId, selectedBranch, searchTerm, searchMode])

    const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => {
        setter(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const orderRollups = useMemo(() => orders.map(order => ({
        order,
        rollup: rollupProducts(order.lots.flatMap(l => l.products)),
        lotRollups: order.lots.map(lot => ({ lot, rollup: rollupProducts(lot.products) }))
    })), [orders])

    const linkedOrders = orderRollups.filter(o => o.order.orderCode !== NO_ORDER).length

    if (loading && orders.length === 0) {
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

            <div className="px-1 text-xs text-stone-500 dark:text-stone-400">
                <span className="font-semibold text-stone-700 dark:text-stone-300">{linkedOrders}</span> lệnh sản xuất có tồn kho.
                Số pallet chưa liên kết lệnh nằm ở nhóm <span className="italic">"{NO_ORDER}"</span> để đối chiếu được khớp với tab Tồn kho theo LOT.
            </div>

            <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-stone-50 dark:bg-stone-800 font-medium text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                                <th className="px-4 py-3 min-w-[300px]">Lệnh sản xuất › Mã lot SX › Sản phẩm</th>
                                <th className="px-4 py-3 text-right">Tồn kho</th>
                                <th className="px-4 py-3 text-center">Đơn vị</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orderRollups.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8 text-center text-stone-500">
                                        Không tìm thấy dữ liệu tồn kho theo lệnh sản xuất
                                    </td>
                                </tr>
                            ) : (
                                orderRollups.map(({ order, rollup, lotRollups }) => {
                                    const isOrderOpen = expandedOrders.has(order.orderCode)
                                    return (
                                        <React.Fragment key={order.orderCode}>
                                            <NodeRows
                                                level={0}
                                                rollup={rollup}
                                                hasChildren={order.lots.length > 0}
                                                isExpanded={isOrderOpen}
                                                onToggle={() => toggle(setExpandedOrders, order.orderCode)}
                                                label={
                                                    <div className="flex flex-col">
                                                        <span className={`font-semibold ${order.orderCode === NO_ORDER ? 'text-stone-400 italic' : 'text-orange-600 dark:text-orange-500'}`}>
                                                            {order.orderCode}
                                                        </span>
                                                        <span className="text-[10px] text-stone-400 italic mt-0.5">
                                                            {order.lots.length} mã lot SX • {rollup.palletCount} pallet
                                                            {order.orderName ? ` • ${order.orderName}` : ''}
                                                        </span>
                                                    </div>
                                                }
                                            />

                                            {isOrderOpen && lotRollups.map(({ lot, rollup: lotRollup }) => {
                                                const lotKey = `${order.orderCode}__${lot.lotCode}`
                                                const isLotOpen = expandedLots.has(lotKey)
                                                return (
                                                    <React.Fragment key={lotKey}>
                                                        <NodeRows
                                                            level={1}
                                                            rollup={lotRollup}
                                                            hasChildren={lot.products.length > 0}
                                                            isExpanded={isLotOpen}
                                                            onToggle={() => toggle(setExpandedLots, lotKey)}
                                                            label={
                                                                <div className="flex flex-col">
                                                                    <span className={`font-medium ${lot.lotCode === NO_LOT ? 'text-stone-400 italic' : 'text-stone-700 dark:text-stone-300'}`}>
                                                                        {lot.lotCode}
                                                                    </span>
                                                                    <span className="text-[10px] text-stone-400 italic mt-0.5">
                                                                        {lot.products.length} sản phẩm • {lotRollup.palletCount} pallet
                                                                        {lot.productionDate ? ` • SX ${lot.productionDate}` : ''}
                                                                    </span>
                                                                </div>
                                                            }
                                                        />

                                                        {isLotOpen && lot.products.map((p, idx) => {
                                                            const productRollup = rollupProducts([p])
                                                            return (
                                                                <NodeRows
                                                                    key={`${lotKey}__${p.productCode}__${p.unit}__${idx}`}
                                                                    level={2}
                                                                    rollup={productRollup}
                                                                    hasChildren={false}
                                                                    isExpanded={false}
                                                                    onToggle={() => {}}
                                                                    label={
                                                                        <div className="flex items-center gap-2 flex-wrap">
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
                                                                            <span className="text-[10px] text-stone-400 italic">
                                                                                {p.lotCodes.length} pallet
                                                                            </span>
                                                                        </div>
                                                                    }
                                                                />
                                                            )
                                                        })}
                                                    </React.Fragment>
                                                )
                                            })}
                                        </React.Fragment>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function NodeRows({ level, rollup, hasChildren, isExpanded, onToggle, label }: {
    level: number
    rollup: Rollup
    hasChildren: boolean
    isExpanded: boolean
    onToggle: () => void
    label: React.ReactNode
}) {
    const { unitEntries } = rollup

    return (
        <>
            {unitEntries.map(([unitName, unitQty], rowIdx) => (
                <tr
                    key={`${level}-${unitName || 'unit'}-${rowIdx}`}
                    className={`
                        border-b border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors
                        ${level === 0 ? 'bg-white dark:bg-stone-900' : ''}
                        ${level === 2 ? 'bg-stone-50/70 dark:bg-stone-800/30' : ''}
                    `}
                >
                    {rowIdx === 0 && (
                        <td className="px-4 py-3 align-middle" rowSpan={unitEntries.length}>
                            <div
                                className="flex items-center gap-2 cursor-pointer select-none"
                                style={{ paddingLeft: `${level * 20}px` }}
                                onClick={onToggle}
                            >
                                {hasChildren ? (
                                    <ChevronDown
                                        className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                                    />
                                ) : (
                                    <div className="w-4 h-4" />
                                )}
                                <div className="flex-1 min-w-0">{label}</div>
                                {unitEntries.length > 1 && (
                                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                        {unitEntries.length} đơn vị
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
        </>
    )
}
