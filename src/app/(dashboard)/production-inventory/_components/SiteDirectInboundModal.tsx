'use client'

import React, { useState, useEffect } from 'react'
import { X, Check, Search, Package, Plus, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { QuantityInput } from '@/components/ui/QuantityInput'
import { useSystem } from '@/contexts/SystemContext'
import { generateOrderCode } from '@/lib/orderCodeUtils'
import { lotService } from '@/services/warehouse/lotService'
import { FileUp, Link as LinkIcon, Building } from 'lucide-react'

interface SiteDirectInboundModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export const SiteDirectInboundModal: React.FC<SiteDirectInboundModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { systemType } = useSystem()
    const { showToast } = useToast()
    const [step, setStep] = useState<1 | 2>(1)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [products, setProducts] = useState<any[]>([])
    const [branches, setBranches] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    // Form Data
    const [quantity, setQuantity] = useState(1)
    const [unit, setUnit] = useState('')
    const [warehouseName, setWarehouseName] = useState('')
    const [supplierId, setSupplierId] = useState('')
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
    const [notes, setNotes] = useState('')
    const [inboundDate, setInboundDate] = useState(new Date().toISOString().split('T')[0])
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchData()
            setStep(1)
            setSelectedProduct(null)
            setQuantity(1)
            setUnit('')
            setNotes('')
            setSupplierId('')
            setInvoiceFile(null)
            setInboundDate(new Date().toISOString().split('T')[0])
        }
    }, [isOpen, systemType])

    async function fetchData() {
        setLoading(true)
        try {
            const [prodRes, branchRes, suppRes] = await Promise.all([
                supabase.from('products').select('*').eq('system_type', systemType).eq('is_active', true).order('name'),
                supabase.from('branches').select('*').order('name'),
                supabase.from('suppliers').select('*').eq('is_active', true).order('name')
            ])

            if (prodRes.data) setProducts(prodRes.data)
            if (branchRes.data) {
                setBranches(branchRes.data)
                if (branchRes.data.length > 0) {
                    const defaultBranch = branchRes.data.find((b: any) => b.is_default)?.name || branchRes.data[0].name
                    setWarehouseName(defaultBranch)
                }
            }
            if (suppRes.data) setSuppliers(suppRes.data)
        } catch (err) {
            console.error('Error fetching data:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const handleSelectProduct = (p: any) => {
        setSelectedProduct(p)
        setUnit(p.unit || '')
        setStep(2)
    }

    const handleSubmit = async () => {
        if (!selectedProduct) return showToast('Vui lòng chọn sản phẩm', 'warning')
        if (quantity <= 0) return showToast('Số lượng không hợp lệ', 'warning')
        if (!warehouseName) return showToast('Vui lòng chọn kho/hạng mục', 'warning')

        setSubmitting(true)
        try {
            let invoiceUrl = ''
            let invoiceViewLink = ''

            // 0. Upload Invoice to Google Drive if selected
            if (invoiceFile) {
                const formData = new FormData()
                formData.append('file', invoiceFile)
                formData.append('warehouseName', warehouseName)
                formData.append('category', 'Hóa đơn Sản xuất')

                const uploadRes = await fetch('/api/google-drive-upload', {
                    method: 'POST',
                    body: formData
                })

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json()
                    invoiceUrl = uploadData.link // Thumbnail/Direct link
                    invoiceViewLink = uploadData.viewLink // Google Drive web viewer link
                } else {
                    const errData = await uploadRes.json()
                    console.error('Upload failed:', errData)
                    showToast('Tải lên hóa đơn thất bại, vẫn tiếp tục nhập hàng...', 'warning')
                }
            }

            // 1. Generate LOT Code
            const lotCode = await generateOrderCode('PROD', systemType || 'KHO')

            // 2. Create LOT
            const { data: lot, error: lotError } = await supabase
                .from('lots')
                .insert({
                    code: lotCode,
                    warehouse_name: warehouseName,
                    system_code: systemType,
                    supplier_id: supplierId || null,
                    inbound_date: inboundDate,
                    status: 'active',
                    metadata: {
                        source: 'Direct Site Inbound',
                        notes: notes,
                        invoice_url: invoiceUrl,
                        invoice_view_link: invoiceViewLink,
                        created_at: new Date().toISOString(),
                        system_history: {
                            inbound: [{
                                date: inboundDate || new Date().toISOString(),
                                type: 'PROD_DIRECT',
                                description: notes || 'Nhập kho trực tiếp tại xưởng sản xuất',
                                supplier_id: supplierId || null,
                                invoice_link: invoiceViewLink || null
                            }],
                            exports: []
                        }
                    }
                })
                .select()
                .single()

            if (lotError) throw lotError

            // 3. Create Lot Item
            const { error: itemError } = await supabase
                .from('lot_items')
                .insert({
                    lot_id: lot.id,
                    product_id: selectedProduct.id,
                    quantity: quantity,
                    unit: unit || selectedProduct.unit
                })

            if (itemError) throw itemError

            // 4. Final Sync
            await lotService.syncLotStatus({
                supabase,
                lotId: lot.id,
                isSiteIssuance: false
            })

            showToast('Nhập hàng thành công', 'success')
            onSuccess()
            onClose()
        } catch (e: any) {
            showToast(e.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-stone-100 dark:border-zinc-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-900/10">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <Plus className="bg-emerald-100 dark:bg-emerald-900/30 p-1 rounded-lg" />
                        Nhập Hàng Trực Tiếp
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="text-stone-400" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {step === 1 ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                                <input
                                    className="w-full pl-10 p-3 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 outline-none font-medium focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    placeholder="Tìm sản phẩm, linh kiện..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                {loading ? (
                                    <div className="text-center py-8 text-stone-400">Đang tải danh sách sản phẩm...</div>
                                ) : filteredProducts.length === 0 ? (
                                    <div className="text-center py-8 text-stone-400">Không tìm thấy sản phẩm nào</div>
                                ) : (
                                    filteredProducts.map(p => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleSelectProduct(p)}
                                            className="p-4 rounded-xl border border-stone-200 dark:border-zinc-800 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 cursor-pointer transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-stone-100 dark:bg-zinc-800 flex items-center justify-center text-stone-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-500 transition-colors">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-stone-800 dark:text-gray-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{p.name}</div>
                                                    <div className="text-xs text-stone-500 uppercase tracking-wider">{p.sku || 'Không có SKU'}</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold px-2 py-1 rounded bg-stone-100 dark:bg-zinc-800 text-stone-600 dark:text-gray-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-600">
                                                    {p.unit}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5 animate-in slide-in-from-right-5 duration-200">
                            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 flex items-center gap-4">
                                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm">
                                    <Package className="text-emerald-500" />
                                </div>
                                <div>
                                    <div className="font-bold text-emerald-900 dark:text-emerald-400 text-lg">{selectedProduct.name}</div>
                                    <div className="text-xs text-emerald-600 dark:text-emerald-500/70 font-bold uppercase tracking-widest">{selectedProduct.sku}</div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-stone-500 flex items-center gap-2">
                                        <Building2 size={16} /> Kho / Hạng mục tiếp nhận
                                    </label>
                                    <select
                                        value={warehouseName}
                                        onChange={e => setWarehouseName(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                                    >
                                        {branches.map(b => (
                                            <option key={b.id} value={b.name}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-stone-500">Số lượng nhập</label>
                                        <QuantityInput
                                            value={quantity}
                                            onChange={setQuantity}
                                            className="w-full p-3 text-center font-bold text-2xl rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:border-emerald-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-stone-500">Đơn vị tính</label>
                                        <input
                                            type="text"
                                            value={unit}
                                            onChange={e => setUnit(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 font-bold text-center text-xl outline-none"
                                            placeholder="Đơn vị..."
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-stone-500">Ghi chú nhập hàng</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        className="w-full p-4 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 h-24 resize-none transition-all"
                                        placeholder="Nhập ghi chú ví dụ: Nhập từ nhà cung cấp A, Hàng lẻ sản xuất..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-stone-500 flex items-center gap-2">
                                            <Building size={16} /> Nhà cung cấp
                                        </label>
                                        <select
                                            value={supplierId}
                                            onChange={e => setSupplierId(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                                        >
                                            <option value="">-- Chọn nhà cung cấp (nếu có) --</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-stone-500 flex items-center gap-2">
                                            <FileUp size={16} /> Hóa đơn / Chứng từ
                                        </label>
                                        <div className="relative group">
                                            <input
                                                type="file"
                                                id="invoice-upload"
                                                className="hidden"
                                                onChange={e => setInvoiceFile(e.target.files?.[0] || null)}
                                                accept="image/*,application/pdf"
                                            />
                                            <label
                                                htmlFor="invoice-upload"
                                                className={`flex items-center gap-2 w-full p-3 rounded-xl border border-dashed transition-all cursor-pointer font-bold text-sm ${
                                                    invoiceFile 
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' 
                                                    : 'border-stone-300 dark:border-zinc-700 hover:border-emerald-400'
                                                }`}
                                            >
                                                {invoiceFile ? <Check size={16} /> : <FileUp size={16} />}
                                                <span className="truncate">
                                                    {invoiceFile ? invoiceFile.name : 'Chọn file ảnh/PDF...'}
                                                </span>
                                            </label>
                                            {invoiceFile && (
                                                <button 
                                                    onClick={(e) => { e.preventDefault(); setInvoiceFile(null); }}
                                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-stone-500">Ngày nhập hàng (Có thể truy hồi)</label>
                                    <input
                                        type="date"
                                        value={inboundDate}
                                        onChange={e => setInboundDate(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-stone-100 dark:border-zinc-800 flex justify-end gap-3 bg-stone-50/50 dark:bg-zinc-800/30">
                    {step === 2 && (
                        <button 
                            onClick={() => setStep(1)} 
                            className="px-6 py-2.5 rounded-xl text-stone-500 dark:text-gray-400 font-bold hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Quay lại
                        </button>
                    ) || (
                        <button 
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-stone-500 dark:text-gray-400 font-bold hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            Đóng
                        </button>
                    )}
                    
                    {step === 1 ? (
                        <button
                            onClick={() => selectedProduct && setStep(2)}
                            disabled={!selectedProduct}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-95"
                        >
                            Tiếp tục
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                        >
                            {submitting ? 'Đang xử lý...' : <> <Check size={18} /> Xác nhận nhập </>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
