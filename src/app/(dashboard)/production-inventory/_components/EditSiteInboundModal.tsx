'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Package, Building, FileUp } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { lotService } from '@/services/warehouse/lotService'

interface EditSiteInboundModalProps {
    lot: any
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const EditSiteInboundModal: React.FC<EditSiteInboundModalProps> = ({ lot, isOpen, onClose, onSuccess }) => {
    const { showToast } = useToast()
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [suppliers, setSuppliers] = useState<any[]>([])
    
    // Form Data
    const [quantity, setQuantity] = useState(0)
    const [unit, setUnit] = useState('')
    const [supplierId, setSupplierId] = useState('')
    const [notes, setNotes] = useState('')
    const [inboundDate, setInboundDate] = useState('')
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
    const [currentInvoiceLink, setCurrentInvoiceLink] = useState('')

    useEffect(() => {
        if (isOpen && lot) {
            const firstItem = lot.lot_items?.[0]
            setQuantity(Number(firstItem?.quantity || 0))
            setUnit(firstItem?.unit || '')
            setSupplierId(lot.supplier_id || '')
            setNotes(lot.notes || lot.metadata?.notes || '')
            setInboundDate(lot.inbound_date ? lot.inbound_date.split('T')[0] : lot.created_at.split('T')[0])
            setCurrentInvoiceLink(lot.metadata?.invoice_view_link || '')
            setInvoiceFile(null)
            fetchSuppliers()
        }
    }, [isOpen, lot])

    async function fetchSuppliers() {
        setLoading(true)
        try {
            const { data } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name')
            if (data) setSuppliers(data)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (quantity <= 0) return showToast('Số lượng không hợp lệ', 'warning')

        setSubmitting(true)
        try {
            let invoiceUrl = lot.metadata?.invoice_url || ''
            let invoiceViewLink = currentInvoiceLink

            // 1. Upload new invoice if selected
            if (invoiceFile) {
                const formData = new FormData()
                formData.append('file', invoiceFile)
                formData.append('warehouseName', lot.warehouse_name || 'Production')
                formData.append('category', 'Hóa đơn Sản xuất (Cập nhật)')

                const uploadRes = await fetch('/api/google-drive-upload', {
                    method: 'POST',
                    body: formData
                })

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json()
                    invoiceUrl = uploadData.link
                    invoiceViewLink = uploadData.viewLink
                } else {
                    showToast('Tải lên hóa đơn thất bại, vẫn tiếp tục cập nhật...', 'warning')
                }
            }

            // 2. Update LOT metadata and supplier_id
            const history = lot.metadata?.system_history || {}
            const rawInbound = history.inbound || []
            const currentInbounds = Array.isArray(rawInbound) ? rawInbound : [rawInbound]
            
            const updatedInbounds = currentInbounds.map((inb: any, idx: number) => {
                // If it's a site direct inbound, we update its primary metadata
                if (idx === 0) { // Site direct usually only has one
                    return {
                        ...inb,
                        date: inboundDate,
                        supplier_id: supplierId || null,
                        invoice_link: invoiceViewLink || inb.invoice_link,
                        description: notes || inb.description
                    }
                }
                return inb
            })

            const updatedMetadata = {
                ...lot.metadata,
                notes: notes,
                invoice_url: invoiceUrl,
                invoice_view_link: invoiceViewLink,
                updated_at: new Date().toISOString(),
                system_history: {
                    ...history,
                    inbound: updatedInbounds
                }
            }

            const { error: lotError } = await supabase
                .from('lots')
                .update({
                    supplier_id: supplierId || null,
                    notes: notes,
                    inbound_date: inboundDate,
                    metadata: updatedMetadata
                })
                .eq('id', lot.id)

            if (lotError) throw lotError

            // 3. Update Lot Item (assuming first item for site-direct-inbound)
            const firstItem = lot.lot_items?.[0]
            if (firstItem) {
                const { error: itemError } = await supabase
                    .from('lot_items')
                    .update({
                        quantity: quantity,
                        unit: unit
                    })
                    .eq('id', firstItem.id)
                
                if (itemError) throw itemError
            }

            // 4. Sync Lot Status
            await lotService.syncLotStatus({
                supabase,
                lotId: lot.id,
                isSiteIssuance: false
            })

            showToast('Cập nhật phiếu nhập thành công', 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen || !lot) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        Chỉnh Sửa Phiếu Nhập
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="text-stone-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
                    <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm">
                            <Package className="text-blue-500" />
                        </div>
                        <div>
                            <div className="font-bold text-stone-900 dark:text-gray-100 text-lg">
                                {lot.lot_items?.[0]?.products?.name}
                            </div>
                            <div className="text-xs text-stone-500 font-bold uppercase tracking-widest">
                                LOT: {lot.code}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-stone-500">Số lượng</label>
                            <QuantityInput
                                value={quantity}
                                onChange={setQuantity}
                                className="w-full p-3 text-center font-bold text-2xl rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-stone-500">Đơn vị tính</label>
                            <input
                                type="text"
                                value={unit}
                                onChange={e => setUnit(e.target.value)}
                                className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-center text-xl outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-500">Nhà cung cấp</label>
                        <select
                            value={supplierId}
                            onChange={e => setSupplierId(e.target.value)}
                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
                        >
                            <option value="">-- Chọn nhà cung cấp (nếu có) --</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-500">Ghi chú</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full p-4 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-24 resize-none transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-500">Hóa đơn mới (Tùy chọn)</label>
                        <div className="relative">
                            <input
                                type="file"
                                id="edit-invoice-upload"
                                className="hidden"
                                onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
                                accept="image/*,application/pdf"
                            />
                            <label
                                htmlFor="edit-invoice-upload"
                                className={`flex items-center gap-2 w-full p-3 rounded-xl border border-dashed transition-all cursor-pointer font-bold text-sm ${
                                    invoiceFile 
                                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                                    : 'border-stone-300 dark:border-zinc-700 hover:border-blue-400'
                                }`}
                            >
                                <FileUp size={16} />
                                <span className="truncate">
                                    {invoiceFile ? invoiceFile.name : (currentInvoiceLink ? 'Thay đổi hóa đơn hiện tại...' : 'Tải lên hóa đơn...')}
                                </span>
                            </label>
                        </div>
                        {currentInvoiceLink && !invoiceFile && (
                            <p className="text-[10px] text-blue-500 font-medium italic px-1">
                                * Đã có hóa đơn đính kèm. Upload file mới sẽ thay thế file cũ.
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-stone-500">Ngày nhập hàng (Có thể truy hồi)</label>
                        <input
                            type="date"
                            value={inboundDate}
                            onChange={e => setInboundDate(e.target.value)}
                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                    </div>
                </div>

                <div className="p-6 border-t border-stone-100 dark:border-zinc-800 flex justify-end gap-3 bg-stone-50/50 dark:bg-zinc-800/30">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-stone-500 dark:text-gray-400 font-bold hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                    >
                        {submitting ? 'Đang lưu...' : <> <Check size={18} /> Lưu thay đổi </>}
                    </button>
                </div>
            </div>
        </div>
    )
}
