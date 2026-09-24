'use client'

import React, { useState, useMemo } from 'react'
import { 
    X, 
    FileSpreadsheet, 
    Printer, 
    ArrowUpDown, 
    ArrowUp, 
    ArrowDown, 
    Calendar, 
    Search, 
    Package, 
    MapPin, 
    Layers, 
    Loader2,
    CalendarDays,
    BarChart3
} from 'lucide-react'
import { format } from 'date-fns'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { usePrintCompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { 
    exportWarehouseSearchReportToExcel, 
    SearchReportExcelItem 
} from '@/lib/warehouseSearchReportExcelExport'

export type SortByField = 'date' | 'position' | 'product_name' | 'sku' | 'quantity'
export type SortOrder = 'asc' | 'desc'
export type DateFieldOption = 'auto' | 'inbound_date' | 'packaging_date' | 'peeling_date' | 'created_at'

interface WarehouseSearchReportModalProps {
    isOpen: boolean
    onClose: () => void
    positions: any[] // PositionWithZone[]
    zones: any[]
    lotInfo: Record<string, any>
    searchTerm?: string
    categoryName?: string
    selectedPositionIds?: Set<string>
}

export function WarehouseSearchReportModal({
    isOpen,
    onClose,
    positions,
    zones,
    lotInfo,
    searchTerm = '',
    categoryName = '',
    selectedPositionIds = new Set()
}: WarehouseSearchReportModalProps) {
    const { currentSystem, systemType } = useSystem()
    const { showToast } = useToast()
    const { companyInfo } = usePrintCompanyInfo()

    const [activeTab, setActiveTab] = useState<'detail' | 'date_summary' | 'product_summary'>('detail')
    const [sortBy, setSortBy] = useState<SortByField>('date')
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
    const [dateField, setDateField] = useState<DateFieldOption>('auto')
    const [scope, setScope] = useState<'all' | 'selected'>(selectedPositionIds.size > 0 ? 'selected' : 'all')
    const [modalSearch, setModalSearch] = useState('')
    const [isExporting, setIsExporting] = useState(false)

    // Helper: Build zone path (Kho • Dãy/Sảnh • Ô • Tầng)
    const getZonePath = (zoneId: string | null | undefined) => {
        if (!zoneId) return ''
        let currentId: string | null = zoneId
        const parts: string[] = []
        let depth = 0
        while (currentId && depth < 10) {
            const z = zones.find(item => item.id === currentId)
            if (z) {
                parts.unshift(z.name)
                currentId = z.parent_id
            } else {
                break
            }
            depth++
        }
        return parts.join(' • ')
    }

    // Helper: Format date string to dd/MM/yyyy
    const formatDateDisplay = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-'
        try {
            const d = new Date(dateStr)
            if (isNaN(d.getTime())) return dateStr
            return format(d, 'dd/MM/yyyy')
        } catch {
            return dateStr
        }
    }

    // Filter positions by scope
    const targetPositions = useMemo(() => {
        if (scope === 'selected' && selectedPositionIds.size > 0) {
            return positions.filter(p => {
                if (selectedPositionIds.has(p.id)) return true
                const realIds = (p as any).realIds
                return realIds && Array.isArray(realIds) && realIds.some((id: string) => selectedPositionIds.has(id))
            })
        }
        return positions
    }, [positions, scope, selectedPositionIds])

    // Flatten positions & lots into report items
    const rawItems: SearchReportExcelItem[] = useMemo(() => {
        const list: SearchReportExcelItem[] = []

        targetPositions.forEach(pos => {
            const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
            const zonePath = getZonePath(pos.zone_id)
            const warehouseName = zonePath.split(' • ')[0] || currentSystem?.name || systemType || 'Kho'

            if (!lot) {
                // Pos without LOT
                return
            }

            // Determine effective date and its type based on dateField option
            const resolveDate = () => {
                if (dateField === 'inbound_date') {
                    return { date: lot.inbound_date || null, type: 'Ngày nhập kho' }
                }
                if (dateField === 'packaging_date') {
                    return { date: lot.packaging_date || null, type: 'Ngày đóng gói' }
                }
                if (dateField === 'peeling_date') {
                    return { date: lot.peeling_date || null, type: 'Ngày bóc múi' }
                }
                if (dateField === 'created_at') {
                    return { date: lot.created_at || null, type: 'Ngày tạo' }
                }
                // 'auto': prioritize inbound -> packaging -> peeling -> created_at
                if (lot.inbound_date) return { date: lot.inbound_date, type: 'Ngày nhập kho' }
                if (lot.packaging_date) return { date: lot.packaging_date, type: 'Ngày đóng gói' }
                if (lot.peeling_date) return { date: lot.peeling_date, type: 'Ngày bóc múi' }
                if (lot.created_at) return { date: lot.created_at, type: 'Ngày tạo' }
                return { date: null, type: 'Chưa có ngày' }
            }

            const { date: chosenDate, type: chosenDateType } = resolveDate()

            const packagingDateFormatted = lot.packaging_date ? formatDateDisplay(lot.packaging_date) : undefined
            const peelingDateFormatted = lot.peeling_date ? formatDateDisplay(lot.peeling_date) : undefined
            const inboundDateFormatted = lot.inbound_date ? formatDateDisplay(lot.inbound_date) : undefined
            const prodName = lot.productions?.name || lot.production_code || undefined

            if (lot.items && lot.items.length > 0) {
                lot.items.forEach((item: any) => {
                    list.push({
                        productName: item.product_name || lot.products?.name || '',
                        sku: item.sku || item.internal_code || lot.products?.sku || '',
                        positionCode: pos.code,
                        zonePath,
                        warehouse: warehouseName,
                        date: chosenDate,
                        dateFormatted: formatDateDisplay(chosenDate),
                        dateType: chosenDateType,
                        packagingDateFormatted,
                        peelingDateFormatted,
                        inboundDateFormatted,
                        quantity: Number(item.quantity) || 0,
                        unit: item.unit || lot.products?.unit || '',
                        lotCode: lot.code || '',
                        productionName: prodName,
                        tags: item.tags?.join(', ') || lot.tags?.join(', ') || undefined,
                        notes: lot.notes || undefined
                    })
                })
            } else if (lot.products) {
                list.push({
                    productName: lot.products.name || '',
                    sku: lot.products.sku || lot.products.internal_code || '',
                    positionCode: pos.code,
                    zonePath,
                    warehouse: warehouseName,
                    date: chosenDate,
                    dateFormatted: formatDateDisplay(chosenDate),
                    dateType: chosenDateType,
                    packagingDateFormatted,
                    peelingDateFormatted,
                    inboundDateFormatted,
                    quantity: Number(lot.quantity) || 0,
                    unit: lot.products.unit || '',
                    lotCode: lot.code || '',
                    productionName: prodName,
                    tags: lot.tags?.join(', ') || undefined,
                    notes: lot.notes || undefined
                })
            }
        })

        return list
    }, [targetPositions, lotInfo, dateField, zones, currentSystem?.name, systemType])

    // Filter by modal search input (quick search)
    const filteredItems = useMemo(() => {
        if (!modalSearch.trim()) return rawItems
        const q = modalSearch.trim().toLowerCase()
        return rawItems.filter(item => {
            return (
                item.productName.toLowerCase().includes(q) ||
                item.sku.toLowerCase().includes(q) ||
                item.positionCode.toLowerCase().includes(q) ||
                item.lotCode.toLowerCase().includes(q) ||
                (item.zonePath && item.zonePath.toLowerCase().includes(q)) ||
                (item.productionName && item.productionName.toLowerCase().includes(q)) ||
                (item.tags && item.tags.toLowerCase().includes(q))
            )
        })
    }, [rawItems, modalSearch])

    // Sort items
    const sortedItems = useMemo(() => {
        const sorted = [...filteredItems]
        const multiplier = sortOrder === 'asc' ? 1 : -1

        sorted.sort((a, b) => {
            if (sortBy === 'date') {
                if (!a.date && !b.date) return 0
                if (!a.date) return 1
                if (!b.date) return -1
                return a.date.localeCompare(b.date) * multiplier
            }
            if (sortBy === 'position') {
                return (a.positionCode || '').localeCompare(b.positionCode || '', undefined, { numeric: true }) * multiplier
            }
            if (sortBy === 'product_name') {
                return (a.productName || '').localeCompare(b.productName || '', 'vi') * multiplier
            }
            if (sortBy === 'sku') {
                return (a.sku || '').localeCompare(b.sku || '') * multiplier
            }
            if (sortBy === 'quantity') {
                return (a.quantity - b.quantity) * multiplier
            }
            return 0
        })

        return sorted
    }, [filteredItems, sortBy, sortOrder])

    // Summary statistics
    const stats = useMemo(() => {
        const uniquePos = new Set<string>()
        const uniqueSkus = new Set<string>()
        let totalQty = 0
        let oldest: string | null = null
        let newest: string | null = null
        const unitMap: Record<string, number> = {}

        rawItems.forEach(it => {
            if (it.positionCode) uniquePos.add(it.positionCode)
            if (it.sku || it.productName) uniqueSkus.add(it.sku || it.productName)
            const q = Number(it.quantity) || 0
            totalQty += q
            if (it.unit) {
                unitMap[it.unit] = (unitMap[it.unit] || 0) + q
            }
            if (it.date) {
                if (!oldest || it.date < oldest) oldest = it.date
                if (!newest || it.date > newest) newest = it.date
            }
        })

        const unitsSummary = Object.entries(unitMap)
            .map(([unit, qty]) => `${Math.round(qty * 1000) / 1000} ${unit}`)
            .join(' | ')

        return {
            totalPositions: uniquePos.size,
            totalItems: rawItems.length,
            uniqueProducts: uniqueSkus.size,
            totalQuantity: totalQty,
            unitsSummary,
            oldestDate: oldest ? formatDateDisplay(oldest) : null,
            newestDate: newest ? formatDateDisplay(newest) : null
        }
    }, [rawItems])

    // Groups by date
    const dateGroups = useMemo(() => {
        const map = new Map<string, {
            rawDate: string | null;
            dateFormatted: string;
            positions: Set<string>;
            totalQty: number;
            units: Set<string>;
            productCount: Set<string>;
        }>()

        rawItems.forEach(it => {
            const key = it.dateFormatted || '(Không có ngày)'
            if (!map.has(key)) {
                map.set(key, {
                    rawDate: it.date,
                    dateFormatted: key,
                    positions: new Set(),
                    totalQty: 0,
                    units: new Set(),
                    productCount: new Set()
                })
            }
            const g = map.get(key)!
            if (it.positionCode) g.positions.add(it.positionCode)
            g.totalQty += (Number(it.quantity) || 0)
            if (it.unit) g.units.add(it.unit)
            g.productCount.add(it.sku || it.productName)
        })

        const arr = Array.from(map.values())
        const multiplier = sortOrder === 'asc' ? 1 : -1
        arr.sort((a, b) => {
            if (!a.rawDate && !b.rawDate) return 0
            if (!a.rawDate) return 1
            if (!b.rawDate) return -1
            return a.rawDate.localeCompare(b.rawDate) * multiplier
        })
        return arr
    }, [rawItems, sortOrder])

    // Groups by product
    const productGroups = useMemo(() => {
        const map = new Map<string, {
            sku: string;
            name: string;
            positions: Set<string>;
            totalQty: number;
            unit: string;
            oldestDate: string | null;
            newestDate: string | null;
        }>()

        rawItems.forEach(it => {
            const key = `${it.sku || ''}_${it.productName}`
            if (!map.has(key)) {
                map.set(key, {
                    sku: it.sku || '',
                    name: it.productName,
                    positions: new Set(),
                    totalQty: 0,
                    unit: it.unit,
                    oldestDate: null,
                    newestDate: null
                })
            }
            const g = map.get(key)!
            if (it.positionCode) g.positions.add(it.positionCode)
            g.totalQty += (Number(it.quantity) || 0)
            if (it.date) {
                if (!g.oldestDate || it.date < g.oldestDate) g.oldestDate = it.date
                if (!g.newestDate || it.date > g.newestDate) g.newestDate = it.date
            }
        })

        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    }, [rawItems])

    // Handle column click sorting
    const handleColumnSort = (field: SortByField) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('asc')
        }
    }

    // Handle Excel export
    const handleExportExcel = async () => {
        if (sortedItems.length === 0) {
            showToast('Không có dữ liệu để xuất Excel', 'warning')
            return
        }

        setIsExporting(true)
        try {
            const sortLabelMap: Record<SortByField, string> = {
                date: 'Ngày nhập kho',
                position: 'Vị trí',
                product_name: 'Tên sản phẩm',
                sku: 'Mã sản phẩm (SKU)',
                quantity: 'Số lượng'
            }
            const orderLabel = sortOrder === 'asc' ? 'Từ nhỏ đến lớn / Cũ đến mới' : 'Từ lớn đến nhỏ / Mới đến cũ'
            const sortDesc = `${sortLabelMap[sortBy]} (${orderLabel})`

            const dateFieldDescMap: Record<DateFieldOption, string> = {
                auto: 'Tự động',
                inbound_date: 'Ngày nhập kho',
                packaging_date: 'Ngày đóng gói',
                peeling_date: 'Ngày bóc múi',
                created_at: 'Ngày tạo'
            }

            const fileName = await exportWarehouseSearchReportToExcel({
                items: sortedItems,
                searchTerm,
                categoryName,
                systemName: currentSystem?.name || systemType || 'Kho',
                sortDescription: sortDesc,
                dateFieldDescription: dateFieldDescMap[dateField],
                totalPositions: stats.totalPositions,
                totalQuantity: stats.totalQuantity,
                oldestDate: stats.oldestDate,
                newestDate: stats.newestDate,
                companyInfo
            })

            showToast(`Đã xuất file Excel: ${fileName}`, 'success')
        } catch (error: any) {
            console.error('Lỗi xuất Excel báo cáo:', error)
            showToast(`Lỗi khi xuất file Excel: ${error?.message || 'Không xác định'}`, 'error')
        } finally {
            setIsExporting(false)
        }
    }

    // Handle print
    const handlePrint = () => {
        window.print()
    }

    if (!isOpen) return null

    const displayTitle = searchTerm ? `Tìm kiếm: "${searchTerm}"` : categoryName ? `Danh mục: "${categoryName}"` : 'Tất cả vị trí'

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-7xl max-h-[94vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                
                {/* 1. Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-emerald-50/80 via-white to-white dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
                            <FileSpreadsheet size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                                    Báo cáo vị trí & sản phẩm theo ngày
                                </h2>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    {displayTitle}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Kho: <span className="font-semibold text-slate-700 dark:text-slate-300">{currentSystem?.name || systemType || 'Kho'}</span> | Tìm thấy <span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.totalPositions} vị trí</span> ({stats.totalItems} dòng hàng)
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Nút Xuất Excel */}
                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting || sortedItems.length === 0}
                            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                            title="Tải file Excel đầy đủ chi tiết và tổng hợp"
                        >
                            {isExporting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <FileSpreadsheet size={16} />
                            )}
                            <span className="hidden sm:inline">Xuất file Excel</span>
                        </button>

                        {/* Nút In */}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
                            title="In báo cáo"
                        >
                            <Printer size={15} />
                            <span className="hidden md:inline">In</span>
                        </button>

                        {/* Nút Đóng */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Đóng modal"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* 2. KPI Summary Cards */}
                <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <MapPin size={16} />
                        </div>
                        <div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Vị trí lưu kho</div>
                            <div className="text-sm font-bold text-slate-800 dark:text-white">
                                {stats.totalPositions} <span className="text-[10px] font-normal text-slate-400">vị trí</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <Package size={16} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Tổng số lượng</div>
                            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate" title={stats.unitsSummary}>
                                {stats.totalQuantity.toLocaleString()}
                                {stats.unitsSummary && (
                                    <span className="text-[10px] font-normal text-slate-500 ml-1 truncate">
                                        ({stats.unitsSummary})
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <CalendarDays size={16} />
                        </div>
                        <div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Khoảng ngày</div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {stats.oldestDate || '--'} <span className="text-slate-400">➔</span> {stats.newestDate || '--'}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                            <BarChart3 size={16} />
                        </div>
                        <div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Sản phẩm khác nhau</div>
                            <div className="text-sm font-bold text-purple-700 dark:text-purple-400">
                                {stats.uniqueProducts} <span className="text-[10px] font-normal text-slate-400">loại</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Toolbar Controls: Sorting, Date field, Scope, Quick search */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 text-xs">
                    
                    {/* Left: View Tabs */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                        <button
                            onClick={() => setActiveTab('detail')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                activeTab === 'detail'
                                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            Chi tiết vị trí ({filteredItems.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('date_summary')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                activeTab === 'date_summary'
                                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            Tổng hợp theo ngày ({dateGroups.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('product_summary')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                                activeTab === 'product_summary'
                                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                        >
                            Tổng hợp theo SP ({productGroups.length})
                        </button>
                    </div>

                    {/* Center: Sorting & Date controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Sắp xếp theo */}
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                            <span className="text-slate-500 font-medium">Sắp xếp:</span>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortByField)}
                                className="bg-transparent font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                            >
                                <option value="date" className="dark:bg-slate-800">Theo ngày nhập kho</option>
                                <option value="position" className="dark:bg-slate-800">Theo vị trí</option>
                                <option value="product_name" className="dark:bg-slate-800">Theo tên sản phẩm</option>
                                <option value="sku" className="dark:bg-slate-800">Theo mã SP (SKU)</option>
                                <option value="quantity" className="dark:bg-slate-800">Theo số lượng</option>
                            </select>
                        </div>

                        {/* Thứ tự sắp xếp: Nhỏ đến lớn vs Lớn đến nhỏ */}
                        <button
                            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-xl font-bold hover:bg-emerald-100 transition-all cursor-pointer"
                            title="Bấm để đổi hướng sắp xếp"
                        >
                            {sortOrder === 'asc' ? (
                                <>
                                    <ArrowUp size={14} className="text-emerald-600" />
                                    <span>Từ nhỏ đến lớn (Cũ nhất trước)</span>
                                </>
                            ) : (
                                <>
                                    <ArrowDown size={14} className="text-emerald-600" />
                                    <span>Từ lớn đến nhỏ (Mới nhất trước)</span>
                                </>
                            )}
                        </button>

                        {/* Loại ngày đối soát */}
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-xl">
                            <Calendar size={13} className="text-slate-400" />
                            <select
                                value={dateField}
                                onChange={(e) => setDateField(e.target.value as DateFieldOption)}
                                className="bg-transparent font-medium text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                            >
                                <option value="auto" className="dark:bg-slate-800">Ngày: Tự động</option>
                                <option value="inbound_date" className="dark:bg-slate-800">Ngày: Nhập kho</option>
                                <option value="packaging_date" className="dark:bg-slate-800">Ngày: Đóng gói</option>
                                <option value="peeling_date" className="dark:bg-slate-800">Ngày: Bóc múi</option>
                                <option value="created_at" className="dark:bg-slate-800">Ngày: Tạo lô</option>
                            </select>
                        </div>

                        {/* Scope (Tất cả vs Vị trí đã chọn) */}
                        {selectedPositionIds.size > 0 && (
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                                <button
                                    onClick={() => setScope('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                                        scope === 'all'
                                            ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                            : 'text-slate-500'
                                    }`}
                                >
                                    Tất cả ({positions.length})
                                </button>
                                <button
                                    onClick={() => setScope('selected')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        scope === 'selected'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Đã chọn ({selectedPositionIds.size})
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right: Quick filter search */}
                    <div className="relative min-w-[200px]">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Lọc nhanh SP, vị trí, LOT..."
                            value={modalSearch}
                            onChange={(e) => setModalSearch(e.target.value)}
                            className="w-full pl-8 pr-7 py-1 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-emerald-500"
                        />
                        {modalSearch && (
                            <button
                                onClick={() => setModalSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 4. Table Content Body */}
                <div className="flex-1 overflow-auto custom-scrollbar p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    
                    {/* TAB 1: BẢNG CHI TIẾT VỊ TRÍ */}
                    {activeTab === 'detail' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 select-none">
                                        <th className="py-2.5 px-3 text-center w-12">STT</th>
                                        
                                        {/* Sortable Header: Tên sản phẩm */}
                                        <th 
                                            className="py-2.5 px-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-600/50 transition-colors"
                                            onClick={() => handleColumnSort('product_name')}
                                        >
                                            <div className="flex items-center gap-1.5">
                                                <span>Tên sản phẩm</span>
                                                {sortBy === 'product_name' ? (
                                                    sortOrder === 'asc' ? <ArrowUp size={13} className="text-emerald-600" /> : <ArrowDown size={13} className="text-emerald-600" />
                                                ) : <ArrowUpDown size={12} className="text-slate-400" />}
                                            </div>
                                        </th>

                                        {/* Sortable Header: Mã SP (SKU) */}
                                        <th 
                                            className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-600/50 transition-colors w-28"
                                            onClick={() => handleColumnSort('sku')}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Mã SP</span>
                                                {sortBy === 'sku' ? (
                                                    sortOrder === 'asc' ? <ArrowUp size={13} className="text-emerald-600" /> : <ArrowDown size={13} className="text-emerald-600" />
                                                ) : <ArrowUpDown size={12} className="text-slate-400" />}
                                            </div>
                                        </th>

                                        {/* Sortable Header: Vị trí */}
                                        <th 
                                            className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-600/50 transition-colors w-32"
                                            onClick={() => handleColumnSort('position')}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Vị trí</span>
                                                {sortBy === 'position' ? (
                                                    sortOrder === 'asc' ? <ArrowUp size={13} className="text-emerald-600" /> : <ArrowDown size={13} className="text-emerald-600" />
                                                ) : <ArrowUpDown size={12} className="text-slate-400" />}
                                            </div>
                                        </th>

                                        <th className="py-2.5 px-3">Khu vực / Dãy - Ô</th>

                                        {/* Sortable Header: Ngày nhập kho */}
                                        <th 
                                            className="py-2.5 px-3 text-center cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-600/50 transition-colors w-36"
                                            onClick={() => handleColumnSort('date')}
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>Ngày nhập kho</span>
                                                {sortBy === 'date' ? (
                                                    sortOrder === 'asc' ? <ArrowUp size={13} className="text-emerald-600" /> : <ArrowDown size={13} className="text-emerald-600" />
                                                ) : <ArrowUpDown size={12} className="text-slate-400" />}
                                            </div>
                                        </th>

                                        {/* Sortable Header: Số lượng */}
                                        <th 
                                            className="py-2.5 px-3 text-right cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-600/50 transition-colors w-24"
                                            onClick={() => handleColumnSort('quantity')}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Số lượng</span>
                                                {sortBy === 'quantity' ? (
                                                    sortOrder === 'asc' ? <ArrowUp size={13} className="text-emerald-600" /> : <ArrowDown size={13} className="text-emerald-600" />
                                                ) : <ArrowUpDown size={12} className="text-slate-400" />}
                                            </div>
                                        </th>

                                        <th className="py-2.5 px-3 text-center w-16">ĐVT</th>
                                        <th className="py-2.5 px-3 text-center w-28">Mã LOT</th>
                                        <th className="py-2.5 px-3 w-32">Lệnh sản xuất</th>
                                        <th className="py-2.5 px-3 w-28">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {sortedItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="py-12 text-center text-slate-400">
                                                Không có dữ liệu phù hợp với điều kiện tìm kiếm.
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedItems.map((item, idx) => (
                                            <tr 
                                                key={`${item.positionCode}-${item.lotCode}-${idx}`} 
                                                className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                                            >
                                                <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                                                    {idx + 1}
                                                </td>
                                                <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-100">
                                                    {item.productName}
                                                </td>
                                                <td className="py-2 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                                    {item.sku}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                                                        {item.positionCode}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[200px]" title={item.zonePath}>
                                                    {item.zonePath}
                                                </td>
                                                <td className="py-2 px-3 text-center">
                                                    <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
                                                        <Calendar size={12} className="text-amber-500" />
                                                        {item.dateFormatted}
                                                    </div>
                                                </td>
                                                <td className="py-2 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                                    {item.quantity.toLocaleString()}
                                                </td>
                                                <td className="py-2 px-3 text-center text-slate-500">
                                                    {item.unit}
                                                </td>
                                                <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                                    {item.lotCode || '--'}
                                                </td>
                                                <td className="py-2 px-3 text-[11px] text-rose-600 dark:text-rose-400 font-medium truncate max-w-[130px]" title={item.productionName}>
                                                    {item.productionName || '--'}
                                                </td>
                                                <td className="py-2 px-3 text-[11px] text-slate-500 italic truncate max-w-[130px]" title={item.notes || item.tags}>
                                                    {item.notes || item.tags || '--'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-emerald-50/80 dark:bg-emerald-950/40 border-t-2 border-emerald-500 font-bold text-slate-800 dark:text-slate-100">
                                        <td colSpan={6} className="py-2.5 px-3 text-center text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                                            TỔNG CỘNG ({sortedItems.length} dòng hàng / {stats.totalPositions} vị trí)
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-sm text-blue-700 dark:text-blue-300">
                                            {stats.totalQuantity.toLocaleString()}
                                        </td>
                                        <td colSpan={4} className="py-2.5 px-3 text-slate-500 text-xs">
                                            {stats.unitsSummary}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* TAB 2: TỔNG HỢP THEO NGÀY */}
                    {activeTab === 'date_summary' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2.5 px-3 text-center w-12">STT</th>
                                        <th className="py-2.5 px-3 text-center w-36">Ngày nhập kho</th>
                                        <th className="py-2.5 px-3 text-center w-28">Số lượng vị trí</th>
                                        <th className="py-2.5 px-3 text-right w-32">Tổng số lượng</th>
                                        <th className="py-2.5 px-3 text-center w-24">Đơn vị tính</th>
                                        <th className="py-2.5 px-3 text-center w-28">Số loại sản phẩm</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {dateGroups.map((g, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                                                {idx + 1}
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-bold text-amber-700 dark:text-amber-400">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <Calendar size={13} className="text-amber-500" />
                                                    <span>{g.dateFormatted}</span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                                    {g.positions.size} vị trí
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                                                {g.totalQty.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-slate-500">
                                                {Array.from(g.units).join(', ')}
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-300">
                                                {g.productCount.size} loại SP
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-emerald-50/80 dark:bg-emerald-950/40 border-t-2 border-emerald-500 font-bold">
                                        <td colSpan={3} className="py-2.5 px-3 text-center text-emerald-800 dark:text-emerald-300">
                                            TỔNG CỘNG
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-sm text-blue-700 dark:text-blue-300">
                                            {stats.totalQuantity.toLocaleString()}
                                        </td>
                                        <td colSpan={2} className="py-2.5 px-3 text-slate-500">
                                            {stats.unitsSummary}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* TAB 3: TỔNG HỢP THEO SẢN PHẨM */}
                    {activeTab === 'product_summary' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                                        <th className="py-2.5 px-3 text-center w-12">STT</th>
                                        <th className="py-2.5 px-3 text-center w-32">Mã SP (SKU)</th>
                                        <th className="py-2.5 px-3">Tên sản phẩm</th>
                                        <th className="py-2.5 px-3 text-center w-28">Số lượng vị trí</th>
                                        <th className="py-2.5 px-3 text-right w-32">Tổng số lượng</th>
                                        <th className="py-2.5 px-3 text-center w-24">Đơn vị tính</th>
                                        <th className="py-2.5 px-3 text-center w-28">Ngày cũ nhất</th>
                                        <th className="py-2.5 px-3 text-center w-28">Ngày mới nhất</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                    {productGroups.map((g, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                                                {idx + 1}
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                                {g.sku}
                                            </td>
                                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-100">
                                                {g.name}
                                            </td>
                                            <td className="py-2.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">
                                                    {g.positions.size} vị trí
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                                                {g.totalQty.toLocaleString()}
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-slate-500">
                                                {g.unit}
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-amber-700 dark:text-amber-400 font-medium">
                                                {g.oldestDate ? formatDateDisplay(g.oldestDate) : '--'}
                                            </td>
                                            <td className="py-2.5 px-3 text-center text-emerald-700 dark:text-emerald-400 font-medium">
                                                {g.newestDate ? formatDateDisplay(g.newestDate) : '--'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-emerald-50/80 dark:bg-emerald-950/40 border-t-2 border-emerald-500 font-bold">
                                        <td colSpan={4} className="py-2.5 px-3 text-center text-emerald-800 dark:text-emerald-300">
                                            TỔNG CỘNG
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-sm text-blue-700 dark:text-blue-300">
                                            {stats.totalQuantity.toLocaleString()}
                                        </td>
                                        <td colSpan={3} className="py-2.5 px-3 text-slate-500">
                                            {stats.unitsSummary}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* 5. Footer Actions */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        <Layers size={14} className="text-emerald-600" />
                        <span>Hiển thị <b>{sortedItems.length}</b> dòng dữ liệu được sắp xếp theo <b>{sortBy === 'date' ? 'Ngày' : sortBy === 'position' ? 'Vị trí' : sortBy === 'product_name' ? 'Tên SP' : sortBy === 'sku' ? 'Mã SP' : 'Số lượng'}</b> ({sortOrder === 'asc' ? 'Từ nhỏ đến lớn / Cũ đến mới' : 'Từ lớn đến nhỏ / Mới đến cũ'})</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={isExporting || sortedItems.length === 0}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {isExporting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <FileSpreadsheet size={16} />
                            )}
                            <span>Xuất Excel (.xlsx)</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    )
}
