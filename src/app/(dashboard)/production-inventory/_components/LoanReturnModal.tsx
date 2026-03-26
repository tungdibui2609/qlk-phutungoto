'use client'

import React, { useState } from 'react'
import { X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { lotService } from '@/services/warehouse/lotService'

interface LoanReturnModalProps {
    loan: any // Loan object
    onClose: () => void
    onSuccess: () => void
}

export const LoanReturnModal: React.FC<LoanReturnModalProps> = ({ loan, onClose, onSuccess }) => {
    const { showToast } = useToast()
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [status, setStatus] = useState<'returned' | 'lost' | 'consumed'>('returned')
    const remainingQuantity = (loan.quantity || 0) - (loan.returned_quantity || 0)
    const [returnQuantity, setReturnQuantity] = useState<number>(remainingQuantity)

    const handleSubmit = async () => {
        if (status === 'returned' && (returnQuantity < 0 || returnQuantity > loan.quantity)) {
            showToast(`Số lượng trả không hợp lệ (0 - ${loan.quantity})`, 'error')
            return
        }

        setSubmitting(true)
        try {
            // 1. Update Loan Status and Returned Quantity
            await productionLoanService.returnLoan({
                supabase,
                loanId: loan.id,
                returnDate: new Date().toISOString(),
                notes: notes ? (loan.notes ? `${loan.notes}\n[Trả]: ${notes}` : notes) : loan.notes,
                status,
                returnedQuantity: status === 'returned' ? returnQuantity : 0
            })

            // 2. Increment Stock (Only if returned)
            if (status === 'returned' && returnQuantity > 0) {
                const { data: item } = await (supabase
                    .from('lot_items') as any)
                    .select('quantity')
                    .eq('id', loan.lot_item_id)
                    .single()

                if (item) {
                    const newQty = (item.quantity || 0) + Number(returnQuantity)
                    await (supabase.from('lot_items') as any).update({ quantity: newQty }).eq('id', loan.lot_item_id)

                    // 3. Sync LOT Status and Quantity
                    const { data: lotItem } = await (supabase.from('lot_items') as any).select('lot_id').eq('id', loan.lot_item_id).single()
                    if (lotItem) {
                        await lotService.syncLotStatus({
                            supabase,
                            lotId: lotItem.lot_id,
                            isSiteIssuance: true
                        })
                    }
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
                    <h3 className="text-xl font-bold">Xác nhận Thu hồi / Trả lại</h3>
                    <button onClick={onClose}><X className="text-stone-400" /></button>
                </div>

                <div className="p-6 space-y-5">
                    <div className="bg-stone-50 dark:bg-zinc-800 p-4 rounded-xl border border-stone-100 dark:border-zinc-700">
                        <div className="font-bold text-lg text-stone-800 dark:text-gray-200">{loan.products?.name}</div>
                        <div className="grid grid-cols-2 gap-y-2 mt-3 text-sm">
                            <span className="text-stone-500">Người nhận:</span>
                            <span className="font-bold text-right">{loan.worker_name}</span>
                            <span className="text-stone-500">Đã cấp phát:</span>
                            <span className="font-bold text-right text-orange-600">{loan.quantity} {loan.unit}</span>
                            {Number(loan.returned_quantity) > 0 && (
                                <>
                                    <span className="text-stone-500">Đã thu hồi trước:</span>
                                    <span className="font-bold text-right text-emerald-600">{loan.returned_quantity} {loan.unit}</span>
                                </>
                            )}
                            <span className="text-stone-500">Còn lại:</span>
                            <span className="font-bold text-right text-blue-600">{remainingQuantity} {loan.unit}</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-stone-500">Chọn hành động để kết thúc cấp phát</label>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => {
                                    setStatus('returned')
                                    setReturnQuantity(remainingQuantity)
                                }}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${status === 'returned' && returnQuantity === remainingQuantity ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm' : 'border-stone-200 hover:border-emerald-300'}`}
                            >
                                <div className="text-left">
                                    <div className="font-bold text-sm">Thu hồi toàn bộ ({remainingQuantity} {loan.unit})</div>
                                    <div className="text-[10px] opacity-70 italic">Vật tư còn dư mang trả lại kho</div>
                                </div>
                                {status === 'returned' && returnQuantity === remainingQuantity && <Check size={18} />}
                            </button>

                            <button
                                onClick={() => {
                                    setStatus('consumed')
                                    setReturnQuantity(0)
                                }}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${status === 'consumed' ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' : 'border-stone-200 hover:border-blue-300'}`}
                            >
                                <div className="text-left">
                                    <div className="font-bold text-sm">Đã dùng hết (Tiêu hao 100%)</div>
                                    <div className="text-[10px] opacity-70 italic">Không có hàng trả về, đóng sổ cấp phát</div>
                                </div>
                                {status === 'consumed' && <Check size={18} />}
                            </button>

                            <button
                                onClick={() => {
                                    setStatus('returned')
                                    if (returnQuantity === remainingQuantity) setReturnQuantity(0)
                                }}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${status === 'returned' && returnQuantity !== remainingQuantity ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm' : 'border-stone-200 hover:border-orange-300'}`}
                            >
                                <div className="text-left">
                                    <div className="font-bold text-sm">Thu hồi một phần</div>
                                    <div className="text-[10px] opacity-70 italic">Nhập số lượng thực tế mang trả</div>
                                </div>
                                {status === 'returned' && returnQuantity !== remainingQuantity && <Check size={18} />}
                            </button>
                        </div>
                    </div>

                    {status === 'returned' && returnQuantity !== remainingQuantity && (
                        <div className="space-y-2 animate-in slide-in-from-top duration-200">
                            <label className="text-sm font-bold text-stone-500 flex justify-between">
                                <span>Số lượng nhập lại kho ({loan.unit})</span>
                                <span className="text-xs text-orange-600 font-bold">Tối đa: {remainingQuantity}</span>
                            </label>
                            <input
                                type="number"
                                value={returnQuantity}
                                onChange={e => setReturnQuantity(Number(e.target.value))}
                                max={remainingQuantity}
                                min={0}
                                step="any"
                                className="w-full p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-lg text-emerald-700"
                                placeholder="0.00"
                            />
                        </div>
                    )}

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
