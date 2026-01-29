'use client'
import { useState, useEffect, useMemo, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Database } from '@/lib/database.types'
import { BarChart3, Settings, Package, Map as MapIcon, Info, Layout } from 'lucide-react'
import WarehouseStatusMap from '@/components/warehouse/status/WarehouseStatusMap'
import StatusLayoutConfigPanel from '@/components/warehouse/status/StatusLayoutConfigPanel'
import HorizontalZoneFilter from '@/components/warehouse/HorizontalZoneFilter'
import { useSystem } from '@/contexts/SystemContext'
import Protected from '@/components/auth/Protected'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

function WarehouseStatusContent() {
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
    const [configuringZone, setConfiguringZone] = useState<Zone | null>(null)

    // Collapsed zones
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())

    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})

    // Auth Session State
    const [session, setSession] = useState<any>(null)

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
                    .select('zone_id, positions!inner(*)')
                    .eq('positions.system_type', systemType)
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
            const [posData, zoneData, zpData, layoutRes, lotsData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code')),
                fetchAllZonesPos(),
                supabase.from('zone_status_layouts' as any).select('*').limit(1000),
                fetchAll('lots', q => q.order('created_at', { ascending: false }), 'id, code, quantity, lot_items(id, product_id, quantity, products(name, sku, unit))')
            ])

            console.log(`[DataSummary] Zones: ${zoneData.length}, Positions: ${posData.length}, Links: ${zpData.length}, Lots: ${lotsData.length}`)

            let layoutData: any[] = []
            if (layoutRes.error) {
                console.warn('Could not fetch zone_status_layouts, trying localStorage fallback.');
                const local = localStorage.getItem('local_status_layouts');
                if (local) layoutData = Object.values(JSON.parse(local));
            } else {
                layoutData = layoutRes.data || []
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
                        product_name: it.products?.name,
                        sku: it.products?.sku,
                        unit: it.products?.unit,
                        quantity: it.quantity
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
            const term = searchTerm.toLowerCase()
            result = result.filter(p => p.code.toLowerCase().includes(term))
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
        positions.forEach(p => { if (p.lot_id) set.add(p.id) })
        return set
    }, [positions])

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
                    <Protected permission="warehousemap.manage">
                        <button
                            onClick={() => setIsDesignMode(!isDesignMode)}
                            className={`flex items-center gap-2 px-6 py-2.5 font-bold transition-all shadow-sm ${isDesignMode
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            {isDesignMode ? <Layout size={18} /> : <Settings size={18} />}
                            {isDesignMode ? 'ĐANG THIẾT KẾ' : 'THIẾT KẾ LAYOUT'}
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
                    { label: 'TỔNG VỊ TRÍ', val: positions.length, color: 'indigo' },
                    { label: 'ĐÃ LẤP ĐẦY', val: occupiedIds.size, color: 'emerald' },
                    { label: 'CÒN TRỐNG', val: positions.length - occupiedIds.size, color: 'slate' },
                    { label: 'TỶ LỆ LẤP ĐẦY', val: `${((occupiedIds.size / (positions.length || 1)) * 100).toFixed(1)}%`, color: 'amber' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
                        <div className={`text-2xl font-black mt-1 text-${stat.color}-600 dark:text-${stat.color}-400`}>{stat.val}</div>
                    </div>
                ))}
            </div>

            {/* Main Status Diagram */}
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
                    zones={filteredZones}
                    positions={filteredPositions}
                    layouts={layouts}
                    occupiedIds={occupiedIds}
                    lotInfo={lotInfo}
                    collapsedZones={collapsedZones}
                    isDesignMode={isDesignMode}
                    onToggleCollapse={toggleZoneCollapse}
                    onConfigureZone={setConfiguringZone}
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
