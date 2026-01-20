'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react'

// Types
interface AccountingItem {
    productId: string
    productCode: string
    productName: string
    balance: number
    unit: string
}

interface ItemReconciliation {
    productId: string
    productCode: string
    productName: string
    unit: string
    accountingBalance: number
    lotBalance: number
    diff: number
}

export default function InventoryReconciliation() {
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<ItemReconciliation[]>([])
    const [showOnlyDiff, setShowOnlyDiff] = useState(false)

    useEffect(() => {
        fetchAndCompare()
    }, [])

    async function fetchAndCompare() {
        setLoading(true)
        try {
            // 1. Fetch Accounting Inventory (via API to get calculated balances)
            // We fetch all items without filter to compare everything
            const accRes = await fetch(`/api/inventory?dateTo=${new Date().toISOString().split('T')[0]}`)
            const accData = await accRes.json()
            const accountingItems: AccountingItem[] = accData.ok ? accData.items : []

            // 2. Fetch LOT Inventory (Active lots)
            const { data: lots, error } = await supabase
                .from('lots')
                .select('product_id, quantity, products(name, sku, unit)')
                .eq('status', 'active')

            if (error) throw error

            // 3. Aggregate Lot Data by Product
            const lotMap = new Map<string, number>()
            // Also keep track of product details from lots in case accounting side is missing them (unlikely but possible)
            const productDetails = new Map<string, { code: string, name: string, unit: string }>()

            lots?.forEach((lot: any) => {
                if (!lot.product_id) return
                const current = lotMap.get(lot.product_id) || 0
                lotMap.set(lot.product_id, current + (lot.quantity || 0))

                if (lot.products && !productDetails.has(lot.product_id)) {
                    productDetails.set(lot.product_id, {
                        code: lot.products.sku,
                        name: lot.products.name,
                        unit: lot.products.unit
                    })
                }
            })

            // 4. Merge and Compare
            const comparisonMap = new Map<string, ItemReconciliation>()

            // Process Accounting Items
            accountingItems.forEach(acc => {
                const lotQty = lotMap.get(acc.productId) || 0
                comparisonMap.set(acc.productId, {
                    productId: acc.productId,
                    productCode: acc.productCode,
                    productName: acc.productName,
                    unit: acc.unit,
                    accountingBalance: acc.balance,
                    lotBalance: lotQty,
                    diff: acc.balance - lotQty
                })
                // Remove from lotMap to see what's left
                lotMap.delete(acc.productId)
            })

            // Process Remaining Lots (items physically present but not in accounting?)
            lotMap.forEach((qty, productId) => {
                const details = productDetails.get(productId)
                comparisonMap.set(productId, {
                    productId: productId,
                    productCode: details?.code || 'N/A',
                    productName: details?.name || 'Unknown Product',
                    unit: details?.unit || '',
                    accountingBalance: 0,
                    lotBalance: qty,
                    diff: 0 - qty
                })
            })

            setItems(Array.from(comparisonMap.values()))

        } catch (error) {
            console.error('Error fetching data for reconciliation:', error)
        } finally {
            setLoading(false)
        }
    }

    const displayedItems = useMemo(() => {
        if (showOnlyDiff) {
            return items.filter(i => i.diff !== 0)
        }
        return items
    }, [items, showOnlyDiff])

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                <div>
                    <h3 className="font-medium text-stone-900 dark:text-stone-100">Bảng đối chiếu tồn kho</h3>
                    <p className="text-sm text-stone-500">So sánh Tồn kho Kế toán (nhập/xuất) và Tổng tồn kho theo LOT thực tế.</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-stone-700 dark:text-stone-300">
                        <input
                            type="checkbox"
                            checked={showOnlyDiff}
                            onChange={e => setShowOnlyDiff(e.target.checked)}
                            className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                        />
                        Chỉ hiện sai lệch
                    </label>
                </div>
            </div>

            <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 font-medium">
                            <tr>
                                <th className="px-4 py-3">Mã SP</th>
                                <th className="px-4 py-3">Tên sản phẩm</th>
                                <th className="px-4 py-3 text-center">ĐVT</th>
                                <th className="px-4 py-3 text-right">Tồn Kế toán</th>
                                <th className="px-4 py-3 text-right">Tổng LOT</th>
                                <th className="px-4 py-3 text-right">Chênh lệch</th>
                                <th className="px-4 py-3 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Đang tải và đối chiếu dữ liệu...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                                        {showOnlyDiff ? 'Tuyệt vời! Không có mục nào bị sai lệch.' : 'Không có dữ liệu.'}
                                    </td>
                                </tr>
                            ) : (
                                displayedItems.map((item) => {
                                    const isDiff = item.diff !== 0
                                    return (
                                        <tr key={item.productId} className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${isDiff ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                                            <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400">{item.productCode}</td>
                                            <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{item.productName}</td>
                                            <td className="px-4 py-3 text-center text-stone-500">{item.unit}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-stone-700 font-medium">{item.accountingBalance.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right tabular-nums text-stone-700 font-medium">{item.lotBalance.toLocaleString()}</td>
                                            <td className={`px-4 py-3 text-right tabular-nums font-bold ${isDiff ? 'text-red-500' : 'text-stone-400'}`}>
                                                {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {isDiff ? (
                                                    <div className="inline-flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full text-xs font-medium border border-red-100 dark:border-red-900/30">
                                                        <AlertTriangle size={12} />
                                                        Lệch
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full text-xs font-medium border border-emerald-100 dark:border-emerald-900/30">
                                                        <CheckCircle size={12} />
                                                        Khớp
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="text-xs text-stone-500 text-right mt-2">
                * Chênh lệch = Tồn Kế toán - Tổng LOT. Nếu dương (+) tức là Kế toán nhiều hơn LOT thực tế.
            </div>
        </div>
    )
}
