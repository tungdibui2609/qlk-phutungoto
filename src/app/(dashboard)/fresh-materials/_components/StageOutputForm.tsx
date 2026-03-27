'use client'

import { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/components/ui/ToastProvider'

interface StageOutputFormProps {
    stageId: string
    batchId: string
    systemCode: string
    defaultUnit: string
    onSuccess: () => void
}

export default function StageOutputForm({ stageId, batchId, systemCode, defaultUnit, onSuccess }: StageOutputFormProps) {
    const { showToast } = useToast()
    const [isAdding, setIsAdding] = useState(false)
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
        if (outputType === 'PRODUCT' && products.length === 0) {
            fetchProducts('')
        }
    }, [outputType])

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
        setIsAdding(false)
    }

    const handleAdd = async () => {
        if (quantity <= 0) {
            showToast('Số lượng phải > 0', 'error')
            return
        }

        setIsSaving(true)
        try {
            const { error } = await (supabase as any)
                .from('fresh_material_stage_outputs')
                .insert([{
                    stage_id: stageId,
                    batch_id: batchId,
                    product_id: productId,
                    output_type: outputType,
                    quantity,
                    unit,
                    grade: grade || null,
                    notes: notes || null
                }])

            if (error) throw error
            showToast('Đã thêm output', 'success')
            resetForm()
            onSuccess()
        } catch (err: any) {
            showToast('Lỗi: ' + err.message, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isAdding) {
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsAdding(true) }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-stone-200 dark:border-zinc-700 text-[10px] font-bold text-stone-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors"
            >
                <Plus size={12} /> Thêm output
            </button>
        )
    }

    return (
        <div className="space-y-2 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-stone-200 dark:border-zinc-700 animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
            {/* Type Selector */}
            <div className="flex gap-1">
                {(['PRODUCT', 'WASTE', 'SAMPLE'] as const).map(type => (
                    <button
                        key={type}
                        type="button"
                        onClick={() => setOutputType(type)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                            outputType === type
                                ? type === 'WASTE'
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30'
                                    : type === 'SAMPLE'
                                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30'
                                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30'
                                : 'bg-stone-50 dark:bg-zinc-800 text-stone-400'
                        }`}
                    >
                        {type === 'PRODUCT' ? 'Sản phẩm' : type === 'WASTE' ? 'Phế/Hao' : 'Mẫu'}
                    </button>
                ))}
            </div>

            {/* Product Search (only for PRODUCT type) */}
            {outputType === 'PRODUCT' && (
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        value={productSearch}
                        onChange={e => handleSearchChange(e.target.value)}
                        onFocus={() => setIsSearchOpen(true)}
                        onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                        placeholder="Gắn sản phẩm (tùy chọn)..."
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-medium focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                    {isSearchOpen && products.length > 0 && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-stone-100 z-[120] max-h-40 overflow-y-auto">
                            {products.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => { setProductId(p.id); setProductSearch(p.name); setIsSearchOpen(false) }}
                                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-xs"
                                >
                                    <span className="font-bold">{p.name}</span>
                                    <span className="text-stone-400 ml-2">{p.sku}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Quantity + Grade row */}
            <div className="grid grid-cols-3 gap-2">
                <div>
                    <input
                        type="number"
                        value={quantity || ''}
                        onChange={e => setQuantity(parseFloat(e.target.value) || 0)}
                        placeholder="SL"
                        className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-black focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                </div>
                <div>
                    <input
                        type="text"
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        placeholder="ĐVT"
                        className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-bold focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                </div>
                <div>
                    <input
                        type="text"
                        value={grade}
                        onChange={e => setGrade(e.target.value)}
                        placeholder="Hạng (A,B...)"
                        className="w-full px-3 py-2 rounded-lg bg-stone-50 dark:bg-zinc-800 border border-stone-100 dark:border-zinc-700 text-xs font-medium focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2">
                <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-stone-400 hover:bg-stone-100"
                >
                    Hủy
                </button>
                <button
                    type="button"
                    onClick={handleAdd}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                >
                    {isSaving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus size={10} />}
                    Thêm
                </button>
            </div>
        </div>
    )
}
