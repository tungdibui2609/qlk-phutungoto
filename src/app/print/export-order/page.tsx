'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { Calendar, Download, Loader2, Printer } from 'lucide-react'
import FlexibleZoneGrid from '@/components/warehouse/FlexibleZoneGrid'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { Database } from '@/lib/database.types'
import { useCaptureReceipt } from '@/hooks/useCaptureReceipt'
import { formatQuantityFull } from '@/lib/numberUtils'
import { usePrintCompanyInfo, CompanyInfo } from '@/hooks/usePrintCompanyInfo'
import { PrintHeader } from '@/components/print/PrintHeader'
import { EditableText } from '@/components/print/PrintHelpers'
import { format } from 'date-fns'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { exportExportOrderToExcel } from '@/lib/warehouseExcelExport'

type Position = Database['public']['Tables']['positions']['Row']
type Zone = Database['public']['Tables']['zones']['Row']
type ZoneLayout = Database['public']['Tables']['zone_layouts']['Row']

interface PositionWithZone extends Position {
    zone_id?: string | null
}

interface ExportOrderItem {
    id: string
    quantity: number
    unit: string | null
    status: string | null
    lots: {
        code: string
        lot_tags?: { tag: string; lot_item_id: string | null }[] | null
        inbound_date: string | null
        peeling_date: string | null
        notes: string | null
        daily_seq: number | null
    } | null
    positions: {
        code: string
    } | null
    products: {
        name: string
        sku: string
    } | null
    computed_status?: 'Pending' | 'Exported' | 'Moved to Hall' | 'Changed Position'
    current_position_code?: string
}

interface ExportTask {
    id: string
    code: string
    status: string
    created_at: string
    notes: string | null
    created_by_profile: {
        full_name: string
    } | null
    system_code: string | null
    company_id?: string
}

export default function ExportOrderPrintPage() {
    return (
        <React.Suspense fallback={<div className="p-8 text-center text-stone-500 font-medium">Đang tải dữ liệu phiếu...</div>}>
            <ExportOrderPrintContent />
        </React.Suspense>
    )
}

