'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    AlertTriangle,
    Boxes,
    ChevronLeft,
    ChevronRight,
    Forklift,
    Gauge,
    LayoutGrid,
    Loader2,
    Map as MapIcon,
    RefreshCw,
    SquareDashedBottom,
    Warehouse
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import { fetchAllPaged } from '@/lib/supabasePaged'
import { useSystem } from '@/contexts/SystemContext'
import { formatQuantity } from '@/lib/numberUtils'
import {
    buildFillStats,
    buildZoneLookup,
    drillableChildCount,
    metricsOf,
    ownMetricsOf,
    rowsForScope,
    classifyFill,
    CRITICAL_FILL_PCT,
    type FillLevel,
    type FillPositionLike,
    type FillScope,
    type FillStats,
    type FillZoneLike,
    type ZoneFillStat
} from '@/lib/warehouseFillRate'

const LEVEL_STYLE: Record<FillLevel, { bar: string; text: string; chip: string; gradient: string; label: string }> = {
    critical: { bar: 'bg-rose-500', text: 'text-rose-700', chip: 'bg-rose-50 text-rose-700 border-rose-200', gradient: 'from-rose-500 to-red-600', label: 'Sắp đầy' },
    high: { bar: 'bg-amber-500', text: 'text-amber-700', chip: 'bg-amber-50 text-amber-700 border-amber-200', gradient: 'from-amber-500 to-orange-600', label: 'Cao' },
    normal: { bar: 'bg-emerald-500', text: 'text-emerald-700', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', gradient: 'from-emerald-500 to-teal-600', label: 'Bình thường' },
    empty: { bar: 'bg-stone-300', text: 'text-stone-500', chip: 'bg-stone-100 text-stone-600 border-stone-200', gradient: 'from-stone-400 to-stone-500', label: 'Trống' }
}

const SCOPE_TABS: Array<{
    scope: FillScope
    label: string
    unitLabel: string
    chipLabel: string
    hint: string
    icon: typeof Warehouse
    activeClass: string
}> = [
    {
        scope: 'rack',
        label: 'Lô kệ',
        unitLabel: 'Lô kệ',
        chipLabel: 'Lô kệ',
        hint: 'Vị trí được quy hoạch trong sơ đồ. Đây là chỉ số để quyết định nhập/xuất và sức chứa còn lại.',
        icon: Warehouse,
        activeClass: 'bg-emerald-600 text-white border-emerald-600'
    },
    {
        scope: 'hall',
        label: 'Sảnh tạm kết',
        unitLabel: 'Sảnh',
        chipLabel: 'Sảnh',
        hint: 'Khu để hàng tạm, không quy hoạch thành vị trí lưu — theo dõi riêng để biết chỗ trung chuyển, không trộn vào chỉ số Lô kệ.',
        icon: Forklift,
        activeClass: 'bg-amber-500 text-white border-amber-500'
    },
    {
        scope: 'all',
        label: 'Tổng (kệ + sảnh)',
        unitLabel: 'vị trí',
        chipLabel: 'Khu vực',
        hint: 'Toàn bộ ô vị trí của phân hệ, cộng cả Lô kệ và Sảnh — khớp số liệu ở trang Sơ đồ trạng thái kho.',
        icon: LayoutGrid,
        activeClass: 'bg-stone-700 text-white border-stone-700'
    }
]

type ScopePaths = Record<FillScope, string[]>
const EMPTY_PATHS: ScopePaths = { rack: [], hall: [], all: [] }

export default function WarehouseFillRateChart() {
    const { systemType } = useSystem()
    const [stats, setStats] = useState<FillStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [scope, setScope] = useState<FillScope>('rack')
    const [paths, setPaths] = useState<ScopePaths>(EMPTY_PATHS)

    const fetchData = useCallback(async () => {
        if (!systemType) return
        setLoading(true)
        setErrorMsg(null)
        try {
            const [positionRows, zoneRows, linkRows] = await Promise.all([
                fetchAllPaged<FillPositionLike>((from, to) =>
                    supabase
                        .from('positions')
                        .select('id, lot_id')
                        .eq('system_type', systemType)
                        .order('id')
                        .range(from, to) as any
                ),
                fetchAllPaged<FillZoneLike>((from, to) =>
                    supabase
                        .from('zones')
                        .select('id, code, name, parent_id, level, is_hall, display_order')
                        .eq('system_type', systemType)
                        .order('level')
                        .order('code')
                        .range(from, to) as any
                ),
                fetchAllPaged<{ zone_id: string; position_id: string }>((from, to) =>
                    supabase
                        .from('zone_positions')
                        .select('zone_id, position_id, positions!inner(*)')
                        .eq('positions.system_type', systemType)
                        .order('zone_id')
                        .order('position_id')
                        .range(from, to) as any
                )
            ])

            const zoneLookup = buildZoneLookup(linkRows)
            const positionsWithZone = positionRows.map(p => ({ ...p, zone_id: zoneLookup.get(p.id) || null }))
            setStats(buildFillStats(zoneRows, positionsWithZone))
        } catch (err: any) {
            console.error('Lỗi tải dữ liệu tỉ lệ lấp đầy:', err)
            setErrorMsg(err?.message || 'Không tải được dữ liệu vị trí kho.')
        } finally {
            setLoading(false)
        }
    }, [systemType])

    useEffect(() => {
        setPaths(EMPTY_PATHS)
        fetchData()
    }, [fetchData])

    // Ô lô kệ thường nằm dưới một kho cấp 0 duy nhất → tự hạ xuống cấp khu để so sánh được.
    // Tab Sảnh không cần hạ vì danh sách sảnh đã bắt đầu từ khu sảnh đầu ngành.
    useEffect(() => {
        if (!stats) return
        const root = stats.roots.length === 1 ? stats.roots[0] : null
        const defaultPath = (s: FillScope): string[] =>
            s === 'hall' || !root || drillableChildCount(stats, root.zoneId, s) === 0 ? [] : [root.zoneId]
        setPaths({ rack: defaultPath('rack'), hall: defaultPath('hall'), all: defaultPath('all') })
    }, [stats])

    const path = paths[scope]
    const currentZone = path.length > 0 ? stats?.byZone.get(path[path.length - 1]) || null : null

    const rows = useMemo(() => {
        if (!stats) return []
        const children = rowsForScope(stats, currentZone ? currentZone.zoneId : null, scope)
        // Khu đang xem luôn đứng đầu danh sách để thấy "riêng khu này" còn bao nhiêu ô.
        return currentZone ? [currentZone, ...children] : children
    }, [stats, currentZone, scope])

    const criticalRows = useMemo(
        () => rows.filter(r => r !== currentZone && metricsOf(r, scope).pct >= CRITICAL_FILL_PCT),
        [rows, currentZone, scope]
    )

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-stone-200 h-[320px] flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            </div>
        )
    }

    if (errorMsg) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-rose-200 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                    <AlertTriangle size={18} />
                    Không tải được dữ liệu tỉ lệ lấp đầy
                </div>
                <p className="text-xs text-rose-600">{errorMsg}</p>
                <button
                    onClick={fetchData}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors"
                >
                    Thử lại
                </button>
            </div>
        )
    }

    if (!stats) return null

    const activeTab = SCOPE_TABS.find(t => t.scope === scope)!
    const ActiveIcon = activeTab.icon
    const bucket = stats.totals[scope]
    const level = classifyFill(bucket.pct)

    const kpis = [
        { label: `Tổng ô ${activeTab.unitLabel}`, value: formatQuantity(bucket.positions, 0), icon: Boxes },
        { label: 'Đã lấp đầy', value: formatQuantity(bucket.occupied, 0), icon: Warehouse },
        { label: 'Còn trống', value: formatQuantity(bucket.free, 0), icon: SquareDashedBottom },
        { label: `Tỉ lệ lấp đầy ${activeTab.unitLabel}`, value: `${formatQuantity(bucket.pct, 1)}%`, icon: Gauge }
    ]

    return (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 space-y-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-stone-100">
                <div>
                    <div className="flex items-center gap-2 mb-0.5">
                        <Gauge className="text-emerald-600 shrink-0" size={18} />
                        <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                            Tỉ lệ lấp đầy theo khu vực
                        </h2>
                    </div>
                    <p className="text-stone-500 text-[11px] sm:text-xs">
                        Lô kệ và Sảnh tách thành hai tab riêng vì công ty quyết định sức chứa dựa trên Lô kệ;
                        tab Tổng để đối soát với trang Sơ đồ trạng thái kho.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                        href="/warehouses/status"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-stone-200 text-stone-600 hover:border-emerald-300 hover:text-emerald-700 transition-all"
                    >
                        <MapIcon size={11} />
                        Sơ đồ chi tiết
                    </Link>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900 transition-all"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw size={11} />
                        Làm mới
                    </button>
                </div>
            </div>

            {/* Tab Lô kệ / Sảnh / Tổng */}
            <div className="flex flex-wrap gap-1.5">
                {SCOPE_TABS.map(tab => {
                    const Icon = tab.icon
                    const tabBucket = stats.totals[tab.scope]
                    const isActive = tab.scope === scope
                    return (
                        <button
                            key={tab.scope}
                            onClick={() => setScope(tab.scope)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                isActive
                                    ? `${tab.activeClass} shadow-sm`
                                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300 hover:text-stone-900'
                            }`}
                        >
                            <Icon size={14} className={isActive ? '' : 'text-stone-400'} />
                            {tab.label}
                            <span
                                className={`tabular-nums px-1.5 py-0.5 rounded-md text-[11px] font-black ${
                                    isActive ? 'bg-white/20' : 'bg-stone-100 text-stone-700'
                                }`}
                            >
                                {formatQuantity(tabBucket.pct, 1)}%
                            </span>
                            <span className={`text-[10px] font-semibold tabular-nums ${isActive ? 'opacity-90' : 'text-stone-400'}`}>
                                {formatQuantity(tabBucket.occupied, 0)}/{formatQuantity(tabBucket.positions, 0)}
                            </span>
                        </button>
                    )
                })}
            </div>

            <p className={`-mt-1.5 text-[11px] leading-relaxed flex items-start gap-1.5 ${
                scope === 'hall' ? 'text-amber-700' : scope === 'all' ? 'text-stone-500' : 'text-emerald-700'
            }`}>
                <ActiveIcon size={12} className="mt-0.5 shrink-0" />
                {activeTab.hint}
            </p>

            {/* KPI của tab đang xem */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                {kpis.map(kpi => {
                    const Icon = kpi.icon
                    const isPrimary = kpi.label.startsWith('Tỉ lệ')
                    if (isPrimary) {
                        return (
                            <div
                                key={kpi.label}
                                className={`bg-gradient-to-br ${LEVEL_STYLE[level].gradient} p-3 rounded-xl text-white shadow-sm`}
                            >
                                <div className="flex items-center justify-between opacity-90">
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{kpi.label}</span>
                                    <Icon size={15} />
                                </div>
                                <p className="text-xl sm:text-2xl font-black mt-1 tracking-tight">{kpi.value}</p>
                                <p className="text-[10px] opacity-90 mt-0.5 font-semibold">
                                    {formatQuantity(bucket.occupied, 0)}/{formatQuantity(bucket.positions, 0)} ô · {LEVEL_STYLE[level].label}
                                </p>
                            </div>
                        )
                    }
                    return (
                        <div key={kpi.label} className="bg-stone-50 rounded-xl border border-stone-200 p-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">{kpi.label}</span>
                                <Icon size={15} className="text-stone-400" />
                            </div>
                            <p className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-stone-800">{kpi.value}</p>
                        </div>
                    )
                })}
            </div>

            {/* Breadcrumb cấp đang xem của tab này */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {path.length > 0 && (
                    <button
                        onClick={() => setPaths(prev => ({ ...prev, [scope]: prev[scope].slice(0, -1) }))}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold transition-colors"
                    >
                        <ChevronLeft size={13} />
                        Cấp trên
                    </button>
                )}
                <div className="flex flex-wrap items-center gap-1 font-semibold text-stone-600">
                    <button
                        onClick={() => setPaths(prev => ({ ...prev, [scope]: [] }))}
                        className={`px-2 py-0.5 rounded-md hover:bg-stone-100 transition-colors ${path.length === 0 ? 'text-emerald-700 font-black' : ''}`}
                    >
                        {scope === 'hall' ? 'Toàn bộ sảnh' : 'Toàn kho'}
                    </button>
                    {path.map((zoneId, idx) => {
                        const node = stats.byZone.get(zoneId)
                        if (!node) return null
                        const isLast = idx === path.length - 1
                        return (
                            <span key={zoneId} className="inline-flex items-center gap-1">
                                <ChevronRight size={12} className="text-stone-300" />
                                <button
                                    onClick={() => setPaths(prev => ({ ...prev, [scope]: prev[scope].slice(0, idx + 1) }))}
                                    className={`px-2 py-0.5 rounded-md hover:bg-stone-100 transition-colors ${isLast ? 'text-emerald-700 font-black' : ''}`}
                                >
                                    {node.label}
                                </button>
                            </span>
                        )
                    })}
                </div>
            </div>

            {/* Danh sách khu vực của tab đang xem */}
            {bucket.positions === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-stone-200 text-sm text-stone-500">
                    Phân hệ này chưa có ô {activeTab.unitLabel} nào
                    {scope === 'hall'
                        ? ' — toàn bộ vị trí đều là Lô kệ được quy hoạch.'
                        : scope === 'rack'
                            ? ' — hãy kiểm tra lại sơ đồ khu vực trong phần Quản lý kho.'
                            : '.'}
                </div>
            ) : (
                <div className="space-y-1.5">
                    {rows.map(row => (
                        <FillRateRow
                            key={row.zoneId}
                            row={row}
                            scope={scope}
                            stats={stats}
                            isCurrent={row === currentZone}
                            onDrill={() => setPaths(prev => ({
                                ...prev,
                                [scope]: [...prev[scope], row.zoneId]
                            }))}
                        />
                    ))}
                </div>
            )}

            {/* Cảnh báo khu sắp đầy trong tab đang xem */}
            {criticalRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-stone-100">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-rose-700 uppercase tracking-wider">
                        <AlertTriangle size={13} />
                        {activeTab.chipLabel} sắp đầy (&ge; {CRITICAL_FILL_PCT}%)
                    </span>
                    {criticalRows.map(row => {
                        const rowBucket = metricsOf(row, scope)
                        return (
                            <button
                                key={row.zoneId}
                                onClick={() => setPaths(prev => ({ ...prev, [scope]: [...prev[scope], row.zoneId] }))}
                                className={`px-2 py-0.5 rounded-full border text-[11px] font-bold hover:brightness-95 transition-all ${LEVEL_STYLE.critical.chip}`}
                                title={`${formatQuantity(rowBucket.occupied, 0)}/${formatQuantity(rowBucket.positions, 0)} ô đang chứa hàng`}
                            >
                                {row.label} · {formatQuantity(rowBucket.pct, 1)}%
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Ghi chú */}
            <div className="pt-3 border-t border-stone-100 text-[11px] text-stone-500 space-y-1">
                {stats.unassignedPositions > 0 && scope !== 'hall' && (
                    <p>
                        <span className="font-bold text-stone-700">
                            {formatQuantity(stats.unassignedOccupied, 0)}/{formatQuantity(stats.unassignedPositions, 0)}
                        </span>{' '}
                        ô Lô kệ chưa gán vào khu vực nào trong sơ đồ (vẫn được tính vào tab Lô kệ và tab Tổng).
                    </p>
                )}
                <p className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-stone-600">Chú thích mức lấp đầy:</span>
                    {(['critical', 'high', 'normal', 'empty'] as FillLevel[]).map(lv => (
                        <span key={lv} className="inline-flex items-center gap-1">
                            <span className={`w-2.5 h-2.5 rounded-sm ${LEVEL_STYLE[lv].bar}`} />
                            {LEVEL_STYLE[lv].label}
                        </span>
                    ))}
                </p>
            </div>
        </div>
    )
}

function FillRateRow({
    row,
    scope,
    stats,
    isCurrent,
    onDrill
}: {
    row: ZoneFillStat
    scope: FillScope
    stats: FillStats
    isCurrent: boolean
    onDrill: () => void
}) {
    const bucket = metricsOf(row, scope)
    const own = ownMetricsOf(row, scope)
    const style = LEVEL_STYLE[classifyFill(bucket.pct)]
    const drillCount = drillableChildCount(stats, row.zoneId, scope)

    return (
        <div className="group rounded-xl border border-stone-200/90 bg-white px-3 py-2 hover:border-emerald-300 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-stone-800 truncate" title={row.label}>{row.label}</span>
                    {row.isHall && scope !== 'hall' && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-700 uppercase tracking-wide shrink-0">
                            Sảnh
                        </span>
                    )}
                    {isCurrent ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[9px] font-bold text-emerald-700 uppercase tracking-wide shrink-0">
                            Đang xem
                        </span>
                    ) : drillCount > 0 && (
                        <button
                            onClick={onDrill}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-stone-100 group-hover:bg-emerald-50 text-[10px] font-bold text-stone-600 group-hover:text-emerald-700 transition-colors shrink-0"
                            title={`Xem ${drillCount} khu vực bên trong`}
                        >
                            {drillCount} khu con
                            <ChevronRight size={11} />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-stone-500 tabular-nums">
                        {formatQuantity(bucket.occupied, 0)}/{formatQuantity(bucket.positions, 0)} ô
                    </span>
                    <span className={`text-sm font-black tabular-nums ${style.text}`}>{formatQuantity(bucket.pct, 1)}%</span>
                </div>
            </div>
            <div className="mt-1.5 relative w-full h-2 rounded-full bg-stone-100 overflow-hidden" title={`Còn ${formatQuantity(bucket.free, 0)} ô trống`}>
                <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${style.bar}`}
                    style={{ width: `${bucket.positions > 0 ? Math.min(100, Math.max(1.5, bucket.pct)) : 0}%` }}
                />
            </div>
            {drillCount > 0 && own.positions > 0 && (
                <p className="mt-1 text-[10px] text-stone-400 font-medium">
                    Riêng khu này: {formatQuantity(own.occupied, 0)}/{formatQuantity(own.positions, 0)} ô · còn trống {formatQuantity(own.free, 0)} ô
                </p>
            )}
        </div>
    )
}
