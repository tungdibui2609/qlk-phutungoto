'use client'

import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/Dialog"
import { Loader2, Save } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { logActivity } from '@/lib/audit'

interface EditExportTaskModalProps {
    isOpen: boolean
    onClose: () => void
    task: {
        id: string
        code: string
        created_at: string
        notes?: string | null
    }
    onSuccess: () => void
}

export function EditExportTaskModal({
    isOpen,
    onClose,
    task,
    onSuccess
}: EditExportTaskModalProps) {
    const { showToast } = useToast()
    const { currentSystem } = useSystem()

    const [loading, setLoading] = useState(false)
    const [code, setCode] = useState('')
    const [createdAt, setCreatedAt] = useState('')
    const [notes, setNotes] = useState('')

    // Initialize inputs when task or modal changes
    useEffect(() => {
        if (isOpen && task) {
            setCode(task.code || '')
            setNotes(task.notes || '')
            if (task.created_at) {
                const date = new Date(task.created_at)
                const offset = date.getTimezoneOffset() * 60000
                setCreatedAt(new Date(date.getTime() - offset).toISOString().slice(0, 16))
            } else {
                setCreatedAt('')
            }
        }
    }, [isOpen, task])

    async function handleSave() {
        if (!code.trim()) {
            showToast('Vui lòng nhập tên lệnh xuất', 'error')
            return
        }

        try {
            setLoading(true)

            // Update Task
            const { error: updateError } = await (supabase
                .from('export_tasks') as any)
                .update({
                    code: code.trim(),
                    notes: notes.trim(),
                    created_at: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', task.id)

            if (updateError) throw updateError

            // Log activity
            await logActivity({
                supabase,
                tableName: 'export_tasks',
                recordId: task.id,
                action: 'UPDATE',
                oldData: {
                    code: task.code,
                    notes: task.notes,
                    created_at: task.created_at
                },
                newData: {
                    code: code.trim(),
                    notes: notes.trim(),
                    created_at: createdAt ? new Date(createdAt).toISOString() : null
                },
                systemCode: currentSystem?.code || null
            })

            showToast('Cập nhật lệnh xuất thành công', 'success')
            onSuccess()
            onClose()

        } catch (error: any) {
            console.error(error)
            showToast('Lỗi cập nhật lệnh: ' + error.message, 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Sửa Thông Tin Lệnh Xuất</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none dark:text-stone-300">
                            Tên lệnh xuất
                        </label>
                        <input
                            className="flex h-10 w-full rounded-md border border-stone-200 bg-transparent px-3 py-2 text-sm ring-offset-white placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:placeholder:text-stone-400 dark:text-stone-100"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder="Nhập tên lệnh xuất..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none dark:text-stone-300">
                            Ngày giờ lệnh xuất
                        </label>
                        <input
                            type="datetime-local"
                            className="flex h-10 w-full rounded-md border border-stone-200 bg-transparent px-3 py-2 text-sm ring-offset-white placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:placeholder:text-stone-400 dark:text-stone-100"
                            value={createdAt}
                            onChange={e => setCreatedAt(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium leading-none dark:text-stone-300">
                            Ghi chú
                        </label>
                        <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-stone-200 bg-transparent px-3 py-2 text-sm ring-offset-white placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-stone-800 dark:bg-stone-950 dark:placeholder:text-stone-400 dark:text-stone-100"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Ghi chú cho lệnh xuất..."
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <button
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-stone-200 bg-white hover:bg-stone-100 h-10 px-4 py-2 dark:border-stone-800 dark:bg-stone-950 dark:hover:bg-stone-800 dark:text-stone-100"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Lưu thay đổi
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
