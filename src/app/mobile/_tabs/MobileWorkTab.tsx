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

    useEffect(() => { 
        if (activeTab !== 'request') {
            fetchTasks()
        }
        fetchZones() 
    }, [activeTab, currentSystem])

    async function fetchZones() {
        if (!currentSystem?.code) return
        // Fetch zones
        const { data: rawZones } = await supabase.from('zones').select('*').eq('system_type', currentSystem.code)
        if (!rawZones) return
        setZones(rawZones)

        // Fetch all zone_positions để groupWarehouseData có thể gom ô
        const allZoneIds = rawZones.map(z => z.id)
        const { data: zpData } = await supabase
            .from('zone_positions' as any)
            .select('position_id, zone_id')
            .in('zone_id', allZoneIds) as any

        // Tạo danh sách positions giả (chỉ cần id + zone_id) cho groupWarehouseData
        const pseudoPositions = ((zpData || []) as any[]).map((zp: any) => ({
            id: zp.position_id,
            zone_id: zp.zone_id
        }))

        // Chạy groupWarehouseData giống trang sơ đồ kho
        const result = groupWarehouseData(rawZones as any, pseudoPositions as any)
        setGroupedZones(result.zones || rawZones)
        setVirtualToRealMap(result.virtualToRealMap || new Map())
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
          positions!export_task_items_position_id_fkey (code), products (name, sku)`)
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

                return {
                    id: item.id, lot_id: item.lots?.id || item.lot_id, 
                    lot_code: item.lots?.code || 'N/A',
                    production_code: item.lots?.production_code,
                    position_id: item.position_id, position_name: originalPosCode, current_position_name: currentPosCode,
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
    }

    async function handleCheckOff(item: TaskItem) {
        if (loading || item.scanned) return
        
        // Logic hạ sảnh
        setPendingLotId(item.lot_id)
        setPendingPositionId(item.position_id)
        setPendingItemId(item.id)
        setIsSelectHallOpen(true)
    }

    async function handleMoveToHall(hallId: string) {
        setIsSelectHallOpen(false)
        if (!pendingLotId || !pendingItemId) return
        
        setLoading(true)
        setProcessingId(pendingItemId)
        try {
            // 1. Kiểm tra vị trí hiện tại của LOT
            const { data: currentPos, error: posError } = await supabase
                .from('positions')
                .select('id')
                .eq('lot_id', pendingLotId)
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
                showToast('Không còn vị trí trống trong Sảnh!', 'error')
                return 
            }

            const targetPositionId = availablePositions[0].position_id as string

            // 3. Thực hiện di chuyển (giải phóng cũ, gán mới)
            if (currentPos) {
                await (supabase.from('positions') as any).update({ lot_id: null }).eq('id', (currentPos as any).id)
            }
            
            const { error: updateError } = await (supabase.from('positions') as any).update({ lot_id: pendingLotId }).eq('id', targetPositionId)
            if (updateError) throw updateError

            showToast(`Đã hạ sảnh thành công!`, 'success')
            if (selectedTask) await fetchTaskItems(selectedTask.id, true)
        } catch (error: any) { 
            showToast('Lỗi hạ sảnh: ' + error.message, 'error') 
        } finally { 
            setLoading(false)
            setProcessingId(null)
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

    const handleZoneClick = (z: any) => {
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

        // Luôn thử tải pallet của zone vừa chọn để hỗ trợ gộp ô/dãy
        fetchPositionsInZone(z.id)
    }

    const scannedCount = taskItems.filter(i => i.scanned).length
    const totalCount = taskItems.length

    // Hierarchy Helpers - Dùng groupedZones (đã gom ô) thay vì zones thô
    const warehouses = groupedZones.filter(z => !z.parent_id)
    const aisles = requestSelection.warehouseId ? groupedZones.filter(z => z.parent_id === requestSelection.warehouseId) : []
    const slots = requestSelection.aisleId ? groupedZones.filter(z => z.parent_id === requestSelection.aisleId) : []
    const tiers = requestSelection.slotId ? groupedZones.filter(z => z.parent_id === requestSelection.slotId) : []

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
                                            setRequestSelection({ ...requestSelection, slotId: z.id, step: hasTiers ? 'tier' : 'pallets' })
                                            // Luôn fetch positions khi chọn Ô (gom ô sẽ lấy hết vị trí con)
                                            fetchPositionsInZone(z.id)
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
                                                        <div className="flex items-start justify-between">
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
                                                            {pos.has_goods && (
                                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ml-2 ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-200'}`}>
                                                                    {isSelected && <CheckCircle size={14} />}
                                                                </div>
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

            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="mobile-section-label !mb-0">Danh sách LOT ({totalCount})</div>
                    <button onClick={() => fetchTaskItems(selectedTask!.id)} disabled={loading} className="p-2 text-blue-600 active:rotate-180 transition-all duration-500">
                        <RotateCcw size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    {taskItems.map(item => {
                        const isPending = item.display_status === 'Pending'
                        const isExported = item.display_status === 'Exported'
                        const isHall = item.display_status === 'Moved to Hall'
                        const isChanged = item.display_status === 'Changed Position'
                        const isProcessing = processingId === item.id

                        return (
                            <div key={item.id} className={`p-4 rounded-3xl border transition-all ${isExported ? 'bg-green-50 border-green-100' : isPending ? 'bg-white border-gray-100 shadow-sm' : 'bg-blue-50 border-blue-100'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex gap-3 flex-1 min-width-0">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isExported ? 'bg-green-100 text-green-600' : isPending ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}>
                                            {isExported ? <CheckCircle size={20} /> : isPending ? <ArrowDownToLine size={20} /> : <CheckCircle2 size={20} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-sm font-black font-mono tracking-tight ${isPending ? 'text-gray-900' : isExported ? 'text-green-700' : 'text-blue-700'}`}>
                                                    {item.lot_code}
                                                </span>
                                                <div className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200">
                                                    <MapPin size={8} className="text-gray-400" />
                                                    <span className="text-[10px] font-black text-gray-600 font-mono">{item.position_name}</span>
                                                </div>
                                            </div>
                                            <div className="text-[11px] text-gray-400 mt-1 truncate">
                                                <span className="font-bold text-gray-600">{item.sku}</span> — {item.product_name}
                                            </div>

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
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="text-right">
                                            <div className="text-base font-black text-gray-900 leading-none">{item.quantity}</div>
                                            <div className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">{item.unit}</div>
                                        </div>
                                        
                                        {isPending && activeTab === 'running' && (
                                            <button 
                                                onClick={() => handleCheckOff(item)}
                                                disabled={loading}
                                                className="mt-1 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-blue-100 active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={14} />}
                                                Hạ sảnh
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <SelectHallModal isOpen={isSelectHallOpen} onClose={() => setIsSelectHallOpen(false)} onConfirm={handleMoveToHall} zones={zones} />
        </div>
    )
}
