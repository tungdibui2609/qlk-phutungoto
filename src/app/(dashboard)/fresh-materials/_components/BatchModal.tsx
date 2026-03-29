'use client'

import { useState, useEffect } from 'react'
import { Plus, Save, Leaf, Truck, Search, Wand2, X, Calendar, FileText, Package } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'

interface ReceivingRow {
    id?: string
    receiving_order: number
    vehicle_plate: string
    driver_name: string
    quantity: number
    unit: string
    received_at: string
    notes: string
    document_urls?: any[]
}

interface BatchModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editItem?: any | null
}

export default function BatchModal({ isOpen, onClose, onSuccess, editItem }: BatchModalProps) {
    const { showToast } = useToast()
    const { profile } = useUser()
    const { systemType } = useSystem()
    const [isSaving, setIsSaving] = useState(false)

    // Form states
    const [batchCode, setBatchCode] = useState('')
    const [productId, setProductId] = useState<string | null>(null)
    const [productName, setProductName] = useState('')
    const [supplierId, setSupplierId] = useState<string | null>(null)
    const [receivedDate, setReceivedDate] = useState('')
    const [initialUnit, setInitialUnit] = useState('Kg')
    const [status, setStatus] = useState('RECEIVING')
    const [notes, setNotes] = useState('')

    // Receivings (multiple deliveries)
    const [receivings, setReceivings] = useState<ReceivingRow[]>([])

    // Data
    const [products, setProducts] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [isProductSearchOpen, setIsProductSearchOpen] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchProducts()
            fetchSuppliers()
        }
    }, [isOpen])

    useEffect(() => {
        if (editItem) {
            setBatchCode(editItem.batch_code || '')
            setProductId(editItem.product_id || null)
            setProductName(editItem.products?.name || '')
            setProductSearch(editItem.products?.name || '')
            setSupplierId(editItem.supplier_id || null)
            setReceivedDate(editItem.received_date ? new Date(editItem.received_date).toISOString().split('T')[0] : '')
            setInitialUnit(editItem.initial_unit || 'Kg')
            setStatus(editItem.status || 'RECEIVING')
            setNotes(editItem.notes || '')

            // Load existing receivings
            const existingReceivings = (editItem.fresh_material_receivings || [])
                .sort((a: any, b: any) => a.receiving_order - b.receiving_order)
                .map((r: any) => ({
                    id: r.id,
                    receiving_order: r.receiving_order,
                    vehicle_plate: r.vehicle_plate || '',
                    driver_name: r.driver_name || '',
                    quantity: r.quantity || 0,
                    unit: r.unit || 'Kg',
                    received_at: r.received_at ? new Date(r.received_at).toISOString().slice(0, 16) : '',
                    notes: r.notes || '',
                    document_urls: r.document_urls || []
                }))
            setReceivings(existingReceivings.length > 0 ? existingReceivings : [createEmptyReceiving(1)])
        } else {
            resetForm()
        }
    }, [editItem, isOpen])

    const resetForm = () => {
        setBatchCode('')
        setProductId(null)
        setProductName('')
        setProductSearch('')
        setSupplierId(null)
        setReceivedDate(new Date().toISOString().split('T')[0])
        setInitialUnit('Kg')
        setStatus('RECEIVING')
        setNotes('')
        setReceivings([createEmptyReceiving(1)])
    }

    const createEmptyReceiving = (order: number): ReceivingRow => ({
        receiving_order: order,
        vehicle_plate: '',
        driver_name: '',
        quantity: 0,
        unit: 'Kg',
        received_at: new Date().toISOString().slice(0, 16),
        notes: '',
        document_urls: []
    })

    const fetchProducts = async () => {
        const { data } = await (supabase as any)
            .from('products')
            .select('id, name, sku, unit')
            .eq('system_type', systemType)
            .eq('is_active', true)
            .order('name')
        if (data) setProducts(data)
    }

    const fetchSuppliers = async () => {
        if (!profile?.company_id) return
        const { data } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('company_id', profile.company_id)
            .order('name')
        if (data) setSuppliers(data)
    }

    const generateAutoCode = () => {
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const randomStr = Math.floor(1000 + Math.random() * 9000)
        setBatchCode(`NLT-${dateStr}-${randomStr}`)
    }

    const addReceiving = () => {
        const newOrder = receivings.length + 1
        setReceivings([...receivings, createEmptyReceiving(newOrder)])
    }

    const removeReceiving = (index: number) => {
        if (receivings.length <= 1) return
        const updated = receivings.filter((_, i) => i !== index).map((r, i) => ({ ...r, receiving_order: i + 1 }))
        setReceivings(updated)
    }

    const updateReceiving = (index: number, field: keyof ReceivingRow, value: any) => {
        const updated = [...receivings]
        updated[index] = { ...updated[index], [field]: value }
        setReceivings(updated)
    }

    const [isUploading, setIsUploading] = useState<string | null>(null)

    const handleUploadReceivingDocument = async (index: number) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = "image/*,application/pdf"
        input.setAttribute('capture', 'environment')
        input.multiple = true
        input.onchange = async (e: any) => {
            const files = e.target.files
            if (!files || files.length === 0) return

            const uploadId = `rec-${index}`
            setIsUploading(uploadId)
            try {
                const currentDocs = receivings[index].document_urls || []
                const newDocs = [...currentDocs]

                for (const file of files) {
                    const formData = new FormData()
                    const fileBlob = new Blob([await file.arrayBuffer()], { type: file.type })
                    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_')
                    
                    formData.append('file', fileBlob, safeFileName)
                    formData.append('companyName', (profile as any)?.companies?.name || 'Công ty')
                    formData.append('warehouseName', systemType)
                    formData.append('category', 'HoaDon_Xe_NguyenLieu')

                    const robustFetch = async (url: string, options: any, retries = 3): Promise<Response> => {
                        try {
                            const res = await fetch(url, options)
                            return res
                        } catch (err) {
                            if (retries > 0 && err instanceof TypeError) {
                                await new Promise(r => setTimeout(r, 1500))
                                return robustFetch(url, options, retries - 1)
                            }
                            throw err
                        }
                    }

                    const res = await robustFetch(`${window.location.origin}/api/google-drive-upload`, {
                        method: 'POST',
                        body: formData,
                        keepalive: true,
                        headers: {
                            'Cache-Control': 'no-cache',
                            'Pragma': 'no-cache'
                        }
                    })
                    const data = await res.json()

                    if (data.success) {
                        newDocs.push({
                            name: data.name,
                            link: data.viewLink,
                            fileId: data.fileId,
                            uploadedAt: new Date().toISOString()
                        })
                    } else {
                        throw new Error(data.error || 'Upload failed')
                    }
                }

                updateReceiving(index, 'document_urls', newDocs)
                showToast(`Đã tải lên ${files.length} hóa đơn xe`, 'success')
            } catch (err: any) {
                let errorMessage = err.message
                if (err instanceof Response) {
                    try {
                        const errorData = await err.json()
                        errorMessage = errorData.error || errorData.details || errorMessage
                    } catch (e) {}
                }
                showToast('Lỗi upload: ' + errorMessage, 'error')
            } finally {
                setIsUploading(null)
            }
        }
        input.click()
    }

    const removeReceivingDocument = (recIndex: number, fileId: string) => {
        const currentDocs = receivings[recIndex].document_urls || []
        const newDocs = currentDocs.filter((d: any) => d.fileId !== fileId)
        updateReceiving(recIndex, 'document_urls', newDocs)
    }

    // Total quantity from all receivings
    const totalQuantity = receivings.reduce((sum, r) => sum + (r.quantity || 0), 0)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.company_id) return

        if (receivings.length === 0 || receivings.every(r => r.quantity <= 0)) {
            showToast('Vui lòng nhập ít nhất 1 lần nhận hàng với số lượng > 0', 'error')
            return
        }

        setIsSaving(true)
        try {
            const batchPayload = {
                batch_code: batchCode,
                system_code: systemType,
                company_id: profile.company_id,
                product_id: productId,
                supplier_id: supplierId,
                received_date: receivedDate ? new Date(receivedDate).toISOString() : new Date().toISOString(),
                total_initial_quantity: totalQuantity,
                initial_unit: initialUnit,
                status,
                notes: notes || null,
                created_by: profile.id,
                updated_at: new Date().toISOString()
            }

            let batchId = editItem?.id
            let error

            if (batchId) {
                const { error: err } = await (supabase as any)
                    .from('fresh_material_batches')
                    .update(batchPayload)
                    .eq('id', batchId)
                error = err
            } else {
                const { data, error: err } = await (supabase as any)
                    .from('fresh_material_batches')
                    .insert([batchPayload])
                    .select()
                error = err
                if (data?.[0]) batchId = data[0].id
            }

            if (error) throw error

            // Save receivings
            if (batchId) {
                await (supabase as any).from('fresh_material_receivings').delete().eq('batch_id', batchId)

                const validReceivings = receivings
                    .filter(r => r.quantity > 0)
                    .map(r => ({
                        batch_id: batchId,
                        receiving_order: r.receiving_order,
                        vehicle_plate: r.vehicle_plate || null,
                        driver_name: r.driver_name || null,
                        quantity: r.quantity,
                        unit: r.unit || 'Kg',
                        received_at: r.received_at ? new Date(r.received_at).toISOString() : new Date().toISOString(),
                        notes: r.notes || null,
                        document_urls: r.document_urls || []
                    }))

                if (validReceivings.length > 0) {
                    const { error: recErr } = await (supabase as any).from('fresh_material_receivings').insert(validReceivings)
                    if (recErr) throw recErr
                }
            }

            showToast(editItem ? 'Cập nhật lô NLT thành công' : 'Tạo lô NLT thành công', 'success')
            onSuccess()
            onClose()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(productSearch.toLowerCase())
    )

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 w-full h-full md:h-auto md:max-h-[95vh] md:max-w-4xl md:rounded-[32px] overflow-hidden shadow-2xl animate-in md:zoom-in-95 slide-in-from-bottom-10 md:slide-in-from-bottom-0 duration-300 flex flex-col">
                {/* Header */}
                <div className="px-5 md:px-8 py-4 md:py-6 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50 shadow-sm shrink-0 uppercase tracking-widest font-black">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="p-2.5 md:p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30">
                            <Leaf className="text-emerald-600 w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <h2 className="text-sm md:text-xl text-stone-900 dark:text-white">
                                {editItem ? 'Sửa lô' : 'Tạo lô mới'}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="text-stone-400 w-5 h-5 md:w-6 md:h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-stone-50/30 dark:bg-zinc-900 pb-24 md:pb-8">
                    <form id="batch-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Section: Basic Info */}
                        <div className="p-5 md:p-6 bg-white dark:bg-zinc-800/40 rounded-[24px] md:rounded-[28px] border border-stone-100 dark:border-zinc-800 shadow-sm space-y-5 md:space-y-6">
                            <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                <FileText size={14} className="text-emerald-500" /> Thông tin lô
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Batch Code */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500 flex items-center justify-between">
                                        <span>Mã lô</span>
                                        <button type="button" onClick={generateAutoCode} className="text-emerald-600 hover:underline flex items-center gap-1 text-[10px] uppercase">
                                            <Wand2 size={12} /> Tự tạo
                                        </button>
                                    </label>
                                    <input
                                        type="text"
                                        value={batchCode}
                                        onChange={e => setBatchCode(e.target.value.toUpperCase())}
                                        placeholder="VD: NLT-20260327-001"
                                        className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all uppercase"
                                        required
                                    />
                                </div>

                                {/* Supplier */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-stone-500">Nhà cung cấp</label>
                                    <select
                                        value={supplierId || ''}
                                        onChange={e => setSupplierId(e.target.value || null)}
                                        className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none appearance-none"
                                    >
                                        <option value="">-- Chọn NCC --</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>

                                {/* Product Search */}
                                <div className="space-y-2 relative">
                                    <label className="text-xs font-bold text-stone-500">Nguyên liệu gốc</label>
                                    <div className="relative">
                                        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input
                                            type="text"
                                            value={productSearch}
                                            onChange={e => { setProductSearch(e.target.value); setIsProductSearchOpen(true) }}
                                            onFocus={() => setIsProductSearchOpen(true)}
                                            onBlur={() => setTimeout(() => setIsProductSearchOpen(false), 200)}
                                            placeholder="Tìm nguyên liệu..."
                                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                        />
                                    </div>
                                    {isProductSearchOpen && (
                                        <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-xl border border-stone-100 dark:border-zinc-700 z-[110] max-h-60 overflow-y-auto">
                                            {filteredProducts.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setProductId(p.id)
                                                        setProductName(p.name)
                                                        setProductSearch(p.name)
                                                        setInitialUnit(p.unit || 'Kg')
                                                        setIsProductSearchOpen(false)
                                                    }}
                                                    className="w-full text-left px-5 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex flex-col"
                                                >
                                                    <span className="font-bold text-sm text-stone-800 dark:text-white">{p.name}</span>
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">{p.sku} • {p.unit}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-stone-500">Ngày nhận</label>
                                        <input
                                            type="date"
                                            value={receivedDate}
                                            onChange={e => setReceivedDate(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-stone-500">Trạng thái</label>
                                        <select
                                            value={status}
                                            onChange={e => setStatus(e.target.value)}
                                            className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none appearance-none"
                                        >
                                            <option value="RECEIVING">Đang nhận</option>
                                            <option value="PROCESSING">Đang xử lý</option>
                                            <option value="COMPLETED">Hoàn thành</option>
                                            <option value="CANCELLED">Đã hủy</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <label className="text-xs font-bold text-stone-500">Ghi chú</label>
                                    <textarea
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Ghi chú về lô hàng..."
                                        rows={2}
                                        className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-medium text-sm focus:ring-4 focus:ring-emerald-100 outline-none transition-all resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Receivings Section */}
                        <div className="p-5 md:p-6 bg-white dark:bg-zinc-800/40 rounded-[24px] md:rounded-[28px] border border-stone-100 dark:border-zinc-800 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                    <Truck size={14} className="text-blue-500" /> Nhập xe ({receivings.length})
                                </div>
                                <button
                                    type="button"
                                    onClick={addReceiving}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-bold hover:bg-blue-100 transition-colors uppercase"
                                >
                                    <Plus size={14} /> Thêm xe
                                </button>
                            </div>

                            <div className="space-y-4">
                                {receivings.map((rec, idx) => (
                                    <div key={idx} className="p-4 bg-stone-50 dark:bg-zinc-800 rounded-2xl border border-stone-50 dark:border-zinc-700 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Lần {rec.receiving_order}</span>
                                            {receivings.length > 1 && (
                                                <button type="button" onClick={() => removeReceiving(idx)} className="text-red-400 p-1">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Biển số</label>
                                                <input
                                                    type="text"
                                                    value={rec.vehicle_plate}
                                                    onChange={e => updateReceiving(idx, 'vehicle_plate', e.target.value.toUpperCase())}
                                                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 text-sm font-bold outline-none uppercase"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Số lượng</label>
                                                <input
                                                    type="number"
                                                    value={rec.quantity || ''}
                                                    onChange={e => updateReceiving(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 text-sm font-black outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2 md:col-span-1 space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Thời gian</label>
                                                <input
                                                    type="datetime-local"
                                                    value={rec.received_at}
                                                    onChange={e => updateReceiving(idx, 'received_at', e.target.value)}
                                                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 text-[10px] font-bold outline-none"
                                                />
                                            </div>

                                            {/* Receiving Documents */}
                                            <div className="col-span-2 md:col-span-1 space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Hóa đơn xe</label>
                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={!!isUploading}
                                                        onClick={() => handleUploadReceivingDocument(idx)}
                                                        className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-dashed border-stone-200 dark:border-zinc-700 flex items-center justify-center text-stone-400 hover:text-emerald-600 hover:border-emerald-300 transition-all"
                                                    >
                                                        {isUploading === `rec-${idx}` ? (
                                                            <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <Plus size={18} />
                                                        )}
                                                    </button>
                                                    
                                                    {(rec.document_urls || []).map((doc: any) => (
                                                        <div key={doc.fileId} className="relative group/doc w-10 h-10 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 flex items-center justify-center">
                                                            <a href={doc.link} target="_blank" rel="noopener noreferrer">
                                                                <FileText size={16} className="text-blue-500" />
                                                            </a>
                                                            <button 
                                                                type="button"
                                                                onClick={() => removeReceivingDocument(idx, doc.fileId)}
                                                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/doc:opacity-100 transition-opacity"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="fixed md:static bottom-0 left-0 right-0 px-5 md:px-8 py-4 md:py-5 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md md:bg-white md:dark:bg-zinc-800/50 shrink-0 z-20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-sm font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors uppercase tracking-widest font-black"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        form="batch-form"
                        disabled={isSaving}
                        className="px-5 py-2.5 md:px-6 md:py-3 rounded-xl md:rounded-2xl text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 uppercase tracking-widest font-black"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {editItem ? 'Cập nhật' : 'Lưu lô'}
                    </button>
                </div>
            </div>
        </div>
    )
}
