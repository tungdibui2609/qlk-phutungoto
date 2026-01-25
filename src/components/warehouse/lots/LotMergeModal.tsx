'use client'

import React, { useState, useMemo } from 'react'
import { X, ArrowRight, Check, AlertCircle } from 'lucide-react'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { supabase } from '@/lib/supabaseClient'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface LotMergeModalProps {
    sourceLot: Lot
    lots: Lot[] // Available lots to merge into
    onClose: () => void
    onSuccess: () => void
}

export const LotMergeModal: React.FC<LotMergeModalProps> = ({ sourceLot, lots, onClose, onSuccess }) => {
    const [targetLotId, setTargetLotId] = useState<string>('')
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({}) // itemId -> quantity to merge
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Confirm Dialog State
    const [showConfirm, setShowConfirm] = useState(false)
    const [confirmTitle, setConfirmTitle] = useState('')
    const [confirmMessage, setConfirmMessage] = useState('')

    // Filter potential targets (exclude self)
    const availableTargets = useMemo(() => {
        return lots.filter(l => l.id !== sourceLot.id)
    }, [lots, sourceLot.id])

    const handleQuantityChange = (itemId: string, maxQty: number, value: string) => {
        const qty = parseFloat(value)
        if (isNaN(qty) || qty < 0) return

        if (qty === 0) {
            const newSelected = { ...selectedItems }
            delete newSelected[itemId]
            setSelectedItems(newSelected)
        } else {
            setSelectedItems({
                ...selectedItems,
                [itemId]: Math.min(qty, maxQty)
            })
        }
    }

    const handleSelectAll = () => {
        if (!sourceLot.lot_items) return
        const newSelected: Record<string, number> = {}
        sourceLot.lot_items.forEach(item => {
            newSelected[item.id] = item.quantity
        })
        setSelectedItems(newSelected)
    }

    const checkFullMerge = () => {
        if (!sourceLot.lot_items) return false

        // Must select all items
        if (Object.keys(selectedItems).length !== sourceLot.lot_items.length) return false

        // Must select full quantity for each item
        for (const item of sourceLot.lot_items) {
            if (selectedItems[item.id] !== item.quantity) return false
        }

        return true
    }

    const handlePreSubmit = () => {
        if (!targetLotId) {
            setError('Vui lòng chọn Lot đích')
            return
        }
        if (Object.keys(selectedItems).length === 0) {
            setError('Vui lòng chọn ít nhất 1 sản phẩm để gộp')
            return
        }

        const isFullMerge = checkFullMerge()
        const hasPositions = sourceLot.positions && sourceLot.positions.length > 0

        if (isFullMerge && hasPositions) {
            const posCodes = sourceLot.positions?.map(p => p.code).join(', ')
            setConfirmTitle('Cảnh báo giải phóng vị trí')
            setConfirmMessage(`Bạn đang thực hiện gộp TOÀN BỘ sản phẩm trong Lot này.\n\nVị trí hiện tại của Lot (${posCodes}) sẽ được GIẢI PHÓNG (trống).\n\nBạn có chắc chắn muốn tiếp tục?`)
            setShowConfirm(true)
        } else {
            executeMerge()
        }
    }

    const executeMerge = async () => {
        setLoading(true)
        setError(null)
        setShowConfirm(false)

        try {
            const itemsToMerge = Object.entries(selectedItems).map(([itemId, qty]) => ({ itemId, qty }));

            for (const item of itemsToMerge) {
                const sourceItem = sourceLot.lot_items?.find(i => i.id === item.itemId);
                if (!sourceItem) continue;

                // 1. Decrement Source
                if (item.qty >= sourceItem.quantity) {
                    await supabase.from('lot_items').delete().eq('id', sourceItem.id);
                } else {
                    await supabase.from('lot_items').update({ quantity: sourceItem.quantity - item.qty }).eq('id', sourceItem.id);
                }

                // 2. Insert into Target
                // We try to insert a new row to ensure "separate line" requirement
                const { data: newItem, error: insertError } = await supabase.from('lot_items').insert({
                    lot_id: targetLotId,
                    product_id: sourceItem.product_id,
                    quantity: item.qty,
                    unit: (sourceItem as any).unit
                }).select().single();

                if (insertError) {
                    throw new Error('Lỗi khi thêm sản phẩm vào Lot đích: ' + insertError.message);
                } else if (newItem) {
                    // 3. Add Tag
                    const sourceSnapshot = {
                        code: sourceLot.code,
                        inbound_date: sourceLot.inbound_date,
                        peeling_date: sourceLot.peeling_date,
                        packaging_date: sourceLot.packaging_date,
                        suppliers: sourceLot.suppliers,
                        qc_info: sourceLot.qc_info,
                        batch_code: sourceLot.batch_code,
                        warehouse_name: sourceLot.warehouse_name,
                        metadata: sourceLot.metadata,
                        positions: sourceLot.positions,
                        notes: sourceLot.notes,
                        merge_date: new Date().toISOString()
                    };

                    await supabase.from('lot_tags').insert({
                        lot_id: targetLotId,
                        lot_item_id: newItem.id,
                        tag: `MERGED_DATA:${JSON.stringify(sourceSnapshot)}`
                    });
                }
            }

            // Check if source lot is empty and clean up positions
            const { count } = await supabase
                .from('lot_items')
                .select('*', { count: 'exact', head: true })
                .eq('lot_id', sourceLot.id)

            if (count === 0) {
                await supabase
                    .from('positions')
                    .update({ lot_id: null })
                    .eq('lot_id', sourceLot.id)
            }

            onSuccess()
        } catch (e: any) {
            console.error(e)
            setError(e.message || 'Có lỗi xảy ra khi gộp Lot')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Gộp Lot</h3>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"><X size={20} /></button>
                    </div>

                    <div className="p-6 flex-1 overflow-y-auto space-y-6">
                        {/* Source Info */}
                        <div className="bg-orange-50 dark:bg-orange-900/10 p-3 rounded-xl border border-orange-100 dark:border-orange-900/20">
                            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase">Lot Nguồn</span>
                            <div className="font-bold text-lg text-slate-800 dark:text-slate-200">{sourceLot.code}</div>
                        </div>

                        {/* Target Selection */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Chọn Lot đích</label>
                            <select
                                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
                                value={targetLotId}
                                onChange={(e) => setTargetLotId(e.target.value)}
                            >
                                <option value="">-- Chọn Lot để gộp vào --</option>
                                {availableTargets.map(lot => (
                                    <option key={lot.id} value={lot.id}>
                                        {lot.code} - {lot.warehouse_name || 'N/A'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Items Selection */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Chọn sản phẩm gộp</label>
                                <button onClick={handleSelectAll} className="text-xs text-orange-600 font-bold hover:underline">Chọn tất cả</button>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {sourceLot.lot_items?.map(item => (
                                    <div key={item.id} className={`p-3 rounded-xl border transition-colors ${selectedItems[item.id] ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={!!selectedItems[item.id]}
                                                onChange={(e) => {
                                                    if (e.target.checked) handleQuantityChange(item.id, item.quantity, item.quantity.toString())
                                                    else handleQuantityChange(item.id, item.quantity, "0")
                                                }}
                                                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold truncate">{item.products?.name}</div>
                                                <div className="text-xs text-slate-500">{item.products?.sku}</div>
                                            </div>
                                            {selectedItems[item.id] ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={selectedItems[item.id]}
                                                        onChange={(e) => handleQuantityChange(item.id, item.quantity, e.target.value)}
                                                        className="w-20 p-1 text-sm font-bold text-center border border-orange-200 rounded-lg focus:outline-none focus:border-orange-500"
                                                        min="0"
                                                        max={item.quantity}
                                                    />
                                                    <span className="text-xs font-bold text-slate-500">/ {item.quantity} {(item as any).unit || item.products?.unit}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm font-bold text-slate-400">{item.quantity} {(item as any).unit || item.products?.unit}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">Hủy</button>
                        <button
                            onClick={handlePreSubmit}
                            disabled={loading}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? 'Đang xử lý...' : (
                                <>
                                    <Check size={18} />
                                    Xác nhận Gộp
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={showConfirm}
                title={confirmTitle}
                message={confirmMessage}
                onConfirm={executeMerge}
                onCancel={() => setShowConfirm(false)}
                variant="warning"
            />
        </>
    )
}
