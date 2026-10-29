'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { advancedMatchSearch } from '@/lib/searchUtils'
import { formatQuantityFull } from '@/lib/numberUtils'
import { format, parseISO } from 'date-fns'
import {
    AGING_DATE_OPTIONS,
    DEFAULT_AGING_THRESHOLDS,
    buildAgingLines,
    buildBuckets,
    computeStats,
    sanitizeThresholds,
    summarizeByLot,
    summarizeByProduct,
    type AgingBucket,
    type AgingDateType,
    type AgingLotSource
} from '@/lib/inventoryAging'
import { exportInventoryAgingToExcel } from '@/lib/inventoryAgingExcelExport'
import {
    CalendarClock, Search, Download, RefreshCw, Plus, X, AlertTriangle,
    Boxes, ChevronDown, ArrowUpDown, Lock, Loader2
} from 'lucide-react'

const PAGE_SIZE = 50

type TabId = 'lot' | 'product'
type SortDir = 'asc' | 'desc'

/** Màu badge/ô theo vị trí nhóm tuổi (càng về sau càng lâu ngày -> càng đỏ). */
function toneClasses(index: number | null, bucketCount: number) {
    if (index === null) return 'bg-stone-100 text-stone-500 border-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-700'
    const ratio = bucketCount > 1 ? index / (bucketCount - 1) : 1
    if (ratio >= 0.999) return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
    if (ratio >= 0.66) return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900'
    if (ratio >= 0.33) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
}

function fmtDay(iso?: string | null) {
    if (!iso) return '---'
    try {
        return format(parseISO(iso), 'dd/MM/yyyy')
    } catch {
        return iso
    }
}

