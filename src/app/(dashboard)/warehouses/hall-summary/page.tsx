'use client'

import React, { useState, useEffect } from 'react'
import { BarChart3, Loader2, Package, Search, Layers, Warehouse, Download, Printer } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { normalizeSearchString } from '@/lib/searchUtils'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Fetch data in chunks to avoid URL size limit
async function fetchInChunks(table: string, field: string, values: string[], select = '*', chunkSize = 500) {
    if (!values.length) return [];
    let allResults: any[] = [];
    
    for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        const { data, error } = await supabase
            .from(table as any)
            .select(select)
            .in(field, chunk);
            
        if (error) throw error;
        if (data) allResults = [...allResults, ...data];
    }
    return allResults;
}

// Ensure fetching over 1000 items works
async function fetchAll(query: any) {
    let allData: any[] = []
    let from = 0
    let to = 999
    let finished = false

    let stableQuery = query.order('id', { ascending: true })

    while (!finished) {
        const { data, error } = await stableQuery.range(from, to)
        if (error) throw error
        if (!data || data.length === 0) {
            finished = true
        } else {
            allData = [...allData, ...data]
            if (data.length < 1000) {
                finished = true
            } else {
                from += 1000
                to += 1000
            }
        }
    }

    const seen = new Set()
    return allData.filter((item: any) => {
        if (!item.id) return true
        if (seen.has(item.id)) return false
        seen.add(item.id)
        return true
    })
}

