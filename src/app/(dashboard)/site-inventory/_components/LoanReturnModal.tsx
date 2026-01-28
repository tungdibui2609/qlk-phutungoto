'use client'

import React, { useState } from 'react'
import { X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { loanService } from '@/services/site-inventory/loanService'

interface LoanReturnModalProps {
    loan: any // Loan object
    onClose: () => void
    onSuccess: () => void
}

export const LoanReturnModal: React.FC<LoanReturnModalProps> = ({ loan, onClose, onSuccess }) => {
    const { showToast } = useToast()
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [status, setStatus] = useState<'returned' | 'lost'>('returned')

    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            // 1. Update Loan Status
            await loanService.returnLoan({
                supabase,
                loanId: loan.id,
                returnDate: new Date().toISOString(),
                notes: notes ? (loan.notes ? `${loan.notes}\n[Trả]: ${notes}` : notes) : loan.notes,
                status
            })

            // 2. Increment Stock (Only if returned, if lost usually we don't increment, or increment to a "Lost" warehouse)
            // For now, if returned, we increment the original lot_item quantity.
            // If lost, we do NOT increment (item is gone).

            if (status === 'returned') {
                const { data: item, error: fetchError } = await supabase
                    .from('lot_items')
                    .select('quantity')
                    .eq('id', loan.lot_item_id)
                    .single()

                if (item) {
                    const newQty = (item.quantity || 0) + loan.quantity
                    await supabase.from('lot_items').update({ quantity: newQty }).eq('id', loan.lot_item_id)
                }
            }

            showToast('Đã cập nhật trạng thái', 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">Xác nhận Trả đồ</h3>
                    <button onClick={onClose}><X className="text-stone-400" /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="bg-stone-50 dark:bg-zinc-800 p-4 rounded-xl">
                        <div className="font-bold text-lg">{loan.products?.name}</div>
                        <div className="flex justify-between mt-2 text-sm">
                            <span className="text-stone-500">Người mượn:</span>
                            <span className="font-bold">{loan.worker_name}</span>
                        </div>
                        <div className="flex justify-between mt-1 text-sm">
                            <span className="text-stone-500">Số lượng:</span>
                            <span className="font-bold">{loan.quantity} {loan.unit}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-500">Trạng thái trả về</label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setStatus('returned')}
                                className={`flex-1 py-2 rounded-xl font-bold border ${status === 'returned' ? 'border-green-500 bg-green-50 text-green-600' : 'border-stone-200'}`}
                            >
                                Đã trả (Tốt)
                            </button>
                            <button
                                onClick={() => setStatus('lost')}
                                className={`flex-1 py-2 rounded-xl font-bold border ${status === 'lost' ? 'border-red-500 bg-red-50 text-red-600' : 'border-stone-200'}`}
                            >
                                Mất / Hỏng
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-500">Ghi chú tình trạng</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:border-orange-500 h-24 resize-none"
                            placeholder="Máy hoạt động tốt..."
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-stone-100 dark:border-zinc-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-stone-500 font-bold hover:bg-stone-100">
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-8 py-2.5 bg-orange-600 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        {submitting ? 'Đang xử lý...' : <> <Check size={18} /> Xác nhận </>}
                    </button>
                </div>
            </div>
        </div>
    )
}
