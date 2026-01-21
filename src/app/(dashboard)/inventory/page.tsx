'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Search, Loader2, Printer, Warehouse } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import InventoryByLot from '@/components/inventory/InventoryByLot'
import InventoryReconciliation from '@/components/inventory/InventoryReconciliation'

// Types based on API response
interface InventoryItem {
    productCode: string
    productName: string
    warehouse: string
    unit: string
    opening: number
    qtyIn: number
    qtyOut: number
    balance: number
    isUnconvertible?: boolean
}

interface Branch {
    id: string
    name: string
    is_default?: boolean
}

export default function InventoryPage() {
    const { systemType } = useSystem()
    const [activeTab, setActiveTab] = useState<'accounting' | 'lot' | 'tags' | 'reconciliation'>('accounting')
    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(false)

    // Branches
    const [branches, setBranches] = useState<Branch[]>([])
    const [selectedBranch, setSelectedBranch] = useState<string>('')

    // Filters
    const [q, setQ] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [isConvertKg, setIsConvertKg] = useState(false)

    // Load Branches
    useEffect(() => {
        async function fetchBranches() {
            const { data, error } = await supabase
                .from('branches')
                .select('id, name, is_default')
                .order('is_default', { ascending: false })
                .order('name')

            if (data && !error) {
                const branchList = data as Branch[]
                setBranches(branchList)
                // Set default branch
                const defaultBranch = branchList.find(b => b.is_default)
                if (defaultBranch) {
                    setSelectedBranch(defaultBranch.name)
                } else if (branchList.length > 0) {
                    setSelectedBranch(branchList[0].name)
                }
            }
        }
        fetchBranches()
    }, [])

    // Date defaults: Last 7 days to today
    useEffect(() => {
        const formatDate = (date: Date) => {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            return `${year}-${month}-${day}`
        }

        const now = new Date()
        const sevenDaysAgo = new Date(now)
        sevenDaysAgo.setDate(now.getDate() - 7)

        setDateFrom(formatDate(sevenDaysAgo))
        setDateTo(formatDate(now))
    }, [])

    // Load Inventory Data
    const loadInventory = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (q) params.set('q', q)
            if (dateFrom) params.set('dateFrom', dateFrom)
            if (dateTo) params.set('dateTo', dateTo)
            if (selectedBranch) params.set('warehouse', selectedBranch)
            if (systemType) params.set('systemType', systemType)
            if (isConvertKg) params.set('convertToKg', 'true')

            const res = await fetch(`/api/inventory?${params.toString()}`)
            const data = await res.json()

            if (data.ok && Array.isArray(data.items)) {
                setItems(data.items)
            } else {
                setItems([])
            }
        } catch (error) {
            console.error('Failed to load inventory', error)
            setItems([])
        } finally {
            setLoading(false)
        }
    }

    // Reload when filters change (debounce search)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'accounting' && selectedBranch) {
                loadInventory()
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [q, dateFrom, dateTo, activeTab, selectedBranch, systemType, isConvertKg])

    // Calculate Totals
    const totals = useMemo(() => {
        return items.reduce((acc, item) => ({
            opening: acc.opening + item.opening,
            qtyIn: acc.qtyIn + item.qtyIn,
            qtyOut: acc.qtyOut + item.qtyOut,
            balance: acc.balance + item.balance
        }), { opening: 0, qtyIn: 0, qtyOut: 0, balance: 0 })
    }, [items])

    return (
        <div className="h-full flex flex-col space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Kho hàng</h2>
                    <p className="text-stone-500 dark:text-stone-400">Quản lý nhập xuất tồn kho</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-stone-200 dark:border-stone-800">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {[
                        { id: 'accounting', name: 'Tồn kho kế toán' },
                        { id: 'lot', name: 'Tồn kho theo LOT' },
                        { id: 'tags', name: 'Tồn theo Mã phụ', disabled: true },
                        { id: 'reconciliation', name: 'Đối chiếu' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            disabled={tab.disabled}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                                ${activeTab === tab.id
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300 cursor-pointer'
                                }
                                ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                            `}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === 'accounting' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col xl:flex-row gap-4 xl:items-center bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                        <div className="flex-1 w-full xl:w-auto">
                            <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Tìm kiếm</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input
                                    type="text"
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    placeholder="Mã SP, tên SP..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        </div>

                        <div className="w-full xl:w-48">
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

                        <div className="w-full xl:w-40">
                            <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Từ ngày</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div className="w-full xl:w-40">
                            <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Đến ngày</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                            />
                        </div>

                        <div className="flex items-center gap-4 h-full pt-6">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="convertCheck"
                                    checked={isConvertKg}
                                    onChange={(e) => setIsConvertKg(e.target.checked)}
                                    className="w-4 h-4 text-orange-600 rounded border-stone-300 focus:ring-orange-500"
                                />
                                <label htmlFor="convertCheck" className="text-sm font-medium text-stone-700 dark:text-stone-300 cursor-pointer select-none">
                                    Quy đổi sang KG
                                </label>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const params = new URLSearchParams()
                                        params.set('type', 'accounting')
                                        if (systemType) params.set('systemType', systemType)
                                        if (dateFrom) params.set('from', dateFrom)
                                        if (dateTo) params.set('to', dateTo)
                                        if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
                                        if (q) params.set('search', q)
                                        if (isConvertKg) params.set('convertToKg', 'true')
                                        window.open(`/print/inventory?${params.toString()}`, '_blank')
                                    }}
                                    className="p-2 text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-md"
                                    title="In báo cáo"
                                >
                                    <Printer className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-stone-50 dark:bg-stone-800/50 text-stone-500 dark:text-stone-400 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Kho</th>
                                        <th className="px-4 py-3">Mã SP</th>
                                        <th className="px-4 py-3">Tên sản phẩm</th>
                                        <th className="px-4 py-3 text-right">Tồn đầu</th>
                                        <th className="px-4 py-3 text-right">Nhập</th>
                                        <th className="px-4 py-3 text-right">Xuất</th>
                                        <th className="px-4 py-3 text-right">Tồn cuối</th>
                                        <th className="px-4 py-3 text-center">ĐVT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                                                <div className="flex items-center justify-center gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span>Đang tải dữ liệu...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : items.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                                                Không có dữ liệu tồn kho trong giai đoạn này.
                                            </td>
                                        </tr>
                                    ) : (
                                        <>
                                            {items.map((item, idx) => (
                                                <tr
                                                    key={idx}
                                                    className={`
                                                        hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors
                                                        ${item.isUnconvertible ? 'bg-orange-50 dark:bg-orange-950/20' : ''}
                                                    `}
                                                >
                                                    <td className="px-4 py-3 text-stone-600 dark:text-stone-400">{item.warehouse}</td>
                                                    <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400">{item.productCode || 'N/A'}</td>
                                                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                                                        {item.productName}
                                                        {item.isUnconvertible && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 border border-orange-200">
                                                                Chưa thể quy đổi
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-stone-600">{item.opening.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">+{item.qtyIn.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-rose-600 font-medium">-{item.qtyOut.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums font-bold text-stone-900 dark:text-stone-100">{item.balance.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-center text-stone-500">
                                                        {item.unit}
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Summary Row */}
                                            <tr className="bg-stone-100/50 dark:bg-stone-800 font-bold border-t-2 border-stone-300 dark:border-stone-700">
                                                <td colSpan={3} className="px-4 py-3 text-right text-stone-600 dark:text-stone-400">Tổng cộng:</td>
                                                <td className="px-4 py-3 text-right tabular-nums">{totals.opening.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">+{totals.qtyIn.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right tabular-nums text-rose-700">-{totals.qtyOut.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right tabular-nums text-stone-900 dark:text-white">{totals.balance.toLocaleString()}</td>
                                                <td></td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Placeholder for other tabs */}
            {activeTab === 'lot' && (
                <InventoryByLot />
            )}

            {activeTab === 'reconciliation' && (
                <InventoryReconciliation />
            )}

            {/* Placeholder for other tabs */}
            {activeTab !== 'accounting' && activeTab !== 'lot' && activeTab !== 'reconciliation' && (
                <div className="flex flex-col items-center justify-center h-64 border rounded-lg border-dashed border-stone-300 bg-stone-50">
                    <p className="text-stone-500">Tính năng đang phát triển...</p>
                </div>
            )}
        </div>
    )
}
