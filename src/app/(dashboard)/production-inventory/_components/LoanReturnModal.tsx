'use client'

import React, { useState } from 'react'
import { X, Check, RefreshCw, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { productionLoanService } from '@/services/production-inventory/productionLoanService'
import { lotService } from '@/services/warehouse/lotService'

interface LoanReturnModalProps {
    loans: any[] // Array of loans (batch or single)
    onClose: () => void
    onSuccess: () => void
}

export const LoanReturnModal: React.FC<LoanReturnModalProps> = ({ loans, onClose, onSuccess }) => {
    const { showToast } = useToast()
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    
    // Track return quantities per loan
    const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {}
        loans.forEach(loan => {
            initial[loan.id] = 0
        })
        return initial
    })

    const updateReturnQty = (loanId: string, qty: number) => {
        setReturnQuantities(prev => ({ ...prev, [loanId]: qty }))
    }

    const formatQty = (n: number) => Number(n).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')

    const handleSubmit = async () => {
        // Validate
        for (const loan of loans) {
            const remaining = (Number(loan.quantity) || 0) - (Number(loan.returned_quantity) || 0)
            const returnQty = returnQuantities[loan.id] || 0
            if (returnQty < 0 || returnQty > remaining + 0.001) {
                showToast(`Số lượng trả "${loan.products?.name}" không hợp lệ (0 - ${formatQty(remaining)})`, 'error')
                return
            }
        }

        setSubmitting(true)
        try {
            for (const loan of loans) {
                const returnQty = returnQuantities[loan.id] || 0
                if (returnQty <= 0) continue // Skip if nothing to return

                // 1. Update loan record
                await productionLoanService.returnLoan({
                    supabase,
                    loanId: loan.id,
                    returnDate: new Date().toISOString(),
                    notes: notes ? (loan.notes ? `${loan.notes}\n[Trả]: ${notes}` : notes) : loan.notes,
                    status: 'returned',
                    returnedQuantity: returnQty
                })

                // 2. Return stock
                const { data: item } = await (supabase
                    .from('lot_items') as any)
                    .select('quantity')
                    .eq('id', loan.lot_item_id)
                    .single()

                if (item) {
                    const newQty = (item.quantity || 0) + Number(returnQty)
                    await (supabase.from('lot_items') as any).update({ quantity: newQty }).eq('id', loan.lot_item_id)

                    // 3. Sync LOT
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

            const returnedCount = loans.filter(l => (returnQuantities[l.id] || 0) > 0).length
            showToast(`Đã thu hồi ${returnedCount} sản phẩm thành công`, 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    const isMulti = loans.length > 1

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-3 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h3 className="text-base font-black text-stone-900 dark:text-white uppercase tracking-tight">
                            Hoàn trả vật tư dư
                        </h3>
                        <p className="text-[10px] text-stone-400 font-bold">
                            {isMulti ? `Phiếu ${loans.length} sản phẩm • ${loans[0]?.worker_name}` : loans[0]?.worker_name}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 dark:hover:bg-zinc-700 rounded-full transition-colors">
                        <X className="text-stone-400" size={18} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                    {loans.map((loan, idx) => {
                        const remaining = (Number(loan.quantity) || 0) - (Number(loan.returned_quantity) || 0)
                        const returnQty = returnQuantities[loan.id] || 0

                        return (
                            <div key={loan.id} className="p-3 bg-stone-50 dark:bg-zinc-900 rounded-xl border border-stone-100 dark:border-zinc-700">
                                {/* Product Info */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {isMulti && (
                                            <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-zinc-700 text-[9px] font-black flex items-center justify-center text-stone-500 flex-shrink-0">
                                                {idx + 1}
                                            </span>
                                        )}
                                        <div className="min-w-0">
                                            <div className="font-bold text-sm text-stone-800 dark:text-gray-200 truncate">
                                                {loan.products?.name}
                                            </div>
                                            <div className="text-[9px] text-stone-400 font-mono">{loan.products?.sku}</div>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <div className="text-[9px] font-bold text-stone-400">Đã cấp: {formatQty(loan.quantity)} {loan.unit}</div>
                                        {Number(loan.returned_quantity) > 0 && (
                                            <div className="text-[9px] font-bold text-emerald-500">Đã trả: {formatQty(loan.returned_quantity)}</div>
                                        )}
                                        <div className="text-[10px] font-black text-orange-600">Đang giữ: {formatQty(remaining)} {loan.unit}</div>
                                    </div>
                                </div>

                                {/* Return Quantity Input */}
                                <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200 dark:border-emerald-800/50 p-2">
                                    <span className="text-[9px] font-black text-emerald-600 uppercase whitespace-nowrap">Hoàn trả:</span>
                                    <input
                                        type="number"
                                        value={returnQty}
                                        onChange={e => updateReturnQty(loan.id, Number(e.target.value))}
                                        max={remaining}
                                        min={0}
                                        step="any"
                                        className="flex-1 bg-transparent outline-none font-black text-lg text-emerald-600 dark:text-emerald-400 text-center min-w-0"
                                        placeholder="0"
                                    />
                                    <span className="text-[10px] font-bold text-stone-400 uppercase">{loan.unit}</span>
                                    <button
                                        onClick={() => updateReturnQty(loan.id, remaining)}
                                        className="text-[8px] font-black px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 transition-colors uppercase whitespace-nowrap"
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>
                        )
                    })}

                    {/* Notes */}
                    <div className="space-y-1.5 pt-2">
                        <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest pl-1">Ghi chú</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none focus:border-orange-500 h-16 resize-none text-xs font-medium"
                            placeholder="Ví dụ: Hàng dư sau khi cắt..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-stone-100 dark:border-zinc-800 flex justify-end gap-2 flex-shrink-0 bg-white dark:bg-zinc-800">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-stone-500 font-bold text-xs hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors">
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 disabled:opacity-50 transition-colors active:scale-95"
                    >
                        {submitting ? <><RefreshCw className="animate-spin" size={14} /> Đang xử lý...</> : <><Check size={16} /> Xác nhận hoàn trả</>}
                    </button>
                </div>
            </div>
        </div>
    )
}
