'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { FileText, ArrowLeft, Loader2, Printer, Trash2, CheckCircle2 } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { format } from 'date-fns'
import { useToast } from '@/components/ui/ToastProvider'
import { ExportMapDiagram } from '@/components/export/ExportMapDiagram'

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
    const [task, setTask] = useState<ExportTask | null>(null)
    const [loading, setLoading] = useState(true)

    const taskId = params.id as string

    useEffect(() => {
        if (taskId) {
            fetchTaskDetails()
        }
    }, [taskId])

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
                        lots (code, inbound_date, positions(code)),
                        positions (code),
                        products (name, sku, image_url)
                    )
                `)
                .eq('id', taskId)
                .single()

            if (error) throw error

            const formattedTask: ExportTask = {
                ...data,
                status: data.status as ExportTask['status'],
                created_by_name: 'Admin',
                items_count: data.items?.length || 0,
                items: data.items?.map((item: any) => {
                    let posCode = item.positions?.code
                    if (!posCode && item.lots?.positions && item.lots?.positions.length > 0) {
                        posCode = item.lots.positions[0].code
                    }
                    return {
                        id: item.id,
                        lot_code: item.lots?.code || 'N/A',
                        lot_inbound_date: item.lots?.inbound_date,
                        position_name: posCode || 'N/A',
                        product_name: item.products?.name || 'Sản phẩm không tên',
                        sku: item.products?.sku || 'N/A',
                        product_image: item.products?.image_url,
                        quantity: item.quantity,
                        unit: item.unit,
                        status: item.status || 'Pending'
                    }
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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
        )
    }

    if (!task) return null

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-zinc-900/50 p-6 space-y-6">
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
                    {/* <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-emerald-700 transition-colors">
                        <CheckCircle2 size={16} />
                        Hoàn thành
                    </button> */}
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
                                        <span className="bg-stone-100 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 px-2 py-1 rounded text-xs font-bold text-stone-700 dark:text-zinc-300 font-mono">
                                            {item.position_name}
                                        </span>
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
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95 ${item.status === 'Exported'
                                                ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                                                : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200 hover:text-stone-700'
                                                }`}
                                        >
                                            {item.status === 'Exported' ? 'Đã xuất' : 'Chưa hạ'}
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
                <div className="bg-white dark:bg-zinc-800 rounded-3xl border border-stone-200 dark:border-zinc-700 shadow-sm p-6 overflow-hidden">
                    <h2 className="text-lg font-bold mb-4 border-b border-stone-100 dark:border-zinc-700 pb-2">Sơ đồ vị trí xuất kho</h2>
                    <div className="overflow-x-auto print:-mx-0 mx-[-1rem] px-[1rem] print:px-0">
                        <ExportMapDiagram
                            items={task.items.map(item => ({
                                id: item.id,
                                quantity: item.quantity,
                                unit: item.unit,
                                status: item.status,
                                lots: {
                                    code: item.lot_code,
                                    inbound_date: item.lot_inbound_date,
                                    notes: null // Missing in detail currently but satisfies TS
                                },
                                positions: {
                                    code: item.position_name
                                },
                                products: {
                                    name: item.product_name,
                                    sku: item.sku
                                }
                            }))}
                        />
                    </div>
                </div>
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
