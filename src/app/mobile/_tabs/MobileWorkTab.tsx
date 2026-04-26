'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { groupWarehouseData } from '@/lib/warehouseUtils'
import { 
    Loader2, FileText, ChevronRight, RotateCcw, ArrowLeft, 
    CheckCircle2, ArrowDownToLine, Plus, Search, MapPin, 
    Clock, CheckCircle, AlertCircle, Send
} from 'lucide-react'
import { SelectHallModal } from '@/components/warehouse/map/SelectHallModal'
import { format } from 'date-fns'

interface ExportTask {
    id: string
    code: string
    status: string
    created_at: string
    created_by_name?: string
    items_count?: number
    notes?: string | null
}

interface TaskItem {
    id: string
    lot_id: string | null
    lot_code: string
    production_code?: string | null
    position_id: string | null
    position_name: string
    current_position_name: string
    zone_id?: string | null
    product_name: string
    sku: string
    quantity: number
    unit: string
    status: string
    display_status: 'Pending' | 'Moved to Hall' | 'Changed Position' | 'Exported'
    scanned?: boolean
}

export default function MobileWorkTab() {
    const { profile } = useUser()
    const { currentSystem } = useSystem()
    const { showToast } = useToast()

    const [activeTab, setActiveTab] = useState<'running' | 'completed' | 'request'>('running')
    const [step, setStep] = useState<'list' | 'detail'>('list')
    const [loading, setLoading] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const [tasks, setTasks] = useState<ExportTask[]>([])
    const [selectedTask, setSelectedTask] = useState<ExportTask | null>(null)
    const [taskItems, setTaskItems] = useState<TaskItem[]>([])
    const [zones, setZones] = useState<any[]>([])
    const [groupedZones, setGroupedZones] = useState<any[]>([])
    const [virtualToRealMap, setVirtualToRealMap] = useState<Map<string, string[]>>(new Map())

    const [isSelectHallOpen, setIsSelectHallOpen] = useState(false)
    const [pendingLotId, setPendingLotId] = useState<string | null>(null)
    const [pendingPositionId, setPendingPositionId] = useState<string | null>(null)
    const [pendingItemId, setPendingItemId] = useState<string | null>(null)
    const [pendingItems, setPendingItems] = useState<TaskItem[]>([])

    // Pick Request State (Hierarchical Selection)
    const [requestSelection, setRequestSelection] = useState({
        warehouseId: null as string | null,
        aisleId: null as string | null,
        slotId: null as string | null,
        tierId: null as string | null,
        step: 'warehouse' as 'warehouse' | 'aisle' | 'slot' | 'tier' | 'pallets'
    })
    const [requestPositions, setRequestPositions] = useState<any[]>([])
    const [selectedPosIds, setSelectedPosIds] = useState<Set<string>>(new Set())

    // Detail View Navigation State
    const [detailSelection, setDetailSelection] = useState({
        aisleId: null as string | null,
        slotId: null as string | null,
        step: 'aisle' as 'aisle' | 'slot' | 'items'
    })
    const [selectedDetailItemIds, setSelectedDetailItemIds] = useState<Set<string>>(new Set())

    useEffect(() => { 
        if (activeTab !== 'request') {
            fetchTasks()
        }
        fetchZones() 
    }, [activeTab, currentSystem])

    async function fetchZones() {
        if (!currentSystem) return
        setLoading(true)
        try {
            let allZones: any[] = []
            let from = 0
            const limit = 1000
            
            // Tìm kiếm linh hoạt hơn: một số record dùng code, một số dùng ID
            const systemIdentifiers = [currentSystem.code, currentSystem.id].filter(Boolean)

            while (true) {
                const { data, error } = await supabase
                    .from('zones')
                    .select('*')
                    .in('system_type', systemIdentifiers)
                    .order('name')
                    .range(from, from + limit - 1)
                
                if (error) throw error
                if (!data || data.length === 0) break
                
                allZones = [...allZones, ...data]
                if (data.length < limit) break
                from += limit
            }

            setZones(allZones)

            // groupWarehouseData chỉ cần zones để tạo cây phân cấp gộp ô + virtualToRealMap
            const result = groupWarehouseData(allZones as any, [] as any)
            setGroupedZones(result.zones || allZones)
            setVirtualToRealMap(result.virtualToRealMap || new Map())
        } catch (error: any) {
            console.error('Fetch zones error:', error)
            showToast('Lỗi tải sơ đồ kho: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function fetchTasks() {
        if (!currentSystem?.code) return
        setLoading(true)
        try {
            const statusFilter = activeTab === 'running' ? ['Pending', 'In Progress'] : ['Completed']
            const { data: tasksData, error } = await supabase
                .from('export_tasks')
                .select('*, export_task_items(count)')
                .eq('system_code', currentSystem.code)
                .in('status', statusFilter)
                .order('created_at', { ascending: false }) as any
            if (error) throw error

            const userIds = Array.from(new Set((tasksData || []).map((t: any) => t.created_by).filter(Boolean)))
            let userMap: Record<string, string> = {}
            if (userIds.length > 0) {
                const { data: usersData } = await (supabase.from('user_profiles') as any).select('id, full_name').in('id', userIds as string[])
                if (usersData) usersData.forEach((u: any) => { userMap[u.id] = u.full_name })
            }

            setTasks((tasksData || []).map((t: any) => ({
                id: t.id, code: t.code, status: t.status, created_at: t.created_at, notes: t.notes,
                created_by_name: t.created_by ? (userMap[t.created_by] || 'Unknown') : 'Unknown',
                items_count: t.export_task_items?.[0]?.count || 0
            })))
        } catch (error: any) {
            showToast('Lỗi tải danh sách: ' + error.message, 'error')
        } finally { setLoading(false) }
    }

    async function fetchTaskItems(taskId: string, silent = false) {
        if (!silent) setLoading(true)
        try {
            const { data, error } = await supabase
                .from('export_task_items')
                .select(`id, quantity, unit, status, lot_id, position_id,
          lots (id, code, production_code, positions!positions_lot_id_fkey (code, is_hall:zone_positions(zone_id))),
          positions!export_task_items_position_id_fkey (code, zone_positions(zone_id)), products (name, sku)`)
                .eq('task_id', taskId)
            if (error) throw error

            let currentZones = zones
            if (currentZones.length === 0 && currentSystem?.code) {
                const { data: zData } = await (supabase.from('zones').select('*').eq('system_type', currentSystem.code) as any)
                if (zData) { currentZones = zData; setZones(zData) }
            }

            const items: TaskItem[] = (data || []).map((item: any) => {
                const originalPosCode = item.positions?.code || 'N/A'
                let currentPosCode = originalPosCode
                let isHall = false

                if (item.lots?.positions?.length > 0) {
                    currentPosCode = item.lots.positions[0].code
                    const isHallRelation = item.lots.positions[0].is_hall
                    const leafZoneId = Array.isArray(isHallRelation) ? isHallRelation[0]?.zone_id : isHallRelation?.zone_id
                    if (leafZoneId) {
                        let currId = leafZoneId
                        while (currId) {
                            const z = currentZones.find((x: any) => x.id === currId)
                            if (!z) break
                            if (z.is_hall) { isHall = true; break }
                            currId = z.parent_id
                        }
                    }
                }

                let displayStatus: TaskItem['display_status'] = item.status === 'Exported' ? 'Exported' : 'Pending'
                if (displayStatus === 'Pending' && originalPosCode !== currentPosCode) {
                    displayStatus = isHall ? 'Moved to Hall' : 'Changed Position'
                }

                const zp = item.positions?.zone_positions
                const leafZoneId = Array.isArray(zp) ? zp[0]?.zone_id : zp?.zone_id

                return {
                    id: item.id, lot_id: item.lots?.id || item.lot_id, 
                    lot_code: item.lots?.code || 'N/A',
                    production_code: item.lots?.production_code,
                    position_id: item.position_id, position_name: originalPosCode, current_position_name: currentPosCode,
                    zone_id: leafZoneId,
                    product_name: item.products?.name || 'N/A', sku: item.products?.sku || 'N/A',
                    quantity: item.quantity, unit: item.unit || '', status: item.status || 'Pending',
                    display_status: displayStatus,
                    scanned: displayStatus === 'Moved to Hall' || displayStatus === 'Changed Position' || displayStatus === 'Exported'
                }
            }).sort((a, b) => a.position_name.localeCompare(b.position_name))

            setTaskItems(items)
        } catch (error: any) {
            showToast('Lỗi tải chi tiết: ' + error.message, 'error')
        } finally { if (!silent) setLoading(false) }
    }

    async function selectTask(task: ExportTask) {
        setSelectedTask(task)
        await fetchTaskItems(task.id)
        setStep('detail')
    }

    function handleReset() {
        setStep('list'); setSelectedTask(null); setTaskItems([])
        setPendingLotId(null); setPendingPositionId(null); setPendingItemId(null)
        setDetailSelection({ aisleId: null, slotId: null, step: 'aisle' })
        setSelectedDetailItemIds(new Set())
    }

    async function handleCheckOff(item: TaskItem) {
        if (loading || item.scanned) return
        
        // Logic hạ sảnh
        setPendingLotId(item.lot_id)
        setPendingPositionId(item.position_id)
        setPendingItemId(item.id)
        setPendingItems([item]) // Thêm danh sách tạm thời cho xử lý đơn lẻ
        setIsSelectHallOpen(true)
    }

    async function handleMoveToHall(hallId: string) {
        setIsSelectHallOpen(false)
        if (pendingItems.length === 0) return
        
        setLoading(true)
        const total = pendingItems.length
        let success = 0
        
        try {
            for (const item of pendingItems) {
                setProcessingId(item.id)
                try {
                    // 1. Kiểm tra vị trí hiện tại của LOT
                    const { data: currentPos, error: posError } = await supabase
                        .from('positions')
                        .select('id')
                        .eq('lot_id', item.lot_id)
                        .single()
                    
                    if (posError && posError.code !== 'PGRST116') throw posError
                    
                    // 2. Tìm vị trí trống trong Sảnh
                    const targetZoneIds = new Set<string>([hallId])
                    let added = true
                    while (added) { 
                        added = false
                        for (const z of zones) { 
                            if (z.parent_id && targetZoneIds.has(z.parent_id) && !targetZoneIds.has(z.id)) { 
                                targetZoneIds.add(z.id)
                                added = true 
                            } 
                        } 
                    }

                    const { data: availablePositions, error: availError } = await (supabase
                        .from('zone_positions').select('position_id, zone_id, positions!inner(id, lot_id)')
                        .is('positions.lot_id', null).in('zone_id', Array.from(targetZoneIds)).limit(1) as any)

                    if (availError || !availablePositions?.length) { 
                        throw new Error('Không còn vị trí trống trong Sảnh!')
                    }

                    const targetPositionId = availablePositions[0].position_id as string

                    // 3. Thực hiện di chuyển
                    if (currentPos) {
                        await (supabase.from('positions') as any).update({ lot_id: null }).eq('id', (currentPos as any).id)
                    }
                    
                    const { error: updateError } = await (supabase.from('positions') as any).update({ lot_id: item.lot_id }).eq('id', targetPositionId)
                    if (updateError) throw updateError
                    
                    success++
                } catch (err: any) {
                    console.error(`Lỗi hạ sảnh pallet ${item.lot_code}:`, err)
                }
            }

            if (success > 0) {
                showToast(`Đã hạ sảnh thành công ${success}/${total} pallet!`, 'success')
                if (selectedTask) await fetchTaskItems(selectedTask.id, true)
                setSelectedDetailItemIds(new Set())
            }
        } catch (error: any) { 
            showToast('Lỗi hệ thống: ' + error.message, 'error') 
        } finally { 
            setLoading(false)
            setProcessingId(null)
            setPendingItems([])
            setPendingLotId(null)
            setPendingPositionId(null)
            setPendingItemId(null)
        }
    }

    async function handleRequestPick(positionIds: string[]) {
        if (!profile?.id || !currentSystem?.code || !profile?.company_id || positionIds.length === 0) return
        setLoading(true)
        try {
            const inserts = positionIds.map(posId => ({
                position_id: posId,
                requested_by: profile.id,
                system_code: currentSystem.code,
                company_id: profile.company_id,
                status: 'Pending'
            }))

            const { error } = await (supabase
                .from('pick_requests' as any) as any)
                .insert(inserts)
            
            if (error) throw error
            showToast(`Đã gửi ${positionIds.length} yêu cầu lấy hàng!`, 'success')
            
            // Reset selection
            setSelectedPosIds(new Set())
            setRequestSelection(prev => ({ ...prev, step: 'warehouse', warehouseId: null, aisleId: null, slotId: null, tierId: null }))
        } catch (error: any) {
            showToast('Lỗi gửi yêu cầu: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'request' && requestSelection.step === 'pallets') {
            const leafId = requestSelection.tierId || requestSelection.slotId
            if (leafId) {
                fetchPositionsInZone(leafId)
            }
        }
    }, [activeTab, requestSelection.step, requestSelection.tierId, requestSelection.slotId])

    async function fetchPositionsInZone(zoneId: string) {
        setLoading(true)
        try {
            // 1. Tra virtualToRealMap: nếu zoneId là zone ảo (gom ô), lấy tất cả zone thật
            const realZoneIds: string[] = []
            if (virtualToRealMap.has(zoneId)) {
                realZoneIds.push(...virtualToRealMap.get(zoneId)!)
            } else {
                realZoneIds.push(zoneId)
            }

            // 2. Tìm tất cả zone con đệ quy (từ zones THÔ, không phải grouped)
            const allZoneIds = new Set<string>(realZoneIds)
            let added = true
            while (added) {
                added = false
                for (const z of zones) {
                    if (z.parent_id && allZoneIds.has(z.parent_id) && !allZoneIds.has(z.id)) {
                        allZoneIds.add(z.id)
                        added = true
                    }
                }
            }

            // Cũng kiểm tra các zone con trong groupedZones (zone ảo có thể có con ảo)
            for (const gz of groupedZones) {
                if (gz.parent_id && (gz.parent_id === zoneId || allZoneIds.has(gz.parent_id))) {
                    // Nếu gz là zone ảo, lấy zone thật từ map
                    if (virtualToRealMap.has(gz.id)) {
                        virtualToRealMap.get(gz.id)!.forEach(rid => allZoneIds.add(rid))
                    }
                }
            }

            // 3. Lấy danh sách position_id từ bảng trung gian zone_positions
            const { data: zpData, error: zpError } = await supabase
                .from('zone_positions')
                .select('position_id')
                .in('zone_id', Array.from(allZoneIds))
            
            if (zpError) throw zpError
            if (!zpData || (zpData as any[]).length === 0) {
                setRequestPositions([])
                return
            }

            const posIds = (zpData as any[]).map(zp => zp.position_id)

            // 4. Lấy thông tin chi tiết Pallet VÀ Lô hàng
            const { data, error } = await supabase
                .from('positions')
                .select(`
                    id, 
                    code, 
                    lot_id,
                    lots:lots!positions_lot_id_fkey(
                        id, 
                        code, 
                        production_code,
                        lot_items:lot_items!lot_items_lot_id_fkey(
                            id,
                            quantity, 
                            unit,
                            products:products!lot_items_product_id_fkey(
                                id,
                                name, 
                                sku
                            )
                        )
                    )
                `)
                .in('id', posIds)
                .order('code', { ascending: true })
            
            if (error) throw error
            
            const formatted = (data || []).map((item: any) => ({
                id: item.id,
                code: item.code,
                lot: item.lots,
                has_goods: !!item.lot_id
            }))

            setRequestPositions(formatted)
        } catch (error: any) {
            console.error('Fetch positions error:', error)
            showToast('Lỗi tải vị trí: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const handleZoneClick = (z: any, shouldFetch: boolean = false) => {
        const nextStep = 
            requestSelection.step === 'warehouse' ? 'aisle' :
            requestSelection.step === 'aisle' ? 'slot' :
            requestSelection.step === 'slot' ? 'tier' : 'pallets'

        setRequestSelection(prev => ({
            ...prev,
            warehouseId: requestSelection.step === 'warehouse' ? z.id : prev.warehouseId,
            aisleId: requestSelection.step === 'aisle' ? z.id : prev.aisleId,
            slotId: requestSelection.step === 'slot' ? z.id : prev.slotId,
            tierId: requestSelection.step === 'tier' ? z.id : prev.tierId,
            step: nextStep
        }))

        // Chỉ fetch positions khi đã đến bước cuối (chọn Tầng hoặc Ô không có Tầng)
        if (shouldFetch || nextStep === 'pallets') {
            fetchPositionsInZone(z.id)
        }
    }

    const scannedCount = taskItems.filter(i => i.scanned).length
    const totalCount = taskItems.length

    // Hierarchy Helpers - Dùng groupedZones thống nhất để đảm bảo đồng bộ với logic gom ô/dãy
    const warehouses = groupedZones.filter(z => !z.parent_id).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    const aisles = requestSelection.warehouseId ? groupedZones.filter(z => z.parent_id === requestSelection.warehouseId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : []
    const slots = requestSelection.aisleId ? groupedZones.filter(z => z.parent_id === requestSelection.aisleId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : []
    const tiers = requestSelection.slotId ? groupedZones.filter(z => z.parent_id === requestSelection.slotId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : []

    const togglePosSelection = (id: string) => {
        const next = new Set(selectedPosIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedPosIds(next)
    }

    const selectAllPos = () => {
        const hasGoods = requestPositions.filter(p => p.has_goods).map(p => p.id)
        setSelectedPosIds(new Set(hasGoods))
    }

    // ============ LIST VIEW ============
    if (step === 'list') {
        return (
            <div className="mobile-animate-fade-in pb-32">
                <div className="mobile-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="mobile-header-brand">Sarita Workspace</div>
                            <div className="mobile-header-title">Công Việc</div>
                            <div className="mobile-header-subtitle">{currentSystem?.name || ''}</div>
                        </div>
                        <button className="mobile-btn mobile-btn--primary" onClick={fetchTasks} disabled={loading || activeTab === 'request'}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Tải lại
                        </button>
                    </div>

                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
                        <button onClick={() => setActiveTab('running')} className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all ${activeTab === 'running' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-500'}`}>Đang chạy</button>
                        <button onClick={() => setActiveTab('completed')} className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all ${activeTab === 'completed' ? 'bg-green-600 text-white shadow-lg shadow-green-200' : 'bg-gray-100 text-gray-500'}`}>Đã xong</button>
                        <button onClick={() => setActiveTab('request')} className={`flex-1 py-2 px-2 rounded-xl text-[11px] font-black transition-all ${activeTab === 'request' ? 'bg-purple-600 text-white shadow-lg shadow-purple-200' : 'bg-gray-100 text-gray-500'}`}>Yêu cầu lấy</button>
                    </div>
                </div>

                <div style={{ padding: '20px' }}>
                    {activeTab === 'request' ? (
                        <div className="mobile-animate-slide-up space-y-6">
                            {/* Breadcrumbs */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {requestSelection.warehouseId && (
                                    <button onClick={() => setRequestSelection({ ...requestSelection, step: 'warehouse', warehouseId: null, aisleId: null, slotId: null, tierId: null })} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-[10px] font-black uppercase border border-purple-100">
                                        Kho: {groupedZones.find(z => z.id === requestSelection.warehouseId)?.name}
                                    </button>
                                )}
                                {requestSelection.aisleId && (
                                    <button onClick={() => setRequestSelection({ ...requestSelection, step: 'aisle', aisleId: null, slotId: null, tierId: null })} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-[10px] font-black uppercase border border-purple-100">
                                        Dãy: {groupedZones.find(z => z.id === requestSelection.aisleId)?.name}
                                    </button>
                                )}
                                {requestSelection.slotId && (
                                    <button onClick={() => setRequestSelection({ ...requestSelection, step: 'slot', slotId: null, tierId: null })} className="px-3 py-1 bg-purple-50 text-purple-700 rounded-full text-[10px] font-black uppercase border border-purple-100">
                                        Ô: {groupedZones.find(z => z.id === requestSelection.slotId)?.name}
                                    </button>
                                )}
                            </div>

                            {/* Step Views */}
                            {requestSelection.step === 'warehouse' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {warehouses.map(z => (
                                        <button key={z.id} onClick={() => setRequestSelection({ ...requestSelection, warehouseId: z.id, step: 'aisle' })} className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm active:scale-95 text-center font-black uppercase text-sm text-gray-900">
                                            {z.name}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {requestSelection.step === 'aisle' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {aisles.map(z => (
                                        <button key={z.id} onClick={() => setRequestSelection({ ...requestSelection, aisleId: z.id, step: 'slot' })} className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm active:scale-95 text-center font-black uppercase text-sm text-gray-900">
                                            {z.name}
                                        </button>
                                    ))}
                                    <button onClick={() => setRequestSelection({ ...requestSelection, step: 'warehouse', warehouseId: null })} className="p-5 bg-gray-50 rounded-3xl border border-dashed border-gray-300 text-gray-400 text-center font-bold uppercase text-xs">
                                        Quay lại
                                    </button>
                                </div>
                            )}

                            {requestSelection.step === 'slot' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {slots.map(z => (
                                        <button key={z.id} onClick={() => {
                                            const hasTiers = groupedZones.some(x => x.parent_id === z.id)
                                            if (hasTiers) {
                                                setRequestSelection({ ...requestSelection, slotId: z.id, step: 'tier' })
                                            } else {
                                                setRequestSelection({ ...requestSelection, slotId: z.id, step: 'pallets' })
                                                fetchPositionsInZone(z.id)
                                            }
                                        }} className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm active:scale-95 text-center font-black uppercase text-sm text-gray-900">
                                            {z.name}
                                        </button>
                                    ))}
                                    <button onClick={() => setRequestSelection({ ...requestSelection, step: 'aisle', aisleId: null })} className="p-5 bg-gray-50 rounded-3xl border border-dashed border-gray-300 text-gray-400 text-center font-bold uppercase text-xs">
                                        Quay lại
                                    </button>
                                </div>
                            )}

                            {requestSelection.step === 'tier' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {tiers.map(z => (
                                        <button key={z.id} onClick={() => handleZoneClick(z)} className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm active:scale-95 text-center font-black uppercase text-sm text-gray-900">
                                            {z.name}
                                        </button>
                                    ))}
                                    <button onClick={() => setRequestSelection({ ...requestSelection, step: 'slot', slotId: null })} className="p-5 bg-gray-50 rounded-3xl border border-dashed border-gray-300 text-gray-400 text-center font-bold uppercase text-xs">
                                        Quay lại
                                    </button>
                                </div>
                            )}

                            {/* Pallets List Section - Always show if we have data or are loading */}
                            {(requestPositions.length > 0 || loading) && (
                                <div className="mobile-animate-slide-up pt-4 border-t border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Danh sách Pallet tại khu vực đã chọn</div>
                                        <div className="flex gap-2">
                                            <button onClick={selectAllPos} className="px-3 py-1 bg-purple-600 text-white rounded-full text-[9px] font-black uppercase shadow-sm">Chọn hết</button>
                                            <button 
                                                onClick={() => {
                                                    setRequestPositions([])
                                                    setSelectedPosIds(new Set())
                                                    setRequestSelection(prev => ({ ...prev, step: 'warehouse', warehouseId: null, aisleId: null, slotId: null, tierId: null }))
                                                }} 
                                                className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-[9px] font-black uppercase"
                                            >Quay lại</button>
                                        </div>
                                    </div>

                                    {loading ? (
                                        <div className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-purple-600" size={32} /></div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {requestPositions.map(pos => {
                                                const isSelected = selectedPosIds.has(pos.id)
                                                return (
                                                    <div 
                                                        key={pos.id} 
                                                        onClick={() => pos.has_goods && togglePosSelection(pos.id)}
                                                        className={`p-4 rounded-3xl border transition-all ${isSelected ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-100' : 'bg-white border-gray-100 shadow-sm'} ${!pos.has_goods && 'opacity-50 grayscale pointer-events-none'}`}
                                                    >
                                                        <div className="flex gap-4 w-full">
                                                            <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 ${isSelected ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                                                                <MapPin size={18} />
                                                                <span className="text-[9px] font-black mt-0.5">{pos.code}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest">LOT: {pos.lot?.code || '---'}</div>
                                                                    {pos.lot?.production_code && (
                                                                        <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[9px] font-black border border-blue-100">
                                                                            LSX: {pos.lot.production_code}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                {pos.lot?.lot_items && pos.lot.lot_items.length > 0 ? (
                                                                    <div className="space-y-2 mt-2">
                                                                        {pos.lot.lot_items.map((li: any, idx: number) => (
                                                                            <div key={idx} className="bg-gray-50/50 p-2 rounded-xl border border-gray-100/50">
                                                                                <div className="flex justify-between items-start gap-2">
                                                                                    <div className="min-w-0 flex-1">
                                                                                        <div className="text-[11px] font-black text-gray-900 leading-tight truncate">{li.products?.name}</div>
                                                                                        <div className="text-[9px] font-bold text-blue-500 mt-0.5 uppercase tracking-tighter">{li.products?.sku}</div>
                                                                                    </div>
                                                                                    <div className="text-right shrink-0">
                                                                                        <div className="text-sm font-black text-gray-900 leading-none">{li.quantity}</div>
                                                                                        <div className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{li.unit}</div>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-[10px] text-gray-300 italic font-medium py-1">Vị trí trống</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="mt-4 flex items-center justify-between pt-3 border-t border-gray-50">
                                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-200'}`}>
                                                                {isSelected && <CheckCircle size={14} />}
                                                            </div>
                                                            {pos.has_goods && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        handleRequestPick([pos.id])
                                                                    }}
                                                                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase shadow-lg shadow-blue-100 active:scale-95"
                                                                >
                                                                    Hạ sảnh
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {selectedPosIds.size > 0 && (
                                        <button 
                                            onClick={() => handleRequestPick(Array.from(selectedPosIds))}
                                            disabled={loading}
                                            className="w-full py-5 bg-purple-600 text-white rounded-[28px] font-black text-base shadow-xl shadow-purple-100 active:scale-95 transition-all flex items-center justify-center gap-3 mt-4"
                                        >
                                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                            XÁC NHẬN LẤY {selectedPosIds.size} PALLET
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="mobile-section-label">Lệnh xuất kho ({tasks.length})</div>

                            {loading && tasks.length === 0 ? (
                                <div className="mobile-loading">
                                    <Loader2 size={32} className="animate-spin text-blue-600" />
                                    <span className="text-gray-400 text-sm font-semibold mt-2">Đang tải...</span>
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="mobile-empty">
                                    <div className="mobile-empty-icon"><FileText size={36} /></div>
                                    <p className="text-gray-600 font-bold text-lg">Không có lệnh nào</p>
                                    <p className="text-gray-400 text-sm mt-1">Nhấn "Tải lại" để cập nhật</p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {tasks.map(task => (
                                        <button key={task.id} onClick={() => selectTask(task)} className="mobile-card group active:scale-95 transition-all">
                                            <div className="flex items-center justify-between p-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${task.status === 'Completed' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        <FileText size={22} />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-base font-black text-gray-900 leading-tight">{task.code}</div>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Clock size={10} className="text-gray-400" />
                                                            <span className="text-[10px] text-gray-400 font-mono">{format(new Date(task.created_at), 'HH:mm dd/MM')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                                                        <span className="text-xs font-black text-gray-600">{task.items_count} LOT</span>
                                                    </div>
                                                    <ChevronRight size={18} className="text-gray-300 group-active:translate-x-1 transition-transform" />
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    }

    // ============ DETAIL VIEW ============
    return (
        <div className="mobile-animate-fade-in pb-24">
            <div className="mobile-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={handleReset} style={{ padding: 8, borderRadius: 999, background: 'none', border: 'none', cursor: 'pointer', color: '#71717a' }}>
                            <ArrowLeft size={22} />
                        </button>
                        <div>
                            <div className="mobile-header-brand">Sarita Workspace</div>
                            <div style={{ fontSize: 20, fontWeight: 900, color: '#18181b' }}>Chi tiết lệnh</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200">
                            <span className="text-xs font-black text-gray-900">{selectedTask?.code}</span>
                        </div>
                    </div>
                </div>

                {/* Progress */}
                <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">Tiến độ công việc</span>
                        <span className="text-xs font-black text-blue-600">{scannedCount}/{totalCount}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500" 
                            style={{ width: totalCount > 0 ? `${(scannedCount / totalCount) * 100}%` : '0%' }} 
                        />
                    </div>
                </div>
            </div>

                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div className="mobile-section-label !mb-0">
                            {detailSelection.step === 'aisle' ? `Chọn Dãy` : 
                             detailSelection.step === 'slot' ? `Chọn Ô (Gộp)` : `Danh sách Pallet`}
                        </div>
                        <button onClick={() => fetchTaskItems(selectedTask!.id)} disabled={loading} className="p-2 text-blue-600 active:rotate-180 transition-all duration-500">
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    {/* Breadcrumbs for Detail */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        {detailSelection.aisleId && (
                            <button 
                                onClick={() => setDetailSelection({ ...detailSelection, step: 'aisle', aisleId: null, slotId: null })}
                                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase border border-blue-100"
                            >
                                Dãy: {groupedZones.find(z => z.id === detailSelection.aisleId)?.name}
                            </button>
                        )}
                        {detailSelection.slotId && (
                            <button 
                                onClick={() => setDetailSelection({ ...detailSelection, step: 'slot', slotId: null })}
                                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase border border-blue-100"
                            >
                                Ô: {groupedZones.find(z => z.id === detailSelection.slotId)?.name}
                            </button>
                        )}
                    </div>

                    {/* Hierarchy Views using groupedZones */}
                    {detailSelection.step === 'aisle' && (
                        <div className="grid grid-cols-2 gap-3">
                            {(() => {
                                const activeAisleIds = new Set<string>()
                                taskItems.forEach(item => {
                                    if (!item.zone_id) return
                                    // Tìm groupedZone cha (Aisle) của item này
                                    let currId: string | null = item.zone_id
                                    while (currId) {
                                        const cid = currId // Local copy for type safety
                                        const gz = groupedZones.find(z => z.id === cid || virtualToRealMap.get(z.id)?.includes(cid))
                                        if (gz) {
                                            const parent = groupedZones.find(p => p.id === gz.parent_id)
                                            if (parent && !parent.parent_id) { activeAisleIds.add(gz.id); break }
                                            currId = gz.parent_id
                                        } else { break }
                                    }
                                })
                                return Array.from(activeAisleIds).sort((a, b) => {
                                    const na = groupedZones.find(z => z.id === a)?.name || ''
                                    const nb = groupedZones.find(z => z.id === b)?.name || ''
                                    return na.localeCompare(nb, undefined, { numeric: true })
                                }).map(id => {
                                    const z = groupedZones.find(x => x.id === id)
                                    const count = taskItems.filter(i => {
                                        let cId: string | null = i.zone_id
                                        while (cId) {
                                            const cid = cId
                                            if (cid === id || virtualToRealMap.get(id)?.includes(cid)) return true
                                            cId = zones.find(zx => zx.id === cid)?.parent_id || null
                                        }
                                        return false
                                    }).length
                                    return (
                                        <button 
                                            key={id} 
                                            onClick={() => setDetailSelection({ ...detailSelection, aisleId: id, step: 'slot' })}
                                            className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm active:scale-95 text-center flex flex-col items-center gap-1"
                                        >
                                            <span className="font-black uppercase text-sm text-gray-900">{z?.name}</span>
                                            <span className="text-[10px] font-bold text-blue-500">{count} mặt hàng</span>
                                        </button>
                                    )
                                })
                            })()}
                        </div>
                    )}

                    {detailSelection.step === 'slot' && (
                        <div className="grid grid-cols-2 gap-3">
                            {(() => {
                                const activeSlotIds = new Set<string>()
                                taskItems.forEach(item => {
                                    if (!item.zone_id || !detailSelection.aisleId) return
                                    let cId: string | null = item.zone_id
                                    while (cId) {
                                        const cid = cId
                                        const gz = groupedZones.find(z => z.id === cid || virtualToRealMap.get(z.id)?.includes(cid))
                                        if (gz && gz.parent_id === detailSelection.aisleId) { activeSlotIds.add(gz.id); break }
                                        cId = zones.find(zx => zx.id === cid)?.parent_id || null
                                    }
                                })
                                return Array.from(activeSlotIds).sort((a, b) => {
                                    const na = groupedZones.find(z => z.id === a)?.name || ''
                                    const nb = groupedZones.find(z => z.id === b)?.name || ''
                                    return na.localeCompare(nb, undefined, { numeric: true })
                                }).map(id => {
                                    const z = groupedZones.find(x => x.id === id)
                                    const count = taskItems.filter(i => {
                                        let cId: string | null = i.zone_id
                                        while (cId) {
                                            const cid = cId
                                            if (cid === id || virtualToRealMap.get(id)?.includes(cid)) return true
                                            cId = zones.find(zx => zx.id === cid)?.parent_id || null
                                        }
                                        return false
                                    }).length
                                    return (
                                        <button 
                                            key={id} 
                                            onClick={() => setDetailSelection({ ...detailSelection, slotId: id, step: 'items' })}
                                            className="p-5 bg-white rounded-3xl border border-gray-100 shadow-sm active:scale-95 text-center flex flex-col items-center gap-1"
                                        >
                                            <span className="font-black uppercase text-sm text-gray-900">{z?.name}</span>
                                            <span className="text-[10px] font-bold text-blue-500">{count} mặt hàng</span>
                                        </button>
                                    )
                                })
                            })()}
                            <button onClick={() => setDetailSelection({ ...detailSelection, step: 'aisle', aisleId: null })} className="p-5 bg-gray-50 rounded-3xl border border-dashed border-gray-300 text-gray-400 text-center font-bold uppercase text-xs">
                                Quay lại
                            </button>
                        </div>
                    )}

                    {detailSelection.step === 'items' && (
                        <div className="flex flex-col gap-3 pb-24">
                            <div className="flex justify-between items-center px-1 mb-1">
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    {selectedDetailItemIds.size > 0 ? `Đã chọn ${selectedDetailItemIds.size}` : 'Chọn các pallet cần hạ'}
                                </div>
                                <button 
                                    onClick={() => {
                                        const currentItems = taskItems.filter(i => {
                                            if (!detailSelection.slotId) return false
                                            let cId: string | null = i.zone_id
                                            while (cId) {
                                                const cid = cId
                                                if (cid === detailSelection.slotId || virtualToRealMap.get(detailSelection.slotId)?.includes(cid)) return true
                                                cId = zones.find(zx => zx.id === cid)?.parent_id || null
                                            }
                                            return false
                                        })
                                        const allSelected = currentItems.every(i => selectedDetailItemIds.has(i.id))
                                        const next = new Set(selectedDetailItemIds)
                                        currentItems.forEach(i => allSelected ? next.delete(i.id) : next.add(i.id))
                                        setSelectedDetailItemIds(next)
                                    }}
                                    className="text-[10px] font-black text-blue-600 uppercase"
                                >
                                    {taskItems.filter(i => {
                                        if (!detailSelection.slotId) return false
                                        let cId: string | null = i.zone_id
                                        while (cId) {
                                            const cid = cId
                                            if (cid === detailSelection.slotId || virtualToRealMap.get(detailSelection.slotId)?.includes(cid)) return true
                                            cId = zones.find(zx => zx.id === cid)?.parent_id || null
                                        }
                                        return false
                                    }).every(i => selectedDetailItemIds.has(i.id)) ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                </button>
                            </div>

                            {taskItems
                                .filter(i => {
                                    if (!detailSelection.slotId) return false
                                    let cId: string | null = i.zone_id
                                    while (cId) {
                                        const cid = cId
                                        if (cid === detailSelection.slotId || virtualToRealMap.get(detailSelection.slotId)?.includes(cid)) return true
                                        cId = zones.find(zx => zx.id === cid)?.parent_id || null
                                    }
                                    return false
                                })
                                .map(item => {
                                    const isPending = item.display_status === 'Pending'
                                    const isExported = item.display_status === 'Exported'
                                    const isHall = item.display_status === 'Moved to Hall'
                                    const isProcessing = processingId === item.id
                                    const isSelected = selectedDetailItemIds.has(item.id)

                                    return (
                                        <div 
                                            key={item.id} 
                                            onClick={() => {
                                                if (!isPending) return
                                                const next = new Set(selectedDetailItemIds)
                                                isSelected ? next.delete(item.id) : next.add(item.id)
                                                setSelectedDetailItemIds(next)
                                            }}
                                            className={`p-4 rounded-3xl border transition-all relative overflow-hidden ${
                                                isExported ? 'bg-green-50 border-green-100 opacity-60' : 
                                                isSelected ? 'bg-blue-600 border-blue-700 shadow-xl scale-[1.02]' :
                                                isPending ? 'bg-white border-gray-100 shadow-sm' : 
                                                'bg-blue-50 border-blue-100'
                                            }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-0 right-0 p-2">
                                                    <CheckCircle2 size={24} className="text-white" />
                                                </div>
                                            )}
                                            
                                            <div className="flex gap-4 w-full">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-white/20 text-white' :
                                                    isExported ? 'bg-green-100 text-green-600' : 
                                                    isPending ? 'bg-gray-100 text-gray-400' : 
                                                    'bg-blue-100 text-blue-600'
                                                }`}>
                                                    {isExported ? <CheckCircle size={22} /> : isPending ? <ArrowDownToLine size={22} /> : <CheckCircle2 size={22} />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className={`text-xs font-black uppercase tracking-widest ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>LOT: {item.lot_code}</div>
                                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${
                                                            isSelected ? 'bg-white/20 border-white/30' : 'bg-gray-100 border-gray-200'
                                                        }`}>
                                                            <MapPin size={8} className={isSelected ? 'text-white' : 'text-gray-400'} />
                                                            <span className={`text-[10px] font-black font-mono ${isSelected ? 'text-white' : 'text-gray-600'}`}>{item.position_name}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`text-[12px] font-black leading-tight mb-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>{item.product_name}</div>
                                                    <div className={`text-[9px] font-bold uppercase tracking-tighter ${isSelected ? 'text-white/80' : 'text-blue-500'}`}>{item.sku}</div>

                                                    {!isPending && (
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isExported ? 'bg-green-200 text-green-800' : 'bg-blue-200 text-blue-800'}`}>
                                                                {isExported ? 'Đã xuất' : isHall ? 'Hạ sảnh' : 'Đổi vị trí'}
                                                            </div>
                                                            <div className="text-[10px] font-bold text-gray-400">
                                                                → {item.current_position_name}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`mt-4 flex items-center justify-between pt-3 border-t ${isSelected ? 'border-white/20' : 'border-gray-50'}`}>
                                                <div className="flex flex-col">
                                                    <div className={`text-sm font-black leading-none ${isSelected ? 'text-white' : 'text-gray-900'}`}>{item.quantity}</div>
                                                    <div className={`text-[10px] font-bold uppercase mt-1 tracking-widest ${isSelected ? 'text-white/60' : 'text-gray-400'}`}>{item.unit}</div>
                                                </div>
                                                
                                                {isPending && activeTab === 'running' && !isSelected && (
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleCheckOff(item)
                                                        }}
                                                        disabled={loading}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[11px] font-black uppercase shadow-lg shadow-blue-100 active:scale-95 flex items-center gap-2"
                                                    >
                                                        {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                                                        Hạ sảnh
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            
                            {/* Sticky Action Bar for Detail Multi-Select */}
                            {selectedDetailItemIds.size > 0 && (
                                <div className="fixed bottom-24 left-4 right-4 z-50">
                                    <button 
                                        onClick={() => {
                                            const itemsToProcess = taskItems.filter(i => selectedDetailItemIds.has(i.id))
                                            setPendingItems(itemsToProcess)
                                            setIsSelectHallOpen(true)
                                        }}
                                        disabled={loading}
                                        className="w-full bg-blue-700 text-white p-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-blue-200 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                                    >
                                        <ArrowDownToLine size={20} />
                                        Hạ sảnh {selectedDetailItemIds.size} mặt hàng
                                    </button>
                                </div>
                            )}

                            <button onClick={() => setDetailSelection({ ...detailSelection, step: 'slot', slotId: null })} className="p-5 bg-gray-50 rounded-3xl border border-dashed border-gray-300 text-gray-400 text-center font-bold uppercase text-xs mt-2">
                                Quay lại chọn Ô
                            </button>
                        </div>
                    )}
                </div>

            <SelectHallModal isOpen={isSelectHallOpen} onClose={() => setIsSelectHallOpen(false)} onConfirm={handleMoveToHall} zones={zones} />
        </div>
    )
}
