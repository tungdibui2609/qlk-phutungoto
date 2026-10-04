'use client'

import React, { useState } from 'react'
import { X, RotateCcw, AlertTriangle, CheckCircle2, Package, Calendar, MapPin, Hash, Layers, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useSystem } from '@/contexts/SystemContext'
import { decodeSTT, encodeSTT } from '@/lib/numberUtils'

interface RecreateLotModalProps {
    lot: any | null
    onClose: () => void
    onSuccess: (newLotId: string) => void
}

export function RecreateLotModal({ lot, onClose, onSuccess }: RecreateLotModalProps) {
    const { systemType } = useSystem()
    const { showToast } = useToast()

    // Original data extraction
    const rawData = lot?._rawOldData || lot || {}
    const originalCode = rawData.code || lot?.code || ''
    const originalDailySeq = rawData.daily_seq ?? lot?.daily_seq
    const originalInboundDate = rawData.inbound_date || lot?.inbound_date || ''
    const originalPackagingDate = rawData.packaging_date || lot?.packaging_date || ''
    const originalPeelingDate = rawData.peeling_date || lot?.peeling_date || ''
    const originalRawMaterialDate = rawData.raw_material_date || lot?.raw_material_date || ''
    const originalBatchCode = rawData.batch_code || lot?.batch_code || ''
    const originalProductionCode = rawData.production_code || lot?.production_code || ''
    const originalSupplierId = rawData.supplier_id || lot?.supplier_id || null
    const originalNotes = rawData.notes || lot?.notes || ''

    // Items extraction
    const itemsList: Array<{ productId: string; name: string; sku: string; quantity: number; unit: string }> = []
    if (rawData.lot_items && Array.isArray(rawData.lot_items) && rawData.lot_items.length > 0) {
        rawData.lot_items.forEach((item: any) => {
            itemsList.push({
                productId: item.product_id || item.productId,
                name: item.products?.name || item.product_name || 'Sản phẩm',
                sku: item.products?.sku || item.product_sku || '-',
                quantity: item.quantity || 0,
                unit: item.unit || item.products?.unit || 'Đơn vị'
            })
        })
    } else if (lot?.products) {
        itemsList.push({
            productId: lot.product_id || '',
            name: lot.products?.name || 'Sản phẩm',
            sku: lot.products?.sku || '-',
            quantity: lot.quantity || 0,
            unit: lot.products?.unit || 'Đơn vị'
        })
    }

    // Editable form state
    const [code, setCode] = useState(originalCode)
    const [stt, setStt] = useState(originalDailySeq ? decodeSTT(originalDailySeq) : '')
    const [inboundDate, setInboundDate] = useState(originalInboundDate)
    const [packagingDate, setPackagingDate] = useState(originalPackagingDate)
    const [peelingDate, setPeelingDate] = useState(originalPeelingDate)
    const [rawMaterialDate, setRawMaterialDate] = useState(originalRawMaterialDate)
    const [batchCode, setBatchCode] = useState(originalBatchCode)
    const [productionCode, setProductionCode] = useState(originalProductionCode)
    const [notes, setNotes] = useState(originalNotes ? `${originalNotes} (Khôi phục lại)` : 'Khôi phục từ lịch sử')
    const [items, setItems] = useState(itemsList)
    const [submitting, setSubmitting] = useState(false)

    const isDeleted = lot?._isDeleted || lot?.status === 'deleted'
    const isExported = lot?.status === 'exported'

    const handleQuantityChange = (index: number, newQty: number) => {
        setItems(prev => {
            const next = [...prev]
            next[index] = { ...next[index], quantity: Math.max(0, newQty) }
            return next
        })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!code.trim()) {
            showToast('Mã LOT không được để trống', 'warning')
            return
        }

        setSubmitting(true)
        try {
            // Check if active lot with exact same code already exists
            const { data: existingLot } = await supabase
                .from('lots')
                .select('id, status, code')
                .eq('code', code.trim())
                .eq('system_code', systemType || rawData.system_code)
                .maybeSingle()

            if (existingLot && existingLot.status === 'active') {
                showToast(`Mã LOT "${code.trim()}" hiện đang tồn tại trong kho (ID: ${existingLot.id}). Vui lòng đổi mã khác (ví dụ: ${code.trim()}-RE).`, 'warning')
                setSubmitting(false)
                return
            }

            const totalQuantity = items.reduce((sum, it) => sum + (it.quantity || 0), 0)
            const primaryProductId = items[0]?.productId || rawData.product_id || null

            // 1. Prepare lot payload
            const lotPayload: any = {
                code: code.trim(),
                status: 'active',
                system_code: systemType || rawData.system_code || 'KHO_DONG_LANH',
                warehouse_name: rawData.warehouse_name || "CN Cư M'gar",
                company_id: rawData.company_id || null,
                supplier_id: originalSupplierId,
                product_id: primaryProductId,
                quantity: totalQuantity,
                daily_seq: stt.trim() ? encodeSTT(stt.trim()) : null,
                inbound_date: inboundDate || null,
                packaging_date: packagingDate || null,
                peeling_date: peelingDate || null,
                raw_material_date: rawMaterialDate || null,
                batch_code: batchCode || null,
                production_code: productionCode || null,
                production_id: rawData.production_id || null,
                notes: notes,
                metadata: {
                    ...(rawData.metadata || {}),
                    recreated_at: new Date().toISOString(),
                    recreated_from_source: isDeleted ? 'deleted_lot' : 'exported_lot',
                    recreated_original_code: originalCode
                }
            }

            // 2. Insert lot into lots table
            const { data: newLot, error: lotError } = await (supabase
                .from('lots') as any)
                .insert(lotPayload)
                .select('id')
                .single()

            if (lotError) throw lotError
            const newLotId = newLot.id

            // 3. Insert lot items if any
            if (items.length > 0 && newLotId) {
                const itemsToInsert = items
                    .filter(it => it.productId)
                    .map(it => ({
                        lot_id: newLotId,
                        product_id: it.productId,
                        quantity: Number(Number(it.quantity).toFixed(6)),
                        unit: it.unit
                    }))

                if (itemsToInsert.length > 0) {
                    const { error: itemsErr } = await (supabase
                        .from('lot_items') as any)
                        .insert(itemsToInsert)

                    if (itemsErr) {
                        console.error('Error inserting lot_items for recreated lot:', itemsErr)
                    }
                }
            }

            // 4. Insert lot tags if original had any
            if (rawData.lot_tags && Array.isArray(rawData.lot_tags) && rawData.lot_tags.length > 0) {
                const tagsToInsert = rawData.lot_tags.map((t: any) => ({
                    lot_id: newLotId,
                    tag: t.tag
                }))
                await (supabase.from('lot_tags') as any).insert(tagsToInsert)
            }

            // 5. Log CREATE to audit_logs
            const { data: { session } } = await supabase.auth.getSession()
            await (supabase.from('audit_logs') as any).insert({
                table_name: 'lots',
                record_id: newLotId,
                action: 'CREATE',
                new_data: {
                    ...lotPayload,
                    recreated: true,
                    original_code: originalCode
                },
                changed_by: session?.user?.id,
                system_code: systemType || rawData.system_code
            })

            showToast(`Đã khôi phục và tạo lại thành công LOT [${code.trim()}] vào kho!`, 'success')
            onSuccess(newLotId)
            onClose()
        } catch (err: any) {
            console.error('Error recreating lot:', err)
            showToast('Lỗi khi tạo lại LOT: ' + err.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-slate-800 bg-stone-50/50 dark:bg-slate-850">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                            <RotateCcw size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                                Khôi phục / Tạo lại LOT
                                {isDeleted && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 uppercase">
                                        Đã xóa
                                    </span>
                                )}
                                {isExported && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase">
                                        Đã xuất bán
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400">
                                Xem lại thông tin gốc và đưa LOT trở lại danh sách kho đang hoạt động.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Notice alert */}
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                        <AlertTriangle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={18} />
                        <div className="text-xs text-amber-800 dark:text-amber-300">
                            <b>Ghi chú:</b> LOT sẽ được tạo mới vào kho với trạng thái <b>Đang hoạt động (active)</b>. Bạn có thể giữ nguyên mã cũ hoặc chỉnh sửa thông tin số lượng/ngày tháng trước khi bấm xác nhận.
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                                Mã LOT <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                required
                                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm font-mono font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                                STT LOT trong ngày
                            </label>
                            <input
                                type="text"
                                value={stt}
                                onChange={(e) => setStt(e.target.value)}
                                placeholder="Ví dụ: A01, 15, B22..."
                                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm font-mono font-bold text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                                Lệnh sản xuất (LSX)
                            </label>
                            <input
                                type="text"
                                value={productionCode}
                                onChange={(e) => setProductionCode(e.target.value)}
                                placeholder="Mã LSX..."
                                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                                Lô sản xuất (Mã lô)
                            </label>
                            <input
                                type="text"
                                value={batchCode}
                                onChange={(e) => setBatchCode(e.target.value)}
                                placeholder="Mã lô..."
                                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm font-mono text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                                Ngày nhập kho
                            </label>
                            <input
                                type="date"
                                value={inboundDate}
                                onChange={(e) => setInboundDate(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                                Ngày đóng gói
                            </label>
                            <input
                                type="date"
                                value={packagingDate}
                                onChange={(e) => setPackagingDate(e.target.value)}
                                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm font-medium text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                            />
                        </div>
                    </div>

                    {/* Products & Quantity */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                            Chi tiết sản phẩm & Số lượng:
                        </label>
                        <div className="space-y-2">
                            {items.map((it, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 p-3.5 bg-stone-50 dark:bg-slate-800/80 rounded-xl border border-stone-200 dark:border-slate-700">
                                    <div className="min-w-0 flex-1">
                                        <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400 block">
                                            {it.sku}
                                        </span>
                                        <span className="text-sm font-bold text-stone-800 dark:text-stone-200 truncate block">
                                            {it.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="any"
                                            value={it.quantity}
                                            onChange={(e) => handleQuantityChange(idx, parseFloat(e.target.value) || 0)}
                                            className="w-24 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-stone-200 dark:border-slate-700 text-sm font-bold text-right text-orange-600 focus:outline-none focus:border-orange-500"
                                        />
                                        <span className="text-xs font-bold text-stone-400 min-w-[40px]">
                                            {it.unit}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <p className="text-xs text-stone-400 italic">Không tìm thấy thông tin sản phẩm cụ thể từ bản ghi cũ.</p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-stone-600 dark:text-stone-400 mb-1">
                            Ghi chú tạo lại
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 active:scale-95 transition-all shadow-lg shadow-orange-500/25"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Đang tạo lại...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={16} />
                                    <span>Xác nhận tạo lại LOT vào kho</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