export default function InventoryAgingReportPage() {
    const { systemType, currentSystem, hasModule } = useSystem()
    const { showToast } = useToast()
    const { getBaseAmount, getBaseToKgRate } = useUnitConversion()

    const [lots, setLots] = useState<AgingLotSource[]>([])
    const [categoryMap, setCategoryMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)

    const [dateType, setDateType] = useState<AgingDateType>('inbound_date')
    const [asOfDate, setAsOfDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
    const [thresholdInputs, setThresholdInputs] = useState<string[]>(DEFAULT_AGING_THRESHOLDS.map(String))
    const [minDays, setMinDays] = useState<number | null>(null)
    const [bucketFilter, setBucketFilter] = useState<number | null>(null)
    const [showUndated, setShowUndated] = useState(true)

    const [searchTerm, setSearchTerm] = useState('')
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [warehouseFilter, setWarehouseFilter] = useState('all')
    const [lockFilter, setLockFilter] = useState<'all' | 'unlocked' | 'locked'>('all')
    const [isCatOpen, setIsCatOpen] = useState(false)

    const [tab, setTab] = useState<TabId>('lot')
    const [lotSort, setLotSort] = useState<{ field: 'days' | 'quantity' | 'kg' | 'code'; dir: SortDir }>({ field: 'days', dir: 'desc' })
    const [prodSort, setProdSort] = useState<{ field: 'maxDays' | 'quantity' | 'kg' | 'sku'; dir: SortDir }>({ field: 'maxDays', dir: 'desc' })
    const [page, setPage] = useState(1)

    const isGated = Boolean(currentSystem) && !hasModule('report_inventory_aging')

    const thresholds = useMemo(
        () => sanitizeThresholds(thresholdInputs.map(s => Number(s))),
        [thresholdInputs]
    )
    const buckets: AgingBucket[] = useMemo(() => buildBuckets(thresholds), [thresholds])

    const dateOptions = useMemo(
        () => AGING_DATE_OPTIONS.filter(o => !o.lotModuleId || hasModule(o.lotModuleId)),
        [hasModule]
    )

    // Loại ngày bị khoá theo module của phân hệ -> tự quay về ngày nhập kho
    useEffect(() => {
        if (!dateOptions.some(o => o.id === dateType)) {
            setDateType('inbound_date')
        }
    }, [dateOptions, dateType])

    const fetchAll = useCallback(async (
        table: string,
        selectStr: string,
        filterFn?: (q: any) => any
    ) => {
        const results: any[] = []
        let from = 0
        while (true) {
            let query = (supabase.from(table as any) as any)
                .select(selectStr)
                .order('id', { ascending: true })
                .range(from, from + 1000 - 1)
            if (filterFn) query = filterFn(query)
            const { data, error } = await query
            if (error) throw error
            if (!data || data.length === 0) break
            results.push(...data)
            if (data.length < 1000) break
            from += 1000
        }
        return results
    }, [])

    const fetchData = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        try {
            let sysCode = systemType.trim().toUpperCase()
            if (sysCode === 'FROZEN') sysCode = 'KHO_DONG_LANH'
            else if (sysCode === 'DRY') sysCode = 'KHO_VAT_TU_BAO_BI'

            const [allLots, allLotItems, allProducts, allCatRels, allCategories, allProductionLots, allPositions] = await Promise.all([
                fetchAll('lots', 'id, code, production_code, batch_code, warehouse_name, is_locked, status, quantity, product_id, inbound_date, peeling_date, raw_material_date, packaging_date, metadata, production_lot_id',
                    (q: any) => q.eq('system_code', sysCode).eq('status', 'active')),
                fetchAll('lot_items', 'id, lot_id, product_id, quantity, unit, category_id'),
                fetchAll('products', 'id, sku, name, unit, category_id, aliases, internal_code',
                    (q: any) => q.or(`system_code.eq.${sysCode},system_type.eq.${sysCode}`)),
                fetchAll('product_category_rel', 'product_id, category_id', (q: any) => q.eq('system_type', sysCode)),
                fetchAll('categories', 'id, name', (q: any) => q.eq('system_type', sysCode)),
                fetchAll('production_lots', 'id, lot_code, production_date'),
                fetchAll('positions', 'id, code, lot_id', (q: any) => q.eq('system_type', sysCode))
            ])

            const cMap: Record<string, string> = {}
            allCategories.forEach((c: any) => { cMap[c.id] = c.name })
            setCategoryMap(cMap)

            const relMap = new Map<string, { category_id: string }[]>()
            allCatRels.forEach((r: any) => {
                if (!relMap.has(r.product_id)) relMap.set(r.product_id, [])
                relMap.get(r.product_id)!.push({ category_id: r.category_id })
            })

            const productMap = new Map<string, any>()
            allProducts.forEach((p: any) => {
                productMap.set(p.id, { ...p, product_category_rel: relMap.get(p.id) || [] })
            })

            const itemsByLot = new Map<string, any[]>()
            allLotItems.forEach((item: any) => {
                if (!itemsByLot.has(item.lot_id)) itemsByLot.set(item.lot_id, [])
                itemsByLot.get(item.lot_id)!.push({ ...item, products: productMap.get(item.product_id) || null })
            })

            const posByLot = new Map<string, { code: string }[]>()
            allPositions.forEach((p: any) => {
                if (!p.lot_id) return
                if (!posByLot.has(p.lot_id)) posByLot.set(p.lot_id, [])
                posByLot.get(p.lot_id)!.push({ code: p.code })
            })

            const prodLotDateMap = new Map<string, string>()
            allProductionLots.forEach((pl: any) => {
                if (pl.production_date) prodLotDateMap.set(pl.id, pl.production_date)
            })

            setLots(allLots.map((lot: any) => ({
                ...lot,
                products: productMap.get(lot.product_id) || null,
                lot_items: itemsByLot.get(lot.id) || [],
                positions: posByLot.get(lot.id) || [],
                production_lot_date: lot.production_lot_id ? (prodLotDateMap.get(lot.production_lot_id) || null) : null
            })))
        } catch (err: any) {
            console.error('Error fetching aging report data:', err)
            showToast('Lỗi tải dữ liệu tồn kho: ' + (err?.message || 'Unknown error'), 'error')
        } finally {
            setLoading(false)
        }
    }, [systemType, fetchAll, showToast])

    useEffect(() => {
        if (isGated) {
            setLoading(false)
            return
        }
        fetchData()
    }, [fetchData, isGated])

    const kgOf = useCallback(({ productId, unit, qty, baseUnit }: { productId: string | null; unit: string; qty: number; baseUnit: string | null }) => {
        if (!productId || !baseUnit) return 0
        const baseQty = getBaseAmount(productId, unit, qty, baseUnit)
        const kgRate = getBaseToKgRate(productId, baseUnit)
        return kgRate === null ? 0 : baseQty * kgRate
    }, [getBaseAmount, getBaseToKgRate])

    const lines = useMemo(() => buildAgingLines(lots, {
        dateType,
        asOfDate,
        buckets,
        categoryMap,
        kgOf
    }), [lots, dateType, asOfDate, buckets, categoryMap, kgOf])

    const warehouseOptions = useMemo(() => {
        const set = new Set<string>()
        lots.forEach(l => { if (l.warehouse_name) set.add(l.warehouse_name) })
        return Array.from(set).sort((a, b) => a.localeCompare(b))
    }, [lots])

    const categoryOptions = useMemo(
        () => Object.entries(categoryMap).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
        [categoryMap]
    )

    const filteredLines = useMemo(() => {
        const q = searchTerm.trim()
        return lines.filter(l => {
            if (warehouseFilter !== 'all' && (l.warehouseName || '') !== warehouseFilter) return false
            if (lockFilter === 'locked' && !l.isLocked) return false
            if (lockFilter === 'unlocked' && l.isLocked) return false
            if (!showUndated && l.bucketIndex === null) return false
            if (minDays !== null && (l.days === null || l.days <= minDays)) return false
            if (bucketFilter !== null && l.bucketIndex !== bucketFilter) return false
            if (selectedCategoryIds.length > 0 && !l.categoryIds.some(id => selectedCategoryIds.includes(id))) return false
            if (!q) return true
            const haystack = [
                l.lotCode, l.sku, l.name, l.productionCode || '',
                l.categoryName, l.unit, ...l.positionCodes
            ]
            return advancedMatchSearch(haystack.filter(Boolean), q)
        })
    }, [lines, searchTerm, warehouseFilter, lockFilter, showUndated, minDays, bucketFilter, selectedCategoryIds])

    const lotRows = useMemo(() => {
        const rows = summarizeByLot(filteredLines)
        const dir = lotSort.dir === 'asc' ? 1 : -1
        const value = (r: typeof rows[number]) => {
            if (lotSort.field === 'code') return r.lotCode
            if (lotSort.field === 'quantity') return r.quantity
            if (lotSort.field === 'kg') return r.kg
            return r.days ?? -1
        }
        return rows.sort((a, b) => {
            const va = value(a)
            const vb = value(b)
            if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb)) * dir
            return (Number(va) - Number(vb)) * dir
        })
    }, [filteredLines, lotSort])

    const productRows = useMemo(() => {
        const rows = summarizeByProduct(filteredLines, buckets.length)
        const dir = prodSort.dir === 'asc' ? 1 : -1
        const value = (r: typeof rows[number]) => {
            if (prodSort.field === 'sku') return r.sku
            if (prodSort.field === 'quantity') return r.quantity
            if (prodSort.field === 'kg') return r.kg
            return r.maxDays ?? -1
        }
        return rows.sort((a, b) => {
            const va = value(a)
            const vb = value(b)
            if (typeof va === 'string' || typeof vb === 'string') return String(va).localeCompare(String(vb)) * dir
            return (Number(va) - Number(vb)) * dir
        })
    }, [filteredLines, buckets, prodSort])

    const stats = useMemo(() => computeStats(lotRows, buckets), [lotRows, buckets])
    const activeDateLabel = dateOptions.find(o => o.id === dateType)?.label || 'Ngày nhập kho'

    const filterSignature = `${searchTerm}|${selectedCategoryIds.join(',')}|${warehouseFilter}|${lockFilter}|${showUndated}|${minDays}|${bucketFilter}|${dateType}|${asOfDate}|${thresholds.join(',')}`
    useEffect(() => { setPage(1) }, [filterSignature])

    const totalPages = Math.max(1, Math.ceil((tab === 'lot' ? lotRows.length : productRows.length) / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const pagedLotRows = useMemo(() => lotRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [lotRows, safePage])
    const pagedProductRows = useMemo(() => productRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [productRows, safePage])

    const handleExport = async () => {
        if (!currentSystem) return
        try {
            await exportInventoryAgingToExcel({
                systemName: currentSystem.name || systemType,
                dateTypeLabel: activeDateLabel,
                asOfDate,
                thresholdsLabel: thresholds.map(t => `> ${t}`).join(' / ') || 'chưa đặt ngưỡng',
                buckets,
                stats,
                lotRows,
                productRows
            })
            showToast('Đã xuất file báo cáo tồn kho lâu ngày', 'success')
        } catch (err: any) {
            console.error('Export aging report failed:', err)
            showToast('Xuất Excel thất bại: ' + (err?.message || ''), 'error')
        }
    }

    const toggleCategory = (id: string) => {
        setSelectedCategoryIds(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
    }

    const setThresholdAt = (index: number, raw: string) => {
        setThresholdInputs(prev => prev.map((v, i) => (i === index ? raw.replace(/[^0-9]/g, '') : v)))
    }

    const removeThresholdAt = (index: number) => {
        setThresholdInputs(prev => prev.filter((_, i) => i !== index))
    }

    const addThreshold = () => {
        setThresholdInputs(prev => {
            const nums = sanitizeThresholds(prev.map(s => Number(s)))
            return [...prev, String(nums.length > 0 ? nums[nums.length - 1] + 90 : 90)]
        })
    }

    const sortHeader = (
        label: string,
        active: boolean,
        dir: SortDir,
        onClick: () => void,
        align: 'left' | 'right' = 'left'
    ) => (
        <th
            className={`px-3 py-3 font-bold uppercase tracking-wider text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer select-none whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}
            onClick={onClick}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                <ArrowUpDown size={12} className={active ? 'text-orange-600' : 'text-zinc-300 dark:text-zinc-600'} />
                {active && <span className="text-[10px] text-orange-600">{dir === 'asc' ? '↑' : '↓'}</span>}
            </span>
        </th>
    )

    return (
        <div className="flex flex-col h-full bg-[#f8fafc] dark:bg-[#020617] p-4 sm:p-8 transition-colors overflow-hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider border border-orange-100 dark:border-orange-800 shadow-sm">
                        <CalendarClock size={12} />
                        Aging Report
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-4">
                        <CalendarClock className="text-orange-600" size={32} />
                        Tồn Kho Lâu Ngày
                    </h1>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg max-w-3xl">
                        Số ngày tồn được tính lùi từ mốc ngày của báo cáo về {activeDateLabel.toLowerCase()} đang quản lý trên LOT.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center gap-1">
                        <button
                            onClick={handleExport}
                            disabled={isGated || loading || lotRows.length === 0}
                            className="px-6 py-2.5 bg-orange-600 text-white font-bold text-xs uppercase rounded-xl flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-orange-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Download size={16} /> Xuất Excel
                        </button>
                        <button
                            onClick={fetchData}
                            disabled={loading || isGated}
                            className="p-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all disabled:opacity-40"
                            title="Tải lại dữ liệu"
                        >
                            <RefreshCw size={20} className={`${loading ? 'animate-spin' : ''} text-zinc-600 dark:text-zinc-300`} />
                        </button>
                    </div>
                </div>
            </div>

            {isGated ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-8">
                    <div className="w-20 h-20 bg-stone-100 dark:bg-stone-800 rounded-3xl flex items-center justify-center mb-6">
                        <CalendarClock size={40} className="text-stone-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-stone-800 dark:text-stone-100 mb-2">Tồn kho lâu ngày</h2>
                    <p className="text-stone-500 max-w-md">
                        Tính năng chưa được kích hoạt cho kho này. Vui lòng vào Cài đặt → Cấu hình Phân hệ → Tính năng → Báo cáo để bật.
                    </p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-6 pb-8">
                    {/* Cấu hình mốc ngày + ngưỡng */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-5">
                        <div className="flex flex-col lg:flex-row lg:items-end gap-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    Mốc ngày để tính tuổi
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {dateOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setDateType(opt.id)}
                                            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                                                dateType === opt.id
                                                    ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-500/20'
                                                    : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-orange-300'
                                            }`}
                                            title={opt.label}
                                        >
                                            <span className="mr-1.5">{opt.icon}</span>
                                            {opt.shortLabel}
                                        </button>
                                    ))}
                                    {dateOptions.length === 1 && (
                                        <span className="self-center text-xs text-zinc-400 dark:text-zinc-500">
                                            (Kho này chỉ bật {activeDateLabel.toLowerCase()} — bật thêm module LOT ngày trong Cấu hình phân hệ để chọn mốc khác)
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    Tính đến ngày
                                </label>
                                <input
                                    type="date"
                                    value={asOfDate}
                                    onChange={e => setAsOfDate(e.target.value)}
                                    className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="space-y-2 flex-1">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                    Ngưỡng nhóm tuổi (ngày)
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                    {thresholdInputs.map((raw, i) => (
                                        <div key={i} className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                                            <input
                                                value={raw}
                                                onChange={e => setThresholdAt(i, e.target.value)}
                                                inputMode="numeric"
                                                className="w-14 bg-transparent text-sm font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none"
                                                placeholder="0"
                                            />
                                            <span className="text-[10px] text-zinc-400 font-bold uppercase">ngày</span>
                                            <button onClick={() => removeThresholdAt(i)} className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400" title="Xoá mốc">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={addThreshold} className="px-3 py-2 rounded-xl text-xs font-bold border border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-orange-400 hover:text-orange-600 flex items-center gap-1">
                                        <Plus size={14} /> Thêm mốc
                                    </button>
                                    <div className="flex items-center gap-1 ml-auto">
                                        <button onClick={() => setThresholdInputs(['90', '180'])} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                            90 / 180
                                        </button>
                                        <button onClick={() => setThresholdInputs(DEFAULT_AGING_THRESHOLDS.map(String))} className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700">
                                            30 · 60 · 90 · 180
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mr-1">Xem nhanh</span>
                            <button
                                onClick={() => setMinDays(null)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${minDays === null ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}`}
                            >
                                Tất cả
                            </button>
                            {thresholds.map(t => (
                                <button
                                    key={t}
                                    onClick={() => setMinDays(minDays === t ? null : t)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${minDays === t ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-red-300'}`}
                                >
                                    Tồn trên {t} ngày
                                </button>
                            ))}
                            {bucketFilter !== null && (
                                <button
                                    onClick={() => setBucketFilter(null)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center gap-1.5"
                                >
                                    Đang lọc nhóm: {buckets.find(b => b.index === bucketFilter)?.label || bucketFilter}
                                    <X size={12} />
                                </button>
                            )}
                            <label className="ml-auto flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showUndated}
                                    onChange={e => setShowUndated(e.target.checked)}
                                    className="rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
                                />
                                Hiển thị LOT chưa có {activeDateLabel.toLowerCase()}
                            </label>
                        </div>
                    </div>

                    {/* Thẻ thống kê theo nhóm tuổi */}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                                <Boxes size={14} /> Tổng LOT đang xét
                            </div>
                            <div className="text-3xl font-black text-zinc-900 dark:text-white">{formatQuantityFull(stats.lotCount)}</div>
                            <div className="text-xs text-zinc-400 mt-1">{formatQuantityFull(stats.quantity)} tồn · {formatQuantityFull(Math.round(stats.kg))} Kg</div>
                        </div>

                        {stats.bucketTotals.map(t => {
                            const b = buckets.find(x => x.index === t.index)!
                            return (
                                <button
                                    key={b.index}
                                    onClick={() => setBucketFilter(prev => (prev === b.index ? null : b.index))}
                                    title={bucketFilter === b.index ? 'Bỏ lọc nhóm này' : 'Chỉ xem nhóm này'}
                                    className={`text-left rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${toneClasses(t.index, buckets.length)} ${bucketFilter === b.index ? 'ring-2 ring-zinc-900 dark:ring-white' : ''}`}
                                >
                                    <div className="text-[11px] font-bold uppercase tracking-wider mb-2 opacity-80">{b.label}</div>
                                    <div className="text-3xl font-black">{formatQuantityFull(t.lotCount)} <span className="text-sm font-bold opacity-70">LOT</span></div>
                                    <div className="text-xs mt-1 opacity-80">{formatQuantityFull(t.quantity)} tồn · {formatQuantityFull(Math.round(t.kg))} Kg</div>
                                </button>
                            )
                        })}

                        {stats.undatedLotCount > 0 && (
                            <div className="rounded-2xl border p-5 shadow-sm bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-800">
                                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider mb-2">
                                    <AlertTriangle size={14} /> Chưa có ngày
                                </div>
                                <div className="text-3xl font-black">{formatQuantityFull(stats.undatedLotCount)} <span className="text-sm font-bold opacity-70">LOT</span></div>
                                <div className="text-xs mt-1 opacity-80">Cần bổ sung {activeDateLabel.toLowerCase()} trên LOT</div>
                            </div>
                        )}
                    </div>

                    {/* Bộ lọc */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1 min-w-[220px]">
                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    placeholder="Tìm mã LOT, mã Lot sản xuất, tên/mã SP, vị trí, danh mục..."
                                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                />
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setIsCatOpen(v => !v)}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-700 dark:text-zinc-200"
                                >
                                    Danh mục {selectedCategoryIds.length > 0 && <span className="text-orange-600">({selectedCategoryIds.length})</span>}
                                    <ChevronDown size={16} />
                                </button>
                                {isCatOpen && (
                                    <div className="absolute right-0 z-30 mt-2 w-72 max-h-72 overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl p-2">
                                        {categoryOptions.length === 0 && <div className="p-3 text-xs text-zinc-400">Kho chưa có danh mục nào</div>}
                                        {categoryOptions.map(c => (
                                            <label key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCategoryIds.includes(c.id)}
                                                    onChange={() => toggleCategory(c.id)}
                                                    className="rounded border-zinc-300 text-orange-600 focus:ring-orange-500"
                                                />
                                                <span className="truncate">{c.name}</span>
                                            </label>
                                        ))}
                                        {selectedCategoryIds.length > 0 && (
                                            <button onClick={() => setSelectedCategoryIds([])} className="w-full mt-1 px-3 py-2 rounded-xl text-xs font-bold text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/40">
                                                Xoá chọn danh mục
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <select
                                value={warehouseFilter}
                                onChange={e => setWarehouseFilter(e.target.value)}
                                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="all">Tất cả kho/chi nhánh</option>
                                {warehouseOptions.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>

                            <select
                                value={lockFilter}
                                onChange={e => setLockFilter(e.target.value as any)}
                                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-bold text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            >
                                <option value="all">LOT khoá & tự do</option>
                                <option value="unlocked">Chỉ LOT tự do</option>
                                <option value="locked">Chỉ LOT đang khoá</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                        <nav className="-mb-px flex space-x-8 min-w-max px-1" aria-label="Tabs">
                            {([
                                { id: 'lot' as TabId, name: `Chi tiết theo LOT (${formatQuantityFull(lotRows.length)})` },
                                { id: 'product' as TabId, name: `Tổng hợp theo sản phẩm (${formatQuantityFull(productRows.length)})` }
                            ]).map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => { setTab(t.id); setPage(1) }}
                                    className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                                        tab === t.id
                                            ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                                            : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                                    }`}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center gap-3 py-24 text-zinc-500">
                            <Loader2 className="animate-spin text-orange-600" size={22} />
                            Đang tải dữ liệu tồn kho...
                        </div>
                    ) : lotRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <Boxes size={40} className="text-zinc-300 mb-4" />
                            <p className="text-lg font-bold text-zinc-600 dark:text-zinc-300">Không có dòng nào khớp bộ lọc</p>
                            <p className="text-sm text-zinc-400 mt-1">Thử bỏ lọc nhóm tuổi / mốc "Tồn trên N ngày", kiểm tra lại {activeDateLabel.toLowerCase()} hoặc đổi bộ lọc.</p>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                {tab === 'lot' ? (
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">STT</th>
                                                {sortHeader('Mã LOT', lotSort.field === 'code', lotSort.dir, () => setLotSort(p => ({ field: 'code', dir: p.field === 'code' && p.dir === 'desc' ? 'asc' : 'desc' })))}
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">Mã Lot SX</th>
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">Sản phẩm</th>
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">Vị trí</th>
                                                {sortHeader('Số lượng', lotSort.field === 'quantity', lotSort.dir, () => setLotSort(p => ({ field: 'quantity', dir: p.field === 'quantity' && p.dir === 'desc' ? 'asc' : 'desc' })), 'right')}
                                                {sortHeader('Quy đổi (Kg)', lotSort.field === 'kg', lotSort.dir, () => setLotSort(p => ({ field: 'kg', dir: p.field === 'kg' && p.dir === 'desc' ? 'asc' : 'desc' })), 'right')}
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">{activeDateLabel}</th>
                                                {sortHeader('Số ngày tồn', lotSort.field === 'days', lotSort.dir, () => setLotSort(p => ({ field: 'days', dir: p.field === 'days' && p.dir === 'asc' ? 'desc' : 'asc' })), 'right')}
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">Nhóm tuổi</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {pagedLotRows.map((row, i) => (
                                                <tr key={row.lotId} className="hover:bg-orange-50/40 dark:hover:bg-zinc-800/40 transition-colors">
                                                    <td className="px-3 py-3 text-zinc-400">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                                                    <td className="px-3 py-3 font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                                        <div className="flex items-center gap-2">
                                                            {row.lotCode}
                                                            {row.isLocked && <Lock size={12} className="text-amber-500" />}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3 text-zinc-500 whitespace-nowrap">{row.productionCode || '---'}</td>
                                                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-200 max-w-[380px]">
                                                        {row.items.map((it, idx) => (
                                                            <div key={idx} className="truncate" title={`${it.name} — ${it.sku}`}>
                                                                <span className="font-medium">{it.name}</span>
                                                                <span className="text-zinc-400 text-xs ml-1">({formatQuantityFull(it.quantity)} {it.unit})</span>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="px-3 py-3 text-zinc-500 whitespace-nowrap">{row.positionCodes.length > 0 ? row.positionCodes.join(', ') : 'CHƯA GÁN'}</td>
                                                    <td className="px-3 py-3 text-right font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                                        {formatQuantityFull(row.quantity)}
                                                        <span className="text-xs font-medium text-zinc-400 ml-1">{row.unitSet.join('/')}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-zinc-600 dark:text-zinc-300">{row.kg > 0 ? formatQuantityFull(Math.round(row.kg)) : '---'}</td>
                                                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{fmtDay(row.dateValue)}</td>
                                                    <td className="px-3 py-3 text-right">
                                                        <span className="font-black text-lg text-zinc-900 dark:text-white">{row.days === null ? '---' : formatQuantityFull(row.days)}</span>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <span className={`inline-flex px-3 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${toneClasses(row.bucketIndex, buckets.length)}`}>
                                                            {row.bucketIndex === null ? 'Chưa có ngày' : (buckets.find(b => b.index === row.bucketIndex)?.label || '---')}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">STT</th>
                                                {sortHeader('Mã SP', prodSort.field === 'sku', prodSort.dir, () => setProdSort(p => ({ field: 'sku', dir: p.field === 'sku' && p.dir === 'desc' ? 'asc' : 'desc' })))}
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">Tên sản phẩm</th>
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">Danh mục</th>
                                                {sortHeader('Tổng tồn', prodSort.field === 'quantity', prodSort.dir, () => setProdSort(p => ({ field: 'quantity', dir: p.field === 'quantity' && p.dir === 'desc' ? 'asc' : 'desc' })), 'right')}
                                                {sortHeader('Quy đổi (Kg)', prodSort.field === 'kg', prodSort.dir, () => setProdSort(p => ({ field: 'kg', dir: p.field === 'kg' && p.dir === 'desc' ? 'asc' : 'desc' })), 'right')}
                                                <th className="px-3 py-3 text-right text-[11px] font-bold uppercase text-zinc-500">Số LOT</th>
                                                <th className="px-3 py-3 text-left text-[11px] font-bold uppercase text-zinc-500">{activeDateLabel} cũ nhất</th>
                                                {sortHeader('Số ngày lớn nhất', prodSort.field === 'maxDays', prodSort.dir, () => setProdSort(p => ({ field: 'maxDays', dir: p.field === 'maxDays' && p.dir === 'asc' ? 'desc' : 'asc' })), 'right')}
                                                {buckets.map(b => (
                                                    <th key={b.index} className={`px-3 py-3 text-right text-[11px] font-bold uppercase whitespace-nowrap border-l border-zinc-200 dark:border-zinc-800 ${toneClasses(b.index, buckets.length)}`}>
                                                        {b.label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {pagedProductRows.map((row, i) => (
                                                <tr key={row.key} className="hover:bg-orange-50/40 dark:hover:bg-zinc-800/40 transition-colors">
                                                    <td className="px-3 py-3 text-zinc-400">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                                                    <td className="px-3 py-3 font-bold text-zinc-900 dark:text-white whitespace-nowrap">{row.sku}</td>
                                                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-200 max-w-[320px]">
                                                        <div className="truncate" title={row.name}>{row.name}</div>
                                                    </td>
                                                    <td className="px-3 py-3 text-zinc-500 whitespace-nowrap">{row.categoryName}</td>
                                                    <td className="px-3 py-3 text-right font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                                        {formatQuantityFull(row.quantity)}
                                                        <span className="text-xs font-medium text-zinc-400 ml-1">{row.unit}</span>
                                                    </td>
                                                    <td className="px-3 py-3 text-right text-zinc-600 dark:text-zinc-300">{row.kg > 0 ? formatQuantityFull(Math.round(row.kg)) : '---'}</td>
                                                    <td className="px-3 py-3 text-right text-zinc-600 dark:text-zinc-300">{formatQuantityFull(row.lotCount)}</td>
                                                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{fmtDay(row.oldestDate)}</td>
                                                    <td className="px-3 py-3 text-right font-black text-zinc-900 dark:text-white">{row.maxDays === null ? '---' : formatQuantityFull(row.maxDays)}</td>
                                                    {row.qtyByBucket.map((qty, bi) => (
                                                        <td
                                                            key={bi}
                                                            className={`px-3 py-3 text-right whitespace-nowrap border-l border-zinc-100 dark:border-zinc-800 ${qty > 0 ? toneClasses(bi, buckets.length) : 'text-zinc-300 dark:text-zinc-700'}`}
                                                            title={`Số LOT: ${row.lotCountByBucket[bi] ?? 0}`}
                                                        >
                                                            {qty > 0 ? formatQuantityFull(qty) : '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* Phân trang */}
                            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
                                <div className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                                    Trang {safePage}/{totalPages} · {formatQuantityFull(tab === 'lot' ? lotRows.length : productRows.length)} dòng
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={safePage <= 1}
                                        className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
                                    >
                                        Trang trước
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safePage >= totalPages}
                                        className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-600 dark:text-zinc-300 disabled:opacity-40"
                                    >
                                        Trang sau
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
