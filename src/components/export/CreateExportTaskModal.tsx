'use client'

import React, { useState, useMemo } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/Dialog"
import { Loader2, Package, Save } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'

interface CreateExportTaskModalProps {
    isOpen: boolean
    onClose: () => void
    initialData: {
        positionIds: string[]
        lotIds: string[]
        items: any[] // We will pass enrich items here
    }
    onSuccess: (newTaskId: string) => void
}

export function CreateExportTaskModal({
    isOpen,
    onClose,
    initialData,
    onSuccess
}: CreateExportTaskModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()

    const [loading, setLoading] = useState(false)
    const [notes, setNotes] = useState('')
    const [code, setCode] = useState(() => `EXT-${new Date().getTime().toString().slice(-6)}`)

    // Group items by Product + Unit for easier review
    const groupedItems = useMemo(() => {
        const groups: Record<string, any> = {}
        initialData.items.forEach(item => {
            const key = `${item.product_id}_${item.unit}`
            if (!groups[key]) {
                groups[key] = {
                    ...item,
                    total_quantity: 0,
                    count: 0
                }
            }
            groups[key].total_quantity += (item.quantity || 0)
            groups[key].count += 1
        })
        return Object.values(groups)
    }, [initialData.items])

    const totalQuantity = groupedItems.reduce((acc, item) => acc + item.total_quantity, 0)

    async function handleCreate() {
        if (!currentSystem) return

        try {
            setLoading(true)

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Vui lòng đăng nhập")

            // 1. Create Task
            const { data: task, error: taskError } = await supabase
                .from('export_tasks')
                .insert({
                    code: code,
                    status: 'Pending',
                    created_by: user.id,
                    system_code: currentSystem.code,
                    notes: notes
                })
                .select()
                .single()

            if (taskError) throw taskError

            // 2. Create Task Items
            const taskItems = initialData.items.map(item => ({
                task_id: task.id,
                lot_id: item.lot_id,
                position_id: item.position_id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit: item.unit,
                status: 'Pending'
            }))

            const { error: itemsError } = await supabase
                .from('export_task_items')
                .insert(taskItems)

            if (itemsError) {
                // Rollback (simple delete task)
                await supabase.from('export_tasks').delete().eq('id', task.id)
                throw itemsError
            }

            showToast('Đã tạo lệnh xuất kho thành công', 'success')
            onSuccess(task.id)

        } catch (error: any) {
            console.error(error)
            showToast('Lỗi tạo lệnh: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Tạo Lệnh Xuất Kho Mới</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                    {/* General Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-stone-300">
                                Mã lệnh
                            </label>
                            <input
                                className="flex h-10 w-full rounded-md border border-stone-200 bg-transparent px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:ring-offset-stone-950 dark:placeholder:text-stone-400 dark:focus-visible:ring-stone-800 dark:text-stone-100"
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                placeholder="Nhập mã lệnh..."
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-stone-300">
                                Ghi chú
                            </label>
                            <textarea
                                className="flex min-h-[40px] w-full rounded-md border border-stone-200 bg-transparent px-3 py-2 text-sm ring-offset-white placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:ring-offset-stone-950 dark:placeholder:text-stone-400 dark:focus-visible:ring-stone-800 dark:text-stone-100"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Ghi chú cho lệnh xuất..."
                                rows={1}
                            />
                        </div>
                    </div>

                    {/* Items Preview */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium leading-none dark:text-stone-300">
                                Danh sách hàng hóa ({initialData.items.length} vị trí)
                            </label>
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Tổng: {totalQuantity}</span>
                        </div>

                        <div className="border border-stone-200 rounded-lg divide-y divide-stone-100 dark:border-stone-700 dark:divide-stone-800">
                            {groupedItems.map((item, idx) => (
                                <div key={idx} className="p-3 flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-stone-100 dark:bg-stone-800 rounded-md">
                                            <Package size={16} className="text-stone-500 dark:text-stone-400" />
                                        </div>
                                        <div>
                                            <div className="font-bold dark:text-stone-200">{item.product_name || 'Sản phẩm chưa đặt tên'}</div>
                                            <div className="text-stone-500 text-xs dark:text-stone-500">SKU: {item.sku}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-blue-600 dark:text-blue-400">{item.total_quantity} {item.unit}</div>
                                        <div className="text-xs text-stone-400">Từ {item.count} vị trí</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <button
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-stone-200 bg-white hover:bg-stone-100 hover:text-stone-900 h-10 px-4 py-2 dark:border-stone-800 dark:bg-stone-950 dark:hover:bg-stone-800 dark:hover:text-stone-50 dark:text-stone-100"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Tạo Lệnh Xuất
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
