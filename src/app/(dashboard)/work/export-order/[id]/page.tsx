'use client'

import React, { Suspense, useState, useEffect, useMemo } from 'react'
import { FileText, ArrowLeft, Loader2, Printer, Trash2, CheckCircle2, RotateCcw, X, ArrowDownToLine, PackageMinus } from 'lucide-react'
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
    status: 'Pending' | 'Exported'
    notes?: string | null
    product_image?: string | null
    lot_inbound_date?: string | null
    display_status?: 'Pending' | 'Exported' | 'Moved to Hall' | 'Changed Position'
    current_position_name?: string
    is_hall?: boolean
}

interface ExportTask {
    id: string
    code: string
    status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'
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

    const taskId = params.id as string

    useEffect(() => {
        if (taskId) {
            fetchTaskDetails()
            fetchZones()
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

    async function fetchTaskDetails() {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('export_tasks')
                .select(`
                    *,
                    items:export_task_items(
                        id,
                        quantity,
                        unit,
                        status,
                        position_id,
                        positions (code),
                        lots (
                            id, 
                            code, 
                            inbound_date, 
                            positions (
                                code,
                                is_hall:zone_positions(zone_id)
                            )
                        ),
                        products (name, sku, image_url)
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

            const formattedTask: ExportTask = {
                ...data,
                status: data.status as ExportTask['status'],
                created_by_name: 'Admin',
                items_count: data.items?.length || 0,
                items: data.items?.map((item: any) => {
                    // Original position from export_task_items (when task was created)
                    const originalPosCode = item.positions?.code || 'N/A'
                    const originalPosId = item.position_id

                    // Current position of the lot
                    let currentPosCode = originalPosCode
                    let isHall = false

                    if (item.lots?.positions && item.lots?.positions.length > 0) {
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

                    // Determine display status
                    let displayStatus: ExportOrderItem['display_status'] = item.status === 'Exported' ? 'Exported' : 'Pending'
                    if (displayStatus === 'Pending' && originalPosCode !== currentPosCode) {
                        displayStatus = isHall ? 'Moved to Hall' : 'Changed Position'
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
                        product_image: item.products?.image_url,
                        quantity: item.quantity,
                        unit: item.unit,
                        status: item.status || 'Pending',
                        display_status: displayStatus
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
            const { error } = await supabase
                .from('export_tasks')
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
            const { error } = await supabase
                .from('export_tasks')
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
                .from('zone_positions')
                .select('position_id, zone_id, positions!inner(id, lot_id)')
                .is('positions.lot_id', null)
                .in('zone_id', Array.from(targetZoneIds))
                .limit(lotIdsToMove.size) as any)

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

            // DB Updates for move
            const updatePromises = updates.map(u =>
                supabase.from('positions').update({ lot_id: u.lot_id } as any).eq('id', u.id)
            )
            const results = await Promise.all(updatePromises)
            const hasError = results.some(r => r.error)

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
            const { error } = await supabase
                .from('export_task_items')
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
            const { error } = await supabase.from('export_tasks').delete().eq('id', taskId)
            if (error) throw error
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
                .select(`*, created_at, suppliers(name), qc_info(name), lot_items(id, quantity, unit, products(name, sku, unit)), positions(code), lot_tags(tag, lot_item_id)`)
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
                        onClick={() => window.open(`/print/export-order?id=${task.id}`, '_blank')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
                    >
                        <Printer size={16} />
                        In phiếu
                    </button>
                    {task.status !== 'Completed' && task.status !== 'Cancelled' && (
                        <button
                            onClick={handleCompleteTask}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-colors"
                        >
                            <CheckCircle2 size={16} />
                            Hoàn thành
                        </button>
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
                                <th className="px-6 py-4 w-10 text-center">#</th>
                                <th className="px-6 py-4">Mã LOT</th>
                                <th className="px-6 py-4">Vị trí</th>
                                <th className="px-6 py-4">Sản phẩm</th>
                                <th className="px-6 py-4 text-right">SL</th>
                                <th className="px-6 py-4 text-right">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 dark:divide-zinc-700">
                            {task.items?.map((item, idx) => (
                                <tr key={item.id} className="hover:bg-blue-50/20 transition-colors group">
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
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 px-2 py-1 rounded text-xs font-bold text-stone-700 dark:text-zinc-300 font-mono">
                                                {item.position_name}
                                            </span>
                                            {item.position_name !== item.current_position_name && (
                                                <>
                                                    <span className="text-stone-400">➔</span>
                                                    <span className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-2 py-1 rounded text-xs font-bold text-blue-700 dark:text-blue-300 font-mono">
                                                        {item.current_position_name}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-stone-800 dark:text-stone-200 text-sm">{item.sku}</span>
                                                <span className="text-stone-400">-</span>
                                                <span className="text-stone-600 dark:text-stone-400 text-sm">{item.product_name}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="font-bold text-lg text-stone-900">{item.quantity}</span> <span className="text-xs text-stone-500">{item.unit}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => item.id && toggleItemStatus(item.id, item.status)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 whitespace-nowrap ${item.display_status === 'Exported'
                                                ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                                                : item.display_status === 'Moved to Hall'
                                                    ? 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200'
                                                    : item.display_status === 'Changed Position'
                                                        ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200'
                                                        : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200 hover:text-stone-700'
                                                }`}
                                        >
                                            {item.display_status === 'Exported' ? 'Đã xuất' :
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
                                sku: item.sku
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
                            if (!info[item.lot_id]) {
                                info[item.lot_id] = {
                                    code: item.lot_code,
                                    items: [],
                                    positions: [{ code: item.position_name }]
                                }
                            }
                            info[item.lot_id].items.push({
                                product_name: item.product_name,
                                sku: item.sku,
                                unit: item.unit,
                                quantity: item.quantity
                            })
                        })
                        return info
                    })()}
                    onClose={() => setIsBulkExportOpen(false)}
                    onSuccess={async () => {
                        setIsBulkExportOpen(false)
                        // Wait for completion, then mark task items as Exported
                        const idsToUpdate = Array.from(selectedPositionIds).filter(id => task?.items?.find(i => i.id === id)?.status !== 'Exported')
                        if (idsToUpdate.length > 0) {
                            await supabase.from('export_task_items').update({ status: 'Exported' }).in('id', idsToUpdate)
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
