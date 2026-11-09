'use client'

import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { ChevronDown, Download, FolderTree, Layers, Loader2, RefreshCw, Scale, Settings2 } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantityFull } from '@/lib/numberUtils'
import { readUiConfig, writeUiConfig, type UiConfig } from '@/lib/systemUiSettings'
import { captureDashboardScreenshot, exportDashboardSheets } from '@/lib/dashboardExcelExport'
import { distributionWorkbookPlan } from '@/lib/dashboardExcelSpecs'
import { buildCategoryPositionStats } from '@/lib/categoryPositionStats'
import {
    aggregateKgByProduct,
    fetchCategoryPositionRaw,
    fetchDistributionCategories,
    fetchDistributionLots,
    type CategoryPositionRaw,
    type DistributionLot
} from '@/lib/inventoryDistributionData'

const COLORS = [
    '#0ea5e9', // Sky Blue
    '#f97316', // Orange
    '#10b981', // Emerald
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#84cc16', // Lime
]

export default function InventoryDistributionChart() {
    const { systemType, currentSystem } = useSystem()
    const [loading, setLoading] = useState(true)
    const [lots, setLots] = useState<DistributionLot[]>([])
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
    const [allowedCategoryIds, setAllowedCategoryIds] = useState<string[] | null>(null) // null means all
    const [showCategoryFilter, setShowCategoryFilter] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [isLegendExpanded, setIsLegendExpanded] = useState(false)

    // Tab "Theo danh mục (vị trí)": thống kê số ô vị trí theo danh mục, dùng chung cấu hình với /warehouses/status
    const [view, setView] = useState<'kg' | 'position'>('kg')
    const [positionLoading, setPositionLoading] = useState(false)
    const [positionError, setPositionError] = useState<string | null>(null)
    const [positionRows, setPositionRows] = useState<Array<{ id: string; lot_id: string | null; zone_id: string | null }>>([])
    const [zoneRows, setZoneRows] = useState<Array<{ id: string; code: string | null; name: string | null; parent_id: string | null; level: number | null }>>([])
    const [lotCategories, setLotCategories] = useState<Map<string, string[]>>(new Map())
    const [positionLoaded, setPositionLoaded] = useState(false)
    const [exporting, setExporting] = useState(false)
    const cardRef = useRef<HTMLDivElement>(null)
    const [statWarehouseId, setStatWarehouseId] = useState<string | null>(null)
    const [statCategoryIds, setStatCategoryIds] = useState<string[]>([])
    const [showStatConfig, setShowStatConfig] = useState(false)
    const [tempStatIds, setTempStatIds] = useState<string[]>([])
    const [savingStatConfig, setSavingStatConfig] = useState(false)
    const [uiConfig, setUiConfig] = useState<UiConfig>({})

    const { getBaseAmount: toBaseAmount, getBaseToKgRate, unitNameMap, conversionMap, loading: conversionLoading } = useUnitConversion()

    // Fetch Data
    const fetchData = async () => {
        if (!systemType) return
        setLoading(true)

        try {
            setLots(await fetchDistributionLots(systemType))
        } catch (err: any) {
            console.error('Error fetching inventory distribution:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const fetchCategories = async () => {
            if (!systemType) return
            setCategories(await fetchDistributionCategories(systemType))
        }

        // Load configuration from current system in Database
        const loadSystemConfig = async () => {
            if (!systemType) return
            try {
                setUiConfig(await readUiConfig(systemType))
            } catch (err) {
                console.error('Lỗi tải cấu hình dashboard:', err)
            }
        }

        if (systemType) {
            fetchData()
            fetchCategories()
            loadSystemConfig()
        }
    }, [systemType])

    useEffect(() => {
        const allowed = uiConfig.dashboard_config?.allowed_category_ids
        setAllowedCategoryIds(Array.isArray(allowed) ? allowed : null)
    }, [uiConfig])

    const saveToDatabase = async (newAllowedIds: string[] | null) => {
        if (!systemType) return
        try {
            const saved = await writeUiConfig(systemType, {
                dashboard_config: { ...uiConfig.dashboard_config, allowed_category_ids: newAllowedIds }
            })
            setUiConfig(saved)
        } catch (error: any) {
            console.error('Lỗi lưu cấu hình dashboard vào CSDL:', error)
            alert('Không lưu được cấu hình: ' + (error?.message || 'Lỗi không xác định'))
        }
    }

    // Đọc/fresh dữ liệu vị trí cho tab "Theo danh mục (vị trí)".
    // Trả về đúng dữ liệu vừa đọc để nút Xuất Excel dùng ngay khi tab chưa mở lần nào.
    const fetchPositionData = useCallback(async (): Promise<CategoryPositionRaw | null> => {
        if (!systemType) return null
        setPositionLoading(true)
        setPositionError(null)
        try {
            const raw = await fetchCategoryPositionRaw(systemType)

            setPositionRows(raw.positions)
            setZoneRows(raw.zones)
            setLotCategories(raw.lotCategories)
            setPositionLoaded(true)

            return raw
        } catch (err: any) {
            console.error('Error fetching category position stats:', err)
            setPositionError(err?.message || 'Không tải được dữ liệu vị trí kho.')
            return null
        } finally {
            setPositionLoading(false)
        }
    }, [systemType])

    useEffect(() => {
        if (view === 'position' && !positionLoaded && !positionLoading) fetchPositionData()
    }, [view, positionLoaded, positionLoading, fetchPositionData])

    // Cấu hình danh mục theo dõi: dùng chung key với trang /warehouses/status
    useEffect(() => {
        if (categories.length === 0) return
        const dbIds = uiConfig.warehouse_status_config?.selected_category_ids
        setStatCategoryIds(Array.isArray(dbIds) ? dbIds : categories.map(c => c.id))
    }, [uiConfig, categories])

    const warehouses = useMemo(
        () => zoneRows.filter(z => z.level === 0 || !z.parent_id),
        [zoneRows]
    )

    const positionResult = useMemo(
        () => buildCategoryPositionStats({
            categories,
            positions: positionRows,
            lotCategories,
            zones: zoneRows,
            warehouseId: statWarehouseId
        }),
        [categories, positionRows, lotCategories, zoneRows, statWarehouseId]
    )

    const visiblePositionStats = useMemo(
        () => positionResult.stats.filter(s => statCategoryIds.includes(s.categoryId)),
        [positionResult, statCategoryIds]
    )

    // Thứ tự lớn → bé giống hệt biểu đồ trong file Excel xuất ra
    const positionChartData = useMemo(
        () => [...visiblePositionStats].sort((a, b) => b.count - a.count).map(s => ({ ...s, value: s.count })),
        [visiblePositionStats]
    )

    const saveStatConfig = async (ids: string[]) => {
        setSavingStatConfig(true)
        try {
            const saved = await writeUiConfig(systemType, {
                warehouse_status_config: {
                    ...uiConfig.warehouse_status_config,
                    selected_category_ids: ids
                }
            })
            setUiConfig(saved)
            setStatCategoryIds(ids)
            setShowStatConfig(false)
        } catch (error: any) {
            console.error('Error saving category stats config:', error)
            alert('Không lưu được cấu hình danh mục: ' + (error?.message || 'Lỗi không xác định'))
        } finally {
            setSavingStatConfig(false)
        }
    }

    const chartData = useMemo(() => {
        if (conversionLoading || lots.length === 0) return { data: [], totalWeight: 0 }
        const { items, totalWeight } = aggregateKgByProduct(lots, { toBaseAmount, getBaseToKgRate }, selectedCategoryIds)
        return { data: items, totalWeight }
    }, [lots, conversionLoading, toBaseAmount, getBaseToKgRate, selectedCategoryIds, unitNameMap, conversionMap])

    const { data: processedData, totalWeight } = chartData || { data: [], totalWeight: 0 }

    // Bấm một lần ra MỘT file có đủ hai sheet: khối lượng (KG) và danh mục (số ô vị trí).
    const handleExport = async () => {
        setExporting(true)
        try {
            const systemName = currentSystem?.name || systemType || ''
            const filterLabel = selectedCategoryIds.length === 0
                ? 'Tất cả danh mục'
                : selectedCategoryIds
                    .map(id => categories.find(c => c.id === id)?.name || 'Chưa phân loại')
                    .join(', ')

            // Tab vị trí tải lười: chưa mở tab này lần nào thì phải đọc dữ liệu ngay trong lúc xuất.
            const posData: CategoryPositionRaw | null = positionLoaded
                ? { positions: positionRows, zones: zoneRows, lotCategories }
                : await fetchPositionData()
            if (!posData) throw new Error('Không đọc được dữ liệu ô vị trí.')

            const exportResult = buildCategoryPositionStats({
                categories,
                positions: posData.positions,
                lotCategories: posData.lotCategories,
                zones: posData.zones,
                warehouseId: statWarehouseId
            })
            const warehouse = statWarehouseId
                ? posData.zones.find(z => z.id === statWarehouseId)
                : null

            const warehouseLabel = warehouse ? (warehouse.name || warehouse.code || 'Kho đã chọn') : 'Tất cả kho'

            const sheets = distributionWorkbookPlan(
                { systemName, filterLabel, items: processedData, totalWeight },
                {
                    systemName,
                    warehouseLabel,
                    result: {
                        ...exportResult,
                        stats: exportResult.stats.filter(s => statCategoryIds.includes(s.categoryId))
                    },
                    visibleOnly: statCategoryIds.length > 0
                }
            )

            const screenshot = await captureDashboardScreenshot(cardRef.current, {
                cardTitle: 'Tỉ lệ phân bố hàng hóa tồn kho',
                systemName,
                filterLabel: `${filterLabel} · Phạm vi: ${warehouseLabel}`
            })

            await exportDashboardSheets({ sheets, screenshot, filePrefix: 'Tỉ lệ phân bố hàng hóa' })
        } catch (err) {
            console.error('Lỗi xuất Excel phân bố hàng hóa:', err)
            alert('Không xuất được file Excel. Vui lòng thử lại.')
        } finally {
            setExporting(false)
        }
    }

    if (loading || conversionLoading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-stone-200 h-[400px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
        )
    }

    return (
        <div ref={cardRef} className="bg-white rounded-2xl p-6 border border-stone-200">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-5">
                <h2 data-excel-shot="skip" className="text-xl font-semibold text-stone-800">Tỉ lệ phân bố hàng hóa tồn kho</h2>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Tab: khối lượng KG (theo sản phẩm) / số ô vị trí (theo danh mục) */}
                    <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
                        <button
                            onClick={() => setView('kg')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                view === 'kg'
                                    ? 'bg-white text-orange-600 shadow-sm'
                                    : 'text-stone-500 hover:text-stone-700'
                            }`}
                        >
                            <Scale size={14} />
                            Theo khối lượng (KG)
                        </button>
                        <button
                            onClick={() => setView('position')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                view === 'position'
                                    ? 'bg-white text-indigo-600 shadow-sm'
                                    : 'text-stone-500 hover:text-stone-700'
                            }`}
                        >
                            <Layers size={14} />
                            Theo danh mục (vị trí)
                        </button>
                    </div>
                    <button
                        data-excel-shot="skip"
                        onClick={handleExport}
                        disabled={exporting || (processedData.length === 0 && positionLoaded && visiblePositionStats.length === 0)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-white border border-stone-200 text-stone-600 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Xuất Excel: sheet ảnh dashboard + 2 sheet — Khối lượng (KG) và Danh mục (vị trí)"
                    >
                        {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Xuất Excel
                    </button>
                    {view === 'kg' && (
                        <>
                            <button
                                onClick={() => {
                                    setShowCategoryFilter(!showCategoryFilter)
                                    if (showSettings) setShowSettings(false)
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    showCategoryFilter || selectedCategoryIds.length > 0
                                        ? 'bg-orange-50 border-orange-200 text-orange-600'
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                }`}
                            >
                                <Loader2 className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                Danh mục {selectedCategoryIds.length > 0 && `(${selectedCategoryIds.length})`}
                            </button>
                            <button
                                onClick={() => {
                                    setShowSettings(!showSettings)
                                    if (showCategoryFilter) setShowCategoryFilter(false)
                                }}
                                className={`p-1.5 rounded-lg border transition-all ${
                                    showSettings
                                        ? 'bg-indigo-100 border-indigo-200 text-indigo-600'
                                        : 'bg-white border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300'
                                }`}
                                title="Cài đặt danh mục hiển thị"
                            >
                                <Settings2 size={18} />
                            </button>
                        </>
                    )}
                    <button
                        data-excel-shot="skip"
                        onClick={() => {
                            fetchData()
                            if (view === 'position') fetchPositionData()
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-stone-200 text-stone-600 hover:border-stone-300 transition-all"
                    >
                        <RefreshCw size={14} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Category selection area */}
            {view === 'kg' && (<>
            {showCategoryFilter && (
                <div className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Lọc theo danh mục sản phẩm</span>
                        <button 
                            onClick={() => setSelectedCategoryIds([])}
                            className="text-[10px] text-orange-600 hover:underline font-bold"
                        >
                            Xóa tất cả
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {categories
                            .filter(cat => allowedCategoryIds === null || allowedCategoryIds.includes(cat.id))
                            .map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        setSelectedCategoryIds(prev => 
                                            prev.includes(cat.id) 
                                                ? prev.filter(id => id !== cat.id)
                                                : [...prev, cat.id]
                                        )
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                        selectedCategoryIds.includes(cat.id)
                                            ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                                            : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        {(allowedCategoryIds === null || allowedCategoryIds.includes('none')) && (
                            <button
                                onClick={() => {
                                    setSelectedCategoryIds(prev => 
                                        prev.includes('none') 
                                            ? prev.filter(id => id !== 'none')
                                            : [...prev, 'none']
                                    )
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    selectedCategoryIds.includes('none')
                                        ? 'bg-stone-500 border-stone-500 text-white shadow-sm'
                                        : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                }`}
                            >
                                Chưa phân loại
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Dashboard Settings area */}
            {showSettings && (
                <div className="mb-6 p-5 bg-indigo-50/50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-bold text-indigo-900">Cài đặt danh mục hiển thị</h3>
                            <p className="text-[10px] text-indigo-600 font-medium">Chọn những danh mục bạn muốn xuất hiện trong bộ lọc Dashboard</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    const all = categories.map(c => c.id).concat(['none'])
                                    setAllowedCategoryIds(all)
                                    saveToDatabase(all)
                                }}
                                className="text-[10px] text-indigo-600 hover:underline font-bold"
                            >
                                Chọn tất cả
                            </button>
                            <span className="text-indigo-200 text-[10px]">|</span>
                            <button 
                                onClick={() => {
                                    setAllowedCategoryIds([])
                                    saveToDatabase([])
                                }}
                                className="text-[10px] text-orange-600 hover:underline font-bold"
                            >
                                Bỏ hết
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {categories.map(cat => (
                            <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox"
                                    checked={allowedCategoryIds === null || allowedCategoryIds.includes(cat.id)}
                                    onChange={(e) => {
                                        const current = allowedCategoryIds || categories.map(c => c.id).concat(['none'])
                                        let next: string[]
                                        if (e.target.checked) {
                                            next = [...current, cat.id]
                                        } else {
                                            next = current.filter(id => id !== cat.id)
                                        }
                                        setAllowedCategoryIds(next)
                                        saveToDatabase(next)
                                    }}
                                    className="w-4 h-4 rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs text-stone-700 group-hover:text-indigo-600 transition-colors truncate">{cat.name}</span>
                            </label>
                        ))}
                        <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                                type="checkbox"
                                checked={allowedCategoryIds === null || allowedCategoryIds.includes('none')}
                                onChange={(e) => {
                                    const current = allowedCategoryIds || categories.map(c => c.id).concat(['none'])
                                    let next: string[]
                                    if (e.target.checked) {
                                        next = [...current, 'none']
                                    } else {
                                        next = current.filter(id => id !== 'none')
                                    }
                                    setAllowedCategoryIds(next)
                                    saveToDatabase(next)
                                }}
                                className="w-4 h-4 rounded border-stone-300 text-stone-600 focus:ring-stone-500"
                            />
                            <span className="text-xs text-stone-500 group-hover:text-stone-700 transition-colors">Chưa phân loại</span>
                        </label>
                    </div>

                    <div className="mt-5 flex justify-end">
                        <button
                            onClick={() => setShowSettings(false)}
                            className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-all"
                        >
                            Hoàn tất
                        </button>
                    </div>
                </div>
            )}
            </>
            )}

            {view === 'position' ? (
                <div className="space-y-4">
                    {/* Chọn kho + cấu hình danh mục theo dõi */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50/60 p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Phạm vi</span>
                            <div className="relative">
                                <select
                                    value={statWarehouseId || ''}
                                    onChange={e => setStatWarehouseId(e.target.value || null)}
                                    className="appearance-none pl-3 pr-8 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-bold text-stone-700 focus:outline-none focus:border-indigo-300"
                                >
                                    <option value="">TẤT CẢ KHO ({formatQuantityFull(positionRows.length, 0)})</option>
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{(w.name || w.code || '(không tên)').toUpperCase()}</option>
                                    ))}
                                </select>
                                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setTempStatIds([...statCategoryIds])
                                setShowStatConfig(v => !v)
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all ${
                                showStatConfig
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'bg-white border-stone-200 text-stone-600 hover:border-indigo-300 hover:text-indigo-600'
                            }`}
                        >
                            <Settings2 size={13} />
                            Cấu hình {statCategoryIds.length > 0 && `(${statCategoryIds.length})`}
                        </button>
                    </div>

                    {showStatConfig && (
                        <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
                            <p className="text-[11px] font-bold text-indigo-900 mb-0.5">Danh mục cần theo dõi</p>
                            <p className="text-[10px] text-indigo-600 font-medium mb-3">
                                Danh sách dùng chung với trang Sơ đồ trạng thái kho — sửa một lần, cả hai nơi cùng đổi.
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {categories.map(cat => {
                                    const checked = tempStatIds.includes(cat.id)
                                    return (
                                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => setTempStatIds(prev => checked ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}
                                                className="w-4 h-4 rounded border-stone-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-xs text-stone-700 group-hover:text-indigo-700 transition-colors truncate">{cat.name}</span>
                                        </label>
                                    )
                                })}
                                {categories.length === 0 && (
                                    <div className="col-span-full text-center py-3 text-stone-400 text-[10px] font-bold">
                                        Không có danh mục nào để chọn
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 pt-2 border-t border-indigo-100 flex justify-end gap-2">
                                <button
                                    onClick={() => setShowStatConfig(false)}
                                    className="px-3 py-1.5 text-[10px] font-bold text-stone-500 hover:text-stone-700 uppercase tracking-wider"
                                >
                                    Bỏ qua
                                </button>
                                <button
                                    onClick={() => saveStatConfig(tempStatIds)}
                                    disabled={savingStatConfig}
                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg uppercase tracking-wider transition-all"
                                >
                                    {savingStatConfig ? 'Đang lưu...' : 'Lưu hệ thống'}
                                </button>
                            </div>
                        </div>
                    )}

                    {positionError && (
                        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-rose-700">{positionError}</span>
                            <button
                                onClick={fetchPositionData}
                                className="px-3 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 transition-colors"
                            >
                                Thử lại
                            </button>
                        </div>
                    )}

                    {positionLoading && positionRows.length === 0 ? (
                        <div className="h-[200px] flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        </div>
                    ) : positionRows.length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed border-stone-200 text-sm text-stone-400 text-center">
                            Phân hệ này chưa có ô vị trí nào trong sơ đồ — hãy quy hoạch khu vực ở phần Quản lý kho.
                        </div>
                    ) : categories.length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed border-stone-200 text-sm text-stone-400 text-center">
                            Phân hệ này chưa có danh mục sản phẩm nào nên không thống kê được theo danh mục.
                        </div>
                    ) : visiblePositionStats.length === 0 ? (
                        <div className="p-6 rounded-xl border border-dashed border-stone-200 text-xs font-bold text-stone-400 text-center flex flex-col items-center gap-2">
                            <FolderTree size={26} className="text-stone-300" />
                            Chưa cấu hình danh mục để theo dõi. Nhấp "Cấu hình" để thêm.
                        </div>
                    ) : (
                        <>
                            <div className="h-[300px] w-full relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10">
                                    <p className="text-sm text-stone-500 font-medium">Ô đang chứa hàng</p>
                                    <p className="text-3xl font-bold text-indigo-600">
                                        {formatQuantityFull(positionResult.occupiedPositions, 0)}
                                    </p>
                                    <p className="text-xs text-stone-500 font-medium uppercase">
                                        trên {formatQuantityFull(positionResult.totalPositions, 0)} ô quy hoạch
                                    </p>
                                </div>

                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={positionChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={2}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {positionChartData.map((entry, index) => (
                                                <Cell key={`pos-cell-${entry.categoryId}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(value: any, name: any, props: any) => {
                                                const payload = props.payload
                                                return [
                                                    `${formatQuantityFull(payload.count, 0)} ô · ${payload.pctOfOccupied.toFixed(1)}% hàng hoá`,
                                                    payload.name
                                                ]
                                            }}
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Chú giải: giữ nguyên hai tỉ lệ mà thẻ từng hiển thị */}
                            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
                                {positionChartData.map((entry, index) => (
                                    <div key={entry.categoryId} className="flex items-start gap-2.5">
                                        <div
                                            className="w-3 h-3 rounded-full shrink-0 mt-1"
                                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-2">
                                                <span className="text-xs font-black text-stone-700 truncate uppercase" title={entry.name}>
                                                    {entry.name}
                                                </span>
                                                <span className="text-[10px] font-black text-indigo-600 shrink-0 uppercase">
                                                    {formatQuantityFull(entry.count, 0)} vị trí
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-[9px] font-bold text-stone-400 tracking-wider">
                                                <span>HÀNG HOÁ: {entry.pctOfOccupied.toFixed(1)}%</span>
                                                <span>CÔNG SUẤT: {entry.pctOfTotal.toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="text-[11px] text-stone-500 space-y-1 border-t border-stone-100 pt-3">
                                <p>
                                    Đang tính trên{' '}
                                    <span className="font-bold text-stone-700">{formatQuantityFull(positionResult.occupiedPositions, 0)}</span> ô đang chứa hàng /{' '}
                                    <span className="font-bold text-stone-700">{formatQuantityFull(positionResult.totalPositions, 0)}</span> ô quy hoạch
                                    {statWarehouseId ? ' (thuộc kho đã chọn)' : ' (toàn bộ phân hệ)'}.
                                </p>
                                <p>Một LOT có thể mang nhiều danh mục nên tổng các tỉ lệ hàng hoá có thể vượt 100%.</p>
                                {positionResult.unclassifiedOccupied > 0 && (
                                    <p>
                                        <span className="font-bold text-stone-700">{formatQuantityFull(positionResult.unclassifiedOccupied, 0)}</span> ô chứa LOT
                                        chưa có dòng nào gắn danh mục — chỉ nằm ở mẫu số, không rơi vào danh mục nào.
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ) : processedData.length === 0 ? (
                <div className="h-[300px] flex flex-col items-center justify-center text-stone-400 border border-dashed border-stone-200 rounded-2xl">
                    <p>Chưa có dữ liệu tồn kho (KG)</p>
                </div>
            ) : (
                <>
                    <div className="h-[300px] w-full relative">
                {/* Center Label */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10">
                    <p className="text-sm text-stone-500 font-medium">Tổng tồn kho</p>
                    <p className="text-3xl font-bold text-emerald-600">
                        {formatQuantityFull(totalWeight, 1)}
                    </p>
                    <p className="text-sm text-stone-500 font-medium uppercase">KG</p>
                </div>

                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={processedData}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={110}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                        >
                            {processedData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: any, name: any, props: any) => {
                                const payload = props.payload;
                                return [`${formatQuantityFull(value, 1)} KG`, payload.name]
                            }}
                            labelFormatter={(label) => `Sản phẩm: ${label}`}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* Custom Legend */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6">
                {(isLegendExpanded ? processedData : processedData.slice(0, 6)).map((entry, index) => (
                    <div key={`${entry.code || entry.name}-${index}`} className="flex items-start gap-2.5">
                        <div
                            className="w-3 h-3 rounded-full shrink-0 mt-1"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="text-xs sm:text-sm flex-1 min-w-0 leading-snug">
                            <span className="font-semibold text-stone-800 break-words" title={entry.name}>
                                {entry.name}
                            </span>
                            <span className="text-stone-500 font-medium ml-1.5 whitespace-nowrap">
                                ({formatQuantityFull(entry.percentage, 0)}%)
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {processedData.length > 6 && (
                <div className="mt-4 flex justify-center">
                    <button
                        onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                        className="px-6 py-1.5 rounded-full bg-stone-50 border border-stone-200 text-[10px] font-black text-orange-600 hover:bg-orange-50 transition-all uppercase tracking-widest flex items-center gap-1.5"
                    >
                        {isLegendExpanded ? 'THU GỌN CHÚ THÍCH' : `XEM THÊM (${processedData.length - 6}+ MÀU SẮC)`}
                        <svg 
                            className={`w-3 h-3 transition-transform duration-300 ${isLegendExpanded ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            )}

            <div className="mt-6 space-y-1 text-xs text-stone-500 border-t border-stone-100 pt-4">
                <p className="font-semibold text-stone-700 mb-2">Chú thích:</p>
                <ul className="list-disc pl-4 space-y-1">
                    <li>Tính theo khối lượng (Kg)</li>
                    <li>Tỉ lệ % được tính dựa trên tổng khối lượng tồn kho</li>
                    <li>Dữ liệu được cập nhật từ các lô hàng đang hoạt động</li>
                </ul>
            </div>
                </>
            )}
        </div>
    )
}
