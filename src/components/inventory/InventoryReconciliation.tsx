'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, AlertTriangle, CheckCircle, Printer } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import MobileReconciliationList from './MobileReconciliationList'

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
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<ItemReconciliation[]>([])
    const [showOnlyDiff, setShowOnlyDiff] = useState(false)

    useEffect(() => {
        fetchAndCompare()
    }, [systemType])

    async function fetchAndCompare() {
        setLoading(true)
        try {
            // 1. Fetch Accounting Inventory
            const accRes = await fetch(`/api/inventory?dateTo=${new Date().toISOString().split('T')[0]}&systemType=${systemType}`)
            const accData = await accRes.json()
            const rawAccountingItems: AccountingItem[] = accData.ok ? accData.items : []

            // Aggregate Accounting Items by Product ID + Unit
            const accountingMap = new Map<string, { qty: number, code: string, name: string, unit: string, productId: string }>()
            rawAccountingItems.forEach(acc => {
                const key = `${acc.productId}_${acc.unit}`
                const current = accountingMap.get(key) || { qty: 0, code: acc.productCode, name: acc.productName, unit: acc.unit, productId: acc.productId }
                current.qty += acc.balance
                accountingMap.set(key, current)
            })

            // 2. Fetch LOT Inventory (Active lots with their items)
            const { data: lots, error } = await supabase
                .from('lots')
                .select(`
                    id,
                    product_id,
                    quantity,
                    lot_items (
                        product_id,
                        quantity,
                        unit,
                        products (name, sku, unit, system_type)
                    ),
                    products (name, sku, unit, system_type)
                `)
                .eq('status', 'active')
                .eq('system_code', systemType)

            if (error) throw error

            // 3. Aggregate Lot Data by Product + Unit
            const lotQtyMap = new Map<string, { qty: number, code: string, name: string, unit: string, productId: string }>()

            lots?.forEach((lot: any) => {
                if (lot.lot_items && lot.lot_items.length > 0) {
                    // Multi-product lot logic
                    lot.lot_items.forEach((item: any) => {
                        const pid = item.product_id
                        const unit = item.unit || item.products?.unit || ''
                        if (!pid) return

                        const key = `${pid}_${unit}`
                        const current = lotQtyMap.get(key) || {
                            qty: 0,
                            code: item.products?.sku || 'N/A',
                            name: item.products?.name || 'Unknown',
                            unit: unit,
                            productId: pid
                        }
                        current.qty += (item.quantity || 0)
                        lotQtyMap.set(key, current)
                    })
                } else if (lot.product_id) {
                    // Legacy single-product lot logic
                    const pid = lot.product_id
                    const unit = lot.products?.unit || ''
                    const key = `${pid}_${unit}`

                    const current = lotQtyMap.get(key) || {
                        qty: 0,
                        code: lot.products?.sku || 'N/A',
                        name: lot.products?.name || 'Unknown',
                        unit: unit,
                        productId: pid
                    }
                    current.qty += (lot.quantity || 0)
                    lotQtyMap.set(key, current)
                }
            })

            // 4. Merge and Compare
            const comparisonMap = new Map<string, ItemReconciliation>()

            // Process Accounting Map
            accountingMap.forEach((acc, key) => {
                const lotEntry = lotQtyMap.get(key)
                const lotQty = lotEntry?.qty || 0

                comparisonMap.set(key, {
                    productId: acc.productId,
                    productCode: acc.code,
                    productName: acc.name,
                    unit: acc.unit,
                    accountingBalance: acc.qty,
                    lotBalance: lotQty,
                    diff: acc.qty - lotQty
                })
                lotQtyMap.delete(key)
            })

            // Process Remaining Lots
            lotQtyMap.forEach((lot, key) => {
                comparisonMap.set(key, {
                    productId: lot.productId,
                    productCode: lot.code,
                    productName: lot.name,
                    unit: lot.unit,
                    accountingBalance: 0,
                    lotBalance: lot.qty,
                    diff: 0 - lot.qty
                })
            })

            setItems(Array.from(comparisonMap.values()).sort((a, b) => a.productCode.localeCompare(b.productCode)))

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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                <div>
                    <h3 className="font-medium text-stone-900 dark:text-stone-100">Bảng đối chiếu tồn kho</h3>
                    <p className="text-sm text-stone-500">So sánh Tồn kho Kế toán (nhập/xuất) và Tổng tồn kho theo LOT thực tế.</p>
                </div>
                <div className="flex items-center justify-between w-full md:w-auto gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-stone-700 dark:text-stone-300">
                        <input
                            type="checkbox"
                            checked={showOnlyDiff}
                            onChange={e => setShowOnlyDiff(e.target.checked)}
                            className="rounded border-stone-300 text-orange-600 focus:ring-orange-500"
                        />
                        Chỉ hiện sai lệch
                    </label>

                    <button
                        onClick={() => {
                            const params = new URLSearchParams()
                            params.set('type', 'reconciliation')
                            if (systemType) params.set('systemType', systemType)
                            params.set('to', new Date().toISOString().split('T')[0])
                            window.open(`/print/inventory?${params.toString()}`, '_blank')
                        }}
                        className="p-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-md bg-white dark:bg-stone-800"
                        title="In báo cáo"
                    >
                        <Printer className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="p-8 text-center text-stone-500 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                    <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang tải và đối chiếu dữ liệu...</span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Mobile List */}
                    <div className="md:hidden">
                        <MobileReconciliationList items={displayedItems} />
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
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
                                    {displayedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                                                {showOnlyDiff ? 'Tuyệt vời! Không có mục nào bị sai lệch.' : 'Không có dữ liệu.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedItems.map((item, idx) => {
                                            const isDiff = item.diff !== 0
                                            return (
                                                <tr key={`${item.productId}_${item.unit}_${idx}`} className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${isDiff ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
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
                </>
            )}
            <div className="text-xs text-stone-500 text-right mt-2">
                * Chênh lệch = Tồn Kế toán - Tổng LOT. Nếu dương (+) tức là Kế toán nhiều hơn LOT thực tế.
            </div>
        </div >
    )
}
