'use client'
import { useState, useEffect, useMemo, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { BarChart3, Settings, Package, Map as MapIcon, Info, Layout, Palette, Eye, PackageSearch, ChevronDown, Layers } from 'lucide-react'
import WarehouseStatusMap from '@/components/warehouse/status/WarehouseStatusMap'
import StatusLayoutConfigPanel from '@/components/warehouse/status/StatusLayoutConfigPanel'
import { ProductColorConfigModal } from '@/components/warehouse/status/ProductColorConfigModal'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { useSystem } from '@/contexts/SystemContext'
import Protected from '@/components/auth/Protected'
import { useToast } from '@/components/ui/ToastProvider'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { groupWarehouseData, getProductColorStyle } from '@/lib/warehouseUtils'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

function WarehouseStatusContent() {
    const { showToast } = useToast()
    const { systemType, currentSystem } = useSystem()
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [layouts, setLayouts] = useState<Record<string, any>>({})

    const [loading, setLoading] = useState(true)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    // Filter state
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Design mode state
    const [isDesignMode, setIsDesignMode] = useState(false)
    const [isCompactMode, setIsCompactMode] = useState(true)
    const [isLegendExpanded, setIsLegendExpanded] = useState(false)
    const [configuringZone, setConfiguringZone] = useState<Zone | null>(null)

    // Collapsed zones
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())

    const [displayInternalInfo, setDisplayInternalInfo] = useState(true)
    const [isGroupMergingEnabled, setIsGroupMergingEnabled] = useState(true)

    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})

    // Auth Session State
    const [session, setSession] = useState<any>(null)

    const [viewingLot, setViewingLot] = useState<any>(null)
    const [qrLot, setQrLot] = useState<any>(null)
    const [isColorModalOpen, setIsColorModalOpen] = useState(false)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    }, [])

    useEffect(() => {
        if (systemType && session?.access_token) {
            fetchData()
        }
    }, [systemType, session?.access_token])

    async function fetchData() {
        setLoading(true)
        setErrorMsg(null)

        async function fetchAll(table: string, filter?: (query: any) => any, customSelect = '*', limit = 1000) {
            let allRecs: any[] = []
            let from = 0
            console.log(`[FetchAll] Starting ${table}...`)
            while (true) {
                let query = supabase.from(table as any).select(customSelect).range(from, from + limit - 1)
                if (filter) query = filter(query)
                const { data, error } = await query
                if (error) {
                    console.error(`[FetchAll] Error in ${table}:`, error)
                    throw error
                }
                if (!data || data.length === 0) break
                allRecs = [...allRecs, ...data]
                console.log(`[FetchAll] ${table}: loaded ${allRecs.length} records...`)
                if (data.length < limit) break
                from += limit
            }
            return allRecs
        }

        async function fetchAllZonesPos(limit = 1000) {
            let allRecs: any[] = []
            let from = 0
            console.log(`[FetchAllZonesPos] Starting...`)
            while (true) {
                const { data, error } = await supabase
                    .from('zone_positions')
                    .select('zone_id, position_id, positions!inner(*)')
                    .eq('positions.system_type', systemType)
                    .order('zone_id', { ascending: true })
                    .order('position_id', { ascending: true })
                    .range(from, from + limit - 1)
                if (error) {
                    console.error(`[FetchAllZonesPos] Error:`, error)
                    throw error
                }
                if (!data || data.length === 0) break
                allRecs = [...allRecs, ...data]
                console.log(`[FetchAllZonesPos] loaded ${allRecs.length} links...`)
                if (data.length < limit) break
                from += limit
            }
            return allRecs
        }

        try {
            let [posData, zoneData, zpData, layoutData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code').order('id')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code').order('id')),
                fetchAllZonesPos(),
                fetchAll('zone_status_layouts')
            ])

            // Extract unique lot_ids currently in use on the map
            const uniqueLotIds = new Set<string>()
            posData.forEach((p: any) => {
                if (p.lot_id) uniqueLotIds.add(p.lot_id)
            })
            const lotIdsArray = Array.from(uniqueLotIds)

            console.log(`[DataSummary] Zones: ${zoneData.length}, Positions: ${posData.length}, Links: ${zpData.length}, Active Lots to fetch: ${lotIdsArray.length}`)

            // Fetch lots in chunks to prevent URI Too Long errors
            let lotsData: any[] = []
            if (lotIdsArray.length > 0) {
                const chunkSize = 150
                for (let i = 0; i < lotIdsArray.length; i += chunkSize) {
                    const chunk = lotIdsArray.slice(i, i + chunkSize)
                    // Attempt fetch with sort_order
                    let { data, error } = await supabase
                        .from('lots')
                        .select('id, code, quantity, lot_items(id, product_id, quantity, unit, products(name, sku, unit, color, internal_code, internal_name, sort_order)), lot_tags(tag, lot_item_id)')
                        .in('id', chunk)

                    if (error && error.code === '42703') {
                        // Fallback if sort_order column doesn't exist yet
                        console.warn("[FetchLots] sort_order column missing, falling back...");
                        const fallback = await supabase
                            .from('lots')
                            .select('id, code, quantity, lot_items(id, product_id, quantity, unit, products(name, sku, unit, color, internal_code, internal_name)), lot_tags(tag, lot_item_id)')
                            .in('id', chunk)
                        data = fallback.data
                        error = fallback.error
                    }

                    if (error) {
                        console.error(`[FetchLots] Error fetching chunk:`, error)
                        throw error
                    }
                    if (data) lotsData = [...lotsData, ...data]
                }
            }

            // Fallback for layouts if empty
            if (layoutData.length === 0) {
                const local = localStorage.getItem('local_status_layouts');
                if (local) layoutData = Object.values(JSON.parse(local));
            }

            // Create lookup map for positions -> zone_id (O(N) instead of O(N*M))
            const zpLookup = new Map<string, string>()
            zpData.forEach((zp: any) => {
                const pId = zp.positions?.id || zp.position_id
                if (pId && zp.zone_id) zpLookup.set(pId, zp.zone_id)
            })

            const posWithZone: PositionWithZone[] = posData.map(pos => {
                return { ...pos, zone_id: zpLookup.get(pos.id) || null }
            })

            const lotInfoMap: Record<string, any> = {}
            lotsData.forEach((l: any) => {
                lotInfoMap[l.id] = {
                    code: l.code,
                    items: l.lot_items?.map((it: any) => ({
                        id: it.id,
                        product_name: it.products?.name,
                        sku: it.products?.sku,
                        internal_code: it.products?.internal_code,
                        internal_name: it.products?.internal_name,
                        unit: it.unit || it.products?.unit,
                        product_color: it.products?.color,
                        quantity: it.quantity,
                        tags: l.lot_tags?.filter((t: any) => t.lot_item_id === it.id && !t.tag.startsWith('MERGED_')).map((t: any) => t.tag) || []
                    })) || []
                }
            })

            const layoutsMap: Record<string, any> = {}
            layoutData.forEach((l: any) => { if (l.zone_id) layoutsMap[l.zone_id] = l })

            setPositions(posWithZone)
            setZones(zoneData)
            setLayouts(layoutsMap)
            setLotInfo(lotInfoMap)

        } catch (error: any) {
            console.error('Error fetching status data:', error)
            setErrorMsg(error.message || "Lỗi tải dữ liệu trạng thái.")
        } finally {
            setLoading(false)
        }
    }

    const filteredPositions = useMemo(() => {
        let result = positions
        if (searchTerm) {
            const normalize = (str?: string | null) => {
                if (!str) return '';
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/Đ/g, 'd');
            }
            const term = normalize(searchTerm)

            result = result.filter(p => {
                if (normalize(p.code).includes(term)) return true

                if (p.lot_id && lotInfo[p.lot_id]) {
                    const lot = lotInfo[p.lot_id]
                    if (normalize(lot.code).includes(term)) return true

                    if (lot.items && Array.isArray(lot.items)) {
                        for (const item of lot.items) {
                            if (normalize(item.sku).includes(term)) return true
                            if (normalize(item.product_name).includes(term)) return true
                        }
                    }
                }

                return false
            })
        }
        if (selectedZoneId) {
            const getDescendantIds = (parentId: string): string[] => {
                const children = zones.filter(z => z.parent_id === parentId)
                let ids = children.map(c => c.id)
                children.forEach(c => ids = [...ids, ...getDescendantIds(c.id)])
                return ids
            }
            const validIds = new Set([selectedZoneId, ...getDescendantIds(selectedZoneId)])
            result = result.filter(p => p.zone_id && validIds.has(p.zone_id))
        }
        return result
    }, [positions, selectedZoneId, searchTerm, zones])

    const filteredZones = useMemo(() => {
        if (!selectedZoneId) return zones
        const collect = (pId: string): string[] => {
            const children = zones.filter(z => z.parent_id === pId)
            let ids = children.map(c => c.id)
            children.forEach(c => ids = [...ids, ...collect(c.id)])
            return ids
        }
        const allowed = new Set([selectedZoneId, ...collect(selectedZoneId)])
        return zones.filter(z => allowed.has(z.id))
    }, [zones, selectedZoneId])

    function toggleZoneCollapse(zoneId: string) {
        setCollapsedZones(prev => {
            const next = new Set(prev)
            if (next.has(zoneId)) next.delete(zoneId)
            else next.add(zoneId)
            return next
        })
    }

    const occupiedIds = useMemo(() => {
        const set = new Set<string>()
        filteredPositions.forEach(p => { if (p.lot_id) set.add(p.id) })
        return set
    }, [filteredPositions])

    const isModuleEnabled = useMemo(() => {
        return (moduleId: string) => {
            if (!currentSystem) return true

            // Simple check based on loaded system modules
            const allModules = new Set<string>()
            if (currentSystem.modules) {
                if (Array.isArray(currentSystem.modules)) {
                    currentSystem.modules.forEach(m => allModules.add(m))
                } else if (typeof currentSystem.modules === 'string') {
                    currentSystem.modules.split(',').forEach(m => allModules.add(m.trim().replace(/"/g, '').replace(/\[/g, '').replace(/\]/g, '')))
                }
            }
            if (Array.isArray(currentSystem.inbound_modules)) currentSystem.inbound_modules.forEach(m => allModules.add(m))
            if (Array.isArray(currentSystem.outbound_modules)) currentSystem.outbound_modules.forEach(m => allModules.add(m))

            // Fallback for current viewing lot data existence
            if (viewingLot) {
                if (moduleId === 'inbound_date' && viewingLot.inbound_date) return true
                if (moduleId === 'packaging_date' && viewingLot.packaging_date) return true
                if (moduleId === 'peeling_date' && viewingLot.peeling_date) return true
                if (moduleId === 'batch_code' && viewingLot.batch_code) return true
                if (moduleId === 'supplier_info' && viewingLot.suppliers) return true
                if (moduleId === 'qc_info' && viewingLot.qc_info) return true
                if (moduleId === 'extra_info' && viewingLot.metadata?.extra_info) return true
            }
            return allModules.has(moduleId)
        }
    }, [currentSystem, viewingLot])

    async function fetchFullLotDetails(lotId: string) {
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`*, created_at, suppliers(name), qc_info(name), lot_items(id, quantity, unit, products(name, sku, unit)), positions!positions_lot_id_fkey(code), lot_tags(tag, lot_item_id)`)
                .eq('id', lotId)
                .single()
            if (error) throw error
            setViewingLot(data)
        } catch (error: any) {
            console.error('Error fetching lot details:', error)
            showToast('Không thể tải chi tiết LOT: ' + error.message, 'error')
        }
    }

    // 4. Data Processing (Grouping)
    const { displayZones, displayPositions } = useMemo(() => {
        if (isGroupMergingEnabled) {
            const { zones: gZones, positions: gPos } = groupWarehouseData(filteredZones, filteredPositions)
            return { displayZones: gZones, displayPositions: gPos }
        }
        return { displayZones: filteredZones, displayPositions: filteredPositions }
    }, [isGroupMergingEnabled, filteredZones, filteredPositions])

    // Generate Legend Data
    const legendItems = useMemo(() => {
        const colorMap = new Map<string, { code: string, name: string, sort_order: number | null }>()

        Object.values(lotInfo).forEach(lot => {
            lot.items?.forEach((item: any) => {
                const pColor = item.product_color?.toLowerCase();
                if (pColor) {
                    if (!colorMap.has(pColor)) {
                        let code = 'N/A';
                        let name = 'Không rõ';
                        if (displayInternalInfo) {
                            code = item.internal_code || item.sku || 'N/A';
                            name = item.internal_name || item.product_name || 'N/A';
                        } else {
                            code = item.sku || 'N/A';
                            name = item.product_name || 'Không rõ';
                        }
                        colorMap.set(pColor, { 
                            code, 
                            name, 
                            sort_order: item.sort_order ?? null 
                        })
                    }
                }
            })
        })

        // Add defaults
        colorMap.set('#5c4033', { code: 'CHƯA CÀI ĐẶT MÀU', name: 'Nhấp để cấu hình', sort_order: 999999 })

        return Array.from(colorMap.entries())
            .map(([color, info]) => ({ color, ...info }))
            .sort((a, b) => {
                const s1 = a.sort_order ?? 999998;
                const s2 = b.sort_order ?? 999998;
                if (s1 !== s2) return s1 - s2;
                return a.code.localeCompare(b.code);
            })
    }, [lotInfo, displayInternalInfo])

    return (
        <div className="space-y-6 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-100 dark:border-slate-800">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                            <BarChart3 size={24} />
                        </div>
                        TRẠNG THÁI KHO
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">
                        Tổng hợp sơ đồ cấu trúc và tình trạng lấp đầy vị trí thực tế.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsCompactMode(!isCompactMode)}
                        className={`flex items-center gap-1.5 px-3.5 h-8 rounded-xl font-bold text-[10px] transition-all shadow-sm active:scale-95 ${
                            isCompactMode
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                        }`}
                    >
                        <Eye size={16} />
                        TỔNG QUAN
                    </button>
                    <Protected permission="warehousemap.manage">
                        <button
                            onClick={() => setIsColorModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 h-8 rounded-xl font-bold text-[10px] transition-all shadow-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 active:scale-95 border border-indigo-100 dark:border-indigo-800/50"
                        >
                            <Palette size={16} />
                            MÀU SẮC
                        </button>
                        <button
                            onClick={() => setIsDesignMode(!isDesignMode)}
                            className={`flex items-center gap-1.5 px-3.5 h-8 rounded-xl font-bold text-[10px] transition-all shadow-sm active:scale-95 ${
                                isDesignMode
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                            }`}
                        >
                            {isDesignMode ? <Layout size={16} /> : <Settings size={16} />}
                            {isDesignMode ? 'ĐANG THIẾT KẾ' : 'THIẾT KẾ LAYOUT'}
                        </button>
                        <button
                            onClick={() => setDisplayInternalInfo(!displayInternalInfo)}
                            className={`flex items-center gap-1.5 px-3.5 h-8 rounded-xl font-bold text-[10px] transition-all shadow-sm active:scale-95 ${
                                displayInternalInfo
                                    ? 'bg-violet-600 text-white hover:bg-violet-700'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                            }`}
                            title="Chuyển đổi hiển thị Mã/Tên sản phẩm Nội bộ"
                        >
                            <PackageSearch size={16} />
                            {displayInternalInfo ? 'MÃ NỘI BỘ: BẬT' : 'MÃ NỘI BỘ: TẮT'}
                        </button>

                        <button
                            onClick={() => setIsGroupMergingEnabled(!isGroupMergingEnabled)}
                            className={`flex items-center gap-1.5 px-3.5 h-8 rounded-xl font-bold text-[10px] transition-all shadow-sm active:scale-95 border ${
                                isGroupMergingEnabled
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-blue-200'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                            }`}
                        >
                            <Layers size={16} className={isGroupMergingEnabled ? 'text-blue-100' : 'text-blue-500'} />
                            {isGroupMergingEnabled ? 'GOM Ô: BẬT' : 'GOM Ô: TẮT'}
                        </button>
                    </Protected>
                </div>
            </div>

            {/* Hint for Design Mode */}
            {isDesignMode && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 flex items-start gap-3 animate-in slide-in-from-top-4">
                    <div className="p-1 bg-amber-500 text-white mt-0.5">
                        <Info size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-amber-800 dark:text-amber-300 text-sm">Chế độ Thiết kế Layout Trạng thái</h4>
                        <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                            Bạn đang điều chỉnh giao diện hiển thị cho <strong>Sơ đồ Trạng thái</strong>.
                            Thay đổi ở đây sẽ không ảnh hưởng đến <strong>Sơ đồ Kho</strong> thông thường.
                        </p>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="z-20">
                <HorizontalZoneFilter
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={setSelectedZoneId}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                />
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'TỔNG VỊ TRÍ', val: filteredPositions.length, color: 'indigo' },
                    { label: 'ĐÃ LẤP ĐẦY', val: occupiedIds.size, color: 'emerald' },
                    { label: 'CÒN TRỐNG', val: filteredPositions.length - occupiedIds.size, color: 'slate' },
                    { label: 'TỶ LỆ LẤP ĐẦY', val: `${((occupiedIds.size / (filteredPositions.length || 1)) * 100).toFixed(1)}%`, color: 'amber' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
                        <div className={`text-2xl font-black mt-1 text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.val}</div>
                    </div>
                ))}
            </div>

            {/* Main Status Diagram - Legend */}
            {legendItems.length > 0 && !loading && !errorMsg && (
                <div className="bg-slate-50/50 dark:bg-slate-900/30 p-4 border border-slate-100 dark:border-slate-800/50 rounded-2xl relative">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Palette size={14} className="text-indigo-500" /> 
                            CHÚ THÍCH MÀU SẮC ({legendItems.length})
                        </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {(isLegendExpanded ? legendItems : legendItems.slice(0, 10)).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 bg-white dark:bg-slate-900 pl-2 pr-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-900 group">
                                <div
                                    className="w-8 h-8 rounded-lg shadow-sm border border-black/5 dark:border-white/10 flex-shrink-0 transition-transform group-hover:scale-110"
                                    style={getProductColorStyle(item.color)}
                                />
                                <div className="flex flex-col min-w-0 gap-0.5">
                                    <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 truncate leading-tight font-mono tracking-tighter" title={item.code}>
                                        {item.code}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 truncate leading-none uppercase tracking-wide" title={item.name}>
                                        {item.name}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {legendItems.length > 10 && (
                        <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800/50 flex justify-center">
                            <button 
                                onClick={() => setIsLegendExpanded(!isLegendExpanded)}
                                className="px-6 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 uppercase tracking-widest flex items-center gap-1.5 transition-all shadow-sm active:scale-95 group"
                            >
                                {isLegendExpanded ? 'THU GỌN CHÚ THÍCH' : `XEM THÊM (${legendItems.length - 10}+ MÀU SẮC)`}
                                <ChevronDown size={14} className={`transition-transform duration-300 ${isLegendExpanded ? 'rotate-180' : ''}`} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-bold text-sm tracking-widest">ĐANG TẢI DỮ LIỆU TRẠNG THÁI...</p>
                </div>
            ) : errorMsg ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-8 text-center">
                    <p className="font-bold text-red-600 dark:text-red-400 mb-2">Đã xảy ra lỗi</p>
                    <p className="text-red-500 text-sm mb-4">{errorMsg}</p>
                    <button onClick={fetchData} className="px-6 py-2 bg-red-600 text-white font-bold hover:bg-red-700 transition-all">THỬ LẠI</button>
                </div>
            ) : (
                <WarehouseStatusMap
                    zones={displayZones}
                    positions={displayPositions}
                    layouts={layouts}
                    occupiedIds={occupiedIds}
                    lotInfo={lotInfo}
                    collapsedZones={collapsedZones}
                    isDesignMode={isDesignMode}
                    isCompactMode={isCompactMode}
                    displayInternalInfo={displayInternalInfo}
                    onToggleCollapse={toggleZoneCollapse}
                    onUpdateCollapsedWarehouses={setCollapsedZones}
                    onConfigureZone={setConfiguringZone}
                    onViewDetails={fetchFullLotDetails}
                />
            )}

            {/* Layout Config Drawer/Floating */}
            {configuringZone && (
                <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-8">
                    <StatusLayoutConfigPanel
                        zone={configuringZone}
                        layout={layouts[configuringZone.id] || null}
                        siblingZones={zones.filter(z => z.parent_id === configuringZone.parent_id)}
                        onSave={(newLayout) => {
                            setLayouts(prev => ({ ...prev, [configuringZone.id]: newLayout }))
                        }}
                        onBatchSave={(newLayouts) => {
                            const map = { ...layouts }
                            newLayouts.forEach(l => { if (l.zone_id) map[l.zone_id] = l })
                            setLayouts(map)
                        }}
                        allZones={zones}
                        allLayouts={layouts}
                        onClose={() => setConfiguringZone(null)}
                    />
                </div>
            )}

            {viewingLot && (
                <LotDetailsModal
                    lot={viewingLot}
                    onClose={() => setViewingLot(null)}
                    onOpenQr={(lot) => setQrLot(lot)}
                    isModuleEnabled={isModuleEnabled}
                />
            )}

            {isColorModalOpen && (
                <ProductColorConfigModal
                    onClose={() => setIsColorModalOpen(false)}
                    onSaved={fetchData}
                    displayInternalInfo={displayInternalInfo}
                />
            )}
        </div>
    )
}

export default function WarehouseStatusPage() {
    return (
        <Suspense fallback={<div className="p-12 text-center text-slate-400 font-bold">ĐANG CHUẨN BỊ SƠ ĐỒ...</div>}>
            <WarehouseStatusContent />
        </Suspense>
    )
}
