'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Loader2, Printer, Download, Search, Check, ChevronDown, ChevronRight, MapPin, X, Settings as SettingsIcon, Layout, Monitor, Layers } from 'lucide-react'
import { toJpeg } from 'html-to-image'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'
import { EditableText } from '@/components/print/PrintHelpers'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import { Database } from '@/lib/database.types'
import { groupWarehouseData } from '@/lib/warehouseUtils'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

export default function WarehouseMapPrintPage() {
    const searchParams = useSearchParams()

    // Filters from URL
    const systemType = searchParams.get('systemType') || ''
    const selectedZoneId = searchParams.get('zoneId') || ''
    const searchTerm = searchParams.get('search') || ''
    const token = searchParams.get('token')
    const isSnapshot = searchParams.get('snapshot') === '1'
    const displayInternalCode = searchParams.get('internalCode') === 'true'

    // Company info params (for image generation service)
    const cmpName = searchParams.get('cmp_name')
    const cmpAddress = searchParams.get('cmp_address')
    const cmpPhone = searchParams.get('cmp_phone')
    const cmpEmail = searchParams.get('cmp_email')
    const cmpLogo = searchParams.get('cmp_logo')
    const cmpShort = searchParams.get('cmp_short')

    const initialCompanyInfo = cmpName ? {
        name: cmpName,
        address: cmpAddress,
        phone: cmpPhone,
        email: cmpEmail,
        logo_url: cmpLogo,
        short_name: cmpShort,
    } as CompanyInfo : null

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Data states
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [layouts, setLayouts] = useState<Record<string, ZoneLayout>>({})
    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})
    const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())

    // Editable Titles
    const [editReportTitle, setEditReportTitle] = useState('SƠ ĐỒ BỐ TRÍ KHO')
    const [signTitle1, setSignTitle1] = useState('Người Lập Biểu')
    const [signTitle2, setSignTitle2] = useState('Thủ Kho')
    const [signTitle3, setSignTitle3] = useState('Giám Đốc')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    const [showTable, setShowTable] = useState(false)
    const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'occupied' | 'empty'>('all')
    const [isZonePickerOpen, setIsZonePickerOpen] = useState(false)
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)
    const [zoneSearchTerm, setZoneSearchTerm] = useState('')
    const [expandedZoneIds, setExpandedZoneIds] = useState<Set<string>>(new Set())
    const [isGrouped, setIsGrouped] = useState(false)

    const [pageBreakZoneIds, setPageBreakZoneIds] = useState<Set<string>>(new Set())

    const [isDownloading, setIsDownloading] = useState(false)
    const { isCapturing, downloadTimer, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `so-do-kho-${new Date().toISOString().split('T')[0]}`
    })
    const isSnapshotMode = isSnapshot || isCapturing
    const isDownloadingState = isDownloading || isCapturing
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>((searchParams.get('orientation') as any) || 'landscape')

    const router = useRouter()
    const pathname = usePathname()

    const handleOrientationChange = (o: 'portrait' | 'landscape') => {
        setOrientation(o)
        const params = new URLSearchParams(searchParams.toString())
        params.set('orientation', o)
        router.replace(`${pathname}?${params.toString()}`)
    }

    const handleTogglePageBreak = (zoneId: string) => {
        setPageBreakZoneIds(prev => {
            const next = new Set(prev)
            if (next.has(zoneId)) next.delete(zoneId)
            else next.add(zoneId)
            return next
        })
    }

    const handleZoneChange = (zoneId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (zoneId) params.set('zoneId', zoneId)
        else params.delete('zoneId')
        router.push(`${pathname}?${params.toString()}`)
    }

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token,
        initialCompanyInfo,
        fallbackToProfile: !initialCompanyInfo
    })

    useEffect(() => {
        fetchData()
    }, [systemType])

    async function fetchData() {
        if (!systemType) {
            setError("Thiếu tham số hệ thống (systemType)")
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)

        try {
            if (token) {
                await supabase.auth.setSession({ access_token: token, refresh_token: '' })
            }

            // Fetch generic limit-aware helper
            const fetchAll = async (table: string, filter?: (query: any) => any, select = '*', limit = 1000) => {
                let allRecs: any[] = []
                let from = 0
                while (true) {
                    let query = supabase.from(table as any).select(select).range(from, from + limit - 1)
                    if (filter) query = filter(query)
                    const { data, error } = await query
                    if (error) throw error
                    if (!data || data.length === 0) break
                    allRecs = [...allRecs, ...data]
                    if (data.length < limit) break
                    from += limit
                }

                // Deduplicate based on table
                if (['positions', 'zones', 'zone_layouts', 'lots'].includes(table)) {
                    const uniqueMap = new Map()
                    for (const item of allRecs) {
                        if (item.id) uniqueMap.set(item.id, item)
                    }
                    return Array.from(uniqueMap.values())
                } else if (table === 'zone_positions') {
                    const uniqueMap = new Map()
                    for (const item of allRecs) {
                        uniqueMap.set(`${item.zone_id}-${item.position_id}`, item)
                    }
                    return Array.from(uniqueMap.values())
                }

                return allRecs
            }

            // Fetch data similarly to Map Page
            const [posData, zoneData, zpData, layoutData, lotsData] = await Promise.all([
                fetchAll('positions', q => q.eq('system_type', systemType).order('code').order('id')),
                fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code').order('id')),
                fetchAll('zone_positions', q => q.select('zone_id, position_id, positions!inner(system_type)').eq('positions.system_type', systemType).order('zone_id', { ascending: true }).order('position_id', { ascending: true })),
                fetchAll('zone_layouts', q => q.order('id')),
                fetchAll('lots', q => q.order('id'), '*, suppliers(name), qc_info(name), products(name, unit, sku, internal_code, internal_name), lot_items(id, product_id, quantity, unit, products(name, unit, sku, internal_code, internal_name)), lot_tags(tag, lot_item_id)')
            ])

            // Process structure
            const zpLookup: Record<string, string> = {}
            zpData.forEach((zp: any) => {
                if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id
            })

            const posWithZone: PositionWithZone[] = (posData as any[]).map(pos => ({
                ...pos, zone_id: zpLookup[pos.id] || null
            }))

            const layoutsMap: Record<string, ZoneLayout> = {}
            layoutData.forEach((l: any) => { if (l.zone_id) layoutsMap[l.zone_id] = l })

            const lotInfoMap: Record<string, any> = {}
            const occupied = new Set<string>();

            (lotsData as any[]).forEach((l: any) => {
                const lotItems = l.lot_items || []
                const allTags = l.lot_tags || []
                let items: any[] = []
                let accumulatedTags: string[] = []

                if (lotItems.length > 0) {
                    items = lotItems.map((item: any) => {
                        const itemTags = allTags
                            .filter((t: any) => t.lot_item_id === item.id)
                            .map((t: any) => t.tag.replace(/@/g, item.products?.sku || ''))
                            .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                        accumulatedTags.push(...itemTags)
                        return {
                            product_name: item.products?.name,
                            sku: item.products?.sku,
                            internal_code: item.products?.internal_code,
                            internal_name: item.products?.internal_name,
                            unit: item.unit || item.products?.unit,
                            quantity: item.quantity,
                            tags: itemTags
                        }
                    })
                } else if (l.products) {
                    const itemTags = allTags
                        .map((t: any) => t.tag.replace(/@/g, l.products?.sku || ''))
                        .filter((t: string) => !t.startsWith('MERGED_FROM:') && !t.startsWith('MERGED_DATA:'))
                    accumulatedTags.push(...itemTags)
                    items = [{
                        product_name: l.products.name,
                        sku: l.products.sku,
                        internal_code: l.products.internal_code,
                        internal_name: l.products.internal_name,
                        unit: l.products.unit,
                        quantity: l.quantity,
                        tags: itemTags
                    }]
                }

                lotInfoMap[l.id] = {
                    ...l,
                    items,
                    tags: accumulatedTags,
                    qc_name: l.qc_info?.name,
                    supplier_name: l.suppliers?.name
                }
            })

            posWithZone.forEach(pos => {
                if (pos.lot_id && lotInfoMap[pos.lot_id]) {
                    const totalQty = lotInfoMap[pos.lot_id].items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0)
                    if (totalQty > 0) occupied.add(pos.id)
                }
            })

            setPositions(posWithZone)
            setZones(zoneData)
            setLayouts(layoutsMap)
            setLotInfo(lotInfoMap)
            setOccupiedIds(occupied)

        } catch (e: any) {
            console.error(e)
            setError(e.message || String(e))
        } finally {
            setLoading(false)
        }
    }

    // Recursive Grouping Logic
    const groupedData = useMemo(() => {
        if (!isGrouped) return { zones, positions }
        return groupWarehouseData(zones, positions)
    }, [isGrouped, zones, positions])

    const displayZones = groupedData.zones
    const displayPositions = groupedData.positions

    // Helper for O(1) zone filtering
    const descendantIdSet = useMemo(() => {
        if (!selectedZoneId) return null
        const parentToChildren = new Map<string, string[]>()
        displayZones.forEach(z => {
            if (z.parent_id) {
                const children = parentToChildren.get(z.parent_id) || []
                children.push(z.id)
                parentToChildren.set(z.parent_id, children)
            }
        })

        const ids = new Set<string>()
        const collect = (id: string) => {
            ids.add(id)
            const children = parentToChildren.get(id) || []
            children.forEach(collect)
        }
        collect(selectedZoneId)
        return ids
    }, [displayZones, selectedZoneId])

    const filteredPositions = useMemo(() => {
        let result = displayPositions

        if (descendantIdSet) {
            result = result.filter(p => p.zone_id && descendantIdSet.has(p.zone_id))
        }

        if (occupancyFilter === 'occupied') {
            result = result.filter(p => occupiedIds.has(p.id))
        } else if (occupancyFilter === 'empty') {
            result = result.filter(p => !occupiedIds.has(p.id))
        }

        if (searchTerm) {
            const lowTerm = searchTerm.toLowerCase().trim()
            result = result.filter(p => {
                const pLot = lotInfo[p.id] || (p.lot_id ? lotInfo[p.lot_id] : {})
                return p.code.toLowerCase().includes(lowTerm) ||
                    (pLot.items || []).some((item: any) =>
                        item.product_name?.toLowerCase().includes(lowTerm) ||
                        item.sku?.toLowerCase().includes(lowTerm)
                    ) ||
                    pLot.code?.toLowerCase().includes(lowTerm)
            })
        }

        return result
    }, [displayPositions, descendantIdSet, occupancyFilter, searchTerm, occupiedIds, lotInfo])

    const filteredZones = useMemo(() => {
        if (!descendantIdSet) return displayZones
        return displayZones.filter(z => descendantIdSet.has(z.id))
    }, [displayZones, descendantIdSet])

    const handlePrint = () => window.print()

    const handleDownload = () => handleCapture(orientation === 'landscape', `so-do-kho-${new Date().toISOString().split('T')[0]}.jpg`)

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin mr-2" /> Đang tải dữ liệu...</div>
    if (error) return <div className="flex h-screen items-center justify-center text-red-600 font-bold">Lỗi: {error}</div>

    return (
        <>
            {/* Toolbar */}
            <div className={`fixed top-4 right-4 z-50 print:hidden flex gap-3 items-center ${isSnapshotMode ? 'hidden' : ''}`}>
                {/* Unified Settings Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className={`flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-xl border transition-all cursor-pointer hover:bg-gray-50 group ${isSettingsOpen ? 'border-indigo-500 ring-2 ring-indigo-50' : 'border-gray-200'}`}
                    >
                        <SettingsIcon size={18} className={`text-gray-600 group-hover:text-indigo-600 transition-transform ${isSettingsOpen ? 'rotate-90' : ''}`} />
                        <span className="text-sm font-semibold text-gray-700">Cấu hình in</span>
                        <ChevronDown size={14} className="text-gray-400" />
                    </button>

                    {isSettingsOpen && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col p-4 gap-6 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* 1. Zone Selection */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                    <MapPin size={12} /> Khu vực in
                                </label>
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsZonePickerOpen(!isZonePickerOpen);
                                        }}
                                        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-sm text-gray-700 cursor-pointer"
                                    >
                                        <span className="truncate flex-1 text-left">
                                            {displayZones.find(z => z.id === selectedZoneId)?.name || 'Tất cả Zone'}
                                        </span>
                                        <ChevronRight size={14} className={`text-gray-400 transition-transform ${isZonePickerOpen ? 'rotate-90' : ''}`} />
                                    </button>

                                    {isZonePickerOpen && (
                                        <div className="absolute right-full mr-2 top-0 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[400px] z-[60]">
                                            <div className="p-2 border-b bg-gray-50/50">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                                                    <input
                                                        type="text"
                                                        placeholder="Tìm zone..."
                                                        value={zoneSearchTerm}
                                                        onChange={(e) => setZoneSearchTerm(e.target.value)}
                                                        className="w-full pl-8 pr-2 py-1.5 bg-white border border-gray-200 rounded text-xs outline-none"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto p-1 custom-scrollbar">
                                                {(() => {
                                                    const baseZones = selectedZoneId && !zoneSearchTerm
                                                        ? displayZones.filter(z => z.id === selectedZoneId)
                                                        : displayZones.filter(z => !z.parent_id);

                                                    const toggleExpand = (e: React.MouseEvent, id: string) => {
                                                        e.stopPropagation()
                                                        const newSet = new Set(expandedZoneIds)
                                                        if (newSet.has(id)) newSet.delete(id)
                                                        else newSet.add(id)
                                                        setExpandedZoneIds(newSet)
                                                    }

                                                    // Use pre-computed map for O(1) child lookups
                                                    const childrenMap = new Map<string, Zone[]>()
                                                    displayZones.forEach(z => {
                                                        if (z.parent_id) {
                                                            const list = childrenMap.get(z.parent_id) || []
                                                            list.push(z)
                                                            childrenMap.set(z.parent_id, list)
                                                        }
                                                    })

                                                    const renderTree = (z: Zone, depth: number): React.ReactNode[] => {
                                                        const subZones = childrenMap.get(z.id) || []
                                                        const hasChildren = subZones.length > 0
                                                        const isExpanded = expandedZoneIds.has(z.id) || zoneSearchTerm

                                                        const matchesSearch = !zoneSearchTerm || z.name.toLowerCase().includes(zoneSearchTerm.toLowerCase())

                                                        // Optimization: O(1) check if any descendant matches the search
                                                        let descendantMatch = false
                                                        if (zoneSearchTerm && !matchesSearch && hasChildren) {
                                                            const checkDescendants = (nodeId: string): boolean => {
                                                                const children = childrenMap.get(nodeId) || []
                                                                for (const child of children) {
                                                                    if (child.name.toLowerCase().includes(zoneSearchTerm.toLowerCase())) return true
                                                                    if (checkDescendants(child.id)) return true
                                                                }
                                                                return false
                                                            }
                                                            descendantMatch = checkDescendants(z.id)
                                                        }

                                                        if (!matchesSearch && !descendantMatch) return []

                                                        return [
                                                            <div key={z.id}>
                                                                <button
                                                                    onClick={() => {
                                                                        handleZoneChange(z.id)
                                                                        setIsZonePickerOpen(false)
                                                                        setZoneSearchTerm('')
                                                                    }}
                                                                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs hover:bg-blue-50 group ${selectedZoneId === z.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-700'}`}
                                                                >
                                                                    <div className="shrink-0" style={{ width: depth * 12 }} />
                                                                    {hasChildren ? (
                                                                        <div onClick={(e) => toggleExpand(e, z.id)} className="p-0.5 hover:bg-gray-200 rounded text-gray-400">
                                                                            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                                        </div>
                                                                    ) : <div className="w-[18px]" />}
                                                                    <span className="truncate flex-1 text-left">{z.name}</span>
                                                                    {selectedZoneId === z.id && <Check size={12} />}
                                                                </button>
                                                                {isExpanded && subZones.flatMap(c => renderTree(c, depth + 1))}
                                                            </div>
                                                        ]
                                                    }
                                                    return baseZones.flatMap(root => renderTree(root, 0))
                                                })()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. Occupancy Filter */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                    <Layers size={12} /> Lọc trạng thái
                                </label>
                                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                                    {(['all', 'occupied', 'empty'] as const).map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setOccupancyFilter(f)}
                                            className={`py-1.5 text-[11px] font-medium rounded-md transition-all cursor-pointer ${occupancyFilter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                        >
                                            {f === 'all' ? 'Tất cả' : f === 'occupied' ? 'Có hàng' : 'Trống'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Orientation & View Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                        <Monitor size={12} /> Khổ giấy
                                    </label>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => handleOrientationChange('portrait')}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${orientation === 'portrait' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Dọc
                                        </button>
                                        <button
                                            onClick={() => handleOrientationChange('landscape')}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${orientation === 'landscape' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Ngang
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                        <Layout size={12} /> Hiển thị
                                    </label>
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setShowTable(false)}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${!showTable ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Sơ đồ
                                        </button>
                                        <button
                                            onClick={() => setShowTable(true)}
                                            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md cursor-pointer ${showTable ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                                        >
                                            Bảng
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 4. Grouping Toggle */}
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold uppercase text-gray-400 flex items-center gap-2">
                                    <Layers size={12} /> Chế độ gom ô
                                </label>
                                <button
                                    onClick={() => setIsGrouped(!isGrouped)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer ${isGrouped ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                >
                                    <span className="text-xs font-semibold">{isGrouped ? 'Đang bật Gom ô' : 'Đang tắt Gom ô'}</span>
                                    <div className={`w-8 h-4 rounded-full relative transition-colors ${isGrouped ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isGrouped ? 'left-4.5' : 'left-0.5'}`} />
                                    </div>
                                </button>
                                <p className="text-[10px] text-gray-400 italic">Gộp các ô có chung hậu tố số (A01, B01 {"->"} Ô 01) để thu gọn sơ đồ.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex bg-white rounded-lg shadow-xl border border-gray-200 p-1 gap-1">
                    <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-green-700 transition-colors cursor-pointer shadow-sm"
                        disabled={isCapturing}
                    >
                        {isCapturing ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        Tải ảnh phiếu
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors cursor-pointer shadow-sm"
                    >
                        <Printer size={16} />
                        In sơ đồ
                    </button>
                </div>
            </div>

            {/* Backdrop for Settings */}
            {isSettingsOpen && (
                <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => {
                        setIsSettingsOpen(false);
                        setIsZonePickerOpen(false);
                    }}
                />
            )}

            {/* Main Wrapper for better screen presentation */}
            <div className={`min-h-screen bg-gray-100/50 print:bg-white py-8 print:py-0 ${isCapturing ? '!p-0 !bg-white' : ''}`}>
                <div
                    id="print-ready"
                    data-ready="true"
                    className={`
                        bg-white mx-auto text-black p-4 print:p-2 text-[13px] transition-all duration-500
                        ${isCapturing ? 'shadow-none !p-4' : 'shadow-2xl rounded-xl ring-1 ring-black/5'}
                        ${orientation === 'landscape'
                            ? (isCapturing ? '!w-[1400px]' : 'w-[98%] max-w-[1700px]')
                            : (isCapturing ? '!w-[1100px]' : 'w-[95%] max-w-[1300px]')
                        }
                    `}
                    style={!isCapturing ? {
                        minHeight: orientation === 'landscape' ? '210mm' : '297mm'
                    } : undefined}
                >
                    <style dangerouslySetInnerHTML={{
                        __html: `
                            @media print {
                                #print-ready {
                                    width: ${orientation === 'landscape' ? '297mm' : '210mm'} !important;
                                    max-width: none !important;
                                    margin: 0 !important;
                                    padding: 10mm !important;
                                    box-shadow: none !important;
                                    border-radius: 0 !important;
                                    ring: none !important;
                                }
                                body { background: white !important; }
                            }
                        `
                    }} />
                    {isCapturing && (
                        <style dangerouslySetInnerHTML={{
                            __html: `
                    #print-ready {
                        width: ${orientation === 'landscape' ? '1400px' : '1100px'} !important;
                        margin: 0 !important;
                        padding: 40px 60px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        box-sizing: border-box !important;
                    }
                `}} />
                    )}

                    <div className="mb-3">
                        <PrintHeader companyInfo={companyInfo} logoSrc={logoSrc} size="compact" />
                    </div>

                    <div className="text-center mb-3">
                        <EditableText
                            value={editReportTitle}
                            onChange={setEditReportTitle}
                            className="text-2xl font-bold uppercase text-center w-full"
                            style={{ fontFamily: "'Times New Roman', Times, serif" }}
                            isSnapshot={isSnapshotMode}
                        />
                        <p className="italic mt-1">Ngày in: {new Date().toLocaleDateString('vi-VN')}</p>
                        {selectedZoneId && (
                            <p className="font-medium mt-1">Vùng kho: {displayZones.find(z => z.id === selectedZoneId)?.name}</p>
                        )}
                        {searchTerm && (
                            <p className="text-sm mt-1">Lọc theo: "{searchTerm}"</p>
                        )}
                    </div>

                    {/* The Map Grid OR Data Table View */}
                    <div className="mb-8 print:mb-4">
                        {!showTable ? (
                            <div className="mt-8">
                                <FlexibleZoneGrid
                                    zones={filteredZones}
                                    positions={filteredPositions}
                                    layouts={layouts}
                                    occupiedIds={occupiedIds}
                                    lotInfo={lotInfo}
                                    collapsedZones={new Set()} // Expand all for printing
                                    selectedPositionIds={new Set()}
                                    onToggleCollapse={() => { }}
                                    onPositionSelect={() => { }}
                                    pageBreakIds={pageBreakZoneIds}
                                    onTogglePageBreak={isGrouped ? undefined : handleTogglePageBreak}
                                    displayInternalCode={displayInternalCode}
                                    isDesignMode={false}
                                    onPrintZone={isGrouped ? undefined : () => { }}
                                    isGrouped={isGrouped}
                                />
                            </div>
                        ) : (
                            <div className="overflow-hidden border border-gray-300 rounded-lg">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-[11px] font-bold uppercase tracking-wider border-b border-gray-300">
                                            <th className="px-3 py-2 border-r border-gray-300 w-[12%]">Vị trí</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[15%]">Số lô (Lot)</th>
                                            <th className="px-3 py-2 border-r border-gray-300">Sản phẩm</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[15%]">Mã sản phẩm</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[8%] text-center">ĐVT</th>
                                            <th className="px-3 py-2 border-r border-gray-300 w-[8%] text-right">S.Lượng</th>
                                            <th className="px-3 py-2">Mã phụ / Tags</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {filteredPositions
                                            .map((p, pIdx) => {
                                                const lot = p.lot_id ? lotInfo[p.lot_id] : null

                                                // Case 1: Occupied position
                                                if (lot) {
                                                    return lot.items.map((item: any, iIdx: number) => (
                                                        <tr key={`${p.id}-${iIdx}`} className="text-[12px] hover:bg-gray-50/50 transition-colors break-inside-avoid">
                                                            {iIdx === 0 ? (
                                                                <>
                                                                    <td className="px-3 py-2 border-r border-gray-300 font-bold bg-gray-50/30" rowSpan={lot.items.length}>
                                                                        {p.code}
                                                                    </td>
                                                                    <td className="px-3 py-2 border-r border-gray-300 font-bold text-indigo-700 bg-indigo-50/10" rowSpan={lot.items.length}>
                                                                        {lot.code}
                                                                    </td>
                                                                </>
                                                            ) : null}
                                                            <td className="px-3 py-2 border-r border-gray-300 font-medium">
                                                                {displayInternalCode && item.internal_name ? item.internal_name : item.product_name}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-300 font-mono text-[11px]">
                                                                {displayInternalCode && item.internal_code ? item.internal_code : item.sku}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-300 text-center">
                                                                {item.unit}
                                                            </td>
                                                            <td className="px-3 py-2 border-r border-gray-300 text-right font-bold text-blue-700">
                                                                {item.quantity?.toLocaleString('vi-VN')}
                                                            </td>
                                                            <td className="px-3 py-2 italic text-gray-600 text-[11px]">
                                                                {[item.tags?.join(', '), lot.batch_code ? `Lô: ${lot.batch_code}` : null]
                                                                    .filter(Boolean)
                                                                    .join(' | ') || '-'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                }

                                                // Case 2: Empty position
                                                return (
                                                    <tr key={p.id} className="text-[12px] hover:bg-gray-50/50 transition-colors break-inside-avoid italic text-gray-400 bg-gray-50/5">
                                                        <td className="px-3 py-2 border-r border-gray-300 font-bold not-italic text-gray-600">
                                                            {p.code}
                                                        </td>
                                                        <td className="px-3 py-2 border-r border-gray-300" colSpan={6}>
                                                            (Vị trí trống)
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Footer Signatures */}
                    <div className="flex justify-between mt-12 break-inside-avoid">
                        {[
                            { title: signTitle1, setTitle: setSignTitle1, person: signPerson1, setPerson: setSignPerson1 },
                            { title: signTitle2, setTitle: setSignTitle2, person: signPerson2, setPerson: setSignPerson2 },
                            { title: signTitle3, setTitle: setSignTitle3, person: signPerson3, setPerson: setSignPerson3, extra: '(Ký, họ tên, đóng dấu)' }
                        ].map((s, i) => (
                            <div key={i} className="text-center w-1/3">
                                <EditableText value={s.title} onChange={s.setTitle} className="font-bold text-center w-full mb-1" isSnapshot={isSnapshotMode} />
                                <p className="italic text-xs">{s.extra || '(Ký, họ tên)'}</p>
                                <div className="h-24"></div>
                                <EditableText value={s.person} onChange={s.setPerson} className="font-bold text-center w-full" placeholder="Nhập tên..." isSnapshot={isSnapshotMode} />
                            </div>
                        ))}
                    </div>

                    <style dangerouslySetInnerHTML={{
                        __html: `
                        @media print {
                            @page { 
                                size: A4 ${orientation}; 
                                margin: 10mm; 
                            }
                            body { background: white !important; }
                            .print-hidden { display: none !important; }
                        }
                        #print-ready .grid {
                            page-break-inside: avoid;
                        }
                        .print-break-before-page {
                            break-before: page;
                            page-break-before: always;
                        }
                    `}} />
                </div>
            </div>
        </>
    )
}
