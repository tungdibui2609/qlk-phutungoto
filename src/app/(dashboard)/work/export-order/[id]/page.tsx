'use client'

import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react'
import { FileText, ArrowLeft, Loader2, Printer, Trash2, CheckCircle2, RotateCcw, X, ArrowDownToLine, PackageMinus, BarChart3, Calendar, Undo2, LockOpen, PackageCheck, ShieldAlert } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { ExportMapList } from '@/components/export/ExportMapList'
import { useSystem } from '@/contexts/SystemContext'
import { LotDetailsModal } from '@/components/warehouse/lots/LotDetailsModal'
import { QrCodeModal } from '@/app/(dashboard)/warehouses/lots/_components/QrCodeModal'
import { SelectHallModal } from '@/components/warehouse/map/SelectHallModal'
import { QuickBulkExportModal } from '@/components/warehouse/map/QuickBulkExportModal'
import { ExportOrderStatsModal } from '@/components/export/ExportOrderStatsModal'
import { TagDisplay } from '@/components/lots/TagDisplay'
import { logActivity } from '@/lib/audit'
import { BulkEditLotDatesModal } from '@/components/export/BulkEditLotDatesModal'
import { lotService } from '@/services/warehouse/lotService'

interface ExportOrderItem {
    id?: string
    lot_code: string
    position_name: string
    product_name: string
    sku: string
    quantity: number
    unit: string
    lot_id?: string
    position_id?: string
    product_id?: string
    status: 'Pending' | 'Picked' | 'Exported'
    notes?: string | null
    product_image?: string | null
    lot_inbound_date?: string | null
    display_status?: 'Pending' | 'Exported' | 'Picked' | 'Moved to Hall' | 'Changed Position'
    current_position_name?: string
    is_hall?: boolean
    priority?: number | null
    zone_path?: string[]
    full_position_path?: string | null
    lot_tags?: { tag: string; lot_item_id: string | null }[] | null
    part_number?: string | null
    exported_quantity?: number | null
    metadata?: any
}

interface ExportTask {
    id: string
    code: string
    status: 'Pending' | 'In Progress' | 'Picked' | 'Completed' | 'Cancelled'
    created_at: string
    created_by_name?: string | null
    items_count?: number
    notes?: string | null
    items?: ExportOrderItem[]
}

