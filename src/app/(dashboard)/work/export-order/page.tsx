'use client'

import React, { Suspense, useState, useEffect, useMemo } from 'react'
import { FileText, LayoutList, Loader2, Trash2, Printer } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { CreateExportTaskModal } from '@/components/export/CreateExportTaskModal'

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

function ExportOrderContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const { showToast, showConfirm } = useToast()

    // State
    const [tasks, setTasks] = useState<ExportTask[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchTasks()
    }, [])

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

            if (positionIds.length > 0) {
                const { data: posData } = await supabase
                    .from('positions')
                    .select('id, lot_id')
                    .in('id', positionIds)

                if (posData) {
                    posData.forEach(p => {
                        if (p.lot_id) finalLotIds.add(p.lot_id)
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
                    )
                `)
                .in('id', uniqueLotIds)

            if (error) throw error

            // Flatten items
            const items: any[] = []
            lotsData?.forEach((lot: any) => {
                if (lot.lot_items) {
                    lot.lot_items.forEach((li: any) => {
                        items.push({
                            lot_id: lot.id,
                            product_id: li.product_id,
                            quantity: li.quantity,
                            unit: li.unit,
                            product_name: li.products?.name,
                            sku: li.products?.sku,
                            // Ideally we should know which position this comes from if we selected by position
                            // For simplicity, we just link to the LOT. 
                            // If user selected specific positions, we might want to link those?
                            // For now, let's leave position_id null or try to map back if possible.
                            position_id: null
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
            // 1. Fetch tasks and item counts
            const { data: tasksData, error: tasksError } = await supabase
                .from('export_tasks')
                .select('*, export_task_items(count)')
                .order('created_at', { ascending: false })

            if (tasksError) throw tasksError

            // 2. Extract unique creator IDs
            const userIds = Array.from(new Set((tasksData || []).map(t => t.created_by).filter(Boolean)))

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
            const formattedTasks: ExportTask[] = (tasksData || []).map((t) => {
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

    const handleDeleteTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()

        const confirmed = await showConfirm('Bạn có chắc chắn muốn xóa lệnh xuất kho này? Hành động này không thể hoàn tác.')

        if (confirmed) {
            try {
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

                showToast('Đã xóa lệnh xuất kho', 'success')
                fetchTasks()
            } catch (error) {
                console.error('Error deleting task:', error)
                showToast('Không thể xóa lệnh xuất kho', 'error')
            }
        }
    }


    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24 h-full">
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
                onSuccess={(newId) => {
                    setIsCreateModalOpen(false)
                    // Clear search params
                    const url = new URL(window.location.href)
                    url.searchParams.delete('posIds')
                    url.searchParams.delete('lotIds')
                    router.replace(url.pathname)
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
