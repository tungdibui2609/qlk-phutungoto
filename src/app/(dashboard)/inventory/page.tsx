'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Search, Loader2, Printer, Warehouse, ChevronDown, Hash, FileSpreadsheet, HelpCircle, LayoutGrid, Package, Tag, MapPin, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'
import InventoryByLot from '@/components/inventory/InventoryByLot'
import InventoryByTag from '@/components/inventory/InventoryByTag'
import InventoryReconciliation from '@/components/inventory/InventoryReconciliation'
import InventoryByCategory from '@/components/inventory/InventoryByCategory'
import MobileInventoryList from '@/components/inventory/MobileInventoryList'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { useInventoryByLot } from '@/components/inventory/by-lot/useInventoryByLot'
import { useUser } from '@/contexts/UserContext'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { SearchHelpModal } from '@/components/shared/SearchHelpModal'

// Types based on API response
interface InventoryItem {
    productCode: string
    productName: string
    internalCode?: string | null
    internalName?: string | null
    warehouse: string
    unit: string
    opening: number
    qtyIn: number
    qtyOut: number
    balance: number
    categoryName: string | null
    isUnconvertible?: boolean
}

interface Branch {
    id: string
    name: string
    is_default?: boolean
}

export default function InventoryPage() {
    const { systemType } = useSystem()
    const { profile } = useUser()
    const { companyInfo, loading: loadingCompany } = usePrintCompanyInfo({
        orderCompanyId: profile?.company_id
    })

    const [activeTab, setActiveTab] = useState<'accounting' | 'category' | 'lot' | 'tags' | 'reconciliation'>('accounting')
    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(false)
    const [displayInternalCode, setDisplayInternalCode] = useState(false)

    // Branches
    const [branches, setBranches] = useState<Branch[]>([])
    const [selectedBranch, setSelectedBranch] = useState<string>('Tất cả')

    // Filters
    const [q, setQ] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [units, setUnits] = useState<any[]>([])
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null)
    const [categories, setCategories] = useState<any[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [searchMode, setSearchMode] = useState<'all' | 'name' | 'code' | 'tag' | 'position' | 'category'>('all')

    const searchModes = [
        { id: 'all', label: 'Tổng hợp', icon: LayoutGrid, color: 'text-blue-600' },
        { id: 'name', label: 'Theo Tên', icon: Package, color: 'text-green-600' },
        { id: 'code', label: 'Theo Mã', icon: Hash, color: 'text-amber-600' },
        { id: 'tag', label: 'Mã phụ', icon: Tag, color: 'text-purple-600' },
        { id: 'position', label: 'Vị trí', icon: MapPin, color: 'text-red-600' },
        { id: 'category', label: 'Danh mục', icon: Layers, color: 'text-teal-600' },
    ] as const

    const currentMode = searchModes.find(m => m.id === searchMode) || searchModes[0]

    // LOT Hook for LOT and Category tabs
    const lotHookData = useInventoryByLot(units || [], {
        searchTerm: q,
        searchMode: searchMode,
        selectedBranch: selectedBranch,
        selectedCategoryIds: selectedCategoryIds,
        targetUnitId: targetUnitId,
        selectedZoneId: selectedZoneId
    })

    // Load Branches
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
                const branchList = data as Branch[]
                setBranches(branchList)
                const defaultBranch = branchList.find(b => b.is_default)
                if (defaultBranch) {
                    setSelectedBranch(defaultBranch.name)
                }
            }
        }
        fetchBranches()
    }, [])

    // Load Units
    useEffect(() => {
        async function fetchUnits() {
            const { data } = await supabase.from('units').select('id, name')
            if (data) setUnits(data)
        }
        fetchUnits()
    }, [])

    // Load Categories
    useEffect(() => {
        if (!systemType) return
        async function fetchCategories() {
            const { data } = await supabase
                .from('categories')
                .select('id, name')
                .eq('system_type', systemType)
                .order('name')
            if (data) setCategories(data)
        }
        fetchCategories()
        setSelectedCategoryIds([]) // Reset selected categories when system changes
    }, [systemType])

    // Date defaults
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
            if (searchMode) params.set('searchMode', searchMode)
            if (dateFrom) params.set('dateFrom', dateFrom)
            if (dateTo) params.set('dateTo', dateTo)
            if (selectedBranch) params.set('warehouse', selectedBranch)
            if (systemType) params.set('systemType', systemType)
            if (targetUnitId) params.set('targetUnitId', targetUnitId)
            if (selectedCategoryIds.length > 0) {
                params.set('categoryIds', selectedCategoryIds.join(','))
            }

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
    }, [q, searchMode, dateFrom, dateTo, activeTab, selectedBranch, systemType, targetUnitId, selectedCategoryIds])

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

            {/* Tabs Navigation */}
            <div className="border-b border-stone-200 dark:border-stone-800 overflow-x-auto">
                <nav className="-mb-px flex space-x-4 md:space-x-8 min-w-max px-1" aria-label="Tabs">
                    {[
                        { id: 'accounting', name: 'Tồn kho kế toán' },
                        { id: 'category', name: 'Tồn theo danh mục' },
                        { id: 'lot', name: 'Tồn kho theo LOT' },
                        { id: 'tags', name: 'Tồn theo Mã phụ' },
                        { id: 'reconciliation', name: 'Đối chiếu' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                py-3 md:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                                ${activeTab === tab.id
                                    ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                                    : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300 cursor-pointer'
                                }
                            `}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Global Filters - Visible for Accounting, Category, Lot tabs */}
            {(activeTab === 'accounting' || activeTab === 'category' || activeTab === 'lot') && (
                <div className="flex flex-col gap-4 bg-white dark:bg-stone-900 p-4 rounded-lg border border-stone-200 dark:border-stone-800 shadow-sm">
                    {/* Row 1: Search - Full Width */}
                    <div className="w-full">
                        <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block flex items-center gap-1">
                            Tìm kiếm
                            <button
                                onClick={() => setIsHelpOpen(true)}
                                className="p-1 text-orange-500 hover:text-orange-600 transition-colors"
                                title="Hướng dẫn tìm kiếm"
                            >
                                <HelpCircle size={14} />
                            </button>
                        </label>
                        <div className="flex gap-2">
                            <div className="relative min-w-[130px]">
                                <currentMode.icon size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${currentMode.color}`} />
                                <select
                                    value={searchMode}
                                    onChange={(e) => setSearchMode(e.target.value as any)}
                                    className="w-full pl-9 pr-10 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                                >
                                    {searchModes.map((mode) => (
                                        <option key={mode.id} value={mode.id}>
                                            {mode.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            </div>

                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <input
                                    type="text"
                                    value={q}
                                    onChange={e => setQ(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder={`Tìm ${currentMode.label.toLowerCase()}... (dùng ; để tìm nhiều, dùng & để kết hợp điều kiện)`}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Warehouse, Dates, Units & Actions */}
                    <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
                        {/* Branch */}
                        <div className="w-full sm:w-auto lg:w-64">
                            <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Chi nhánh / Kho</label>
                            <div className="relative">
                                <Warehouse className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                                <select
                                    value={selectedBranch}
                                    onChange={e => setSelectedBranch(e.target.value)}
                                    className="w-full pl-9 pr-10 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                                >
                                    <option value="Tất cả">Tất cả chi nhánh</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="flex flex-row gap-4 w-full sm:w-auto">
                            <div className="flex-1 sm:w-40">
                                <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Từ ngày</label>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={e => setDateFrom(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                            <div className="flex-1 sm:w-40">
                                <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Đến ngày</label>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={e => setDateTo(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>
                        </div>

                        {/* Unit & Actions */}
                        <div className="flex items-end gap-4 w-full sm:w-auto">
                            <div className="flex-1 min-w-[140px]">
                                <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">Quy đổi</label>
                                <div className="relative">
                                    <select
                                        value={targetUnitId || ''}
                                        onChange={e => setTargetUnitId(e.target.value || null)}
                                        className="w-full pr-8 pl-3 py-2 text-sm border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer"
                                    >
                                        <option value="">Đơn vị gốc</option>
                                        {units.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setDisplayInternalCode(!displayInternalCode)}
                                    className={`p-2 border border-stone-300 dark:border-stone-700 rounded-md transition-all flex items-center justify-center ${displayInternalCode ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 active:scale-95'}`}
                                    title={displayInternalCode ? "Đang hiển thị mã nội bộ" : "Hiển thị mã nội bộ"}
                                >
                                    <Hash className="w-5 h-4" />
                                </button>
                                <button
                                    onClick={async () => {
                                        if (loadingCompany) return
                                        const params = new URLSearchParams()
                                        params.set('type', activeTab)
                                        params.set('export', 'excel')
                                        if (systemType) params.set('systemType', systemType)
                                        if (dateFrom) params.set('dateFrom', dateFrom)
                                        if (dateTo) params.set('dateTo', dateTo)
                                        if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
                                        if (q) params.set('search', q)
                                        if (searchMode) params.set('searchMode', searchMode)
                                        if (selectedZoneId) params.set('zoneId', selectedZoneId)
                                        if (targetUnitId) params.set('targetUnitId', targetUnitId)
                                        if (selectedCategoryIds.length > 0) params.set('categoryIds', selectedCategoryIds.join(','))
                                        if (displayInternalCode) params.set('internalCode', 'true')
                                        const { data: { session } } = await supabase.auth.getSession()
                                        if (session?.access_token) params.set('token', session.access_token)
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
                                    className={`p-2 border border-stone-300 dark:border-stone-700 rounded-md transition-all ${loadingCompany ? 'opacity-50 cursor-wait bg-stone-100' : 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 active:scale-95'}`}
                                    title="Xuất Excel"
                                >
                                    <FileSpreadsheet className="w-5 h-4" />
                                </button>
                                <button
                                    onClick={async () => {
                                        if (loadingCompany) return
                                        const params = new URLSearchParams()
                                        params.set('type', activeTab)
                                        if (systemType) params.set('systemType', systemType)
                                        if (dateFrom) params.set('dateFrom', dateFrom)
                                        if (dateTo) params.set('dateTo', dateTo)
                                        if (selectedBranch && selectedBranch !== 'Tất cả') params.set('warehouse', selectedBranch)
                                        if (q) params.set('search', q)
                                        if (searchMode) params.set('searchMode', searchMode)
                                        if (selectedZoneId) params.set('zoneId', selectedZoneId)
                                        if (targetUnitId) params.set('targetUnitId', targetUnitId)
                                        if (selectedCategoryIds.length > 0) params.set('categoryIds', selectedCategoryIds.join(','))
                                        if (displayInternalCode) params.set('internalCode', 'true')
                                        const { data: { session } } = await supabase.auth.getSession()
                                        if (session?.access_token) params.set('token', session.access_token)
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
                                    className={`p-2 border border-stone-300 dark:border-stone-700 rounded-md transition-all ${loadingCompany ? 'opacity-50 cursor-wait bg-stone-100' : 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 active:scale-95'}`}
                                    title="In báo cáo"
                                >
                                    <Printer className="w-5 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Category Multi-select (Full Width) */}
                    <div className="w-full">
                        <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 block">
                            Danh mục
                        </label>
                        <div className="relative group min-h-[42px] w-full border border-stone-300 dark:border-stone-700 rounded-md bg-transparent focus-within:ring-2 focus-within:ring-orange-500 transition-all flex flex-wrap gap-2 p-2">
                            {selectedCategoryIds.length === 0 && (
                                <span className="text-stone-400 text-sm px-2 py-1 italic">Tất cả danh mục sản phẩm (hoặc chọn bên dưới)</span>
                            )}
                            {selectedCategoryIds.map(id => {
                                const cat = categories.find(c => c.id === id)
                                return (
                                    <span key={id} className="relative z-20 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs pl-2.5 pr-1.5 py-1 rounded-full border border-orange-200 dark:border-orange-800/50 flex items-center gap-1.5 group/chip hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors">
                                        {cat?.name || id}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                e.preventDefault()
                                                setSelectedCategoryIds(prev => prev.filter(x => x !== id))
                                            }}
                                            className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-400 hover:text-orange-800 dark:hover:text-orange-100 transition-colors font-bold cursor-pointer"
                                        >
                                            ×
                                        </button>
                                    </span>
                                )
                            })}
                            
                            <div className="relative flex-1 min-w-[120px]">
                                <select
                                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val && !selectedCategoryIds.includes(val)) {
                                            setSelectedCategoryIds(prev => [...prev, val])
                                        }
                                        e.target.value = ""
                                    }}
                                >
                                    <option value="">+ Thêm danh mục...</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <div className="text-sm text-orange-500 py-1 px-2 flex items-center gap-1 pointer-events-none">
                                    <span className="text-lg">+</span> Thêm...
                                </div>
                            </div>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none group-focus-within:text-orange-500 transition-colors" />
                        </div>
                    </div>

                    {/* Row 3: Zone selector (Only for LOT tab) */}
                    {activeTab === 'lot' && (
                        <div className="w-full pt-2 border-t border-stone-100 dark:border-stone-800">
                            <label className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2 block">
                                Khu vực / Dãy hàng
                            </label>
                            <HorizontalZoneFilter
                                selectedZoneId={selectedZoneId}
                                onZoneSelect={setSelectedZoneId}
                                zones={lotHookData.allZones}
                                showSearch={false}
                                variant="subtle"
                                compact={true}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                {activeTab === 'accounting' && (
                    <div className="h-full space-y-4 overflow-y-auto">
                        {loading ? (
                            <div className="p-8 text-center text-stone-500 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800">
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang tải dữ liệu...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="md:hidden">
                                    <MobileInventoryList items={items} />
                                </div>

                                <div className="hidden md:block rounded-md border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm overflow-hidden">
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
                                                {items.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                                                            Không có dữ liệu tồn kho trong giai đoạn này.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    <>
                                                        {items.map((item, idx) => {
                                                            const displayCode = displayInternalCode && item.internalCode ? item.internalCode : item.productCode || 'N/A'
                                                            const displayName = displayInternalCode && item.internalName ? item.internalName : item.productName

                                                            return (
                                                                <tr key={idx} className={`hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors ${item.isUnconvertible ? 'bg-orange-50 dark:bg-orange-950/20' : ''}`}>
                                                                    <td className="px-4 py-3 text-stone-600 dark:text-stone-400">{item.warehouse}</td>
                                                                    <td className="px-4 py-3 font-mono text-stone-600 dark:text-stone-400">{displayCode}</td>
                                                                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100 flex items-center gap-2">
                                                                        {displayName}
                                                                        {item.categoryName && (
                                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-600 border border-blue-200">
                                                                                {item.categoryName}
                                                                            </span>
                                                                        )}
                                                                        {item.isUnconvertible && (
                                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-600 border border-orange-200">
                                                                                Chưa thể quy đổi
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right tabular-nums text-stone-600">{formatQuantityFull(item.opening)}</td>
                                                                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">+{formatQuantityFull(item.qtyIn)}</td>
                                                                    <td className="px-4 py-3 text-right tabular-nums text-rose-600 font-medium">-{formatQuantityFull(item.qtyOut)}</td>
                                                                    <td className="px-4 py-3 text-right tabular-nums font-bold text-stone-900 dark:text-stone-100">{formatQuantityFull(item.balance)}</td>
                                                                    <td className="px-4 py-3 text-center text-stone-500">{item.unit}</td>
                                                                </tr>
                                                            )
                                                        })}
                                                        <tr className="bg-stone-100/50 dark:bg-stone-800 font-bold border-t-2 border-stone-300 dark:border-stone-700">
                                                            <td colSpan={3} className="px-4 py-3 text-right text-stone-600 dark:text-stone-400">Tổng cộng:</td>
                                                            <td className="px-4 py-3 text-right tabular-nums">{formatQuantityFull(totals.opening)}</td>
                                                            <td className="px-4 py-3 text-right tabular-nums text-emerald-700">+{formatQuantityFull(totals.qtyIn)}</td>
                                                            <td className="px-4 py-3 text-right tabular-nums text-rose-700">-{formatQuantityFull(totals.qtyOut)}</td>
                                                            <td className="px-4 py-3 text-right tabular-nums text-stone-900 dark:text-white">{formatQuantityFull(totals.balance)}</td>
                                                            <td></td>
                                                        </tr>
                                                    </>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'category' && (
                    <InventoryByCategory 
                        groupedInventory={lotHookData.groupedInventory} 
                        loading={lotHookData.loading}
                        categoryMap={lotHookData.categoryMap}
                        displayInternalCode={displayInternalCode}
                        selectedCategoryIds={selectedCategoryIds}
                    />
                )}

                {activeTab === 'lot' && (
                    <InventoryByLot units={units} hookData={lotHookData} hideFilters={true} />
                )}

                {activeTab === 'tags' && (
                    <InventoryByTag
                        units={units}
                        systemType={systemType}
                        selectedBranch={selectedBranch}
                        targetUnitId={targetUnitId}
                        searchTerm={q}
                        searchMode={searchMode}
                    />
                )}

                {activeTab === 'reconciliation' && (
                    <InventoryReconciliation units={units} />
                )}
            </div>

            <SearchHelpModal
                isOpen={isHelpOpen}
                onOpenChange={setIsHelpOpen}
            />
        </div>
    )
}
