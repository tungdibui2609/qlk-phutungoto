'use client'

import React, { Suspense, useState, useEffect, useMemo } from 'react'
import { FileText, LayoutList, Loader2, Trash2, Printer, CheckCircle, RotateCcw, PackageCheck, XCircle, MapPin, Clock, User } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { CreateExportTaskModal } from '@/components/export/CreateExportTaskModal'
import { logActivity } from '@/lib/audit'

// Types for DB Data
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
    status: string // status for individual item
    notes?: string | null
    // Additional data for display
    product_image?: string
    lot_inbound_date?: string
}

interface ExportTask {
    id: string
    code: string
    status: string
    created_at: string
    created_by_name?: string // Join with user_profiles
    items_count?: number
    notes?: string | null
    items?: ExportOrderItem[]
    created_by?: { full_name: string } | null
    export_task_items?: { count: number }[] | null
}

interface PickRequestGroup {
    key: string
    requested_by: string
    requested_by_name: string
    created_at: string
    requests: Array<{
        id: string
        position_id: string
        position_code: string
        lot_id: string | null
        lot_code: string
        production_code?: string
        items: Array<{ product_name: string; sku: string; quantity: number; unit: string; product_id: string }>
    }>
}

function ExportOrderContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { showToast, showConfirm } = useToast()
    const { currentSystem } = useSystem()

    // State
    const [tasks, setTasks] = useState<ExportTask[]>([])
    const [loading, setLoading] = useState(true)
    const [pickGroups, setPickGroups] = useState<PickRequestGroup[]>([])
    const [loadingPicks, setLoadingPicks] = useState(false)
    const [approvingGroup, setApprovingGroup] = useState<string | null>(null)

    useEffect(() => {
        fetchTasks()
        fetchPickRequests()
    }, [currentSystem])

    // Check for creation params
    const posIds = searchParams.get('posIds')
    const lotIds = searchParams.get('lotIds')

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [createModalData, setCreateModalData] = useState<{
        positionIds: string[]
        lotIds: string[]
        items: any[]
    }>({ positionIds: [], lotIds: [], items: [] })

    useEffect(() => {
        if (posIds || lotIds) {
            fetchExportDetails(posIds, lotIds)
        }
    }, [posIds, lotIds])

    const fetchExportDetails = async (pIds: string | null, lIds: string | null) => {
        try {
            setLoading(true)
            const positionIds = pIds ? pIds.split(',') : []
            const lotIds = lIds ? lIds.split(',') : []

            if (positionIds.length === 0 && lotIds.length === 0) return

            // Fetch lots details to get items
            // We need to fetch positions to know which specific position is selected if needed,
            // but for now let's assume we export based on LOTs found in those positions or direct LOT IDs.

            // Logic:
            // 1. If we have posIds, find their lot_ids
            // 2. Combine with lotIds
            // 3. Fetch detailed lot items

            let finalLotIds = new Set(lotIds)
            let lotToPositionMap: Record<string, string> = {}

            if (positionIds.length > 0) {
                const { data: posData } = await supabase
                    .from('positions')
                    .select('id, lot_id')
                    .in('id', positionIds)

                if (posData) {
                    posData.forEach((p: any) => {
                        if (p.lot_id) {
                            finalLotIds.add(p.lot_id)
                            lotToPositionMap[p.lot_id] = p.id
                        }
                    })
                }
            }

            const uniqueLotIds = Array.from(finalLotIds)
            if (uniqueLotIds.length === 0) {
                showToast('Không tìm thấy LOT nào trong các vị trí đã chọn', 'error')
                return
            }

            // Fetch LOT details
            const { data: lotsData, error } = await supabase
                .from('lots')
                .select(`
                    id, code,
                    lot_items (
                        id, product_id, quantity, unit,
                        products ( name, sku )
                    ),
                    positions!positions_lot_id_fkey (id, code)
                `)
                .in('id', uniqueLotIds)

            if (error) throw error

            // Flatten items
            const items: any[] = []
            lotsData?.forEach((lot: any) => {
                let defaultPositionId = lotToPositionMap[lot.id]
                if (!defaultPositionId && lot.positions && lot.positions.length > 0) {
                    defaultPositionId = lot.positions[0].id
                }

                if (lot.lot_items) {
                    lot.lot_items.forEach((li: any) => {
                        items.push({
                            lot_id: lot.id,
                            product_id: li.product_id,
                            quantity: li.quantity,
                            unit: li.unit,
                            product_name: li.products?.name,
                            sku: li.products?.sku,
                            position_id: defaultPositionId || null
                        })
                    })
                }
            })

            // If we selected positions, we might want to map items to those positions more accurately?
            // But a LOT might be in multiple positions? 
            // Simplified: We export the LOT content.
            // Requirement from user is "Export Order from selected positions".

            setCreateModalData({
                positionIds,
                lotIds: uniqueLotIds,
                items
            })
            setIsCreateModalOpen(true)

        } catch (error: any) {
            console.error(error)
            showToast('Lỗi tải thông tin hàng hóa: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    const fetchTasks = async () => {
        try {
            setLoading(true)
            let query = supabase
                .from('export_tasks')
                .select('*, export_task_items(count)')
                .order('created_at', { ascending: false })
                .limit(500)

            if (currentSystem?.code) {
                query = query.eq('system_code', currentSystem.code)
            }

            const { data: tasksData, error: tasksError } = await query

            if (tasksError) throw tasksError

            // 2. Extract unique creator IDs
            const userIds = Array.from(new Set((tasksData || []).map((t: any) => t.created_by).filter(Boolean)))

            // 3. Fetch user profiles safely
            let userMap: Record<string, string> = {}
            if (userIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('user_profiles')
                    .select('id, full_name')
                    .in('id', userIds as string[])
                if (usersData) {
                    usersData.forEach((u: any) => {
                        userMap[u.id] = u.full_name
                    })
                }
            }

            // 4. Map data
            const formattedTasks: ExportTask[] = (tasksData || []).map((t: any) => {
                const task = t
                return {
                    id: task.id,
                    code: task.code,
                    status: task.status,
                    created_at: task.created_at,
                    notes: task.notes,
                    // Map name from userMap
                    created_by_name: task.created_by ? (userMap[task.created_by] || 'Unknown') : 'Unknown',
                    items_count: task.export_task_items?.[0]?.count || 0
                }
            })

            setTasks(formattedTasks)
        } catch (error) {
            console.error('Error fetching export tasks:', error)
            showToast('Lỗi tải danh sách lệnh xuất', 'error')
        } finally {
            setLoading(false)
        }
    }

    // ========== PICK REQUESTS ==========
    async function fetchPickRequests() {
        if (!currentSystem?.code) return
        setLoadingPicks(true)
        try {
            const { data: rawPicks, error } = await (supabase
                .from('pick_requests' as any) as any)
                .select('*')
                .eq('system_code', currentSystem.code)
                .eq('status', 'Pending')
                .order('created_at', { ascending: false })

            if (error) throw error
            if (!rawPicks || rawPicks.length === 0) { setPickGroups([]); return }

            // Fetch user names
            const userIds = Array.from(new Set(rawPicks.map((p: any) => p.requested_by).filter(Boolean)))
            let userMap: Record<string, string> = {}
            if (userIds.length > 0) {
                const { data: usersData } = await supabase.from('user_profiles').select('id, full_name').in('id', userIds as string[])
                usersData?.forEach((u: any) => { userMap[u.id] = u.full_name })
            }

            // Fetch position details + lot info
            const posIds = rawPicks.map((p: any) => p.position_id)
            const { data: posData } = await supabase
                .from('positions')
                .select(`id, code, lot_id, lots:lots!positions_lot_id_fkey(
                    id, code, production_code,
                    lot_items:lot_items!lot_items_lot_id_fkey(
                        quantity, unit, product_id,
                        products:products!lot_items_product_id_fkey(name, sku)
                    )
                )`)
                .in('id', posIds)

            const posMap: Record<string, any> = {}
            posData?.forEach((p: any) => { posMap[p.id] = p })

            // Group by requested_by + rounded timestamp (10 min window)
            const groups: Record<string, PickRequestGroup> = {}
            rawPicks.forEach((pr: any) => {
                const ts = new Date(pr.created_at)
                const roundedTs = new Date(Math.floor(ts.getTime() / (10 * 60 * 1000)) * (10 * 60 * 1000)).toISOString()
                const key = `${pr.requested_by}_${roundedTs}`

                if (!groups[key]) {
                    groups[key] = {
                        key,
                        requested_by: pr.requested_by,
                        requested_by_name: userMap[pr.requested_by] || 'Không rõ',
                        created_at: pr.created_at,
                        requests: []
                    }
                }

                const pos = posMap[pr.position_id]
                const lot = pos?.lots
                const items = (lot?.lot_items || []).map((li: any) => ({
                    product_name: li.products?.name || '',
                    sku: li.products?.sku || '',
                    quantity: li.quantity,
                    unit: li.unit,
                    product_id: li.product_id
                }))

                groups[key].requests.push({
                    id: pr.id,
                    position_id: pr.position_id,
                    position_code: pos?.code || '---',
                    lot_id: pos?.lot_id || null,
                    lot_code: lot?.code || '---',
                    production_code: lot?.production_code,
                    items
                })
            })

            setPickGroups(Object.values(groups))
        } catch (err: any) {
            console.error('Error fetching pick requests:', err)
        } finally {
            setLoadingPicks(false)
        }
    }

    async function handleApproveGroup(group: PickRequestGroup) {
        setApprovingGroup(group.key)
        try {
            // Prepare data for CreateExportTaskModal
            const positionIds = group.requests.map(r => r.position_id)
            const lotIds = group.requests.map(r => r.lot_id).filter(Boolean) as string[]
            const items = group.requests.flatMap(r => r.items.map(item => ({
                ...item,
                lot_id: r.lot_id,
                position_id: r.position_id
            })))

            setCreateModalData({ positionIds, lotIds, items })
            // Store pick request IDs to update after export task is created
            ;(window as any).__pendingPickRequestIds = group.requests.map(r => r.id)
            setIsCreateModalOpen(true)
        } finally {
            setApprovingGroup(null)
        }
    }

    async function handleRejectGroup(group: PickRequestGroup) {
        const confirmed = await showConfirm(`Từ chối ${group.requests.length} yêu cầu lấy từ ${group.requested_by_name}?`)
        if (!confirmed) return
        try {
            const ids = group.requests.map(r => r.id)
            const { error } = await (supabase.from('pick_requests' as any) as any)
                .update({ status: 'Cancelled' })
                .in('id', ids)
            if (error) throw error
            showToast('Đã từ chối yêu cầu lấy', 'success')
            fetchPickRequests()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        }
    }

    const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()

        const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa lệnh xuất kho này? Hành động này không thể hoàn tác.')

        if (confirmed) {
            try {
                // Fetch the task and items before deletion to log it
                const { data: oldTask } = await supabase
                    .from('export_tasks')
                    .select('*, export_task_items(*)')
                    .eq('id', id)
                    .single()

                // Delete items first (cascade should handle but manual is safer)
                const { error: itemsError } = await supabase
                    .from('export_task_items')
                    .delete()
                    .eq('task_id', id)

                if (itemsError) throw itemsError

                const { error } = await supabase
                    .from('export_tasks')
                    .delete()
                    .eq('id', id)

                if (error) throw error

                // Log the deletion action
                if (oldTask) {
                    await logActivity({
                        supabase,
                        tableName: 'export_tasks',
                        recordId: id,
                        action: 'DELETE',
                        oldData: oldTask,
                        systemCode: currentSystem?.code || null
                    })
                }

                showToast('Đã xóa lệnh xuất kho', 'success')
                fetchTasks()
            } catch (error) {
                console.error('Error deleting task:', error)
                showToast('Không thể xóa lệnh xuất kho', 'error')
            }
        }
    }

    const handleCompleteTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()

        const confirmed = await showConfirm('Xác nhận hoàn thành lệnh xuất kho này?')

        if (confirmed) {
            try {
                const { error } = await (supabase
                    .from('export_tasks') as any)
                    .update({ status: 'Completed' })
                    .eq('id', id)

                if (error) throw error

                showToast('Đã cập nhật trạng thái hoàn thành', 'success')
                fetchTasks()
            } catch (error) {
                console.error('Error completing task:', error)
                showToast('Lỗi cập nhật trạng thái', 'error')
            }
        }
    }

    const handleUndoCompleteTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()

        const confirmed = await showConfirm('Xác nhận hủy hoàn thành lệnh xuất kho này?')

        if (confirmed) {
            try {
                const { error } = await (supabase
                    .from('export_tasks') as any)
                    .update({ status: 'Pending' })
                    .eq('id', id)

                if (error) throw error

                showToast('Đã đưa lệnh xuất về trạng thái chờ xử lý', 'success')
                fetchTasks()
            } catch (error) {
                console.error('Error undoing task completion:', error)
                showToast('Lỗi cập nhật trạng thái', 'error')
            }
        }
    }

    return (
        <div className="p-2 md:p-4 w-full mx-auto space-y-6 pb-24 h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 flex items-center gap-3">
                        <LayoutList className="text-blue-600" />
                        Danh sách Lệnh Xuất Kho
                    </h1>
                    <p className="text-stone-500 dark:text-stone-400 mt-1">Quản lý các yêu cầu xuất hàng từ kho</p>
                </div>
            </div>

            {/* Pick Requests Pending Approval */}
            {pickGroups.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                            <PackageCheck size={20} className="text-amber-600 dark:text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-stone-800 dark:text-stone-100">Yêu cầu lấy chờ duyệt</h2>
                            <p className="text-sm text-stone-500">{pickGroups.reduce((s, g) => s + g.requests.length, 0)} vị trí từ {pickGroups.length} nhóm yêu cầu</p>
                        </div>
                    </div>

                    {loadingPicks ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-amber-500" size={28} /></div>
                    ) : (
                        <div className="grid gap-4">
                            {pickGroups.map(group => (
                                <div key={group.key} className="bg-white dark:bg-zinc-800 rounded-xl border-2 border-amber-200 dark:border-amber-700 shadow-sm overflow-hidden">
                                    {/* Group Header */}
                                    <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-100 dark:border-amber-800">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <User size={16} className="text-amber-600" />
                                                <span className="font-bold text-stone-800 dark:text-stone-200">{group.requested_by_name}</span>
                                                <span className="text-xs text-stone-400 flex items-center gap-1">
                                                    <Clock size={12} />
                                                    {format(new Date(group.created_at), 'HH:mm dd/MM/yyyy')}
                                                </span>
                                                <span className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold px-2 py-0.5 rounded-full">
                                                    {group.requests.length} vị trí
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleApproveGroup(group)}
                                                    disabled={approvingGroup === group.key}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                                >
                                                    {approvingGroup === group.key ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                                    Duyệt
                                                </button>
                                                <button
                                                    onClick={() => handleRejectGroup(group)}
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-zinc-700 text-red-500 border border-red-200 dark:border-red-800 rounded-lg text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                >
                                                    <XCircle size={14} />
                                                    Từ chối
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Request Items */}
                                    <div className="divide-y divide-stone-100 dark:divide-zinc-700">
                                        {group.requests.map(req => (
                                            <div key={req.id} className="p-3 flex items-start gap-3">
                                                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md mt-0.5">
                                                    <MapPin size={14} className="text-blue-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono font-bold text-sm text-stone-800 dark:text-stone-200">{req.position_code}</span>
                                                        <span className="text-xs bg-stone-100 dark:bg-zinc-700 text-stone-500 dark:text-stone-400 px-1.5 py-0.5 rounded font-medium">LOT: {req.lot_code}</span>
                                                        {req.production_code && (
                                                            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">LSX: {req.production_code}</span>
                                                        )}
                                                    </div>
                                                    {req.items.length > 0 ? (
                                                        <div className="mt-1 space-y-0.5">
                                                            {req.items.map((item, idx) => (
                                                                <div key={idx} className="text-xs text-stone-500 dark:text-stone-400 flex items-center justify-between">
                                                                    <span>{item.product_name} <span className="text-stone-400">({item.sku})</span></span>
                                                                    <span className="font-bold text-stone-700 dark:text-stone-300">{item.quantity} {item.unit}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-stone-400 italic mt-0.5">Vị trí trống</div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
            ) : (
                <div className="grid gap-4">
                    {tasks.length === 0 ? (
                        <div className="text-center p-12 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                            <FileText className="mx-auto text-stone-300 mb-4" size={48} />
                            <p className="text-stone-500 font-medium">Chưa có lệnh xuất kho nào</p>
                        </div>
                    ) : (
                        tasks.map((task) => (
                            <div
                                key={task.id}
                                className="bg-white dark:bg-zinc-800 rounded-xl border border-stone-200 dark:border-zinc-700 shadow-sm overflow-hidden hover:shadow-md transition-shadow group"
                            >
                                <div
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-stone-50 dark:hover:bg-zinc-700/50 transition-colors"
                                    onClick={() => router.push(`/work/export-order/${task.id}`)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-full bg-stone-100 text-stone-400">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono tracking-tight">{task.code}</h3>
                                                {format(new Date(), 'yyyy-MM-dd') === format(new Date(task.created_at), 'yyyy-MM-dd') && (
                                                    <span className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Mới</span>
                                                )}
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase
                                                    ${task.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                                        task.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                                            task.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                                                'bg-blue-100 text-blue-700'
                                                    }
                                                `}>
                                                    {task.status === 'Pending' ? 'Chờ xử lý' :
                                                        task.status === 'Completed' ? 'Hoàn thành' :
                                                            task.status === 'Cancelled' ? 'Đã hủy' : 'Đang xử lý'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-stone-500 dark:text-zinc-400 flex items-center gap-2 mt-1">
                                                <span>Tạo bởi: <span className="font-bold text-stone-700 dark:text-zinc-300">{task.created_by_name}</span></span>
                                                <span>•</span>
                                                <span className="font-mono">{format(new Date(task.created_at), 'HH:mm:ss dd/MM/yyyy')}</span>
                                                <span>•</span>
                                                <span className="font-bold">{task.items_count} mặt hàng</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {task.status !== 'Completed' && task.status !== 'Cancelled' && (
                                            <button
                                                onClick={(e) => handleCompleteTask(task.id, e)}
                                                className="p-2 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                title="Hoàn thành lệnh xuất"
                                            >
                                                <CheckCircle size={18} />
                                            </button>
                                        )}
                                        {task.status === 'Completed' && (
                                            <button
                                                onClick={(e) => handleUndoCompleteTask(task.id, e)}
                                                className="p-2 text-stone-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                                                title="Hủy hoàn thành lệnh xuất"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(`/print/export-order?id=${task.id}`, '_blank')
                                            }}
                                            className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Chi tiết & In"
                                        >
                                            <Printer size={18} />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteTask(task.id, e)}
                                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Xóa"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <CreateExportTaskModal
                isOpen={isCreateModalOpen}
                initialData={createModalData}
                onClose={() => {
                    setIsCreateModalOpen(false)
                    // Clear search params
                    const url = new URL(window.location.href)
                    url.searchParams.delete('posIds')
                    url.searchParams.delete('lotIds')
                    router.replace(url.pathname)
                }}
                onSuccess={async (newId) => {
                    setIsCreateModalOpen(false)
                    // Clear search params
                    const url = new URL(window.location.href)
                    url.searchParams.delete('posIds')
                    url.searchParams.delete('lotIds')
                    router.replace(url.pathname)

                    // Mark pick requests as Approved if this was from a pick request approval
                    const pendingIds = (window as any).__pendingPickRequestIds as string[] | undefined
                    if (pendingIds && pendingIds.length > 0) {
                        await (supabase.from('pick_requests' as any) as any)
                            .update({ status: 'Approved' })
                            .in('id', pendingIds)
                        delete (window as any).__pendingPickRequestIds
                        fetchPickRequests()
                    }

                    fetchTasks()
                }}
            />
        </div>
    )
}

export default function ExportOrderPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-stone-400 font-bold">Đang tải dữ liệu...</div>}>
            <ExportOrderContent />
        </Suspense>
    )
}
