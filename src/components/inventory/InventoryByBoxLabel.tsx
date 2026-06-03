'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Loader2, Printer, Box } from 'lucide-react'
import { formatQuantityFull } from '@/lib/numberUtils'

interface BoxLabelInvItem {
    product_id: string
    productCode: string
    productName: string
    semi_finished_lot_code: string
    finished_lot_code: string
    labelCount: number
    totalQuantity: number
    unit: string
    isUnconvertible?: boolean
}

interface InventoryByBoxLabelProps {
    units: any[]
    systemType: string
    selectedBranch: string
    targetUnitId: string | null
    searchTerm?: string
    searchMode?: string
    selectedCategoryIds?: string[]
}

export default function InventoryByBoxLabel({
    units,
    systemType,
    selectedBranch,
    targetUnitId,
    searchTerm,
    searchMode,
    selectedCategoryIds
}: InventoryByBoxLabelProps) {
    const [items, setItems] = useState<BoxLabelInvItem[]>([])
    const [loading, setLoading] = useState(false)

    // Load Box Label Inventory Data
    useEffect(() => {
        async function loadBoxLabelInventory() {
            setLoading(true)
            try {
                const params = new URLSearchParams()
                if (systemType) params.set('systemType', systemType)
                if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
                if (targetUnitId) params.set('targetUnitId', targetUnitId)
                if (searchTerm) params.set('q', searchTerm)
                if (searchMode) params.set('searchMode', searchMode)
                if (selectedCategoryIds && selectedCategoryIds.length > 0) {
                    params.set('categoryIds', selectedCategoryIds.join(','))
                }

                const res = await fetch(`/api/inventory/by-label?${params.toString()}`)
                const data = await res.json()

                if (data?.ok && Array.isArray(data.items)) {
                    setItems(data.items)
                } else {
                    setItems([])
                }
            } catch (error) {
                console.error('Failed to load box label inventory', error)
                setItems([])
            } finally {
                setLoading(false)
            }
        }

        if (systemType) {
            loadBoxLabelInventory()
        }
    }, [systemType, selectedBranch, targetUnitId, searchTerm, searchMode, selectedCategoryIds])

    // Calculate totals
    const totals = useMemo(() => {
        return items.reduce(
            (acc, item) => {
                return {
                    labelCount: acc.labelCount + item.labelCount,
                    totalQuantity: acc.totalQuantity + (item.isUnconvertible ? 0 : item.totalQuantity)
                }
            },
            { labelCount: 0, totalQuantity: 0 }
        )
    }, [items])

    const displayUnit = items[0]?.unit || 'Kg'

    const handlePrint = () => {
        const params = new URLSearchParams()
        params.set('type', 'labels')
        if (systemType) params.set('systemType', systemType)
        if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
        if (targetUnitId) params.set('targetUnitId', targetUnitId)
        if (searchTerm) params.set('search', searchTerm)
        if (searchMode) params.set('searchMode', searchMode)
        if (selectedCategoryIds && selectedCategoryIds.length > 0) {
            params.set('categoryIds', selectedCategoryIds.join(','))
        }
        params.set('to', new Date().toISOString().split('T')[0])
        window.open(`/print/inventory?${params.toString()}`, '_blank')
    }

    if (loading && items.length === 0) {
        return (
            <div className="flex justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <span className="text-xs font-semibold text-stone-500">Đang tải dữ liệu tồn tem nhãn...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex justify-end pr-1">
                <button
                    onClick={handlePrint}
                    className="p-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer bg-white dark:bg-stone-900 shadow-sm"
                >
                    <Printer className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold">In báo cáo</span>
                </button>
            </div>

            {/* Bảng tồn kho tem nhãn */}
            <div className="bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-stone-50 dark:bg-stone-850 font-semibold text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800 text-[11px] uppercase tracking-wider">
                                <th className="px-4 py-3 text-center w-16">STT</th>
                                <th className="px-4 py-3">Mã sản phẩm</th>
                                <th className="px-4 py-3">Tên sản phẩm</th>
                                <th className="px-4 py-3">Lô bán thành phẩm</th>
                                <th className="px-4 py-3">Lô thành phẩm</th>
                                <th className="px-4 py-3 text-right">Số lượng tem</th>
                                <th className="px-4 py-3 text-right">Tồn kho tem</th>
                                <th className="px-4 py-3 text-center">ĐVT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 dark:divide-stone-800 text-xs">
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-16 text-center text-stone-500">
                                        <Box className="w-12 h-12 text-stone-300 dark:text-stone-750 mx-auto mb-2" />
                                        <h5 className="font-bold text-stone-700 dark:text-stone-300">Không tìm thấy tồn kho tem nhãn</h5>
                                        <p className="text-[10px] text-stone-400 dark:text-stone-500 max-w-xs mx-auto leading-relaxed mt-1">
                                            Không có tem nhãn in nào khớp với bộ lọc hiện tại hoặc tem nhãn của các Pallet liên quan đều đã xuất kho.
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {items.map((item, idx) => (
                                        <tr
                                            key={`${item.product_id}__${item.semi_finished_lot_code}__${item.finished_lot_code}__${idx}`}
                                            className={`hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors ${
                                                item.isUnconvertible ? 'bg-orange-50/50 dark:bg-orange-950/10' : ''
                                            }`}
                                        >
                                            <td className="px-4 py-3 text-center font-bold text-stone-400 tabular-nums">
                                                #{idx + 1}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400">
                                                {item.productCode}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100 uppercase">
                                                {item.productName}
                                                {item.isUnconvertible && (
                                                    <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 text-orange-600 border border-orange-200">
                                                        Chưa thể quy đổi
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400 uppercase">
                                                {item.semi_finished_lot_code}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400 uppercase">
                                                {item.finished_lot_code}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-stone-800 dark:text-stone-200 tabular-nums">
                                                {item.labelCount} tem
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                                                {formatQuantityFull(item.totalQuantity)}
                                            </td>
                                            <td className="px-4 py-3 text-center text-stone-500">
                                                {item.unit}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-stone-50/60 dark:bg-stone-800 font-bold border-t border-stone-200 dark:border-stone-700">
                                        <td colSpan={5} className="px-4 py-3 text-right text-stone-600 dark:text-stone-400">
                                            Tổng cộng tồn tem nhãn:
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-stone-900 dark:text-white">
                                            {totals.labelCount} tem
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums text-orange-600 dark:text-orange-400">
                                            {formatQuantityFull(totals.totalQuantity)}
                                        </td>
                                        <td className="px-4 py-3 text-center text-stone-500">
                                            {displayUnit}
                                        </td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
