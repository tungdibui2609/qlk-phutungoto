'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Save, FileText, Calendar, Info, Activity, Factory, Package, Users, Weight, Hash, Trash2, Wand2, Search, Loader2, Warehouse, ChevronDown, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'
import { useUser } from '@/contexts/UserContext'
import { useSystem } from '@/contexts/SystemContext'

interface ProductionLot {
    id?: string
    lot_code: string
    product_id: string | null
    weight_per_unit: number
    planned_quantity?: number | null
    actual_quantity?: number // Added for display
    unit?: string // Added for display
    product_name?: string // UI helper
}

interface ProductionModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    editItem?: any | null
    readOnly?: boolean
}

export default function ProductionModal({ isOpen, onClose, onSuccess, editItem, readOnly = false }: ProductionModalProps) {
    const { showToast } = useToast()
    const { profile } = useUser()
    const { systems } = useSystem()
    const [submitting, setSubmitting] = useState(false)

    // Form states
    const [code, setCode] = useState('')
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [status, setStatus] = useState('IN_PROGRESS')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    
    // Global Filter for products (Warehouse focus)
    const [targetSystemCode, setTargetSystemCode] = useState('')
    const [customerId, setCustomerId] = useState('')
    
    // Dynamic Product & Lot Lines
    const [lots, setLots] = useState<ProductionLot[]>([])

    // Data lists for selection
    const [products, setProducts] = useState<any[]>([])
    const [customers, setCustomers] = useState<any[]>([])
    const [loadingProducts, setLoadingProducts] = useState(false)
    const [loadingCustomers, setLoadingCustomers] = useState(false)

    // Per-row search states (index -> searchTerm)
    const [rowSearchTerms, setRowSearchTerms] = useState<Record<number, string>>({})
    const [activeRowIdx, setActiveRowIdx] = useState<number | null>(null)

    useEffect(() => {
        if (editItem) {
            setCode(editItem.code)
            setName(editItem.name)
            setDescription(editItem.description || '')
            setStatus(editItem.status)
            setStartDate(editItem.start_date ? new Date(editItem.start_date).toISOString().split('T')[0] : '')
            setEndDate(editItem.end_date ? new Date(editItem.end_date).toISOString().split('T')[0] : '')
            
            setTargetSystemCode(editItem.target_system_code || '')
            setCustomerId(editItem.customer_id || '')
            
            // Fetch production lots if editing (now includes product details)
            fetchProductionLots(editItem.id)
        } else {
            setCode('')
            setName('')
            setDescription('')
            setStatus('IN_PROGRESS')
            setStartDate('')
            setEndDate('')
            setTargetSystemCode('')
            setCustomerId('')
            setLots([])
            setRowSearchTerms({})
        }
    }, [editItem, isOpen])

    useEffect(() => {
        if (isOpen) {
            fetchCustomers()
        }
    }, [isOpen])

    useEffect(() => {
        if (targetSystemCode) {
            fetchProducts(targetSystemCode)
        } else {
            setProducts([])
        }
    }, [targetSystemCode])

    const fetchCustomers = async () => {
        if (!profile?.company_id) return
        setLoadingCustomers(true)
        const { data } = await supabase
            .from('customers')
            .select('id, name')
            .eq('company_id', profile.company_id)
            .order('name')
        if (data) setCustomers(data)
        setLoadingCustomers(false)
    }

    const fetchProducts = async (sysCode: string) => {
        setLoadingProducts(true)
        const { data } = await supabase
            .from('products')
            .select('id, name, sku')
            .eq('system_type', sysCode)
            .eq('is_active', true)
            .order('name')
        if (data) setProducts(data)
        setLoadingProducts(false)
    }

    const fetchProductionLots = async (prodId: string) => {
        // First get basic lot info & products
        const { data: lotsData } = await supabase
            .from('production_lots')
            .select('*, products(name, sku, unit)')
            .eq('production_id', prodId)
        
        if (lotsData) {
            // Then get stats from view
            const lotIds = (lotsData as any[]).map(l => l.id)
            const { data: statsData } = await supabase
                .from('production_item_statistics' as any)
                .select('production_lot_id, actual_quantity')
                .in('production_lot_id', lotIds) as { data: any[] | null }

            const statsMap: Record<string, number> = {}
            statsData?.forEach((s: any) => { statsMap[s.production_lot_id] = s.actual_quantity })

            const formattedLots = lotsData.map((l: any) => ({
                id: l.id,
                lot_code: l.lot_code,
                product_id: l.product_id,
                weight_per_unit: l.weight_per_unit || 0,
                planned_quantity: l.planned_quantity,
                actual_quantity: statsMap[l.id] || 0,
                unit: l.products?.unit || '',
                product_name: l.products?.name || ''
            }))
            setLots(formattedLots)
            
            // Also set row search terms
            const searches: Record<number, string> = {}
            formattedLots.forEach((l, idx) => {
                if (l.product_name) searches[idx] = l.product_name
            })
            setRowSearchTerms(searches)
        }
    }

    const generateAutoCode = () => {
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const randomStr = Math.floor(1000 + Math.random() * 9000)
        setCode(`LSX-${dateStr}-${randomStr}`)
    }

    const addLotRow = () => {
        setLots([...lots, { lot_code: '', product_id: null, weight_per_unit: 0, planned_quantity: null }])
    }

    const removeLotRow = (index: number) => {
        setLots(lots.filter((_, i) => i !== index))
        const newSearches = { ...rowSearchTerms }
        delete newSearches[index]
        setRowSearchTerms(newSearches)
    }

    const updateLotRow = (index: number, field: keyof ProductionLot, val: any) => {
        const newLots = [...lots]
        newLots[index] = { ...newLots[index], [field]: val }
        setLots(newLots)
    }

    const selectProductForRow = (index: number, product: any) => {
        const newLots = [...lots]
        newLots[index] = { 
            ...newLots[index], 
            product_id: product.id, 
            product_name: product.name 
        }
        setLots(newLots)
        setRowSearchTerms(prev => ({ ...prev, [index]: product.name }))
        setActiveRowIdx(null)
    }

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.company_id) return

        if (!lots.length) {
            showToast('Lệnh sản xuất phải có ít nhất một sản phẩm và mã lot', 'error')
            return
        }

        setSubmitting(true)
        try {
            const productionPayload = {
                code,
                name,
                description,
                status,
                start_date: startDate ? new Date(startDate).toISOString() : null,
                end_date: endDate ? new Date(endDate).toISOString() : null,
                company_id: profile.company_id,
                customer_id: customerId || null,
                target_system_code: targetSystemCode || null,
                updated_at: new Date().toISOString()
            }

            let productionId = editItem?.id
            let error

            // 1. Save Production Info
            if (productionId) {
                const { error: err } = await (supabase as any)
                    .from('productions')
                    .update(productionPayload)
                    .eq('id', productionId)
                error = err
            } else {
                const { data, error: err } = await (supabase as any)
                    .from('productions')
                    .insert([productionPayload])
                    .select()
                error = err
                if (data?.[0]) productionId = data[0].id
            }

            if (error) throw error

            // 2. Save Lots (Multi-product per lot)
            if (productionId) {
                await (supabase as any).from('production_lots').delete().eq('production_id', productionId)
                
                const validLots = lots
                    .filter(l => l.lot_code.trim() !== '' && l.product_id)
                    .map(l => ({
                        production_id: productionId,
                        product_id: l.product_id,
                        lot_code: l.lot_code,
                        weight_per_unit: l.weight_per_unit,
                        planned_quantity: l.planned_quantity || null,
                        company_id: profile.company_id
                    }))

                if (validLots.length > 0) {
                    const { error: lotErr } = await (supabase as any).from('production_lots').insert(validLots)
                    if (lotErr) throw lotErr
                }
            }

            showToast(editItem ? 'Cập nhật thành công' : 'Tạo mới thành công', 'success')
            onSuccess()
            onClose()
        } catch (error: any) {
            showToast('Lỗi: ' + error.message, 'error')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-5xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-800/50 shadow-sm shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-100 dark:bg-orange-950/30 rounded-2xl">
                            <Factory className="text-orange-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900 dark:text-white">
                                {readOnly ? 'Thông tin lệnh sản xuất' : editItem ? 'Chỉnh sửa lệnh sản xuất' : 'Tạo mới lệnh sản xuất'}
                            </h2>
                            <p className="text-xs text-stone-500 font-medium">LSX - Quy trình sản xuất đa mặt hàng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <Plus size={24} className="rotate-45 text-stone-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-stone-50/30 dark:bg-zinc-900">
                    <form id="prod-form" onSubmit={handleSubmit} className="space-y-8">
                        {/* Section 1: General Info */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                                <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                                    <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                        <Info size={14} className="text-orange-500" /> Thông tin cơ bản
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-stone-500 flex items-center justify-between">
                                                <span>Mã sản xuất</span>
                                                {!readOnly && (
                                                    <button type="button" onClick={generateAutoCode} className="text-orange-600 hover:underline flex items-center gap-1 text-[10px]">
                                                        <Wand2 size={12} /> Tự tạo
                                                    </button>
                                                )}
                                            </label>
                                            <input
                                                type="text"
                                                value={code}
                                                onChange={e => setCode(e.target.value.toUpperCase())}
                                                className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                                required
                                                disabled={readOnly}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-stone-500">Đối tác / Khách hàng</label>
                                            <select
                                                value={customerId}
                                                onChange={e => setCustomerId(e.target.value)}
                                                className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all appearance-none"
                                                disabled={readOnly}
                                            >
                                                <option value="">-- Chọn khách hàng --</option>
                                                {customers.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-2 space-y-2">
                                            <label className="text-xs font-bold text-stone-500">Nội dung sản xuất</label>
                                            <input
                                                type="text"
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                placeholder="VD: Sản xuất đơn hàng tháng 3..."
                                                className="w-full px-4 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all"
                                                required
                                                disabled={readOnly}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="p-6 bg-white dark:bg-zinc-800/40 rounded-[28px] border border-stone-200 dark:border-zinc-800 shadow-sm space-y-6">
                                    <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                        <Activity size={14} className="text-orange-500" /> Trạng thái & Thời gian
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex p-1 bg-stone-100 dark:bg-zinc-800 rounded-2xl">
                                            <button
                                                type="button"
                                                onClick={() => setStatus('IN_PROGRESS')}
                                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${status === 'IN_PROGRESS' ? 'bg-white dark:bg-zinc-700 text-orange-600 shadow-sm' : 'text-stone-400'}`}
                                                disabled={readOnly}
                                            >
                                                Đang làm
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setStatus('DONE')}
                                                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${status === 'DONE' ? 'bg-white dark:bg-zinc-700 text-emerald-600 shadow-sm' : 'text-stone-400'}`}
                                                disabled={readOnly}
                                            >
                                                Hoàn thành
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Bắt đầu</label>
                                                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold" disabled={readOnly} />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-stone-400 uppercase">Kết thúc</label>
                                                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold" disabled={readOnly} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Warehouse Filter (Global for items) */}
                        <div className="flex items-center gap-6 p-6 bg-orange-500/5 dark:bg-orange-500/5 rounded-[28px] border border-orange-200/50 dark:border-orange-900/20">
                            <div className="p-3 bg-orange-600 text-white rounded-2xl shadow-lg shadow-orange-600/20">
                                <Warehouse size={20} />
                            </div>
                            <div className="flex-1">
                                <label className="text-xs font-black uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-2 block">Cung cấp sản phẩm từ kho</label>
                                <div className="flex gap-4">
                                    {systems.map(sys => (
                                        <button
                                            key={sys.code}
                                            type="button"
                                            onClick={() => setTargetSystemCode(sys.code)}
                                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${targetSystemCode === sys.code ? 'bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/20' : 'bg-white dark:bg-zinc-800 border-stone-200 dark:border-zinc-700 text-stone-500 hover:border-orange-300'}`}
                                            disabled={readOnly}
                                        >
                                            {sys.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Product & Lot List (DYNAMIC) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2 text-stone-400 font-black text-[10px] uppercase tracking-widest">
                                    <Package size={14} className="text-orange-500" /> Danh sách sản phẩm & Lot
                                </div>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={addLotRow}
                                        disabled={!targetSystemCode}
                                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-600/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        <Plus size={16} /> Thêm sản phẩm
                                    </button>
                                )}
                            </div>

                            {!targetSystemCode ? (
                                <div className="p-20 text-center bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 border-dashed">
                                    <Warehouse className="mx-auto text-stone-200 mb-4" size={48} />
                                    <p className="text-stone-400 font-bold text-sm uppercase tracking-widest">Vui lòng chọn Phân hệ kho trước để lấy danh sách sản phẩm</p>
                                </div>
                            ) : lots.length === 0 ? (
                                <div className="p-20 text-center bg-white dark:bg-zinc-800/40 rounded-[32px] border border-stone-200 dark:border-zinc-800 border-dashed">
                                    <Package className="mx-auto text-stone-200 mb-4" size={48} />
                                    <p className="text-stone-400 font-bold text-sm uppercase tracking-widest">Chưa có sản phẩm nào. Nhấn "Thêm sản phẩm" để bắt đầu.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {lots.map((lot, idx) => (
                                        <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-white dark:bg-zinc-800/40 p-4 rounded-[24px] border border-stone-200 dark:border-zinc-800 shadow-sm relative animate-in slide-in-from-right-2 duration-200">
                                            {/* Product Search Input (Span 4) */}
                                            <div className="col-span-12 lg:col-span-4 relative">
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="Tìm sản phẩm..."
                                                        value={rowSearchTerms[idx] || ''}
                                                        onFocus={() => {
                                                            if (!readOnly) {
                                                                setActiveRowIdx(idx)
                                                                if (!rowSearchTerms[idx]) setRowSearchTerms(p => ({ ...p, [idx]: '' }))
                                                            }
                                                        }}
                                                        onChange={e => {
                                                            if (!readOnly) {
                                                                setRowSearchTerms(p => ({ ...p, [idx]: e.target.value }))
                                                                setActiveRowIdx(idx)
                                                            }
                                                        }}
                                                        className="w-full px-4 py-3 pl-10 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm"
                                                        disabled={readOnly}
                                                    />
                                                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                                </div>

                                                {/* Line Product Results */}
                                                {activeRowIdx === idx && !readOnly && (
                                                    <div className="absolute z-[120] top-full mt-2 w-full bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-2xl shadow-2xl max-h-[250px] overflow-y-auto">
                                                        {products
                                                            .filter(p => p.name.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase()) || (p.sku && p.sku.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase())))
                                                            .map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => selectProductForRow(idx, p)}
                                                                    className="w-full text-left px-5 py-3 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors border-b border-stone-50 dark:border-zinc-800 last:border-0"
                                                                >
                                                                    <div className="font-bold text-sm text-stone-800 dark:text-gray-200">{p.name}</div>
                                                                    <div className="text-[10px] font-mono text-stone-400">{p.sku || 'N/A'}</div>
                                                                </button>
                                                            ))
                                                        }
                                                        {products.filter(p => p.name.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase()) || (p.sku && p.sku.toLowerCase().includes((rowSearchTerms[idx] || '').toLowerCase()))).length === 0 && (
                                                            <div className="p-8 text-center text-stone-400 text-xs italic">Không tìm thấy sản phẩm</div>
                                                        )}
                                                    </div>
                                                )}
                                                {/* Backdrop to close list */}
                                                {activeRowIdx === idx && !readOnly && <div className="fixed inset-0 z-[115]" onClick={() => setActiveRowIdx(null)} />}
                                            </div>

                                            {/* Lot Code (Span 3) */}
                                            <div className="col-span-12 lg:col-span-3 relative">
                                                <input
                                                    type="text"
                                                    placeholder="Mã LOT"
                                                    value={lot.lot_code}
                                                    onChange={e => updateLotRow(idx, 'lot_code', e.target.value.toUpperCase())}
                                                    className="w-full px-4 py-3 pl-10 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm uppercase"
                                                    disabled={readOnly}
                                                />
                                                <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                            </div>

                                            {/* Weight (Span 1) */}
                                            <div className="col-span-12 lg:col-span-1 relative" title="Khối lượng đơn vị (kg/đv)">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="kg/đv"
                                                    value={lot.weight_per_unit}
                                                    onChange={e => updateLotRow(idx, 'weight_per_unit', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-3 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 font-bold focus:ring-4 focus:ring-orange-100 outline-none transition-all text-xs"
                                                    disabled={readOnly}
                                                />
                                            </div>

                                            {/* Actual Qty (Span 2) */}
                                            <div className="col-span-12 lg:col-span-2 relative">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] text-blue-500 font-bold uppercase tracking-wider pl-1">Thực tế</span>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={`${lot.actual_quantity || 0} ${lot.weight_per_unit > 0 ? 'thùng' : (lot.unit || '')}`}
                                                            className="w-full px-4 py-3 pl-10 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 font-black text-blue-600 outline-none text-sm"
                                                            readOnly
                                                        />
                                                        <CheckCircle2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" />
                                                    </div>
                                                    {lot.weight_per_unit > 0 && (
                                                        <span className="text-[8px] text-zinc-400 font-bold italic pl-1">({(lot.actual_quantity || 0) * lot.weight_per_unit}kg)</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Planned Qty (Span 2) */}
                                            <div className="col-span-12 lg:col-span-2 relative">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[8px] text-orange-500 font-bold uppercase tracking-wider pl-1">Kế hoạch</span>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="0"
                                                            value={lot.planned_quantity || ''}
                                                            onChange={e => updateLotRow(idx, 'planned_quantity', e.target.value ? parseFloat(e.target.value) : null)}
                                                            className="w-full px-4 py-3 pl-10 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 font-black text-orange-600 focus:ring-4 focus:ring-orange-100 outline-none transition-all text-sm"
                                                            disabled={readOnly}
                                                        />
                                                        <Activity size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400" />
                                                    </div>
                                                    {lot.weight_per_unit > 0 && (
                                                        <span className="text-[8px] text-zinc-400 font-bold italic pl-1">({(lot.planned_quantity || 0) * lot.weight_per_unit}kg)</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Actions (Span 1) */}
                                            <div className="col-span-12 lg:col-span-1 flex justify-center">
                                                {!readOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeLotRow(idx)}
                                                        className="p-3 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-2xl transition-all"
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="space-y-2 px-2">
                             <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ghi chú lệnh sản xuất</label>
                             <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={2}
                                className="w-full px-6 py-4 rounded-[24px] bg-white dark:bg-zinc-800/40 border border-stone-100 dark:border-zinc-800 focus:outline-none focus:ring-4 focus:ring-orange-100 outline-none transition-all font-medium text-stone-800 dark:text-gray-200"
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-stone-100 dark:border-zinc-800 bg-white dark:bg-zinc-800 flex items-center justify-end gap-3 shrink-0 shadow-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl border border-stone-200 dark:border-zinc-700 text-stone-600 dark:text-gray-300 font-bold hover:bg-stone-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        form="prod-form"
                        type="submit"
                        disabled={submitting}
                        className="px-10 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest shadow-xl shadow-orange-600/30 flex items-center gap-2 transition-all transform active:scale-95 disabled:opacity-70"
                    >
                        {submitting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        {editItem ? 'LƯU THAY ĐỔI' : 'TẠO LỆNH SẢN XUẤT'}
                    </button>
                </div>
            </div>
        </div>
    )
}
