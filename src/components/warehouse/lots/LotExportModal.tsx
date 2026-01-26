'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2, Warehouse, User, FileText, ArrowUpRight } from 'lucide-react'
import { Lot } from '@/app/(dashboard)/warehouses/lots/_hooks/useLotManagement'
import { supabase } from '@/lib/supabaseClient'
import { useSystem } from '@/contexts/SystemContext'
import { useToast } from '@/components/ui/ToastProvider'

interface LotExportModalProps {
    lot: Lot
    onClose: () => void
    onSuccess: () => void
}

export const LotExportModal: React.FC<LotExportModalProps> = ({ lot, onClose, onSuccess }) => {
    const { systemType, currentSystem } = useSystem()
    const { showToast } = useToast()
    const [exportQuantities, setExportQuantities] = useState<Record<string, number>>({}) // lot_item_id -> quantity to export
    const [customerName, setCustomerName] = useState('')
    const [description, setDescription] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Initialize with full quantities
        const initialQuantities: Record<string, number> = {}
        lot.lot_items?.forEach(item => {
            initialQuantities[item.id] = item.quantity || 0
        })
        setExportQuantities(initialQuantities)
    }, [lot])

    const handleQuantityChange = (itemId: string, maxQty: number, value: string) => {
        const qty = parseFloat(value)
        if (isNaN(qty) || qty < 0) return
        setExportQuantities(prev => ({
            ...prev,
            [itemId]: Math.min(qty, maxQty)
        }))
    }

    const handleExportAll = () => {
        const fullQuantities: Record<string, number> = {}
        lot.lot_items?.forEach(item => {
            fullQuantities[item.id] = item.quantity || 0
        })
        setExportQuantities(fullQuantities)
    }

    const generateOrderCode = async () => {
        const today = new Date()
        const dateStr = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`

        // Get initials from system name
        let prefix = 'PXK'
        if (currentSystem?.name) {
            const cleanName = currentSystem.name.replace(/^Kho\s+/i, '').trim()
            prefix = cleanName.split(/\s+/).map(word => word[0]).join('').toUpperCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
            prefix = `${prefix}-PXK`
        }

        const { data } = await supabase
            .from('outbound_orders')
            .select('code')
            .ilike('code', `${prefix}-${dateStr}-%`)
            .order('code', { ascending: false })
            .limit(1)

        let sequence = 1
        if (data && data.length > 0) {
            const lastCode = data[0].code
            const lastSeq = parseInt(lastCode.split('-').pop() || '0')
            if (!isNaN(lastSeq)) sequence = lastSeq + 1
        }

        return `${prefix}-${dateStr}-${String(sequence).padStart(3, '0')}`
    }

    const handleExport = async () => {
        const itemsToExport = Object.entries(exportQuantities).filter(([_, qty]) => qty > 0)
        if (itemsToExport.length === 0) {
            setError('Vui lòng nhập số lượng muốn xuất cho ít nhất 1 sản phẩm')
            return
        }
        if (!customerName.trim()) {
            setError('Vui lòng nhập tên khách hàng')
            return
        }

        setLoading(true)
        setError(null)

        try {
            // Process Items & Update LOT
            let totalRemainingLotQty = 0
            const exportItemsData: Record<string, any> = {}

            for (const item of lot.lot_items || []) {
                const exportQty = exportQuantities[item.id] || 0
                const remainingQty = (item.quantity || 0) - exportQty

                if (exportQty > 0) {
                    // Track for history buffer
                    exportItemsData[item.id] = {
                        product_id: item.product_id,
                        product_sku: item.products?.sku,
                        product_name: item.products?.name,
                        exported_quantity: exportQty,
                        unit: item.unit || item.products?.unit,
                        cost_price: item.products?.cost_price || 0
                    }

                    // Update or Delete lot item
                    if (remainingQty <= 0) {
                        await supabase.from('lot_items').delete().eq('id', item.id)
                    } else {
                        await supabase.from('lot_items').update({ quantity: remainingQty }).eq('id', item.id)
                        totalRemainingLotQty += remainingQty
                    }
                } else {
                    totalRemainingLotQty += item.quantity || 0
                }
            }

            // Update Lot History Metadata (Buffered)
            const originalMetadata = lot.metadata ? { ...lot.metadata as any } : {}
            if (!originalMetadata.system_history) originalMetadata.system_history = {}
            if (!originalMetadata.system_history.exports) originalMetadata.system_history.exports = []

            // Add to buffer
            originalMetadata.system_history.exports.push({
                id: crypto.randomUUID(),
                customer: customerName,
                date: new Date().toISOString(),
                description: description,
                items: exportItemsData,
                draft: true, // Marked as draft for the buffer mechanism
                order_id: null
            })

            // Final Update to LOT
            await supabase.from('lots').update({
                quantity: totalRemainingLotQty,
                metadata: originalMetadata,
                status: totalRemainingLotQty === 0 ? 'exported' : lot.status
            }).eq('id', lot.id)

            // Map Cleanup: If lot is empty, clear from positions
            if (totalRemainingLotQty === 0) {
                await supabase.from('positions').update({ lot_id: null }).eq('lot_id', lot.id)
            }

            showToast('Đã thêm vào hàng chờ xuất kho', 'success')
            onSuccess()
        } catch (e: any) {
            console.error('Export error:', e)
            setError(e.message || 'Có lỗi xảy ra khi xuất LOT')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 pb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <ArrowUpRight size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                                Xuất LOT
                            </h3>
                            <p className="text-sm font-medium mt-1">
                                Mã LOT: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{lot.code}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                        <X size={24} className="text-slate-500" />
                    </button>
                </div>

                <div className="px-6 py-2 border-t border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Customer & Info */}
                    <div className="mt-4 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                <User size={12} />
                                Khách hàng / Nơi nhận <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium"
                                placeholder="Nhập tên khách hàng hoặc bộ phận nhận..."
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase ml-1 flex items-center gap-1.5">
                                <FileText size={12} />
                                Ghi chú xuất kho
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-medium min-h-[80px] resize-none"
                                placeholder="Lý do xuất, ghi chú vận chuyển..."
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-3 px-1">
                            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Chi tiết sản phẩm xuất
                            </h4>
                            <button
                                onClick={handleExportAll}
                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
                            >
                                XUẤT TẤT CẢ
                            </button>
                        </div>

                        <div className="space-y-3">
                            {lot.lot_items?.map(item => (
                                <div key={item.id} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-500/50 transition-all">
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
                                            <div className="text-xs text-slate-400 font-bold uppercase mb-1">Hiện có</div>
                                            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                                                {item.quantity} {(item as any).unit || item.products?.unit}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Số lượng xuất:</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={exportQuantities[item.id] || ''}
                                                onChange={(e) => handleQuantityChange(item.id, item.quantity || 0, e.target.value)}
                                                className="w-24 p-2 text-sm font-bold text-center border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 transition-all"
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

                    <div className="mt-6 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                            <span className="font-bold">Lưu ý:</span> Khi xác nhận xuất kho:
                        </p>
                        <ul className="mt-2 space-y-1 list-disc pl-5 text-[11px] text-blue-600 dark:text-blue-400">
                            <li>Hệ thống sẽ tạo **Phiếu Xuất Kho** tự động để ghi nhận tồn kho tổng.</li>
                            <li>Ghi lại lịch sử xuất trong nhật ký LOT.</li>
                            <li>Nếu xuất hết, LOT sẽ được gỡ khỏi vị trí trên **Sơ đồ kho**.</li>
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
                        onClick={handleExport}
                        disabled={loading || Object.values(exportQuantities).every(v => v === 0) || !customerName.trim()}
                        className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95 flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            <>
                                <Check size={18} />
                                Xác nhận xuất LOT
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
