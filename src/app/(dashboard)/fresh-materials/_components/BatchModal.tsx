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
                    notes: r.notes || ''
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
        notes: ''
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
                        notes: r.notes || null
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30">
                            <Leaf className="text-emerald-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                                {editItem ? 'Chỉnh sửa lô NLT' : 'Tạo lô nguyên liệu tươi'}
                            </h2>
                            <p className="text-xs text-stone-500 font-medium">
                                Quản lý lô nguyên liệu và lần nhập xe
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={24} className="text-stone-400" />
                    </button>
                </div>

                {/* Body */}
                <form id="batch-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 bg-stone-50/30 dark:bg-zinc-900">
                    {/* Section: Basic Info */}
                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                            <FileText size={14} className="text-emerald-500" /> Thông tin lô
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Batch Code */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-500 flex items-center justify-between">
                                    <span>Mã lô</span>
                                    <button type="button" onClick={generateAutoCode} className="text-emerald-600 hover:underline flex items-center gap-1 text-[10px]">
                                        <Wand2 size={12} /> Tự tạo
                                    </button>
                                </label>
                                <input
                                    type="text"
                                    value={batchCode}
                                    onChange={e => setBatchCode(e.target.value.toUpperCase())}
                                    placeholder="VD: NLT-20260327-001"
                                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                    required
                                />
                            </div>

                            {/* Supplier */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-stone-500">Nhà cung cấp</label>
                                <select
                                    value={supplierId || ''}
                                    onChange={e => setSupplierId(e.target.value || null)}
                                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all appearance-none"
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
                                        {filteredProducts.length === 0 && (
                                            <div className="px-5 py-4 text-center text-xs text-stone-400 italic">Không tìm thấy</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Date & Status */}
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

                            {/* Notes */}
                            <div className="md:col-span-2 space-y-2">
                                <label className="text-xs font-bold text-stone-500">Ghi chú</label>
                                <textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ghi chú về lô nguyên liệu..."
                                    rows={2}
                                    className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-medium text-sm focus:ring-4 focus:ring-emerald-100 outline-none transition-all resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section: Receivings (Multiple Deliveries) */}
                    <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                <Truck size={14} className="text-blue-500" /> Lần nhập xe ({receivings.length})
                            </div>
                            <button
                                type="button"
                                onClick={addReceiving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-xs font-bold hover:bg-blue-100 transition-colors"
                            >
                                <Plus size={14} /> Thêm xe
                            </button>
                        </div>

                        {/* Total Summary */}
                        <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/30">
                            <Package size={18} className="text-emerald-600" />
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Tổng nhập</span>
                                <div className="text-lg font-black text-stone-800 dark:text-white">
                                    {totalQuantity.toLocaleString('vi-VN')} <span className="text-xs text-stone-400 uppercase">{initialUnit}</span>
                                </div>
                            </div>
                        </div>

                        {/* Receiving Rows */}
                        <div className="space-y-3">
                            {receivings.map((rec, idx) => (
                                <div key={idx} className="p-4 bg-stone-50 dark:bg-zinc-800 rounded-2xl border border-stone-100 dark:border-zinc-700 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-stone-500 uppercase tracking-widest">
                                            Lần {rec.receiving_order}
                                        </span>
                                        {receivings.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeReceiving(idx)}
                                                className="p-1 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase">Biển số xe</label>
                                            <input
                                                type="text"
                                                value={rec.vehicle_plate}
                                                onChange={e => updateReceiving(idx, 'vehicle_plate', e.target.value.toUpperCase())}
                                                placeholder="51F-12345"
                                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 text-sm font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase">Tài xế</label>
                                            <input
                                                type="text"
                                                value={rec.driver_name}
                                                onChange={e => updateReceiving(idx, 'driver_name', e.target.value)}
                                                placeholder="Tên tài xế"
                                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 text-sm font-medium focus:ring-2 focus:ring-emerald-100 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase">Số lượng ({initialUnit})</label>
                                            <input
                                                type="number"
                                                value={rec.quantity || ''}
                                                onChange={e => updateReceiving(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                                placeholder="0"
                                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 text-sm font-black focus:ring-2 focus:ring-emerald-100 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase">Thời gian</label>
                                            <input
                                                type="datetime-local"
                                                value={rec.received_at}
                                                onChange={e => updateReceiving(idx, 'received_at', e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-stone-100 dark:border-zinc-700 text-xs font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl text-sm font-bold text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        type="submit"
                        form="batch-form"
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-6 py-3 rounded-2xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save size={16} />
                        )}
                        {editItem ? 'Cập nhật' : 'Tạo lô mới'}
                    </button>
                </div>
            </div>
        </div>
    )
}
