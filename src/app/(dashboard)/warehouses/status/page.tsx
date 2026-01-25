'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import {
    PieChart,
    AlertTriangle,
    Info,
    X,
    Sparkles,
    Settings,
    Map as MapIcon,
    Layers
} from 'lucide-react'
import WarehouseStats from '@/components/warehouse/WarehouseStats'
import SmartRackList from '@/components/warehouse/SmartRackList'
import SmartSuggestions from '@/components/warehouse/SmartSuggestions'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import LayoutConfigPanel from '@/components/warehouse/LayoutConfigPanel'
import { ZoneData } from '@/components/warehouse/types'
import { Database } from '@/lib/database.types'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface LotItem {
    id: string
    product_id: string
    quantity: number
    unit?: string
    products: { name: string, sku: string, unit: string }
}

interface Lot {
    id: string
    code: string
    quantity: number
    inbound_date?: string
    created_at?: string
    packaging_date?: string
    peeling_date?: string
    lot_items: LotItem[]
    lot_tags: Array<{ tag: string, lot_item_id: string }>
}

export default function WarehouseStatusPage() {
    const { systemType, systems, currentSystem } = useSystem()
    const [loading, setLoading] = useState(true)
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [zonePositions, setZonePositions] = useState<any[]>([])
    const [layouts, setLayouts] = useState<ZoneLayout[]>([])
    const [lots, setLots] = useState<Record<string, Lot>>({})
    const [error, setError] = useState<string | null>(null)
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Layout design state
    const [isDesignMode, setIsDesignMode] = useState(false)
    const [configuringZone, setConfiguringZone] = useState<Zone | null>(null)
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (systemType) {
            fetchData()
        }
    }, [systemType])

    async function fetchData() {
        setLoading(true)
        setError(null)
        try {
            const [posRes, zoneRes, zpRes, layoutRes, lotsRes] = await Promise.all([
                supabase.from('positions').select('*').eq('system_type', systemType).order('code'),
                supabase.from('zones').select('*').eq('system_type', systemType).order('level').order('code'),
                supabase.from('zone_positions').select('*'),
                (supabase as any).from('zone_status_layouts').select('*'),
                supabase.from('lots').select(`
                    id, code, quantity, inbound_date, created_at, packaging_date, peeling_date,
                    lot_items(id, product_id, quantity, products(name, sku, unit)),
                    lot_tags(tag, lot_item_id)
                `)
            ])

            if (posRes.error) throw posRes.error
            if (zoneRes.error) throw zoneRes.error
            if (lotsRes.error) throw lotsRes.error
            if (layoutRes.error) throw layoutRes.error

            setPositions((posRes.data || []) as PositionWithZone[])
            setZones(zoneRes.data || [])
            setZonePositions(zpRes.data || [])
            setLayouts(layoutRes.data || [])

            const lotMap: Record<string, Lot> = {}
            lotsRes.data?.forEach(l => {
                lotMap[l.id] = {
                    ...l,
                    lot_items: (l.lot_items || []).map((li: any) => ({
                        ...li,
                        products: Array.isArray(li.products) ? li.products[0] : li.products
                    }))
                } as any
            })
            setLots(lotMap)

        } catch (err: any) {
            console.error('Error fetching warehouse status:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const positionsWithZone = useMemo((): PositionWithZone[] => {
        return positions.map(pos => {
            const zp = zonePositions.find(zp => zp.position_id === pos.id)
            return { ...pos, zone_id: zp?.zone_id }
        })
    }, [positions, zonePositions])

    const transformedZones = useMemo((): ZoneData[] => {
        const zoneMap = new Map<string, ZoneData>()

        zones.forEach(z => {
            zoneMap.set(z.id, {
                id: z.id,
                name: z.name,
                level: z.level || 0,
                parent_id: z.parent_id,
                children: [],
                positions: []
            })
        })

        positionsWithZone.forEach(p => {
            if (p.zone_id && zoneMap.has(p.zone_id)) {
                const zone = zoneMap.get(p.zone_id)!
                const items: any[] = []
                if (p.lot_id && lots[p.lot_id]) {
                    const lot = lots[p.lot_id]
                    lot.lot_items.forEach((li, idx) => {
                        items.push({
                            position: idx + 1,
                            code: lot.code,
                            name: li.products.name,
                            quantity: String(li.quantity),
                            unit: li.unit || li.products.unit || 'Pallet'
                        })
                    })
                }
                zone.positions!.push({ id: p.id, code: p.code, lot_id: p.lot_id, items })
            }
        })

        zones.forEach(z => {
            if (z.parent_id && zoneMap.has(z.parent_id)) {
                zoneMap.get(z.parent_id)!.children!.push(zoneMap.get(z.id)!)
            }
        })

        zoneMap.forEach((node: ZoneData) => {
            node.children!.sort((a: ZoneData, b: ZoneData) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            node.positions!.sort((a: any, b: any) => a.code.localeCompare(b.code, undefined, { numeric: true }))
        })

        return zones
            .filter(z => !z.parent_id || !zoneMap.has(z.parent_id))
            .map(z => zoneMap.get(z.id)!)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    }, [zones, positionsWithZone, lots])

    const layoutsMap = useMemo(() => {
        const map: Record<string, ZoneLayout> = {}
        layouts.forEach(l => { if (l.zone_id) map[l.zone_id] = l })
        return map
    }, [layouts])

    function handleLayoutSave(updatedLayout: ZoneLayout) {
        setLayouts(prev => {
            const existing = prev.find(l => l.zone_id === updatedLayout.zone_id)
            if (existing) {
                return prev.map(l => l.zone_id === updatedLayout.zone_id ? updatedLayout : l)
            }
            return [...prev, updatedLayout]
        })
        setConfiguringZone(null)
    }

    function handleBatchSave(updatedLayouts: ZoneLayout[]) {
        setLayouts(prev => {
            const newLayouts = [...prev]
            for (const updated of updatedLayouts) {
                const idx = newLayouts.findIndex(l => l.zone_id === updated.zone_id)
                if (idx >= 0) {
                    newLayouts[idx] = updated
                } else {
                    newLayouts.push(updated)
                }
            }
            return newLayouts
        })
    }

    if (loading && positions.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                <span className="ml-3 text-stone-500">Đang tải dữ liệu kho...</span>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-10 relative">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm">
                            <PieChart size={28} />
                        </div>
                        Biểu đồ trạng thái kho
                    </h1>
                    <p className="text-stone-500 mt-2 font-medium flex items-center gap-2">
                        <Info size={16} />
                        Thống kê mật độ lưu trữ và phân bổ hàng hóa theo khu vực
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Design Mode Toggle */}
                    <button
                        onClick={() => setIsDesignMode(!isDesignMode)}
                        className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-sm ${isDesignMode
                            ? 'bg-orange-600 text-white shadow-orange-500/20'
                            : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                    >
                        <Settings size={18} />
                        {isDesignMode ? 'Thoát Thiết kế' : 'Thiết kế Layout'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-3xl flex items-center gap-4 shadow-sm">
                    <AlertTriangle size={24} />
                    <p className="font-semibold">{error}</p>
                </div>
            )}

            <WarehouseStats zones={transformedZones} isLoading={loading} />

            <div className="relative">
                <SmartRackList
                    zones={transformedZones}
                    isLoading={loading}
                    warehouseId={systems.find(s => s.code === systemType)?.name || systemType}
                    isDesignMode={isDesignMode}
                    onConfigureZone={(zoneId) => {
                        const zone = zones.find(z => z.id === zoneId)
                        if (zone) setConfiguringZone(zone)
                    }}
                    layouts={layoutsMap}
                />

                {/* Layout Config Panel */}
                {configuringZone && (
                    <div className="fixed bottom-8 left-8 z-[100] animate-in slide-in-from-left-5">
                        <LayoutConfigPanel
                            zone={configuringZone}
                            layout={layoutsMap[configuringZone.id] || null}
                            siblingZones={zones.filter(z => z.parent_id === configuringZone.parent_id)}
                            onSave={handleLayoutSave}
                            onBatchSave={handleBatchSave}
                            onClose={() => setConfiguringZone(null)}
                            tableName="zone_status_layouts"
                        />
                    </div>
                )}

                <div className="fixed z-50 flex flex-col items-end gap-2" style={{ right: '32px', bottom: '32px' }}>
                    {showSuggestions && (
                        <div className="mb-2 w-80 md:w-96 max-h-[60vh] bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-200 mr-2 border-orange-500/20 shadow-orange-500/10">
                            <div className="flex-1 overflow-auto">
                                <SmartSuggestions />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 pr-2">
                        <button
                            onClick={() => setShowSuggestions(!showSuggestions)}
                            className={`h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 border-2 ${showSuggestions
                                ? 'bg-orange-600 border-orange-400 text-white rotate-90'
                                : 'bg-gradient-to-r from-orange-500 to-amber-500 border-white/20 text-white shadow-orange-500/20'
                                }`}
                        >
                            {showSuggestions ? <X size={24} /> : <Sparkles size={24} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
