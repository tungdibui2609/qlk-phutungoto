import React, { useState } from 'react'
import { X, Copy, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { useSystem } from '@/contexts/SystemContext'

interface LotBulkCloneModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
}

export function LotBulkCloneModal({ lot, onClose, onSuccess }: LotBulkCloneModalProps) {
    const { currentSystem } = useSystem()
    const [cloneCount, setCloneCount] = useState<number>(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleClone = async () => {
        if (!currentSystem) {
            setError('Không tìm thấy thông tin hệ thống')
            return
        }

        if (cloneCount < 1 || cloneCount > 50) {
            setError('Số lượng nhân bản phải từ 1 đến 50')
            return
        }

        setIsSubmitting(true)
        setError(null)

        try {
            // Fetch the lot details to ensure we have all items and tags
            const { data: fullData, error: fetchError } = await supabase
                .from('lots')
                .select('*, lot_items(*), lot_tags(*)')
                .eq('id', lot.id)
                .single()

            if (fetchError) throw fetchError

            const fullLot = fullData as any
            if (!fullLot) {
                throw new Error("Không tìm thấy thông tin Lot")
            }

            const { lot_items, lot_tags, id: originalId, code: originalCode, created_at, ...lotDataWithoutIds } = fullLot

            // Get current system sequence (STT)
            const { data: lastLots } = await supabase
                .from('lots')
                .select('daily_seq')
                .eq('system_code', currentSystem.code)
                .order('created_at', { ascending: false })
                .limit(1)

            let lastSequence = 0
            if (lastLots && lastLots.length > 0) {
                lastSequence = (lastLots[0] as any).daily_seq || 0
            }

            // Generate metadata and codes based on sequence
            const today = new Date()
            const day = String(today.getDate()).padStart(2, '0')
            const month = String(today.getMonth() + 1).padStart(2, '0')
            const year = String(today.getFullYear()).slice(-2)
            const dateStr = `${day}${month}${year}`

            let warehousePrefix = ''
            const cleanName = (currentSystem.name || '').replace(/^Kho\s+/i, '').trim()
            const initials = cleanName.split(/\s+/).map((word: string) => word[0]).join('')
            const normalized = initials
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/Đ/g, "D")
            warehousePrefix = normalized.toUpperCase().replace(/[^A-Z0-9]/g, '')

            const prefix = warehousePrefix ? `${warehousePrefix}-LOT-${dateStr}-` : `LOT-${dateStr}-`

            const commonMetadata = {
                ...(typeof lotDataWithoutIds.metadata === 'object' && lotDataWithoutIds.metadata !== null ? lotDataWithoutIds.metadata : {}),
                system_history: {
                    ...(lotDataWithoutIds.metadata as any)?.system_history || {},
                    cloned_from: originalCode,
                    clone_date: new Date().toISOString()
                }
            };

            const newLots = Array.from({ length: cloneCount }).map((_, i) => {
                const currentSeq = lastSequence + (i + 1)
                const newCode = `${prefix}${currentSeq}`;

                return {
                    ...lotDataWithoutIds,
                    code: newCode,
                    daily_seq: currentSeq,
                    metadata: commonMetadata,
                    quantity: lotDataWithoutIds.quantity || 0,
                    system_code: currentSystem.code,
                }
            })

            // 1. Insert New Lots
            const { data: insertedLots, error: insertLotsError } = await (supabase
                .from('lots') as any)
                .insert(newLots)
                .select('id')

            if (insertLotsError) throw insertLotsError

            // 2. Prepare Batch Inserts for Items and Tags
            if (insertedLots && insertedLots.length > 0) {
                const newLotItems: any[] = []
                const newLotTags: any[] = []

                for (const newLot of insertedLots) {
                    // Clone Items
                    if (lot_items && lot_items.length > 0) {
                        for (const item of lot_items) {
                            const { id: ignoreId, lot_id: ignoreLotId, created_at: ignoreCreatedAt, ...itemDataWithoutIds } = item as any
                            newLotItems.push({
                                ...itemDataWithoutIds,
                                lot_id: newLot.id
                            })
                        }
                    }

                    // Clone Tags
                    if (lot_tags && lot_tags.length > 0) {
                        for (const tag of lot_tags) {
                            const { id: ignoreId, lot_id: ignoreLotId, added_at: ignoreAddedAt, ...tagDataWithoutIds } = tag as any
                            newLotTags.push({
                                ...tagDataWithoutIds,
                                lot_id: newLot.id,
                                added_at: new Date().toISOString()
                            })
                        }
                    }
                }

                // Batch Insert Items
                if (newLotItems.length > 0) {
                    const { error: insertItemsError } = await (supabase.from('lot_items') as any).insert(newLotItems)
                    if (insertItemsError) throw insertItemsError
                }

                // Batch Insert Tags
                if (newLotTags.length > 0) {
                    const { error: insertTagsError } = await (supabase.from('lot_tags') as any).insert(newLotTags)
                    if (insertTagsError) throw insertTagsError
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
