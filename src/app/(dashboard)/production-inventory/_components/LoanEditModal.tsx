'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { lotService } from '@/services/warehouse/lotService'

interface LoanEditModalProps {
    loan: any
    onClose: () => void
    onSuccess: () => void
}

export const LoanEditModal: React.FC<LoanEditModalProps> = ({ loan, onClose, onSuccess }) => {
    const { showToast } = useToast()
    const [workerName, setWorkerName] = useState(loan.worker_name)
    const [quantity, setQuantity] = useState<number>(loan.quantity)
    const [notes, setNotes] = useState(loan.notes || '')
    const [productionId, setProductionId] = useState(loan.production_id || '')
    const [productions, setProductions] = useState<any[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [loadingProductions, setLoadingProductions] = useState(false)

    useEffect(() => {
        fetchProductions()
    }, [])

    const fetchProductions = async () => {
        setLoadingProductions(true)
        try {
            const data = await productionLoanService.getInProgressProductions(supabase, (loan.products as any).company_id || '')
            setProductions(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingProductions(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!workerName || quantity <= 0) {
            showToast('Vui lòng điền đầy đủ thông tin', 'error')
            return
        }

        const delta = quantity - loan.quantity

        setSubmitting(true)
        try {
            // 1. If quantity increased, check stock
            if (delta > 0) {
                const { data: item } = await (supabase.from('lot_items') as any).select('quantity').eq('id', loan.lot_item_id).single()
                if (!item || (item.quantity || 0) < delta) {
                    showToast('Không đủ tồn kho để cấp phát thêm', 'error')
                    setSubmitting(false)
                    return
                }
            }

            // 2. Update Stock if quantity changed
            if (delta !== 0) {
                const { data: item } = await (supabase.from('lot_items') as any).select('quantity').eq('id', loan.lot_item_id).single()
                if (item) {
                    const newQty = (item.quantity || 0) - delta // positive delta means we take more, so minus
                    await (supabase.from('lot_items') as any).update({ quantity: newQty }).eq('id', loan.lot_item_id)
                    
                    // Sync LOT
                    const { data: lotItem } = await (supabase.from('lot_items') as any).select('lot_id').eq('id', loan.lot_item_id).single()
                    if (lotItem) {
                        await lotService.syncLotStatus({ supabase, lotId: lotItem.lot_id, isSiteIssuance: true })
                    }
                }
            }

            // 3. Update Loan Record
            await productionLoanService.updateLoan({
                supabase,
                loanId: loan.id,
                workerName,
                quantity,
                notes: notes || loan.notes,
                productionId: productionId || undefined
            })

            showToast('Đã cập nhật thông tin cấp phát', 'success')
            onSuccess()
            onClose()
        } catch (error: any) {
            showToast(error.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center bg-orange-50/50 dark:bg-orange-950/10">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-orange-700 dark:text-orange-400">
                        Chỉnh sửa Cấp phát
                    </h3>
                    <button onClick={onClose}><X className="text-stone-400 hover:text-stone-600 transition-colors" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-stone-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-stone-100 dark:border-zinc-800 flex items-center gap-3">
                         <div className="bg-orange-100 dark:bg-orange-900/30 p-2 rounded-lg text-orange-600 dark:text-orange-400">
                            <AlertTriangle size={18} />
                         </div>
                         <div className="text-xs text-stone-500 font-medium">
                            Lưu ý: Thay đổi số lượng sẽ trực tiếp cộng/trừ vào tồn kho của vật tư.
                         </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider ml-1">Vật tư</label>
                        <div className="p-3 bg-stone-50 dark:bg-zinc-800 rounded-xl font-bold text-stone-700 dark:text-gray-300 border border-stone-200 dark:border-zinc-700">
                            {loan.products?.name}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider ml-1">Người nhận</label>
                        <input
                            type="text"
                            value={workerName}
                            onChange={e => setWorkerName(e.target.value)}
                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                            placeholder="Tên công nhân / Tổ sản xuất..."
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider ml-1">Số lượng ({loan.unit})</label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={e => setQuantity(Number(e.target.value))}
                                step="any"
                                min={0.001}
                                className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider ml-1">Lệnh sản xuất</label>
                            <select
                                value={productionId}
                                onChange={e => setProductionId(e.target.value)}
                                className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                            >
                                <option value="">--- Không gắn lệnh ---</option>
                                {productions.map(prod => (
                                    <option key={prod.id} value={prod.id}>{prod.code} - {prod.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider ml-1">Ghi chú</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-orange-500 h-20 resize-none text-sm"
                            placeholder="Thêm lưu ý nếu có..."
                        />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button 
                            type="button"
                            onClick={onClose} 
                            className="flex-1 py-3 rounded-xl text-stone-500 font-bold hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-[2] py-3 bg-orange-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Lưu thay đổi</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
