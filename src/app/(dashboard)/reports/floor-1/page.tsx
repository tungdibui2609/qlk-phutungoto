'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
    BarChart3, 
    Search, 
    Warehouse as WarehouseIcon, 
    Package, 
    Loader2, 
    ChevronRight,
    LayoutGrid,
    Download,
    Printer,
    MapPin,
    Layers,
    FileSpreadsheet,
    Warehouse
} from 'lucide-react'
import { exportWarehouseGridToExcel } from '@/lib/warehouseExcelExport'
import { format } from 'date-fns'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'
import { normalizeSearchString } from '@/lib/searchUtils'
import { groupWarehouseData } from '@/lib/warehouseUtils'

// Reuse the fetching logic from useWarehouseData
async function fetchAll(table: string, filter?: (query: any) => any, customSelect = '*', limit = 1000) {
    let allRecs: any[] = []
    let from = 0
    while (true) {
        let query = supabase.from(table as any).select(customSelect).range(from, from + limit - 1)
        if (filter) query = filter(query)
        const { data, error } = await query

        if (error) throw error
        if (!data || data.length === 0) break

        allRecs = [...allRecs, ...data]
        if (data.length < limit) break
        from += limit
    }
    return allRecs
}

export default function Floor1ReportPage() {
    const { systemType, currentSystem } = useSystem()
    const { showToast } = useToast()
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [activeWarehouseId, setActiveWarehouseId] = useState<string>('all')
    const [activeAisleId, setActiveAisleId] = useState<string>('all')

    // Data States
    const [positions, setPositions] = useState<any[]>([])
    const [zones, setZones] = useState<any[]>([])
    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})

    useEffect(() => {
        if (!systemType) {
            setLoading(false)
            return
        }
        
        let isMounted = true

        async function loadData() {
            setLoading(true)
            try {
                // 1. Fetch Zones and Positions
                const [zoneData, posData] = await Promise.all([
                    fetchAll('zones', q => q.eq('system_type', systemType).order('level').order('code')),
                    fetchAll('positions', q => q.eq('system_type', systemType).order('code'))
                ])

                if (!isMounted) return

                // 2. Fetch Zone Positions with filter
                let zpData: any[] = []
                let from = 0
                const limit = 1000
                while (true) {
                    const { data, error } = await supabase
                        .from('zone_positions')
                        .select('zone_id, position_id, positions!inner(system_type)')
                        .eq('positions.system_type', systemType)
                        .range(from, from + limit - 1)
                    
                    if (error) throw error
                    if (!data || data.length === 0) break
                    zpData = [...zpData, ...data]
                    if (data.length < limit) break
                    from += limit
                }

                if (!isMounted) return

                // 3. Map position to zone
                const zpLookup: Record<string, string> = {}
                zpData.forEach((zp: any) => {
                    if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id
                })

                const posWithZone = posData.map(pos => ({
                    ...pos,
                    zone_id: zpLookup[pos.id] || null
                }))

                // 3. Robust Hall Exclusion Logic
                const hallZoneIds = new Set<string>()
                const isHallName = (name: string) => /S[Ảả]nh|S[Àà]NH|Hall/i.test(name)

                // Pass 1: Find direct Hall zones
                zoneData.forEach(z => {
                    if (isHallName(z.name || '')) hallZoneIds.add(z.id)
                })

                // Pass 2: Find all descendants of Halls
                let changed = true
                while (changed) {
                    changed = false
                    zoneData.forEach(z => {
                        if (z.parent_id && hallZoneIds.has(z.parent_id) && !hallZoneIds.has(z.id)) {
                            hallZoneIds.add(z.id)
                            changed = true
                        }
                    })
                }

                // 4. Filter Floor 1 positions excluding the Hall tree
                const floor1Positions = posWithZone.filter(p => {
                    // Check Floor 1 pattern
                    const match = p.code.match(/T(\d)/i) || p.code.match(/-(\d)-/)
                    const isFloor1 = match && match[1] === '1'
                    if (!isFloor1) return false

                    // Exclude if in Hall hierarchy
                    return !hallZoneIds.has(p.zone_id || '')
                })

                setPositions(floor1Positions)
                setZones(zoneData)

                // 5. Fetch Lot Info for occupied positions (USING CHUNKS)
                // We need lot info for ALL floor 1 positions to display them correctly
                const lotIds = [...new Set(floor1Positions.map(p => p.lot_id).filter(Boolean))] as string[]
                if (lotIds.length > 0) {
                    let allLotRecords: any[] = []
                    const chunkSize = 200
                    
                    for (let i = 0; i < lotIds.length; i += chunkSize) {
                        const chunk = lotIds.slice(i, i + chunkSize)
                        // Use * to avoid missing column errors, but keep joins
                        const { data, error } = await supabase
                            .from('lots')
                            .select('*, lot_items(id, quantity, unit, products(name, sku, internal_code, color)), productions(code, name)')
                            .in('id', chunk)
                        
                        if (error) {
                            console.error('Error fetching lot chunk:', error)
                            continue
                        }
                        if (data) allLotRecords = [...allLotRecords, ...data]
                    }
                    
                    if (!isMounted) return

                    const lotMap: Record<string, any> = {}
                    allLotRecords.forEach((l: any) => {
                        const items = l.lot_items || []
                        const products = items.map((it: any) => ({
                            name: it.products?.name || 'Sản phẩm không tên',
                            sku: it.products?.sku || 'N/A',
                            internal_code: it.products?.internal_code,
                            quantity: it.quantity,
                            unit: it.unit || it.products?.unit,
                            color: it.products?.color
                        }))

                        lotMap[l.id] = {
                            ...l,
                            products,
                            stt: l.daily_seq || l.sequence_number || l.stt || null,
                            production_name: Array.isArray(l.productions) ? l.productions[0]?.name : l.productions?.name
                        }
                    })
                    console.log(`Loaded info for ${Object.keys(lotMap).length} lots`)
                    setLotInfo(lotMap)
                }

            } catch (error: any) {
                if (isMounted) {
                    console.error('Error loading Floor 1 data:', error)
                    showToast('Lỗi khi tải dữ liệu: ' + (error.message || 'Bad Request'), 'error')
                }
            } finally {
                if (isMounted) setLoading(false)
            }
        }

        loadData()
        return () => { isMounted = false }
    }, [systemType, showToast])

    // UI Helpers: Get hierarchical zones
    const warehouses = useMemo(() => zones.filter(z => !z.parent_id || z.level === 0), [zones])
    const activeAisles = useMemo(() => {
        if (activeWarehouseId === 'all') return []
        return zones.filter(z => z.parent_id === activeWarehouseId)
    }, [zones, activeWarehouseId])

    // Grouping & Grid Logic
    const gridData = useMemo(() => {
        if (positions.length === 0) return { displayZones: [], bins: {} }

        // 1. Identify "Bins" by grouping siblings with shared numeric suffixes (A01, B01, C01 -> Bin 01)
        const bins: Record<string, any[]> = {}
        const mergedBins: any[] = []

        // To do this right, we look at the zones that are children of Aisle/Hall
        const aisles = zones.filter(z => /D[ÃãYy]|S[Ảả]nh|S[Àà]NH/i.test(z.name || ''))
        
        aisles.forEach(aisle => {
            const children = zones.filter(z => z.parent_id === aisle.id)
            const binGroups: Record<string, any[]> = {}
            
            children.forEach(c => {
                const name = c.name || ''
                const match = name.match(/\d+$/)
                const suffix = match ? match[0] : name
                binGroups[suffix] = binGroups[suffix] || []
                binGroups[suffix].push(c)
            })

            Object.entries(binGroups).forEach(([suffix, members]) => {
                const binId = `v-bin-${aisle.id}-${suffix}`
                const binName = `Ô ${suffix}`
                
                // Get all positions belonging to any member of this group (at Floor 1)
                const memberIds = new Set(members.map(m => m.id))
                
                // Also include descendants of these members (like "Tầng 1" zones)
                const allMemberDescendantIds = new Set<string>()
                const collectDescendants = (pid: string) => {
                    const childZones = zones.filter(z => z.parent_id === pid)
                    childZones.forEach(cz => {
                        allMemberDescendantIds.add(cz.id)
                        collectDescendants(cz.id)
                    })
                }
                members.forEach(m => collectDescendants(m.id))

                const binPositions = positions.filter(p => 
                    memberIds.has(p.zone_id || '') || allMemberDescendantIds.has(p.zone_id || '')
                )

                if (binPositions.length > 0) {
                    bins[binId] = binPositions
                    mergedBins.push({
                        id: binId,
                        parent_id: aisle.id,
                        name: binName,
                        suffix: suffix
                    })
                }
            })
        })

        // 2. Filter display bins based on Warehouse/Aisle selection
        let displayZones = mergedBins

        if (activeWarehouseId !== 'all') {
            const getDescendantIds = (pid: string): string[] => {
                const children = zones.filter(z => z.parent_id === pid)
                return children.reduce((acc: string[], c) => [...acc, c.id, ...getDescendantIds(c.id)], [pid])
            }
            const targetParentId = activeAisleId === 'all' ? activeWarehouseId : activeAisleId
            const allowedZoneIds = new Set(getDescendantIds(targetParentId))
            
            displayZones = displayZones.filter(z => {
                return allowedZoneIds.has(z.parent_id || '') || z.parent_id === targetParentId
            })
        }

        if (searchTerm) {
            const normalized = normalizeSearchString(searchTerm)
            displayZones = displayZones.filter(z => {
                const binPos = bins[z.id] || []
                return binPos.some(p => {
                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    const posMatch = normalizeSearchString(p.code).includes(normalized)
                    if (posMatch) return true
                    if (lot) {
                        return normalizeSearchString(lot.code || '').includes(normalized) || 
                               lot.products?.some((pr: any) => normalizeSearchString(pr.sku || '').includes(normalized) || normalizeSearchString(pr.name || '').includes(normalized))
                    }
                    return false
                })
            })
        }

        // 3. Final Sort: By Aisle Name -> Bin Suffix
        displayZones.sort((a, b) => {
            const aisleA = zones.find(z => z.id === a.parent_id)
            const aisleB = zones.find(z => z.id === b.parent_id)
            if (aisleA?.id !== aisleB?.id) return (aisleA?.name || '').localeCompare(aisleB?.name || '')
            return (a.suffix || '').localeCompare(b.suffix || '', undefined, { numeric: true })
        })

        return { displayZones, bins }
    }, [positions, zones, activeWarehouseId, activeAisleId, searchTerm, lotInfo])

    const handlePrint = () => window.print()

    const handleExportExcel = async () => {
        if (gridData.displayZones.length === 0) {
            showToast('Không có dữ liệu để xuất', 'error')
            return
        }

        // Prepare grids data for the library function
        const grids: any[] = []
        
        // Group displayZones by Aisle (Aisle = Grid)
        const zonesByAisle: Record<string, any[]> = {}
        gridData.displayZones.forEach(z => {
            if (!zonesByAisle[z.parent_id]) zonesByAisle[z.parent_id] = []
            zonesByAisle[z.parent_id].push(z)
        })

        Object.entries(zonesByAisle).forEach(([aisleId, binZones]) => {
            const aisle = zones.find(z => z.id === aisleId)
            const warehouse = aisle ? zones.find(z => z.id === aisle.parent_id) : null
            
            // Sort bins by suffix numeric
            binZones.sort((a, b) => (a.suffix || '').localeCompare(b.suffix || '', undefined, { numeric: true }))
            
            const gridBins = binZones.map(bz => bz.name)
            const gridLevels = ['TẦNG 1']
            const cells: any[] = []

            binZones.forEach((bz, bIdx) => {
                const binPositions = gridData.bins[bz.id] || []
                const items: any[] = []

                binPositions.forEach(pos => {
                    const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
                    if (lot?.products) {
                        lot.products.forEach((pr: any) => {
                            items.push({
                                productName: pr.name,
                                sku: pr.sku,
                                unit: pr.unit,
                                quantity: pr.quantity,
                                lotCode: lot.code,
                                batchCode: lot.batch_code || lot.stt?.toString() || ''
                            })
                        })
                    }
                })

                cells.push({
                    binIndex: bIdx,
                    levelIndex: 0,
                    items: items
                })
            })

            grids.push({
                name: aisle?.name || 'KHU VỰC',
                parentName: warehouse?.name || 'KHO',
                bins: gridBins,
                levels: gridLevels,
                cells: cells
            })
        })

        try {
            await exportWarehouseGridToExcel({
                systemName: currentSystem?.name || 'KHO',
                grids: grids
            })
            showToast('Đã xuất file Excel lưới thành công', 'success')
        } catch (error: any) {
            console.error('Excel Export Error:', error)
            showToast('Lỗi khi xuất Excel: ' + error.message, 'error')
        }
    }

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen pb-20">
            {/* System Missing Warning */}
            {!systemType && !loading && (
                <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center gap-3 text-amber-700 font-bold mb-4">
                    <Package className="animate-bounce" />
                    Vui lòng chọn Phân hệ kho ở thanh menu trên cùng để xem dữ liệu báo cáo.
                </div>
            )}

            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-stone-800 flex items-center gap-3 italic">
                        <div className="p-2 bg-orange-500 rounded-xl text-white shadow-lg rotate-3">
                            <BarChart3 size={24} />
                        </div>
                        BÁO CÁO TẦNG 1
                    </h1>
                    <p className="text-stone-500 font-bold text-[11px] uppercase tracking-widest flex items-center gap-2">
                        <LayoutGrid size={12} className="text-orange-500" />
                        Sơ đồ chi tiết hàng hóa tầng thấp nhất
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="bg-white border-2 border-stone-100 rounded-2xl flex items-center px-4 py-2.5 shadow-sm focus-within:ring-4 focus-within:ring-orange-500/10 transition-all w-full md:w-auto">
                        <Search size={18} className="text-stone-300 mr-2" />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm nhanh..." 
                            className="bg-transparent border-none outline-none text-sm w-full md:w-64 font-bold placeholder:text-stone-300"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-black hover:bg-emerald-700 transition-all shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <FileSpreadsheet size={18} />
                        <span className="hidden sm:inline uppercase text-xs">Excel (Lưới)</span>
                    </button>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-2.5 bg-stone-900 text-white rounded-2xl font-black hover:bg-stone-800 transition-all shadow-xl hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline uppercase text-xs">In báo cáo</span>
                    </button>
                </div>
            </div>

            {/* Filter Controls (Warehouse & Aisle Tabs) */}
            {!loading && systemType && (
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-stone-100 space-y-4 print:hidden">
                    {/* Warehouse Tabs */}
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => { setActiveWarehouseId('all'); setActiveAisleId('all') }}
                            className={`px-4 py-2 rounded-xl font-black text-xs transition-all uppercase ${activeWarehouseId === 'all' ? 'bg-orange-500 text-white shadow-lg' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                        >
                            TẤT CẢ
                        </button>
                        {warehouses.map(w => (
                            <button
                                key={w.id}
                                onClick={() => { setActiveWarehouseId(w.id); setActiveAisleId('all') }}
                                className={`px-4 py-2 rounded-xl font-black text-xs transition-all uppercase ${activeWarehouseId === w.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-stone-50 text-stone-400 hover:bg-stone-100'}`}
                            >
                                {w.name}
                            </button>
                        ))}
                    </div>

                    {/* Aisle Tabs */}
                    {activeWarehouseId !== 'all' && activeAisles.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-stone-50">
                            <button
                                onClick={() => setActiveAisleId('all')}
                                className={`px-4 py-1.5 rounded-full font-bold text-[10px] transition-all uppercase ${activeAisleId === 'all' ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-200' : 'bg-white text-stone-400 hover:text-stone-600'}`}
                            >
                                Tất cả Dãy
                            </button>
                            {activeAisles.map(a => (
                                <button
                                    key={a.id}
                                    onClick={() => setActiveAisleId(a.id)}
                                    className={`px-4 py-1.5 rounded-full font-bold text-[10px] transition-all uppercase ${activeAisleId === a.id ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-200 shadow-inner' : 'bg-white text-stone-400 hover:text-stone-600'}`}
                                >
                                    {a.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                    <div className="relative">
                        <Loader2 size={64} className="animate-spin text-orange-500" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 bg-orange-500 rounded-full animate-ping" />
                        </div>
                    </div>
                    <p className="text-stone-400 font-black animate-pulse uppercase tracking-[0.2em] text-[10px]">Đang chuẩn bị sơ đồ tầng 1...</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {gridData.displayZones.length === 0 ? (
                        <div className="bg-white rounded-[40px] border-2 border-dashed border-stone-200 p-24 text-center space-y-6">
                            <div className="w-24 h-24 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-200">
                                <Package size={48} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-stone-800 uppercase italic">Không tìm thấy ô gộp</h3>
                                <p className="text-stone-400 font-medium text-sm max-w-sm mx-auto">Vui lòng thử chọn dãy khác hoặc thay đổi từ khóa tìm kiếm.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                            {gridData.displayZones.map((zone) => {
                                const binPositions = gridData.bins[zone.id] || []
                                const occupiedPositions = binPositions.filter(p => p.lot_id)
                                const isOccupied = occupiedPositions.length > 0
                                
                                // Get warehouse and aisle names for the header
                                const aisle = zones.find(z => z.id === zone.parent_id)
                                const warehouse = aisle ? zones.find(z => z.id === aisle.parent_id) : null
                                const fullTitle = `${warehouse?.name || ''} - ${aisle?.name || ''} - ${zone.name}`.replace(/^ - | - $/g, '')

                                return (
                                    <div 
                                        key={zone.id}
                                        className={`
                                            group relative rounded-3xl border-2 transition-all duration-300 flex flex-col shadow-sm overflow-hidden
                                            ${isOccupied 
                                                ? 'bg-white border-stone-200 hover:border-orange-500' 
                                                : 'bg-stone-50 border-stone-100 opacity-60'}
                                        `}
                                    >
                                        {/* Header Style like Print Page */}
                                        <div className="bg-stone-50 border-b-2 border-stone-100 px-5 py-3 flex items-center justify-between">
                                            <h4 className="text-sm font-black text-stone-800 uppercase tracking-tight">
                                                {fullTitle}
                                            </h4>
                                            <span className="text-[10px] font-black text-stone-400 bg-white px-2 py-0.5 rounded-full border border-stone-100">
                                                {binPositions.length} vị trí
                                            </span>
                                        </div>

                                        {/* Content Area */}
                                        <div className="p-5 flex-1 flex flex-col gap-4">
                                            <div className="flex items-center gap-2 text-blue-600">
                                                <Layers size={14} />
                                                <span className="text-[11px] font-black uppercase tracking-widest">TẦNG 1</span>
                                            </div>

                                            <div className="space-y-3">
                                                {binPositions.map((pos) => {
                                                    const lot = pos.lot_id ? lotInfo[pos.lot_id] : null
                                                    const posIsOccupied = !!lot
                                                    
                                                    if (!posIsOccupied) return (
                                                        <div key={pos.id} className="flex items-center justify-between text-stone-300 py-1 border-b border-stone-50 last:border-0">
                                                            <span className="text-[10px] font-bold font-mono uppercase italic">{pos.code.slice(-6)}: TRỐNG</span>
                                                            <MapPin size={12} className="opacity-30" />
                                                        </div>
                                                    )

                                                    return (
                                                        <div key={pos.id} className="space-y-2 pb-2 border-b border-stone-50 last:border-0 last:pb-0">
                                                            {lot.products?.map((pr: any, i: number) => (
                                                                <div key={i} className="flex items-start justify-between gap-4">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[12px] font-bold text-stone-700 leading-snug break-words">
                                                                            {pr.name}
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            {lot.stt && (
                                                                                <span className="text-[9px] font-black text-white bg-orange-600 px-1.5 py-0.5 rounded shadow-sm">STT: {lot.stt}</span>
                                                                            )}
                                                                            <span className="text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded uppercase">{pr.sku}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <div className="flex items-baseline justify-end gap-1">
                                                                            <span className="text-sm font-black text-blue-600">: {pr.quantity}</span>
                                                                            <span className="text-[10px] font-bold text-blue-600 uppercase">{pr.unit}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
            
            {/* Legend / Info Bar */}
            {!loading && systemType && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md border border-stone-200 px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-8 print:hidden">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-[11px] font-black text-stone-700 uppercase tracking-tight">
                            Có hàng: {positions.filter(p => p.lot_id).length}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-stone-200" />
                        <span className="text-[11px] font-black text-stone-700 uppercase tracking-tight">
                            Vị trí trống: {positions.filter(p => !p.lot_id).length}
                        </span>
                    </div>
                    <div className="w-px h-4 bg-stone-300 mx-2" />
                    <div className="text-[11px] font-black text-orange-600 uppercase tracking-widest">
                        Tổng cộng: {positions.length} Ô Tầng 1
                    </div>
                </div>
            )}
            
            <style jsx global>{`
                @media print {
                    @page { margin: 1cm; size: landscape; }
                    body { background: white !important; }
                    .print\\:hidden { display: none !important; }
                    .shadow-sm, .shadow-md, .shadow-lg, .shadow-xl, .shadow-2xl { box-shadow: none !important; }
                    .border-4, .border-2 { border-width: 1px !important; }
                    .rounded-[32px], .rounded-[40px] { border-radius: 8px !important; }
                }
            `}</style>
        </div>
    )
}
