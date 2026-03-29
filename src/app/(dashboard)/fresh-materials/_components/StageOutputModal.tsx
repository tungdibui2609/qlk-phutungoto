'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Save, X, Package, TrendingDown, Layers, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'

interface StageOutputModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    stageId: string
    batchId: string
    systemCode: string
    defaultUnit: string
    stageName: string
    editItem?: any | null
}

export default function StageOutputModal({ 
    isOpen, 
    onClose, 
    onSuccess, 
    stageId, 
    batchId, 
    systemCode, 
    defaultUnit,
    stageName,
    editItem
}: StageOutputModalProps) {
    const { showToast } = useToast()
    const [isSaving, setIsSaving] = useState(false)

    const [outputType, setOutputType] = useState<'PRODUCT' | 'WASTE' | 'SAMPLE'>('PRODUCT')
    const [quantity, setQuantity] = useState(0)
    const [unit, setUnit] = useState(defaultUnit)
    const [grade, setGrade] = useState('')
    const [notes, setNotes] = useState('')
    const [productId, setProductId] = useState<string | null>(null)

    // Inline product search
    const [products, setProducts] = useState<any[]>([])
    const [productSearch, setProductSearch] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    useEffect(() => {
        if (isOpen) {
            if (editItem) {
                setOutputType(editItem.output_type || 'PRODUCT')
                setQuantity(editItem.quantity || 0)
                setUnit(editItem.unit || defaultUnit)
                setGrade(editItem.grade || '')
                setNotes(editItem.notes || '')
                setProductId(editItem.product_id || null)
                setProductSearch(editItem.products?.name || '')
                if (editItem.output_type === 'PRODUCT') {
                    fetchProducts(editItem.products?.name || '')
                }
            } else {
                resetForm()
                if (outputType === 'PRODUCT') {
                    fetchProducts('')
                }
            }
        }
    }, [isOpen, editItem])

    const fetchProducts = async (search: string) => {
        let query = (supabase as any)
            .from('products')
            .select('id, name, sku, unit')
            .eq('system_type', systemCode)
            .limit(50)
            
        if (search) {
            query = query.ilike('name', `%${search}%`)
        }
        
        const { data } = await query
        if (data) setProducts(data)
    }

    const handleSearchChange = (val: string) => {
        setProductSearch(val)
        setIsSearchOpen(true)
        fetchProducts(val)
    }

    const resetForm = () => {
        setOutputType('PRODUCT')
        setQuantity(0)
        setUnit(defaultUnit)
        setGrade('')
        setNotes('')
        setProductId(null)
        setProductSearch('')
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (quantity <= 0) {
            showToast('Số lượng phải > 0', 'error')
            return
        }

        setIsSaving(true)
        try {
            const payload = {
                stage_id: stageId,
                batch_id: batchId,
                product_id: productId,
                output_type: outputType,
                quantity,
                unit,
                grade: grade || null,
                notes: notes || null
            }

            if (editItem?.id) {
                const { error } = await (supabase as any)
                    .from('fresh_material_stage_outputs')
                    .update(payload)
                    .eq('id', editItem.id)
                if (error) throw error
                showToast('Đã cập nhật output', 'success')
            } else {
                const { error } = await (supabase as any)
                    .from('fresh_material_stage_outputs')
                    .insert([payload])
                if (error) throw error
                showToast('Đã thêm output', 'success')
            }

            onSuccess()
            onClose()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-800/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/30">
                            <Package className="text-emerald-600" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-stone-800 dark:text-white uppercase tracking-tight">Thêm kết quả đầu ra</h2>
                            <p className="text-xs text-stone-500 font-bold uppercase tracking-widest">
                                Giai đoạn: <span className="text-emerald-600 underline underline-offset-4">{stageName}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                        <X size={24} className="text-stone-400" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    {/* Output Type Selector */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                            <Layers size={14} className="text-emerald-500" /> Loại kết quả đầu ra
                        </div>
                        <div className="grid grid-cols-3 gap-3 p-1.5 bg-stone-100 dark:bg-zinc-800 rounded-2xl">
                            {(['PRODUCT', 'WASTE', 'SAMPLE'] as const).map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setOutputType(type)}
                                    className={`py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                                        outputType === type
                                            ? type === 'WASTE'
                                                ? 'bg-red-500 text-white shadow-xl shadow-red-500/20 scale-[1.02]'
                                                : type === 'SAMPLE'
                                                ? 'bg-purple-500 text-white shadow-xl shadow-purple-500/20 scale-[1.02]'
                                                : 'bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 scale-[1.02]'
                                            : 'text-stone-400 hover:text-stone-600'
                                    }`}
                                >
                                    {type === 'PRODUCT' ? 'Sản phẩm' : type === 'WASTE' ? 'Phế / Hao hụt' : 'Mẫu thử'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Search Section */}
                    {outputType === 'PRODUCT' && (
                        <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-stone-400">
                                <Search size={14} className="text-emerald-500" /> Liên kết sản phẩm
                            </div>
                            <div className="relative">
                                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={e => handleSearchChange(e.target.value)}
                                    onFocus={() => setIsSearchOpen(true)}
                                    onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                                    placeholder="Tìm tên sản phẩm hoặc mã SKU từ danh mục..."
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all shadow-sm"
                                />
                                {isSearchOpen && products.length > 0 && (
                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-stone-100 dark:border-zinc-700 z-[130] max-h-60 overflow-y-auto p-2 animate-in slide-in-from-top-2">
                                        {products.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => { setProductId(p.id); setProductSearch(p.name); setIsSearchOpen(false) }}
                                                className="w-full text-left px-5 py-3.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all group flex items-center justify-between"
                                            >
                                                <div>
                                                    <div className="font-black text-sm text-stone-700 dark:text-white group-hover:text-emerald-700 transition-colors uppercase">{p.name}</div>
                                                    <div className="text-[10px] font-bold text-stone-400 group-hover:text-emerald-600/50 uppercase tracking-widest">{p.sku}</div>
                                                </div>
                                                <Plus size={16} className="text-stone-300 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Metrics and Grade Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Số lượng kết quả</label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        value={quantity || ''}
                                        onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="w-full px-6 py-5 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-3xl font-black focus:ring-4 focus:ring-emerald-100 outline-none transition-all pr-20"
                                    />
                                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-sm font-black text-stone-300 uppercase group-focus-within:text-emerald-500 transition-colors">
                                        {unit}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Đơn vị tính</label>
                                    <input
                                        type="text"
                                        value={unit}
                                        onChange={e => setUnit(e.target.value)}
                                        placeholder="Kg / Thùng..."
                                        className="w-full px-4 py-4 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all uppercase"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Phân hạng / Loại</label>
                                    <input
                                        type="text"
                                        value={grade}
                                        onChange={e => setGrade(e.target.value)}
                                        placeholder="Hạng A, B..."
                                        className="w-full px-4 py-4 rounded-2xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ghi chú chi tiết</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={6}
                                placeholder="Nhập thêm ghi chú về chất lượng hoặc điểm đặc biệt của kết quả này..."
                                className="w-full px-6 py-4 rounded-3xl bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-sm font-bold focus:ring-4 focus:ring-emerald-100 outline-none transition-all resize-none shadow-sm h-full"
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between bg-stone-50/50 dark:bg-zinc-800/50 bg-white">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-stone-400 hover:bg-stone-100 dark:hover:bg-zinc-800 hover:text-stone-600 transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={isSaving}
                        className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xl shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-3 transition-all hover:scale-[1.03] active:scale-95"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <Save size={18} />
                        )}
                        Lưu kết quả đầu ra
                    </button>
                </div>
            </div>
        </div>
    )
}
