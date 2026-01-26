'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { X, Loader2, Warehouse } from 'lucide-react'
import { useSystem } from '@/contexts/SystemContext'

interface CreateAuditModalProps {
    isOpen: boolean
    onClose: () => void
    onCreate: (warehouseId: string | null, warehouseName: string | null, note: string) => Promise<any>
}

export function CreateAuditModal({ isOpen, onClose, onCreate }: CreateAuditModalProps) {
    const { currentSystem } = useSystem()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [warehouses, setWarehouses] = useState<{ id: string, name: string }[]>([])

    const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
    const [note, setNote] = useState('')

    useEffect(() => {
        if (isOpen && currentSystem) {
            fetchWarehouses()
        }
    }, [isOpen, currentSystem])

    const fetchWarehouses = async () => {
        setLoading(true)
        // Use 'branches' as warehouses to be consistent with Lot management
        const { data } = await supabase
            .from('branches')
            .select('id, name')
            .order('is_default', { ascending: false })
            .order('name')

        if (data) {
            setWarehouses(data)
        }
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        let whName = null
        if (selectedWarehouseId) {
            const wh = warehouses.find(w => w.id === selectedWarehouseId)
            if (wh) whName = wh.name
        }

        await onCreate(selectedWarehouseId || null, whName, note)
        setSubmitting(false)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-lg">Tạo phiếu kiểm kê mới</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Kho kiểm kê</label>
                        <select
                            className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                            value={selectedWarehouseId}
                            onChange={e => setSelectedWarehouseId(e.target.value)}
                        >
                            <option value="">Tất cả kho (Toàn bộ hệ thống)</option>
                            {warehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500">
                            Chọn kho để giới hạn phạm vi kiểm kê. Nếu để trống, sẽ kiểm kê toàn bộ Lot trong hệ thống.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ghi chú</label>
                        <textarea
                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all resize-none"
                            rows={3}
                            placeholder="Nhập lý do kiểm kê, ghi chú..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Tạo phiếu kiểm kê'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
