'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, AlertTriangle, CheckCircle, Printer, ChevronDown, Warehouse, FileSpreadsheet, MapPin, Search, RefreshCw, X } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'
import MobileReconciliationList from './MobileReconciliationList'
import { getLotInventoryForReconciliation } from '@/lib/inventoryService'
import { canonicalizeUnit, normalizeUnit } from '@/lib/unitConversion'

// Types
interface AccountingItem {
    productId: string
    productCode: string
    productName: string
    balance: number
    unit: string
    unitId?: string | null
    unitRaw?: string | null
}

interface ItemReconciliation {
    productId: string
    productCode: string
    productName: string
    unit: string
    accountingBalance: number
    lotBalance: number
    diff: number
    lotCount?: number
    lotDetails?: { code: string, qty: number, positions: string[] }[]
}

import { useUnitConversion } from '@/hooks/useUnitConversion'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { useUser } from '@/contexts/UserContext'

export default function InventoryReconciliation({ units }: { units: any[] }) {
    const { convertUnit, unitNameMap, unitIdMap, conversionMap, loading: loadingUnits } = useUnitConversion()
    const { systemType } = useSystem()
    // Use company info for printing params, prioritized from user profile
    const { profile } = useUser()
    const { companyInfo, loading: loadingCompany } = usePrintCompanyInfo({
        orderCompanyId: profile?.company_id
    })

    const [loading, setLoading] = useState(true)
    const [rawAccountingItems, setRawAccountingItems] = useState<AccountingItem[]>([])
    const [rawLots, setRawLots] = useState<any[]>([])
    const [items, setItems] = useState<ItemReconciliation[]>([])
    const [showOnlyDiff, setShowOnlyDiff] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [positionFilter, setPositionFilter] = useState<'all' | 'has_position' | 'no_position'>('all')
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
    const [selectedBranch, setSelectedBranch] = useState('Tất cả')
    const [branches, setBranches] = useState<{ id: string, name: string, is_default?: boolean }[]>([])
    const [selectedLotDetailModal, setSelectedLotDetailModal] = useState<ItemReconciliation | null>(null)

    // Fetch Branches
    useEffect(() => {
        async function fetchBranches() {
            const { data } = await supabase
                .from('branches')
                .select('id, name, is_default')
                .order('is_default', { ascending: false })
                .order('name')

            if (data) {
                const branchData = data as any[]
                setBranches(branchData)
                const defaultBranch = branchData.find(b => b.is_default)
                if (defaultBranch) {
                    setSelectedBranch(defaultBranch.name)
                }
            }
        }
        fetchBranches()
    }, [])

    // Load Raw Data (Accounting + Lots)
    const fetchData = useCallback(async () => {
        if (loadingUnits) return
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
            const accItems: AccountingItem[] = accData.ok ? accData.items : []
            setRawAccountingItems(accItems)

            // 2. Fetch LOT Inventory
            const fetchedLots = await getLotInventoryForReconciliation(supabase, systemType, selectedBranch || undefined)
            setRawLots(fetchedLots || [])
        } catch (error) {
            console.error('Error fetching data for reconciliation:', error)
            setRawAccountingItems([])
            setRawLots([])
        } finally {
            setLoading(false)
        }
    }, [systemType, targetUnitId, dateTo, selectedBranch, loadingUnits])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Compute aggregation and comparison whenever raw data, positionFilter, or conversion changes
    useEffect(() => {
        if (loadingUnits) return

        // 1. Aggregate Accounting Items
        const accountingMap = new Map<string, { qty: number, code: string, name: string, unit: string, productId: string }>()
        const targetUnit = targetUnitId ? units.find(u => u.id === targetUnitId) : null

        rawAccountingItems.forEach(acc => {
            const sKey = (acc.productCode || '').trim().toLowerCase().replace(/\s+/g, '')
            const uKey = (acc.unitId && targetUnitId) ? targetUnitId : canonicalizeUnit(acc.unitRaw || acc.unit)
            const key = `${sKey}_${uKey}`
            
            const current = accountingMap.get(key) || { qty: 0, code: acc.productCode, name: acc.productName, unit: acc.unit, productId: acc.productId }
            current.qty += acc.balance
            accountingMap.set(key, current)
        })

        // 2. Filter Active LOTs by Lock and Position Filter
        let activeLots = rawLots.filter((lot: any) => lot.is_locked !== true)

        if (positionFilter === 'has_position') {
            activeLots = activeLots.filter((lot: any) => Array.isArray(lot.positions) && lot.positions.length > 0)
        } else if (positionFilter === 'no_position') {
            activeLots = activeLots.filter((lot: any) => !lot.positions || lot.positions.length === 0)
        }

        // 3. Aggregate Lot Data by Product + Unit
        const lotQtyMap = new Map<string, {
            qty: number,
            code: string,
            name: string,
            unit: string,
            productId: string,
            lots: { code: string, qty: number, positions: string[] }[]
        }>()

        activeLots.forEach((lot: any) => {
            const processItem = (
                pid: string, 
                qty: number, 
                unit: string, 
                sku: string, 
                name: string, 
                baseUnit: string,
                lotCode: string,
                posList: any[]
            ) => {
                let displayQty = qty
                let displayUnit = unit
                const sKey = (sku || '').trim().toLowerCase().replace(/\s+/g, '')
                const normU = unit.toLowerCase().trim()

                // Enrich unit name with weight suffix if missing
                if (unit && !unit.includes('(')) {
                    const productRates = pid ? conversionMap.get(pid) : null
                    if (productRates) {
                        const unitId = unitNameMap.get(normU)
                        let rate = unitId ? productRates.get(unitId) : null
                        
                        if (!rate || rate === 1) {
                            for (const [key, r] of productRates.entries()) {
                                const fullName = unitIdMap.get(key) || (typeof key === 'string' ? key : '')
                                if (fullName && normalizeUnit(fullName).replace(/\s*\([^)]*\)/, '').trim() === normU && r > 1) {
                                    rate = r
                                    break
                                }
                            }
                        }

                        if (rate && rate > 1) {
                            displayUnit = `${unit} (${rate}kg)`
                        }
                    }
                }

                const isConvertible = targetUnitId && pid && (
                    baseUnit?.toLowerCase() === targetUnit?.name?.toLowerCase() ||
                    conversionMap.get(pid)?.has(targetUnitId)
                )

                let uKey = ''
                if (targetUnitId && isConvertible) {
                    displayUnit = targetUnit!.name
                    displayQty = convertUnit(pid, unit, targetUnit!.name, qty, baseUnit)
                    uKey = targetUnitId
                } else {
                    uKey = canonicalizeUnit(displayUnit)
                }
                
                const key = `${sKey}_${uKey}`

                const current = lotQtyMap.get(key) || {
                    qty: 0,
                    code: sku,
                    name: name,
                    unit: displayUnit,
                    productId: pid,
                    lots: []
                }
                current.qty += displayQty

                if (lotCode && displayQty > 0) {
                    const posCodes = (posList || []).map((p: any) => p.code).filter(Boolean)
                    current.lots.push({
                        code: lotCode,
                        qty: displayQty,
                        positions: posCodes
                    })
                }

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
                        item.products?.unit || '',
                        lot.code,
                        lot.positions
                    )
                })
            } else if (lot.product_id) {
                processItem(
                    lot.product_id,
                    lot.quantity || 0,
                    lot.products?.unit || '',
                    lot.products?.sku || 'N/A',
                    lot.products?.name || 'Unknown',
                    lot.products?.unit || '',
                    lot.code,
                    lot.positions
                )
            }
        })

        // 4. Merge and Compare
        const comparisonMap = new Map<string, ItemReconciliation>()

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
                diff: Number((acc.qty - lotQty).toFixed(4)),
                lotCount: lotEntry?.lots?.length || 0,
                lotDetails: lotEntry?.lots || []
            })
            lotQtyMap.delete(key)
        })

        lotQtyMap.forEach((lot, key) => {
            comparisonMap.set(key, {
                productId: lot.productId,
                productCode: lot.code,
                productName: lot.name,
                unit: lot.unit,
                accountingBalance: 0,
                lotBalance: lot.qty,
                diff: Number((0 - lot.qty).toFixed(4)),
                lotCount: lot.lots?.length || 0,
                lotDetails: lot.lots || []
            })
        })

        setItems(Array.from(comparisonMap.values()).sort((a, b) => a.productCode.localeCompare(b.productCode)))
    }, [rawAccountingItems, rawLots, positionFilter, targetUnitId, loadingUnits, convertUnit, unitNameMap, unitIdMap, conversionMap, units])

    const displayedItems = useMemo(() => {
        let result = items
        if (showOnlyDiff) {
            result = result.filter(i => Math.abs(i.diff) >= 0.001)
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            result = result.filter(i => 
                (i.productCode && i.productCode.toLowerCase().includes(q)) ||
                (i.productName && i.productName.toLowerCase().includes(q))
            )
        }
        return result
    }, [items, showOnlyDiff, searchQuery])

    const lotColumnTitle = positionFilter === 'has_position'
        ? 'LOT Đã có vị trí'
        : positionFilter === 'no_position'
        ? 'LOT Chưa có vị trí'
        : 'Tổng LOT'

    return (
        <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-end bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                {/* Branch / Warehouse */}
                <div className="w-full md:w-48">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block italic">Chi nhánh / Kho</label>
                    <div className="relative">
                        <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="w-full pl-9 pr-8 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                        >
                            <option value="Tất cả">Tất cả chi nhánh</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    </div>
                </div>

                {/* Date */}
                <div className="w-full md:w-36">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block italic">Ngày đối chiếu</label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-800/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                </div>

                {/* Position Filter (Vị trí lưu kho) */}
                <div className="w-full md:w-56">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1 italic">
                        <MapPin size={14} className="text-orange-500" />
                        Vị trí lưu kho
                    </label>
                    <div className="relative">
                        <select
                            value={positionFilter}
                            onChange={e => setPositionFilter(e.target.value as any)}
                            className="w-full pr-10 pl-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer font-medium text-stone-800 dark:text-stone-200"
                        >
                            <option value="all">Tất cả LOT (Mặc định)</option>
                            <option value="has_position">📍 Chỉ LOT đã có vị trí</option>
                            <option value="no_position">⚠️ Chỉ LOT chưa có vị trí</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    </div>
                </div>

                {/* Unit conversion */}
                <div className="w-full md:w-40">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block italic">Quy đổi đơn vị</label>
                    <div className="relative">
                        <select
                            value={targetUnitId || ''}
                            onChange={e => setTargetUnitId(e.target.value || null)}
                            className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-8"
                        >
                            <option value="">Đơn vị gốc</option>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                    </div>
                </div>

                {/* Search */}
                <div className="flex-1 min-w-[200px]">
                    <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block italic">Tìm kiếm</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm mã hoặc tên sản phẩm..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-800/50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                    </div>
                </div>

                {/* Checkbox show only diff */}
                <div className="flex items-center space-x-2 pb-2">
                    <input
                        type="checkbox"
                        id="show-only-diff-main"
                        checked={showOnlyDiff}
                        onChange={(e) => setShowOnlyDiff(e.target.checked)}
                        className="w-4 h-4 text-orange-600 border-stone-300 rounded focus:ring-orange-500 cursor-pointer"
                    />
                    <label htmlFor="show-only-diff-main" className="text-sm font-medium text-stone-700 dark:text-stone-300 italic cursor-pointer select-none">
                        Chỉ hiện sai lệch
                    </label>
                </div>

                {/* Action Buttons */}
                <div className="ml-auto pb-1 flex gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="p-2 border border-stone-300 dark:border-stone-700 rounded-md transition-all text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={async () => {
                            const params = new URLSearchParams()
                            params.set('type', 'reconciliation')
                            params.set('export', 'excel')
                            if (systemType) params.set('systemType', systemType)
                            if (dateTo) params.set('to', dateTo)
                            if (targetUnitId) params.set('targetUnitId', targetUnitId)
                            if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
                            if (positionFilter && positionFilter !== 'all') params.set('positionFilter', positionFilter)

                            // Pass auth token
                            let accessToken = ''
                            try {
                                const { data: { session } } = await supabase.auth.getSession()
                                accessToken = session?.access_token || ''
                            } catch (e) {}

                            if (!accessToken && typeof window !== 'undefined') {
                                for (let i = 0; i < localStorage.length; i++) {
                                    const key = localStorage.key(i)
                                    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                                        const val = localStorage.getItem(key)
                                        if (val) {
                                            try {
                                                const parsed = JSON.parse(val)
                                                accessToken = parsed.access_token || ''
                                            } catch (e) {}
                                        }
                                    }
                                }
                            }

                            if (accessToken) {
                                params.set('token', accessToken)
                            }

                            // Save reconciliation data to sessionStorage for print page
                            try {
                                sessionStorage.setItem('print_inventory_data_reconciliation', JSON.stringify({
                                    ok: true,
                                    reconcileItems: displayedItems,
                                    positionFilter: positionFilter
                                }))
                            } catch (e) {
                                console.error('Failed to save reconciliation data to sessionStorage', e)
                            }

                            // Pass company info directly
                            if (companyInfo) {
                                if (companyInfo.name) params.set('cmp_name', companyInfo.name)
                                if (companyInfo.address) params.set('cmp_address', companyInfo.address)
                                if (companyInfo.phone) params.set('cmp_phone', companyInfo.phone)
                                if (companyInfo.email) params.set('cmp_email', companyInfo.email)
                                if (companyInfo.logo_url) params.set('cmp_logo', companyInfo.logo_url)
                                if ((companyInfo as any).short_name) params.set('cmp_short', (companyInfo as any).short_name)
                            }

                            window.open(`/print/inventory?${params.toString()}`, '_blank')
                        }}
                        disabled={loadingCompany}
                        className={`p-2 border border-stone-300 dark:border-stone-700 rounded-md transition-all ${loadingCompany ? 'opacity-50 cursor-wait bg-stone-100' : 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 active:scale-95'}`}
                        title={loadingCompany ? "Đang tải thông tin..." : "Xuất Excel"}
                    >
                        <FileSpreadsheet className="w-5 h-5" />
                    </button>
                    <button
                        onClick={async () => {
                            const params = new URLSearchParams()
                            params.set('type', 'reconciliation')
                            if (systemType) params.set('systemType', systemType)
                            if (dateTo) params.set('to', dateTo)
                            if (targetUnitId) params.set('targetUnitId', targetUnitId)
                            if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
                            if (positionFilter && positionFilter !== 'all') params.set('positionFilter', positionFilter)

                            // Pass auth token
                            let accessToken = ''
                            try {
                                const { data: { session } } = await supabase.auth.getSession()
                                accessToken = session?.access_token || ''
                            } catch (e) {}

                            if (!accessToken && typeof window !== 'undefined') {
                                for (let i = 0; i < localStorage.length; i++) {
                                    const key = localStorage.key(i)
                                    if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
                                        const val = localStorage.getItem(key)
                                        if (val) {
                                            try {
                                                const parsed = JSON.parse(val)
                                                accessToken = parsed.access_token || ''
                                            } catch (e) {}
                                        }
                                    }
                                }
                            }

                            if (accessToken) {
                                params.set('token', accessToken)
                            }

                            // Save reconciliation data to sessionStorage for print page
                            try {
                                sessionStorage.setItem('print_inventory_data_reconciliation', JSON.stringify({
                                    ok: true,
                                    reconcileItems: displayedItems,
                                    positionFilter: positionFilter
                                }))
                            } catch (e) {
                                console.error('Failed to save reconciliation data to sessionStorage', e)
                            }

                            // Pass company info directly
                            if (companyInfo) {
                                if (companyInfo.name) params.set('cmp_name', companyInfo.name)
                                if (companyInfo.address) params.set('cmp_address', companyInfo.address)
                                if (companyInfo.phone) params.set('cmp_phone', companyInfo.phone)
                                if (companyInfo.email) params.set('cmp_email', companyInfo.email)
                                if (companyInfo.logo_url) params.set('cmp_logo', companyInfo.logo_url)
                                if ((companyInfo as any).short_name) params.set('cmp_short', (companyInfo as any).short_name)
                            }

                            window.open(`/print/inventory?${params.toString()}`, '_blank')
                        }}
                        disabled={loadingCompany}
                        className={`p-2 border border-stone-300 dark:border-stone-700 rounded-md transition-all ${loadingCompany ? 'opacity-50 cursor-wait bg-stone-100' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 active:scale-95'}`}
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
                        <MobileReconciliationList
                            items={displayedItems}
                            positionFilter={positionFilter}
                            onSelectLotDetail={setSelectedLotDetailModal}
                        />
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
                                        <th className="px-4 py-3 text-right">{lotColumnTitle}</th>
                                        <th className="px-4 py-3 text-right">Chênh lệch</th>
                                        <th className="px-4 py-3 text-center">Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                                    {displayedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                                                {showOnlyDiff ? 'Tuyệt vời! Không có mục nào bị sai lệch.' : 'Không có dữ liệu đối chiếu.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedItems.map((item, idx) => {
                                            const isDiff = Math.abs(item.diff) >= 0.001
                                            return (
                                                <tr key={`${item.productId}_${item.unit}_${idx}`} className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${isDiff ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                                                    <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400">{item.productCode}</td>
                                                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{item.productName}</td>
                                                    <td className="px-4 py-3 text-center text-stone-500">{item.unit}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-stone-700 dark:text-stone-300 font-medium">{formatQuantityFull(item.accountingBalance)}</td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-stone-700 dark:text-stone-300 font-medium">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span>{formatQuantityFull(item.lotBalance)}</span>
                                                            {item.lotDetails && item.lotDetails.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedLotDetailModal(item)}
                                                                    title="Bấm để xem danh sách LOT chi tiết"
                                                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-normal bg-stone-100 hover:bg-orange-100 dark:bg-stone-800 dark:hover:bg-orange-950/40 text-stone-600 hover:text-orange-700 dark:text-stone-400 dark:hover:text-orange-300 transition-colors cursor-pointer border border-stone-200 dark:border-stone-700"
                                                                >
                                                                    {item.lotDetails.length} LOT
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
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
                * Chênh lệch = Tồn Kế toán - {lotColumnTitle}. Nếu dương (+) tức là Kế toán nhiều hơn LOT thực tế{positionFilter === 'has_position' ? ' (chỉ tính LOT đã có vị trí)' : positionFilter === 'no_position' ? ' (chỉ tính LOT chưa có vị trí)' : ''}.
            </div>

            {/* LOT Detail Modal */}
            {selectedLotDetailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-stone-900 dark:text-stone-100 text-base flex items-center gap-2">
                                    <span>Danh sách LOT chi tiết</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400 font-semibold border border-orange-200 dark:border-orange-800">
                                        {selectedLotDetailModal.lotDetails?.length || 0} LOT
                                    </span>
                                </h3>
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                                    {selectedLotDetailModal.productCode} - {selectedLotDetailModal.productName}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLotDetailModal(null)}
                                className="p-1.5 rounded-md text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 overflow-y-auto flex-1 space-y-3">
                            <div className="flex items-center justify-between text-xs px-3 py-2 bg-stone-50 dark:bg-stone-800/50 rounded-lg text-stone-600 dark:text-stone-400 font-medium border border-stone-100 dark:border-stone-800">
                                <span>Tổng tồn LOT {positionFilter === 'has_position' ? '(Có vị trí)' : positionFilter === 'no_position' ? '(Chưa vị trí)' : ''}:</span>
                                <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                                    {formatQuantityFull(selectedLotDetailModal.lotBalance)} {selectedLotDetailModal.unit}
                                </span>
                            </div>

                            <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden">
                                {selectedLotDetailModal.lotDetails?.map((ld, i) => {
                                    const hasPos = ld.positions && ld.positions.length > 0
                                    return (
                                        <div key={i} className="p-3 flex items-center justify-between gap-3 text-sm hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-colors">
                                            <div>
                                                <div className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                                                    {ld.code}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <MapPin size={13} className={hasPos ? 'text-orange-500' : 'text-stone-400'} />
                                                    <span className={`text-xs ${hasPos ? 'font-medium text-stone-700 dark:text-stone-300' : 'text-stone-400 italic'}`}>
                                                        {hasPos ? ld.positions.join(', ') : 'Chưa có vị trí'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right font-medium text-stone-900 dark:text-stone-100 tabular-nums">
                                                {formatQuantityFull(ld.qty)} {selectedLotDetailModal.unit}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-stone-200 dark:border-stone-800 flex justify-end bg-stone-50 dark:bg-stone-900/50">
                            <button
                                onClick={() => setSelectedLotDetailModal(null)}
                                className="px-4 py-1.5 text-sm font-medium rounded-md bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
