import React, { useState } from 'react'
import { X, Copy, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'

interface LotBulkCloneModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
}

export function LotBulkCloneModal({ lot, onClose, onSuccess }: LotBulkCloneModalProps) {
    const [cloneCount, setCloneCount] = useState<number>(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleClone = async () => {
        if (cloneCount < 1 || cloneCount > 50) {
            setError('Số lượng nhân bản phải từ 1 đến 50')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            // Fetch the lot details to ensure we have all items
            const { data: fullLot, error: fetchError } = await supabase
                .from('lots')
                .select('*, lot_items(*)')
                .eq('id', lot.id)
                .single()

            if (fetchError) throw fetchError

            if (!fullLot) {
                throw new Error("Không tìm thấy thông tin Lot")
            }

            const { lot_items, id: originalId, code: originalCode, created_at, ...lotDataWithoutIds } = fullLot

            // Generate new codes
            const timestamp = new Date().getTime().toString().slice(-6);

            const newLots = Array.from({ length: cloneCount }).map((_, i) => {
                const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                const newCode = `LOT-${timestamp}-${randomSuffix}-${i + 1}`;

                // Copy metadata but clear system_history and positions if any are specific to the lot
                let newMetadata = { ...(typeof lotDataWithoutIds.metadata === 'object' && lotDataWithoutIds.metadata !== null ? lotDataWithoutIds.metadata : {}) } as any
                if (newMetadata.system_history) {
                    newMetadata.system_history = {
                        cloned_from: originalCode,
                        clone_date: new Date().toISOString()
                    }
                } else {
                    newMetadata.system_history = {
                        cloned_from: originalCode,
                        clone_date: new Date().toISOString()
                    }
                }

                return {
                    ...lotDataWithoutIds,
                    code: newCode,
                    metadata: newMetadata,
                    quantity: lotDataWithoutIds.quantity || 0,
                }
            })

            // 1. Insert New Lots
            const { data: insertedLots, error: insertLotsError } = await supabase
                .from('lots')
                .insert(newLots)
                .select('*')

            if (insertLotsError) throw insertLotsError

            // 2. Insert Lot Items
            if (lot_items && lot_items.length > 0 && insertedLots && insertedLots.length > 0) {
                const newLotItems = []
                for (const newLot of insertedLots) {
                    for (const item of lot_items) {
                        const { id: ignoreId, lot_id: ignoreLotId, created_at: ignoreCreatedAt, ...itemDataWithoutIds } = item
                        newLotItems.push({
                            ...itemDataWithoutIds,
                            lot_id: newLot.id
                        })
                    }
                }

                if (newLotItems.length > 0) {
                    const { error: insertItemsError } = await supabase
                        .from('lot_items')
                        .insert(newLotItems)

                    if (insertItemsError) throw insertItemsError
                }
            }

            onSuccess()
        } catch (err: any) {
            console.error('Error cloning lots:', err)
            setError(err.message || 'Đã có lỗi xảy ra khi nhân bản lot')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="relative p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl">
                            <Copy size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                                Nhân bản LOT
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                Tạo các bản sao từ LOT <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{lot.code}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Source Info */}
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4">
                        <div className="flex gap-2 text-sm text-blue-800 dark:text-blue-300">
                            <AlertCircle size={18} className="shrink-0 text-blue-500 mt-0.5" />
                            <div>
                                <p className="font-medium mb-1">Thông tin nhân bản:</p>
                                <ul className="list-disc list-inside opacity-90 space-y-1 text-xs">
                                    <li>Mã LOT mới sẽ được tạo tự động</li>
                                    <li>Sao chép toàn bộ thông tin sản phẩm và số lượng</li>
                                    <li>Sao chép các thông tin liên quan (NCC, QC, NSX...)</li>
                                    <li>Không sao chép vị trí lưu kho và lịch sử</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Input */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Số lượng nhân bản
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={50}
                                value={cloneCount}
                                onChange={(e) => setCloneCount(parseInt(e.target.value) || 1)}
                                disabled={isSubmitting}
                                className="w-full px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all font-medium text-lg text-center"
                                placeholder="Nhập số lượng (1-50)"
                            />
                            {error && (
                                <p className="mt-2 text-sm text-red-500 flex items-center gap-1.5">
                                    <AlertCircle size={14} />
                                    {error}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleClone}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <Copy size={18} />
                                Nhân bản ({cloneCount})
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
