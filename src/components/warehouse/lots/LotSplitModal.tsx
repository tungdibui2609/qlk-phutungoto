'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useUnitConversion } from '@/hooks/useUnitConversion'
import { Unit, ProductUnit } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { lotService } from '@/services/warehouse/lotService'
import { parseQuantity, formatQuantityFull } from '@/lib/numberUtils'
import { QuantityInput } from '@/components/ui/QuantityInput'

interface LotSplitModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
    units: Unit[]
    productUnits: ProductUnit[]
}

export const LotSplitModal: React.FC<LotSplitModalProps> = ({ lot, onClose, onSuccess, units, productUnits }) => {
    const { currentSystem } = useSystem()
    const { toBaseAmount, unitNameMap, conversionMap } = useUnitConversion()
    const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({})
    const [splitUnits, setSplitUnits] = useState<Record<string, string>>({}) // lot_item_id -> selected unit name
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [newLotCode, setNewLotCode] = useState<string>('...')

    useEffect(() => {
        generateNewLotCode()
        // Initialize splitUnits with item's current unit or product base unit
        const initialUnits: Record<string, string> = {}
        lot.lot_items?.forEach(item => {
            initialUnits[item.id] = item.unit || item.products?.unit || ''
        })
        setSplitUnits(initialUnits)
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

    const getConsumedOriginalQty = (itemId: string, selectedQty: number, selectedUnit: string) => {
        const item = lot.lot_items?.find(i => i.id === itemId)
        if (!item || !item.product_id) return selectedQty

        const baseUnit = item.products?.unit || ''
        const originalUnit = item.unit || baseUnit

        // 1. Convert selected qty to base qty
        const baseQty = toBaseAmount(item.product_id, selectedUnit, selectedQty, baseUnit)

        // 2. Convert base qty to original unit qty
        // Rate: 1 originalUnit = rate * baseUnit. So 1 baseUnit = 1/rate originalUnits.
        const originalUnitId = unitNameMap.get(originalUnit.toLowerCase())
        if (!originalUnitId) return baseQty // Fallback to base if mapping fails

        const productRates = conversionMap.get(item.product_id)
        const rate = productRates?.get(originalUnitId)
        if (!rate) return baseQty // Fallback

        return baseQty / rate
    }

    const handleQuantityChange = (itemId: string, value: number) => {
        setSplitQuantities(prev => ({
            ...prev,
            [itemId]: value
        }))
    }

    const handleUnitChange = (itemId: string, unitName: string) => {
        setSplitUnits(prev => ({ ...prev, [itemId]: unitName }))
    }

    const handleSplit = async () => {
        const itemsToSplit = Object.entries(splitQuantities).filter(([_, qty]) => {
            return qty > 0
        })
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
                const selectedQty = splitQuantities[item.id] || 0
                const selectedUnit = splitUnits[item.id] || item.unit || item.products?.unit || ''

                const consumedQty = getConsumedOriginalQty(item.id, selectedQty, selectedUnit)

                if (selectedQty > 0) {
                    // 1. Create item in new LOT
                    const { data: newItem, error: insertError } = await (supabase
                        .from('lot_items') as any)
                        .insert({
                            lot_id: newLot.id,
                            product_id: item.product_id,
                            quantity: selectedQty,
                            unit: selectedUnit
                        })
                        .select()
                        .single()

                    if (insertError) throw insertError

                    // Save history details for each item in the NEW lot
                    newItemHistories[newItem.id] = {
                        type: 'split',
                        source_code: lot.code,
                        snapshot: snapshot
                    }

                    // 2. Update or Delete original item (with Auto-Split logic via lotService)
                    await lotService.processItemAutoSplit({
                        supabase,
                        lotId: lot.id,
                        item,
                        consumedOriginalQty: consumedQty,
                        unitNameMap,
                        conversionMap,
                        preferredUnit: selectedUnit // Pass the unit user selected for the split
                    })
                }
            }

            // 3. Update NEW LOT with accurate total and histories
            const finalTotalNewLotQty = await lotService.calculateTotalBaseQty({
                supabase,
                lotId: newLot.id,
                unitNameMap,
                conversionMap
            })

            const { error: newLotUpdateErr } = await supabase.from('lots').update({
                quantity: finalTotalNewLotQty,
                metadata: {
                    ...(newLot.metadata as any || {}),
                    system_history: {
                        ...(newLot.metadata as any)?.system_history,
                        item_history: newItemHistories
                    }
                }
            }).eq('id', newLot.id)
            if (newLotUpdateErr) throw newLotUpdateErr

            // 4. Update ORIGINAL LOT with accurate total and split_to reference
            const finalTotalRemainingOriginalQty = await lotService.calculateTotalBaseQty({
                supabase,
                lotId: lot.id,
                unitNameMap,
                conversionMap
            })

            const originalMetadata = lot.metadata ? { ...lot.metadata as any } : {}
            if (!originalMetadata.system_history) originalMetadata.system_history = {}
            if (!originalMetadata.system_history.split_to) originalMetadata.system_history.split_to = []
            originalMetadata.system_history.split_to.push(newLotCode)

            const { error: origLotUpdateErr } = await supabase.from('lots').update({
                quantity: finalTotalRemainingOriginalQty,
                metadata: originalMetadata
            }).eq('id', lot.id)
            if (origLotUpdateErr) throw origLotUpdateErr

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
                                                {formatQuantityFull(item.quantity)} {(item as any).unit || item.products?.unit}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Tách ra mới:</span>
                                        <div className="flex items-center gap-2">
                                            <QuantityInput
                                                value={splitQuantities[item.id] || ''}
                                                onChange={(val) => handleQuantityChange(item.id, val)}
                                                className="w-24 p-2 text-sm font-bold text-center border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all font-mono"
                                                placeholder="0"
                                            />
                                            <select
                                                value={splitUnits[item.id] || ''}
                                                onChange={(e) => handleUnitChange(item.id, e.target.value)}
                                                className="p-2 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer"
                                            >
                                                {/* Get potential units for this product */}
                                                {[
                                                    item.products?.unit, // Base Unit
                                                    ...productUnits
                                                        .filter(pu => pu.product_id === item.product_id)
                                                        .map(pu => units.find(u => u.id === pu.unit_id)?.name)
                                                ]
                                                    .filter(Boolean)
                                                    .filter((v, i, a) => a.indexOf(v) === i) // Distinct
                                                    .map(uName => (
                                                        <option key={uName} value={uName!}>{uName}</option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    </div>
                                    {(() => {
                                        const selectedQty = splitQuantities[item.id] || 0
                                        const consumed = getConsumedOriginalQty(item.id, selectedQty, splitUnits[item.id] || '')
                                        const isOver = consumed > (item.quantity || 0) + 0.000001
                                        if (consumed > 0 && Math.abs(consumed - selectedQty) > 0.0001) {
                                            return (
                                                <div className={`mt-2 text-[10px] font-bold text-right ${isOver ? 'text-red-500' : 'text-slate-400'}`}>
                                                    ~ {formatQuantityFull(consumed)} {(item as any).unit || item.products?.unit} (gốc)
                                                    {isOver && ' - Vượt quá tồn kho!'}
                                                </div>
                                            )
                                        }
                                        return null
                                    })()}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-4 px-1 flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                            {(() => {
                                const items = lot.lot_items || [];
                                const summary = items.reduce((acc: Record<string, number>, item: any) => {
                                    const unit = (item as any).unit || item.products?.unit || 'Đơn vị';
                                    acc[unit] = (acc[unit] || 0) + (item.quantity || 0);
                                    return acc;
                                }, {});
                                return Object.entries(summary).map(([unit, total]) => (
                                    <span key={unit} className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-lg border border-orange-100 dark:border-orange-900/10">
                                        TỔNG SL GỐC: {formatQuantityFull(total as number)} {unit}
                                    </span>
                                ));
                            })()}
                        </div>
                        {Object.values(splitQuantities).some(v => v > 0) && (
                            <div className="flex flex-wrap gap-1 justify-end">
                                {(() => {
                                    const items = lot.lot_items || [];
                                    const summary = items.reduce((acc: Record<string, number>, item: any) => {
                                        const qty = splitQuantities[item.id] || 0
                                        if (qty === 0) return acc
                                        const unit = (item as any).unit || item.products?.unit || 'Đơn vị';
                                        acc[unit] = (acc[unit] || 0) + qty;
                                        return acc;
                                    }, {});
                                    return Object.entries(summary).map(([unit, total]) => (
                                        <span key={unit} className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-lg border border-purple-100 dark:border-purple-800">
                                            TÁCH RA: {formatQuantityFull(total as number)} {unit}
                                        </span>
                                    ));
                                })()}
                            </div>
                        )}
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
