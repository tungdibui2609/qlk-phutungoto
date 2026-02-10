'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, AlertTriangle, CheckCircle, Printer, ChevronDown, Warehouse } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'
import MobileReconciliationList from './MobileReconciliationList'
import { getLotInventoryForReconciliation } from '@/lib/inventoryService'

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

import { useUnitConversion } from '@/hooks/useUnitConversion'

import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { useUser } from '@/contexts/UserContext'

export default function InventoryReconciliation({ units }: { units: any[] }) {
    const { convertUnit, unitNameMap, conversionMap } = useUnitConversion()
    const { systemType } = useSystem()
    // Use company info for printing params, prioritized from user profile
    const { profile } = useUser()
    const { companyInfo, loading: loadingCompany } = usePrintCompanyInfo({
        orderCompanyId: profile?.company_id
    })

    const [loading, setLoading] = useState(true)
    const [items, setItems] = useState<ItemReconciliation[]>([])
    const [showOnlyDiff, setShowOnlyDiff] = useState(false)
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
    const [selectedBranch, setSelectedBranch] = useState('Tất cả')
    const [branches, setBranches] = useState<{ id: string, name: string, is_default?: boolean }[]>([])

    // Fetch Branches
    useEffect(() => {
        async function fetchBranches() {
            const { data, error } = await supabase
                .from('branches')
                .select('id, name, is_default')
                .order('is_default', { ascending: false })
                .order('name')

            if (data) {
                setBranches(data as any)
                const defaultBranch = data.find(b => b.is_default)
                if (defaultBranch) {
                    setSelectedBranch(defaultBranch.name)
                }
            }
        }
        fetchBranches()
    }, [])

    useEffect(() => {
        fetchAndCompare()
    }, [systemType, targetUnitId, dateTo, selectedBranch])

    async function fetchAndCompare() {
        setLoading(true)
        try {
            // 1. Fetch Accounting Inventory
            const finalDate = dateTo || new Date().toISOString().split('T')[0]
            const params = new URLSearchParams()
            params.set('dateTo', finalDate)
            params.set('systemType', systemType)
            if (targetUnitId) params.set('targetUnitId', targetUnitId)
            if (selectedBranch && selectedBranch !== "Tất cả") params.set('warehouse', selectedBranch)

            const accRes = await fetch(`/api/inventory?${params.toString()}`)
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

            // 2. Fetch LOT Inventory (Active lots with their items) using shared service
            const lots = await getLotInventoryForReconciliation(supabase, systemType, selectedBranch || undefined)

            // 3. Aggregate Lot Data by Product + Unit
            const lotQtyMap = new Map<string, { qty: number, code: string, name: string, unit: string, productId: string }>()

            const targetUnit = targetUnitId ? units.find(u => u.id === targetUnitId) : null

            lots?.forEach((lot: any) => {
                const processItem = (pid: string, qty: number, unit: string, sku: string, name: string, baseUnit: string) => {
                    let displayQty = qty
                    let displayUnit = unit
                    let key = `${pid}_${unit}`

                    const isConvertible = targetUnitId && pid && (
                        baseUnit?.toLowerCase() === targetUnit?.name?.toLowerCase() ||
                        conversionMap.get(pid)?.has(targetUnitId)
                    )

                    if (targetUnitId && isConvertible) {
                        displayUnit = targetUnit!.name
                        displayQty = convertUnit(pid, unit, targetUnit!.name, qty, baseUnit)
                        key = `${pid}_${targetUnit!.name}`
                    }

                    const current = lotQtyMap.get(key) || {
                        qty: 0,
                        code: sku,
                        name: name,
                        unit: displayUnit,
                        productId: pid
                    }
                    current.qty += displayQty
                    lotQtyMap.set(key, current)
                }

                if (lot.lot_items && lot.lot_items.length > 0) {
                    lot.lot_items.forEach((item: any) => {
                        if (!item.product_id) return
                        processItem(
                            item.product_id,
                            item.quantity || 0,
                            item.unit || item.products?.unit || '',
                            item.products?.sku || 'N/A',
                            item.products?.name || 'Unknown',
                            item.products?.unit || ''
                        )
                    })
                } else if (lot.product_id) {
                    processItem(
                        lot.product_id,
                        lot.quantity || 0,
                        lot.products?.unit || '',
                        lot.products?.sku || 'N/A',
                        lot.products?.name || 'Unknown',
                        lot.products?.unit || ''
                    )
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
        <div className="space-y-6">


            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                <div className="w-full md:w-1/2 xl:w-48">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block italic">Chi nhánh / Kho</label>
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

                <div className="w-full md:w-32">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block italic">Ngày đối chiếu</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>

                <div className="w-full xl:w-40">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block italic">Quy đổi đơn vị</label>
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

                <div className="flex items-center space-x-2 pb-2">
                    <input
                        type="checkbox"
                        id="show-only-diff-main"
                        checked={showOnlyDiff}
                        onChange={(e) => setShowOnlyDiff(e.target.checked)}
                        className="w-4 h-4 text-orange-600 border-stone-300 rounded focus:ring-orange-500"
                    />
                    <label htmlFor="show-only-diff-main" className="text-sm font-medium text-stone-700 dark:text-stone-300 italic">
                        Chỉ hiện sai lệch
                    </label>
                </div>

                <div className="ml-auto pb-1">
                    <button
                        onClick={async () => {
                            const params = new URLSearchParams()
                            params.set('type', 'reconciliation')
                            if (systemType) params.set('systemType', systemType)
                            if (dateTo) params.set('to', dateTo)
                            if (targetUnitId) params.set('targetUnitId', targetUnitId)
                            if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)

                            // Pass auth token
                            const { data: { session } } = await supabase.auth.getSession()
                            if (session?.access_token) {
                                params.set('token', session.access_token)
                            }

                            // Pass company info directly
                            if (companyInfo) {
                                if (companyInfo.name) params.set('cmp_name', companyInfo.name)
                                if (companyInfo.address) params.set('cmp_address', companyInfo.address)
                                if (companyInfo.phone) params.set('cmp_phone', companyInfo.phone)
                                if (companyInfo.email) params.set('cmp_email', companyInfo.email)
                                if (companyInfo.logo_url) params.set('cmp_logo', companyInfo.logo_url)
                                if (companyInfo.short_name) params.set('cmp_short', companyInfo.short_name)
                            }

                            window.open(`/print/inventory?${params.toString()}`, '_blank')
                        }}
                        disabled={loadingCompany}
                        className={`p-2 mt-6 border border-stone-300 dark:border-stone-700 rounded-md transition-all ${loadingCompany ? 'opacity-50 cursor-wait bg-stone-100' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 active:scale-95'}`}
                        title={loadingCompany ? "Đang tải thông tin..." : "In báo cáo"}
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
                                                    <td className="px-4 py-3 text-right tabular-nums text-stone-700 font-medium">{formatQuantityFull(item.accountingBalance)}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-stone-700 font-medium">{formatQuantityFull(item.lotBalance)}</td>
                                                    <td className={`px-4 py-3 text-right tabular-nums font-bold ${isDiff ? 'text-red-500' : 'text-stone-400'}`}>
                                                        {item.diff > 0 ? '+' : ''}{formatQuantityFull(item.diff)}
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