function ExportOrderPrintContent() {
    const searchParams = useSearchParams()
    const taskId = searchParams.get('id')

    // Check for company info in params
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
        tax_code: null
    } as CompanyInfo : null

    const [loading, setLoading] = useState(true)
    const [task, setTask] = useState<ExportTask | null>(null)
    const [items, setItems] = useState<ExportOrderItem[]>([])
    const [zones, setZones] = useState<Zone[]>([])
    const [positions, setPositions] = useState<PositionWithZone[]>([])
    const [layouts, setLayouts] = useState<Record<string, ZoneLayout>>({})
    const [lotInfo, setLotInfo] = useState<Record<string, any>>({})
    const [occupiedIds, setOccupiedIds] = useState<Set<string>>(new Set())
    const [displayInternalCode, setDisplayInternalCode] = useState(false)
    const [mergedZones, setMergedZones] = useState<Set<string>>(new Set())
    const [allowEditDates, setAllowEditDates] = useState(false)
    const [itemDates, setItemDates] = useState<Record<string, { inboundDate: string; productionDate: string }>>({})
    
    // Bulk edit states
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkInboundDate, setBulkInboundDate] = useState('')
    const [bulkProductionDate, setBulkProductionDate] = useState('')

    // Use shared hook for company info
    const { companyInfo, logoSrc } = usePrintCompanyInfo({
        token: searchParams.get('token'),
        orderCompanyId: task?.company_id,
        initialCompanyInfo
    })

    // Capture and snapshot state
    const { isCapturing, handleCapture } = useCaptureReceipt({
        fileNamePrefix: `Phieu_Xuat_Kho_${task?.code || 'scan'}`
    })
    const isSnapshotMode = isCapturing
    const isDownloadingState = isCapturing

    // Editable fields
    const [editDay, setEditDay] = useState('')
    const [editMonth, setEditMonth] = useState('')
    const [editYear, setEditYear] = useState('')
    const [notes, setNotes] = useState('')

    // Editable signature fields
    const [signTitle1, setSignTitle1] = useState('Người lập phiếu')
    const [signTitle2, setSignTitle2] = useState('Người nhận hàng')
    const [signTitle3, setSignTitle3] = useState('Thủ kho')
    const [signTitle4, setSignTitle4] = useState('Kế toán trưởng')
    const [signPerson1, setSignPerson1] = useState('')
    const [signPerson2, setSignPerson2] = useState('')
    const [signPerson3, setSignPerson3] = useState('')
    const [signPerson4, setSignPerson4] = useState('')

    // Logistics fields for Excel template
    const [customerName, setCustomerName] = useState('')
    const [customerAddress, setCustomerAddress] = useState('')
    const [reason, setReason] = useState('')
    const [branch, setBranch] = useState('')
    const [vehicleNumber, setVehicleNumber] = useState('')
    const [containerNumber, setContainerNumber] = useState('')
    const [sealNumber, setSealNumber] = useState('')

    useEffect(() => {
        async function fetchData() {
            if (!taskId) {
                setLoading(false)
                return
            }

            try {
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

                // Fetch Task
                let { data: taskData, error: taskError } = await supabase
                    .from('export_tasks')
                    .select(`
                        *,
                        created_by_profile:created_by (full_name)
                    `)
                    .eq('id', taskId)
                    .single()

                if (taskError) {
                    const { data: taskDataFallback, error: fallbackError } = await supabase
                        .from('export_tasks')
                        .select('*')
                        .eq('id', taskId)
                        .single()

                    if (fallbackError) throw fallbackError
                    taskData = { ...(taskDataFallback as any), created_by_profile: { full_name: 'Admin' } }
                    setTask(taskData as any)
                } else {
                    setTask(taskData as any)
                }

                // Fetch Items
                const { data: itemsDataRaw, error: itemsError } = await supabase
                    .from('export_task_items')
                    .select(`
                        id,
                        quantity,
                        unit,
                        status,
                        position_id,
                        lots (
                            id,
                            code,
                            inbound_date, 
                            peeling_date,
                            notes, 
                            daily_seq,
                            lot_tags (tag, lot_item_id),
                            positions!positions_lot_id_fkey (
                                code,
                                is_hall:zone_positions(zone_id)
                            )
                        ),
                        positions!export_task_items_position_id_fkey (code),
                        products (name, sku, internal_code, internal_name)
                    `)
                    .eq('task_id', taskId)

                if (itemsError) throw itemsError

                const initialItemsData: any[] = itemsDataRaw || []
                
                // Sắp xếp theo mã vị trí (A-Z) để gom nhóm các khu vực gần nhau
                initialItemsData.sort((a: any, b: any) => {
                    const posA = a.positions?.code || ''
                    const posB = b.positions?.code || ''
                    return posA.localeCompare(posB)
                })

                // Explicitly cast or handle potential nulls if needed, though interface update should handle it
                setItems(initialItemsData as unknown as ExportOrderItem[] || [])

                // Process Structure for Grid
                const systemCode = (taskData as any)?.system_code
                if (systemCode) {
                    const [posDataRaw, zoneDataRaw, zpDataRaw, layoutDataRaw] = await Promise.all([
                        fetchAll('positions', q => q.eq('system_type', systemCode).order('code', { numeric: true }).order('id')),
                        fetchAll('zones', q => q.eq('system_type', systemCode).order('level').order('display_order').order('code').order('id')),
                        fetchAll('zone_positions', q => q.select('zone_id, position_id, positions!inner(system_type)').eq('positions.system_type', systemCode).order('zone_id', { ascending: true }).order('position_id', { ascending: true })),
                        fetchAll('zone_layouts', q => q.order('id')),
                    ])

                    // Fetch Zones for recursive is_hall calculation
                    const currentZones = zoneDataRaw || []

                    const zpLookup: Record<string, string> = {}
                    zpDataRaw.forEach((zp: any) => {
                        if (zp.position_id && zp.zone_id) zpLookup[zp.position_id] = zp.zone_id
                    })

                    const posWithZone: PositionWithZone[] = (posDataRaw as any[]).map(pos => ({
                        ...pos, zone_id: zpLookup[pos.id] || null
                    }))

                    const layoutsMap: Record<string, ZoneLayout> = {}
                    layoutDataRaw.forEach((l: any) => { if (l.zone_id) layoutsMap[l.zone_id] = l })
                    setLayouts(layoutsMap)

                    const { zones: groupedZones, positions: groupedPositions } = groupWarehouseData(zoneDataRaw as any, posWithZone)

                    const exportedPosIds = new Set(initialItemsData.map((i: any) => i.position_id).filter(Boolean))

                    const parentMap = new Map<string, string>()
                    groupedZones.forEach(z => {
                        if (z.parent_id) parentMap.set(z.id, z.parent_id)
                    })

                    const relevantZIds = new Set<string>()
                    groupedPositions.forEach(p => {
                        if (exportedPosIds.has(p.id) && p.zone_id) {
                            let curr: string | null = p.zone_id
                            while (curr) {
                                relevantZIds.add(curr)
                                curr = parentMap.get(curr) || null
                            }
                        }
                    })

                    const isBin = (z: Zone) => z.id.startsWith('v-bin-') || z.name.toUpperCase().startsWith('Ô ') || z.name.toUpperCase().startsWith('SẢNH')
                    
                    // First, identify all level zones (Tầng) that contain out items
                    const levelIdsWithItems = new Set<string>()
                    groupedPositions.forEach(p => {
                        if (exportedPosIds.has(p.id) && p.zone_id) {
                            let curr: string | null = p.zone_id
                            while (curr) {
                                const z = groupedZones.find(x => x.id === curr)
                                if (z && (z.name.toUpperCase().startsWith('TẦNG') || z.id.startsWith('v-lvl-'))) {
                                    levelIdsWithItems.add(z.id)
                                }
                                curr = parentMap.get(curr) || null
                            }
                        }
                    })

                    groupedZones.forEach(z => {
                        if (relevantZIds.has(z.id) && isBin(z)) {
                            const addDescendants = (parentId: string) => {
                                groupedZones.forEach(child => {
                                    if (child.parent_id === parentId) {
                                        // Only add to relevant if it's NOT a level, OR if it's a level that has items
                                        const isLevel = child.name.toUpperCase().startsWith('TẦNG') || child.id.startsWith('v-lvl-')
                                        if (!isLevel || levelIdsWithItems.has(child.id)) {
                                            relevantZIds.add(child.id)
                                            addDescendants(child.id)
                                        }
                                    }
                                })
                            }
                            addDescendants(z.id)
                        }
                    })

                    const finalZones = groupedZones.filter(z => relevantZIds.has(z.id))
                    
                    const finalZoneIds = new Set(finalZones.map(z => z.id))
                    
                    // Position is relevant if it belongs to a zone we kept
                    // However if it belongs to a zone we kept, we only keep it if it is an export item OR if its zone is a level zone (so we see empty slots on THAT level)
                    const finalPositions = groupedPositions.filter(p => {
                        if (!p.zone_id || !finalZoneIds.has(p.zone_id)) return false
                        
                        // We also want to keep empty slots, but ONLY for the levels we kept
                        return true
                    })

                    const lotInfoMap: Record<string, any> = {}
                    const occupied = new Set<string>()

                    finalPositions.forEach(p => {
                        const exportItem = initialItemsData.find((i: any) => i.position_id === p.id) as any
                        if (exportItem && exportItem.lots) {
                            p.lot_id = exportItem.lots.id
                            occupied.add(p.id)
                            
                            const tags = exportItem.lots.lot_tags
                                ? exportItem.lots.lot_tags
                                    .filter((t: any) => !t.tag.startsWith('SPLIT_TO:') && !t.tag.startsWith('MERGED_TO:'))
                                    .map((t: any) => t.tag.replace(/@/g, exportItem.products?.sku || ''))
                                : []

                            lotInfoMap[exportItem.lots.id] = {
                                code: exportItem.lots.code,
                                inbound_date: exportItem.lots.inbound_date,
                                tags: tags,
                                items: [{
                                    product_name: exportItem.products?.name,
                                    sku: exportItem.products?.sku,
                                    internal_code: exportItem.products?.internal_code,
                                    internal_name: exportItem.products?.internal_name,
                                    unit: exportItem.unit,
                                    quantity: exportItem.quantity,
                                    tags: tags
                                }]
                            }
                        } else {
                            p.lot_id = null
                        }
                    })

                    const autoMerged = new Set<string>()
                    finalZones.forEach(z => {
                        const level = z.level || 0
                        const isLevelUnderBin = level >= 10
                        const isBigBin = (z as any).type === 'big-bin'
                        if ((isLevelUnderBin || isBigBin) && ((z as any).positions?.length > 1 || ((z as any).totalPositions || 0) > 1)) {
                            autoMerged.add(z.id)
                        }
                    })

                    setZones(finalZones)
                    setPositions(finalPositions)
                    setLotInfo(lotInfoMap)
                    setOccupiedIds(occupied)
                    setMergedZones(autoMerged)
                    
                    // Recompute itemsData computed_status here using currentZones
                    const finalItemsData = initialItemsData.map((item: any) => {
                        let originalPosCode = item.positions?.code || 'N/A'
                        let currentPosCode = 'N/A'
                        let isHall = false

                        if (item.lots?.positions && item.lots.positions.length > 0) {
                            currentPosCode = item.lots.positions[0].code

                            const isHallRelation = item.lots.positions[0].is_hall
                            const leafZoneId = Array.isArray(isHallRelation)
                                ? isHallRelation[0]?.zone_id
                                : isHallRelation?.zone_id

                            if (leafZoneId) {
                                let currId = leafZoneId
                                while (currId) {
                                    const z = currentZones.find((x: any) => x.id === currId)
                                    if (!z) break
                                    if (z.is_hall) {
                                        isHall = true
                                        break
                                    }
                                    currId = z.parent_id
                                }
                            }
                        }

                        if (originalPosCode === 'N/A' && currentPosCode !== 'N/A') {
                            originalPosCode = currentPosCode
                        }

                        let displayStatus = item.status === 'Exported' ? 'Exported' : 'Pending'
                        if (displayStatus === 'Pending' && originalPosCode !== currentPosCode) {
                            displayStatus = isHall ? 'Moved to Hall' : 'Changed Position'
                        }

                        return {
                            ...item,
                            positions: { code: originalPosCode },
                            current_position_code: currentPosCode,
                            computed_status: displayStatus
                        }
                    })
                    setItems(finalItemsData as unknown as ExportOrderItem[] || [])

                    // Initialize item dates for editing
                    const dates: Record<string, { inboundDate: string; productionDate: string }> = {}
                    finalItemsData.forEach((item: any) => {
                        dates[item.id] = {
                            inboundDate: item.lots?.inbound_date || '',
                            productionDate: item.lots?.peeling_date || ''
                        }
                    })
                    setItemDates(dates)
                }

                // Initialize editable fields
                const taskInfo = taskData as any
                if (taskInfo) {
                    const d = new Date(taskInfo.created_at)
                    setEditDay(d.getDate().toString())

                    setEditMonth((d.getMonth() + 1).toString())
                    setEditYear(d.getFullYear().toString())
                    setNotes(taskInfo.notes || '')

                    // Lấy thông tin người đăng nhập hiện tại
                    const { data: { user } } = await supabase.auth.getUser()
                    let loggedInName = ''
                    if (user) {
                        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single() as any
                        if (profile && profile.full_name) loggedInName = profile.full_name
                    }

                    if (loggedInName) {
                        setSignPerson1(loggedInName)
                        setTask(prev => prev ? { ...prev, created_by_profile: { full_name: loggedInName } } : null)
                    } else {
                        if (taskInfo.created_by_profile?.full_name) {
                            setSignPerson1(taskInfo.created_by_profile.full_name as string)
                        }
                    }

                    // Initialize logistics fields
                    setBranch('Kho mặc định')
                    setReason(taskInfo.notes || '')
                }

            } catch (error) {
                console.error('Error fetching export task:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [taskId])

    const handlePrint = () => {
        window.print()
    }

    const toggleSelectItem = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selectedIds.size === items.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(items.map(i => i.id)))
        }
    }

    const handleApplyBulkDates = () => {
        if (selectedIds.size === 0) return
        
        setItemDates(prev => {
            const next = { ...prev }
            selectedIds.forEach(id => {
                next[id] = {
                    inboundDate: bulkInboundDate || next[id]?.inboundDate || '',
                    productionDate: bulkProductionDate || next[id]?.productionDate || ''
                }
            })
            return next
        })
        
        // Clear bulk dates after apply
        setBulkInboundDate('')
        setBulkProductionDate('')
        setSelectedIds(new Set())
    }

    const handleDownload = () => handleCapture(false)

    const handleExcelExport = async () => {
        if (!task) return

        const exportItems = items.map(item => {
            // Calculate quyCach and convertedQty for export task items
            let quyCach = '';
            let convertedQty: any = '-';
            
            const product = item.products as any;
            if (product) {
                // If it's a cold storage product, typically we use Kg conversion
                if (product.unit === 'Kg') {
                    convertedQty = item.quantity;
                } else if (product.product_units && product.product_units.length > 0) {
                    const baseUnit = product.product_units.find((u: any) => u.conversion_rate === 1 || !u.conversion_rate);
                    const targetUnit = 'Kg'; // Assumption for this specific system
                    const kgUnit = product.product_units.find((u: any) => u.unit_id === 'kg' || u.unit_id === 'Kg');
                    
                    if (kgUnit) {
                        convertedQty = item.quantity * kgUnit.conversion_rate;
                    }
                    
                    const firstPu = product.product_units[0];
                    quyCach = `${item.unit || 'Cái'}/${firstPu.conversion_rate || 1}${product.unit || ''}`;
                }
            }

            return {
                id: item.id,
                quantity: item.quantity,
                unit: item.unit || 'Cái',
                product_name: item.products?.name || '',
                sku: item.products?.sku || '',
                lot_code: item.lots?.code || '',
                peeling_date: (() => {
                    const d = itemDates[item.id]?.productionDate || item.lots?.peeling_date;
                    if (!d) return '';
                    try {
                        return format(new Date(d), 'dd/MM/yyyy');
                    } catch (e) {
                        return d;
                    }
                })(),
                inbound_date: (() => {
                    const d = itemDates[item.id]?.inboundDate || item.lots?.inbound_date;
                    if (!d) return '';
                    try {
                        return format(new Date(d), 'dd/MM/yyyy');
                    } catch (e) {
                        return d;
                    }
                })(),
                position_code: item.positions?.code || '',
                notes: item.lots?.notes || '',
                stt_lot: item.lots?.daily_seq || '',
                convertedQty: convertedQty
            }
        })

        const signatures = [
            { title: 'Người nhận', name: customerName },
            { title: 'Tài xế', name: '' },
            { title: 'Thủ kho', name: signPerson2 },
            { title: 'Kế toán trưởng', name: signPerson3 },
            { title: 'TP.QLCL', name: signPerson4 },
            { title: 'Người lập phiếu', name: signPerson1 }
        ]

        await exportExportOrderToExcel({
            order: {
                code: task.code || '',
                created_at: task.created_at,
                notes: task.notes
            },
            items: exportItems,
            companyInfo,
            editableFields: {
                customerSupplierName: customerName,
                customerSupplierAddress: customerAddress,
                reasonDescription: reason,
                warehouse: branch,
                location: companyInfo?.address || '',
                note: notes,
                day: editDay,
                month: editMonth,
                year: editYear,
                vehicleNumber: vehicleNumber,
                containerNumber: containerNumber,
                sealNumber: sealNumber,
                signatures
            }
        })
    }


    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin text-stone-400" size={30} />
            </div>
        )
    }

    if (!task) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-stone-500">
                <p>Không tìm thấy lệnh xuất kho.</p>
                <button onClick={() => window.close()} className="text-blue-600 hover:underline">Đóng</button>
            </div>
        )
    }

    return (
        <div id="print-ready" className={`print:p-0 mx-auto text-black bg-stone-100 print:bg-white text-[13px] leading-relaxed font-serif py-8 print:py-0 min-h-screen flex flex-col items-center gap-8 print:block print:gap-0`}>
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 10mm;
                        size: portrait;
                    }
                    @page landscape-page {
                        size: landscape;
                        margin: 10mm;
                    }
                    .landscape-section {
                        page: landscape-page;
                    }
                    body {
                        print-color-adjust: exact;
                        -webkit-print-color-adjust: exact;
                        font-family: 'Times New Roman', Times, serif !important;
                    }
                    .page-break {
                        page-break-before: always;
                    }
                }
                #print-ready {
                    font-family: 'Times New Roman', Times, serif;
                }
            `}</style>

            {/* Toolbar */}
            <div className={`fixed top-4 right-4 print:hidden z-50 flex items-center gap-4 ${isSnapshotMode ? 'hidden' : ''}`}>
                <div 
                    title="Toggle Edit Mode"
                    onClick={() => setAllowEditDates(!allowEditDates)}
                    className={`w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-colors ${allowEditDates ? 'bg-blue-100 text-blue-600' : 'text-stone-300 hover:text-stone-400'}`}
                >
                    <span className="text-[10px] leading-none">.</span>
                </div>
                <div className="flex items-center gap-2">
                <button
                    onClick={handleDownload}
                    disabled={isDownloadingState}
                    className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg transition-colors font-sans text-sm"
                >
                    {isDownloadingState ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    Tải ảnh
                </button>
                <button
                    onClick={handleExcelExport}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition-colors font-sans text-sm"
                >
                    <Download size={16} />
                    Xuất Excel
                </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors font-sans text-sm"
                    >
                        <Printer size={16} />
                        In phiếu
                    </button>
                </div>
            </div>

            {/* Bulk Edit Bar */}
            {allowEditDates && selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 print:hidden z-50 bg-white border border-blue-200 shadow-xl rounded-2xl p-4 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center gap-2 pr-6 border-r border-stone-100">
                        <span className="bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded text-sm">
                            {selectedIds.size}
                        </span>
                        <span className="text-sm font-medium text-stone-600">dòng đang chọn</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-bold text-stone-400">Ngày SX (Chung)</label>
                            <input 
                                type="date" 
                                value={bulkProductionDate}
                                onChange={e => setBulkProductionDate(e.target.value)}
                                className="border border-stone-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase font-bold text-stone-400">Ngày Nhập (Chung)</label>
                            <input 
                                type="date" 
                                value={bulkInboundDate}
                                onChange={e => setBulkInboundDate(e.target.value)}
                                className="border border-stone-200 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleApplyBulkDates}
                        disabled={!bulkInboundDate && !bulkProductionDate}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-stone-300 text-white font-bold px-6 py-2 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 text-sm"
                    >
                        Áp dụng hàng loạt
                    </button>
                    
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-stone-400 hover:text-stone-600 text-sm font-medium px-2"
                    >
                        Hủy
                    </button>
                </div>
            )}

            {/* PAGE 1: EXPORT ORDER DETAIL */}
            <div className={`pt-8 px-8 pb-8 print:p-0 w-full max-w-[210mm] print:max-w-none bg-white shadow-md print:shadow-none ${isCapturing ? 'w-[210mm]' : ''}`}>
                {/* Header with Shared Component */}
                <div className="mb-6">
                    <PrintHeader
                        companyInfo={companyInfo}
                        logoSrc={logoSrc}
                        size="large"
                        rightContent={null}
                    />
                </div>

                {/* Title */}
                <div className="relative text-center mt-4 mb-4">
                    <h1 className="text-xl font-bold tracking-wide" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
                        LỆNH XUẤT KHO
                    </h1>
                    <div className="text-sm italic text-gray-600 mt-2">
                        <span className={`print:hidden ${isSnapshotMode ? 'hidden' : ''}`}>
                            Ngày{' '}
                            <input
                                type="text"
                                value={editDay}
                                onChange={(e) => setEditDay(e.target.value)}
                                className="w-8 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                            />{' '}
                            tháng{' '}
                            <input
                                type="text"
                                value={editMonth}
                                onChange={(e) => setEditMonth(e.target.value)}
                                className="w-8 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                            />{' '}
                            năm{' '}
                            <input
                                type="text"
                                value={editYear}
                                onChange={(e) => setEditYear(e.target.value)}
                                className="w-12 text-center border-b border-dashed border-gray-300 bg-transparent focus:outline-none focus:border-blue-500"
                            />
                        </span>
                        <span className={`hidden print:inline-block ${isSnapshotMode ? '!inline-block' : ''}`}>
                            Ngày {editDay} tháng {editMonth} năm {editYear}
                        </span>
                    </div>
                    <div className="text-sm font-bold mt-1">Số: <span className="text-red-600">{task.code}</span></div>
                </div>

                {/* Info Fields */}
                <div className="mb-4 text-sm space-y-2 border border-dashed border-stone-200 p-4 rounded-lg bg-stone-50/50 print:border-none print:p-0 print:bg-transparent">
                    <div className="flex gap-4 items-center">
                        <div className="flex-1 flex gap-1 items-center">
                            <span className="shrink-0">- Người nhận:</span>
                            <input
                                type="text"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                                className="flex-1 border-b border-dashed border-stone-300 bg-transparent focus:outline-none focus:border-blue-500 font-bold"
                                placeholder="Nhập tên khách hàng..."
                            />
                        </div>
                    </div>
                    <div className="flex gap-1 items-center">
                        <span className="shrink-0">- Địa chỉ (bộ phận):</span>
                        <input
                            type="text"
                            value={customerAddress}
                            onChange={e => setCustomerAddress(e.target.value)}
                            className="flex-1 border-b border-dashed border-stone-300 bg-transparent focus:outline-none focus:border-blue-500 font-bold"
                            placeholder="Nhập địa chỉ..."
                        />
                    </div>
                    <div className="flex gap-1 items-center">
                        <span className="shrink-0">- Lý do xuất:</span>
                        <input
                            type="text"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="flex-1 border-b border-dashed border-stone-300 bg-transparent focus:outline-none focus:border-blue-500 font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex gap-1 items-center">
                            <span className="shrink-0">- Xuất tại kho:</span>
                            <input
                                type="text"
                                value={branch}
                                onChange={e => setBranch(e.target.value)}
                                className="flex-1 border-b border-dashed border-stone-300 bg-transparent focus:outline-none focus:border-blue-500 font-bold"
                            />
                        </div>
                        <div className="flex gap-1 items-center">
                            <span className="shrink-0">- Biển số xe:</span>
                            <input
                                type="text"
                                value={vehicleNumber}
                                onChange={e => setVehicleNumber(e.target.value)}
                                className="flex-1 border-b border-dashed border-stone-300 bg-transparent focus:outline-none focus:border-blue-500 font-bold"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex gap-1 items-center">
                            <span className="shrink-0">- Số Cont:</span>
                            <input
                                type="text"
                                value={containerNumber}
                                onChange={e => setContainerNumber(e.target.value)}
                                className="flex-1 border-b border-dashed border-stone-300 bg-transparent focus:outline-none focus:border-blue-500 font-bold"
                            />
                        </div>
                        <div className="flex gap-1 items-center">
                            <span className="shrink-0">- Số Seal:</span>
                            <input
                                type="text"
                                value={sealNumber}
                                onChange={e => setSealNumber(e.target.value)}
                                className="flex-1 border-b border-dashed border-stone-300 bg-transparent focus:outline-none focus:border-blue-500 font-bold"
                            />
                        </div>
                    </div>
                    <div className="flex gap-1 items-start">
                        <span className="shrink-0">- Ghi chú:</span>
                        <div className="flex-1">
                            <EditableText
                                value={notes}
                                onChange={setNotes}
                                placeholder=""
                                className="w-full !text-red-600 font-bold italic h-5"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                </div>

                <h3 className="font-bold text-sm mb-2">Chi tiết hàng hóa xuất kho</h3>

                {/* Table */}
                <table className="w-full border-collapse border border-black mb-4 text-xs">
                    <thead>
                        <tr>
                            {allowEditDates && (
                                <th className="border border-black p-2 w-8 text-center print:hidden">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.size === items.length && items.length > 0}
                                        onChange={toggleSelectAll}
                                        className="w-4 h-4 rounded"
                                    />
                                </th>
                            )}
                            <th className="border border-black p-2 w-10 text-center">STT</th>
                            <th className="border border-black p-2 w-24 text-center">Mã LOT</th>
                            <th className="border border-black p-2 w-24 text-center">Vị trí</th>
                            <th className="border border-black p-2 text-center">Sản phẩm</th>
                            <th className="border border-black p-2 w-16 text-center">Số lượng</th>
                            <th className="border border-black p-2 w-16 text-center">ĐVT</th>
                            {(allowEditDates && !isSnapshotMode) && (
                                <th className="border border-black p-2 w-24 text-center print:hidden">Ngày SX</th>
                            )}
                            <th className="border border-black p-2 w-24 text-center">Ngày nhập kho</th>
                            <th className="border border-black p-2 w-24 text-center">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => {
                            const d = itemDates[item.id] || { inboundDate: '', productionDate: '' }
                            const isSelected = selectedIds.has(item.id)
                            return (
                                <tr key={item.id} className={`break-inside-avoid ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                    {allowEditDates && (
                                        <td className="border border-black p-2 text-center print:hidden">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={() => toggleSelectItem(item.id)}
                                                className="w-4 h-4 rounded cursor-pointer"
                                            />
                                        </td>
                                    )}
                                    <td className="border border-black p-2 text-center">{idx + 1}</td>
                                    <td className="border border-black p-2 text-center">
                                        <div className="font-bold">{item.lots?.code}</div>
                                        {item.lots?.lot_tags && item.lots.lot_tags.length > 0 && (
                                            <div className="mt-1 flex justify-center">
                                                <TagDisplay
                                                    tags={(item.lots?.lot_tags || [])
                                                        .filter(t => !t.tag.startsWith('SPLIT_TO:') && !t.tag.startsWith('MERGED_TO:'))
                                                        .map(t => t.tag.replace(/@/g, item.products?.sku || ''))}
                                                />
                                            </div>
                                        )}
                                    </td>
                                    <td className="border border-black p-2 text-center">{item.positions?.code}</td>
                                    <td className="border border-black p-2">
                                        <div className="font-bold">{item.products?.name}</div>
                                        <div className="text-[10px] text-stone-500">{item.products?.sku}</div>
                                    </td>
                                    <td className="border border-black p-2 text-center font-bold">
                                        {formatQuantityFull(item.quantity)}
                                    </td>
                                    <td className="border border-black p-2 text-center">{item.unit}</td>
                                    {(allowEditDates && !isSnapshotMode) && (
                                        <td className="border border-black p-2 text-center print:hidden">
                                            <input
                                                type="date"
                                                value={d.productionDate?.split('T')[0] || ''}
                                                onChange={(e) => setItemDates(prev => ({
                                                    ...prev,
                                                    [item.id]: { ...prev[item.id], productionDate: e.target.value }
                                                }))}
                                                className="w-full text-center bg-transparent border-none p-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                                            />
                                        </td>
                                    )}
                                    <td className="border border-black p-2 text-center">
                                        {allowEditDates ? (
                                            <input
                                                type="date"
                                                value={d.inboundDate?.split('T')[0] || ''}
                                                onChange={(e) => setItemDates(prev => ({
                                                    ...prev,
                                                    [item.id]: { ...prev[item.id], inboundDate: e.target.value }
                                                }))}
                                                className="w-full text-center bg-transparent border-none p-0 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                                            />
                                        ) : (
                                            d.inboundDate ? format(new Date(d.inboundDate), 'dd/MM/yyyy') : '-'
                                        )}
                                    </td>
                                    <td className="border border-black p-2">
                                        <EditableText
                                            value={item.lots?.notes || ''}
                                            onChange={() => {}} // Notes for lots are not editable yet here, but keeping structure
                                            isSnapshot={isSnapshotMode}
                                            className="min-h-[1.5em]"
                                        />
                                    </td>
                                </tr>
                            )
                        })}
                        {items.length === 0 && (
                            <tr>
                                <td className="border border-black p-4 text-center" colSpan={allowEditDates ? (allowEditDates && !isSnapshotMode ? 10 : 9) : 8}>Không có dữ liệu</td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Signatures */}
                <div className="grid grid-cols-4 gap-4 text-center break-inside-avoid text-sm pt-4">
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle1}
                                onChange={setSignTitle1}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson1}
                                onChange={setSignPerson1}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle2}
                                onChange={setSignTitle2}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson2}
                                onChange={setSignPerson2}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle3}
                                onChange={setSignTitle3}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson3}
                                onChange={setSignPerson3}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="mb-16 font-bold">
                            <EditableText
                                value={signTitle4}
                                onChange={setSignTitle4}
                                className="font-bold text-center w-full block"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                        <div className="font-bold uppercase text-[11px]">
                            <EditableText
                                value={signPerson4}
                                onChange={setSignPerson4}
                                className="font-bold text-center w-full block uppercase"
                                isSnapshot={isSnapshotMode}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* PAGE 2: DIAGRAM */}
            <div className={`landscape-section pt-8 px-8 pb-8 print:p-0 w-full max-w-[297mm] print:max-w-none bg-white shadow-md print:shadow-none ${isCapturing ? 'w-[297mm]' : ''} page-break`}>
                <h2 className="font-bold text-lg mb-4 text-center uppercase border-b border-black pb-2">Sơ đồ vị trí xuất kho</h2>
                {zones.length > 0 && (
                    <FlexibleZoneGrid
                        zones={zones}
                        positions={positions}
                        layouts={layouts}
                        occupiedIds={occupiedIds}
                        lotInfo={lotInfo as any}
                        collapsedZones={new Set()}
                        selectedPositionIds={new Set()}
                        onToggleCollapse={() => { }}
                        pageBreakIds={new Set()}
                        displayInternalCode={displayInternalCode}
                        isDesignMode={false}
                        isGrouped={true}
                        mergedZones={mergedZones}
                        isCapturing={isCapturing}
                        isPrintPage={true}
                    />
                )}
            </div>
        </div>
    )
}