export default function HallSummaryPage() {
    const { systemType } = useSystem()
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    
    // Data states
    const [warehouseZonesList, setWarehouseZonesList] = useState<any[]>([])
    const [hallZonesList, setHallZonesList] = useState<any[]>([])
    const [hallToWarehouseMap, setHallToWarehouseMap] = useState<Record<string, string>>({})

    const [grandTotalSummary, setGrandTotalSummary] = useState<any[]>([])
    const [warehouseSummaries, setWarehouseSummaries] = useState<Record<string, any[]>>({})
    const [hallSummaries, setHallSummaries] = useState<Record<string, any[]>>({})
    
    // Tab states
    const [activeWarehouse, setActiveWarehouse] = useState<string>('all')
    const [activeHall, setActiveHall] = useState<string>('all')

    useEffect(() => {
        if (!systemType) return
        
        async function loadData() {
            setLoading(true)
            try {
                // 1. Fetch zones + positions based on current system
                const [rawZonesData, rawPosData] = await Promise.all([
                    fetchAll(supabase.from('zones').select('id, name, code, parent_id, level, display_order, is_hall, system_type').eq('system_type', systemType)),
                    fetchAll(supabase.from('positions').select('id, code, lot_id, system_type').eq('system_type', systemType).not('lot_id', 'is', null))
                ])

                const posIds = rawPosData.map((p: any) => p.id)
                // Need zone_positions to get which zone each position belongs to
                const zpData = await fetchInChunks('zone_positions', 'position_id', posIds, 'zone_id, position_id')
                
                const rawZPMap: Record<string, string> = {}
                zpData.forEach((rp: any) => { rawZPMap[rp.position_id] = rp.zone_id })

                const zones = rawZonesData as any[]
                
                // Helper to get all descendant IDs
                const getDescendantIds = (pid: string): string[] => {
                    const children = zones.filter(z => z.parent_id === pid)
                    const ids: string[] = children.reduce((acc: string[], c) => [...acc, c.id, ...getDescendantIds(c.id)], [pid])
                    return [...new Set(ids)]
                }

                // 2. Locate Warehouses and Halls
                const warehouseZones = zones.filter(z => z.parent_id === null || z.level === 0).sort((a,b) => {
                    if ((a.display_order ?? 0) !== (b.display_order ?? 0)) return (a.display_order ?? 0) - (b.display_order ?? 0)
                    return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true })
                })
                setWarehouseZonesList(warehouseZones)

                const hallZones = zones.filter(z => z.is_hall).sort((a,b) => {
                    if ((a.display_order ?? 0) !== (b.display_order ?? 0)) return (a.display_order ?? 0) - (b.display_order ?? 0)
                    return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true })
                })
                setHallZonesList(hallZones)

                const posToHallMap: Record<string, string> = {}
                hallZones.forEach(hall => {
                    const descendantIds = [hall.id, ...getDescendantIds(hall.id)]
                    rawPosData.forEach((p: any) => {
                        const zid = rawZPMap[p.id]
                        if (zid && descendantIds.includes(zid)) {
                            posToHallMap[p.id] = hall.id
                        }
                    })
                })
                
                // Map Hall to Warehouse
                const tempHallToWMap: Record<string, string> = {}
                hallZones.forEach(hall => {
                    let curr = hall.id
                    let wId = null
                    while(curr) {
                        const z = zones.find(z => z.id === curr)
                        if (!z) break
                        if (z.parent_id === null || z.level === 0) {
                            wId = z.id
                            break
                        }
                        // Break if no parent (in case level>0 but no parent_id due to partial data)
                        if (!z.parent_id) break 
                        curr = z.parent_id
                    }
                    if (wId) tempHallToWMap[hall.id] = wId
                })
                setHallToWarehouseMap(tempHallToWMap)

                // 3. Filter positions sitting in those halls
                const dPositions = rawPosData.filter((p: any) => !!posToHallMap[p.id])

                // 4. Fetch the lots corresponding to these positions
                const lotIds = [...new Set(dPositions.map((p: any) => p.lot_id).filter(Boolean))] as string[]
                let lotInfo: Record<string, any> = {}

                if (lotIds.length > 0) {
                    const lots = await fetchInChunks(
                        'lots', 
                        'id', 
                        lotIds, 
                        'id, code, lot_items(id, quantity, unit, products(name, sku, color)), lot_tags(tag)'
                    )

                    lots?.forEach((l: any) => {
                        lotInfo[l.id] = {
                            code: l.code,
                            tags: l.lot_tags?.map((t: any) => t.tag) || [],
                            items: l.lot_items?.map((li: any) => ({
                                product_name: li.products?.name,
                                sku: li.products?.sku,
                                product_color: li.products?.color,
                                quantity: li.quantity,
                                unit: li.unit || li.products?.unit,
                            })) || []
                        }
                    })
                }

                // 5. Group products together
                const hallGroups: Record<string, Record<string, any>> = {}
                const warehouseGroups: Record<string, Record<string, any>> = {}
                const grandTotalGroups: Record<string, any> = {}

                hallZones.forEach(h => hallGroups[h.id] = {})
                warehouseZones.forEach(w => warehouseGroups[w.id] = {})

                dPositions.forEach((p: any) => {
                    const hallId = posToHallMap[p.id]
                    if (!hallId) return
                    const wId = tempHallToWMap[hallId]

                    const lot = p.lot_id ? lotInfo[p.lot_id] : null
                    if (!lot || !lot.items) return

                    lot.items.forEach((it: any) => {
                        const tag = lot.tags?.[0] || ''
                        const groupKey = `${it.sku}|${it.quantity}|${it.unit}|${tag}`;
                        
                        const itemData = {
                            groupKey,
                            sku: it.sku,
                            name: it.product_name,
                            quantity: it.quantity,
                            unit: it.unit,
                            tag,
                            count: 1
                        }

                        // Grand Total Merge
                        if (!grandTotalGroups[groupKey]) grandTotalGroups[groupKey] = {...itemData}
                        else grandTotalGroups[groupKey].count++
                        
                        // Per Hall Merge
                        if (!hallGroups[hallId][groupKey]) hallGroups[hallId][groupKey] = {...itemData}
                        else hallGroups[hallId][groupKey].count++
                        
                        // Per Warehouse Merge
                        if (wId) {
                            if (!warehouseGroups[wId][groupKey]) warehouseGroups[wId][groupKey] = {...itemData}
                            else warehouseGroups[wId][groupKey].count++
                        }
                    })
                })
                
                setGrandTotalSummary(Object.values(grandTotalGroups).sort((a: any, b: any) => a.sku.localeCompare(b.sku)))
                
                const finalWhSummaries: Record<string, any[]> = {}
                warehouseZones.forEach(w => {
                    finalWhSummaries[w.id] = Object.values(warehouseGroups[w.id]).sort((a: any, b: any) => a.sku.localeCompare(b.sku))
                })
                setWarehouseSummaries(finalWhSummaries)
                
                const finalHallSummaries: Record<string, any[]> = {}
                hallZones.forEach(h => {
                    finalHallSummaries[h.id] = Object.values(hallGroups[h.id]).sort((a: any, b: any) => a.sku.localeCompare(b.sku))
                })
                setHallSummaries(finalHallSummaries)

            } catch (e) {
                console.error('Error fetching hall summary data:', e)
            } finally {
                setLoading(false)
            }
        }
        
        loadData()
    }, [systemType])

    // Get active items list depending on tab selection
    const currentList = React.useMemo(() => {
        if (activeWarehouse === 'all') {
            return grandTotalSummary
        }
        if (activeHall === 'all') {
            return warehouseSummaries[activeWarehouse] || []
        }
        return hallSummaries[activeHall] || []
    }, [activeWarehouse, activeHall, grandTotalSummary, warehouseSummaries, hallSummaries])

    // Filter by Search term
    const filteredSummary = React.useMemo(() => {
        if (!searchTerm) return currentList;
        const normalized = normalizeSearchString(searchTerm);
        return currentList.filter((item: any) => {
            return (
                normalizeSearchString(item.sku || '').includes(normalized) ||
                normalizeSearchString(item.name || '').includes(normalized) ||
                normalizeSearchString(item.tag || '').includes(normalized)
            );
        });
    }, [currentList, searchTerm]);

    const activeHallsForWarehouse = hallZonesList.filter(h => hallToWarehouseMap[h.id] === activeWarehouse)

    // Handlers
    const handlePrint = () => {
        window.print()
    }

    const handleExportExcel = async () => {
        if (grandTotalSummary.length === 0) {
            alert('Không có dữ liệu để xuất!')
            return
        }

        const workbook = new ExcelJS.Workbook()
        
        // Helper
        const safeSheetName = (name: string) => {
            if (!name) return 'Sheet'
            return name.replace(/[*/:?[\]]/g, '').substring(0, 31)
        }

        const setColumns = (worksheet: ExcelJS.Worksheet) => {
            worksheet.columns = [
                { width: 8 },
                { width: 22 },
                { width: 45 },
                { width: 18 },
                { width: 12 },
                { width: 15 },
                { width: 12 },
            ]
        }

        const renderTable = (worksheet: ExcelJS.Worksheet, title: string, data: any[], startRow: number) => {
            if (!data || data.length === 0) return startRow

            worksheet.mergeCells(`A${startRow}:G${startRow}`)
            const titleCell = worksheet.getCell(`A${startRow}`)
            titleCell.value = title.toUpperCase()
            titleCell.font = { bold: true, size: 12, color: { argb: 'FFFFFF' } }
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '10B981' } } // Emerald
            titleCell.alignment = { horizontal: 'left', vertical: 'middle' }

            let currentRow = startRow + 1

            const headers = ['STT', 'Mã SP (SKU)', 'Tên Sản Phẩm', 'Phân loại (Tag)', 'Đơn Vị', 'Số Lượng', 'Tổng Kiện']
            const headerRow = worksheet.getRow(currentRow)
            headers.forEach((h, i) => {
                const cell = headerRow.getCell(i + 1)
                cell.value = h
                cell.font = { bold: true, color: { argb: 'FFFFFF' } }
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F97316' } }
                cell.alignment = { horizontal: 'center', vertical: 'middle' }
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
            })
            currentRow++

            data.forEach((item: any, idx: number) => {
                const row = worksheet.getRow(currentRow)
                row.getCell(1).value = idx + 1
                row.getCell(2).value = item.sku
                row.getCell(3).value = item.name || ''
                row.getCell(4).value = item.tag || ''
                row.getCell(5).value = item.unit || ''
                row.getCell(6).value = item.quantity
                row.getCell(7).value = item.count

                for (let i = 1; i <= 7; i++) {
                    const cell = row.getCell(i)
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    if (typeof cell.value === 'number') {
                        if (Math.floor(cell.value) === cell.value) {
                            cell.numFmt = '#,##0'
                        } else {
                            cell.numFmt = '#,##0.###'
                        }
                    }
                }
                row.getCell(6).alignment = { horizontal: 'right' }
                row.getCell(7).alignment = { horizontal: 'right' }
                
                currentRow++
            })

            return currentRow + 2
        }

        if (activeWarehouse === 'all') {
            // 1. Tổng hợp
            const s1 = workbook.addWorksheet('Tổng Hợp Toàn Bộ')
            setColumns(s1)
            renderTable(s1, 'TỔNG HỢP HỆ THỐNG', grandTotalSummary, 1)
            
            // 2. Từng kho
            warehouseZonesList.forEach(w => {
                 const s = workbook.addWorksheet(safeSheetName(w.name))
                 setColumns(s)
                 
                 const whData = warehouseSummaries[w.id] || []
                 let nextRow = renderTable(s, `TỔNG CỘNG: ${w.name}`, whData, 1)

                 // Kéo danh sách sảnh thuộc kho này
                 const wHalls = hallZonesList.filter(h => hallToWarehouseMap[h.id] === w.id)
                 wHalls.forEach(hall => {
                     const hData = hallSummaries[hall.id] || []
                     if (hData.length > 0) {
                         nextRow = renderTable(s, `CHI TIẾT: ${hall.name}`, hData, nextRow)
                     }
                 })
            })
        } else {
            // Xuất trong 1 kho
            const activeWhName = warehouseZonesList.find(w => w.id === activeWarehouse)?.name || 'Kho'
            const s1 = workbook.addWorksheet(safeSheetName(activeWhName))
            setColumns(s1)
            
            let nextRow = 1
            if (activeHall === 'all') {
                nextRow = renderTable(s1, `TỔNG CỘNG: ${activeWhName}`, warehouseSummaries[activeWarehouse] || [], nextRow)
                
                activeHallsForWarehouse.forEach(hall => {
                    const hData = hallSummaries[hall.id] || []
                    if (hData.length > 0) {
                        nextRow = renderTable(s1, `CHI TIẾT: ${hall.name}`, hData, nextRow)
                    }
                })
            } else {
                const hallName = hallZonesList.find(h => h.id === activeHall)?.name || 'Sảnh'
                renderTable(s1, `CHI TIẾT SẢNH: ${activeWhName} - ${hallName}`, hallSummaries[activeHall] || [], nextRow)
            }
        }

        const buffer = await workbook.xlsx.writeBuffer()
        const reportName = activeWarehouse === 'all' ? 'Tong_Hop_He_Thong' : 'Theo_Kho'
        saveAs(new Blob([buffer]), `Thong_Ke_Sanh_${reportName}_${new Date().toISOString().split('T')[0]}.xlsx`)
    }

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
            {/* Header / Search Area */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-3">
                        <BarChart3 className="text-orange-500" />
                        Thống kê Sảnh
                    </h1>
                    <p className="text-stone-500 mt-1">Tổng hợp số lượng sản phẩm đang tồn tại tất cả khu vực Sảnh</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-white items-center gap-3 px-4 py-2 border rounded-xl w-full sm:w-auto shadow-sm">
                        <Search className="text-stone-400" size={18} />
                        <input
                            type="text"
                            placeholder="Tìm kiếm mã SKU, Tên, Tag..."
                            className="w-full min-w-[200px] bg-transparent border-none outline-none text-sm placeholder:text-stone-400 font-medium"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl font-bold transition-all border border-emerald-200">
                        <Download size={18} />
                        <span className="hidden sm:inline">Xuất Excel</span>
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-stone-50 text-stone-600 hover:bg-stone-100 rounded-xl font-bold transition-all border border-stone-200">
                        <Printer size={18} />
                        <span className="hidden sm:inline">In trang</span>
                    </button>
                </div>
            </div>

            {/* Print Header Add-on (Only visible when printing) */}
            <div className="hidden print:block mb-4 border-b-2 border-stone-800 pb-4">
                <h1 className="text-3xl font-black text-center mb-2">BÁO CÁO THỐNG KÊ SẢNH LƯU TRỮ</h1>
                <p className="text-center font-bold text-stone-600">Ngày xuất: {new Date().toLocaleDateString('vi-VN')}</p>
                <div className="mt-4 flex gap-4 font-semibold text-sm">
                    <p>Phân loại: {activeWarehouse === 'all' ? 'TỔNG HỢP HỆ THỐNG' : warehouseZonesList.find(w => w.id === activeWarehouse)?.name || ''}</p>
                    {activeWarehouse !== 'all' && (
                        <p>Khu vực: {activeHall === 'all' ? 'TẤT CẢ SẢNH (THUỘC KHO NÀY)' : hallZonesList.find(h => h.id === activeHall)?.name || ''}</p>
                    )}
                </div>
            </div>

            {/* Content Area */}
            {loading ? (
                <div className="flex justify-center p-20">
                    <div className="flex flex-col items-center gap-4 text-stone-400">
                        <Loader2 className="animate-spin text-orange-500" size={40} />
                        <span className="font-medium text-sm">Đang tính toán dữ liệu Sảnh...</span>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    
                    {/* Filter Tabs Navigation (Hidden when printing) */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden print:hidden">
                        
                        {/* Layer 1: Warehouses */}
                        <div className="flex overflow-x-auto scrollbar-hide border-b border-stone-100 p-2 gap-2 bg-stone-50/50">
                            {/* Tab Tổng Hợp */}
                            <button
                                onClick={() => { setActiveWarehouse('all'); setActiveHall('all') }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                                    activeWarehouse === 'all' 
                                        ? 'bg-orange-500 text-white shadow-sm ring-1 ring-orange-500/50' 
                                        : 'bg-white text-stone-500 border border-transparent hover:border-stone-200 hover:bg-stone-50'
                                }`}
                            >
                                <Layers size={18} />
                                <span>TỔNG HỢP HỆ THỐNG</span>
                                <span className={`ml-1 text-[10px] px-2 py-0.5 rounded-full ${activeWarehouse === 'all' ? 'bg-orange-600/30 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                    {grandTotalSummary.length}
                                </span>
                            </button>

                            {/* Tabs cho từng kho */}
                            {warehouseZonesList.map(wh => (
                                <button
                                    key={wh.id}
                                    onClick={() => { setActiveWarehouse(wh.id); setActiveHall('all') }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all uppercase ${
                                        activeWarehouse === wh.id 
                                            ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600/50' 
                                            : 'bg-white text-stone-500 border border-transparent hover:border-stone-200 hover:bg-stone-50'
                                    }`}
                                >
                                    <Warehouse size={18} />
                                    <span>{wh.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Layer 2: Halls (Only visible if a specific warehouse is selected) */}
                        {activeWarehouse !== 'all' && activeHallsForWarehouse.length > 0 && (
                            <div className="flex overflow-x-auto scrollbar-hide p-3 gap-2">
                                <button
                                    onClick={() => setActiveHall('all')}
                                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm transition-all ${
                                        activeHall === 'all' 
                                            ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300 shadow-inner' 
                                            : 'bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-700 border border-transparent'
                                    }`}
                                >
                                    <Layers size={16} />
                                    <span>TẤT CẢ SẢNH (THUỘC KHO NÀY)</span>
                                    <span className={`ml-1 text-[10px] px-2 py-0.5 rounded-full ${activeHall === 'all' ? 'bg-purple-200 text-purple-800' : 'bg-stone-100 text-stone-500'}`}>
                                        {warehouseSummaries[activeWarehouse]?.length || 0}
                                    </span>
                                </button>

                                {activeHallsForWarehouse.map(hall => (
                                    <button
                                        key={hall.id}
                                        onClick={() => setActiveHall(hall.id)}
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-bold text-sm transition-all uppercase ${
                                            activeHall === hall.id 
                                                ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-300 shadow-inner' 
                                                : 'bg-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-700 border border-transparent'
                                        }`}
                                    >
                                        <Package size={16} />
                                        <span>{hall.name}</span>
                                        <span className={`ml-1 text-[10px] px-2 py-0.5 rounded-full ${activeHall === hall.id ? 'bg-purple-200 text-purple-800' : 'bg-stone-100 text-stone-500'}`}>
                                            {hallSummaries[hall.id]?.length || 0}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeWarehouse !== 'all' && activeHallsForWarehouse.length === 0 && (
                            <div className="p-4 text-center text-sm font-medium text-amber-600 bg-amber-50">
                                Kho này hiện chưa được cấu hình thiết lập Sảnh nào.
                            </div>
                        )}
                    </div>

                    {/* Danh sách Data */}
                    {filteredSummary.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mt-6">
                            {filteredSummary.map((group: any, idx: number) => {
                                const isTotal = activeWarehouse === 'all'
                                const isWarehouseTotal = activeWarehouse !== 'all' && activeHall === 'all'
                                
                                // Explicit Tailwind classes for compilation
                                const styles = isTotal ? {
                                    cardBorder: 'hover:border-orange-200',
                                    topLine: 'bg-orange-500',
                                    iconBox: 'bg-orange-50 text-orange-500 border-orange-100 group-hover/card:bg-orange-500 group-hover/card:text-white',
                                    tagText: 'text-orange-600',
                                    quantityText: 'text-orange-600',
                                    dot: 'bg-orange-400'
                                } : isWarehouseTotal ? {
                                    cardBorder: 'hover:border-blue-200',
                                    topLine: 'bg-blue-500',
                                    iconBox: 'bg-blue-50 text-blue-500 border-blue-100 group-hover/card:bg-blue-500 group-hover/card:text-white',
                                    tagText: 'text-blue-600',
                                    quantityText: 'text-blue-600',
                                    dot: 'bg-blue-400'
                                } : {
                                    cardBorder: 'hover:border-purple-200',
                                    topLine: 'bg-purple-500',
                                    iconBox: 'bg-purple-50 text-purple-500 border-purple-100 group-hover/card:bg-purple-500 group-hover/card:text-white',
                                    tagText: 'text-purple-600',
                                    quantityText: 'text-purple-600',
                                    dot: 'bg-purple-400'
                                }

                                return (
                                    <div key={idx} className={`border-2 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group/card flex flex-col gap-4 overflow-hidden bg-white ${styles.cardBorder}`}>
                                        {/* Top Decoration Bar */}
                                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${styles.topLine}`} />

                                        {/* Header: SKU, Status & Action */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all border ${styles.iconBox}`}>
                                                    <Package size={24} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-lg font-black text-stone-900 tracking-tight leading-none">{group.sku}</h4>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        {group.tag && (
                                                            <span className={`text-[10px] font-bold uppercase tracking-tight leading-tight ${styles.tagText}`}>
                                                                {group.tag}
                                                            </span>
                                                        )}
                                                        <p className="text-[9px] font-bold text-stone-300 uppercase tracking-widest leading-none">MÃ SẢN PHẨM • SKU</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-2xl font-black leading-none ${styles.quantityText}`}>{group.quantity}</div>
                                                <div className="text-[10px] font-bold text-stone-400 mt-1 uppercase tracking-wider">{group.unit || 'Đơn vị'}</div>
                                            </div>
                                        </div>

                                        {/* Product Name */}
                                        <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                                            <p className="text-[13px] font-bold text-stone-700 leading-snug line-clamp-2">
                                                {group.name || 'Không có tên'}
                                            </p>
                                        </div>

                                        {/* Footer Stats */}
                                        <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-100">
                                            <div className="flex items-center gap-2 text-stone-500">
                                                <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${styles.dot}`} />
                                                <span className="text-[11px] font-bold uppercase tracking-wider">
                                                    {isTotal ? 'TỔNG TẤT CẢ KHO' : isWarehouseTotal ? 'TỔNG CÁC SẢNH' : 'SỐ LƯỢNG PALLET'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-lg font-black text-stone-800">{group.count}</span>
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Kiện</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="bg-white border-2 border-dashed border-stone-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center mt-6">
                            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-4">
                                <Package size={32} className="text-stone-300" />
                            </div>
                            <h3 className="text-xl font-bold text-stone-800 mb-2">Không có dữ liệu</h3>
                            <p className="text-stone-500">Khu vực này hiện trống hoặc không tìm thấy mã sản phẩm nào {searchTerm ? `khớp với "${searchTerm}"` : ''}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