function ExportOrderDetailContent() {
    const params = useParams()
    const router = useRouter()
    const { showToast, showConfirm } = useToast()
    const { currentSystem } = useSystem()
    const [task, setTask] = useState<ExportTask | null>(null)
    const [loading, setLoading] = useState(true)

    // UI states for Map Interaction
    const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(new Set())
    const [viewingLot, setViewingLot] = useState<any>(null)
    const [isSelectHallOpen, setIsSelectHallOpen] = useState(false)
    const [isBulkExportOpen, setIsBulkExportOpen] = useState(false)
    const [zones, setZones] = useState<any[]>([])
    const [qrLot, setQrLot] = useState<any>(null)
    const [isStatsOpen, setIsStatsOpen] = useState(false)
    const [isEditDatesOpen, setIsEditDatesOpen] = useState(false)
    const [isFinalizing, setIsFinalizing] = useState(false)

    const taskId = params.id as string

    // Ref to always call the latest fetchTaskDetails from realtime callbacks
    const fetchRef = useRef<() => void>(() => { })

    useEffect(() => {
        if (taskId) {
            fetchTaskDetails()
            fetchZones()
        }
    }, [taskId])

    // Live updates: subscribe to positions & export_task_items changes
    useEffect(() => {
        fetchRef.current = () => fetchTaskDetails(true) // silent refresh
    })

    useEffect(() => {
        if (!taskId) return

        const channel = supabase
            .channel(`export_order_live_${taskId}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'positions' },
                () => { fetchRef.current() }
            )
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'export_task_items', filter: `task_id=eq.${taskId}` },
                () => { fetchRef.current() }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [taskId])

    async function fetchZones() {
        const { data } = await supabase.from('zones').select('*')
        if (data) setZones(data)
    }

    const aggregatedItems = useMemo(() => {
        const groups: Record<string, {
            sku: string,
            productName: string,
            unit: string,
            totalQuantity: number,
            positionCount: number,
            lotCodes: Set<string>,
        }> = {}

        const selectedItems = task?.items?.filter(item => item.id && selectedPositionIds.has(item.id)) || []

        selectedItems.forEach(item => {
            const sku = item.sku || ''
            const productName = item.product_name || item.lot_code
            const unit = item.unit || ''
            const qty = item.quantity || 0

            const key = `${sku}|${productName}|${unit}`

            if (!groups[key]) {
                groups[key] = {
                    sku,
                    productName,
                    unit,
                    totalQuantity: 0,
                    positionCount: 0,
                    lotCodes: new Set(),
                }
            }

            groups[key].totalQuantity += qty
            groups[key].positionCount += 1
            if (item.lot_code) groups[key].lotCodes.add(item.lot_code)
        })

        return Object.values(groups)
    }, [task, selectedPositionIds])

    const totalByUnit = useMemo(() => {
        const units: Record<string, number> = {}
        aggregatedItems.forEach(item => {
            units[item.unit] = (units[item.unit] || 0) + item.totalQuantity
        })
        return units
    }, [aggregatedItems])

    async function fetchTaskDetails(silent = false) {
        if (!silent) setLoading(true)
        try {
            const { data, error } = await (supabase
                .from('export_tasks') as any)
                .select(`
                    *,
                    items:export_task_items(
                        id,
                        quantity,
                        exported_quantity,
                        unit,
                        status,
                        priority,
                        position_id,
                        product_id,
                        positions!export_task_items_position_id_fkey (
                            code,
                            zone_positions(zone_id)
                        ),
                        lots (
                            id, 
                            code, 
                            inbound_date, 
                            lot_tags (tag, lot_item_id),
                            positions!positions_lot_id_fkey (
                                code,
                                zone_positions(zone_id)
                            )
                        ),
                        products (name, sku, image_url, part_number)
                    )
                `)
                .eq('id', taskId)
                .single()

            if (error) throw error

            // Fetch zones if not already fetched to use for recursive is_hall check
            let currentZones = zones;
            if (currentZones.length === 0) {
                const { data: zData } = await supabase.from('zones').select('*');
                if (zData) {
                    currentZones = zData;
                    setZones(zData);
                }
            }

            // Deduplicate items to prevent duplicate keys in UI
            const uniqueItems = Array.from(new Map((data.items || []).map((item: any) => [item.id, item])).values())

            const formattedTask: ExportTask = {
                ...data,
                status: data.status as ExportTask['status'],
                created_by_name: 'Admin',
                items_count: uniqueItems.length,
                items: uniqueItems.map((item: any) => {
                    // Original position from export_task_items (when task was created)
                    const originalPosCode = item.positions?.code || 'N/A'
                    const originalPosId = item.position_id

                    let originalZoneId = null
                    if (item.positions?.zone_positions && item.positions.zone_positions.length > 0) {
                        originalZoneId = item.positions.zone_positions[0].zone_id
                    }

                    // Current position of the lot
                    let currentPosCode = originalPosCode
                    let isHall = false

                    if (item.lots?.positions && item.lots?.positions.length > 0) {
                        currentPosCode = item.lots.positions[0].code

                        const zps = item.lots.positions[0].zone_positions
                        const leafZoneId = Array.isArray(zps)
                            ? zps[0]?.zone_id
                            : zps?.zone_id

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

                    function getZonePath(zoneId: string | null): string[] {
                        if (!zoneId) return []
                        const parts: string[] = []
                        let currId = zoneId
                        const seen = new Set()
                        while (currId && !seen.has(currId)) {
                            seen.add(currId)
                            const z = currentZones.find((x: any) => x.id === currId)
                            if (!z) break
                            parts.unshift(z.name)
                            currId = z.parent_id
                        }
                        return parts
                    }

                    const zonePath = getZonePath(originalZoneId)
                    const fullPosPath = zonePath.length > 0 ? `${zonePath.join(' - ')} - ${originalPosCode.includes('-') ? originalPosCode.split('-').pop() : originalPosCode}` : null

                    // Determine display status
                    let displayStatus: ExportOrderItem['display_status'] = item.status === 'Exported' ? 'Exported' : item.status === 'Picked' ? 'Picked' : 'Pending'

                    const isFullyExported = (item.exported_quantity || 0) >= item.quantity - 0.000001
                    const statusVal = isFullyExported ? 'Exported' : (item.metadata?.picks?.length > 0 ? 'Picked' : item.status)

                    if (statusVal === 'Pending' && originalPosCode !== currentPosCode) {
                        displayStatus = isHall ? 'Moved to Hall' : 'Changed Position'
                    } else {
                        displayStatus = statusVal
                    }
                    
                    return {
                        id: item.id,
                        lot_id: item.lots?.id,
                        lot_code: item.lots?.code || 'N/A',
                        lot_inbound_date: item.lots?.inbound_date,
                        position_name: originalPosCode,
                        position_id: originalPosId,
                        current_position_name: currentPosCode,
                        is_hall: isHall,
                        product_name: item.products?.name || 'Sản phẩm không tên',
                        sku: item.products?.sku || 'N/A',
                        product_id: item.product_id,
                        product_image: item.products?.image_url,
                        quantity: item.quantity,
                        exported_quantity: item.exported_quantity ?? null,
                        unit: item.unit,
                        status: item.status || 'Pending',
                        display_status: displayStatus,
                        priority: item.priority || null,
                        zone_path: zonePath,
                        full_position_path: fullPosPath,
                        lot_tags: item.lots?.lot_tags,
                        part_number: item.products?.part_number
                    }
                }).sort((a: any, b: any) => {
                    const posA = a.position_name || ''
                    const posB = b.position_name || ''
                    return posA.localeCompare(posB)
                })
            }

            setTask(formattedTask)
        } catch (error: any) {
            showToast('Không thể tải thông tin lệnh xuất: ' + error.message, 'error')
            router.push('/work/export-order')
        } finally {
            setLoading(false)
        }
    }

    async function handleCompleteTask() {
        if (!await showConfirm('Bạn có chắc chắn muốn đánh dấu lệnh xuất kho này là đã hoàn thành? (Không thể thay đổi danh sách vật tư sau khi đã xuất)')) {
            return
        }

        setLoading(true)
        try {
            const { error } = await (supabase
                .from('export_tasks') as any)
                .update({ status: 'Completed', updated_at: new Date().toISOString() })
                .eq('id', taskId)

            if (error) throw error

            showToast('Lệnh xuất kho đã hoàn thành', 'success')
            fetchTaskDetails()
        } catch (error: any) {
            showToast('Lỗi khi hoàn thành: ' + error.message, 'error')
            setLoading(false)
        }
    }

    async function handleUndoCompleteTask() {
        if (!await showConfirm('Bạn có chắc chắn muốn hủy trạng thái hoàn thành của lệnh xuất kho này? (Lệnh sẽ quay về trạng thái Đang xử lý)')) {
            return
        }

        setLoading(true)
        try {
            const { error } = await (supabase
                .from('export_tasks') as any)
                .update({ status: 'Pending', updated_at: new Date().toISOString() })
                .eq('id', taskId)

            if (error) throw error

            showToast('Đã hủy hoàn thành lệnh xuất kho', 'success')
            fetchTaskDetails()
        } catch (error: any) {
            showToast('Lỗi khi hủy: ' + error.message, 'error')
            setLoading(false)
        }
    }

    async function handleRevokeItemStatus(item: any) {
        if (!await showConfirm(`Bạn có muốn hủy trạng thái "Đã xuất" của mặt hàng ${item.sku}? Mặt hàng sẽ quay về trạng thái "Đã chốt ca" để bạn có thể duyệt xuất lại.`)) {
            return
        }

        setLoading(true)
        try {
            const { error } = await (supabase.from('export_task_items') as any)
                .update({ status: 'Picked' })
                .eq('id', item.id)

            if (error) throw error
            showToast('Đã chuyển trạng thái về "Đã chốt ca"', 'success')
            fetchTaskDetails()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    async function handleFinalizeExport() {
        if (!task || !task.items) return
        
        const pickedItems = task.items.filter(i => i.status === 'Picked')
        if (pickedItems.length === 0) {
            showToast('Không có mặt hàng nào đang ở trạng thái "Đã chốt ca" để xuất kho', 'warning')
            return
        }

        const totalQty = pickedItems.reduce((sum, i) => sum + (i.exported_quantity || 0), 0)
        if (!await showConfirm(`Bạn có chắc chắn muốn DUYỆT XUẤT thực tế ${totalQty} ${pickedItems[0].unit}? Hệ thống sẽ trừ tồn kho và giải phóng vị trí kệ ngay lập tức.`)) {
            return
        }

        setIsFinalizing(true)
        try {
            const errors: string[] = []
            let successCount = 0

            // 1. Tính tổng số lượng mới được nhân viên chốt ca (pick) cho từng loại sản phẩm.
            // Vì Mobile thường gộp các mặt hàng có cùng vị trí/sản phẩm vào 1 row để điền.
            const sumPicksByProduct: Record<string, number> = {}
            for (const item of pickedItems) {
                const picks = item.metadata?.picks || []
                const pickQty = picks.reduce((sum: number, p: any) => sum + p.qty, 0)
                if (pickQty > 0) {
                    const groupKey = item.product_id || item.sku || 'unknown'
                    sumPicksByProduct[groupKey] = (sumPicksByProduct[groupKey] || 0) + pickQty
                }
            }

            // 2. Chạy từ trên xuống dưới (đúng y nguyên List hiển thị) - CUỐN CHIẾU THEO ITEM LỆNH
            const itemsList = task.items || [] // Dùng list gốc của task, không sort fifo

            // Chỉ duyệt những item đang ở trạng thái Cần duyệt (Picked hoặc Pending nhưng có xuất chưa đủ)
            for (const item of itemsList) {
                const groupKey = item.product_id || item.sku || 'unknown'
                let remainingToDistribute = sumPicksByProduct[groupKey] || 0
                
                // Nếu sản phẩm này không có số lượng nào được nhân viên cập nhật thêm, bỏ qua dòng này
                if (remainingToDistribute <= 0) continue

                // Số lượng tối đa dòng LỆNH này còn cần = Tổng y/c - Lượng đã xuất cũ
                const currentExported = item.exported_quantity || 0
                const itemCapacity = Math.max(0, item.quantity - currentExported)

                if (itemCapacity <= 0.000001) {
                    // Dòng này đã xuất đủ trước đó, bỏ qua để dồn cho dòng dưới
                    continue
                }

                // Chốt lấy lượng take (ít hơn hoặc bằng số cần)
                const takeFromThisLine = Math.min(remainingToDistribute, itemCapacity)
                
                // ===== TRỪ KHO =====
                const { data: latestLot, error: lotErr } = await supabase
                    .from('lots')
                    .select('*, lot_items(*)')
                    .eq('id', item.lot_id!)
                    .single()

                if (lotErr || !latestLot) {
                    errors.push(`Không tìm thấy nguyên liệu trong Lô: ${item.lot_code}`)
                    continue
                }

                const lot = latestLot as any
                // TÌM KIẾM LINH HOẠT TRONG LÔ (Tránh lỗi lệch SKU của CSDL cũ)
                let matchingLotItem = null
                if (lot.lot_items.length === 1) {
                    // Nếu Lô chỉ có 1 mặt hàng, mặc định lấy nó luôn
                    matchingLotItem = lot.lot_items[0]
                } else {
                    // Lô nhiều mặt hàng, tìm chính xác theo product_id
                    matchingLotItem = lot.lot_items.find((li: any) => li.product_id === item.product_id)
                }

                if (!matchingLotItem || matchingLotItem.quantity < takeFromThisLine - 0.000001) {
                    errors.push(`Mặt hàng ở vị trí ${item.position_name} lô ${item.lot_code} không đủ tồn kho (Cần: ${takeFromThisLine}, Có: ${matchingLotItem?.quantity || 0})`)
                    continue
                }

                const remainingInLotItem = matchingLotItem.quantity - takeFromThisLine
                
                if (remainingInLotItem <= 0.000001) {
                    await (supabase.from('lot_items') as any).delete().eq('id', matchingLotItem.id)
                } else {
                    await (supabase.from('lot_items') as any).update({ quantity: remainingInLotItem }).eq('id', matchingLotItem.id)
                }

                const totalLotQty = lot.quantity - takeFromThisLine
                const newMetadata = await lotService.addExportToHistory({
                    supabase,
                    lotId: lot.id,
                    originalMetadata: lot.metadata,
                    exportData: {
                        id: crypto.randomUUID(),
                        customer: 'Duyệt lệnh ' + task.code,
                        description: `Duyệt xuất kho ca lấy hàng. ${remainingInLotItem > 0 ? '(Còn dư vị trí)' : '(Sạch kho)'}`,
                        location_code: item.position_name,
                        items: {
                            [matchingLotItem.id]: {
                                product_id: matchingLotItem.product_id, // Lấy ID thực tế trong Lot để an toàn
                                product_sku: item.sku,
                                exported_quantity: takeFromThisLine,
                                unit: item.unit
                            }
                        }
                    }
                })

                await (supabase.from('lots') as any).update({
                    quantity: Math.max(0, totalLotQty),
                    metadata: newMetadata,
                    status: totalLotQty <= 0.000001 ? 'exported' : lot.status
                }).eq('id', lot.id)

                // CẬP NHẬT TRẠNG THÁI lệnh ITEM
                const newTotalExported = currentExported + takeFromThisLine
                const newItemStatus = newTotalExported >= item.quantity - 0.000001 ? 'Exported' : 'Pending'
                
                const currentMetadata = item.metadata || {}
                const currentPicks = currentMetadata.picks || []
                const oldProcessed = currentMetadata.processed_picks || []
                
                // Mặc định dòng này đã gánh takeFromThisLine, nếu Mobile có rải thừa thì ta xóa sạch, chỉ ghi log
                const updatedItemMetadata = {
                    ...currentMetadata,
                    picks: [],
                    processed_picks: [...oldProcessed, ...currentPicks]
                }

                await (supabase.from('export_task_items') as any).update({
                    status: newItemStatus,
                    exported_quantity: newTotalExported,
                    metadata: updatedItemMetadata
                }).eq('id', item.id)

                if (totalLotQty <= 0.000001) {
                    // Lấy danh sách position IDs trước khi clear (để ghi audit log)
                    const { data: affectedPositions } = await supabase
                        .from('positions')
                        .select('id')
                        .eq('lot_id', lot.id)

                    await (supabase.from('positions') as any).update({ lot_id: null }).eq('lot_id', lot.id)

                    // Ghi audit log cho từng vị trí đã bị xóa LOT
                    if (affectedPositions && affectedPositions.length > 0) {
                        for (const pos of affectedPositions as any[]) {
                            await logActivity({
                                supabase,
                                tableName: 'positions',
                                recordId: pos.id,
                                action: 'UPDATE',
                                oldData: { lot_id: lot.id },
                                newData: { lot_id: null },
                                systemCode: currentSystem?.code || ''
                            })
                        }
                    }
                }

                await logActivity({
                    supabase,
                    tableName: 'lots',
                    recordId: lot.id,
                    action: 'UPDATE',
                    oldData: { quantity: lot.quantity },
                    newData: { quantity: totalLotQty },
                    systemCode: currentSystem?.code || ''
                })
                
                // Cập nhật lại số lượng có thể rải cho dòng Lệnh TIẾP THEO ở bên dưới
                sumPicksByProduct[groupKey] -= takeFromThisLine
                successCount++
            }

            if (errors.length > 0) {
                showToast(`Đã duyệt ${successCount} mục. Lỗi: ${errors.join(', ')}`, 'warning')
            } else {
                showToast(`Đã duyệt dứt điểm thành công ${successCount} mặt hàng`, 'success')
            }

            // Kiểm tra xem đã hoàn thành hết chưa để đóng lệnh
            const { data: checkItems } = await (supabase.from('export_task_items') as any).select('status').eq('task_id', taskId)
            if (checkItems && (checkItems as any[]).every(i => i.status === 'Exported')) {
                 await (supabase.from('export_tasks') as any).update({ status: 'Completed' }).eq('id', taskId)
                 showToast('Lệnh xuất đã hoàn thành!', 'success')
            }

            fetchTaskDetails()
        } catch (error: any) {
            showToast('Lỗi hệ thống khi duyệt: ' + error.message, 'error')
        } finally {
            setIsFinalizing(false)
        }
    }

    async function handleUnlockPicks() {
        if (!task || !task.items) return
        const pickedItems = task.items.filter(i => i.status === 'Picked')
        
        // Cho phép mở chốt nếu có item bị khóa HOẶC task đang ở trạng thái In Progress
        if (pickedItems.length === 0 && task.status !== 'In Progress') {
            showToast('Lệnh này hiện không bị khóa chốt', 'info')
            return
        }

        if (!await showConfirm('Mở lại chốt ca sẽ đưa lệnh về trạng thái "Chờ xử lý" và cho phép nhân viên vận hành sửa đổi. Bạn có chắc chắn?')) {
            return
        }

        setLoading(true)
        try {
            // 1. Mở khóa các item đang ở trạng thái Picked
            if (pickedItems.length > 0) {
                const idsToUnlock = pickedItems.map(i => i.id).filter(Boolean) as string[]
                const { error: itemError } = await (supabase
                    .from('export_task_items') as any)
                    .update({ status: 'Pending' })
                    .in('id', idsToUnlock)

                if (itemError) throw itemError
            }

            // 2. Luôn đưa task status về Pending để lệnh xuất hiện lại ở danh sách "Chờ xử lý" của nhân viên
            const { error: taskError } = await (supabase
                .from('export_tasks') as any)
                .update({ status: 'Pending' })
                .eq('id', task.id)

            if (taskError) throw taskError

            showToast('Đã mở khóa lệnh và đưa về trạng thái "Chờ xử lý"', 'success')
            fetchTaskDetails()
        } catch (error: any) {
            showToast('Lỗi khi mở khóa: ' + error.message, 'error')
            setLoading(false)
        }
    }

    async function handleMoveToHall(hallId: string) {
        setIsSelectHallOpen(false)
        if (selectedPositionIds.size === 0) return

        // Lấy tất cả các lot IDs cần di chuyển
        const lotIdsToMove = new Set<string>()
        const selectedItems = task?.items?.filter(item => selectedPositionIds.has(item.id || '')) || []
        selectedItems.forEach(item => {
            if (item.lot_id) lotIdsToMove.add(item.lot_id)
        })

        if (lotIdsToMove.size === 0) return

        setLoading(true)
        try {
            // Tìm các zone con của Sảnh
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

            // Tìm các vị trí trống
            const { data: availablePositions, error: availError } = await (supabase
                .from('zone_positions') as any)
                .select('position_id, zone_id, positions!inner(id, lot_id)')
                .is('positions.lot_id', null)
                .in('zone_id', Array.from(targetZoneIds))
                .limit(lotIdsToMove.size)

            if (availError || !availablePositions || availablePositions.length < lotIdsToMove.size) {
                showToast(`Không đủ vị trí trống trong Sảnh này. Cần ${lotIdsToMove.size}, nhưng chỉ còn ${availablePositions?.length || 0} vị trí.`, 'error')
                setLoading(false)
                return
            }

            const lotsArr = Array.from(lotIdsToMove)
            // Lấy position_id hiện tại của các lot (để xóa lot_id ở đó)
            const oldPosIdsToClear = selectedItems.filter(i => i.lot_id && i.position_id).map(i => i.position_id!)

            const updates: { id: string, lot_id: string | null }[] = []
            oldPosIdsToClear.forEach(id => updates.push({ id, lot_id: null }))

            for (let i = 0; i < lotsArr.length; i++) {
                updates.push({ id: availablePositions[i].position_id as string, lot_id: lotsArr[i] })
            }

            const updatePromises = updates.map(u =>
                (supabase.from('positions') as any).update({ lot_id: u.lot_id }).eq('id', u.id)
            )
            const results = await Promise.all(updatePromises)
            const hasError = results.some(r => r.error)

            if (!hasError) {
                // Log all movements
                for (const u of updates) {
                    await logActivity({
                        supabase,
                        tableName: 'positions',
                        recordId: u.id,
                        action: 'UPDATE',
                        oldData: { lot_id: u.lot_id ? null : oldPosIdsToClear.includes(u.id) ? 'some_lot' : null }, // approximation for old data in bulk
                        newData: { lot_id: u.lot_id },
                        systemCode: currentSystem?.code
                    })
                }
            }

            if (hasError) {
                showToast('Hạ sảnh có lỗi xảy ra. Đang làm mới dữ liệu.', 'warning')
            } else {
                showToast('Đã hạ sảnh thành công!', 'success')
                setSelectedPositionIds(new Set())
            }
            fetchTaskDetails()
        } catch (error: any) {
            showToast('Lỗi khi hạ sảnh: ' + error.message, 'error')
            fetchTaskDetails()
        }
    }

    async function toggleItemStatus(itemId: string, currentStatus: string) {
        if (!task) return
        const newStatus = currentStatus === 'Pending' ? 'Exported' : 'Pending'

        // Optimistic update
        setTask(prev => {
            if (!prev) return null
            return {
                ...prev,
                items: prev.items?.map(i => i.id === itemId ? { ...i, status: newStatus } : i)
            }
        })

        try {
            const { error } = await (supabase
                .from('export_task_items') as any)
                .update({ status: newStatus })
                .eq('id', itemId)

            if (error) throw error
        } catch (error: any) {
            showToast('Lỗi cập nhật trạng thái: ' + error.message, 'error')
            fetchTaskDetails()
        }
    }

    async function handleDeleteTask() {
        const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa lệnh xuất kho này?')
        if (!confirmed) return

        try {
            // Fetch the task and items before deletion to log it
            const { data: oldTask } = await supabase
                .from('export_tasks')
                .select('*, export_task_items(*)')
                .eq('id', taskId)
                .single()

            const { error } = await supabase.from('export_tasks').delete().eq('id', taskId)
            if (error) throw error

            // Log the deletion action
            if (oldTask) {
                await logActivity({
                    supabase,
                    tableName: 'export_tasks',
                    recordId: taskId,
                    action: 'DELETE',
                    oldData: oldTask,
                    systemCode: currentSystem?.code || null
                })
            }

            showToast('Đã xóa lệnh thành công', 'success')
            router.push('/work/export-order')
        } catch (error: any) {
            showToast(error.message, 'error')
        }
    }

    async function fetchFullLotDetails(lotCode: string) {
        try {
            const { data, error } = await supabase
                .from('lots')
                .select(`*, created_at, suppliers(name), qc_info(name), lot_items(id, quantity, unit, products(name, sku, unit)), positions!positions_lot_id_fkey(code), lot_tags(tag, lot_item_id)`)
                .eq('code', lotCode)
                .single()
            if (error) throw error
            setViewingLot(data)
        } catch (error: any) {
            console.error('Error fetching lot details:', error)
            showToast('Không thể tải chi tiết LOT: ' + error.message, 'error')
        }
    }

    const handlePositionSelect = (itemId: string) => {
        setSelectedPositionIds(prev => {
            const next = new Set(prev)
            if (next.has(itemId)) next.delete(itemId)
            else next.add(itemId)
            return next
        })
    }

    const handleBulkSelect = (ids: string[], shouldSelect: boolean) => {
        setSelectedPositionIds(prev => {
            const next = new Set(prev)
            ids.forEach(id => {
                if (shouldSelect) next.add(id)
                else next.delete(id)
            })
            return next
        })
    }

    const isModuleEnabled = useMemo(() => {
        return (moduleId: string) => {
            if (!currentSystem) return true
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        )
    }

    if (!task) return null

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-900/50 p-2 md:p-4 space-y-6 w-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/work/export-order')}
                        className="p-2 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-colors border border-transparent hover:border-stone-200 dark:hover:border-zinc-700"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-stone-900 dark:text-white flex items-center gap-3">
                            <FileText className="text-blue-600" size={28} />
                            {task.code}
                        </h1>
                        <div className="text-sm text-stone-500 dark:text-zinc-400 flex items-center gap-2 mt-1">
                            <span>Tạo bởi: <span className="font-bold text-stone-700 dark:text-zinc-300">{task.created_by_name}</span></span>
                            <span>•</span>
                            <span className="font-mono">{format(new Date(task.created_at), 'HH:mm:ss dd/MM/yyyy')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsStatsOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                    >
                        <BarChart3 size={16} />
                        Thống kê
                    </button>
                    <button
                        onClick={() => window.open(`/print/export-order?id=${task.id}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                    >
                        <Printer size={16} />
                        In phiếu
                    </button>
                    {task.status !== 'Completed' && task.status !== 'Cancelled' && (
                        <div className="flex items-center gap-2">
                            {(task.items?.some(i => i.status === 'Picked') || task.status === 'In Progress') && (
                                <>
                                    <button
                                        onClick={handleUnlockPicks}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-sm font-bold rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                                        title="Mở khóa để nhân viên kho sửa lại lượt lấy"
                                    >
                                        <LockOpen size={16} />
                                        Mở chốt
                                    </button>
                                    <button
                                        onClick={handleFinalizeExport}
                                        disabled={loading || isFinalizing || !task.items?.some(i => i.status === 'Picked')}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-md hover:bg-blue-700 transition-all transform active:scale-95 disabled:opacity-50"
                                    >
                                        {isFinalizing ? <Loader2 size={16} className="animate-spin" /> : <PackageCheck size={16} />}
                                        Duyệt Xuất Kho
                                    </button>
                                </>
                            )}
                            <button
                                onClick={handleCompleteTask}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-colors"
                            >
                                <CheckCircle2 size={16} />
                                Hoàn thành
                            </button>
                        </div>
                    )}
                    {task.status === 'Completed' && (
                        <button
                            onClick={handleUndoCompleteTask}
                            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-yellow-700 transition-colors"
                        >
                            <RotateCcw size={16} />
                            Hủy hoàn thành
                        </button>
                    )}
                    <button
                        onClick={handleDeleteTask}
                        className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-stone-50 dark:bg-zinc-800 text-stone-500 text-xs font-bold border-b border-stone-100 dark:border-zinc-700">
                                <th className="px-6 py-4 w-10 text-center">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-stone-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        checked={(task.items?.length || 0) > 0 && task.items!.every((item) => item.id && selectedPositionIds.has(item.id))}
                                        onChange={(e) => {
                                            const ids = task.items?.map(i => i.id).filter(Boolean) as string[]
                                            handleBulkSelect(ids, e.target.checked)
                                        }}
                                        disabled={task.status === 'Completed' || task.status === 'Cancelled'}
                                    />
                                </th>
                                <th className="px-6 py-4 w-10 text-center">#</th>
                                <th className="px-6 py-4">Mã LOT</th>
                                <th className="px-6 py-4">Vị trí</th>
                                <th className="px-6 py-4">Sản phẩm</th>
                                <th className="px-6 py-4 text-right">SL</th>
                                <th className="px-6 py-4 text-right">Đã xuất</th>
                                <th className="px-6 py-4 text-right">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-700">
                            {task.items?.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-6 py-4 text-center">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-stone-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                            checked={item.id ? selectedPositionIds.has(item.id) : false}
                                            onChange={() => item.id && handlePositionSelect(item.id)}
                                            disabled={task.status === 'Completed' || task.status === 'Cancelled'}
                                        />
                                    </td>
                                    <td className="px-6 py-4 text-center text-stone-400 font-mono text-xs">{idx + 1}</td>
                                    <td className="px-6 py-4">
                                        <span className="font-mono text-blue-600 font-medium text-sm">{item.lot_code}</span>
                                        {item.lot_inbound_date && (
                                            <div className="text-[10px] text-stone-400 mt-0.5">
                                                Nhập: {format(new Date(item.lot_inbound_date), 'dd/MM/yy')}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            {item.full_position_path && (
                                                <span className="text-[10px] text-stone-500 font-bold truncate max-w-[200px]" title={item.full_position_path}>
                                                    {item.zone_path?.join(' - ')}
                                                </span>
                                            )}
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 px-2 py-1 rounded text-xs font-bold text-stone-700 dark:text-zinc-300 font-mono">
                                                    {item.full_position_path ? item.position_name.split('-').pop() : item.position_name}
                                                </span>
                                                {item.position_name !== item.current_position_name && (
                                                    <>
                                                        <span className="text-stone-400">➔</span>
                                                        <span className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded text-xs font-bold text-blue-700 dark:text-blue-300 font-mono">
                                                            {item.full_position_path ? item.current_position_name?.split('-').pop() : item.current_position_name}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-stone-800 dark:text-stone-200 text-sm">{item.sku}</span>
                                                <span className="text-stone-400">-</span>
                                                <span className="text-stone-600 dark:text-stone-400 text-sm">{item.product_name}</span>
                                            </div>
                                            {item.lot_tags && item.lot_tags.length > 0 && (
                                                <div className="mt-1 flex items-start">
                                                    <TagDisplay
                                                        tags={item.lot_tags
                                                            .filter(t => !t.tag.startsWith('SPLIT_TO:') && !t.tag.startsWith('MERGED_TO:'))
                                                            .map(t => t.tag)}
                                                        variant="compact"
                                                        placeholderMap={{ '@': item.sku || 'SẢN PHẨM' }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-lg text-stone-900 dark:text-stone-100">{item.quantity}</span> <span className="text-xs text-stone-500 dark:text-stone-400">{item.unit}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {item.exported_quantity !== undefined && item.exported_quantity !== null ? (
                                            <span className="font-bold text-lg text-purple-600 dark:text-purple-400">{item.exported_quantity}</span>
                                        ) : (
                                            <span className="text-stone-400 text-sm">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => item.id && toggleItemStatus(item.id, item.status)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 whitespace-nowrap ${item.display_status === 'Exported'
                                                ? 'bg-purple-100 text-purple-700 border-purple-200 cursor-default'
                                                : item.display_status === 'Picked'
                                                    ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'
                                                    : item.display_status === 'Moved to Hall'
                                                        ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                                                        : item.display_status === 'Changed Position'
                                                            ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                                                            : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200 hover:text-stone-700'
                                                }`}
                                        >
                                            {item.display_status === 'Exported' ? (
                                                <span className="flex items-center justify-center gap-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleRevokeItemStatus(item); }}>
                                                    Đã xuất <Undo2 size={12} className="ml-0.5 text-purple-400 hover:text-purple-600" />
                                                </span>
                                            ) : 
                                                item.display_status === 'Picked' ? 'Đã lấy' :
                                                    item.display_status === 'Moved to Hall' ? 'Hạ sảnh' :
                                                        item.display_status === 'Changed Position' ? 'Đổi vị trí' : 'Chưa hạ'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Warehouse Diagram */}
            {task.items && task.items.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 shadow-sm p-4 md:p-6 overflow-hidden">
                    <h2 className="text-lg font-bold mb-4 border-b border-stone-100 dark:border-zinc-700 pb-2">Sơ đồ vị trí xuất kho</h2>
                    <div className="print:-mx-0 mx-[-0.5rem] md:mx-0 px-[0.5rem] md:px-0 print:px-0">
                        <ExportMapList
                            items={task.items.map(item => ({
                                id: item.id,
                                lot_id: item.lot_id,
                                quantity: item.quantity,
                                unit: item.unit,
                                status: item.status,
                                lot_code: item.lot_code,
                                lot_inbound_date: item.lot_inbound_date,
                                position_name: item.position_name,
                                current_position_name: item.current_position_name,
                                display_status: item.display_status,
                                product_name: item.product_name,
                                sku: item.sku,
                                part_number: item.part_number,
                                zone_path: item.zone_path,
                                lot_tags: item.lot_tags
                            }))}
                            onPositionSelect={handlePositionSelect}
                            selectedIds={selectedPositionIds}
                            onBulkSelect={handleBulkSelect}
                            onViewLotDetails={fetchFullLotDetails}
                            readOnly={task.status === 'Completed' || task.status === 'Cancelled'}
                        />
                    </div>
                </div>
            )}

            {/* Floating Action Bar */}
            {selectedPositionIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-5">
                    <div className="mx-auto w-fit min-w-[320px] max-w-[95vw] px-4 pb-4">
                        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-stone-200 dark:border-zinc-700 overflow-hidden">
                            {/* Action buttons and Selection Info */}
                            <div className="flex items-center gap-2 px-3 py-2 border-b border-stone-100 dark:border-zinc-700">
                                {/* Selection count */}
                                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                                        Đã chọn {selectedPositionIds.size}
                                    </span>
                                </div>

                                <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 mx-1" />

                                {/* Action buttons group */}
                                <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar">
                                    <button
                                        onClick={() => setIsSelectHallOpen(true)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                        title="Hạ sảnh"
                                    >
                                        <ArrowDownToLine size={16} className="group-hover:scale-110 transition-transform" />
                                        <span>Hạ sảnh</span>
                                    </button>

                                    <button
                                        onClick={() => setIsBulkExportOpen(true)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                        title="Xuất khỏi kho"
                                    >
                                        <PackageMinus size={16} className="group-hover:scale-110 transition-transform" />
                                        <span>Xuất khỏi kho</span>
                                    </button>

                                    <button
                                        onClick={() => setIsEditDatesOpen(true)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                        title="Chỉnh sửa ngày LOT"
                                    >
                                        <Calendar size={16} className="group-hover:scale-110 transition-transform" />
                                        <span>Sửa ngày LOT</span>
                                    </button>
                                    <button
                                        onClick={() => setIsBulkExportOpen(true)}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                        title="Xuất nhanh các lô đã chọn"
                                    >
                                        <PackageMinus size={16} className="group-hover:scale-110 transition-transform" />
                                        <span>Xuất kho</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const selectedItems = task?.items?.filter(item => selectedPositionIds.has(item.id || '')) || []
                                            if (selectedItems.length > 0) {
                                                const itemIds = selectedItems.map(item => item.id).join(',')
                                                window.open(`/print/export-lot?export_order_id=${taskId}&item_ids=${itemIds}`, '_blank')
                                            } else {
                                                showToast('Chọn ít nhất 1 vị trí có LOT để in tem', 'warning')
                                            }
                                        }}
                                        className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-all active:scale-95 group whitespace-nowrap"
                                        title="In tem xuất kho (lot đầu tiên)"
                                    >
                                        <Printer size={16} className="group-hover:scale-110 transition-transform" />
                                        <span>In tem</span>
                                    </button>
                                </div>

                                {/* Close button */}
                                <div className="w-px h-5 bg-stone-200 dark:bg-zinc-700 mx-1 shrink-0" />
                                <button
                                    onClick={() => setSelectedPositionIds(new Set())}
                                    className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                                    title="Bỏ chọn tất cả"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Selected items list */}
                            <div className="px-4 py-2 bg-stone-50 dark:bg-zinc-900/50 max-h-40 overflow-y-auto">
                                {/* Summary Header */}
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-stone-100 dark:border-zinc-800">
                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Tổng hợp số lượng:</span>
                                    <div className="flex flex-wrap gap-3">
                                        {Object.entries(totalByUnit).map(([unit, qty], i) => (
                                            <div key={i} className="flex items-center gap-1.5">
                                                <span className="text-sm font-black text-blue-600 dark:text-blue-400 tabular-nums">
                                                    {qty}
                                                </span>
                                                <span className="text-[10px] font-bold text-stone-500 uppercase">
                                                    {unit}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-[minmax(180px,auto)_110px_90px_minmax(120px,1fr)] gap-y-1">
                                    {aggregatedItems.map((item, idx) => {
                                        const codesArray = Array.from(item.lotCodes)

                                        return (
                                            <div key={`${item.sku}-${idx}`} className="contents group">
                                                {/* Column 1: SKU & Product Name */}
                                                <div className="flex items-center gap-1.5 min-w-0 py-1.5 pl-3 bg-white dark:bg-zinc-800 rounded-l-lg border-y border-l border-stone-200 dark:border-zinc-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                                    {item.sku && (
                                                        <span className="shrink-0 px-1 py-0.5 bg-stone-100 dark:bg-zinc-700 text-[10px] text-stone-500 dark:text-zinc-400 rounded font-mono font-bold">
                                                            {item.sku.slice(0, 2)}
                                                        </span>
                                                    )}
                                                    <span className="font-bold text-stone-900 dark:text-white truncate" title={item.productName}>
                                                        {item.productName}
                                                    </span>
                                                </div>

                                                {/* Column 2: Quantity */}
                                                <div className="flex items-center justify-end py-1.5 bg-white dark:bg-zinc-800 border-y border-stone-200 dark:border-zinc-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                                    <span className="text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap">
                                                        {item.totalQuantity} {item.unit}
                                                    </span>
                                                </div>

                                                {/* Column 3: Position Count */}
                                                <div className="flex items-center justify-end py-1.5 bg-white dark:bg-zinc-800 border-y border-stone-200 dark:border-zinc-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                                    <span className="text-stone-400 whitespace-nowrap">
                                                        ({item.positionCount} vị trí)
                                                    </span>
                                                </div>

                                                {/* Column 4: Lot Code */}
                                                <div className="flex items-center justify-end py-1.5 pr-3 bg-white dark:bg-zinc-800 rounded-r-lg border-y border-r border-stone-200 dark:border-zinc-700 group-hover:border-blue-300 dark:group-hover:border-blue-700 transition-colors">
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        {codesArray.length === 1 ? (
                                                            <span className="text-stone-400 font-mono truncate text-[11px]">
                                                                {codesArray[0]}
                                                            </span>
                                                        ) : (
                                                            <span className="text-stone-400 italic truncate text-[11px]">
                                                                {codesArray.length} lô
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <SelectHallModal
                isOpen={isSelectHallOpen}
                onClose={() => setIsSelectHallOpen(false)}
                onConfirm={handleMoveToHall}
                zones={zones}
            />

            {isBulkExportOpen && (
                <QuickBulkExportModal
                    lotIds={Array.from(new Set((task?.items?.filter(item => selectedPositionIds.has(item.id || '')) || []).map(i => i.lot_id).filter(Boolean) as string[]))}
                    lotInfo={(() => {
                        const info: Record<string, any> = {}
                        task?.items?.forEach(item => {
                            if (!item.lot_id) return
                            // Only include task items that are currently selected in the UI
                            if (!selectedPositionIds.has(item.id || '')) return
                            
                            if (!info[item.lot_id]) {
                                info[item.lot_id] = {
                                    code: item.lot_code,
                                    items: [],
                                    positions: [{ code: item.position_name }]
                                }
                            }
                            info[item.lot_id].items.push({
                                task_item_id: item.id,
                                product_name: item.product_name,
                                sku: item.sku,
                                unit: item.unit,
                                quantity: item.quantity
                            })
                        })
                        return info
                    })()}
                    onClose={() => setIsBulkExportOpen(false)}
                    defaultDescription={`Xuất theo lệnh ${task?.code}`}
                    defaultCustomer={(task as any)?.customer_name || ""}
                    onSuccess={async (processedItems) => {
                        setIsBulkExportOpen(false)
                        // Update task items with their actual exported quantity
                        if (processedItems && processedItems.length > 0) {
                            const updatePromises = processedItems.map(p => 
                                (supabase.from('export_task_items') as any)
                                .update({ status: 'Exported', exported_quantity: p.export_qty })
                                .eq('id', p.task_item_id)
                            )
                            await Promise.all(updatePromises)
                        } else {
                            // Fallback mostly unused but keeps typings safe
                            const idsToUpdate = Array.from(selectedPositionIds).filter(id => task?.items?.find(i => i.id === id)?.status !== 'Exported')
                            if (idsToUpdate.length > 0) {
                                await (supabase.from('export_task_items') as any).update({ status: 'Exported' }).in('id', idsToUpdate)
                            }
                        }
                        
                        setSelectedPositionIds(new Set())
                        fetchTaskDetails()
                    }}
                />
            )}

            {viewingLot && (
                <LotDetailsModal
                    lot={viewingLot}
                    onClose={() => setViewingLot(null)}
                    onOpenQr={(lot) => {
                        setQrLot(lot);
                        setViewingLot(null); // Optional: close detail modal when opening QR
                    }}
                    isModuleEnabled={isModuleEnabled}
                />
            )}

            {qrLot && (
                <QrCodeModal
                    lot={qrLot}
                    onClose={() => setQrLot(null)}
                />
            )}

            <ExportOrderStatsModal
                isOpen={isStatsOpen}
                taskCode={task.code}
                exportPositionIds={new Set(task.items?.map(i => i.position_id).filter(Boolean) as string[])}
                exportItemStatuses={(() => {
                    const map: Record<string, string> = {}
                    task.items?.forEach(item => {
                        if (item.position_id && item.display_status) {
                            map[item.position_id] = item.display_status
                        }
                    })
                    return map
                })()}
                exportItemInfoMap={(() => {
                    const map: Record<string, any> = {}
                    task.items?.forEach(item => {
                        if (item.position_id) {
                            map[item.position_id] = {
                                item_id: item.id,
                                lot_code: item.lot_code,
                                product_name: item.product_name,
                                sku: item.sku,
                                quantity: item.quantity,
                                unit: item.unit,
                                display_status: item.display_status,
                                priority: item.priority || undefined
                            }
                        }
                    })
                    return map
                })()}
                onClose={() => setIsStatsOpen(false)}
                onPrioritiesChanged={() => fetchTaskDetails(true)}
            />

            {isEditDatesOpen && (
                <BulkEditLotDatesModal
                    lotIds={Array.from(new Set((task?.items?.filter(item => selectedPositionIds.has(item.id || '')) || []).map(i => i.lot_id).filter(Boolean) as string[]))}
                    lotCodes={Array.from(new Set((task?.items?.filter(item => selectedPositionIds.has(item.id || '')) || []).map(i => i.lot_code).filter(Boolean) as string[]))}
                    onClose={() => setIsEditDatesOpen(false)}
                    onSuccess={() => {
                        setIsEditDatesOpen(false)
                        fetchTaskDetails()
                        setSelectedPositionIds(new Set())
                    }}
                />
            )}
        </div>
    )
}

export default function ExportOrderDetailPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin text-blue-500" size={40} /></div>}>
            <ExportOrderDetailContent />
        </Suspense>
    )
}
