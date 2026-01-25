'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'

interface LotSplitModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
}

export const LotSplitModal: React.FC<LotSplitModalProps> = ({ lot, onClose, onSuccess }) => {
    const { currentSystem } = useSystem()
    const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({}) // lot_item_id -> quantity to move
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newLotCode, setNewLotCode] = useState<string>('...')

    useEffect(() => {
        generateNewLotCode()
    }, [lot, currentSystem])

    async function generateNewLotCode() {
        if (!currentSystem?.name) return;

        const today = new Date()
        const day = String(today.getDate()).padStart(2, '0')
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const year = String(today.getFullYear()).slice(-2)
        const dateStr = `${day}${month}${year}`

        let warehousePrefix = ''
        const cleanName = currentSystem.name.replace(/^Kho\s+/i, '').trim()
        const initials = cleanName.split(/\s+/).map(word => word[0]).join('')
        const normalized = initials
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")

        warehousePrefix = normalized.toUpperCase().replace(/[^A-Z0-9]/g, '')
        const prefix = warehousePrefix ? `${warehousePrefix}-LOT-${dateStr}-` : `LOT-${dateStr}-`

        const { data } = await supabase
            .from('lots')
            .select('code')
            .ilike('code', `${prefix}%`)
            .order('code', { ascending: false })
            .limit(1)

        let sequence = 1
        if (data && data.length > 0) {
            const lastCode = (data as any)[0].code
            const lastSequence = parseInt(lastCode.split('-').pop() || '0')
            if (!isNaN(lastSequence)) {
                sequence = lastSequence + 1
            }
        }

        setNewLotCode(`${prefix}${String(sequence).padStart(3, '0')}`)
    }

    const handleQuantityChange = (itemId: string, maxQty: number, value: string) => {
        const qty = parseFloat(value)
        if (isNaN(qty) || qty < 0) return

        if (qty === 0) {
            const newSplit = { ...splitQuantities }
            delete newSplit[itemId]
            setSplitQuantities(newSplit)
        } else {
            setSplitQuantities(prev => ({
                ...prev,
                [itemId]: Math.min(qty, maxQty)
            }))
        }
    }

    const handleSplit = async () => {
        const itemsToSplit = Object.entries(splitQuantities).filter(([_, qty]) => qty > 0)
        if (itemsToSplit.length === 0) {
            setError('Vui lòng nhập số lượng muốn tách cho ít nhất 1 sản phẩm')
            return
        }

        setLoading(true)
        setError(null)

        try {
            // 1. Create New LOT record
            const { data: newLot, error: lotError } = await (supabase
                .from('lots') as any)
                .insert({
                    code: newLotCode,
                    notes: lot.notes,
                    supplier_id: lot.supplier_id,
                    qc_id: lot.qc_id,
                    inbound_date: lot.inbound_date,
                    peeling_date: lot.peeling_date,
                    packaging_date: lot.packaging_date,
                    warehouse_name: lot.warehouse_name,
                    batch_code: lot.batch_code,
                    status: 'active',
                    system_code: lot.system_code,
                    images: lot.images,
                    metadata: {
                        ...(lot.metadata as any || {}),
                        extra_info: (lot.metadata as any)?.extra_info,
                        system_history: {
                            item_history: {}
                        }
                    }
                })
                .select()
                .single()

            if (lotError) throw lotError

            // Prepare snapshot for history
            const snapshot = {
                code: lot.code,
                inbound_date: lot.inbound_date,
                peeling_date: lot.peeling_date,
                packaging_date: lot.packaging_date,
                suppliers: lot.suppliers,
                qc_info: lot.qc_info,
                batch_code: lot.batch_code,
                warehouse_name: lot.warehouse_name,
                metadata: lot.metadata,
                positions: lot.positions,
                notes: lot.notes,
                split_date: new Date().toISOString()
            };

            // 2. Process Items
            let totalNewLotQty = 0
            let totalRemainingOriginalQty = 0
            const newItemHistories: Record<string, any> = {}

            for (const item of lot.lot_items || []) {
                const splitQty = splitQuantities[item.id] || 0
                const remainingQty = (item.quantity || 0) - splitQty

                if (splitQty > 0) {
                    // Create item in new LOT
                    const { data: newItem, error: insertError } = await (supabase
                        .from('lot_items') as any)
                        .insert({
                            lot_id: newLot.id,
                            product_id: item.product_id,
                            quantity: splitQty,
                            unit: (item as any).unit
                        })
                        .select()
                        .single()

                    if (insertError) throw insertError
                    totalNewLotQty += splitQty

                    // Save history in metadata map
                    newItemHistories[newItem.id] = {
                        type: 'split',
                        source_code: lot.code,
                        snapshot: snapshot
                    }

                    // Update or Delete original item
                    if (remainingQty <= 0) {
                        const { error: deleteError } = await supabase
                            .from('lot_items')
                            .delete()
                            .eq('id', item.id)
                        if (deleteError) throw deleteError
                    } else {
                        const { error: updateError } = await supabase
                            .from('lot_items')
                            .update({ quantity: remainingQty })
                            .eq('id', item.id)
                        if (updateError) throw updateError
                        totalRemainingOriginalQty += remainingQty
                    }
                } else {
                    totalRemainingOriginalQty += item.quantity || 0
                }
            }

            // 3. Update New LOT with its item histories
            await supabase.from('lots').update({
                quantity: totalNewLotQty,
                metadata: {
                    ...(newLot.metadata as any),
                    system_history: {
                        ...(newLot.metadata as any).system_history,
                        item_history: newItemHistories
                    }
                }
            }).eq('id', newLot.id)

            // 4. Update Original LOT with remaining qty and split_to reference
            const originalMetadata = lot.metadata ? { ...lot.metadata as any } : {}
            if (!originalMetadata.system_history) originalMetadata.system_history = {}
            if (!originalMetadata.system_history.split_to) originalMetadata.system_history.split_to = []
            originalMetadata.system_history.split_to.push(newLotCode)

            await supabase.from('lots').update({
                quantity: totalRemainingOriginalQty,
                metadata: originalMetadata
            }).eq('id', lot.id)

            onSuccess()
        } catch (e: any) {
            console.error('Split error:', e)
            setError(e.message || 'Có lỗi xảy ra khi tách LOT')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            Tách LOT
                        </h3>
                        <p className="text-sm font-medium mt-1">
                            Mã LOT: <span className="text-purple-600 dark:text-purple-400 font-bold">{lot.code}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                <div className="px-6 py-2 border-t border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="mt-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                            Chọn dòng sản phẩm muốn tách
                        </h4>

                        <div className="space-y-3">
                            {lot.lot_items?.map(item => (
                                <div key={item.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-purple-500/50 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                                                {item.products?.sku}
                                            </div>
                                            <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                                                {item.products?.name}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                {item.quantity} {(item as any).unit || item.products?.unit}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Tách ra mới:</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={splitQuantities[item.id] || ''}
                                                onChange={(e) => handleQuantityChange(item.id, item.quantity || 0, e.target.value)}
                                                className="w-20 p-2 text-sm font-bold text-center border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all"
                                                placeholder="0"
                                                min="0"
                                                max={item.quantity || 0}
                                            />
                                            <span className="text-xs font-bold text-slate-500">{(item as any).unit || item.products?.unit}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                        <p className="text-sm text-slate-500 leading-relaxed">
                            <span className="font-bold">Lưu ý:</span> Hệ thống sẽ:
                        </p>
                        <ul className="mt-2 space-y-1.5 list-disc pl-5 text-sm text-slate-500">
                            <li>Tạo LOT mới với số lượng đã tách <span className="font-medium text-slate-700 dark:text-slate-300">(giữ nguyên thông tin header)</span></li>
                            <li>Cập nhật LOT hiện tại với số lượng còn lại</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 flex items-center justify-end gap-3 mt-auto">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        disabled={loading}
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSplit}
                        disabled={loading || Object.values(splitQuantities).every(v => v === 0)}
                        className="px-8 py-2.5 bg-[#C084FC] hover:bg-[#A855F7] text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Đang tách...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Tách LOT
                            </>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] p-4 bg-red-600 text-white rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300">
                    <AlertCircle size={20} />
                    <span className="text-sm font-bold">{error}</span>
                    <button onClick={() => setError(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={16} /></button>
                </div>
            )}
        </div>
    )
}
